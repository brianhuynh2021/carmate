/**
 * =============================================================================
 * CANH CHUYẾN THEO GIỜ KHỞI HÀNH (DEPARTURE WATCHDOG)
 * =============================================================================
 * Bốn chốt radar đêm (21:15 / 23:15 / 03:45 / 04:30) là giờ TREO CỨNG, chỉ đúng
 * cho chuyến khởi hành khoảng 05:30. Chuyến 08:30 hay 14:00 rơi vào khoảng trống
 * hoàn toàn: không có gì canh chúng cả.
 *
 * File này canh theo mốc TƯƠNG ĐỐI so với giờ khởi hành thật của từng chuyến,
 * nên mọi khung giờ đều được bảo vệ như nhau:
 *
 *   T-40  Hỏi chủ xe: "Bạn đã sẵn sàng đón khách chưa?" (một chạm)
 *   T-30  Chưa trả lời -> nhắc lần 2, đồng thời soi tín hiệu GPS
 *   T-20  Vẫn im lặng -> cảnh báo và thông tin phương án cần xác nhận
 *
 * Vì sao chốt cuối đặt ở T-20 chứ không phải T-5: khách phải còn đủ thời gian
 * thực tế để gọi một chuyến xe khách Thành Công (tần suất 30 phút/chuyến) và ra
 * kịp mặt đường. Báo lúc T-5 thì thông tin có cũng như không.
 *
 * NGUYÊN TẮC: chỉ CẢNH BÁO, KHÔNG tự huỷ chuyến. Chủ xe mất sóng giữa rừng cao
 * su Bình Phước vẫn có thể xuất hiện đúng giờ; tự huỷ là cướp mất cơ hội đó của
 * cả hai bên. Khách cầm đủ thông tin và tự quyết định.
 * =============================================================================
 */

import {
  getBookings,
  getBookingById,
  getUserByPhone,
  saveUser,
  updateBookingStatus,
  getTripById
} from '../db/sqliteStore.js';
import { FIXED_CORRIDOR_COACH_SCHEDULES, getTravelWindow } from '@carmate/shared';

export const WATCHDOG_CONFIG = Object.freeze({
  // Các mốc tính bằng phút trước giờ khởi hành
  ASK_READY_MINUTES: 40,
  REMIND_MINUTES: 30,
  RESCUE_MINUTES: 20,
  // Dung sai mỗi mốc: nhịp quét 60s nên ±3 phút là thừa để không bỏ lỡ
  TOLERANCE_MINUTES: 3,
  // Chủ xe im lặng quá mốc này (phút) coi như mất liên lạc
  HEARTBEAT_STALE_MINUTES: 45
});

/** Trạng thái booking còn "sống", cần được canh. */
const ACTIVE_BOOKING_STATUSES = new Set([
  'zalo_active',
  'confirmed',
  'pre_confirmed',
  'driver_confirmed', // chủ xe đã bấm nhận đón — vẫn phải canh tới lúc lăn bánh
  'reassigned'
]);

/**
 * Suy ra mốc khởi hành (epoch ms) của một booking.
 *
 * Dùng lại đúng cách hiểu dữ liệu của bookingController: ngày lấy từ booking
 * hoặc chuyến gốc, giờ dò trong chuỗi timeSlot ("07:00-09:00" -> 07:00).
 * Không có ngày hoặc không dò được giờ thì trả null — thà bỏ qua còn hơn đoán
 * bừa rồi bắn cảnh báo cứu hộ vào mặt khách giữa đêm.
 */
export function resolveDepartureMs(booking, trip = null) {
  if (booking?.committedTerms?.pickupStartAt) {
    const value = Date.parse(booking.committedTerms.pickupStartAt);
    return Number.isFinite(value) ? value : null;
  }
  const date = booking?.date || trip?.date;
  const timeSlot = booking?.timeSlot || trip?.timeSlot || trip?.time;
  if (!date || !timeSlot || !String(timeSlot).match(/\d{1,2}:\d{2}/)) return null;
  return getTravelWindow({ date, timeSlot })?.start ?? null;
}

/** Đang ở đúng cửa sổ quanh một mốc (phút trước giờ chạy) hay không. */
function isAtMark(minutesUntilDeparture, markMinutes) {
  return Math.abs(minutesUntilDeparture - markMinutes) <= WATCHDOG_CONFIG.TOLERANCE_MINUTES;
}

