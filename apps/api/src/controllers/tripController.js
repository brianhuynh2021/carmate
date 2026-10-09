import {
  getTrips,
  getPaginatedTrips,
  getTripById,
  addTrip,
  updateTrip,
  deleteTrip,
  getDB,
  getUserById,
  getUserByPhone,
  isUserDeactivated,
  getBookings,
} from '../db/sqliteStore.js';
import { runBatchMatchingEpoch } from '../services/batchMatchingEngine.js';
import { cleanPhoneNumber, sanitizeVehicleCapacityAndSeats, computeTrustScore, toPublicAlias, isValidVietnamesePhone, isLikelyFakePhone, normalizeConnectionTerms, normalizeTravelDate, getTravelWindow, getStationStationKm } from '@carmate/shared';
import { cancelAppointment } from '../services/bookingCommitment.js';
import { assertOperatorManager, getTripOperatorAttribution } from '../services/operatorProfiles.js';

/**
 * Mask personally identifiable information (PII Protection - Decree 13/2023/ND-CP)
 * Only return the real phone number (phoneReal) to the post's owner or an Admin.
 */
/**
 * Aggregate the trip poster's REAL average star rating from the reviews submitted
 * after the trip (booking.reviews). Only returned when there is at least 1 real review —
 * do not fabricate a default 5 stars for someone nobody has rated.
 */
function resolveRating(trip) {
  try {
    const db = getDB();
    const bookings = db.bookings || [];
    const tripPhone = cleanPhoneNumber(trip.phoneReal || trip.phone || '');
    const isDriverTrip = trip.type === 'driver_offer';
    // A driver's trip -> take the rating passengers gave the driver, and vice versa
    const wantedTargetRole = isDriverTrip ? 'driver' : 'passenger';

    const scores = [];
    for (const b of bookings) {
      const reviews = Array.isArray(b.reviews) ? b.reviews : [];
      if (reviews.length === 0) continue;

      const ownerId = isDriverTrip ? b.driverId : b.userId || b.creatorId;
      const ownerPhone = cleanPhoneNumber(
        (isDriverTrip ? b.driverPhone : b.passengerPhone || b.userPhone || b.creatorPhone) || ''
      );
      const sameUser =
        (trip.userId && ownerId && trip.userId === ownerId) || (tripPhone && ownerPhone && tripPhone === ownerPhone);
      if (!sameUser) continue;

      for (const r of reviews) {
        if (r.targetRole !== wantedTargetRole) continue;
        const n = Number(r.rating);
        if (Number.isFinite(n) && n >= 1 && n <= 5) scores.push(n);
      }
    }

    if (scores.length === 0) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { rating: Math.round(avg * 10) / 10, ratingCount: scores.length };
  } catch {
    return null;
  }
}

/**
 * Compute the trip poster's trust score to display on the feed.
 * The score is derived from the real profile (citizen ID card (CCCD), driver's license (GPLX), license plate, vehicle photos, number of trips taken,
 * number of times reported late/cancelled) — not a default star count.
 */
function resolveTrustScore(trip) {
  try {
    const user =
      (trip.userId && getUserById(trip.userId)) ||
      (trip.phoneReal && getUserByPhone(trip.phoneReal)) ||
      (trip.phone && getUserByPhone(trip.phone)) ||
      null;
    if (!user) return null;

    const vehicle = user.vehicle || {
      plate: trip.licensePlate || trip.carPlate,
      model: trip.carType,
      hasVerifiedPhotos: Boolean(trip.hasCarPhotos || (trip.carPhotos || []).length >= 3),
      photos: trip.carPhotos || []
    };
    const history = {
      completedTrips: Number(user.completedTrips || 0),
      rating: Number(user.rating || 5.0),
      lateReports: Number(user.lateReports || 0),
      cancelReports: Number(user.cancelReports || 0),
      mismatchReports: Number(user.mismatchReports || 0)
    };

    const calc = computeTrustScore(user, vehicle, history, null);
    return { score: calc.score, level: calc.level?.label || null, levelId: calc.level?.id || null };
  } catch {
    return null;
  }
}

export { toPublicAlias };

