import crypto from 'node:crypto';
import {
  getVirtualHubById, getStationStationKm, projectToCorridorFrenet,
  computeEtaDistribution, probabilityOfLateness, cleanPhoneNumber, getTravelWindow
} from '@carmate/shared';
import { getRawDB, getTripById, getBookings, getBookingById } from '../db/sqliteStore.js';
import {
  getTripAvailableSeatsForSegment, createStationAppointmentProposal, confirmAppointment,
  cancelAppointment, completeAppointment, markAppointmentBoarded
} from './bookingCommitment.js';

// Telemetry is ephemeral; confirmed appointments and their seat inventory live in SQLite.
const stationQueues = new Map();
const cockpitSessions = new Map();
const FRESH_MS = 90_000;
const OFFER_MS = 2 * 60_000;
export const T30_CONFIG = Object.freeze({
  MIN_LEAD_SECONDS: 20 * 60, CONFIDENCE_THRESHOLD: 0.85, MAX_P80_SECONDS: 45 * 60,
  HANDSHAKE_GRACE_MS: 10 * 60_000, REMINDER_AFTER_MS: 5 * 60_000
});
let loadedDatabase = null;
function restoreState() {
  const database = getRawDB();
  if (loadedDatabase === database) return;
  database.exec('CREATE TABLE IF NOT EXISTS station_state (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(kind,id))');
  stationQueues.clear(); cockpitSessions.clear();
  for (const row of database.prepare('SELECT kind,id,payload FROM station_state').all()) {
    try {
      const value = JSON.parse(row.payload);
      if (row.kind === 'rider') {
        if (!stationQueues.has(value.hubId)) stationQueues.set(value.hubId, []);
        stationQueues.get(value.hubId).push(value);
      } else if (row.kind === 'session') {
        // A restored vehicle must send a fresh GPS ping before being offered.
        cockpitSessions.set(value.tripId, { ...value, lat: null, lng: null, lastPing: 0 });
      }
    } catch { /* A malformed record cannot fabricate a vehicle or appointment. */ }
  }
  loadedDatabase = database;
}
function persistState() {
  const database = getRawDB();
  const save = database.prepare('INSERT INTO station_state (kind,id,payload) VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload');
  database.transaction(() => {
    for (const queue of stationQueues.values()) for (const rider of queue) save.run('rider', rider.intentId, JSON.stringify(rider));
    for (const session of cockpitSessions.values()) {
      const { lat: _lat, lng: _lng, lastPing: _lastPing, speed: _speed, heading: _heading, ...manifest } = session;
      // Preserve the manifest, never a historical track of vehicle coordinates.
      save.run('session', session.tripId, JSON.stringify(manifest));
    }
  })();
}
const allRiders = () => { restoreState(); return [...stationQueues.values()].flat(); };
const findRider = (id) => allRiders().find((r) => r.intentId === id);
const timestamp = (value) => value == null || value === '' ? NaN : new Date(value).getTime();
const fresh = (s, now = Date.now()) => Boolean(s && !s.isBanned && s.status !== 'COMPLETED' && now - s.lastPing <= FRESH_MS);
const error = (message) => ({ success: false, error: message });
const carInfo = (s) => ({ plate: s.plate || null, vehicleModel: s.vehicleModel || null, driverName: s.driverName || null, driverPhone: s.driverPhone || null });

function distanceKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const rad = Math.PI / 180;
  const a = Math.sin((lat2-lat1)*rad/2)**2 + Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lng2-lng1)*rad/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function pickupLocation(rider, hub) {
  const supplied = (value) => value != null && String(value).trim() !== '';
  const hasCoords = supplied(rider.clientLat) || supplied(rider.clientLng);
  const point = String(rider.pickupPoint || '').trim();
  const customLabel = point && ![hub?.name, hub?.shortName].includes(point);
  const custom = rider.pickupMode === 'doorstep' ||
    (rider.pickupMode === 'hybrid' && (hasCoords || customLabel));
  if (!custom) return { custom: false, valid: true, detourKm: 0 };
  const lat = supplied(rider.clientLat) ? Number(rider.clientLat) : NaN;
  const lng = supplied(rider.clientLng) ? Number(rider.clientLng) : NaN;
  const valid = Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180;
  return { custom: true, valid, detourKm: valid ? 2 * 1.28 * distanceKm(lat, lng, hub?.lat, hub?.lng) : Infinity };
}

