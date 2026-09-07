import {
  getDB,
  getBookings,
  getBookingById,
  getTripById,
  addBooking,
  updateBookingStatus,
  removeBooking
} from '../db/sqliteStore.js';
import { cleanPhoneNumber } from '@carmate/shared';
import { sendBusinessAlert, sendTelegramMessage } from '../utils/telegramAlert.js';

/**
 * GET /api/bookings - Lấy danh sách chuyến đi đã kết nối (Chuyến của tôi)
 * Chống rò rỉ PII: Chỉ trả về các booking của chính người dùng đã đăng nhập hoặc Admin
 */
export function listBookings(req, res) {
  try {
    const user = req.user;
    // Nếu chưa đăng nhập: Không bao giờ trả về danh sách booking công khai
    if (!user) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    const allBookings = getBookings();

    // Quản trị viên hệ thống: Xem toàn bộ
    if (user.role === 'admin' || user.role === 'super_admin') {
      return res.status(200).json({
        success: true,
        count: allBookings.length,
        data: allBookings
      });
    }

    // Người dùng thông thường: Chỉ xem các booking của bản thân
    const userPhone = cleanPhoneNumber(user.phone || '');
    const userBookings = allBookings.filter((b) => {
      const bContact = cleanPhoneNumber(b.contactPhone || '');
      const bCreator = cleanPhoneNumber(b.userPhone || b.creatorPhone || '');
      const bTarget = cleanPhoneNumber(b.targetPhone || '');
      return (
        (userPhone && (bContact === userPhone || bCreator === userPhone || bTarget === userPhone)) ||
        (user.id && (b.userId === user.id || b.creatorId === user.id || b.driverId === user.id))
      );
    });

    return res.status(200).json({
      success: true,
      count: userBookings.length,
      data: userBookings
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

    if (!body.from || !body.to) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin bắt buộc: điểm đón (from) hoặc điểm đến (to)'
      });
    }

    // Gắn thông tin người dùng đang đăng nhập
    if (req.user) {
      body.userId = req.user.id || body.userId;
      body.userPhone = req.user.phone || body.userPhone;
    }

    // Nếu có tripId, truy vấn SĐT thật của chuyến xe từ DB để cấp quyền kết nối Zalo
    const targetTripId = body.tripId || body.targetTripId || body.targetId || (body.targetItem && body.targetItem.id);
    if (targetTripId) {
      const targetTrip = getTripById(targetTripId);
      if (targetTrip) {
        const tripPhone = targetTrip.phoneReal || targetTrip.phone;
        body.driverPhone = tripPhone;
        body.targetPhone = tripPhone;
        body.driverId = targetTrip.userId;
        body.contactPhone = tripPhone || body.contactPhone;
        body.phoneReal = tripPhone || body.phoneReal;
        body.contactName = targetTrip.publicName || body.contactName;
        body.targetTripId = targetTrip.id;
      }
    }

    const booking = await addBooking(body);

    // Bắn thông báo Telegram về điện thoại của founder (0 chi phí)
    sendBusinessAlert({
      title: '🎟️ Hành khách kết nối giữ chỗ mới',
      details: {
        'Mã booking': booking.id,
        'Lộ trình': `${booking.from} ➔ ${booking.to}`,
        'Khởi hành': `${booking.date || 'Hôm nay'} ${booking.time || ''}`.trim(),
        'Chuyến liên kết': targetTripId || 'Tự do',
        'Số ghế': booking.seatsBooked || 1
      }
    }).catch(() => {});

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
    const booking = (db.bookings || []).find((b) => b.escrowId === id || b.id === id);
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
    const filteredReviews = existingReviews.filter((r) => r.reviewerRole !== reviewerRole);
    const updatedReviews = [...filteredReviews, reviewEntry];

    // Kiểm tra cờ an toàn / cảnh báo nếu có vi phạm (Ví dụ: Bom xe, trễ hẹn, thô lỗ)
    const existingFlags = Array.isArray(booking.safetyFlags) ? booking.safetyFlags : [];
    const isNegative =
      Number(rating) <= 2 ||
      tags.some((t) => t.includes('Leo cây') || t.includes('Bom') || t.includes('Trễ') || t.includes('thô lỗ'));
    let updatedFlags = existingFlags;

    if (isNegative) {
      updatedFlags = [
        ...existingFlags.filter((f) => f.targetRole !== reviewEntry.targetRole),
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

/**
 * GET /api/bookings/:id/public-summary - Tóm tắt thông tin công khai không nhạy cảm
 * Dùng cho Bác tài mở Magic Link từ Zalo (Không cần đăng nhập, bảo vệ PII)
 */
export function getBookingPublicSummary(req, res) {
  try {
    const { id } = req.params;
    const booking = getBookingById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy thông tin đặt chuyến hoặc liên kết đã hết hạn'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        escrowId: booking.escrowId || booking.id,
        tripId: booking.tripId,
        status: booking.status || 'zalo_active',
        driverConfirmed: !!booking.driverConfirmed,
        driverConfirmedAt: booking.driverConfirmedAt || null,
        driverNote: booking.driverNote || '',
        from: booking.from,
        to: booking.to,
        pickupPoint: booking.pickupPoint || '',
        timeSlot: booking.timeSlot,
        date: booking.date,
        seats: booking.seats || 1,
        totalDeal: booking.totalDeal || booking.price || 0,
        passengerName: booking.passengerName || booking.contactName || 'Khách CarMate',
        driverName: booking.driverName || 'Bác tài',
        createdAt: booking.createdAt
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/driver-confirm - Bác tài xác nhận đón 1 chạm từ Magic link Zalo (Không cần đăng nhập)
 */
export async function driverConfirmBooking(req, res) {
  try {
    const { id } = req.params;
    const { driverNote = '' } = req.body || {};

    const existing = getBookingById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy thông tin chuyến đi để xác nhận'
      });
    }

    const updated = await updateBookingStatus(id, 'driver_confirmed', {
      driverConfirmed: true,
      driverConfirmedAt: new Date().toISOString(),
      driverNote: driverNote || 'Bác tài đã bấm nhận đón qua Magic Link Zalo'
    });

    return res.status(200).json({
      success: true,
      message: 'Bác tài đã xác nhận đón thành công! Hệ thống đã ghi nhận lịch hẹn.',
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/report-vehicle-mismatch - Báo cáo xe đón thực tế không đúng cam kết (Biển vàng / Biển trắng)
 */
export async function reportVehicleMismatch(req, res) {
  try {
    const { id } = req.params;
    const { mismatchType = 'yellow_plate', actualPlate = '', passengerNote = '' } = req.body || {};

    const booking = getBookingById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy thông tin chuyến xe để báo cáo'
      });
    }

    const trip = booking.tripId ? getTripById(booking.tripId) : null;
    const declaredCategory = trip?.carCategory || booking.carCategory || 'family_car';

    const mismatchLabels = {
      yellow_plate: 'Xe đón thực tế là Biển vàng (Dịch vụ kinh doanh)',
      overcrowded: 'Xe nhồi nhét khách / Ghép xe trái phép',
      different_car: 'Xe khác hoàn toàn mô tả / Đổi xe giữa đường',
      other: 'Sai lệch loại xe khác'
    };

    const mismatchTitle = mismatchLabels[mismatchType] || mismatchType;
    const reporterName = req.user?.name || booking.passengerName || booking.contactName || 'Hành khách CarMate';
    const reporterPhone = req.user?.phone || booking.passengerPhone || booking.contactPhone || 'N/A';
    const driverName = trip?.publicName || booking.driverName || 'Bác tài';
    const driverPhone = trip?.phoneReal || trip?.phone || booking.driverPhone || booking.contactPhone || 'N/A';
    const cleanActualPlate = String(actualPlate || '').trim().toUpperCase();
    const cleanNote = String(passengerNote || '').trim();

    const mismatchReport = {
      id: `MISMATCH-${Date.now()}`,
      bookingId: id,
      tripId: booking.tripId || null,
      reporterName,
      reporterPhone,
      driverName,
      driverPhone,
      declaredCategory,
      mismatchType,
      mismatchTitle,
      actualPlate: cleanActualPlate,
      passengerNote: cleanNote,
      status: 'pending', // 'pending' | 'resolved_converted' | 'resolved_banned' | 'dismissed'
      reportedAt: new Date().toISOString()
    };

    // Cập nhật safetyFlags trong booking
    const existingFlags = Array.isArray(booking.safetyFlags) ? booking.safetyFlags : [];
    const updatedFlags = [
      ...existingFlags.filter((f) => f.reason !== 'vehicle_mismatch'),
      {
        targetRole: 'driver',
        reason: 'vehicle_mismatch',
        mismatchType,
        severity: 'high',
        flaggedAt: new Date().toISOString()
      }
    ];

    const updated = await updateBookingStatus(id, booking.status || 'zalo_active', {
      vehicleMismatchReport: mismatchReport,
      safetyFlags: updatedFlags
    });

    // Bắn tin cảnh báo tức thời tới Telegram Founder
    const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const declaredCatLabel =
      declaredCategory === 'family_car' ? '🚗 Xe gia đình (Biển trắng)' : '⚡ Xe tiện chuyến (Biển vàng)';
    const teleMsg =
      `🚨 <b>[CARMATE CẢNH BÁO GIAN LẬN LOẠI XE]</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ <b>Hành khách vừa báo cáo xe đón không đúng mô tả!</b>\n` +
      `⏰ <b>Thời gian:</b> ${timeStr}\n` +
      `📋 <b>Mã đặt chuyến:</b> <code>${id}</code>\n` +
      `🚗 <b>Tài xế:</b> ${driverName} (<code>${driverPhone}</code>)\n` +
      `🏷️ <b>Loại xe đã đăng ký:</b> ${declaredCatLabel}\n` +
      `⚡ <b>Vấn đề phản ánh:</b> <b>${mismatchTitle}</b>\n` +
      (cleanActualPlate ? `🔢 <b>Biển số đón thực tế:</b> <code>${cleanActualPlate}</code>\n` : '') +
      (cleanNote ? `📝 <b>Ghi chú của khách:</b> <i>&ldquo;${cleanNote}&rdquo;</i>\n` : '') +
      `👤 <b>Người báo cáo:</b> ${reporterName} (<code>${reporterPhone}</code>)\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👉 <b>Thao tác:</b> Đăng nhập Cổng Admin để bấm 1-chạm đổi sang Biển vàng hoặc khóa tài xế.`;

    sendTelegramMessage(teleMsg, { parseMode: 'HTML' }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Đã tiếp nhận báo cáo sai lệch xe. Ban Quản Trị CarMate sẽ xử lý ngay lập tức để bảo vệ bạn!',
      data: mismatchReport
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
