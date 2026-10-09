/**
 * =============================================================================
 * CARMATE SCHEDULER — THE SYSTEM'S HEARTBEAT
 * =============================================================================
 * Before this file existed, the entire dispatch algorithm only ran when someone opened the
 * app and called the API. That means Shadow trips, the risk radar and micro-batch were all
 * dead code during exactly the periods they are needed most: the night before and the early
 * morning, when passengers are asleep and no one sends any request.
 *
 * This is the "recourse trigger" in the Stochastic VRP with Recourse model: a remedial
 * action is only worth anything if something wakes it up.
 *
 * Eight sweep ticks, each with its own cycle according to urgency:
 *
 *   T30_TICK      60s   Spatio-temporal convergence, fires the 30-minute advance alert
 *   HANDSHAKE     60s   Reminds passengers to confirm they are heading to the pickup point
 *   DEPARTURE     60s   Watches T-40/T-30/T-20 against the trip's REAL departure time
 *   LATENESS      90s   Reports lateness risk and proposes options that need confirmation
 *   MICRO_BATCH  180s   Order-matching batch session (exactly the declared 3-minute window)
 *   RADAR_SWEEP  300s   4 night checkpoints T-8h/T-6h/T-1.5h/T-45m
 *   TRIP_LIFECYCLE 15m  Closes out trips that have finished, rolls recurring trips over to next week
 *   HOUSEKEEPING  1h    Cleans up old notification logs
 *
 * SAFETY PRINCIPLE: each tick is wrapped in its own try/catch and uses an anti-overlap lock.
 * A failing or long-running tick must never be allowed to kill the whole
 * scheduler or make two copies run on top of each other.
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
import { getBookings, getUserByPhone, sweepFinishedTrips, updateBookingStatus, getIntentById, updateIntent } from '../db/sqliteStore.js';

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
const running = new Set(); // anti-overlap lock by tick name
let started = false;

/** Operational metrics, serving /api/admin/scheduler-status. */
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
 * Wraps a sweep tick: prevents overlap, counts runs, swallows errors.
 * Swallowing errors is deliberate — the scheduler must survive any business-logic failure.
 */
