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
  getUserByPhone,
  saveUser,
  isUserDeactivated,
  isDriverDailyTripCapped,
  DRIVER_DAILY_CAP_NOTICE
} from '../db/sqliteStore.js';
import { cleanPhoneNumber, normalizePhoneNumber, sanitizeVehicleCapacityAndSeats, computeTrustScore, toPublicAlias, isValidVietnamesePhone, isLikelyFakePhone, getPriceGuardrail } from '@carmate/shared';
import { sendBusinessAlert, sendSmartMatchTelegramAlert } from '../utils/telegramAlert.js';

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

export { toPublicAlias };

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

  // Chuẩn hoá bí danh hiển thị công khai (Chủ xe CX-xxx / Khách KX-xxx)
  sanitized.publicName = toPublicAlias(sanitized);

  // Ẩn triệt để phoneReal nếu không phải chủ sở hữu hoặc admin
  if (!isOwner) {
    delete sanitized.phoneReal;
    delete sanitized.phone;
    if (sanitized.licensePlate && typeof sanitized.licensePlate === 'string') {
      sanitized.licensePlate = sanitized.licensePlate.replace(/\d{2}$/, 'xx');
    }

    // Ẩn danh tính thật: feed công khai chỉ được thấy bí danh dạng "Chủ xe CX-xxx".
    // Tên thật chỉ lộ cho hai bên sau khi ghép chuyến thành công (qua booking).
    delete sanitized.driverName;
    delete sanitized.contactName;
    delete sanitized.author;
    delete sanitized.fullName;
    delete sanitized.name;
    delete sanitized.email;
  }

  // Sao trung bình đánh giá chuyến xe
  const rated = resolveRating(trip);
  if (rated) {
    sanitized.rating = rated.rating;
    sanitized.ratingCount = rated.ratingCount;
  } else if (trip.rating != null) {
    sanitized.rating = Number(trip.rating);
    sanitized.ratingCount = Number(trip.ratingCount || trip.completedCount || 1);
  } else {
    sanitized.rating = 5.0;
    sanitized.ratingCount = Number(trip.completedCount || 1);
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
        error: 'Cần cung cấp số điện thoại thật để liên hệ đón nhau'
      });
    }

    if (!isValidVietnamesePhone(body.phoneReal) || isLikelyFakePhone(body.phoneReal)) {
      return res.status(400).json({
        success: false,
        error: 'Số điện thoại không hợp lệ hoặc có dấu hiệu số ảo. Vui lòng cung cấp số điện thoại thật để đối tác liên hệ đón bạn.'
      });
    }

    // Kiểm tra tài khoản có bị hạn chế đăng bài hoặc bị vô hiệu hóa hay không (Quy tắc Ân hạn 3 ngày)
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

    // BẤT BIẾN MIT: Kiểm tra Dải giá an toàn (Price Guardrail Invariant)
    const tripPrice = Number(body.basePricePerSeat || body.expectedPrice || 0);
    if (tripPrice > 0) {
      const guardrail = getPriceGuardrail(body.from, body.to, tripPrice);
      if (tripPrice < 15000 && (guardrail?.distanceKm || 0) > 30) {
        return res.status(400).json({
          success: false,
          error: 'Mức phụ xăng quá thấp (tối thiểu 15.000đ cho chuyến liên tỉnh). Vui lòng nhập mức chia sẻ hợp lý.'
        });
      }
      if (guardrail?.maxSafePrice && tripPrice > guardrail.maxSafePrice * 3) {
        return res.status(400).json({
          success: false,
          error: `Mức phụ xăng quá cao (${tripPrice.toLocaleString('vi-VN')}đ). CarMate là nền tảng chia sẻ chi phí xe gia đình văn minh, không hỗ trợ giá kinh doanh dịch vụ riêng.`
        });
      }
    }

    // BẤT BIẾN MIT: Giới hạn ghế an toàn theo quy định đăng kiểm (chống chở quá tải)
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

    // Chuẩn hóa tải trọng xe và số ghế khách hợp lệ (Kháng chở quá tải Nghị định 100/2019)
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
      if (!req.user.phone && body.phoneReal) {
        try {
          const normP = normalizePhoneNumber(body.phoneReal);
          req.user.phone = normP;
          const u = getUserById(req.user.id || req.user.userId);
          if (u && !u.phone) {
            u.phone = normP;
            await saveUser(u);
          }
        } catch (e) {
          console.warn('[createTrip] Auto-link phone warning:', e);
        }
      }
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

    // Radar AI Omni-channel: Tự động phát hiện và gửi thông báo cho các đối tác khớp lộ trình cao (>= 85%)
    setTimeout(async () => {
      try {
        const targetType = newTrip.type === 'driver_offer' ? 'passengers' : 'drivers';
        const oppositeCandidates = getTrips({
          type: targetType,
          routeCategory: newTrip.routeCategory,
          direction: newTrip.direction,
          includeHidden: false
        }).filter((c) => !c.status || (c.status !== 'cancelled' && c.status !== 'completed'));

        for (const candidate of oppositeCandidates) {
          if (candidate.id === newTrip.id) continue;
          let score = 75;
          if (newTrip.direction && candidate.direction && newTrip.direction === candidate.direction) score += 10;
          if (newTrip.timeSlot && candidate.timeSlot && newTrip.timeSlot === candidate.timeSlot) score += 10;
          if (score >= 85) {
            const targetTelegramId = candidate.telegramId || (candidate.userId ? getUserById(candidate.userId)?.telegramId : null);
            if (targetTelegramId) {
              await sendSmartMatchTelegramAlert({
                targetTelegramId,
                matchedTrip: newTrip,
                score,
                req
              }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn('[Auto Match Notification Error]:', err.message);
      }
    }, 50);

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
      }
      if (vehicleType) updates.vehicleType = vehicleType;
      if (hasCargoBed !== undefined) updates.hasCargoBed = hasCargoBed;
      if (isCargoVehicle !== undefined) updates.isCargoVehicle = isCargoVehicle;
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

    const existingTrip = getTripById(id);
    if (!existingTrip) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến xe gốc để tái đăng' });
    }

    const newTrip = await republishTrip(id, updates);
    if (!newTrip) {
      return res.status(404).json({ success: false, error: 'Không thể tái đăng chuyến xe' });
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
