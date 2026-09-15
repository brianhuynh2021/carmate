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
  runBatchMatchingEpoch
} from '../services/batchMatchingEngine.js';

import { evaluateConnection } from '../services/connectionMatching.js';
import { cancelAppointment } from '../services/bookingCommitment.js';
import { cleanPhoneNumber, isValidVietnamesePhone, maskPhoneNumber, normalizeConnectionTerms, normalizeTravelDate, requestDeadline } from '@carmate/shared';


/**
 * POST /api/intents - Khai báo ý định di chuyển (Chủ xe hoặc Khách)
 */
export async function createMovementIntentHandler(req, res) {
  if (!req.user?.id) return res.status(401).json({ success: false, error: 'Đăng nhập để lưu nhu cầu và nhận phản hồi.' });
  try {
    const body = req.body || {};
    const now = Date.now();
    const role = body.role === 'driver' ? 'driver' : 'passenger';
    const phone = cleanPhoneNumber(body.phone || req.user.phone || '');
    if (!isValidVietnamesePhone(phone)) throw new Error('Cần số điện thoại liên lạc hợp lệ.');
    const originName = String(body.originName || '').trim();
    const destinationName = String(body.destinationName || '').trim();
    if (!originName || !destinationName || (body.originHubId && body.originHubId === body.destinationHubId)) {
      throw new Error('Chọn điểm đi và điểm đến khác nhau.');
    }
    const seats = Number(body.seats ?? 1);
    if (!Number.isInteger(seats) || seats < 1 || seats > 54) throw new Error('Số người phải từ 1 đến 54.');
    const date = normalizeTravelDate(body.date, now);
    if (!date) throw new Error('Ngày đi không hợp lệ.');
    const timeSlot = body.timeSlot || body.departureTime || 'all';
    const expiresAt = requestDeadline({ ...body, date, timeSlot }, now);
    const terms = normalizeConnectionTerms(body);
    const existing = getIntents({ userId: req.user.id, role, status: 'pending' }).find(i =>
      i.userId === req.user.id && i.originHubId === body.originHubId && i.destinationHubId === body.destinationHubId &&
      i.date === date && i.timeSlot === timeSlot && Number(i.seats) === seats && i.pickupMode === terms.pickupMode && i.publicContactConsent === terms.publicContactConsent && Number(i.expiresAt) === expiresAt && i.doorstepAddress === (terms.pickupMode !== 'station' ? String(body.doorstepAddress || '').slice(0,500) : '') && Number(i.expiresAt) > now);
    if (existing) return res.status(200).json({ success: true, data: existing, reused: true });
    const intent = await createIntent({
      userId: req.user.id, role, originHubId: body.originHubId || '', originName,
      destinationHubId: body.destinationHubId || '', destinationName,
      corridor: body.corridor || 'Tuyến QL13', date, timeSlot, seats,
      ...terms,
      isDoorstep: terms.pickupMode === 'doorstep',
      doorstepAddress: terms.pickupMode !== 'station' ? String(body.doorstepAddress || '').slice(0,500) : '',
      doorstepLat: body.doorstepLat ?? null, doorstepLng: body.doorstepLng ?? null,
      phone, contactName: String(body.contactName || req.user.name || 'Khách').slice(0,100),
      originalRequestedAt: now, originalDeadlineAt: expiresAt, expiresAt,
      status: 'pending', needStatus: 'open', publishDemandConsent: true, estimatedPricing: null,
      maxPrice: body.maxPrice == null || body.maxPrice === '' ? null : Math.max(0, Number(body.maxPrice) || 0),
      matchingPreference: ['balanced','earliest','lowest_price'].includes(body.matchingPreference) ? body.matchingPreference : 'balanced'
    });
    await runBatchMatchingEpoch({ date }).catch(err => console.warn('[Matching]', err.message));
    return res.status(201).json({ success: true, data: getIntentById(intent.id) || intent, estimatedPricing: null,
      message: 'Đã lưu nhu cầu. Bạn sẽ thấy phản hồi khi có xe phù hợp; chưa có cuộc hẹn được xác nhận.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
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
    const now = Date.now();
    const scoped = mine ? intents.filter(isOwner) : intents.filter(i => i.status === 'pending' && i.needStatus !== 'closed' && Number(i.expiresAt || i.originalDeadlineAt || 0) > now && i.publishDemandConsent === true);

    // LỚP CHẮN PII (Nghị định 13/2023): sàn công khai chỉ được thấy bí danh và
    // số đã che. Số thật, tên thật chỉ hiện với chính chủ hoặc Quản trị viên.
    const data = scoped.map((intent) => {
      if (isOwner(intent)) return { ...intent, isOwner: true };
      const tail = String(intent.id || '').slice(-3).toUpperCase() || 'XXX';
      const safe = { ...intent };
      safe.phoneMasked = maskPhoneNumber(intent.phone || '');
      safe.publicName = intent.role === 'driver' ? `Chủ xe CX-${tail}` : `Người đi cùng KX-${tail}`;
      safe.publicContactPhone = intent.publicContactConsent === true ? intent.phone : null;
      delete safe.phone;
      delete safe.phoneReal;
      delete safe.contactName;
      delete safe.userId;
      delete safe.matchedBookingId;
      delete safe.doorstepAddress;
      delete safe.doorstepLat;
      delete safe.doorstepLng;
      delete safe.pickupNotes;
      delete safe.contactEmail;
      delete safe.telegramId;
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
      if (!Number.isInteger(seatNum) || seatNum < 1 || seatNum > 54) {
        return res.status(400).json({ success: false, error: 'Số ghế phải từ 1 đến 54.' });
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

    if (['matched','proposed'].includes(intent.status)) return res.status(409).json({ success: false, error: 'Xử lý cuộc hẹn đang mở trước khi đổi nhu cầu.' });
    if (updates.date || updates.timeSlot || req.body?.expiresAt) {
      updates.date = normalizeTravelDate(updates.date || intent.date);
      updates.expiresAt = requestDeadline({ ...intent, ...updates, expiresAt: req.body?.expiresAt });
      updates.originalDeadlineAt = updates.expiresAt;
    }
    updates.updatedAt = new Date().toISOString();
    const updated = await updateIntent(id, updates);

    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật nhu cầu tìm xe.',
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
    for (const booking of getBookings().filter(b => b.requestId === id && b.needStatus !== 'closed' && !['cancelled','completed','expired'].includes(b.status))) {
      cancelAppointment({ bookingId: booking.escrowId || booking.id, user: req.user, reason: String(reason || 'Không đi nữa') });
    }

    const updated = await updateIntent(id, {
      status: 'cancelled',
      needStatus: 'closed',
      cancelledAt: new Date().toISOString(),
      cancellationReason: String(reason || '').trim() || 'Chủ xe huỷ lịch trình',
      hadMatchedRiders: matchedCount
    });

    return res.status(200).json({
      success: true,
      message:
        matchedCount > 0
          ? 'Đã hủy yêu cầu và cập nhật các cuộc hẹn liên quan.'
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

export function previewDriverConnectionsHandler(req, res) {
  try {
    const now = Date.now();
    const draft = req.body || {};
    const trip = { ...draft, id: 'preview-only', status: 'active', userId: req.user?.id || null,
      originHubId: draft.originHubId, destinationHubId: draft.destinationHubId || draft.destHubId,
      availableSeats: Number(draft.availableSeats || draft.seats || 1), bookingSeatCapacity: Number(draft.availableSeats || draft.seats || 1) };
    const data = getIntents({ role: 'passenger', status: 'pending' }).filter(i => i.needStatus !== 'closed' && Number(i.expiresAt || i.originalDeadlineAt) > now && i.publishDemandConsent === true)
      .map(i => ({ intent: i, match: evaluateConnection(trip, i, { nowMs: now, bookings: [] }) }))
      .filter(row => row.match).sort((a,b) => a.match.score-b.match.score)
      .map(({intent,match}) => ({ id: intent.id, originName: intent.originName, destinationName: intent.destinationName, date: intent.date, timeSlot: intent.timeSlot, seats: intent.seats, matchingReason: match.reason }));
    return res.json({ success: true, data, count: data.length, updatedAt: now });
  } catch (err) { return res.status(400).json({ success: false, error: err.message }); }
}
