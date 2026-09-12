/**
 * notificationController.js
 * Đăng ký nhận thông báo đẩy, đọc hộp thư in-app, và bắt tay "Tôi đang ra trạm".
 */

import {
  savePushSubscription,
  removePushSubscription,
  getNotifications,
  markNotificationsRead,
  getVapidPublicKey
} from '../services/notificationService.js';
import { riderConfirmOnTheWay } from '../services/stationQueueService.js';
import { buildTimeSlotMatrix } from '../services/timeSlotMatrix.js';
import { getBookingById, updateBookingStatus } from '../db/sqliteStore.js';
import { getSchedulerStatus, runTickNow } from '../services/scheduler.js';

/**
 * Số điện thoại của CHÍNH người gọi, chỉ lấy từ token đã xác thực.
 *
 * Tuyệt đối không nhận số điện thoại từ body/query: hộp thư chứa biển số xe, tên
 * chủ xe, giờ và điểm đón: cho phép truyền số tuỳ ý đồng nghĩa bất kỳ ai cũng đọc
 * được lịch trình của người khác chỉ bằng cách đoán số điện thoại (IDOR).
 */
function resolvePhone(req) {
  return String(req.user?.phone || '').replace(/\D/g, '');
}

/** Phản hồi 401 thống nhất khi chưa đăng nhập. */
function unauthorized(res) {
  return res.status(401).json({
    success: false,
    error: 'Vui lòng đăng nhập để xem thông báo của bạn'
  });
}

/** GET /api/notifications/vapid-key — khoá công khai cho trình duyệt đăng ký. */
export function getVapidKeyHandler(req, res) {
  const key = getVapidPublicKey();
  return res.json({
    success: true,
    publicKey: key,
    enabled: Boolean(key)
  });
}

