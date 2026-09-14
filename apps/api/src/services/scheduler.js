/**
 * =============================================================================
 * CARMATE SCHEDULER — NHỊP TIM CỦA HỆ THỐNG
 * =============================================================================
 * Trước khi có file này, toàn bộ thuật toán điều vận chỉ chạy khi có người mở
 * app và gọi API. Nghĩa là chuyến Shadow, radar rủi ro và micro-batch đều là mã
 * chết trong đúng khoảng thời gian chúng cần thiết nhất: đêm hôm trước và rạng
 * sáng, lúc khách đang ngủ và không ai gửi request nào.
 *
 * Đây là "recourse trigger" trong mô hình Stochastic VRP with Recourse: hành
 * động khắc phục chỉ có giá trị nếu có thứ gì đó đánh thức nó.
 *
 * Tám nhịp quét, mỗi nhịp một chu kỳ riêng theo tính cấp bách:
 *
 *   T30_TICK      60s   Hội tụ không-thời gian, bắn báo trước 30 phút
 *   HANDSHAKE     60s   Nhắc lần 2 / thu hồi chỗ khi khách im lặng
 *   DEPARTURE     60s   Canh T-40/T-30/T-20 theo giờ khởi hành THẬT của chuyến
 *   LATENESS      90s   Radar trễ hẹn -> hoán đổi chuyến Shadow
 *   MICRO_BATCH  180s   Phiên gom khớp lệnh (đúng cửa sổ 3 phút đã khai báo)
 *   RADAR_SWEEP  300s   4 chốt đêm T-8h/T-6h/T-1.5h/T-45m
 *   TRIP_LIFECYCLE 15m  Đóng sổ chuyến đã chạy xong, đẩy chuyến định kỳ sang tuần sau
 *   HOUSEKEEPING  1h    Dọn nhật ký thông báo cũ
 *
 * NGUYÊN TẮC AN TOÀN: mỗi nhịp được bọc try/catch riêng và dùng khoá chống
 * chồng lấn. Một nhịp lỗi hoặc chạy lâu không bao giờ được phép giết cả
 * scheduler hoặc làm hai bản sao cùng chạy đè lên nhau.
 * =============================================================================
 */

import {
  evaluateT30Triggers,
  markT30Notified,
  sweepHandshakeDeadlines,
  evaluateLatenessRisk,
  findShadowCandidate,
  applyShadowSwap,
  getActiveCockpitSessions
} from './stationQueueService.js';
import { runBatchMatchingEpoch } from './batchMatchingEngine.js';
import {
  evaluateDepartureCheckpoints,
  activateRescueMode,
  markReadyAsked,
  markReadyReminded
} from './departureWatchdog.js';
import {
  sendNotification,
  NOTIFICATION_KINDS,
  pruneOldNotifications
} from './notificationService.js';
import { evaluateRadarSweepCheckpoint, RADAR_CHECKPOINTS } from '@carmate/shared';
import { getBookings, getUserByPhone, sweepFinishedTrips } from '../db/sqliteStore.js';

export const SCHEDULER_INTERVALS = Object.freeze({
  T30_TICK_MS: 60 * 1000,
  HANDSHAKE_MS: 60 * 1000,
  LATENESS_MS: 90 * 1000,
  DEPARTURE_MS: 60 * 1000,
  MICRO_BATCH_MS: 3 * 60 * 1000,
  RADAR_SWEEP_MS: 5 * 60 * 1000,
  TRIP_LIFECYCLE_MS: 15 * 60 * 1000,
  HOUSEKEEPING_MS: 60 * 60 * 1000
});

const timers = [];
const running = new Set(); // khoá chống chồng lấn theo tên nhịp
let started = false;

/** Số liệu vận hành, phục vụ /api/admin/scheduler-status. */
const stats = {
  startedAt: null,
  ticks: {},
  lastError: null,
  actions: {
    t30Sent: 0,
    remindersSent: 0,
    seatsReleased: 0,
    shadowSwaps: 0,
    batchEpochs: 0,
    radarAlerts: 0,
    readyAsks: 0,
    rescueActivations: 0,
    tripsClosed: 0,
    tripsRolled: 0
  }
};

/**
 * Bọc một nhịp quét: chống chồng lấn, đếm lượt, nuốt lỗi.
 * Nuốt lỗi là cố ý — scheduler phải sống sót qua mọi sự cố nghiệp vụ.
 */