function syncRider(rider) {
  if (!rider?.bookingId) return rider;
  const booking = getBookingById(rider.bookingId);
  if (!booking) return rider;
  rider.needsReplacement = Boolean(booking.needsReplacement);
  if (booking.needStatus === 'closed') rider.status = booking.status === 'completed' ? 'COMPLETED' : 'CANCELLED';
  else if (booking.status === 'boarded') rider.status = 'BOARDED';
  else if (booking.bothConfirmed) {
    rider.status = 'ARRIVING'; rider.matchedTripId = booking.tripId;
    rider.committedTerms = booking.committedTerms; rider.seatHeldByTripId = booking.tripId;
    const session = cockpitSessions.get(booking.tripId);
    if (session) { rider.carInfo = carInfo(session); rider.lastVehicleUpdateAt = session.lastPing; rider.telemetryFresh = fresh(session); }
  } else if (booking.needsReplacement && rider.status !== 'OFFERED') {
    rider.status = 'WAITING'; rider.matchedTripId = null; rider.carInfo = null; rider.committedTerms = null;
  }
  return rider;
}

function expireOffers(now = Date.now()) {
  for (const rider of allRiders()) {
    syncRider(rider);
    if (rider.status === 'OFFERED' && rider.lockExpiresAt <= now && !rider.committedTerms) {
      rider.status = 'WAITING'; rider.matchedTripId = null; rider.proposalTerms = null;
      rider.proposalVersion = null; rider.driverAccepted = false; rider.carInfo = null;
    }
    if (rider.status === 'WAITING' && Number.isFinite(timestamp(rider.originalDeadlineAt)) && timestamp(rider.originalDeadlineAt) < now) {
      rider.status = 'EXPIRED'; rider.needStatus = 'closed';
    }
  }
  for (const session of cockpitSessions.values()) {
    if (session.activeOffer?.expiresAt <= now) session.activeOffer = null;
  }
  persistState();
}

export function riderCheckIn({ hubId, destinationHubId, seatsNeeded = 1, phone = '', name = '', userId,
  clientLat = null, clientLng = null, date, timeSlot, pickupStartAt, pickupEndAt, latestArrivalAt,
  pickupMode = 'station', pickupPoint = null }) {
  const origin = getVirtualHubById(hubId), destination = getVirtualHubById(destinationHubId);
  if (!origin || !destination || hubId === destinationHubId) return error('Cần chọn đúng trạm đón và trạm trả.');
  const seats = Number(seatsNeeded);
  if (!Number.isInteger(seats) || seats < 1) return error('Số người phải là số nguyên dương.');
  if (!userId || !cleanPhoneNumber(phone)) return error('Cần đăng nhập và số liên hệ để lưu nhu cầu.');
  if (!['station','doorstep','hybrid'].includes(pickupMode)) return error('Cách đón không hợp lệ.');
  const location = pickupLocation({ pickupMode, pickupPoint, clientLat, clientLng }, origin);
  if (!location.valid) return error('Cần tọa độ điểm đón ngoài trạm để kiểm tra quãng đường vòng và giờ đón.');
  const now = Date.now();
  const window = getTravelWindow({ date, timeSlot });
  const deadline = pickupEndAt || (window ? new Date(window.end).toISOString() : null);
  if (deadline && (!Number.isFinite(timestamp(deadline)) || timestamp(deadline) <= now)) return error('Khoảng giờ đi đã hết hoặc không hợp lệ.');
  const existing = allRiders().find((r) => r.userId === userId && r.hubId === hubId && r.destinationHubId === destinationHubId && ['WAITING','OFFERED','ARRIVING','BOARDED'].includes(syncRider(r).status));
  if (existing) return { success: true, intent: existing, alreadyExists: true };
  const rider = {
    intentId: `ST-${crypto.randomUUID()}`, userId, hubId, hubName: origin.name, hubShortName: origin.shortName || origin.name,
    destinationHubId, destinationName: destination.name, destinationShortName: destination.shortName || destination.name,
    seatsNeeded: seats, phone: cleanPhoneNumber(phone), name: String(name).trim(),
    checkinTime: now, originalRequestedAt: now, originalDeadlineAt: deadline ? timestamp(deadline) : null,
    pickupStartAt: pickupStartAt || null, latestArrivalAt: latestArrivalAt || null,
    pickupMode, pickupPoint, clientLat, clientLng,
    status: 'WAITING', needStatus: 'open', needsReplacement: false,
    pin: String(crypto.randomInt(1000, 10000)), matchedTripId: null, lockExpiresAt: null,
    fuelSurcharge: null, driverPayout: null, ratePerSeat: null, noSurge: false, platformFee: 0, carInfo: null
  };
  if (!stationQueues.has(hubId)) stationQueues.set(hubId, []);
  stationQueues.get(hubId).push(rider);
  persistState();
  return { success: true, intent: rider };
}

