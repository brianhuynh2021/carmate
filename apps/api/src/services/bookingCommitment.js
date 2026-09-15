import crypto from 'node:crypto';
import { cleanPhoneNumber, getStationStationKm, getTravelWindow } from '@carmate/shared';
import { getRawDB, getBookings, getBookingById, getTripById } from '../db/sqliteStore.js';

const CLOSED = new Set(['cancelled', 'completed', 'expired']);
export class CommitmentError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new CommitmentError(message, status); };
const idOf = (booking) => booking.escrowId || booking.id;
const ms = (value) => value == null || value === '' ? NaN : new Date(value).getTime();

export function getBookingRole(user, booking) {
  if (!user) return null;
  const phone = cleanPhoneNumber(user.phone || '');
  const samePhone = (value) => Boolean(phone && phone === cleanPhoneNumber(value || ''));
  const driverId = booking.proposalTerms ? booking.proposalDriverId || booking.driverId : booking.driverId;
  const driverPhone = booking.proposalTerms ? booking.proposalDriverPhone || booking.driverPhone : booking.driverPhone;
  const driver = driverId ? user.id === driverId : samePhone(driverPhone);
  const passengerId = booking.passengerId || (booking.userId !== driverId ? booking.userId : null);
  const passenger = passengerId ? user.id === passengerId : samePhone(booking.passengerPhone || booking.userPhone);
  if (driver && !passenger) return 'driver';
  if (passenger && !driver) return 'passenger';
  return null;
}

export function ownsTrip(user, trip) {
  return Boolean(user && trip && (trip.userId ? user.id === trip.userId :
    (user.phone && cleanPhoneNumber(user.phone) === cleanPhoneNumber(trip.phoneReal || trip.phone || ''))));
}

function interval(value) {
  const terms = value.committedTerms || value.proposalTerms || value;
  const a = getStationStationKm(terms.originHubId || value.originHubId || value.hubId);
  const b = getStationStationKm(terms.destinationHubId || value.destinationHubId);
  return a != null && b != null && a !== b ? [Math.min(a, b), Math.max(a, b)] : [-Infinity, Infinity];
}

function activeReservations(tripId, bookings, excludeId = null) {
  return bookings.filter((b) => b.tripId === tripId && idOf(b) !== excludeId && !CLOSED.has(b.status) &&
    !b.seatReleasedAt && (b.seatReserved === true || (b.seatReserved !== false && (b.bothConfirmed || ['confirmed', 'driver_confirmed', 'zalo_active'].includes(b.status)))));
}

function peakSeats(reservations, segment = [-Infinity, Infinity]) {
  const events = [];
  for (const booking of reservations) {
    const [a, b] = interval(booking);
    const start = Math.max(a, segment[0]);
    const end = Math.min(b, segment[1]);
    if (start >= end) continue;
    const count = Number(booking.committedTerms?.seats ?? booking.seats ?? 1);
    events.push([start, count], [end, -count]);
  }
  // Drop-offs at a stop free seats before pickups at that same stop.
  events.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
  let occupied = 0; let peak = 0;
  for (const [, delta] of events) { occupied += delta; peak = Math.max(peak, occupied); }
  return peak;
}

function capacityOf(trip, reservations) {
  if (Number.isInteger(trip.bookingSeatCapacity) && trip.bookingSeatCapacity >= 0) return trip.bookingSeatCapacity;
  // Existing bookings may already have reduced availableSeats. Capture that
  // inventory once; never infer passenger capacity from total vehicle seats.
  const free = Number(trip.availableSeats ?? trip.seats ?? 0);
  return Math.max(0, Number.isFinite(free) ? free : 0) + peakSeats(reservations);
}

export function getTripAvailableSeatsForSegment(trip, segment = {}, bookings = getBookings()) {
  if (!trip) return 0;
  const reservations = activeReservations(trip.id, bookings);
  return Math.max(0, capacityOf(trip, reservations) - peakSeats(reservations, interval(segment)));
}

function writeBooking(database, booking) {
  database.prepare('UPDATE bookings SET tripId = ?, passengerPhone = ?, status = ?, payload = ? WHERE escrowId = ?')
    .run(booking.tripId || '', cleanPhoneNumber(booking.passengerPhone || ''), booking.status, JSON.stringify(booking), idOf(booking));
  return booking;
}