async function guard(name, fn) {
  if (running.has(name)) {
    // Nhịp trước còn chưa xong: bỏ qua lượt này thay vì xếp chồng
    return;
  }
  running.add(name);
  const t0 = Date.now();
  try {
    await fn();
    stats.ticks[name] = {
      lastRunAt: t0,
      durationMs: Date.now() - t0,
      count: (stats.ticks[name]?.count || 0) + 1,
      ok: true
    };
  } catch (err) {
    stats.lastError = { name, message: err?.message, at: Date.now() };
    stats.ticks[name] = {
      lastRunAt: t0,
      durationMs: Date.now() - t0,
      count: (stats.ticks[name]?.count || 0) + 1,
      ok: false,
      error: err?.message
    };
    console.error(`[Scheduler:${name}] Lỗi (đã cách ly, scheduler vẫn chạy):`, err?.message);
  } finally {
    running.delete(name);
  }
}

/** Định dạng mốc giờ theo múi giờ Việt Nam cho nội dung thông báo. */
function formatClock(ms) {
  try {
    return new Date(ms).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh'
    });
  } catch {
    return '';
  }
}

/**
 * NHỊP 1 — CHỐT T-30: HỘI TỤ KHÔNG - THỜI GIAN
 *
 * Bắn thông báo cho khách khi P(25 <= T_arrive <= 35 phút) >= 0.90, đồng thời
 * mở cửa sổ 10 phút để khách bấm "Tôi đang ra trạm".
 */
async function tickT30() {
  const triggers = evaluateT30Triggers(Date.now());
  if (triggers.length === 0) return;

  for (const trig of triggers) {
    const { rider, session, safeEtaMs, etaMs, probability } = trig;
    const arriveLabel = formatClock(safeEtaMs || etaMs);

    const result = await sendNotification({
      phone: rider.phone,
      kind: NOTIFICATION_KINDS.T30_APPROACH,
      title: `Xe sắp tới ${rider.hubShortName || rider.hubName}`,
      body: `Xe ${session.plate} còn khoảng 30 phút nữa tới trạm. Vui lòng ra trạm trước ${arriveLabel} và bấm xác nhận trong ứng dụng.`,
      data: {
        intentId: rider.intentId,
        hubId: trig.hubId,
        tripId: session.tripId,
        plate: session.plate,
        vehicleModel: session.vehicleModel,
        etaMs: safeEtaMs || etaMs,
        timeLabel: arriveLabel,
        confidence: probability,
        requiresHandshake: true
      },
      // Một khách chỉ nhận đúng một báo T-30 cho mỗi chuyến xe
      dedupeKey: `T30:${rider.intentId}:${session.tripId}:${trig.attempt}`
    });

    if (result.success && !result.deduped) {
      markT30Notified(rider.intentId, {
        etaMs,
        safeEtaMs,
        tripId: session.tripId
      });
      stats.actions.t30Sent += 1;

      // Báo cho chủ xe biết có khách đang được huy động ra trạm
      await sendNotification({
        phone: session.driverPhone,
        kind: NOTIFICATION_KINDS.RIDER_READY,
        title: 'Khách đang được báo ra trạm',
        body: `${rider.name} (${rider.seatsNeeded} chỗ) tại ${rider.hubShortName || rider.hubName}. Dự kiến đón lúc ${arriveLabel}.`,
        data: { intentId: rider.intentId, hubId: trig.hubId, tripId: session.tripId },
        dedupeKey: `T30DRV:${rider.intentId}:${session.tripId}:${trig.attempt}`
      });
    }
  }
}

/**
 * NHỊP 2 — BẮT TAY: NHẮC LẦN 2 VÀ THU HỒI CHỖ
 *
 * Khách không phản hồi sau 10 phút thì chỗ được trả lại cho người khác đón dọc
 * đường. Khách vẫn ở trong hàng đợi, chỉ mất quyền ưu tiên với chiếc xe này.
 */