export function getStationQueue(hubId) {
  expireOffers();
  const waiting = (stationQueues.get(hubId) || []).filter((r) => ['WAITING','OFFERED'].includes(r.status));
  return { success: true, hubId, waitingCount: waiting.length, estimatedWaitMinutes: null,
    queue: waiting.map((r, i) => ({ intentId: r.intentId, position: i+1, destinationShortName: r.destinationShortName, seatsNeeded: r.seatsNeeded, status: r.status })) };
}
export function getRiderPass(intentId) {
  expireOffers();
  const rider = findRider(intentId);
  return rider ? { success: true, intent: syncRider(rider), position: (stationQueues.get(rider.hubId) || []).filter((r) => ['WAITING','OFFERED'].includes(r.status)).findIndex((r) => r.intentId === intentId)+1 } : error('Không tìm thấy nhu cầu.');
}

/** Insert pickup/dropoff into the REMAINING route. Recheck every existing
 * pickup/dropoff deadline and every overlapping seat segment before proposing. */
function planInsertion(session, rider, now = Date.now()) {
  if (!fresh(session, now)) return null;
  const trip = getTripById(session.tripId);
  if (!trip || trip.isHidden || !['active','full'].includes(trip.status || 'active')) return null;
  const projected = projectToCorridorFrenet(session.lat, session.lng, session.corridor);
  const targetS = getStationStationKm(trip.destinationHubId || session.destinationHubId);
  const pickupS = getStationStationKm(rider.hubId), dropoffS = getStationStationKm(rider.destinationHubId);
  if (!projected.isOnCorridor || targetS == null || pickupS == null || dropoffS == null) return null;
  const direction = Math.sign(targetS - projected.s);
  if (!direction || (pickupS-projected.s)*direction < -0.1 || (dropoffS-pickupS)*direction <= 0 || (targetS-dropoffS)*direction < -0.1) return null;
  if (getTripAvailableSeatsForSegment(trip, { originHubId: rider.hubId, destinationHubId: rider.destinationHubId }) < rider.seatsNeeded) return null;
  const location = pickupLocation(rider, getVirtualHubById(rider.hubId));
  if (!location.valid) return null;
  const detour = location.detourKm;
  if (detour > Number(trip.maxDetourKm || 0) || (location.custom && !['doorstep','hybrid'].includes(trip.pickupMode))) return null;
  const active = getBookings().filter((b) => b.tripId === trip.id && b.bothConfirmed && !['cancelled','completed'].includes(b.status));
  const stops = [];
  for (const booking of active) {
    if (booking.requestId === rider.intentId) continue;
    const terms = booking.committedTerms;
    if (!terms) return null; // Unknown commitments cannot safely be optimized around.
    const a = getStationStationKm(terms.originHubId), b = getStationStationKm(terms.destinationHubId);
    if (a == null || b == null) return null;
    if (booking.status !== 'boarded') {
      if ((a-projected.s)*direction < -0.1) return null;
      stops.push({ s: a, type: 'pickup', id: booking.escrowId, earliest: timestamp(terms.pickupStartAt), latest: timestamp(terms.pickupEndAt), detourKm: Number(terms.detourKm || 0) });
    }
    if ((b-projected.s)*direction < -0.1) return null;
    stops.push({ s: b, type: 'dropoff', id: booking.escrowId, latest: timestamp(terms.dropoffLatestAt) });
  }
  stops.push({ s: pickupS, type: 'pickup', id: rider.intentId, earliest: timestamp(rider.pickupStartAt), latest: timestamp(rider.originalDeadlineAt), detourKm: detour });
  stops.push({ s: dropoffS, type: 'dropoff', id: rider.intentId, latest: timestamp(rider.latestArrivalAt) });
  stops.sort((a,b) => (a.s-b.s)*direction || (a.type === b.type ? 0 : a.type === 'dropoff' ? -1 : 1));
  if (stops.reduce((n,s) => n+(s.detourKm || 0),0) > Number(trip.maxDetourKm || 0)) return null;
  let currentS = projected.s, clock = now; let pickupAt = null, dropoffAt = null;
  for (const stop of stops) {
    const distribution = computeEtaDistribution({ currentS, targetS: stop.s, currentSpeedKmh: session.speed, nowMs: clock });
    if (!distribution.valid || !Number.isFinite(distribution.muSeconds)) return null;
    clock += distribution.muSeconds * 1000 + (stop.detourKm || 0) / Math.max(15, session.speed || 30) * 3_600_000;
    if (Number.isFinite(stop.earliest)) clock = Math.max(clock, stop.earliest);
    if (Number.isFinite(stop.latest) && clock > stop.latest) return null;
    if (stop.id === rider.intentId) { if (stop.type === 'pickup') pickupAt = clock; else dropoffAt = clock; }
    clock += 60_000; currentS = stop.s;
  }
  if (pickupAt == null || dropoffAt == null) return null;
  const pickupEnd = Math.min(pickupAt + 5 * 60_000, Number.isFinite(timestamp(rider.originalDeadlineAt)) ? timestamp(rider.originalDeadlineAt) : Infinity);
  const listed = trip.pricingMode === 'listed' && Number.isFinite(Number(trip.basePricePerSeat)) && trip.basePricePerSeat != null;
  return { trip, detourKm: detour, pickupAt, dropoffAt, terms: {
    tripId: trip.id, pickupPoint: location.custom ? rider.pickupPoint || `Điểm đón (${Number(rider.clientLat)}, ${Number(rider.clientLng)})` : rider.hubName,
    dropoffPoint: rider.destinationName, originHubId: rider.hubId, destinationHubId: rider.destinationHubId,
    pickupStartAt: new Date(pickupAt).toISOString(), pickupEndAt: new Date(pickupEnd).toISOString(),
    dropoffLatestAt: rider.latestArrivalAt ? new Date(timestamp(rider.latestArrivalAt)).toISOString() : new Date(dropoffAt + 5 * 60_000).toISOString(),
    totalPrice: listed ? Number(trip.basePricePerSeat) * rider.seatsNeeded : null,
    seats: rider.seatsNeeded, pickupMode: rider.pickupMode, detourKm: detour
  }};
}

