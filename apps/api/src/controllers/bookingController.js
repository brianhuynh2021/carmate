import {
  getDB,
  getBookings,
  getBookingById,
  getTripById,
  addBooking,
  updateBookingStatus,
  removeBooking,
  updateTrip,
  getUserById,
  getUserByPhone,
  updateUserStatus,
  saveSupportMessage,
  resolveDisputeAndUnban,
  isUserDeactivated
} from '../db/sqliteStore.js';
import { cleanPhoneNumber, normalizePhoneNumber, detectPiiLeak, maskPhoneNumber, isValidVietnamesePhone, isLikelyFakePhone, getPriceGuardrail } from '@carmate/shared';
import crypto from 'crypto';
import { sendBusinessAlert, sendTelegramMessage } from '../utils/telegramAlert.js';

/**
 * So khớp access token thời gian hằng định (chống timing attack).
 */
function tokenMatches(provided, expected) {
  if (!provided || !expected || typeof provided !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Kiểm quyền truy cập booking cho các endpoint Magic Link (không đăng nhập).
 * Cho phép khi: (1) access token khớp, HOẶC (2) người dùng đã đăng nhập là thành viên chuyến,
 * HOẶC (3) là Quản trị viên. Ngăn IDOR enumerate booking bằng cách đoán escrowId (CX-xxxx).
 */
function canAccessBooking(req, booking) {
  const provided = req.query.t || req.query.token || req.body?.accessToken || req.headers['x-booking-token'] || '';
  if (booking.accessToken && tokenMatches(String(provided), booking.accessToken)) return true;

  if (req.user) {
    if (req.user.role === 'admin' || req.user.role === 'super_admin') return true;
    const userPhone = cleanPhoneNumber(req.user.phone || '');
    const parties = [booking.contactPhone, booking.userPhone, booking.creatorPhone, booking.targetPhone, booking.driverPhone, booking.passengerPhone]
      .map((p) => cleanPhoneNumber(p || ''))
      .filter(Boolean);
    if (userPhone && parties.includes(userPhone)) return true;
  }
  return false;
}

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
    let userBookings = [];

    // Quản trị viên hệ thống: Xem toàn bộ
    if (user.role === 'admin' || user.role === 'super_admin') {
      userBookings = allBookings;
    } else {
      // Người dùng thông thường: Chỉ xem các booking của bản thân
      const userPhone = cleanPhoneNumber(user.phone || '');
      userBookings = allBookings.filter((b) => {
        const bContact = cleanPhoneNumber(b.contactPhone || '');
        const bCreator = cleanPhoneNumber(b.userPhone || b.creatorPhone || '');
        const bTarget = cleanPhoneNumber(b.targetPhone || '');
        const bDriver = cleanPhoneNumber(b.driverPhone || '');
        const bPass = cleanPhoneNumber(b.passengerPhone || '');
        return (
          (userPhone && (bContact === userPhone || bCreator === userPhone || bTarget === userPhone || bDriver === userPhone || bPass === userPhone)) ||
          (user.id && (b.userId === user.id || b.creatorId === user.id || b.driverId === user.id))
        );
      });
    }

    const now = Date.now();
    const sanitizedBookings = userBookings.map((b) => {
      // 1. Kiểm tra nếu đang ở pre_confirmed mà quá 15 phút -> tự động chuyển sang expired
      if (b.status === 'pre_confirmed' && b.preConfirmedExpiresAt) {
        const expiresTime = new Date(b.preConfirmedExpiresAt).getTime();
        if (now > expiresTime) {
          b.status = 'expired';
          updateBookingStatus(b.escrowId || b.id, 'expired', { status: 'expired' });
        }
      }

      // 2. BẤT BIẾN ZERO PII: Chỉ mở SĐT thật nếu chuyến đã được chốt chính thức (confirmed)
      const isConfirmed = b.status === 'confirmed' || b.bothConfirmed === true;
      if (!isConfirmed && user?.role !== 'admin' && user?.role !== 'super_admin') {
        return {
          ...b,
          phoneReal: maskPhoneNumber(b.phoneReal || b.contactPhone || ''),
          contactPhone: maskPhoneNumber(b.contactPhone || ''),
          driverPhone: maskPhoneNumber(b.driverPhone || ''),
          passengerPhone: maskPhoneNumber(b.passengerPhone || '')
        };
      }
      return b;
    });

    return res.status(200).json({
      success: true,
      count: sanitizedBookings.length,
      data: sanitizedBookings
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings - Tạo kết nối chuyến mới (Trạng thái ban đầu: inquiring)
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

    // Nếu có tripId, truy vấn SĐT thật của chuyến xe từ DB
    const targetTripId = body.tripId || body.targetTripId || body.targetId || (body.targetItem && body.targetItem.id);
    if (targetTripId) {
      const targetTrip = getTripById(targetTripId);
      if (targetTrip) {
        // BẤT BIẾN MIT: Chặn tự đặt/gửi yêu cầu cho chuyến của chính mình
        const reqUserId = req.user?.id || req.user?.userId || body.userId;
        const reqPhone = normalizePhoneNumber(req.user?.phone || body.passengerPhone || body.userPhone || body.phone || '');
        const tripPhone = normalizePhoneNumber(targetTrip.phoneReal || targetTrip.phone || '');
        const isSelfBooking =
          (reqUserId && targetTrip.userId && reqUserId === targetTrip.userId) ||
          (reqPhone && tripPhone && reqPhone === tripPhone) ||
          (req.user?.telegramId && targetTrip.telegramId && String(req.user.telegramId) === String(targetTrip.telegramId));
        if (isSelfBooking) {
          return res.status(400).json({
            success: false,
            error: 'Bạn không thể gửi yêu cầu ghép cho chính bài đăng của mình.'
          });
        }

        const tripPhoneFinal = targetTrip.phoneReal || targetTrip.phone;
        body.driverPhone = tripPhoneFinal;
        body.targetPhone = tripPhoneFinal;
        body.driverId = targetTrip.userId;
        body.contactPhone = tripPhoneFinal || body.contactPhone;
        body.phoneReal = tripPhoneFinal || body.phoneReal;
        body.contactName = targetTrip.publicName || body.contactName;
        body.targetTripId = targetTrip.id;
        body.date = body.date || targetTrip.date;
        body.time = body.time || targetTrip.time;
        body.timeSlot = body.timeSlot || targetTrip.timeSlot || targetTrip.time;
        body.targetTrip = targetTrip;
        body.targetItem = body.targetItem || targetTrip;
      }
    }

    // BẤT BIẾN MIT: Kiểm tra tính hợp lệ của chi phí thoả thuận (Price Guardrail)
    const dealPrice = Number(body.totalDeal || body.price || 0);
    const seatsCount = Math.max(1, Number(body.seats || 1));
    const perSeatPrice = Math.round(dealPrice / seatsCount);
    if (dealPrice > 0) {
      const guardrail = getPriceGuardrail(body.from, body.to, perSeatPrice);
      if (perSeatPrice < 15000 && (guardrail?.distanceKm || 0) > 30) {
        return res.status(400).json({
          success: false,
          error: 'Mức phụ xăng đề xuất quá thấp (tối thiểu 15.000đ cho chuyến liên tỉnh).'
        });
      }
      if (guardrail?.maxSafePrice && perSeatPrice > guardrail.maxSafePrice * 3) {
        return res.status(400).json({
          success: false,
          error: 'Mức phụ xăng vượt quá khung chia sẻ tối đa cho phép.'
        });
      }
    }

    // Mặc định trạng thái ban đầu là 'inquiring' (Hỏi ghép / Thương lượng ẩn danh)
    body.status = body.status || 'inquiring';
    body.commitmentType = body.commitmentType || 'inquiry_chat';
    body.messages = Array.isArray(body.messages) ? body.messages : [];

    // Nếu có lời nhắn từ khách, khởi tạo tin nhắn đầu tiên trong khung chat
    if (body.passengerNote && body.messages.length === 0) {
      body.messages.push({
        id: `MSG-${Date.now()}`,
        senderRole: 'passenger',
        senderName: body.contactName || 'Người đi cùng',
        text: body.passengerNote,
        createdAt: new Date().toISOString()
      });
    }

    const booking = await addBooking(body);

    // Bắn thông báo Telegram về điện thoại của founder (0 chi phí)
    sendBusinessAlert({
      title: '💬 Yêu cầu ghép chuyến mới từ Người đi cùng',
      details: {
        'Mã yêu cầu': booking.id || booking.escrowId,
        'Lộ trình': `${booking.from} ➔ ${booking.to}`,
        'Khởi hành': `${booking.date || 'Hôm nay'} ${booking.time || ''}`.trim(),
        'Chuyến liên kết': targetTripId || 'Tự do',
        'Số ghế': booking.seatsBooked || booking.seats || 1,
        'Điểm đón đề xuất': booking.pickupPoint || 'Thỏa thuận tiện đường',
        'Ghi chú': booking.passengerNote || 'Không có ghi chú'
      },
      req
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Đã gửi yêu cầu ghép chuyến thành công',
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
 * Dùng cho Chủ xe mở Magic Link từ Zalo (Không cần đăng nhập, bảo vệ PII)
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

    // Chống IDOR: chỉ trả tóm tắt (chứa tên khách/tài xế, lộ trình, số tiền) cho ai có
    // access token hợp lệ hoặc là thành viên chuyến/Admin. escrowId (CX-xxxx) dễ đoán.
    if (!canAccessBooking(req, booking)) {
      return res.status(403).json({
        success: false,
        error: 'Liên kết không hợp lệ hoặc bạn không có quyền xem chuyến đi này'
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
        driverName: booking.driverName || 'Chủ xe',
        createdAt: booking.createdAt
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/driver-confirm - Chủ xe xác nhận đón 1 chạm từ Magic link Zalo (Không cần đăng nhập)
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

    // Chống IDOR: chỉ chủ xe cầm Magic Link hợp lệ (token) hoặc thành viên chuyến/Admin
    // mới được xác nhận đón. Trước đây bất kỳ ai đoán được escrowId đều xác nhận hộ được.
    if (!canAccessBooking(req, existing)) {
      return res.status(403).json({
        success: false,
        error: 'Liên kết xác nhận không hợp lệ hoặc bạn không có quyền thao tác chuyến đi này'
      });
    }

    const updated = await updateBookingStatus(id, 'driver_confirmed', {
      driverConfirmed: true,
      driverConfirmedAt: new Date().toISOString(),
      driverNote: driverNote || 'Chủ xe đã bấm nhận đón qua Magic Link Zalo'
    });

    return res.status(200).json({
      success: true,
      message: 'Chủ xe đã xác nhận đón thành công! Hệ thống đã ghi nhận lịch hẹn.',
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/messages - Gửi tin nhắn trao đổi trong khung chat ẩn danh
 * Bảo vệ AI PII: Tự động phát hiện và chặn lách số điện thoại / từ khóa ngoài nền tảng
 */
export async function addBookingMessageHandler(req, res) {
  try {
    const { id } = req.params;
    const { senderRole = 'passenger', senderName = '' } = req.body || {};
    const text = (req.body?.text || req.body?.message || '').trim();

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Nội dung tin nhắn không được để trống'
      });
    }

    const booking = getBookingById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy thông tin cuộc trò chuyện'
      });
    }

    const isConfirmed = booking.status === 'confirmed' || booking.bothConfirmed === true;
    const isPreConfirmed = booking.status === 'pre_confirmed';
    const isDealCommitted = isConfirmed || isPreConfirmed;

    // 1. Xác định danh tính người gửi (User ID hoặc Số điện thoại)
    let senderUser = null;
    let senderKey = null;
    if (req.user) {
      senderKey = req.user.id || req.user.phone;
      senderUser = getUserById(req.user.id) || getUserByPhone(req.user.phone) || req.user;
    }
    if (!senderUser) {
      const senderPhone = senderRole === 'driver'
        ? (booking.driverPhone || booking.phoneReal || booking.contactPhone)
        : (booking.passengerPhone || booking.userPhone || booking.contactPhone);
      const senderId = senderRole === 'driver' ? booking.driverId : booking.userId;
      senderKey = senderId || senderPhone;
      if (senderId) senderUser = getUserById(senderId);
      if (!senderUser && senderPhone) senderUser = getUserByPhone(senderPhone);
    }

    // 2. Kiểm tra nếu tài khoản hoặc phiên đã bị cấm (Banned Check)
    if (senderUser && isUserDeactivated(senderUser)) {
      return res.status(403).json({
        success: false,
        isBanned: true,
        isDeactivated: true,
        error: '⛔ TÀI KHOẢN ĐÃ BỊ VÔ HIỆU HÓA VĨNH VIỄN: Thời hạn ân hạn khiếu nại (3 ngày) đã kết thúc. Bạn không thể sử dụng hệ thống nữa.'
      });
    }

    if (senderUser?.isBanned || booking.isBanned) {
      return res.status(403).json({
        success: false,
        isBanned: true,
        deactivateAt: senderUser?.deactivateAt,
        error: '⛔ Tài khoản của bạn đang bị tạm khóa đăng bài/đặt chuyến do vi phạm quy chế. Bạn có 3 ngày ân hạn để mở Kênh CSKH khiếu nại trước khi tài khoản bị vô hiệu hóa hoàn toàn.'
      });
    }

    // 3. THUẬT TOÁN AI PII & CHẾ TÀI BẬC THANG (3-Strike Progressive Sanction)
    // Khi chuyến đi đã được một bên đề xuất chốt / giữ chỗ 15p (pre_confirmed) hoặc đã chốt chính thức (confirmed),
    // hai bên hoàn toàn được phép trao đổi số điện thoại, Zalo, địa chỉ đón chi tiết mà không bị chặn hay phạt.
    if (!isDealCommitted) {
      const piiCheck = detectPiiLeak(text);
      if (piiCheck.hasLeak) {
        const currentStrikes = Number(senderUser?.piiStrikes || booking?.piiStrikes?.[senderRole] || 0);
        const newStrikes = currentStrikes + 1;
        const bookingStrikes = { ...(booking.piiStrikes || {}), [senderRole]: newStrikes };
        const existingMsgs = Array.isArray(booking.messages) ? booking.messages : [];

        if (newStrikes === 1) {
          // LẦN 1: Cảnh báo nhẹ, chặn gửi tin + GỬI THƯ CẢNH BÁO HỆ THỐNG
          if (senderKey) {
            await updateUserStatus(senderKey, { piiStrikes: 1 });
          }

          const warningNoticeMsg = {
            id: `SYS-WARN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            senderRole: 'system',
            senderName: 'Hệ thống CarMate',
            isSystem: true,
            isWarningNotice: true,
            noticeType: 'strike_warning',
            strike: 1,
            detectedSample: piiCheck.detectedSample || '',
            warningMessage: piiCheck.warningMessage,
            canDispute: true,
            text: `⚠️ THƯ CẢNH BÁO QUY CHẾ (Lần 1/3): Hệ thống phát hiện nội dung có chứa số điện thoại hoặc kênh liên lạc ngoài luồng khi chưa chốt chuyến: "${piiCheck.detectedSample || ''}". Vui lòng trao đổi trên CarMate và bấm [Đề xuất chốt & Giữ chỗ 15p] để mở khóa SĐT an toàn. Nếu bạn gõ nhầm địa chỉ hoặc số nhà, hãy bấm nút [Khiếu nại / Kháng nghị] bên dưới.`,
            createdAt: new Date().toISOString()
          };

          await updateBookingStatus(id, booking.status, {
            piiStrikes: bookingStrikes,
            messages: [...existingMsgs, warningNoticeMsg],
            lastMessageAt: warningNoticeMsg.createdAt
          });

          return res.status(400).json({
            success: false,
            strike: 1,
            violationLevel: 'warning',
            warningNotice: warningNoticeMsg,
            error: `⚠️ CẢNH BÁO VI PHẠM (Lần 1/3): ${piiCheck.warningMessage} Vui lòng thỏa thuận trên CarMate và bấm [Đề xuất chốt] để mở khóa an toàn.`,
            reason: piiCheck.reason,
            detectedSample: piiCheck.detectedSample
          });
        } else if (newStrikes === 2) {
          // LẦN 2: Cảnh cáo nghiêm trọng + HẠ ĐIỂM TÍN NHIỆM (-15 ĐIỂM) + THƯ XỬ PHẠT
          const currentTrust = Number(senderUser?.trustScore ?? 98);
          const newTrustScore = Math.max(0, currentTrust - 15);

          if (senderKey) {
            await updateUserStatus(senderKey, {
              trustScore: newTrustScore,
              piiStrikes: 2
            });
          }

          const penaltyNoticeMsg = {
            id: `SYS-WARN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            senderRole: 'system',
            senderName: 'Hệ thống CarMate',
            isSystem: true,
            isWarningNotice: true,
            noticeType: 'strike_penalty',
            strike: 2,
            deductedPoints: 15,
            trustScore: newTrustScore,
            detectedSample: piiCheck.detectedSample || '',
            warningMessage: piiCheck.warningMessage,
            canDispute: true,
            text: `🚨 QUYẾT ĐỊNH XỬ PHẠT TÍN NHIỆM (Lần 2/3): Bạn tiếp tục cố tình chia sẻ thông tin liên lạc ngoài luồng: "${piiCheck.detectedSample || ''}". Hệ thống đã TRỪ -15 ĐIỂM TÍN NHIỆM (còn ${newTrustScore}/100). Vi phạm thêm lần nữa, tài khoản sẽ bị KHÓA CẤM VĨNH VIỄN (BAN)! Nếu đây là sự nhầm lẫn, hãy bấm [Khiếu nại / Kháng nghị] ngay.`,
            createdAt: new Date().toISOString()
          };

          await updateBookingStatus(id, booking.status, {
            piiStrikes: bookingStrikes,
            trustScore: newTrustScore,
            messages: [...existingMsgs, penaltyNoticeMsg],
            lastMessageAt: penaltyNoticeMsg.createdAt
          });

          // Báo động Telegram cho Founder
          sendBusinessAlert({
            title: '🚨 VI PHẠM PII LẦN 2: TRỪ 15 ĐIỂM TÍN NHIỆM',
            details: {
              'Mã yêu cầu': id,
              'Người vi phạm': senderUser?.name || senderName || 'Thành viên',
              'SĐT/ID': senderKey || 'N/A',
              'Điểm tín nhiệm cũ': `${currentTrust}/100`,
              'Điểm tín nhiệm MỚI': `${newTrustScore}/100 (-15đ)`,
              'Nội dung vi phạm': text
            },
            req
          }).catch(() => {});

          return res.status(400).json({
            success: false,
            strike: 2,
            violationLevel: 'penalty',
            trustScore: newTrustScore,
            deductedPoints: 15,
            warningNotice: penaltyNoticeMsg,
            error: `🚨 CẢNH CÁO VI PHẠM NGHIÊM TRỌNG (Lần 2/3): Bạn tiếp tục cố tình luồn lách thông tin liên lạc! Hệ thống đã TRỪ -15 ĐIỂM TÍN NHIỆM (còn ${newTrustScore}/100). Vi phạm thêm lần nữa, tài khoản sẽ bị KHÓA CẤM VĨNH VIỄN (BAN)!`,
            reason: piiCheck.reason,
            detectedSample: piiCheck.detectedSample
          });
        } else {
          // LẦN 3 TRỞ ĐI: KHÓA TÀI KHOẢN VỚI THỜI HẠN ÂN HẠN 3 NGÀY (72H GRACE PERIOD)
          const bannedAt = Date.now();
          const deactivateAt = bannedAt + 3 * 24 * 60 * 60 * 1000; // 3 ngày ân hạn

          if (senderKey) {
            await updateUserStatus(senderKey, {
              isBanned: true,
              status: 'suspended',
              bannedAt,
              deactivateAt,
              piiStrikes: newStrikes,
              banReason: 'Cố tình chia sẻ SĐT/kênh liên lạc ngoài luồng 3 lần liên tiếp'
            });
          }

          const banNoticeMsg = {
            id: `SYS-WARN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            senderRole: 'system',
            senderName: 'Hệ thống CarMate',
            isSystem: true,
            isWarningNotice: true,
            noticeType: 'strike_ban',
            strike: 3,
            bannedAt,
            deactivateAt,
            detectedSample: piiCheck.detectedSample || '',
            warningMessage: piiCheck.warningMessage,
            canDispute: true,
            text: `⛔ THÔNG BÁO TẠM ĐÌNH CHỈ TÀI KHOẢN (Cấp 3): Tài khoản của bạn đã bị hạn chế đăng bài và đặt chuyến do vi phạm quy chế 3 lần liên tiếp. Bạn có thời gian ân hạn 3 ngày để bấm [Khiếu nại / Chat CSKH] giải trình trước khi tài khoản bị vô hiệu hóa hoàn toàn.`,
            createdAt: new Date().toISOString()
          };

          await updateBookingStatus(id, booking.status, {
            piiStrikes: bookingStrikes,
            isBanned: true,
            messages: [...existingMsgs, banNoticeMsg],
            lastMessageAt: banNoticeMsg.createdAt
          });

          // Báo động Telegram Khẩn Cấp
          sendBusinessAlert({
            title: '⛔ TÀI KHOẢN BỊ KHÓA (AUTO-BAN): Vi phạm PII 3 lần liên tiếp (Ân hạn 3 ngày)',
            details: {
              'Mã yêu cầu': id,
              'Thành viên bị khóa': senderUser?.name || senderName || 'Thành viên',
              'SĐT/ID': senderKey || 'N/A',
              'Lý do': 'Chia sẻ thông tin ngoài luồng 3 lần liên tiếp',
              'Thời hạn ân hạn': '72 giờ (3 ngày) trước khi vô hiệu hóa vĩnh viễn',
              'Nội dung vi phạm': text
            },
            req
          }).catch(() => {});

          return res.status(403).json({
            success: false,
            strike: newStrikes,
            violationLevel: 'banned',
            isBanned: true,
            bannedAt,
            deactivateAt,
            warningNotice: banNoticeMsg,
            error: '⛔ TÀI KHOẢN ĐÃ BỊ KHÓA VĨNH VIỄN (BAN): Bạn đã vi phạm chính sách bảo mật thông tin liên tục 3 lần. Tính năng đăng bài đã bị đình chỉ (Thời gian ân hạn khiếu nại: 3 ngày).',
            reason: piiCheck.reason,
            detectedSample: piiCheck.detectedSample
          });
        }
      }
    }

    const newMsg = {
      id: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderRole,
      senderName: senderName || (senderRole === 'driver' ? 'Chủ xe' : 'Người đi cùng'),
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    const existingMsgs = Array.isArray(booking.messages) ? booking.messages : [];
    const updatedMsgs = [...existingMsgs, newMsg];

    // Mô phỏng phản hồi thân thiện của Chủ xe đối với chuyến đi mẫu (Single-tester Demo Simulation)
    const isMockTrip = Boolean(
      booking.targetTripId?.startsWith('DRV-') ||
      booking.driverPhone?.startsWith('0900') ||
      booking.targetItem?.maskedCode?.startsWith('CX-') ||
      booking.targetTrip?.maskedCode?.startsWith('CX-')
    );

    if (isMockTrip && senderRole === 'passenger' && !booking.bothConfirmed) {
      let driverReplyText = 'Dạ ok bạn, mình đón tại đúng điểm hẹn trên đường nhé! Mình nhất trí chốt chuyến.';
      const lowerText = text.toLowerCase();
      if (/(vali|balo|hành lý|đồ|cốp)/i.test(lowerText)) {
        driverReplyText = '🧳 Cốp xe rộng rãi thoải mái nhé bạn! Mình đón đúng điểm hẹn, bạn bấm [Đề xuất chốt & Giữ chỗ 15p] để mình giữ ghế nha.';
      } else if (/(cây xăng|ngã tư|bến xe|điểm|đón|ở đâu|chỗ)/i.test(lowerText)) {
        driverReplyText = '📍 Dạ ok bạn, mình đón đúng điểm hẹn trên đường nhé! Mình giữ chỗ cho bạn luôn.';
      }

      const hostMsg = {
        id: `MSG-HOST-${Date.now()}`,
        senderRole: 'driver',
        senderName: booking.contactName || 'Chủ xe',
        text: driverReplyText,
        createdAt: new Date(Date.now() + 100).toISOString()
      };
      updatedMsgs.push(hostMsg);
    }

    const updated = await updateBookingStatus(id, booking.status, {
      messages: updatedMsgs,
      lastMessageAt: newMsg.createdAt
    });

    return res.status(200).json({
      success: true,
      message: 'Đã gửi tin nhắn thành công',
      data: {
        newMessage: newMsg,
        booking: updated
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/pre-confirm - Đề xuất chốt chuyến & Khóa mềm ghế có thời hạn (15 phút TTL)
 */
export async function preConfirmBookingHandler(req, res) {
  try {
    const { id } = req.params;
    const { preConfirmedBy = 'driver', note = '' } = req.body || {};

    const existing = getBookingById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy yêu cầu chuyến đi để đề xuất chốt'
      });
    }

    if (existing.status === 'confirmed' || existing.bothConfirmed) {
      return res.status(400).json({
        success: false,
        error: 'Chuyến đi này đã được chốt chính thức trước đó'
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 phút TTL

    const proposerTitle = preConfirmedBy === 'driver' ? 'Chủ xe' : 'Người đi cùng';
    const receiverTitle = preConfirmedBy === 'driver' ? 'Người đi cùng' : 'Chủ xe';

    const systemMsg = {
      id: `SYS-${Date.now()}`,
      senderRole: 'system',
      senderName: 'Hệ thống CarMate',
      isSystem: true,
      text: `⚡ ${proposerTitle} đã ĐỀ XUẤT CHỐT CHUYẾN & tạm giữ chỗ trong 15 phút. Vui lòng ${receiverTitle} bấm [Xác nhận chốt] để hoàn tất chuyến đi!`,
      createdAt: now.toISOString()
    };

    const existingMsgs = Array.isArray(existing.messages) ? existing.messages : [];
    const updatedMsgs = [...existingMsgs, systemMsg];

    const updated = await updateBookingStatus(id, 'pre_confirmed', {
      preConfirmedBy,
      preConfirmedAt: now.toISOString(),
      preConfirmedExpiresAt: expiresAt.toISOString(),
      preConfirmNote: note || '',
      messages: updatedMsgs,
      lastMessageAt: now.toISOString()
    });

    // Alert Telegram
    sendBusinessAlert({
      title: '⚡ Đề xuất chốt chuyến (Pre-confirm) mới',
      details: {
        'Mã yêu cầu': id,
        'Người đề xuất': proposerTitle,
        'Thời hạn': '15 phút đếm ngược',
        'Lộ trình': `${existing.from} ➔ ${existing.to}`
      },
      req
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `${proposerTitle} đã đề xuất chốt chuyến. Chỗ được tạm giữ trong 15 phút.`,
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/final-confirm - Xác nhận chốt chuyến chính thức (Mutual Commitment - 2PC)
 * Trừ ghế cứng và chính thức mở khóa số điện thoại thật của 2 bên
 */
export async function finalConfirmBookingHandler(req, res) {
  try {
    const { id } = req.params;
    const { confirmedBy = 'passenger', note = '' } = req.body || {};

    const existing = getBookingById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy yêu cầu chuyến đi để xác nhận'
      });
    }

    // Kiểm tra nếu đã quá 15 phút TTL
    if (existing.status === 'pre_confirmed' && existing.preConfirmedExpiresAt) {
      if (Date.now() > new Date(existing.preConfirmedExpiresAt).getTime()) {
        await updateBookingStatus(id, 'expired');
        return res.status(400).json({
          success: false,
          error: 'Thời hạn 15 phút giữ chỗ đã hết hạn. Vui lòng thỏa thuận lại!'
        });
      }
    }

    const now = new Date();
    const systemMsg = {
      id: `SYS-${Date.now()}`,
      senderRole: 'system',
      senderName: 'Hệ thống CarMate',
      isSystem: true,
      text: '🎉 Chúc mừng 2 bạn! Chuyến đi đã được CHỐT CHÍNH THỨC 2 CHIỀU. Thông tin liên hệ đầy đủ đã được mở khóa an toàn.',
      createdAt: now.toISOString()
    };

    const existingMsgs = Array.isArray(existing.messages) ? existing.messages : [];
    const updatedMsgs = [...existingMsgs, systemMsg];

    // Trừ ghế thật (Hard Lock) trên chuyến xe
    const targetTripId = existing.tripId || existing.targetTripId;
    if (targetTripId) {
      const trip = getTripById(targetTripId);
      if (trip && typeof trip.availableSeats === 'number') {
        const seatsBooked = existing.seatsBooked || existing.seats || 1;
        const remainingSeats = Math.max(0, trip.availableSeats - seatsBooked);
        await updateTrip(targetTripId, { availableSeats: remainingSeats });
      }
    }

    const updated = await updateBookingStatus(id, 'confirmed', {
      bothConfirmed: true,
      confirmedAt: now.toISOString(),
      confirmedBy,
      confirmNote: note || '',
      messages: updatedMsgs,
      lastMessageAt: now.toISOString()
    });

    // Alert Telegram
    sendBusinessAlert({
      title: '🎉 KHỚP CHUYẾN THÀNH CÔNG (Mutual Final Committed)',
      details: {
        'Mã chuyến': id,
        'Lộ trình': `${existing.from} ➔ ${existing.to}`,
        'Tổng phụ xăng': `${existing.totalDeal || 0}đ`,
        'SĐT Chủ xe': existing.driverPhone || existing.contactPhone || 'N/A',
        'SĐT Khách': existing.passengerPhone || existing.userPhone || 'N/A'
      },
      req
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Chuyến đi đã được chốt chính thức thành công!',
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
    const driverName = trip?.publicName || booking.driverName || 'Chủ xe';
    const driverPhone = trip?.phoneReal || trip?.phone || booking.driverPhone || booking.contactPhone || 'N/A';
    const cleanActualPlate = String(actualPlate || '')
      .trim()
      .toUpperCase();
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
      `⚠️ <b>Người đi cùng vừa báo cáo xe đón không đúng mô tả!</b>\n` +
      `⏰ <b>Thời gian:</b> ${timeStr}\n` +
      `📋 <b>Mã đặt chuyến:</b> <code>${id}</code>\n` +
      `🚗 <b>Chủ xe:</b> ${driverName} (<code>${driverPhone}</code>)\n` +
      `🏷️ <b>Loại xe đã đăng ký:</b> ${declaredCatLabel}\n` +
      `⚡ <b>Vấn đề phản ánh:</b> <b>${mismatchTitle}</b>\n` +
      (cleanActualPlate ? `🔢 <b>Biển số đón thực tế:</b> <code>${cleanActualPlate}</code>\n` : '') +
      (cleanNote ? `📝 <b>Ghi chú của người đi cùng:</b> <i>&ldquo;${cleanNote}&rdquo;</i>\n` : '') +
      `👤 <b>Người báo cáo:</b> ${reporterName} (<code>${reporterPhone}</code>)\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👉 <b>Thao tác:</b> Đăng nhập Cổng Admin để bấm 1-chạm đổi sang Biển vàng hoặc khóa tài khoản vi phạm.`;

    sendTelegramMessage(teleMsg, { parseMode: 'HTML', req }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Đã tiếp nhận báo cáo sai lệch xe. Ban Quản Trị CarMate sẽ xử lý ngay lập tức để bảo vệ bạn!',
      data: mismatchReport
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/report-unreachable-phone - Báo cáo số điện thoại ảo / không liên lạc được
 * Chế tài trừng phạt: Trừ 30 điểm tín nhiệm đối tác, khóa tài khoản nếu tái phạm.
 * Huỷ chuyến an toàn cho người báo cáo (không ảnh hưởng điểm uy tín).
 */
export async function reportUnreachablePhone(req, res) {
  try {
    const { id } = req.params;
    const { reason = 'fake_number', note = '', reporterRole } = req.body || {};

    const booking = getBookingById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy chuyến đi để báo cáo'
      });
    }

    // Xác định vai trò người báo cáo
    const reqPhone = cleanPhoneNumber(req.user?.phone || '');
    const isDriverReporter =
      reporterRole === 'driver' ||
      (req.user?.id && booking.driverId && req.user.id === booking.driverId) ||
      (reqPhone && booking.driverPhone && cleanPhoneNumber(booking.driverPhone) === reqPhone);

    const effectiveReporterRole = isDriverReporter ? 'driver' : 'passenger';
    const targetRole = effectiveReporterRole === 'driver' ? 'passenger' : 'driver';

    const reporterName =
      effectiveReporterRole === 'driver'
        ? booking.driverName || req.user?.name || 'Chủ xe'
        : booking.passengerName || booking.contactName || req.user?.name || 'Người đi cùng';

    const reporterPhone =
      effectiveReporterRole === 'driver'
        ? booking.driverPhone || req.user?.phone || 'N/A'
        : booking.passengerPhone || booking.userPhone || req.user?.phone || 'N/A';

    const targetName =
      effectiveReporterRole === 'driver'
        ? booking.passengerName || booking.contactName || 'Người đi cùng'
        : booking.driverName || 'Chủ xe';

    const targetPhone =
      effectiveReporterRole === 'driver'
        ? booking.passengerPhone || booking.userPhone || ''
        : booking.driverPhone || booking.contactPhone || '';

    const targetUserId =
      effectiveReporterRole === 'driver'
        ? booking.passengerId || booking.userId || (targetPhone ? 'USR-' + cleanPhoneNumber(targetPhone) : null)
        : booking.driverId || (targetPhone ? 'USR-' + cleanPhoneNumber(targetPhone) : null);

    const reasonLabels = {
      fake_number: 'Số điện thoại không có thực / Thuê bao không tồn tại',
      unreachable: 'Gọi liên tục không liên lạc được / Tắt máy',
      rejected: 'Nhầm số / Bị người lạ chửi bới / Không nhận đặt xe',
      no_answer: 'Đổ chuông nhưng cố tình không nhấc máy'
    };
    const reasonText = reasonLabels[reason] || reason;

    // Trừng phạt đối tượng bị báo cáo (Trừ 30 điểm tín nhiệm)
    let punishedUser = null;
    if (targetUserId || targetPhone) {
      const db = getDB();
      const cleanTargetPhone = cleanPhoneNumber(targetPhone);
      const existingUser = (db.users || []).find(
        (u) =>
          (targetUserId && u.id === targetUserId) ||
          (cleanTargetPhone && cleanPhoneNumber(u.phone || '') === cleanTargetPhone)
      );

      const currentTrust = existingUser ? existingUser.trustScore ?? 100 : 100;
      const newTrustScore = Math.max(0, currentTrust - 30);
      const strikes = (existingUser?.fakePhoneStrikes || 0) + 1;
      const shouldBan = strikes >= 2 || newTrustScore <= 20;

      punishedUser = await updateUserStatus(targetUserId || 'USR-' + cleanTargetPhone, {
        phone: cleanTargetPhone || existingUser?.phone,
        name: existingUser?.name || targetName,
        trustScore: newTrustScore,
        fakePhoneStrikes: strikes,
        hasFakePhoneWarning: true,
        lastReportedFakePhoneAt: new Date().toISOString(),
        ...(shouldBan ? { isBanned: true, banReason: 'Bị báo cáo số điện thoại ảo / không liên lạc được nhiều lần' } : {})
      });
    }

    const reportData = {
      id: `UNREACHABLE-${Date.now()}`,
      bookingId: id,
      tripId: booking.tripId || null,
      reporterRole: effectiveReporterRole,
      reporterName,
      reporterPhone,
      targetRole,
      targetName,
      targetPhone,
      targetUserId,
      reason,
      reasonText,
      note: String(note || '').trim(),
      penaltyApplied: {
        trustScoreDeducted: 30,
        punishedUserId: targetUserId,
        isBanned: punishedUser?.isBanned || false
      },
      reportedAt: new Date().toISOString()
    };

    // Cập nhật trạng thái booking: Huỷ chuyến an toàn
    const updated = await updateBookingStatus(id, 'cancelled', {
      cancelReason: `Huỷ an toàn: ${reporterName} báo cáo đối tác dùng số điện thoại không liên lạc được (${reasonText})`,
      cancelledAt: new Date().toISOString(),
      unreachablePhoneReport: reportData
    });

    // Gửi cảnh báo Telegram tức thì (0đ chi phí)
    const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const teleMsg =
      `🚨 <b>[CARMATE PHÁT HIỆN SỐ ẢO / KHÔNG LIÊN LẠC ĐƯỢC]</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ <b>${reporterName} (${effectiveReporterRole === 'driver' ? 'Chủ xe' : 'Khách'}) vừa báo cáo đối tác!</b>\n` +
      `⏰ <b>Thời gian:</b> ${timeStr}\n` +
      `📋 <b>Mã chuyến:</b> <code>${id}</code>\n` +
      `🎯 <b>Đối tượng bị phản ánh:</b> ${targetName} (<code>${targetPhone || 'Không rõ SĐT'}</code>)\n` +
      `⚡ <b>Lý do:</b> <b>${reasonText}</b>\n` +
      (note ? `📝 <b>Chi tiết:</b> <i>&ldquo;${note}&rdquo;</i>\n` : '') +
      `⚖️ <b>Chế tài tự động:</b> Trừ 30đ tín nhiệm${punishedUser?.isBanned ? ' & ĐÃ KHÓA TÀI KHOẢN VI PHẠM' : ''}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👉 <b>Hệ thống CarMate</b> đã tự động huỷ chuyến an toàn bảo vệ người bị hại.`;

    sendTelegramMessage(teleMsg, { parseMode: 'HTML', req }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Đã tiếp nhận báo cáo. Hệ thống đã trừ 30 điểm tín nhiệm đối tác và huỷ chuyến an toàn cho bạn.',
      data: {
        booking: updated,
        report: reportData
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Đặt lại trạng thái vi phạm và gỡ bỏ khóa (Unban / Reset Strikes)
 * Dành cho người dùng khôi phục tài khoản hoặc môi trường thử nghiệm
 */
export async function resetBanHandler(req, res) {
  try {
    const { id } = req.params;
    const booking = getBookingById(id);
    if (booking) {
      await updateBookingStatus(id, booking.status, { isBanned: false, piiStrikes: {} });
      if (booking.driverPhone) {
        await updateUserStatus(booking.driverPhone, { isBanned: false, piiStrikes: 0, status: 'active' });
      }
      if (booking.passengerPhone) {
        await updateUserStatus(booking.passengerPhone, { isBanned: false, piiStrikes: 0, status: 'active' });
      }
      if (booking.contactPhone) {
        await updateUserStatus(booking.contactPhone, { isBanned: false, piiStrikes: 0, status: 'active' });
      }
      if (booking.userPhone) {
        await updateUserStatus(booking.userPhone, { isBanned: false, piiStrikes: 0, status: 'active' });
      }
      if (booking.phoneReal) {
        await updateUserStatus(booking.phoneReal, { isBanned: false, piiStrikes: 0, status: 'active' });
      }
      if (booking.userId) {
        await updateUserStatus(booking.userId, { isBanned: false, piiStrikes: 0, status: 'active' });
      }
      if (booking.driverId) {
        await updateUserStatus(booking.driverId, { isBanned: false, piiStrikes: 0, status: 'active' });
      }
    }
    const user = req.user;
    if (user?.id || user?.phone) {
      await updateUserStatus(user.id || user.phone, { isBanned: false, piiStrikes: 0, status: 'active' });
    }
    return res.status(200).json({
      success: true,
      message: 'Đã mở khóa tài khoản và thiết lập lại trạng thái vi phạm.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/dispute - Tiếp nhận khiếu nại (Dispute) cảnh báo hoặc ban
 */
export async function disputeBookingHandler(req, res) {
  try {
    const { id } = req.params;
    const { reason = 'Gõ nhầm địa chỉ / số nhà', note = '', reporterRole = 'user' } = req.body || {};

    const booking = getBookingById(id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi để khiếu nại' });
    }

    const senderKey = req.user?.id || req.user?.phone || booking.passengerPhone || booking.driverPhone || booking.contactPhone;

    // 1. Lưu vào support_messages
    saveSupportMessage({
      bookingId: id,
      userId: req.user?.id || booking.userId || booking.driverId,
      phone: req.user?.phone || booking.passengerPhone || booking.driverPhone || booking.contactPhone,
      senderRole: 'user',
      senderName: req.user?.name || (reporterRole === 'driver' ? 'Chủ xe' : 'Người đi cùng'),
      message: `[KHIẾU NẠI CHUYẾN #${id}] Lý do: ${reason}. Ghi chú: ${note || 'Không có'}`,
      type: 'strike_dispute',
      status: 'resolved'
    });

    // 2. Mở khóa và gỡ bỏ vi phạm ngay lập tức (Stanford Ergonomics & Instant Relief)
    await resolveDisputeAndUnban({
      bookingId: id,
      userId: req.user?.id || booking.userId || booking.driverId,
      phone: senderKey,
      reason,
      note
    });

    // 3. Tạo tin nhắn xác nhận giải quyết từ Ban Quản Trị trong chat
    const resolutionMsg = {
      id: `SYS-DISPUTE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderRole: 'system',
      senderName: 'Ban Quản Trị CarMate',
      isSystem: true,
      isDisputeResolved: true,
      text: `✅ KHIẾU NẠI ĐÃ ĐƯỢC CHẤP THUẬN: Hệ thống đã kiểm tra nội dung giải trình của bạn ("${reason}${note ? ' - ' + note : ''}"). Cảnh báo vi phạm đã được gỡ bỏ và tài khoản được phục hồi quyền hoạt động bình thường.`,
      createdAt: new Date().toISOString()
    };

    const existingMsgs = Array.isArray(booking.messages) ? booking.messages : [];
    const updated = await updateBookingStatus(id, booking.status, {
      isBanned: false,
      piiStrikes: {},
      messages: [...existingMsgs, resolutionMsg],
      lastMessageAt: resolutionMsg.createdAt
    });

    // 4. Gửi thông báo Telegram cho Admin
    sendBusinessAlert({
      title: '✅ KHIẾU NẠI PII THÀNH CÔNG: Đã gỡ cảnh báo / mở khóa tài khoản',
      details: {
        'Mã chuyến': id,
        'Thành viên khiếu nại': req.user?.name || senderKey || 'Thành viên',
        'Lý do khiếu nại': reason,
        'Ghi chú giải trình': note || 'N/A'
      },
      req
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Khiếu nại đã được ghi nhận và xử lý thành công. Tài khoản đã được khôi phục.',
      data: { booking: updated, resolutionMessage: resolutionMsg }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