async function tickHandshake() {
  const { needReminder, expired } = sweepHandshakeDeadlines(Date.now());

  for (const { rider, hubId } of needReminder) {
    const r = await sendNotification({
      phone: rider.phone,
      kind: NOTIFICATION_KINDS.CHECKIN_REMINDER,
      title: 'Bạn đã ra trạm chưa?',
      body: `Xe sắp tới ${rider.hubShortName || rider.hubName}. Bấm "Tôi đang ra trạm" để giữ chỗ, nếu không chỗ sẽ được nhường cho khách khác.`,
      data: { intentId: rider.intentId, hubId, requiresHandshake: true },
      dedupeKey: `REMIND:${rider.intentId}:${rider.t30NotifiedAt}`
    });
    if (r.success && !r.deduped) stats.actions.remindersSent += 1;
  }

  for (const { rider, hubId } of expired) {
    const r = await sendNotification({
      phone: rider.phone,
      kind: NOTIFICATION_KINDS.SEAT_RELEASED,
      title: 'Chỗ đã được nhường lại',
      body: `Do không nhận được xác nhận, chỗ của bạn tại ${rider.hubShortName || rider.hubName} đã được nhường. Bạn vẫn trong hàng đợi và sẽ được ghép với chuyến kế tiếp.`,
      data: { intentId: rider.intentId, hubId },
      dedupeKey: `RELEASE:${rider.intentId}:${rider.seatReleasedAt}`
    });
    if (r.success && !r.deduped) stats.actions.seatsReleased += 1;
  }
}

/**
 * NHỊP 3 — RADAR TRỄ HẸN & HOÁN ĐỔI CHUYẾN SHADOW
 *
 * Đây là Recourse Action của mô hình. Hệ thống KHÔNG đợi xe trễ thật: ngay khi
 * xác suất trễ vượt ngưỡng, nó quét hành lang tìm một xe khác kịp mốc đã cam
 * kết và hoán đổi. Mốc giờ hứa với khách giữ nguyên.
 */
async function tickLateness() {
  const atRisk = evaluateLatenessRisk(Date.now());
  if (atRisk.length === 0) return;

  for (const item of atRisk) {
    const { rider, hubId, session, lateness, committedAt } = item;

    const candidate = findShadowCandidate({
      hubId,
      seatsNeeded: rider.seatsNeeded,
      committedAtMs: committedAt,
      excludeTripId: session.tripId
    });

    if (!candidate) {
      // Không có xe hỗ trợ: báo sớm cho khách còn kịp chủ động,
      // thà biết trước 20 phút còn hơn đứng đợi trong vô vọng.
      await sendNotification({
        phone: rider.phone,
        kind: NOTIFICATION_KINDS.TRIP_AT_RISK,
        title: 'Xe có thể tới trễ',
        body: `Xe ${session.plate} đang gặp chậm trễ trên đường (dự kiến trễ ~${Math.round(lateness.expectedDelaySeconds / 60)} phút). Hệ thống đang tìm xe hỗ trợ cho bạn.`,
        data: { intentId: rider.intentId, hubId, tripId: session.tripId, delayMinutes: Math.round(lateness.expectedDelaySeconds / 60) },
        dedupeKey: `ATRISK:${rider.intentId}:${Math.floor(Date.now() / (10 * 60 * 1000))}`
      });
      stats.actions.radarAlerts += 1;
      continue;
    }

    const swap = applyShadowSwap({
      intentId: rider.intentId,
      newTripId: candidate.session.tripId,
      newEtaMs: candidate.distribution.etaMs
    });

    if (!swap.success) continue;
    stats.actions.shadowSwaps += 1;

    const newEtaLabel = formatClock(candidate.distribution.etaMs);

    // Khách chỉ thấy MỘT sự thật: xe mới, giờ cũ. Không kể lể về sự cố.
    await sendNotification({
      phone: rider.phone,
      kind: NOTIFICATION_KINDS.SHADOW_SWAP,
      title: 'Đã chuyển sang xe hỗ trợ',
      body: `Xe ${candidate.session.plate} (${candidate.session.vehicleModel}) sẽ đón bạn tại ${rider.hubShortName || rider.hubName} lúc ${newEtaLabel}, đúng giờ đã hẹn.`,
      data: {
        intentId: rider.intentId,
        hubId,
        newTripId: candidate.session.tripId,
        plate: candidate.session.plate,
        vehicleModel: candidate.session.vehicleModel,
        driverName: candidate.session.driverName,
        etaMs: candidate.distribution.etaMs,
        timeLabel: newEtaLabel
      },
      dedupeKey: `SWAP:${rider.intentId}:${candidate.session.tripId}`
    });

    // Xe hỗ trợ nhận lệnh đón
    await sendNotification({
      phone: candidate.session.driverPhone,
      kind: NOTIFICATION_KINDS.RIDER_READY,
      title: 'Có khách cần đón tại trạm',
      body: `${rider.name} (${rider.seatsNeeded} chỗ) tại ${rider.hubShortName || rider.hubName}, dự kiến ${newEtaLabel}.`,
      data: { intentId: rider.intentId, hubId, tripId: candidate.session.tripId },
      dedupeKey: `SWAPDRV:${rider.intentId}:${candidate.session.tripId}`
    });

    // Xe chính được giải phóng khỏi cam kết, cứ việc chạy thẳng
    await sendNotification({
      phone: session.driverPhone,
      kind: NOTIFICATION_KINDS.SHADOW_SWAP,
      title: 'Đã bàn giao khách cho xe hỗ trợ',
      body: `Do tình hình giao thông, khách tại ${rider.hubShortName || rider.hubName} đã được chuyển sang xe khác. Bạn không cần dừng đón, điểm tín nhiệm không bị ảnh hưởng.`,
      data: { intentId: rider.intentId, hubId, tripId: session.tripId, released: true },
      dedupeKey: `SWAPREL:${rider.intentId}:${session.tripId}`
    });
  }
}