export function telemetryPing({ tripId, driverPhone = '', driverName = '', plate = '', vehicleModel = '', seatsAvailable,
  corridor = 'Tuyến QL13', destinationHubId, lat, lng, speed = 0, heading = null }) {
  restoreState();
  const now = Date.now();
  if (![Number(lat),Number(lng)].every(Number.isFinite) || lat == null || lng == null) return error('Cần vị trí thật của xe.');
  let session = cockpitSessions.get(tripId);
  if (!session) session = { tripId, status: 'ACTIVE_SCANNING', activeOffer: null, boardedPassengers: [], totalEarnings: 0 };
  Object.assign(session, { driverPhone, driverName, plate, vehicleModel, corridor, destinationHubId,
    lat: Number(lat), lng: Number(lng), speed: Math.max(0, Number(speed) || 0), heading, lastPing: now });
  session.seatsAvailable = Math.max(0, Number(seatsAvailable ?? session.seatsAvailable) || 0);
  cockpitSessions.set(tripId, session);
  expireOffers(now);
  for (const rider of allRiders()) syncRider(rider);
  // A vehicle continues scanning after boarding and after each segment drop-off.
  let proximityAlert = null;
  if (!session.activeOffer && fresh(session, now)) {
    const candidates = allRiders().filter((r) => r.status === 'WAITING').map((rider) => ({ rider, plan: planInsertion(session, rider, now) })).filter((x) => x.plan);
    candidates.sort((a,b) => a.plan.pickupAt-b.plan.pickupAt || a.rider.checkinTime-b.rider.checkinTime);
    const first = candidates[0];
    if (first) {
      const { rider, plan } = first;
      const offer = { intentId: rider.intentId, stationId: rider.hubId, stationName: rider.hubName,
        stationShortName: rider.hubShortName, destinationName: rider.destinationName, destinationHubId: rider.destinationHubId,
        riderCount: rider.seatsNeeded, fuelSurcharge: plan.terms.totalPrice, driverPayout: plan.terms.totalPrice,
        totalPrice: plan.terms.totalPrice, proposalTerms: plan.terms, noSurge: false,
        ttaSeconds: Math.max(0,Math.round((plan.pickupAt-now)/1000)), expiresAt: now+OFFER_MS };
      Object.assign(rider, { status: 'OFFERED', proposedTripId: tripId, proposalTerms: plan.terms, driverAccepted: false, lockExpiresAt: offer.expiresAt });
      session.activeOffer = offer; proximityAlert = offer;
    }
  }
  persistState();
  const manifest = allRiders().filter((r) => (r.matchedTripId === tripId || r.proposedTripId === tripId) && ['OFFERED','ARRIVING','BOARDED'].includes(r.status)).map(({ pin: _pin, ...r }) => r);
  return { success: true, session: { tripId, manifest, status: session.status, seatsAvailable: session.seatsAvailable, speed: session.speed,
    activeOffer: session.activeOffer, totalEarnings: session.totalEarnings, boardedCount: session.boardedPassengers.length }, proximityAlert };
}

