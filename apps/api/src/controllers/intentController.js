/**
 * ============================================================================
 * CONTROLLER: ZERO-SEARCH INTENT & BATCH MATCHING (LEVEL 3)
 * ============================================================================
 */

import {
  createIntent,
  getIntents,
  getIntentById,
  updateIntent,
  getMatchingEpochs,
  getBookings
} from '../db/sqliteStore.js';

import {
  runBatchMatchingEpoch,
  calculateShapleyFairPrice,
  getCorridorDistanceKm
} from '../services/batchMatchingEngine.js';

import { cleanPhoneNumber, isValidVietnamesePhone, maskPhoneNumber } from '@carmate/shared';
import { sendBusinessAlert } from '../utils/telegramAlert.js';

/**
 * POST /api/intents - Khai báo ý định di chuyển (Chủ xe hoặc Khách)
 */
export async function createMovementIntentHandler(req, res) {
  try {
    const {
      role = 'passenger', // 'driver' | 'passenger'
      originHubId = '',
      originName = '',
      destinationHubId = '',
      destinationName = '',
      corridor = 'Tuyến QL13',
      date = '',
      timeSlot = '',
      seats = 1,
      isRecurring = false,
      recurringDays = [],
      isDoorstep = false,
      doorstepAddress = '',
      doorstepLat = null,
      doorstepLng = null,
      phone = '',
      contactName = ''
    } = req.body || {};

    const clean = cleanPhoneNumber(phone || req.user?.phone || '');
    if (!clean || !isValidVietnamesePhone(clean)) {
      return res.status(400).json({
        success: false,
        error: 'Số điện thoại không hợp lệ (cần đủ 10 số di động Việt Nam)'
      });
    }

    if (!originName || !destinationName) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng chọn điểm đi và điểm đến hợp lệ'
      });
    }

    // Tính toán ước tính giá Shapley minh bạch ngay khi khai báo ý định
    const distKm = getCorridorDistanceKm(originHubId || originName, destinationHubId || destinationName, corridor);
    const pricingEstimate = calculateShapleyFairPrice({
      distanceKm: distKm,
      corridor,
      numPassengers: Number(seats) || 1,
      isDoorstep: Boolean(isDoorstep)
    });

    const intent = await createIntent({
      userId: req.user?.id || `USR-${clean}`,
      role: role === 'driver' ? 'driver' : 'passenger',
      originHubId,
      originName,
      destinationHubId,
      destinationName,
      corridor,
      date,
      timeSlot,
      seats: Number(seats) || 1,
      isRecurring: Boolean(isRecurring),
      recurringDays: Array.isArray(recurringDays) ? recurringDays : [],
      isDoorstep: Boolean(isDoorstep),
      doorstepAddress,
      doorstepLat,
      doorstepLng,
      phone: clean,
      contactName: contactName || req.user?.name || (role === 'driver' ? 'Chủ xe' : 'Khách đi cùng'),
      estimatedPricing: pricingEstimate
    });

    // ⚡️ Bắn cảnh báo khẩn cấp về Telegram của Founder để khớp lệnh thủ công siêu tốc (Wizard of Oz Engine)
    if (role === 'passenger') {
      const priceText = pricingEstimate?.finalPricePerSeat
        ? `${Number(pricingEstimate.finalPricePerSeat).toLocaleString('vi-VN')} đ`
        : '165.000 đ';
      sendBusinessAlert({
        title: '🚨 YÊU CẦU XE TIỆN CHUYẾN MỚI (QL13)',
        details: {
          'Khách hàng': `${contactName || 'Người đi cùng'} (${clean})`,
          'Lộ trình': `${originName} ➔ ${destinationName}`,
          'Thời gian': `${date} (${timeSlot})`,
          'Số chỗ': `${seats} ghế`,
          'Ước tính giá': priceText,
          '⚡️ ĐIỀU PHỐI': 'Bốc máy kiểm tra lịch xe nhà / gọi chủ xe quen trong 5 phút!'
        },
        req
      }).catch((alertErr) => {
        console.warn('[IntentController] Failed to dispatch Telegram business alert:', alertErr?.message);
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Khai báo ý định thành công. Hệ thống đang tự động gom phiên khớp lệnh.',
      data: intent,
      estimatedPricing: pricingEstimate
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/intents - Lấy danh sách ý định
 */
export function getMovementIntentsHandler(req, res) {
  try {
    const { role, corridor, date, status, userId, mine } = req.query || {};
    const filter = {};
    if (role) filter.role = role;
    if (corridor) filter.corridor = corridor;
    if (date) filter.date = date;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const intents = getIntents(filter);

    const viewerPhone = cleanPhoneNumber(req.user?.phone || '');
    const viewerId = req.user?.id || null;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

    const isOwner = (intent) =>
      isAdmin ||
      (viewerPhone && cleanPhoneNumber(intent.phone || '') === viewerPhone) ||
      (viewerId && intent.userId === viewerId);

    // `?mine=1`: chỉ trả ý định của chính người đang đăng nhập. Trước đây giao
    // diện phải tải TOÀN BỘ ý định rồi tự lọc theo số điện thoại ở phía client —
    // cách đó chỉ chạy được vì máy chủ lộ số thật của tất cả mọi người.
    const scoped = mine ? intents.filter(isOwner) : intents;

    // LỚP CHẮN PII (Nghị định 13/2023): sàn công khai chỉ được thấy bí danh và
    // số đã che. Số thật, tên thật chỉ hiện với chính chủ hoặc Quản trị viên.
    const data = scoped.map((intent) => {
      if (isOwner(intent)) return { ...intent, isOwner: true };
      const tail = String(intent.id || '').slice(-3).toUpperCase() || 'XXX';
      const safe = { ...intent };
      safe.phoneMasked = maskPhoneNumber(intent.phone || '');
      safe.publicName = intent.role === 'driver' ? `Chủ xe CX-${tail}` : `Người đi cùng KX-${tail}`;
      delete safe.phone;
      delete safe.phoneReal;
      delete safe.contactName;
      delete safe.userId;
      delete safe.matchedBookingId;
      return safe;
    });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/intents/match - Kích hoạt phiên gom khớp lệnh tức thời (Manual hoặc Micro-batch)
 */
export async function runBatchMatchHandler(req, res) {
  try {
    const { epochType = 'micro_batch', corridor, date } = req.body || {};
    const result = await runBatchMatchingEpoch({ epochType, corridor, date });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/intents/epochs - Lịch sử các phiên khớp lệnh
 */
export function getMatchingEpochsHandler(req, res) {
  try {
    const limit = Number(req.query.limit) || 20;
    const epochs = getMatchingEpochs(limit);
    return res.status(200).json({
      success: true,
      data: epochs
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * =============================================================================
 * SỬA & HUỶ Ý ĐỊNH DI CHUYỂN (INTENT MUTATION)
 * =============================================================================
 * Trước đây giao diện Taplo Chủ xe có bốn thao tác "3 giây" (dời giờ, đổi ghế,
 * huỷ lịch chờ, huỷ chuyến đã ghép) nhưng KHÔNG thao tác nào gọi máy chủ: tất cả
 * chỉ setState trong trình duyệt rồi hiện toast kiểu "Đã gửi tin nhắn tới người
 * đi cùng". Chủ xe tin là khách đã được báo, khách thì không nhận được gì, và
 * tải lại trang là mọi thay đổi biến mất. Bốn endpoint dưới đây là nơi các thao
 * tác đó thực sự có hiệu lực.
 */


/**
 * Đếm số khách ĐÃ THỰC SỰ được ghép vào một ý định của Chủ xe.
 *
 * Không dùng `intent.matchedRiders`: trường đó không có nơi nào ghi (engine khớp
 * lệnh chỉ đặt matchedTripId/matchedBookingId trên ý định của KHÁCH), nên đếm
 * theo nó thì luôn ra 0 và mọi rào chắn dựa trên nó đều vô hiệu.
 */
function countMatchedRiders(intent) {
  if (Array.isArray(intent.matchedRiders) && intent.matchedRiders.length > 0) {
    return intent.matchedRiders.length;
  }
  const linkedTripId = intent.matchedTripId || intent.tripId;
  if (!linkedTripId) return 0;
  return getBookings().filter(
    (b) => (b.tripId === linkedTripId || b.targetTripId === linkedTripId) && b.status !== 'cancelled'
  ).length;
}

/** Chỉ chủ sở hữu ý định (hoặc quản trị viên) mới được sửa nó. */
function assertIntentOwnership(intent, req) {
  if (req.user?.role === 'admin') return true;
  const userPhone = req.user?.phone ? cleanPhoneNumber(req.user.phone) : '';
  const intentPhone = intent.phone ? cleanPhoneNumber(intent.phone) : '';
  if (userPhone && intentPhone && userPhone === intentPhone) return true;
  if (req.user?.id && intent.userId && req.user.id === intent.userId) return true;
  return false;
}

/**
 * PATCH /api/intents/:id - Sửa ý định đang chờ (dời giờ, đổi số ghế)
 */
export async function updateMovementIntentHandler(req, res) {
  try {
    const { id } = req.params;
    const intent = getIntentById(id);
    if (!intent) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy lịch trình cần cập nhật' });
    }
    if (!assertIntentOwnership(intent, req)) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền sửa lịch trình của người khác' });
    }
    if (intent.status === 'cancelled') {
      return res.status(409).json({ success: false, error: 'Lịch trình đã huỷ, không thể sửa.' });
    }

    const { timeSlot, seats, date } = req.body || {};
    const updates = {};

    if (timeSlot !== undefined) {
      if (!/^\d{1,2}:\d{2}/.test(String(timeSlot))) {
        return res.status(400).json({ success: false, error: 'Khung giờ không hợp lệ (định dạng HH:MM).' });
      }
      updates.timeSlot = String(timeSlot);
    }

    if (seats !== undefined) {
      const seatNum = Number(seats);
      if (!Number.isFinite(seatNum) || seatNum < 1 || seatNum > 7) {
        return res.status(400).json({ success: false, error: 'Số ghế phải từ 1 đến 7.' });
      }
      // Không cho hạ số ghế xuống dưới số khách đã ghép: khách đã được xác nhận
      // mà bị đẩy ra vì Chủ xe bấm nhầm là mất chỗ thật.
      const matchedCount = countMatchedRiders(intent);
      if (seatNum < matchedCount) {
        return res.status(409).json({
          success: false,
          error: `Đã có ${matchedCount} khách được ghép. Muốn giảm xuống ${seatNum} ghế, vui lòng huỷ bớt khách trước.`
        });
      }
      updates.seats = seatNum;
    }

    if (date !== undefined) updates.date = String(date);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'Không có thay đổi nào được gửi lên.' });
    }

    updates.updatedAt = new Date().toISOString();
    const updated = await updateIntent(id, updates);

    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật lịch trình. Người đi cùng đã ghép sẽ nhận được thông báo.',
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/intents/:id - Huỷ ý định di chuyển
 *
 * Huỷ lịch CHỜ (chưa ghép ai) là thao tác không rào cản. Huỷ lịch ĐÃ GHÉP thì
 * đánh dấu để bộ máy chế tài và điều phối cứu hộ xử lý — chứ không phải trừ điểm
 * ở trình duyệt như trước.
 */
export async function cancelMovementIntentHandler(req, res) {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body || {};

    const intent = getIntentById(id);
    if (!intent) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy lịch trình cần huỷ' });
    }
    if (!assertIntentOwnership(intent, req)) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền huỷ lịch trình của người khác' });
    }
    if (intent.status === 'cancelled') {
      return res.status(200).json({ success: true, message: 'Lịch trình đã được huỷ trước đó.', data: intent });
    }

    const matchedCount = countMatchedRiders(intent);

    const updated = await updateIntent(id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: String(reason || '').trim() || 'Chủ xe huỷ lịch trình',
      hadMatchedRiders: matchedCount
    });

    return res.status(200).json({
      success: true,
      message:
        matchedCount > 0
          ? `Đã huỷ lịch trình. ${matchedCount} khách đã ghép sẽ được thông báo và điều phối chuyến khác.`
          : 'Đã huỷ lịch trình chờ.',
      data: updated,
      matchedRiders: matchedCount
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/intents/:id/checkpoint - Chủ xe xác nhận một mốc gác cổng
 *
 * Ba mốc "chốt sổ 21h / thức dậy 05:15 / lằn ranh 05:30" trước đây chỉ là useState
 * trong trình duyệt: bấm xong hiện toast "Khách nhận được thông báo an tâm" nhưng
 * không request nào được gửi, và tải lại trang là mất. Endpoint này ghi mốc vào
 * ý định để khách thực sự thấy được Chủ xe đã cam kết.
 */
export async function confirmIntentCheckpointHandler(req, res) {
  try {
    const { id } = req.params;
    const { checkpoint } = req.body || {};

    const VALID = ['NIGHT_LOCK', 'MORNING_WAKE', 'RED_LINE'];
    if (!VALID.includes(checkpoint)) {
      return res.status(400).json({
        success: false,
        error: `Mốc gác cổng không hợp lệ (chỉ nhận: ${VALID.join(', ')}).`
      });
    }

    const intent = getIntentById(id);
    if (!intent) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy lịch trình' });
    }
    if (!assertIntentOwnership(intent, req)) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xác nhận lịch trình của người khác' });
    }
    if (intent.status === 'cancelled') {
      return res.status(409).json({ success: false, error: 'Lịch trình đã huỷ.' });
    }

    const confirmations = { ...(intent.checkpointConfirmations || {}) };
    confirmations[checkpoint] = new Date().toISOString();

    const updated = await updateIntent(id, { checkpointConfirmations: confirmations });

    const LABEL = {
      NIGHT_LOCK: 'chốt sổ 21h',
      MORNING_WAKE: 'thức dậy 05:15',
      RED_LINE: 'sẵn sàng khởi hành'
    };

    return res.status(200).json({
      success: true,
      message: `Đã ghi nhận ${LABEL[checkpoint]}. Người đi cùng nhìn thấy xác nhận này.`,
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