/**
 * NHỊP — CANH CHUYẾN THEO GIỜ KHỞI HÀNH (T-40 / T-30 / T-20)
 *
 * Bốn chốt đêm là giờ treo cứng, chỉ phủ được chuyến sáng sớm. Nhịp này bám mốc
 * tương đối so với giờ chạy thật nên mọi khung giờ đều được canh như nhau.
 *
 * Điểm quyết định là T-20: nếu chủ xe vẫn im lặng, khách được đẩy thẳng Chế độ
 * Cứu hộ kèm hotline xe khách QL13 — lúc đó họ vẫn còn 20 phút để gọi xe Thành
 * Công và ra kịp mặt đường, thay vì ra trạm đứng đợi rồi mới biết mình bị bỏ rơi.
 */
async function tickDeparture() {
  const sessions = getActiveCockpitSessions();
  const actions = evaluateDepartureCheckpoints({ nowMs: Date.now(), activeSessions: sessions });
  if (actions.length === 0) return;

  for (const item of actions) {
    const { booking, action, driverPhone, passengerPhone, departureMs } = item;
    const depLabel = formatClock(departureMs);

    if (action === 'ASK_READY' || action === 'REMIND_READY') {
      const isRemind = action === 'REMIND_READY';
      const res = await sendNotification({
        phone: driverPhone,
        kind: NOTIFICATION_KINDS.DRIVER_CONFIRM_REQUEST,
        title: isRemind ? `Nhắc lại: chuyến ${depLabel} sắp khởi hành` : `Chuyến ${depLabel} — bạn đã sẵn sàng?`,
        body: isRemind
          ? `Còn ${item.minutesUntil} phút nữa tới giờ đón. Bấm xác nhận để khách yên tâm ra trạm.`
          : `Chuyến đi lúc ${depLabel}. Bạn đã sẵn sàng di chuyển đón khách chưa?`,
        data: {
          bookingId: booking.escrowId,
          departureMs,
          minutesUntil: item.minutesUntil,
          requiresDriverReady: true
        },
        dedupeKey: `${isRemind ? 'READY2' : 'READY1'}:${booking.escrowId}`
      });

      if (res.success && !res.deduped) {
        stats.actions.readyAsks += 1;
        if (isRemind) await markReadyReminded(booking.escrowId);
        else await markReadyAsked(booking.escrowId);
      }
      continue;
    }

    if (action === 'ACTIVATE_RESCUE') {
      const result = await activateRescueMode({
        bookingId: booking.escrowId,
        reason: item.reason,
        lifebuoys: item.lifebuoys
      });
      if (!result.success || result.alreadyActive) continue;
      stats.actions.rescueActivations += 1;

      // Khách: nói thẳng sự thật kèm phương án cụ thể, không hứa hão
      const busLine = (item.lifebuoys || [])
        .slice(0, 2)
        .map((b) => `${b.operator} (${b.hotline})`)
        .join(' · ');

      await sendNotification({
        phone: passengerPhone,
        kind: NOTIFICATION_KINDS.TRIP_AT_RISK,
        title: 'Chuyến đi có thể bị gián đoạn',
        body: `Hệ thống chưa kết nối được với chủ xe cho chuyến ${depLabel}. Bạn vẫn còn ${item.minutesUntil} phút — CarMate đã chuẩn bị sẵn phương án: ${busLine}`,
        data: {
          bookingId: booking.escrowId,
          rescueMode: true,
          reason: item.reason,
          departureMs,
          minutesUntil: item.minutesUntil,
          lifebuoys: item.lifebuoys
        },
        dedupeKey: `RESCUE:${booking.escrowId}`
      });

      // Chủ xe: cảnh báo cuối, chuyến VẪN CÒN nếu kịp xuất hiện
      await sendNotification({
        phone: driverPhone,
        kind: NOTIFICATION_KINDS.TRIP_AT_RISK,
        title: 'Cảnh báo: chưa xác nhận chuyến sắp chạy',
        body: `Chuyến ${depLabel} còn ${item.minutesUntil} phút. Khách đã được thông báo phương án dự phòng. Bạn vẫn đón được nếu xác nhận ngay.`,
        data: { bookingId: booking.escrowId, departureMs, requiresDriverReady: true },
        dedupeKey: `RESCUEDRV:${booking.escrowId}`
      });

      console.warn(
        `[Scheduler:departure] Bật cứu hộ cho ${booking.escrowId} (${item.reason}), ` +
          `chủ xe ${driverPhone} bị ghi nhận trễ hẹn.`
      );
    }
  }
}

