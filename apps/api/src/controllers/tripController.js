import {
  getTrips,
  getPaginatedTrips,
  getTripById,
  addTrip,
  updateTrip,
  republishTrip,
  deleteTrip,
  getDB,
  getUserById,
  getUserByPhone
} from '../db/sqliteStore.js';
import { cleanPhoneNumber, sanitizeVehicleCapacityAndSeats, computeTrustScore } from '@carmate/shared';
import { sendBusinessAlert } from '../utils/telegramAlert.js';

/**
 * Che giấu thông tin định danh cá nhân (PII Protection - Nghị định 13/2023/NĐ-CP)
 * Chỉ trả SĐT thật (phoneReal) cho chính chủ sở hữu bài đăng hoặc Quản trị viên.
 */
/**
 * Tổng hợp sao trung bình THẬT của người đăng chuyến từ các đánh giá đã gửi
 * sau chuyến đi (booking.reviews). Chỉ trả về khi có ít nhất 1 đánh giá thật —
 * không bịa 5 sao mặc định cho người chưa ai chấm điểm.
 */
function resolveRating(trip) {
  try {
    const db = getDB();
    const bookings = db.bookings || [];
    const tripPhone = cleanPhoneNumber(trip.phoneReal || trip.phone || '');
    const isDriverTrip = trip.type === 'driver_offer';
    // Chuyến của chủ xe -> lấy đánh giá mà khách chấm cho chủ xe, và ngược lại
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
 * Tính điểm tín nhiệm của người đăng chuyến để hiển thị ngoài feed.
 * Điểm suy ra từ hồ sơ thật (CCCD, GPLX, biển số, ảnh xe, số chuyến đã đi,
 * số lần bị báo trễ/huỷ) — không phải số sao mặc định.
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

/**
 * Sinh bí danh công khai ổn định cho một chuyến đi.
 * Không bao giờ trả về tên thật — chỉ vai trò + số hiệu suy ra từ id chuyến,
 * nên cùng một chuyến luôn cho ra cùng một bí danh giữa các lần gọi API.
 */
export function toPublicAlias(trip) {
  const isDriver = trip?.type === 'driver_offer';
  const isConvenient = trip?.carCategory === 'convenient_trip';
  const role = isDriver ? (isConvenient ? 'Xe tiện chuyến' : 'Chủ xe') : 'Khách';

  // Giữ lại bí danh cũ nếu nó vốn đã ẩn danh (mock data, chuyến cũ)
  const existing = String(trip?.publicName || '').trim();
  if (existing && /^(Chủ xe|Khách|Xe tiện chuyến|Người)\b/i.test(existing)) return existing;

  const masked = String(trip?.maskedCode || '').trim();
  if (masked) return `${role} ${masked}`;

  const seed = String(trip?.id || trip?.userId || '');
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 900;
  return `${role} #${100 + hash}`;
}

export function sanitizeTripForPublic(trip, reqUser) {
  if (!trip) return null;
  const userPhone = reqUser ? cleanPhoneNumber(reqUser.phone || '') : null;
  const tripPhone = cleanPhoneNumber(trip.phoneReal || trip.phone || '');
  const isOwner = Boolean(
    (userPhone && tripPhone && userPhone === tripPhone) ||
    (reqUser && (reqUser.role === 'admin' || reqUser.role === 'super_admin')) ||
    (reqUser && reqUser.id && (reqUser.id === trip.userId || reqUser.id === trip.creatorId))
  );

  const sanitized = { ...trip };

  // Chuẩn hóa phoneMasked dạng 098***2233
  const rawPhone = trip.phoneReal || trip.phone || '';
  if (rawPhone && (!sanitized.phoneMasked || sanitized.phoneMasked === rawPhone)) {
    const cleaned = cleanPhoneNumber(rawPhone);
    sanitized.phoneMasked = cleaned.length >= 7 ? `${cleaned.slice(0, 3)}***${cleaned.slice(-4)}` : '098***2233';
  }

  // Ẩn triệt để phoneReal nếu không phải chủ sở hữu hoặc admin
  if (!isOwner) {
    delete sanitized.phoneReal;
    delete sanitized.phone;
    if (sanitized.licensePlate && typeof sanitized.licensePlate === 'string') {
      sanitized.licensePlate = sanitized.licensePlate.replace(/\d{2}$/, 'xx');
    }

    // Ẩn danh tính thật: feed công khai chỉ được thấy bí danh dạng "Chủ xe #123".
    // Tên thật chỉ lộ cho hai bên sau khi ghép chuyến thành công (qua booking).
    sanitized.publicName = toPublicAlias(sanitized);
    delete sanitized.driverName;
    delete sanitized.contactName;
    delete sanitized.author;
    delete sanitized.fullName;
    delete sanitized.name;
    delete sanitized.email;
  }

  // Sao trung bình THẬT từ đánh giá sau chuyến; xoá số sao mặc định nếu chưa có ai chấm
  const rated = resolveRating(trip);
  if (rated) {
    sanitized.rating = rated.rating;
    sanitized.ratingCount = rated.ratingCount;
  } else {
    delete sanitized.rating;
    delete sanitized.ratingCount;
  }

  // Điểm tín nhiệm hiển thị ngoài feed (thay cho số sao mặc định)
  const trust = resolveTrustScore(trip);
  if (trust) {
    sanitized.trustScore = trust.score;
    sanitized.trustLevel = trust.level;
    sanitized.trustLevelId = trust.levelId;
  }

  return sanitized;
}

/**
 * GET /api/trips - Lấy danh sách chuyến xe kèm bộ lọc
 */
export function listTrips(req, res) {
  try {
    const { type = 'all', routeCategory, direction, timeSlot, q, includeExpired, page = 1, limit = 50 } = req.query;

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const offset = (p - 1) * l;

    const { total, trips } = getPaginatedTrips({
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
 * GET /api/trips/:id - Chi tiết chuyến xe
 */
export function getTrip(req, res) {
  try {
    const { id } = req.params;
    const trip = getTripById(id);

    if (!trip) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến xe' });
    }

    const sanitized = sanitizeTripForPublic(trip, req.user);
    return res.status(200).json({ success: true, data: sanitized });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/trips - Tạo mới chuyến đi (Chủ xe hoặc Khách)
 */
export async function createTrip(req, res) {
  try {
    const body = req.body;

    // Validate cơ bản
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
        error: 'Cần cung cấp số điện thoại Zalo để kết nối'
      });
    }

    // Đảm bảo mức giá luôn được chuẩn hoá, tránh trường hợp bị render 0đ
    if (!body.basePricePerSeat && body.suggestedContribution) {
      body.basePricePerSeat = Number(body.suggestedContribution);
    }
    if (!body.basePricePerSeat && body.price) {
      body.basePricePerSeat = Number(body.price);
    }
    if (!body.expectedPrice && body.suggestedContribution && body.type === 'passenger_request') {
      body.expectedPrice = Number(body.suggestedContribution);
    }

    // Chuẩn hóa tải trọng xe và số ghế khách hợp lệ (Kháng chở quá tải Nghị định 100/2019)
    if (body.type === 'driver_offer' || body.availableSeats) {
      const rawCapacity = body.capacity || body.vehicleSeats || (Number(body.availableSeats) > 4 ? 7 : 5);
      const { capacity, seats } = sanitizeVehicleCapacityAndSeats(rawCapacity, body.availableSeats);
      body.capacity = capacity;
      body.availableSeats = seats;
    }

    const newTrip = await addTrip(body);

    // Bắn thông báo Telegram về điện thoại của founder (0 chi phí)
    sendBusinessAlert({
      title: newTrip.type === 'driver_offer' ? '🚗 Chủ xe đăng chuyến mới' : '🙋‍♂️ Người đi cùng tìm xe mới',
      details: {
        'Mã chuyến': newTrip.id,
        'Lộ trình': `${newTrip.from} ➔ ${newTrip.to}`,
        'Khởi hành': `${newTrip.date || 'Hôm nay'} lúc ${newTrip.time || 'Linh hoạt'}`,
        'Ghế trống/cần': newTrip.availableSeats || newTrip.seatsNeeded || 1,
        'Mức giá': newTrip.basePricePerSeat
          ? `${newTrip.basePricePerSeat.toLocaleString('vi-VN')} đ`
          : newTrip.expectedPrice
            ? `${newTrip.expectedPrice.toLocaleString('vi-VN')} đ`
            : 'Thỏa thuận'
      },
      req
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Đăng chuyến thành công',
      data: newTrip
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/trips/:id/status - Cập nhật trạng thái chuyến xe
 */
export async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Thiếu trường status' });
    }

    const updated = await updateTrip(id, { status });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến xe cần cập nhật' });
    }

    return res.status(200).json({ success: true, message: 'Cập nhật trạng thái thành công', data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PUT /api/trips/:id - Cập nhật thông tin chuyến đi
 */
export async function updateTripHandler(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    if (updates.capacity || updates.vehicleSeats || updates.availableSeats !== undefined) {
      const existingTrip = getTripById(id);
      const rawCap =
        updates.capacity ||
        updates.vehicleSeats ||
        existingTrip?.capacity ||
        (Number(updates.availableSeats || existingTrip?.availableSeats) > 4 ? 7 : 5);
      const rawSeats = updates.availableSeats !== undefined ? updates.availableSeats : existingTrip?.availableSeats;
      const { capacity, seats } = sanitizeVehicleCapacityAndSeats(rawCap, rawSeats);
      updates.capacity = capacity;
      if (updates.availableSeats !== undefined) {
        updates.availableSeats = seats;
      }
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
 * DELETE /api/trips/:id - Xóa chuyến đi
 */
export async function deleteTripHandler(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deleteTrip(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến xe cần xóa' });
    }

    return res.status(200).json({ success: true, message: 'Xóa chuyến đi thành công' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/trips/:id/republish - Tái đăng 1 chạm chuyến cũ cho ngày mai
 */
export async function republishTripHandler(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    const newTrip = await republishTrip(id, updates);
    if (!newTrip) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến xe gốc để tái đăng' });
    }

    return res.status(201).json({
      success: true,
      message: 'Tái đăng chuyến xe thành công',
      data: newTrip
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