export function driverAcceptOffer({ tripId, intentId, user, totalPrice }) {
  try {
    restoreState();
    const session = cockpitSessions.get(tripId), rider = findRider(intentId);
    if (!fresh(session) || !rider || session.activeOffer?.intentId !== intentId || session.activeOffer.expiresAt <= Date.now()) return error('Đề nghị đã hết hạn hoặc dữ liệu xe cần cập nhật.');
    const plan = planInsertion(session, rider);
    if (!plan) return error('Điểm, giờ hoặc ghế không còn phù hợp.');
    const terms = { ...plan.terms, totalPrice: totalPrice ?? plan.terms.totalPrice };
    const booking = createStationAppointmentProposal({ rider, trip: plan.trip, user, terms });
    Object.assign(rider, { bookingId: booking.escrowId, proposalTerms: booking.proposalTerms, proposalVersion: booking.proposalVersion,
      lockExpiresAt: timestamp(booking.preConfirmedExpiresAt), driverAccepted: true, status: 'OFFERED', carInfo: carInfo(session),
      fuelSurcharge: booking.proposalTerms.totalPrice, driverPayout: booking.proposalTerms.totalPrice });
    session.activeOffer.expiresAt = rider.lockExpiresAt;
    persistState();
    const { pin: _pin, ...publicRider } = rider;
    return { success: true, message: 'Đã gửi đề nghị đón. Đang chờ khách xác nhận cùng điểm, giờ và giá.', rider: publicRider };
  } catch (err) { return error(err.message); }
}

