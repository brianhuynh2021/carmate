import {
  getTrips,
  getPaginatedTrips,
  getTripById,
  addTrip,
  updateTrip,
  republishTrip,
  deleteTrip,
  getDB
} from '../db/sqliteStore.js';
import { cleanPhoneNumber, sanitizeVehicleCapacityAndSeats } from '@carmate/shared';
import { sendBusinessAlert } from '../utils/telegramAlert.js';

/**
 * Che giấu thông tin định danh cá nhân (PII Protection - Nghị định 13/2023/NĐ-CP)
 * Chỉ trả SĐT thật (phoneReal) cho chính chủ sở hữu bài đăng hoặc Quản trị viên.
 */
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
      title: newTrip.type === 'driver_offer' ? '🚗 Bác tài đăng chuyến mới' : '🙋‍♂️ Hành khách tìm xe mới',
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
      }
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
      const rawCap = updates.capacity || updates.vehicleSeats || existingTrip?.capacity || (Number(updates.availableSeats || existingTrip?.availableSeats) > 4 ? 7 : 5);
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
