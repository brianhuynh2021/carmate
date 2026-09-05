import { getTrips, getTripById, addTrip, updateTrip, deleteTrip, getDB } from '../db/sqliteStore.js';

/**
 * GET /api/trips - Lấy danh sách chuyến xe kèm bộ lọc
 */
export function listTrips(req, res) {
  try {
    const { type = 'all', routeCategory, direction, timeSlot, q, page = 1, limit = 50 } = req.query;

    const filtered = getTrips({ type, routeCategory, direction, timeSlot, q });
    const db = getDB();

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const offset = (p - 1) * l;
    const paginated = filtered.slice(offset, offset + l);

    return res.status(200).json({
      success: true,
      total: filtered.length,
      page: p,
      limit: l,
      data: {
        all: paginated,
        driverOffers: paginated.filter((t) => t.type === 'driver_offer'),
        passengerRequests: paginated.filter((t) => t.type === 'passenger_request'),
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

    return res.status(200).json({ success: true, data: trip });
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

    const newTrip = await addTrip(body);

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
    const updates = req.body;

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
