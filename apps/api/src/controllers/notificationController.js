/**
 * notificationController.js
 * Register for push notifications, read the in-app inbox, and the "Tôi đang ra trạm" ("I'm heading to the station") handshake.
 */

import {
  savePushSubscription,
  removePushSubscription,
  getNotifications,
  markNotificationsRead,
  getVapidPublicKey
} from '../services/notificationService.js';
import { riderConfirmOnTheWay } from '../services/stationQueueService.js';
import { buildTimeSlotMatrix, buildCorridorTimeline } from '../services/timeSlotMatrix.js';
import { getBookingById, updateBookingStatus } from '../db/sqliteStore.js';
import { getSchedulerStatus, runTickNow } from '../services/scheduler.js';

/**
 * The phone number of the caller THEMSELVES, taken only from the authenticated token.
 *
 * Never accept a phone number from body/query: the inbox contains license plates, driver
 * names, times and pickup points: allowing an arbitrary number means anyone can read
 * another person's itinerary just by guessing their phone number (IDOR).
 */
function resolvePhone(req) {
  return String(req.user?.phone || '').replace(/\D/g, '');
}

/** Unified 401 response when not logged in. */
function unauthorized(res) {
  return res.status(401).json({
    success: false,
    error: 'Vui lòng đăng nhập để xem thông báo của bạn'
  });
}

/** GET /api/notifications/vapid-key — public key for the browser to register with. */
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

    // `phone` is always passed along: the service layer only marks a notification as read when
    // it belongs to this very number, so nobody can mark another person's inbox as read.
    return res.json(markNotificationsRead({ phone, notificationId: req.body?.notificationId || null }));
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/station/rider/on-the-way
 * T-30 HANDSHAKE: the passenger taps "Tôi đang ra trạm" ("I'm heading to the station").
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

/** POST /api/admin/scheduler-run — manually run one sweep. */
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
 * TIME-SLOT MATRIX — a 3-tier result returned immediately, the screen is never left empty.
 */
export function timeSlotMatrixHandler(req, res) {
  try {
    const { from, to, date = null, timeSlot = null, seats = 1, corridor, matchingPreference = 'balanced' } = req.query || {};
    if (!from || !to) {
      return res.status(400).json({ success: false, error: 'Thiếu trạm đón (from) hoặc trạm trả (to)' });
    }

    const matrix = buildTimeSlotMatrix({
      originHubId: from,
      destinationHubId: to,
      timeSlot,
      date,
      matchingPreference,
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
 * DRIVER TAPS "TÔI ĐANG ĐI / ĐÃ SẴN SÀNG" ("I'm on my way / ready") at the T-40 or T-30 checkpoint.
 *
 * Unlike driver-confirm (locking the schedule the day before via the Zalo Magic Link), this button
 * is a live signal right before departure — the thing that decides whether Rescue
 * Mode must be turned on. Once tapped, the trip proceeds as normal.
 */
export async function driverReadyHandler(req, res) {
  try {
    const { id } = req.params;
    const booking = getBookingById(id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    // Only the trip's own driver may confirm for themselves (anti-IDOR)
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
      // If the driver shows up in time, clear the rescue flag; the passenger sees the normal screen again
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
 * The passenger asks: is my trip in Rescue Mode, and which number should I call?
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

/**
 * GET /api/corridor/timeline
 * FULL-ROUTE SCHEDULE — every trip of the day, grouped by time of day.
 */
export function corridorTimelineHandler(req, res) {
  try {
    const { from, to, seats = 1, corridor } = req.query || {};
    if (!from || !to) {
      return res.status(400).json({ success: false, error: 'Thiếu trạm đón (from) hoặc trạm trả (to)' });
    }
    const result = buildCorridorTimeline({
      originHubId: from,
      destinationHubId: to,
      seatsNeeded: Number(seats) || 1,
      corridor: corridor || 'Tuyến QL13'
    });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