export function sanitizeTripForPublic(trip, reqUser) {
  if (!trip) return null;
  const tripPhone = cleanPhoneNumber(trip.phoneReal || trip.phone || '');
  const isOwner = Boolean(
    (reqUser && (reqUser.role === 'admin' || reqUser.role === 'super_admin')) ||
    (reqUser && reqUser.id && (reqUser.id === trip.userId || reqUser.id === trip.creatorId))
  );

  const sanitized = { ...trip };
  Object.assign(sanitized, getTripOperatorAttribution(trip));

  // Normalize phoneMasked in the form 098***2233
  const rawPhone = trip.phoneReal || trip.phone || '';
  if (rawPhone && (!sanitized.phoneMasked || sanitized.phoneMasked === rawPhone)) {
    const cleaned = cleanPhoneNumber(rawPhone);
    sanitized.phoneMasked = cleaned.length >= 7 ? `${cleaned.slice(0, 3)}***${cleaned.slice(-4)}` : '098***2233';
  }

  // Normalize the public display alias (Driver CX-xxx / Passenger KX-xxx)
  sanitized.publicName = toPublicAlias(sanitized);

  // Thoroughly hide phoneReal if the viewer is not the owner or an admin
  if (!isOwner) {
    delete sanitized.phoneReal;
    delete sanitized.phone;
    if (sanitized.licensePlate && typeof sanitized.licensePlate === 'string') {
      sanitized.licensePlate = sanitized.licensePlate.replace(/\d{2}$/, 'xx');
    }

    // Hide real identity: the public feed may only see an alias in the form "Chủ xe CX-xxx" (driver CX-xxx).
    // The real name is only revealed to the two parties after the trip is successfully matched (via booking).
    delete sanitized.driverName;
    delete sanitized.contactName;
    delete sanitized.author;
    delete sanitized.fullName;
    delete sanitized.name;
    delete sanitized.email;
  }

  const contactIsPublic = trip.type === 'driver_offer' && trip.publicContactConsent === true;
  sanitized.publicContactPhone = contactIsPublic ? tripPhone : null;
  sanitized.publicContactName = contactIsPublic ? (trip.publicContactName || trip.contactName || 'Chủ xe') : null;
  if (!contactIsPublic) delete sanitized.publicPhone;
  const rated = resolveRating(trip);
  sanitized.rating = rated?.rating ?? null;
  sanitized.ratingCount = rated?.ratingCount ?? 0;
  sanitized.lastUpdatedAt = trip.updatedAt || trip.createdAt || null;
  Object.assign(sanitized, normalizeConnectionTerms(trip));

  // Trust score displayed on the feed (in place of the default star count)
  const trust = resolveTrustScore(trip);
  if (trust) {
    sanitized.trustScore = trust.score;
    sanitized.trustLevel = trust.level;
    sanitized.trustLevelId = trust.levelId;
  }

  return sanitized;
}

/**
 * GET /api/trips - Get the list of trips with filters
 */