function writeLinkedRequest(database, booking, state) {
  if (!booking.requestId) return;
  const row = database.prepare('SELECT payload FROM intents WHERE id = ?').get(booking.requestId);
  if (!row) return;
  const intent = JSON.parse(row.payload);
  const updated = { ...intent, status: state, needStatus: booking.needStatus,
    matchedTripId: state === 'matched' ? booking.tripId : null,
    matchedBookingId: state === 'matched' ? idOf(booking) : null };
  if (state === 'pending') updated.declinedTripIds = [...new Set([...(intent.declinedTripIds || []), booking.tripId].filter(Boolean))];
  database.prepare('UPDATE intents SET status = ?, matchedTripId = ?, matchedBookingId = ?, payload = ? WHERE id = ?')
    .run(updated.status, updated.matchedTripId, updated.matchedBookingId, JSON.stringify(updated), intent.id);
}

function refreshInventory(database, trip, capacity, bookings) {
  const availableSeats = Math.max(0, capacity - peakSeats(activeReservations(trip.id, bookings)));
  const updated = { ...trip, bookingSeatCapacity: capacity, availableSeats, updatedAt: Date.now() };
  // A full segment does not mean the vehicle stops running or every segment is full.
  if (updated.status === 'full') updated.status = 'active';
  database.prepare('UPDATE trips SET seats = ?, status = ?, payload = ? WHERE id = ?')
    .run(availableSeats, updated.status, JSON.stringify(updated), trip.id);
}

function timeFromBooking(booking, trip, last = false) {
  const window = getTravelWindow({ ...trip, ...booking });
  return window ? new Date(last ? window.end : window.start).toISOString() : null;
}

export function buildProposalTerms(booking, trip, input = {}) {
  const rawTotal = input.totalPrice ?? booking.totalDeal ?? booking.price ??
    (trip.pricingMode === 'listed' && trip.basePricePerSeat != null ? Number(trip.basePricePerSeat) * Number(booking.seats ?? 1) : null);
  const terms = {
    tripId: trip.id,
    driverId: trip.userId || null,
    vehiclePlate: trip.licensePlate || trip.plate || trip.fullPlate || null,
    vehicleModel: trip.vehicleModel || trip.carModel || trip.carType || null,
    pickupPoint: String(input.pickupPoint || booking.pickupPoint || booking.from || '').trim(),
    dropoffPoint: String(input.dropoffPoint || booking.dropoffPoint || booking.to || '').trim(),
    originHubId: input.originHubId || booking.originHubId || booking.hubId || trip.originHubId || null,
    destinationHubId: input.destinationHubId || booking.destinationHubId || trip.destinationHubId || null,
    pickupStartAt: input.pickupStartAt || booking.pickupStartAt || timeFromBooking(booking, trip),
    pickupEndAt: input.pickupEndAt || booking.pickupEndAt || timeFromBooking(booking, trip, true),
    dropoffLatestAt: input.dropoffLatestAt || booking.latestArrivalAt || null,
    totalPrice: rawTotal == null || rawTotal === '' ? null : Number(rawTotal),
    seats: Number(input.seats ?? booking.seats ?? 1),
    pickupMode: input.pickupMode || trip.pickupMode || 'station',
    detourKm: Number(input.detourKm || 0),
    paymentMethod: 'direct',
    platformFee: 0
  };
  if (!['station','doorstep','hybrid'].includes(terms.pickupMode)) fail('Hình thức đón không hợp lệ.', 400);
  if ((trip.pickupMode || 'station') === 'station' && terms.pickupMode !== 'station') fail('Chủ xe chỉ nhận đón tại trạm.', 400);
  const route = [trip.originHubId, trip.destinationHubId, terms.originHubId, terms.destinationHubId];
  if (route.every(Boolean) && !(route[0] === route[2] && route[1] === route[3])) {
    const [a,b,x,y] = route.map(getStationStationKm);
    if ([a,b,x,y].some(v => v == null) || x === y || Math.sign(b-a) !== Math.sign(y-x) || Math.min(x,y) < Math.min(a,b) || Math.max(x,y) > Math.max(a,b)) fail('Đoạn đón/trả không nằm trong hành trình và hướng đi của xe.', 400);
  }
  if (!terms.pickupPoint || !terms.dropoffPoint || !Number.isFinite(ms(terms.pickupStartAt)) || !Number.isFinite(ms(terms.pickupEndAt)) || ms(terms.pickupEndAt) < ms(terms.pickupStartAt)) {
    fail('Cần thống nhất điểm đón, điểm trả và khoảng giờ đón hợp lệ.', 400);
  }
  if (!Number.isFinite(terms.totalPrice) || terms.totalPrice < 0) fail('Cần nhập tổng giá hai bên sẽ xác nhận; CarMate không tự đặt giá.', 400);
  if (!Number.isInteger(terms.seats) || terms.seats < 1) fail('Số người phải là số nguyên dương.', 400);
  if (!Number.isFinite(terms.detourKm) || terms.detourKm < 0 || terms.detourKm > Number(trip.maxDetourKm || 0)) fail('Đường vòng vượt mức chủ xe cho phép.', 400);
  const deadline = ms(booking.originalDeadlineAt);
  if (Number.isFinite(deadline) && ms(terms.pickupEndAt) > deadline) fail('Phương án vượt hạn giờ của nhu cầu ban đầu. Khách cần đổi yêu cầu trước khi chốt.');
  const arrivalDeadline = ms(booking.latestArrivalAt);
  if (Number.isFinite(arrivalDeadline) && (!Number.isFinite(ms(terms.dropoffLatestAt)) || ms(terms.dropoffLatestAt) > arrivalDeadline)) fail('Phương án vượt hạn đến của nhu cầu ban đầu.');
  return terms;
}