/**
 * QUÉT TOÀN BỘ CHUYẾN SẮP KHỞI HÀNH.
 *
 * Hàm THUẦN đánh giá: chỉ đọc dữ liệu và trả về danh sách việc cần làm, không
 * tự gửi thông báo. Tách vậy để kiểm thử được toàn bộ logic mốc giờ mà không
 * cần mạng, và để scheduler giữ trọn quyền quyết định gửi gì.
 *
 * @param {object} params
 * @param {number} [params.nowMs] - Mốc hiện tại
 * @param {Array} [params.activeSessions] - Phiên cockpit đang chạy (để soi GPS)
 * @returns {Array} [{ action, booking, departureMs, minutesUntil, driverPhone, ... }]
 */
export function evaluateDepartureCheckpoints({ nowMs = Date.now(), activeSessions = [] } = {}) {
  const actions = [];
  const bookings = getBookings().filter((b) => ACTIVE_BOOKING_STATUSES.has(b.status) && b.bothConfirmed === true && b.needStatus !== 'closed');
  if (bookings.length === 0) return actions;

  for (const booking of bookings) {
    const trip = booking.tripId ? getTripById(booking.tripId) : null;
    const departureMs = resolveDepartureMs(booking, trip);
    if (departureMs == null) continue;

    const minutesUntil = (departureMs - nowMs) / 60000;
    // Chỉ quan tâm cửa sổ từ T-45 tới giờ chạy. Ngoài khoảng này thì hoặc còn
    // quá sớm (đã có 4 chốt đêm lo), hoặc xe đã lăn bánh rồi.
    if (minutesUntil > 45 || minutesUntil < -2) continue;

    const driverPhone = booking.driverPhone || booking.phoneReal;
    if (!driverPhone) continue;

    const session = activeSessions.find((s) => s.tripId === booking.tripId && s.driverPhone === driverPhone);
    const heartbeatMinutesAgo = session?.lastPing
      ? (nowMs - session.lastPing) / 60000
      : Infinity;

    // Chủ xe được coi là "đã sẵn sàng" khi bấm nút xác nhận, HOẶC khi xe đang
    // thực sự lăn bánh và gửi tín hiệu đều — hành động thật đáng tin hơn nút bấm.
      const hasConfirmed =
      booking.driverConfirmed === true ||
      booking.readyConfirmedAt != null ||
      booking.status === 'driver_confirmed';

    const base = {
      booking,
      trip,
      departureMs,
      minutesUntil: Math.round(minutesUntil),
      driverPhone,
      passengerPhone: booking.passengerPhone,
      session: session || null,
      heartbeatMinutesAgo: Number.isFinite(heartbeatMinutesAgo) ? Math.round(heartbeatMinutesAgo) : null,
      hasConfirmed
    };

    // ── T-40: hỏi chủ xe đã sẵn sàng chưa ──
    if (isAtMark(minutesUntil, WATCHDOG_CONFIG.ASK_READY_MINUTES)) {
      if (!hasConfirmed && !booking.readyAskedAt) {
        actions.push({ ...base, action: 'ASK_READY' });
      }
      continue;
    }

    // ── T-30: nhắc lần 2 ──
    if (isAtMark(minutesUntil, WATCHDOG_CONFIG.REMIND_MINUTES)) {
      if (!hasConfirmed && !booking.readyRemindedAt) {
        actions.push({ ...base, action: 'REMIND_READY' });
      }
      continue;
    }

    // ── T-20: bật chế độ cứu hộ ──
    if (isAtMark(minutesUntil, WATCHDOG_CONFIG.RESCUE_MINUTES)) {
      if (hasConfirmed || booking.rescueActivatedAt) continue;

      actions.push({
        ...base,
        action: 'ACTIVATE_RESCUE',
        // Lý do cụ thể để hiển thị đúng sự thật cho khách, không nói chung chung
        reason:
          heartbeatMinutesAgo === Infinity
            ? 'NO_GPS_SIGNAL'
            : heartbeatMinutesAgo > WATCHDOG_CONFIG.HEARTBEAT_STALE_MINUTES
              ? 'STALE_HEARTBEAT'
              : 'NO_CONFIRMATION',
        lifebuoys: pickRelevantLifebuoys(booking, trip)
      });
    }
  }

  return actions;
}

/**
 * Chọn danh sách xe khách cứu hộ phù hợp nhất với chuyến của khách.
 *
 * Sắp xếp theo độ gần về giờ: một chuyến 04:45 không giúp được gì cho người cần
 * đi lúc 14:00. Luôn trả về ít nhất một phương án — danh sách rỗng đúng vào lúc
 * khách hoảng nhất là kịch bản tệ nhất có thể xảy ra.
 */
