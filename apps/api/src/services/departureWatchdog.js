/**
 * =============================================================================
 * WATCHING TRIPS BY DEPARTURE TIME (DEPARTURE WATCHDOG)
 * =============================================================================
 * The four night radar checkpoints (21:15 / 23:15 / 03:45 / 04:30) are HARD-CODED times, only
 * correct for trips departing around 05:30. A 08:30 or 14:00 trip falls into a complete gap:
 * nothing watches over it.
 *
 * This file watches by RELATIVE marks against each trip's real departure time,
 * so every time slot is protected equally:
 *
 *   T-40  Ask the driver: "Are you ready to pick up the passengers?" (one tap)
 *   T-30  No answer -> second reminder, and also check the GPS signal
 *   T-20  Still silent -> warn and provide the options that need confirmation
 *
 * Why the last checkpoint is at T-20 rather than T-5: the passenger still needs enough real
 * time to call a Thành Công coach (one every 30 minutes) and get to the roadside in
 * time. Alerting at T-5 makes the information as good as useless.
 *
 * PRINCIPLE: only WARN, NEVER auto-cancel the trip. A driver who loses signal in the middle of
 * the Bình Phước rubber forest may still show up on time; auto-cancelling would rob both
 * parties of that chance. The passenger holds all the information and decides for themselves.
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
  // Marks measured in minutes before departure time
  ASK_READY_MINUTES: 40,
  REMIND_MINUTES: 30,
  RESCUE_MINUTES: 20,
  // Tolerance per mark: the sweep ticks every 60s so ±3 minutes is more than enough not to miss one
  TOLERANCE_MINUTES: 3,
  // A driver silent for longer than this (minutes) is considered out of contact
  HEARTBEAT_STALE_MINUTES: 45
});

/** Booking statuses that are still "alive" and need to be watched. */
const ACTIVE_BOOKING_STATUSES = new Set([
  'zalo_active',
  'confirmed',
  'pre_confirmed',
  'driver_confirmed', // the driver has tapped to accept the pickup — must still be watched until the vehicle departs
  'reassigned'
]);

/**
 * Derives the departure time (epoch ms) of a booking.
 *
 * Reuses exactly how bookingController interprets the data: the date comes from the booking
 * or the original trip, the time is detected in the timeSlot string ("07:00-09:00" -> 07:00).
 * With no date or no detectable time, returns null — better to skip than to guess
 * and fire a rescue alert at the passenger in the middle of the night.
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

/** Whether we are within the window around a mark (minutes before departure) or not. */
function isAtMark(minutesUntilDeparture, markMinutes) {
  return Math.abs(minutesUntilDeparture - markMinutes) <= WATCHDOG_CONFIG.TOLERANCE_MINUTES;
}

/**
 * SCAN ALL TRIPS ABOUT TO DEPART.
 *
 * PURE evaluation function: only reads data and returns the list of things to do, never
 * sends notifications itself. Split this way so all the checkpoint logic can be tested
 * without a network, and so the scheduler keeps full authority over what gets sent.
 *
 * @param {object} params
 * @param {number} [params.nowMs] - Current time
 * @param {Array} [params.activeSessions] - Running cockpit sessions (to check GPS)
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
    // Only care about the window from T-45 until departure. Outside this range it is either
    // too early (the 4 night checkpoints handle it) or the vehicle has already left.
    if (minutesUntil > 45 || minutesUntil < -2) continue;

    const driverPhone = booking.driverPhone || booking.phoneReal;
    if (!driverPhone) continue;

    const session = activeSessions.find((s) => s.tripId === booking.tripId && s.driverPhone === driverPhone);
    const heartbeatMinutesAgo = session?.lastPing
      ? (nowMs - session.lastPing) / 60000
      : Infinity;

    // The driver counts as "ready" when they tap the confirm button, OR when the vehicle is
    // actually moving and sending a steady signal — real actions are more trustworthy than a button tap.
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

    // ── T-40: ask the driver whether they are ready ──
    if (isAtMark(minutesUntil, WATCHDOG_CONFIG.ASK_READY_MINUTES)) {
      if (!hasConfirmed && !booking.readyAskedAt) {
        actions.push({ ...base, action: 'ASK_READY' });
      }
      continue;
    }

    // ── T-30: second reminder ──
    if (isAtMark(minutesUntil, WATCHDOG_CONFIG.REMIND_MINUTES)) {
      if (!hasConfirmed && !booking.readyRemindedAt) {
        actions.push({ ...base, action: 'REMIND_READY' });
      }
      continue;
    }

    // ── T-20: activate rescue mode ──
    if (isAtMark(minutesUntil, WATCHDOG_CONFIG.RESCUE_MINUTES)) {
      if (hasConfirmed || booking.rescueActivatedAt) continue;

      actions.push({
        ...base,
        action: 'ACTIVATE_RESCUE',
        // Specific reason so the passenger is shown the actual truth, not something generic
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
 * Picks the list of rescue coaches best suited to the passenger's trip.
 *
 * Sorted by closeness in time: a 04:45 trip is of no help to someone who needs to leave at
 * 14:00. Always returns at least one option — an empty list at the exact moment the
 * passenger is most panicked is the worst possible scenario.
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

/** Records the time the driver was asked if they are ready (prevents asking repeatedly). */
export async function markReadyAsked(bookingId, nowMs = Date.now()) {
  return updateBookingStatus(bookingId, getBookingStatusSafe(bookingId), {
    readyAskedAt: new Date(nowMs).toISOString()
  });
}

/** Records the time of the second reminder. */
export async function markReadyReminded(bookingId, nowMs = Date.now()) {
  return updateBookingStatus(bookingId, getBookingStatusSafe(bookingId), {
    readyRemindedAt: new Date(nowMs).toISOString()
  });
}

/**
 * Keeps the current status when only an extra field needs to be written.
 * updateBookingStatus requires a status argument, and the trip-watch checkpoints must
 * absolutely never change the booking's business status.
 */
function getBookingStatusSafe(bookingId) {
  return getBookingById(bookingId)?.status || 'zalo_active';
}

/**
 * ACTIVATE RESCUE MODE for a trip.
 *
 * The trip is NOT cancelled: it only sets the `rescueMode` flag so the passenger UI switches
 * to the rescue screen. A driver who arrives late can still pick up the passenger if the
 * passenger has not taken another vehicle.
 *
 * It also deducts the driver's trust score through the existing `penalty_late` scale:
 * increment the lateReports counter so computeTrustScore automatically applies -10 points. No
 * new penalty rules are invented, and no account is locked automatically.
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
    // The trip stays alive: a driver who shows up late can still pick up the passenger
    isCancelled: false
  });

  // Missing readiness/GPS is a risk signal, not evidence of misconduct.
  return { success: true, booking: updated, penalty: null };

}

/**
 * Increments the driver's late-arrival counter.
 *
 * The trust score is not stored as a fixed value but recomputed by computeTrustScore from
 * these counters, so incrementing `lateReports` is enough for the whole system to reflect it correctly.
 */
export async function applyLatePenalty(driverPhone, bookingId, nowMs = Date.now()) {
  const user = getUserByPhone(String(driverPhone).replace(/\D/g, ''));
  if (!user) return null;

  const history = Array.isArray(user.rescueIncidents) ? user.rescueIncidents : [];
  // The same booking is only counted once, even if the sweep runs again
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