/**
 * NHỊP 4 — PHIÊN GOM KHỚP LỆNH VI MÔ (WATTER MICRO-BATCHING)
 *
 * Gom 3 phút rồi giải một lần cho tỷ lệ ghép cao hơn hẳn so với ghép tham lam
 * từng người một (Didi Chuxing 2018). Trước đây chỉ chạy khi có người POST thủ công.
 */
async function tickMicroBatch() {
  const result = await runBatchMatchingEpoch({ epochType: 'micro_batch' });
  if (result?.matchedClustersCount > 0) {
    stats.actions.batchEpochs += 1;
    console.log(
      `[Scheduler:microBatch] Ghép được ${result.matchedPassengersCount} khách vào ${result.matchedClustersCount} xe.`
    );
  }
}

/**
 * NHỊP 5 — QUÉT RADAR 4 CHỐT ĐÊM
 *
 * Chốt T-8h (21:15), T-6h (23:15), T-1.5h (03:45), T-45m (04:30). Đây chính là
 * những khoảnh khắc mà trước đây hoàn toàn không có gì chạy vì khách đang ngủ.
 */
async function tickRadarSweep() {
  // 'driver_confirmed' PHẢI nằm trong danh sách: driverConfirmBooking ghi đúng
  // trạng thái này, thiếu nó thì chủ xe vừa bấm xác nhận xong là chuyến rơi khỏi
  // radar ngay lập tức — đúng những chuyến đang khoẻ lại mất giám sát.
  const bookings = getBookings().filter((b) =>
    ['zalo_active', 'confirmed', 'pre_confirmed', 'driver_confirmed', 'reassigned'].includes(b.status)
  );
  if (bookings.length === 0) return;

  const now = new Date();
  const checkpoint = resolveCheckpointForClock(now);
  if (!checkpoint) return; // ngoài các khung chốt, không làm phiền ai

  const sessions = getActiveCockpitSessions();

  for (const booking of bookings) {
    const driverPhone = booking.driverPhone || booking.phoneReal;
    if (!driverPhone) continue;

    const driver = getUserByPhone(String(driverPhone).replace(/\D/g, ''));
    const session = sessions.find((s) => s.driverPhone === driverPhone);
    const lastHeartbeatMinutesAgo = session?.lastPing
      ? Math.round((Date.now() - session.lastPing) / 60000)
      : 999;

    const evaluation = evaluateRadarSweepCheckpoint({
      checkpoint,
      driverConfirmed: booking.driverConfirmed === true || booking.status === 'confirmed',
      lastHeartbeatMinutesAgo,
      isStationary: (session?.speed ?? 0) < 3,
      distanceToStationKm: 0,
      trustScore: Number(driver?.trustScore ?? 100),
      // evaluateRadarSweepCheckpoint đọc `availableSeats`/`seats`, còn phiên cockpit
      // lưu `seatsAvailable`. Không ánh xạ thì requiresShadowSwap vĩnh viễn false
      // và chốt T-6h không bao giờ báo cho ai.
      candidateShadowTrips: sessions
        .filter((s) => s.seatsAvailable > 0 && s.driverPhone !== driverPhone)
        .map((s) => ({ ...s, availableSeats: s.seatsAvailable, seats: s.seatsAvailable }))
    });

    if (evaluation.action === 'NONE') continue;
    stats.actions.radarAlerts += 1;

    if (evaluation.requiresPing || evaluation.action === 'SEND_PUSH_REMINDER') {
      await sendNotification({
        phone: driverPhone,
        kind: NOTIFICATION_KINDS.DRIVER_CONFIRM_REQUEST,
        title: 'Xác nhận chuyến ngày mai',
        body: evaluation.message,
        data: { bookingId: booking.escrowId, checkpoint },
        dedupeKey: `RADAR:${booking.escrowId}:${checkpoint}`
      });
    } else if (evaluation.requiresShadowSwap && evaluation.shadowTrip) {
      await sendNotification({
        phone: booking.passengerPhone,
        kind: NOTIFICATION_KINDS.SHADOW_SWAP,
        title: 'Đã sắp xếp xe hỗ trợ',
        body: `Chuyến của bạn đã được chuyển sang xe ${evaluation.shadowTrip.plate || 'hỗ trợ'} để đảm bảo đúng giờ hẹn.`,
        data: { bookingId: booking.escrowId, checkpoint, newTripId: evaluation.shadowTrip.tripId },
        dedupeKey: `RADARSWAP:${booking.escrowId}:${checkpoint}`
      });
    }
  }
}