export function proposeAppointment({ bookingId, user, terms = {}, replacementTripId = null, nowMs = Date.now() }) {
  const database = getRawDB();
  return database.transaction(() => {
    const booking = getBookingById(bookingId);
    if (!booking) fail('Không tìm thấy yêu cầu.', 404);
    if (booking.bothConfirmed || ['confirmed', 'boarded', 'completed'].includes(booking.status)) fail('Cuộc hẹn đã chốt được bảo vệ. Hãy xử lý thay đổi trước khi lập đề nghị mới.');
    if (booking.needStatus === 'closed' || booking.status === 'cancelled') fail('Nhu cầu đã kết thúc.');
    const trip = getTripById(replacementTripId || booking.tripId || booking.targetTripId);
    if (!trip || trip.type === 'passenger_request' || !['active', 'full'].includes(trip.status || 'active') || trip.isHidden) fail('Chuyến xe không còn nhận khách.');
    let role = getBookingRole(user, booking);
    if (replacementTripId) {
      if (!booking.needsReplacement) fail('Yêu cầu chưa mở tìm xe thay thế.');
      if (ownsTrip(user, trip)) role = 'driver';
      else if (role !== 'passenger') fail('Bạn không thuộc hai bên của đề nghị này.', 403);
    } else if (!role) fail('Bạn không thuộc hai bên của chuyến đi.', 403);
    const proposalTerms = buildProposalTerms(booking, trip, terms);
    if (ms(proposalTerms.pickupEndAt) < nowMs) fail('Khoảng giờ đón đã hết.');
    if (getTripAvailableSeatsForSegment(trip, proposalTerms) < proposalTerms.seats) fail('Xe không còn đủ ghế trên đoạn cần đi.');
    const updated = {
      ...booking, status: 'pre_confirmed', bothConfirmed: false,
      proposalTerms, proposalVersion: crypto.randomUUID(),
      proposalDriverId: trip.userId || null, proposalDriverPhone: trip.phoneReal || trip.phone || '',
      preConfirmedBy: role, preConfirmedAt: new Date(nowMs).toISOString(),
      preConfirmedExpiresAt: new Date(Math.min(nowMs + 15 * 60000, ms(proposalTerms.pickupEndAt))).toISOString(),
      proposalIsReplacement: Boolean(replacementTripId),
      needStatus: 'open', seatReserved: false, supportDispatched: false
    };
    return writeBooking(database, updated);
  })();
}