export function riderAcceptStationOffer({ intentId, proposalVersion, user }) {
  try {
    const rider = findRider(intentId);
    if (!rider || !rider.driverAccepted || !rider.bookingId) return error('Chủ xe chưa gửi đề nghị xác nhận.');
    const session = cockpitSessions.get(rider.proposedTripId);
    if (!fresh(session)) return error('Cần chủ xe cập nhật vị trí trước khi chốt.');
    const currentPlan = planInsertion(session, rider);
    if (!currentPlan || currentPlan.pickupAt > timestamp(rider.proposalTerms?.pickupEndAt) || currentPlan.dropoffAt > timestamp(rider.proposalTerms?.dropoffLatestAt)) return error('Phương án không còn đáp ứng ghế hoặc giờ hẹn. Cần chủ xe gửi lại đề nghị để bạn xem trước khi chốt.');
    const booking = confirmAppointment({ bookingId: rider.bookingId, user, proposalVersion });
    syncRider(rider); rider.needStatus = 'matched'; rider.needsReplacement = false;
    rider.expectedArrivalMs = timestamp(booking.committedTerms.pickupStartAt);
    rider.safeArrivalMs = timestamp(booking.committedTerms.pickupEndAt);
    session.activeOffer = null;
    persistState();
    return { success: true, message: 'Hai bên đã xác nhận. Bạn có thể đến điểm đón đã chốt.', intent: rider };
  } catch (err) { return error(err.message); }
}

export function driverRejectOffer({ tripId, intentId }) {
  restoreState();
  const session = cockpitSessions.get(tripId), rider = findRider(intentId);
  if (!session || session.activeOffer?.intentId !== intentId || rider?.proposedTripId !== tripId) return error('Đề nghị không thuộc xe này.');
  session.activeOffer = null;
  if (rider && rider.status === 'OFFERED' && !rider.committedTerms) Object.assign(rider, { status: 'WAITING', proposedTripId: null, driverAccepted: false, proposalTerms: null, proposalVersion: null });
  persistState();
  return { success: true, message: 'Đã bỏ qua đề nghị.' };
}

export function driverVerifyPin({ tripId, intentId, pin, user }) {
  try {
    restoreState();
    restoreState();
  const session = cockpitSessions.get(tripId), rider = syncRider(findRider(intentId));
    if (!session || !rider || rider.matchedTripId !== tripId || !['ARRIVING','BOARDED'].includes(rider.status)) return error('Không có cuộc hẹn đã xác nhận cho xe này.');
    if (rider.pin !== String(pin || '').trim()) return error('Mã PIN không đúng. Vui lòng hỏi khách mã trên thẻ chuyến.');
    if (rider.status === 'BOARDED') return { success: true, rider, alreadyBoarded: true };
    markAppointmentBoarded({ bookingId: rider.bookingId, user });
    rider.status = 'BOARDED';
    session.boardedPassengers.push({ intentId, name: rider.name, seatsNeeded: rider.seatsNeeded, boardedAt: Date.now() });
    session.status = 'ACTIVE_SCANNING';
    persistState();
    return { success: true, message: 'Đã xác nhận khách lên xe. Xe tiếp tục hành trình.', rider, session: { status: session.status, seatsAvailable: session.seatsAvailable } };
  } catch (err) { return error(err.message); }
}

export function driverCompleteDropoff({ tripId, intentId, user }) {
  try {
    restoreState();
    restoreState();
  const session = cockpitSessions.get(tripId), rider = syncRider(findRider(intentId));
    if (!session || !rider || rider.matchedTripId !== tripId || !['BOARDED','COMPLETED'].includes(rider.status)) return error('Khách chưa lên xe này.');
    completeAppointment({ bookingId: rider.bookingId, user });
    rider.status = 'COMPLETED'; rider.needStatus = 'closed';
    session.boardedPassengers = session.boardedPassengers.filter((r) => r.intentId !== intentId);
    session.status = 'ACTIVE_SCANNING';
    session.seatsAvailable = getTripAvailableSeatsForSegment(getTripById(tripId), {});
    persistState();
    return { success: true, message: 'Đã trả khách. Xe tiếp tục nhận khách trên phần hành trình còn lại.', intent: rider };
  } catch (err) { return error(err.message); }
}

