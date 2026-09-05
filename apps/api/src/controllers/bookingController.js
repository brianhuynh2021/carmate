import { getDB, getBookings, addBooking, updateBookingStatus, removeBooking } from '../db/sqliteStore.js';

/**
 * GET /api/bookings - Lấy danh sách chuyến đi đã kết nối (Chuyến của tôi)
 */
export function listBookings(req, res) {
  try {
    const bookings = getBookings();
    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings - Tạo kết nối chuyến mới qua Zalo
 */
export async function createBooking(req, res) {
  try {
    const body = req.body;

    if (!body.from || !body.to || !body.contactPhone) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin bắt buộc: điểm đón (from), điểm đến (to) hoặc SĐT liên hệ'
      });
    }

    const booking = await addBooking(body);

    return res.status(201).json({
      success: true,
      message: 'Kết nối chuyến thành công qua Zalo',
      data: booking
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/delay - Báo trễ hẹn chuyến đi
 */
export async function reportDelay(req, res) {
  try {
    const { id } = req.params;
    const { minutes = 15, note } = req.body;

    const updated = await updateBookingStatus(id, 'delayed', {
      delayedMinutes: minutes,
      delayNote: note || `Dự kiến trễ khoảng +${minutes} phút do kẹt xe hoặc chuẩn bị`,
      delayedAt: new Date().toISOString()
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    return res.status(200).json({
      success: true,
      message: `Đã gửi thông báo trễ +${minutes} phút`,
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/cancel - Huỷ kết nối chuyến đi
 */
export async function cancelBooking(req, res) {
  try {
    const { id } = req.params;
    const { reason = 'Thay đổi lịch trình đột xuất' } = req.body;

    const updated = await updateBookingStatus(id, 'cancelled', {
      cancelReason: reason,
      cancelledAt: new Date().toISOString()
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    return res.status(200).json({
      success: true,
      message: 'Huỷ chuyến thành công. Vui lòng nhắn tin Zalo báo trước cho đối tác',
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/complete - Hoàn tất chuyến đi an toàn
 */
export async function completeBooking(req, res) {
  try {
    const { id } = req.params;
    const { rating = 5, review = '', reviewerRole = 'passenger', tags = [] } = req.body || {};

    const updated = await updateBookingStatus(id, 'completed', {
      completedAt: new Date().toISOString(),
      feedback: { rating, review, reviewerRole, tags }
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    return res.status(200).json({
      success: true,
      message: 'Chuyến đi hoàn tất an toàn. Cảm ơn bạn đã đi chung văn minh!',
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/review - Đánh giá 2 chiều (Chủ xe đánh giá Khách hoặc Khách đánh giá Chủ xe)
 */
export async function submitReview(req, res) {
  try {
    const { id } = req.params;
    const { reviewerRole = 'driver', rating = 5, tags = [], comment = '' } = req.body || {};

    const db = getDB();
    const booking = (db.bookings || []).find(b => b.escrowId === id || b.id === id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi để đánh giá' });
    }

    const reviewEntry = {
      id: `REV-${Date.now()}`,
      bookingId: id,
      reviewerRole, // 'driver' (Chủ xe đánh giá Khách) hoặc 'passenger' (Khách đánh giá Chủ xe)
      targetRole: reviewerRole === 'driver' ? 'passenger' : 'driver',
      rating: Number(rating) || 5,
      tags: Array.isArray(tags) ? tags : [],
      comment: String(comment || '').trim(),
      createdAt: new Date().toISOString()
    };

    const existingReviews = Array.isArray(booking.reviews) ? booking.reviews : [];
    // Cập nhật hoặc thêm mới review của role này
    const filteredReviews = existingReviews.filter(r => r.reviewerRole !== reviewerRole);
    const updatedReviews = [...filteredReviews, reviewEntry];

    // Kiểm tra cờ an toàn / cảnh báo nếu có vi phạm (Ví dụ: Bom xe, trễ hẹn, thô lỗ)
    const existingFlags = Array.isArray(booking.safetyFlags) ? booking.safetyFlags : [];
    const isNegative = Number(rating) <= 2 || tags.some(t => t.includes('Leo cây') || t.includes('Bom') || t.includes('Trễ') || t.includes('thô lỗ'));
    let updatedFlags = existingFlags;

    if (isNegative) {
      updatedFlags = [
        ...existingFlags.filter(f => f.targetRole !== reviewEntry.targetRole),
        {
          targetRole: reviewEntry.targetRole,
          reason: tags.join(', ') || comment || 'Đánh giá tiêu cực',
          severity: Number(rating) === 1 ? 'high' : 'medium',
          flaggedAt: new Date().toISOString()
        }
      ];
    }

    const updated = await updateBookingStatus(id, 'completed', {
      reviews: updatedReviews,
      safetyFlags: updatedFlags
    });

    return res.status(200).json({
      success: true,
      message: 'Ghi nhận đánh giá 2 chiều thành công! Cảm ơn bạn đã đóng góp cho cộng đồng CarMate văn minh.',
      data: {
        booking: updated,
        newReview: reviewEntry
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