export function listTrips(req, res) {
  try {
    const { type = 'all', routeCategory, direction, timeSlot, q, includeExpired, mine, page = 1, limit = 50 } = req.query;

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const offset = (p - 1) * l;

    if (mine && !req.user?.id) return res.status(401).json({success:false,error:'Đăng nhập để xem chuyến của bạn.'});
    const owned = mine ? getTrips({type, includeHidden:true, includeExpired: includeExpired === 'true'}).filter(t => t.userId === req.user.id) : null;
    const { total, trips } = owned ? {total:owned.length,trips:owned.slice(offset,offset+l)} : getPaginatedTrips({
      type,
      routeCategory,
      direction,
      timeSlot,
      q,
      includeExpired: includeExpired === 'true',
      limit: l,
      offset
    });

    const sanitizedList = trips.map((t) => sanitizeTripForPublic(t, req.user));
    const db = getDB();

    return res.status(200).json({
      success: true,
      total,
      page: p,
      limit: l,
      data: {
        all: sanitizedList,
        driverOffers: sanitizedList.filter((t) => t.type === 'driver_offer'),
        passengerRequests: sanitizedList.filter((t) => t.type === 'passenger_request'),
        totalDrivers: db.driverOffers.length,
        totalPassengers: db.passengerRequests.length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/trips/:id - Trip details
 */
export function getTrip(req, res) {
  try {
    const { id } = req.params;
    const trip = getTripById(id);

    if (!trip) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến xe' });
    }

    const sanitized = sanitizeTripForPublic(trip, req.user);

    // If the viewer is the driver who owns the trip or an Admin: load the list of booked passengers (Seat Manifest)
    const isOwner = Boolean(
      (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) ||
      (req.user && req.user.id && (req.user.id === trip.userId || req.user.id === trip.creatorId))
    );

    if (isOwner) {
      const allBookings = getBookings();
      const tripBookings = allBookings.filter((b) => {
        return (
          (b.targetTripId === trip.id || b.tripId === trip.id) &&
          b.status !== 'cancelled'
        );
      });
      sanitized.manifest = tripBookings.map((b, idx) => ({
        seatIndex: idx + 1,
        bookingId: b.id || b.escrowId,
        passengerName: b.passengerName || b.contactName || b.userName || 'Người đi cùng',
        passengerPhone: b.passengerPhone || b.contactPhone || b.userPhone || '',
        pickupSpot: b.pickupSpot || b.from || b.fromLocation || 'Trạm đón dọc tuyến',
        dropoffSpot: b.dropoffSpot || b.to || b.toLocation || 'Trạm trả dọc tuyến',
        seatsBooked: Number(b.seatsBooked || b.seats || 1),
        status: b.status || 'inquiring',
        bothConfirmed: b.bothConfirmed === true,
        committedTerms: b.committedTerms || null,
        createdAt: b.createdAt
      }));
      sanitized.bookedSeatsCount = tripBookings.filter(b => (b.bothConfirmed || b.seatReserved) && !['completed','expired','cancelled'].includes(b.status)).reduce((sum, b) => sum + Number(b.seatsBooked || b.seats || 1), 0);
    }

    return res.status(200).json({ success: true, data: sanitized });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/trips - Create a new trip (driver or passenger)
 */
export async function createTrip(req, res) {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, error: 'Đăng nhập để đăng và quản lý chuyến.' });
    const body = { ...req.body, userId: req.user.id, updatedAt: Date.now(), status: 'active' };
    let operatorProfile = null;
    for (const key of ['id','creatorId','isBanned','isHidden','isCccdVerified','isGplxVerified','isPhoneVerified','trustScore','completedTrips','rating','ratingCount','bookingSeatCapacity','operatorName','operatorEntryMode','assistedEntryId','operatorAuthorization']) delete body[key];
    if (body.operatorId) {
      const operator = assertOperatorManager(body.operatorId, req.user);
      operatorProfile = operator;
      if (operator.status !== 'published' || body.type === 'passenger_request') {
        return res.status(400).json({ success: false, error: 'Chỉ đăng chuyến dưới hồ sơ nhà xe đã được xuất bản và nhận quản lý.' });
      }
      body.operatorName = operator.name;
      body.operatorEntryMode = req.operatorAssistedEntryId ? 'assisted' : 'owner';
      if (req.operatorAssistedEntryId) body.assistedEntryId = req.operatorAssistedEntryId;
    } else {
      delete body.operatorId;
    }

    // Basic validation
    if (!body || !body.from || !body.to) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin bắt buộc: điểm đón (from) hoặc điểm đến (to)'
      });
    }

    body.routeCategory = body.routeCategory || 'Tuyến Liên Tỉnh';

    if (!body.phoneReal) {
      return res.status(400).json({
        success: false,
        error: 'Cần cung cấp số điện thoại thật để liên hệ đón nhau'
      });
    }

    const approvedBusinessContact = operatorProfile?.kind === 'business'
      && cleanPhoneNumber(body.phoneReal) === cleanPhoneNumber(operatorProfile.contactPhone)
      && /^\d{8,15}$/.test(cleanPhoneNumber(operatorProfile.contactPhone));
    if (!approvedBusinessContact && (!isValidVietnamesePhone(body.phoneReal) || isLikelyFakePhone(body.phoneReal))) {
      return res.status(400).json({
        success: false,
        error: 'Số điện thoại không hợp lệ hoặc có dấu hiệu số ảo. Vui lòng cung cấp số điện thoại thật để đối tác liên hệ đón bạn.'
      });
    }

    if (body.type !== 'passenger_request') {
      body.type = 'driver_offer';
      Object.assign(body, normalizeConnectionTerms(body));
      const capacity = Number(body.capacity ?? body.vehicleSeats);
      const seats = Number(body.availableSeats ?? body.seats);
      if (!Number.isInteger(capacity) || capacity < 2 || capacity > 55 || !Number.isInteger(seats) || seats < 1 || seats > capacity - 1) {
        return res.status(400).json({ success: false, error: 'Số ghế trống phải nằm trong sức chứa xe, trừ ghế người lái.' });
      }
      if (!String(body.carType || '').trim() || !String(body.licensePlate || '').trim()) {
        return res.status(400).json({ success: false, error: 'Bổ sung loại xe và biển số thật trước khi đăng chuyến.' });
      }
      body.capacity = capacity;
      body.availableSeats = seats;
      body.bookingSeatCapacity = seats;
      body.publicContactName = String(body.publicContactName || req.user.name || 'Chủ xe').slice(0, 100);
      const fromKm = getStationStationKm(body.originHubId), toKm = getStationStationKm(body.destinationHubId);
      if (fromKm != null && toKm != null && fromKm !== toKm) body.direction = fromKm < toKm ? 'binh_phuoc_to_tphcm' : 'tphcm_to_binh_phuoc';
      body.date = normalizeTravelDate(body.date);
      if (!body.date || !getTravelWindow(body) || getTravelWindow(body).end <= Date.now()) {
        return res.status(400).json({ success: false, error: 'Chọn ngày và giờ chạy còn hiệu lực.' });
      }
    }

    // Check whether the account is restricted from posting or has been disabled (3-day Grace Period rule)
    const posterPhone = cleanPhoneNumber(body.phoneReal || '');
    const posterUser = (req.user?.id ? getUserById(req.user.id) : null) || (posterPhone ? getUserByPhone(posterPhone) : null);
    if (posterUser) {
      if (isUserDeactivated(posterUser)) {
        return res.status(403).json({
          success: false,
          isDeactivated: true,
          error: '⛔ Tài khoản của bạn đã bị vô hiệu hóa vĩnh viễn do hết thời hạn ân hạn khiếu nại (3 ngày).'
        });
      }
      if (posterUser.isBanned) {
        return res.status(403).json({
          success: false,
          isBanned: true,
          error: '⛔ Tài khoản của bạn đang bị hạn chế đăng bài do vi phạm quy chế. Bạn có 3 ngày ân hạn để mở Hộp thư khiếu nại với CSKH trước khi tài khoản bị vô hiệu hóa.'
        });
      }
    }

    // MIT INVARIANT: safe seat limit per vehicle inspection regulations (prevents overloading)
    if (body.type === 'driver_offer' && body.availableSeats) {
      const isTruck =
        body.vehicleType === 'truck_light' ||
        body.isCargoVehicle ||
        /xe\s*tải|tải\s*nhẹ|k200|k250|porter|h150|qkr/i.test(body.carType || '');
      if (isTruck && Number(body.availableSeats) > 1) {
        return res.status(400).json({
          success: false,
          error: 'Xe tải nhẹ chỉ được phép nhận tối đa 1 người đi cùng (ghế phụ cabin) theo quy định đăng kiểm.'
        });
      }
    }

    // Normalize the vehicle payload and valid passenger seat count (overload prevention, Decree 100/2019)
    if (body.type === 'driver_offer' || body.availableSeats) {
      const rawCapacity =
        body.vehicleType === 'truck_light' || body.isCargoVehicle
          ? 'truck_light'
          : body.vehicleType === 'pickup' || body.hasCargoBed
            ? 'pickup'
            : body.capacity || body.vehicleSeats || (Number(body.availableSeats) > 4 ? 7 : 5);
      const { capacity, seats, vehicleType, hasCargoBed, isCargoVehicle } = sanitizeVehicleCapacityAndSeats(
        rawCapacity,
        body.availableSeats
      );
      body.capacity = capacity;
      body.availableSeats = seats;
      if (vehicleType) body.vehicleType = vehicleType;
      if (hasCargoBed !== undefined) body.hasCargoBed = hasCargoBed;
      if (isCargoVehicle !== undefined) body.isCargoVehicle = isCargoVehicle;
    }

    if (body.isCargoOnly) {
      body.isCargoOnly = true;
    }
    if (body.acceptsParcel || body.vehicleType === 'truck_light' || body.vehicleType === 'pickup' || body.hasCargoBed || body.isCargoVehicle) {
      body.acceptsParcel = true;
    }

    if (req.user) {
      body.userId = req.user.id || req.user.userId || body.userId;
      if (req.user.telegramId) body.telegramId = req.user.telegramId;
    }

    // NO-SCHEDULE-OVERLAP INVARIANT: a driver may not post a trip overlapping a time slot they already have
    if (body.type === 'driver_offer') {
      const existingActiveTrips = getTrips({ type: 'drivers', includeHidden: false }).filter((t) => {
        if (t.status && t.status !== 'active') return false;
        const samePhone = posterPhone && cleanPhoneNumber(t.phoneReal || t.phone || '') === posterPhone;
        const sameUserId = req.user?.id && (t.userId === req.user.id);
        return samePhone || sameUserId;
      });

      const newDate = body.date || 'Hôm nay';
      const timeRaw = body.time || (body.timeSlot && body.timeSlot.split('-')[0]) || '';
      const timeMatch = String(timeRaw).match(/^(\d{1,2}):(\d{2})/);
      const newMinutes = timeMatch ? parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10) : null;

      for (const t of existingActiveTrips) {
        const tDate = normalizeTravelDate(t.date);
        if (tDate === newDate && newMinutes != null && String(t.licensePlate || '').replace(/[^a-z0-9]/gi,'').toUpperCase() === String(body.licensePlate || '').replace(/[^a-z0-9]/gi,'').toUpperCase()) {
          const tTimeRaw = t.time || (t.timeSlot && t.timeSlot.split('-')[0]) || '';
          const tTimeMatch = String(tTimeRaw).match(/^(\d{1,2}):(\d{2})/);
          if (tTimeMatch) {
            const tMinutes = parseInt(tTimeMatch[1], 10) * 60 + parseInt(tTimeMatch[2], 10);
            if (Math.abs(newMinutes - tMinutes) < 60) {
              return res.status(400).json({
                success: false,
                error: `Bạn đã có chuyến xe (#${t.id}) khởi hành lúc ${tTimeRaw} cùng ngày. Vui lòng quản lý chuyến hiện tại hoặc chọn khung giờ khác cách ít nhất 1 tiếng.`
              });
            }
          }
        }
      }
    }

    const newTrip = await addTrip(body);

    await runBatchMatchingEpoch().catch(err => console.warn('[Matching]', err.message));

    return res.status(201).json({
      success: true,
      message: 'Đăng chuyến thành công',
      data: newTrip
    });
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/trips/:id/status - Update the trip status
 */
export async function updateStatus(req, res) {
  const status = req.body?.status;
  if (status === 'cancelled') return deleteTripHandler(req, res);
  if (!['active', 'full', 'completed', 'closed'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Trạng thái chuyến không hợp lệ.' });
  }
  const trip = getTripById(req.params.id);
  if (!trip) return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến.' });
  if (['cancelled', 'completed', 'closed'].includes(trip.status)) return res.status(409).json({ success: false, error: 'Chuyến đã kết thúc. Đăng chuyến mới để tiếp tục.' });
  const hasCommitment = getBookings().some(b => b.tripId === trip.id && (b.bothConfirmed || b.seatReserved) && !['cancelled','completed','expired'].includes(b.status));
  if (hasCommitment && ['completed','closed'].includes(status)) return res.status(409).json({ success: false, error: 'Hoàn tất các cuộc hẹn đang mở trước khi kết thúc chuyến.' });
  const updated = await updateTrip(trip.id, { status, updatedAt: Date.now() });
  return res.json({ success: true, data: updated });
}

/**
 * PUT /api/trips/:id - Update trip information
 */
// Listing details may change before agreement. Confirmed appointments retain
// their route, vehicle, pickup conditions and their own immutable price snapshot.
const MATRIX_COORDINATE_FIELDS = Object.freeze([
  { key: 'originHubId', label: 'trạm đón' },
  { key: 'destinationHubId', label: 'trạm trả' },
  { key: 'from', label: 'điểm đi' },
  { key: 'to', label: 'điểm đến' },
  { key: 'pickupSpot', label: 'điểm đón cụ thể' },
  { key: 'dropoffSpot', label: 'điểm trả cụ thể' },
  { key: 'date', label: 'ngày khởi hành' },
  { key: 'timeSlot', label: 'khe giờ khởi hành' },
  { key: 'time', label: 'giờ khởi hành' }
]);

/** Whether two values are actually different (ignoring case / whitespace differences). */
function isMeaningfulChange(before, after) {
  if (after === undefined) return false;
  const a = String(before ?? '').trim().toLowerCase();
  const b = String(after ?? '').trim().toLowerCase();
  return a !== b;
}

/**
 * Apply the coordinate invariant + price invariant to a trip update request.
 * Returns { error } if it must be rejected, or { updates } once sanitized.
 */
function enforceTripInvariants(existingTrip, rawUpdates) {
  const updates = { ...rawUpdates };

  const allBookings = getBookings();
  const activeBookings = allBookings.filter(
    (b) => (b.tripId === existingTrip.id || b.targetTripId === existingTrip.id) && !['cancelled','completed'].includes(b.status) && (b.bothConfirmed || b.seatReserved)
  );
  const hasPassengers = activeBookings.length > 0;

  // 1. COORDINATE MATRIX: hard-locked once the trip has bookings.
  if (hasPassengers) {
    const changed = MATRIX_COORDINATE_FIELDS.filter((f) => isMeaningfulChange(existingTrip[f.key], updates[f.key]));
    if (changed.length > 0) {
      return {
        error: {
          status: 409,
          body: {
            success: false,
            code: 'MATRIX_COORDINATE_LOCKED',
            error:
              `Chuyến đã có ${activeBookings.length} khách đặt chỗ nên không thể đổi ` +
              `${changed.map((f) => f.label).join(', ')}. ` +
              'Hãy giữ cuộc hẹn đã xác nhận; nếu không thể thực hiện, báo hủy để khách tìm phương án tiếp theo.',
            lockedFields: changed.map((f) => f.key),
            activeBookings: activeBookings.length
          }
        }
      };
    }
  }

  const isDriverOffer = (updates.type || existingTrip.type) !== 'passenger_request';
  if (isDriverOffer) {
    try {
      Object.assign(updates, normalizeConnectionTerms({ ...existingTrip, ...updates }));
    } catch (err) {
      return { error: { status: 400, body: { success: false, error: err.message } } };
    }
    // New listing prices apply to future proposals; existing committedTerms remain immutable.
    if (hasPassengers && ['pickupMode', 'maxDetourKm', 'pickupNotes', 'licensePlate', 'carType', 'capacity', 'availableSeats', 'vehicleSeats', 'vehicleType'].some(key => isMeaningfulChange(existingTrip[key], rawUpdates[key]))) {
      return { error: { status: 409, body: { success: false, error: 'Thay đổi này ảnh hưởng cuộc hẹn đã xác nhận. Hãy xử lý cuộc hẹn trước.' } } };
    }
  }
  for (const key of ['id','type','userId','creatorId','bookingSeatCapacity','isBanned','isHidden','isCccdVerified','isGplxVerified','isPhoneVerified','status','operatorId','operatorName','operatorEntryMode','assistedEntryId','operatorAuthorization']) delete updates[key];
  const fromKm = getStationStationKm(updates.originHubId || existingTrip.originHubId), toKm = getStationStationKm(updates.destinationHubId || existingTrip.destinationHubId);
  if (fromKm != null && toKm != null && fromKm !== toKm) updates.direction = fromKm < toKm ? 'binh_phuoc_to_tphcm' : 'tphcm_to_binh_phuoc';
  updates.updatedAt = Date.now();

  return { updates, hasPassengers, activeBookings: activeBookings.length };
}

export async function updateTripHandler(req, res) {
  try {
    const { id } = req.params;
    let updates = req.body || {};
    if (updates.status !== undefined) return res.status(400).json({ success: false, error: 'Dùng thao tác trạng thái chuyến để cập nhật hoặc hủy chuyến.' });

    const tripBeforeUpdate = getTripById(id);
    if (!tripBeforeUpdate) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến xe cần cập nhật' });
    }

    const guard = enforceTripInvariants(tripBeforeUpdate, updates);
    if (guard.error) {
      return res.status(guard.error.status).json(guard.error.body);
    }
    updates = guard.updates;

    if (updates.capacity || updates.vehicleSeats || updates.availableSeats !== undefined || updates.vehicleType || updates.hasCargoBed) {
      const existingTrip = getTripById(id);
      const rawCap =
        updates.vehicleType === 'truck_light' || updates.isCargoVehicle || existingTrip?.vehicleType === 'truck_light' || existingTrip?.isCargoVehicle
          ? 'truck_light'
          : (updates.vehicleType === 'pickup' || updates.hasCargoBed || existingTrip?.vehicleType === 'pickup' || existingTrip?.hasCargoBed
            ? 'pickup'
            : updates.capacity || updates.vehicleSeats || existingTrip?.capacity || (Number(updates.availableSeats || existingTrip?.availableSeats) > 4 ? 7 : 5));
      const rawSeats = updates.availableSeats !== undefined ? updates.availableSeats : existingTrip?.availableSeats;
      const { capacity, seats, vehicleType, hasCargoBed, isCargoVehicle } = sanitizeVehicleCapacityAndSeats(rawCap, rawSeats);
      updates.capacity = capacity;
      if (updates.availableSeats !== undefined) {
        updates.availableSeats = seats;
        if (!guard.hasPassengers) updates.bookingSeatCapacity = seats;
      }
      if (vehicleType) updates.vehicleType = vehicleType;
      if (hasCargoBed !== undefined) updates.hasCargoBed = hasCargoBed;
      if (isCargoVehicle !== undefined) updates.isCargoVehicle = isCargoVehicle;
    }

    if (!guard.hasPassengers) {
      const proposed = { ...tripBeforeUpdate, ...updates };
      if (!normalizeTravelDate(proposed.date) || !getTravelWindow(proposed) || getTravelWindow(proposed).end <= Date.now()) return res.status(400).json({ success: false, error: 'Chọn ngày giờ chạy còn hiệu lực.' });
    }
    const updated = await updateTrip(id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến xe cần cập nhật' });
    }

    return res.status(200).json({ success: true, message: 'Cập nhật chuyến đi thành công', data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/trips/:id - Delete or cancel a trip
 * Complies with Project 4 (Time-Decay Penalty) & Project 6 (Standby Rescue Buffer):
 * - If the trip has no bookings: delete safely (100% Idempotent).
 * - If the trip has booked passengers: compute deltaMinutes, apply the time-sloped sanction,
 *   activate the Standby Buffer rescue vehicle to rescue the passengers and switch the trip status to cancelled.
 */
export async function deleteTripHandler(req, res) {
  try {
    const trip = getTripById(req.params.id);
    if (!trip) return res.status(200).json({ success: true, message: 'Chuyến đã được xóa.' });
    const active = getBookings().filter(b => (b.tripId === trip.id || b.targetTripId === trip.id) && !['cancelled','completed','expired'].includes(b.status) && !b.needsReplacement);
    if (active.some(b => b.status === 'boarded')) return res.status(409).json({ success: false, error: 'Đang có khách trên xe. Hãy xử lý sự cố hành trình trước khi hủy chuyến.' });
    for (const booking of active) cancelAppointment({ bookingId: booking.escrowId || booking.id, user: req.user, reason: req.body?.reason || 'Chủ xe hủy chuyến' });
    if (active.length) await updateTrip(trip.id, { status: 'cancelled', cancelledAt: Date.now(), cancelReason: req.body?.reason || '', updatedAt: Date.now() });
    else await deleteTrip(trip.id);
    return res.json({ success: true, message: active.length ? 'Đã hủy chuyến; nhu cầu còn hiệu lực của khách tiếp tục tìm xe thay thế.' : 'Đã xóa chuyến.', data: { tripId: trip.id, affectedRequests: active.length } });
  } catch (err) { return res.status(err.status || 500).json({ success: false, error: err.message }); }
}

/**
 * POST /api/trips/:id/republish - 1-tap republish of an old trip for tomorrow
 */
export async function republishTripHandler(req, res) {
  const existing = getTripById(req.params.id);
  if (!existing) return res.status(404).json({success:false,error:'Không tìm thấy chuyến gốc.'});
  const changes = {};
  for (const key of ['date','timeSlot','time','availableSeats','basePricePerSeat','pricingMode','notes']) {
    if (req.body?.[key] !== undefined) changes[key] = req.body[key];
  }
  return createTrip({ ...req, body: { ...existing, ...changes,
    id: undefined, date: changes.date || normalizeTravelDate('tomorrow'),
    departureTime: changes.timeSlot || changes.time || existing.departureTime,
    availableSeats: changes.availableSeats ?? existing.bookingSeatCapacity ?? existing.availableSeats,
    sourceTripId: existing.id
  } }, res);
}
