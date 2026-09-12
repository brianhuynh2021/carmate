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