/** POST /api/notifications/subscribe */
export function subscribePushHandler(req, res) {
  try {
    const phone = resolvePhone(req);
    if (!phone) return unauthorized(res);

    const result = savePushSubscription({
      phone,
      userId: req.user?.id || null,
      subscription: req.body?.subscription,
      userAgent: req.headers['user-agent'] || ''
    });

    if (!result.success) return res.status(400).json(result);
    return res.json({ success: true, message: 'Đã bật thông báo cho thiết bị này.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** POST /api/notifications/unsubscribe */
export function unsubscribePushHandler(req, res) {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ success: false, error: 'Thiếu endpoint' });
    return res.json(removePushSubscription(endpoint));
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** GET /api/notifications */
export function listNotificationsHandler(req, res) {
  try {
    const phone = resolvePhone(req);
    if (!phone) return unauthorized(res);

    const items = getNotifications({
      phone,
      limit: Number(req.query.limit) || 30,
      unreadOnly: req.query.unreadOnly === 'true'
    });

    return res.json({
      success: true,
      data: items,
      unreadCount: items.filter((i) => !i.isRead).length
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** POST /api/notifications/read */
export function markReadHandler(req, res) {
  try {
    const phone = resolvePhone(req);
    if (!phone) return unauthorized(res);

    // `phone` luôn được truyền kèm: tầng service chỉ đánh dấu đã đọc khi thông báo
    // đó thuộc về chính số này, nên không ai đánh dấu hộ thư của người khác được.
    return res.json(markNotificationsRead({ phone, notificationId: req.body?.notificationId || null }));
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/station/rider/on-the-way
 * BẮT TAY T-30: khách bấm "Tôi đang ra trạm".
 */
export function riderOnTheWayHandler(req, res) {
  try {
    const { intentId, lat = null, lng = null } = req.body || {};
    if (!intentId) return res.status(400).json({ success: false, error: 'Thiếu mã yêu cầu (intentId)' });

    const result = riderConfirmOnTheWay({
      intentId,
      clientLat: lat != null ? Number(lat) : null,
      clientLng: lng != null ? Number(lng) : null
    });

    return res.status(result.success ? 200 : 404).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** GET /api/admin/scheduler-status */
export function schedulerStatusHandler(req, res) {
  return res.json({ success: true, scheduler: getSchedulerStatus() });
}

/** POST /api/admin/scheduler-run — chạy tay một nhịp quét. */
export async function schedulerRunTickHandler(req, res) {
  try {
    const name = req.body?.tick || req.query?.tick;
    const result = await runTickNow(name);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/corridor/time-slots
 * MA TRẬN KHE THỜI GIAN — kết quả 3 tầng trả về ngay, không bao giờ để màn hình trống.
 */
export function timeSlotMatrixHandler(req, res) {
  try {
    const { from, to, timeSlot = null, seats = 1, corridor } = req.query || {};
    if (!from || !to) {
      return res.status(400).json({ success: false, error: 'Thiếu trạm đón (from) hoặc trạm trả (to)' });
    }

    const matrix = buildTimeSlotMatrix({
      originHubId: from,
      destinationHubId: to,
      timeSlot,
      seatsNeeded: Number(seats) || 1,
      corridor: corridor || 'Tuyến QL13'
    });

    return res.status(matrix.success ? 200 : 400).json(matrix);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/driver-ready
 * CHỦ XE BẤM "TÔI ĐANG ĐI / ĐÃ SẴN SÀNG" tại chốt T-40 hoặc T-30.
 *
 * Khác với driver-confirm (chốt lịch từ hôm trước qua Magic Link Zalo), nút này
 * là tín hiệu sống ngay trước giờ chạy — thứ quyết định có phải bật Chế độ Cứu
 * hộ hay không. Bấm được thì chuyến đi tiếp bình thường.
 */
export async function driverReadyHandler(req, res) {
  try {
    const { id } = req.params;
    const booking = getBookingById(id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    // Chỉ chính chủ xe của chuyến mới được xác nhận hộ mình (chống IDOR)
    const callerPhone = String(req.user?.phone || '').replace(/\D/g, '');
    const driverPhone = String(booking.driverPhone || booking.phoneReal || '').replace(/\D/g, '');
    if (!callerPhone || callerPhone !== driverPhone) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không phải chủ xe của chuyến đi này'
      });
    }

    const nowIso = new Date().toISOString();
    const updated = await updateBookingStatus(id, booking.status, {
      readyConfirmedAt: nowIso,
      driverConfirmed: true,
      driverConfirmedAt: booking.driverConfirmedAt || nowIso,
      // Chủ xe xuất hiện kịp thì gỡ cờ cứu hộ, khách thấy lại màn hình bình thường
      rescueMode: false,
      rescueClearedAt: booking.rescueMode ? nowIso : booking.rescueClearedAt || null
    });

    return res.json({
      success: true,
      message: 'Đã ghi nhận. Khách sẽ được thông báo là bạn đang trên đường.',
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/bookings/:id/rescue-status
 * Khách hỏi: chuyến của tôi có đang ở Chế độ Cứu hộ không, và gọi số nào?
 */
export function rescueStatusHandler(req, res) {
  try {
    const booking = getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    const callerPhone = String(req.user?.phone || '').replace(/\D/g, '');
    const parties = [booking.passengerPhone, booking.driverPhone, booking.phoneReal]
      .map((p) => String(p || '').replace(/\D/g, ''))
      .filter(Boolean);
    if (!callerPhone || !parties.includes(callerPhone)) {
      return res.status(403).json({ success: false, error: 'Bạn không thuộc chuyến đi này' });
    }

    return res.json({
      success: true,
      rescueMode: booking.rescueMode === true,
      rescueActivatedAt: booking.rescueActivatedAt || null,
      reason: booking.rescueReason || null,
      lifebuoys: booking.rescueLifebuoys || [],
      driverConfirmed: booking.driverConfirmed === true,
      readyConfirmedAt: booking.readyConfirmedAt || null
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
