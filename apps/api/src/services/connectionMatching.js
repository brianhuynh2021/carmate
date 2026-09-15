import { getStationStationKm, getVirtualHubById, getTravelWindow, normalizeConnectionTerms, calculateDistanceKm, computeEtaDistribution } from '@carmate/shared';
import { getTripAvailableSeatsForSegment } from './bookingCommitment.js';

const hubId = (record, end = false) => end ? record.destinationHubId || record.destHub : record.originHubId || record.hubId || record.originHub;

export function connectionSegment(trip, request) {
  const a = hubId(trip), b = hubId(trip, true), x = hubId(request), y = hubId(request, true);
  if (!a || !b || !x || !y || x === y) return null;
  if (a === x && b === y) return { originHubId: x, destinationHubId: y, offsetMinutes: 0, exactRoute: true };
  const positions = [a,b,x,y].map(getStationStationKm);
  if (positions.some(p => p == null)) return null;
  const [s0,s1,sx,sy] = positions;
  if (Math.sign(s1-s0) !== Math.sign(sy-sx) || Math.min(sx,sy) < Math.min(s0,s1) || Math.max(sx,sy) > Math.max(s0,s1)) return null;
  const eta = computeEtaDistribution({ currentS: Math.min(s0,sx), targetS: Math.max(s0,sx) });
  const offsetMinutes = s0 === sx ? 0 : (eta.valid ? Math.ceil(eta.muSeconds/60) : null);
  if (offsetMinutes == null) return null;
  return { originHubId: x, destinationHubId: y, offsetMinutes, exactRoute: false };
}

// Feasibility is evaluated before ranking. Ranking is only among current
// proposals; it cannot promise a future vehicle or silently replace a commitment.
export function evaluateConnection(trip, request, { nowMs = Date.now(), bookings = [] } = {}) {
  if (!trip || !request || trip.isHidden || trip.isBanned || !['active','full'].includes(trip.status || 'active')) return null;
  if (trip.userId && trip.userId === request.userId) return null;
  if (Array.isArray(request.declinedTripIds) && request.declinedTripIds.includes(trip.id)) return null;
  const segment = connectionSegment(trip, request);
  if (!segment) return null;
  const seats = Number(request.seatsNeeded ?? request.seats ?? 1);
  if (!Number.isInteger(seats) || seats < 1 || getTripAvailableSeatsForSegment(trip, segment, bookings) < seats) return null;
  const departure = getTravelWindow(trip, nowMs);
  const desired = getTravelWindow(request, nowMs);
  if (!departure || !desired) return null;
  const offset = segment.offsetMinutes*60000;
  const start = Math.max(nowMs, desired.start, departure.start+offset);
  const deadline = Number(request.originalDeadlineAt || request.expiresAt || desired.end);
  const end = Math.min(desired.end, departure.end+offset, Number.isFinite(deadline) ? deadline : desired.end);
  if (start > end) return null;
  let terms;
  try { terms = normalizeConnectionTerms(trip); } catch { return null; }
  const requestedMode = request.pickupMode || (request.isDoorstep ? 'doorstep' : 'station');
  if (requestedMode === 'doorstep' && terms.pickupMode === 'station') return null;
  let detourKm = 0;
  let addressUnverified = false;
  if (requestedMode === 'doorstep') {
    const hub = getVirtualHubById(segment.originHubId);
    const lat = Number(request.doorstepLat), lng = Number(request.doorstepLng);
    // Without coordinates, the owner must agree the address; do not invent a travel time.
    if (!hub || request.doorstepLat == null || request.doorstepLng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      addressUnverified = true;
    } else {
      detourKm = calculateDistanceKm(hub.lat, hub.lng, lat, lng) * 2;
      if (detourKm > terms.maxDetourKm) return null;
    }
  }
  const totalPrice = terms.basePricePerSeat == null ? null : terms.basePricePerSeat*seats;
  if (request.maxPrice != null && totalPrice != null && totalPrice > Number(request.maxPrice)) return null;
  const waitMinutes = Math.max(0,(start-Math.max(nowMs,desired.start))/60000);
  const preference = request.matchingPreference || 'balanced';
  const knownPrice = totalPrice != null;
  const score = preference === 'lowest_price'
    ? (knownPrice ? totalPrice/1000 : 100000) + waitMinutes/1000
    : preference === 'earliest'
      ? waitMinutes*100 + (knownPrice ? totalPrice/100000 : 10)
      : waitMinutes + detourKm*5 + (knownPrice ? totalPrice/10000 : 50);
  return { tripId: trip.id, ...segment, pickupStartAt: new Date(start).toISOString(), pickupEndAt: new Date(end).toISOString(),
    pricingMode: terms.pricingMode, pricePerSeat: terms.basePricePerSeat, totalPrice, detourKm,
    score, addressUnverified, requiresPickupAgreement: requestedMode === 'doorstep' || terms.pickupMode !== 'station',
    reason: addressUnverified ? 'Cùng hướng và khoảng giờ. Chủ xe cần kiểm tra địa chỉ, đường vòng và giờ đón tận nơi trước khi đề nghị.' : knownPrice ? 'Phù hợp hướng đi, khoảng giờ và số ghế; xếp theo thời gian và giá.' : 'Phù hợp hướng đi và khoảng giờ; cần chủ xe báo tổng giá.' };
}