export function cancelRiderIntent(intentId, reason = 'PASSENGER_CANCELLED', { user, keepNeed = false } = {}) {
  try {
    const rider = syncRider(findRider(intentId));
    if (!rider) return error('Không tìm thấy yêu cầu.');
    if (!user || (rider.userId ? user.id !== rider.userId : cleanPhoneNumber(user.phone || '') !== rider.phone)) return error('Bạn không sở hữu nhu cầu này.');
    if (rider.status === 'BOARDED') return error('Khách đã lên xe; cần xử lý sự cố hành trình.');
    if (rider.bookingId) cancelAppointment({ bookingId: rider.bookingId, user, reason, keepNeed });
    const previousTripId = rider.matchedTripId || rider.proposedTripId;
    Object.assign(rider, { status: keepNeed ? 'WAITING' : 'CANCELLED', needStatus: keepNeed ? 'open' : 'closed',
      needsReplacement: keepNeed, cancelReason: reason, cancelledAt: new Date().toISOString(), matchedTripId: null,
      proposedTripId: null, committedTerms: null, proposalTerms: null, proposalVersion: null, recoveryProposal: null, driverAccepted: false, carInfo: null });
    for (const session of cockpitSessions.values()) if (session.activeOffer?.intentId === intentId) session.activeOffer = null;
    persistState();
    return { success: true, intent: rider, previousTripId };
  } catch (err) { return error(err.message); }
}
export function getActiveCockpitSessions() { restoreState(); return [...cockpitSessions.values()].filter((s) => fresh(s)); }
export function resetAllStationData({ clearPersisted = false } = {}) {
  if (clearPersisted) { restoreState(); getRawDB().prepare('DELETE FROM station_state').run(); }
  stationQueues.clear(); cockpitSessions.clear(); loadedDatabase = null; return { success: true };
}