export function confirmAppointment({ bookingId, user, proposalVersion, nowMs = Date.now() }) {
  const database = getRawDB();
  return database.transaction(() => {
    const booking = getBookingById(bookingId);
    if (!booking) fail('Không tìm thấy yêu cầu.', 404);
    const role = getBookingRole(user, { ...booking, driverId: booking.proposalDriverId || booking.driverId, driverPhone: booking.proposalDriverPhone || booking.driverPhone });
    if (!role) fail('Bạn không thuộc hai bên của đề nghị này.', 403);
    if (!proposalVersion || proposalVersion !== booking.proposalVersion) fail('Đề nghị đã thay đổi. Hãy xem lại điểm, giờ và giá trước khi xác nhận.');
    if (booking.bothConfirmed && booking.status === 'confirmed') return booking;
    if (booking.status !== 'pre_confirmed' || !booking.proposalTerms || role === booking.preConfirmedBy) fail('Cần bên còn lại xác nhận cùng đề nghị.');
    if (ms(booking.preConfirmedExpiresAt) <= nowMs || booking.needStatus === 'closed') fail('Đề nghị đã hết hạn hoặc nhu cầu đã kết thúc.');
    const terms = booking.proposalTerms;
    const trip = getTripById(terms.tripId);
    if (!trip || trip.isHidden || !['active', 'full'].includes(trip.status || 'active')) fail('Chuyến xe không còn nhận khách.');
    if ((trip.userId || null) !== terms.driverId || (trip.licensePlate || trip.plate || trip.fullPlate || null) !== terms.vehiclePlate || (trip.vehicleModel || trip.carModel || trip.carType || null) !== terms.vehicleModel) fail('Thông tin chủ xe hoặc xe đã thay đổi. Cần gửi lại đề nghị để hai bên xem và xác nhận.');
    buildProposalTerms(booking, trip, terms);
    const all = getBookings();
    const sameNeed = all.find((b) => idOf(b) !== bookingId && b.requestId && b.requestId === booking.requestId && b.bothConfirmed && !CLOSED.has(b.status));
    if (sameNeed) fail('Nhu cầu này đã có một cuộc hẹn được xác nhận.');
    const reservations = activeReservations(trip.id, all, bookingId);
    const capacity = capacityOf(trip, reservations);
    if (capacity - peakSeats(reservations, interval(terms)) < terms.seats) fail('Ghế trên đoạn này vừa được nhận. Hãy chọn phương án khác.');
    const updated = {
      ...booking, tripId: trip.id, targetTripId: trip.id,
      driverId: trip.userId || booking.proposalDriverId, driverPhone: trip.phoneReal || trip.phone || booking.proposalDriverPhone,
      status: 'confirmed', bothConfirmed: true, confirmedBy: role, confirmedAt: new Date(nowMs).toISOString(),
      committedTerms: { ...terms }, totalDeal: terms.totalPrice, seats: terms.seats,
      seatReserved: true, seatReleasedAt: null, needsReplacement: false, needStatus: 'matched',
      recoveryCandidates: [], supportDispatched: false, salvageInfo: null,
      rescueMode: false, rescueActivatedAt: null, driverConfirmed: false, readyConfirmedAt: null, readyAskedAt: null, readyRemindedAt: null
    };
    writeBooking(database, updated);
    writeLinkedRequest(database, updated, 'matched');
    for (const sibling of all) {
      if (idOf(sibling) !== bookingId && sibling.requestId === booking.requestId && !sibling.bothConfirmed && !CLOSED.has(sibling.status)) writeBooking(database, { ...sibling, status: 'expired', needStatus: 'closed', needsReplacement: false, proposalTerms: null, proposalVersion: null, closedReason: 'another_appointment_confirmed' });
    }
    refreshInventory(database, trip, capacity, [...reservations, updated]);
    return updated;
  })();
}

export function cancelAppointment({ bookingId, user, reason = '', keepNeed = false, nowMs = Date.now() }) {
  const database = getRawDB();
  return database.transaction(() => {
    const booking = getBookingById(bookingId);
    if (!booking) fail('Không tìm thấy yêu cầu.', 404);
    const role = getBookingRole(user, booking);
    if (!role) fail('Bạn không thuộc hai bên của chuyến đi.', 403);
    if (booking.status === 'completed' || booking.status === 'boarded') fail('Khách đã lên xe; cần xử lý sự cố hành trình, không hủy việc đón.');
    if (booking.needStatus === 'closed') return booking;
    if (role === 'driver' && booking.needsReplacement && !booking.seatReserved) return booking;
    const all = getBookings();
    const trip = getTripById(booking.tripId);
    const reservations = trip ? activeReservations(trip.id, all) : [];
    const capacity = trip ? capacityOf(trip, reservations) : 0;
    const remainOpen = role === 'driver' || keepNeed;
    const updated = {
      ...booking, status: remainOpen ? 'inquiring' : 'cancelled', bothConfirmed: false,
      cancelledAt: new Date(nowMs).toISOString(), cancelledBy: role, cancelReason: reason,
      seatReserved: false, seatReleasedAt: booking.seatReleasedAt || new Date(nowMs).toISOString(),
      needsReplacement: remainOpen, needStatus: remainOpen ? 'open' : 'closed',
      proposalTerms: null, proposalVersion: null, preConfirmedExpiresAt: null,
      supportDispatched: false, salvageInfo: null, recoveryCandidates: [],
      rescueMode: remainOpen, commitmentHistory: [...(booking.commitmentHistory || []), ...(booking.committedTerms ? [{ terms: booking.committedTerms, endedAt: new Date(nowMs).toISOString(), reason }] : [])],
      committedTerms: null,
      waitingElapsedMs: Math.max(0, nowMs - (ms(booking.originalRequestedAt) || Number(booking.createdAt) || nowMs))
    };
    writeBooking(database, updated);
    if (trip) refreshInventory(database, trip, capacity, all.filter((b) => idOf(b) !== bookingId));
    writeLinkedRequest(database, updated, remainOpen ? 'pending' : 'cancelled');
    if (!remainOpen && booking.requestId) {
      for (const sibling of all) {
        if (idOf(sibling) === bookingId || sibling.requestId !== booking.requestId || sibling.bothConfirmed || CLOSED.has(sibling.status)) continue;
        writeBooking(database, { ...sibling, status: 'cancelled', needStatus: 'closed', needsReplacement: false, proposalTerms: null, proposalVersion: null, supportDispatched: false });
      }
    }
    return updated;
  })();
}