async function guard(name, fn) {
  if (running.has(name)) {
    // The previous tick has not finished yet: skip this round instead of stacking
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

/** Formats a time mark in Vietnam time zone for notification content. */
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
 * TICK 1 — T-30 CHECKPOINT: SPATIO-TEMPORAL CONVERGENCE
 *
 * Fires a notification to the passenger when P(25 <= T_arrive <= 35 minutes) >= 0.90, and also
 * opens a 10-minute window for the passenger to tap "Tôi đang ra trạm" ("I'm heading to the station").
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
      body: `Cuộc hẹn với xe ${session.plate || ''} tại ${rider.hubShortName || rider.hubName} đang đến gần. Khoảng giờ đã chốt kết thúc lúc ${arriveLabel}. Hãy cập nhật khi bạn đang đến điểm đón.`,
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
      // A passenger receives exactly one T-30 alert per vehicle
      dedupeKey: `T30:${rider.intentId}:${session.tripId}:${trig.attempt}`
    });

    if (result.success && !result.deduped) {
      markT30Notified(rider.intentId, {
        etaMs,
        safeEtaMs,
        tripId: session.tripId
      });
      stats.actions.t30Sent += 1;

      // Tell the driver that a passenger is being mobilized to the station
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
 * TICK 2 — HANDSHAKE: SECOND REMINDER AND SEAT REVOCATION
 *
 * If the passenger does not respond after 10 minutes, the seat is released so someone else can
 * be picked up along the way. The passenger stays in the queue and only loses priority for this vehicle.
 */
async function tickHandshake() {
  const { needReminder, expired } = sweepHandshakeDeadlines(Date.now());

  for (const { rider, hubId } of needReminder) {
    const r = await sendNotification({
      phone: rider.phone,
      kind: NOTIFICATION_KINDS.CHECKIN_REMINDER,
      title: 'Bạn đã ra trạm chưa?',
      body: `Xe sắp tới ${rider.hubShortName || rider.hubName}. Bấm "Tôi đang ra trạm" để chủ xe biết. Cuộc hẹn đã xác nhận vẫn được giữ.`,
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
 * TICK 3 — LATENESS RADAR & SHADOW TRIP SWAP
 *
 * This is the model's Recourse Action. The system does NOT wait for the vehicle to actually be late: as soon as the
 * lateness probability exceeds the threshold, it scans the corridor for another vehicle that can make the committed
 * time and swaps. The time promised to the passenger stays the same.
 */
async function tickLateness() {
  for (const { rider, hubId, session, lateness, committedAt } of evaluateLatenessRisk(Date.now())) {
    const candidate = findShadowCandidate({ intentId: rider.intentId, hubId, seatsNeeded: rider.seatsNeeded, committedAtMs: committedAt, excludeTripId: session.tripId });
    const proposal = candidate ? applyShadowSwap({ intentId: rider.intentId, newTripId: candidate.session.tripId, newEtaMs: candidate.distribution.etaMs }) : null;
    await sendNotification({
      phone: rider.phone, kind: NOTIFICATION_KINDS.TRIP_AT_RISK, title: 'Xe có thể tới trễ',
      body: `Dự báo hiện tại trễ khoảng ${Math.max(0, Math.round(lateness.expectedDelaySeconds / 60))} phút. ${proposal?.success ? 'Có xe khác có thể phù hợp; cần bạn và chủ xe mới xác nhận trước khi đổi.' : 'Chưa có xe thay thế được xác nhận.'} Cuộc hẹn hiện tại chưa bị đổi.`,
      data: { intentId: rider.intentId, hubId, tripId: session.tripId, delayMinutes: Math.round(lateness.expectedDelaySeconds / 60), recoveryProposal: rider.recoveryProposal || null },
      dedupeKey: `ATRISK:${rider.intentId}:${Math.floor(Date.now() / (10 * 60 * 1000))}`
    });
    stats.actions.radarAlerts += 1;
  }
}

/**
 * TICK — DEPARTURE WATCH BY DEPARTURE TIME (T-40 / T-30 / T-20)
 *
 * The four night checkpoints are hard-coded times and only cover early-morning trips. This tick
 * follows relative marks against the real departure time so every time slot is watched equally.
 *
 * The decisive point is T-20: if the driver is still silent, the passenger is pushed straight into
 * Rescue Mode along with the QL13 coach hotline — they still have 20 minutes to call a Thành
 * Công coach and reach the roadside in time, instead of going to the station to wait and only then finding out they were abandoned.
 */
async function tickDeparture() {
  await expireUnansweredInquiries();
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

      // Passenger: state the truth plainly with a concrete option, no empty promises
      const busLine = (item.lifebuoys || [])
        .slice(0, 2)
        .map((b) => `${b.operator} (${b.hotline})`)
        .join(' · ');

      await sendNotification({
        phone: passengerPhone,
        kind: NOTIFICATION_KINDS.TRIP_AT_RISK,
        title: 'Chuyến đi có thể bị gián đoạn',
        body: `Chưa có xác nhận sẵn sàng cho cuộc hẹn ${depLabel}. ${busLine ? `Thông tin để kiểm tra thêm: ${busLine}.` : 'Chưa có phương án khác được xác nhận.'} Cuộc hẹn hiện tại vẫn còn hiệu lực; không coi thông tin dự phòng là xe đã nhận đón.`,
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

      // Driver: final warning, the trip STILL STANDS if they show up in time
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
          `cần xác nhận lại khả năng đón.`
      );
    }
  }
}

/**
 * TICK 4 — MICRO-BATCH ORDER-MATCHING SESSION (WATTER MICRO-BATCHING)
 *
 * Batching for 3 minutes and solving once gives a much higher match rate than greedy
 * one-by-one matching (Didi Chuxing 2018). Previously this only ran when someone POSTed manually.
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
 * TICK 5 — RADAR SWEEP AT THE 4 NIGHT CHECKPOINTS
 *
 * Checkpoints T-8h (21:15), T-6h (23:15), T-1.5h (03:45), T-45m (04:30). These are exactly
 * the moments when nothing used to run because passengers were asleep.
 */
async function tickRadarSweep() {
  const bookings = getBookings().filter((b) =>
    b.bothConfirmed === true && b.needStatus !== 'closed' &&
    ['zalo_active', 'confirmed', 'driver_confirmed'].includes(b.status)
  );
  if (bookings.length === 0) return;

  const now = new Date();
  const checkpoint = resolveCheckpointForClock(now);
  if (!checkpoint) return; // outside the checkpoint windows, do not bother anyone

  const sessions = getActiveCockpitSessions();

  for (const booking of bookings) {
    const driverPhone = booking.driverPhone || booking.phoneReal;
    if (!driverPhone) continue;

    const driver = getUserByPhone(String(driverPhone).replace(/\D/g, ''));
    const session = sessions.find((s) => s.tripId === booking.tripId && s.driverPhone === driverPhone);
    const lastHeartbeatMinutesAgo = session?.lastPing
      ? Math.round((Date.now() - session.lastPing) / 60000)
      : 999;

    const evaluation = evaluateRadarSweepCheckpoint({
      checkpoint,
      driverConfirmed: booking.driverConfirmed === true,
      lastHeartbeatMinutesAgo,
      isStationary: (session?.speed ?? 0) < 3,
      distanceToStationKm: 0,
      trustScore: Number(driver?.trustScore ?? 100),
      // Nearby seats alone do not establish route, timing, or acceptance.
      candidateShadowTrips: []
    });

    if (evaluation.action === 'NONE') continue;
    stats.actions.radarAlerts += 1;

    if (evaluation.requiresPing || evaluation.action === 'SEND_PUSH_REMINDER') {
      await sendNotification({
        phone: driverPhone,
        kind: NOTIFICATION_KINDS.DRIVER_CONFIRM_REQUEST,
        title: 'Cập nhật tình trạng sẵn sàng',
        body: 'Bạn đã sẵn sàng thực hiện cuộc hẹn đón đã chốt chưa? Hãy cập nhật để khách biết tình trạng hiện tại.',
        data: { bookingId: booking.escrowId, checkpoint },
        dedupeKey: `RADAR:${booking.escrowId}:${checkpoint}`
      });
    } else if (['ALERT_PASSENGER_OPTION', 'TRIGGER_WAKEUP_PULSE', 'UNFREEZE_PASSENGER_FALLBACK', 'SWAP_SHADOW_FLEET'].includes(evaluation.action)) {
      await sendNotification({
        phone: booking.passengerPhone,
        kind: NOTIFICATION_KINDS.TRIP_AT_RISK,
        title: 'Cần kiểm tra lại khả năng đón',
        body: 'Chưa có đủ cập nhật về khả năng đón của xe. Hãy kiểm tra với chủ xe; cuộc hẹn hiện tại vẫn còn hiệu lực. Chưa có xe thay thế được hai bên xác nhận.',
        data: { bookingId: booking.escrowId, checkpoint, needsReview: true, supportDispatched: false },
        dedupeKey: `RADARRISK:${booking.escrowId}:${checkpoint}`
      });
    }
  }
}

/**
 * Determines which checkpoint window we are in. Each checkpoint has a ±4 minute tolerance so the
 * 5-minute sweep tick never misses one, but dedupeKey ensures it only fires exactly once.
 */
function resolveCheckpointForClock(date) {
  // The four night checkpoints are in Vietnam time. The server runs on Fly.io in UTC; using local
  // time would shift all four marks 7 hours to the other half of the day — sweeping while passengers
  // are at work and staying silent exactly when they are asleep.
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
 * TICK 7 — CLOSING OUT TRIPS THAT HAVE FINISHED.
 *
 * This is the only actor that moves a trip out of the open state. Before this tick existed, every
 * sweep stopped at the T+2 minute mark (departureWatchdog.js), so trips stayed `active` forever in
 * the DB: a rescue vehicle could be dispatched from a trip from last month, and recurring trips kept showing on the marketplace.
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

/** TICK 8 — HOUSEKEEPING: notification logs older than 30 days. */
async function tickHousekeeping() {
  const removed = pruneOldNotifications(30);
  if (removed > 0) console.log(`[Scheduler:housekeeping] Đã dọn ${removed} thông báo cũ.`);
}

/**
 * STARTING THE SCHEDULER.
 *
 * `unref()` on every timer is mandatory: otherwise the Node process would never exit on its
 * own and tests would hang forever after finishing.
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

/** Stops the scheduler (used when shutting down the server and in tests). */
export function stopScheduler() {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
  running.clear();
  started = false;
  return { stopped: true };
}

/** Operational status for the Admin Portal. */
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
 * Manually runs any tick — serves testing and the "run now" button in the Admin Portal.
 * Does not depend on whether the scheduler is running.
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

  // A tick is already running: guard will skip this round. Report it explicitly, otherwise the
  // caller receives the previous run's metrics and thinks the tick has just finished.
  if (running.has(name)) {
    return { success: false, name, skipped: true, error: 'Nhịp quét này đang chạy, hãy thử lại sau' };
  }

  await guard(name, fn);
  return { success: true, name, tick: stats.ticks[name] };
}

export async function expireUnansweredInquiries(now = Date.now()) {
  for (const booking of getBookings()) {
    if (booking.bothConfirmed || booking.needStatus === 'closed' || !['inquiring','pre_confirmed'].includes(booking.status)) continue;
    const expiry = booking.status === 'pre_confirmed' ? new Date(booking.preConfirmedExpiresAt).getTime() : Number(booking.inquiryExpiresAt);
    if (!Number.isFinite(expiry) || expiry > now || (!booking.inquiryExpiresAt && booking.status !== 'pre_confirmed')) continue;
    const deadline = new Date(booking.originalDeadlineAt).getTime();
    const remainOpen = Number.isFinite(deadline) && deadline > now;
    const intent = booking.requestId ? getIntentById(booking.requestId) : null;
    // A linked intent owns the retry. Direct inquiries retain their one recovery
    // record instead; neither path starts a second actionable chain.
    const directRecovery = remainOpen && !intent;
    await updateBookingStatus(booking.escrowId || booking.id, directRecovery ? 'inquiring' : 'expired', {
      needStatus: directRecovery ? 'open' : 'closed', proposalTerms: null, proposalVersion: null,
      proposalDriverId: null, proposalDriverPhone: null, preConfirmedBy: null, preConfirmedExpiresAt: null,
      inquiryExpiresAt: null, needsReplacement: directRecovery, seatReserved: false,
      supportDispatched: false, expiredAt: now,
      declinedTripIds: [...new Set([...(booking.declinedTripIds || []), booking.tripId].filter(Boolean))]
    });
    if (intent) await updateIntent(intent.id, {
      status: remainOpen ? 'pending' : 'expired', needStatus: remainOpen ? 'open' : 'closed',
      matchedTripId: null, matchedBookingId: null,
      declinedTripIds: [...new Set([...(intent.declinedTripIds || []), booking.tripId].filter(Boolean))]
    });
  }
}