export function pickRelevantLifebuoys(booking, trip = null, limit = 3) {
  const departureMs = resolveDepartureMs(booking, trip);
  const all = FIXED_CORRIDOR_COACH_SCHEDULES.map((bus) => ({ ...bus, availability: 'unconfirmed', requiresOperatorConfirmation: true }));

  if (departureMs == null) return all.slice(0, limit);

  const depDate = new Date(departureMs);
  const depMinutes = depDate.getHours() * 60 + depDate.getMinutes();

  const withDistance = all.map((bus) => {
    const m = String(bus.pickupTime || '').match(/(\d{1,2}):(\d{2})/);
    if (!m) return { bus, distance: 9999 };
    const busMinutes = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const raw = Math.abs(busMinutes - depMinutes);
    return { bus, distance: Math.min(raw, 1440 - raw) };
  });

  withDistance.sort((a, b) => a.distance - b.distance);
  return withDistance.slice(0, limit).map((x) => x.bus);
}

/** Ghi mốc đã hỏi chủ xe sẵn sàng (chống hỏi lại nhiều lần). */
export async function markReadyAsked(bookingId, nowMs = Date.now()) {
  return updateBookingStatus(bookingId, getBookingStatusSafe(bookingId), {
    readyAskedAt: new Date(nowMs).toISOString()
  });
}

/** Ghi mốc đã nhắc lần 2. */
export async function markReadyReminded(bookingId, nowMs = Date.now()) {
  return updateBookingStatus(bookingId, getBookingStatusSafe(bookingId), {
    readyRemindedAt: new Date(nowMs).toISOString()
  });
}

/**
 * Giữ nguyên status hiện tại khi chỉ muốn ghi thêm trường phụ.
 * updateBookingStatus bắt buộc truyền status, mà các mốc canh chuyến tuyệt đối
 * không được phép làm đổi trạng thái nghiệp vụ của booking.
 */
function getBookingStatusSafe(bookingId) {
  return getBookingById(bookingId)?.status || 'zalo_active';
}

/**
 * BẬT CHẾ ĐỘ CỨU HỘ cho một chuyến.
 *
 * Chuyến KHÔNG bị huỷ: chỉ gắn cờ `rescueMode` để giao diện khách đổi sang màn
 * hình cứu hộ. Chủ xe tới muộn vẫn đón được nếu khách chưa đi xe khác.
 *
 * Đồng thời trừ điểm tín nhiệm chủ xe qua đúng thang `penalty_late` có sẵn:
 * tăng bộ đếm lateReports, để computeTrustScore tự áp -10 điểm. Không tự chế
 * quy tắc phạt mới, không tự khoá tài khoản.
 */
export async function activateRescueMode({ bookingId, reason, lifebuoys, nowMs = Date.now() }) {
  const booking = getBookingById(bookingId);
  if (!booking) return { success: false, error: 'Không tìm thấy chuyến đi' };
  if (booking.rescueActivatedAt) {
    return { success: true, alreadyActive: true, booking };
  }

  const updated = await updateBookingStatus(bookingId, booking.status, {
    rescueMode: true,
    rescueActivatedAt: new Date(nowMs).toISOString(),
    rescueReason: reason,
    rescueLifebuoys: lifebuoys,
    // Chuyến vẫn sống: chủ xe xuất hiện muộn vẫn đón được
    isCancelled: false
  });

  // Missing readiness/GPS is a risk signal, not evidence of misconduct.
  return { success: true, booking: updated, penalty: null };

}

/**
 * Tăng bộ đếm trễ hẹn của chủ xe.
 *
 * Điểm tín nhiệm không lưu cứng mà được computeTrustScore tính lại từ các bộ
 * đếm này, nên chỉ cần tăng `lateReports` là toàn hệ thống tự phản ánh đúng.
 */
export async function applyLatePenalty(driverPhone, bookingId, nowMs = Date.now()) {
  const user = getUserByPhone(String(driverPhone).replace(/\D/g, ''));
  if (!user) return null;

  const history = Array.isArray(user.rescueIncidents) ? user.rescueIncidents : [];
  // Cùng một booking chỉ bị tính một lần, dù nhịp quét có chạy lại
  if (history.some((h) => h.bookingId === bookingId)) {
    return { skipped: true, reason: 'already_penalized' };
  }

  const lateReports = Number(user.lateReports || 0) + 1;
  await saveUser({
    ...user,
    lateReports,
    rescueIncidents: [
      ...history,
      { bookingId, at: new Date(nowMs).toISOString(), rule: 'penalty_late' }
    ]
  });

  return { applied: true, rule: 'penalty_late', points: -10, lateReports };
}