export function completeAppointment({ bookingId, user, nowMs = Date.now() }) {
  const database = getRawDB();
  return database.transaction(() => {
    const booking = getBookingById(bookingId);
    if (!booking) fail('Không tìm thấy chuyến.', 404);
    if (!getBookingRole(user, booking)) fail('Bạn không thuộc hai bên của chuyến đi.', 403);
    if (booking.status === 'completed') return booking;
    if (!booking.bothConfirmed || !['confirmed', 'boarded', 'driver_confirmed'].includes(booking.status)) fail('Chuyến chưa được hai bên xác nhận.');
    const trip = getTripById(booking.tripId);
    const all = getBookings();
    const capacity = trip ? capacityOf(trip, activeReservations(trip.id, all)) : 0;
    const updated = { ...booking, status: 'completed', completedAt: new Date(nowMs).toISOString(), needStatus: 'closed', needsReplacement: false, seatReserved: false, seatReleasedAt: new Date(nowMs).toISOString() };
    writeBooking(database, updated);
    if (trip) refreshInventory(database, trip, capacity, all.filter((b) => idOf(b) !== bookingId));
    writeLinkedRequest(database, updated, 'completed');
    return updated;
  })();
}

export function createStationAppointmentProposal({ rider, trip, user, terms }) {
  if (!ownsTrip(user, trip)) fail('Chỉ chủ xe của chuyến được đề nghị đón.', 403);
  const database = getRawDB();
  return database.transaction(() => {
    const bookingId = `STATION-${rider.intentId}`;
    let booking = getBookingById(bookingId);
    if (!booking) {
      booking = {
        escrowId: bookingId, tripId: trip.id, requestId: rider.intentId, source: 'station',
        passengerId: rider.userId, userId: rider.userId, passengerPhone: rider.phone, passengerName: rider.name,
        driverId: trip.userId, driverPhone: trip.phoneReal || trip.phone, from: rider.hubName, to: rider.destinationName,
        originHubId: rider.hubId, destinationHubId: rider.destinationHubId, seats: rider.seatsNeeded,
        originalRequestedAt: rider.originalRequestedAt, originalDeadlineAt: rider.originalDeadlineAt,
        latestArrivalAt: rider.latestArrivalAt, status: 'inquiring', needStatus: 'open', bothConfirmed: false,
        seatReserved: false, createdAt: Date.now(), messages: []
      };
      database.prepare('INSERT INTO bookings (escrowId,tripId,passengerPhone,status,createdAt,payload) VALUES (?,?,?,?,?,?)')
        .run(bookingId, trip.id, rider.phone, booking.status, booking.createdAt, JSON.stringify(booking));
    }
    if (booking.tripId !== trip.id && !booking.bothConfirmed && !booking.needsReplacement) {
      booking = writeBooking(database, { ...booking, tripId: trip.id, driverId: trip.userId, driverPhone: trip.phoneReal || trip.phone, status: 'inquiring', proposalTerms: null, proposalVersion: null });
    }
    const proposal = proposeAppointment({ bookingId, user, terms, replacementTripId: booking.needsReplacement ? trip.id : null });
    return proposal;
  })();
}

export function markAppointmentBoarded({ bookingId, user, nowMs = Date.now() }) {
  const database = getRawDB();
  return database.transaction(() => {
    const booking = getBookingById(bookingId);
    if (!booking) fail('Không tìm thấy cuộc hẹn.', 404);
    if (getBookingRole(user, booking) !== 'driver') fail('Chỉ chủ xe được xác nhận đón khách.', 403);
    if (booking.status === 'boarded') return booking;
    if (!booking.bothConfirmed || booking.status !== 'confirmed') fail('Cuộc hẹn chưa được hai bên xác nhận.');
    return writeBooking(database, { ...booking, status: 'boarded', boardedAt: new Date(nowMs).toISOString() });
  })();
}