/**
 * Xác định đang ở trong khung chốt nào. Mỗi chốt có dung sai ±4 phút để nhịp
 * quét 5 phút không bao giờ bỏ lỡ, nhưng dedupeKey đảm bảo chỉ bắn đúng một lần.
 */
function resolveCheckpointForClock(date) {
  // Bốn chốt đêm là giờ Việt Nam. Máy chủ chạy trên Fly.io theo UTC, dùng giờ
  // cục bộ sẽ đẩy cả bốn mốc lệch 7 tiếng sang nửa kia của ngày — quét lúc khách
  // đang đi làm và im lặng đúng lúc họ đang ngủ.
  const vnNow = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const minutes = vnNow.getHours() * 60 + vnNow.getMinutes();
  const marks = [
    { at: 21 * 60 + 15, cp: RADAR_CHECKPOINTS.T_MINUS_8H },
    { at: 23 * 60 + 15, cp: RADAR_CHECKPOINTS.T_MINUS_6H },
    { at: 3 * 60 + 45, cp: RADAR_CHECKPOINTS.T_MINUS_1_5H },
    { at: 4 * 60 + 30, cp: RADAR_CHECKPOINTS.T_MINUS_45M }
  ];
  const hit = marks.find((m) => Math.abs(minutes - m.at) <= 4);
  return hit ? hit.cp : null;
}

/**
 * NHỊP 7 — ĐÓNG SỔ CHUYẾN ĐÃ CHẠY XONG.
 *
 * Đây là tác nhân duy nhất đưa một chuyến ra khỏi trạng thái đang mở. Trước khi
 * có nhịp này, mọi vòng quét đều dừng ở mốc T+2 phút (departureWatchdog.js) nên
 * chuyến ở lại `active` vĩnh viễn trong CSDL: xe cứu hộ có thể được điều từ một
 * chuyến của tháng trước, và chuyến định kỳ thì hiện mãi trên sàn.
 */
async function tickTripLifecycle() {
  const { completed, expired, rolled } = sweepFinishedTrips();
  const total = completed.length + expired.length + rolled.length;
  if (total === 0) return;

  stats.actions.tripsClosed += completed.length + expired.length;
  stats.actions.tripsRolled += rolled.length;

  console.log(
    `[Scheduler:tripLifecycle] Đóng sổ ${completed.length} chuyến đã chở khách, ` +
      `${expired.length} chuyến không ai đặt, đẩy ${rolled.length} chuyến định kỳ sang tuần sau.`
  );
}