// Readiness is a reminder after a confirmed appointment; a prediction cannot
// tell an unconfirmed passenger to travel to a stop or take their seat away.
export function evaluateT30Triggers(nowMs = Date.now()) {
  const result = [];
  for (const rider of allRiders()) {
    syncRider(rider);
    if (rider.status !== 'ARRIVING' || rider.t30NotifiedAt) continue;
    const session = cockpitSessions.get(rider.matchedTripId);
    const etaMs = timestamp(rider.committedTerms?.pickupStartAt);
    if (!fresh(session, nowMs) || !Number.isFinite(etaMs) || etaMs-nowMs < 0 || etaMs-nowMs > 30*60_000) continue;
    result.push({ rider, hubId: rider.hubId, session, etaMs, safeEtaMs: timestamp(rider.committedTerms.pickupEndAt), probability: null });
  }
  return result;
}
export function markT30Notified(intentId, { etaMs, safeEtaMs, tripId, nowMs = Date.now() } = {}) {
  const rider = findRider(intentId);
  if (!rider?.committedTerms || rider.matchedTripId !== tripId) return { success: false };
  Object.assign(rider, { t30NotifiedAt: nowMs, t30DeadlineAt: nowMs+T30_CONFIG.HANDSHAKE_GRACE_MS, t30ReminderAt: null,
    estimatedArrivalMs: etaMs, estimatedSafeArrivalMs: safeEtaMs, t30TripId: tripId });
  persistState();
  return { success: true, rider };
}
export function riderConfirmOnTheWay({ intentId, clientLat = null, clientLng = null }) {
  const rider = syncRider(findRider(intentId));
  if (!rider || rider.status !== 'ARRIVING') return error('Cần cuộc hẹn được hai bên xác nhận trước khi ra điểm đón.');
  rider.handshakeConfirmedAt = Date.now(); rider.handshakeStatus = 'ON_THE_WAY';
  const hub = getVirtualHubById(rider.hubId);
  persistState();
  return { success: true, message: 'Đã báo bạn đang đến điểm đón.', intentId, hubId: rider.hubId,
    handshakeStatus: rider.handshakeStatus, matchedTripId: rider.matchedTripId,
    distanceToHubM: Math.round(distanceKm(clientLat, clientLng, hub?.lat, hub?.lng)*1000) || null };
}
export function sweepHandshakeDeadlines(nowMs = Date.now()) {
  const needReminder = [];
  for (const rider of allRiders()) {
    if (rider.status !== 'ARRIVING' || !rider.t30NotifiedAt || rider.handshakeStatus === 'ON_THE_WAY') continue;
    if (!rider.t30ReminderAt && nowMs-rider.t30NotifiedAt >= T30_CONFIG.REMINDER_AFTER_MS) {
      rider.t30ReminderAt = nowMs; needReminder.push({ rider, hubId: rider.hubId });
    }
  }
  persistState();
  return { needReminder, expired: [] };
}
export function evaluateLatenessRisk(nowMs = Date.now(), toleranceSeconds = 300) {
  const result = [];
  for (const rider of allRiders()) {
    syncRider(rider);
    if (rider.status !== 'ARRIVING') continue;
    const session = cockpitSessions.get(rider.matchedTripId);
    if (!fresh(session, nowMs)) continue;
    const s = projectToCorridorFrenet(session.lat, session.lng, session.corridor);
    const targetS = getStationStationKm(rider.hubId), committedAt = timestamp(rider.committedTerms?.pickupEndAt);
    if (!s.isOnCorridor || targetS == null || !Number.isFinite(committedAt)) continue;
    const distribution = computeEtaDistribution({ currentS: s.s, targetS, currentSpeedKmh: session.speed, nowMs });
    const lateness = probabilityOfLateness(distribution, committedAt, toleranceSeconds, nowMs);
    rider.estimatedArrivalMs = distribution.etaMs;
    if (lateness.probability >= 0.6 || lateness.expectedDelaySeconds > toleranceSeconds) result.push({ rider, hubId: rider.hubId, session, lateness, committedAt });
  }
  return result;
}
// Compatibility name: this now records a candidate, never changes a booking,
// releases its original seat or claims that the replacement accepted.
export function applyShadowSwap({ intentId, newTripId, newEtaMs = null }) {
  const rider = syncRider(findRider(intentId)), session = cockpitSessions.get(newTripId);
  if (!rider || !fresh(session) || ['BOARDED','COMPLETED','CANCELLED'].includes(rider.status)) return error('Không thể đề xuất xe thay thế cho yêu cầu này.');
  const plan = planInsertion(session, rider);
  if (!plan || newTripId === rider.matchedTripId) return error('Xe thay thế chưa đáp ứng điều kiện.');
  rider.recoveryProposal = { tripId: newTripId, status: 'candidate', estimatedArrivalMs: newEtaMs,
    requiresBothConfirmations: true, terms: plan.terms, createdAt: Date.now() };
  persistState();
  return { success: true, rider, proposalOnly: true, previousTripId: rider.matchedTripId, newTripId, carInfo: carInfo(session) };
}
export function findShadowCandidate({ hubId, seatsNeeded, committedAtMs, excludeTripId, nowMs = Date.now(), intentId }) {
  const rider = intentId ? findRider(intentId) : allRiders().find((r) => r.hubId === hubId && r.matchedTripId === excludeTripId && r.seatsNeeded === seatsNeeded);
  if (!rider) return null;
  let best = null;
  for (const session of getActiveCockpitSessions()) {
    if (session.tripId === excludeTripId) continue;
    const plan = planInsertion(session, rider, nowMs);
    if (!plan || plan.pickupAt > committedAtMs) continue;
    if (!best || plan.pickupAt < best.distribution.etaMs) best = { session, distribution: { etaMs: plan.pickupAt }, lateness: { probability: null }, plan };
  }
  return best;
}