/** NHỊP 8 — DỌN DẸP: nhật ký thông báo cũ hơn 30 ngày. */
async function tickHousekeeping() {
  const removed = pruneOldNotifications(30);
  if (removed > 0) console.log(`[Scheduler:housekeeping] Đã dọn ${removed} thông báo cũ.`);
}

/**
 * KHỞI ĐỘNG SCHEDULER.
 *
 * `unref()` trên mọi timer là bắt buộc: nếu không, tiến trình Node sẽ không bao
 * giờ tự thoát và các bài kiểm thử sẽ treo vô hạn sau khi chạy xong.
 */
export function startScheduler({ enabled = true } = {}) {
  if (started) return { started: true, alreadyRunning: true };
  if (!enabled) {
    console.log('[Scheduler] Bị tắt qua cấu hình (DISABLE_SCHEDULER=true).');
    return { started: false, reason: 'disabled' };
  }

  const jobs = [
    ['t30', SCHEDULER_INTERVALS.T30_TICK_MS, tickT30],
    ['handshake', SCHEDULER_INTERVALS.HANDSHAKE_MS, tickHandshake],
    ['lateness', SCHEDULER_INTERVALS.LATENESS_MS, tickLateness],
    ['departure', SCHEDULER_INTERVALS.DEPARTURE_MS, tickDeparture],
    ['microBatch', SCHEDULER_INTERVALS.MICRO_BATCH_MS, tickMicroBatch],
    ['radarSweep', SCHEDULER_INTERVALS.RADAR_SWEEP_MS, tickRadarSweep],
    ['tripLifecycle', SCHEDULER_INTERVALS.TRIP_LIFECYCLE_MS, tickTripLifecycle],
    ['housekeeping', SCHEDULER_INTERVALS.HOUSEKEEPING_MS, tickHousekeeping]
  ];

  for (const [name, intervalMs, fn] of jobs) {
    const timer = setInterval(() => {
      guard(name, fn);
    }, intervalMs);
    timer.unref();
    timers.push(timer);
  }

  started = true;
  stats.startedAt = Date.now();

  console.log(
    `\x1b[35m[Scheduler]\x1b[0m Nhịp tim đã khởi động — ${jobs.length} nhịp quét: ` +
      jobs.map(([n, ms]) => `${n}/${Math.round(ms / 1000)}s`).join(', ')
  );

  return { started: true, jobs: jobs.map(([n]) => n) };
}

/** Dừng scheduler (dùng khi tắt máy chủ và trong kiểm thử). */
export function stopScheduler() {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
  running.clear();
  started = false;
  return { stopped: true };
}

/** Trạng thái vận hành cho Cổng Quản Trị. */
export function getSchedulerStatus() {
  return {
    started,
    startedAt: stats.startedAt,
    uptimeMs: stats.startedAt ? Date.now() - stats.startedAt : 0,
    intervals: SCHEDULER_INTERVALS,
    ticks: stats.ticks,
    actions: { ...stats.actions },
    lastError: stats.lastError,
    currentlyRunning: Array.from(running)
  };
}

/**
 * Chạy tay một nhịp bất kỳ — phục vụ kiểm thử và nút "chạy ngay" ở Cổng Quản Trị.
 * Không phụ thuộc scheduler có đang chạy hay không.
 */
export async function runTickNow(name) {
  const map = {
    t30: tickT30,
    handshake: tickHandshake,
    lateness: tickLateness,
    departure: tickDeparture,
    microBatch: tickMicroBatch,
    radarSweep: tickRadarSweep,
    housekeeping: tickHousekeeping
  };
  const fn = map[name];
  if (!fn) return { success: false, error: `Không có nhịp quét tên '${name}'` };

  // Nhịp đang chạy dở: guard sẽ bỏ qua lượt này. Báo rõ ra ngoài, nếu không người
  // gọi nhận số liệu của lần chạy trước và tưởng nhịp vừa chạy xong.
  if (running.has(name)) {
    return { success: false, name, skipped: true, error: 'Nhịp quét này đang chạy, hãy thử lại sau' };
  }

  await guard(name, fn);
  return { success: true, name, tick: stats.ticks[name] };
}
