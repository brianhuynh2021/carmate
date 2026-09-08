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
  updateUserStatus
} from '../db/sqliteStore.js';
import { cleanPhoneNumber, detectPiiLeak, maskPhoneNumber } from '@carmate/shared';
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
        const reqPhone = cleanPhoneNumber(req.user?.phone || body.contactPhone || body.phone || body.passengerPhone || body.userPhone || '');
        const tripPhone = cleanPhoneNumber(targetTrip.phoneReal || targetTrip.phone || '');
        const isSelfBooking = (req.user?.id && targetTrip.userId && req.user.id === targetTrip.userId) ||
                              (reqPhone && tripPhone && reqPhone === tripPhone);
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
    const { text = '', senderRole = 'passenger', senderName = '' } = req.body || {};

    if (!text || !text.trim()) {
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
    if (senderUser?.isBanned || booking.isBanned) {
      return res.status(403).json({
        success: false,
        isBanned: true,
        error: '⛔ Tài khoản của bạn đã bị khóa do vi phạm quy chế bảo mật cộng đồng.'
      });
    }

    // 3. THUẬT TOÁN AI PII & CHẾ TÀI BẬC THANG (3-Strike Progressive Sanction)
    if (!isConfirmed) {
      const piiCheck = detectPiiLeak(text);
      if (piiCheck.hasLeak) {
        const currentStrikes = Number(senderUser?.piiStrikes || booking?.piiStrikes?.[senderRole] || 0);
        const newStrikes = currentStrikes + 1;
        const bookingStrikes = { ...(booking.piiStrikes || {}), [senderRole]: newStrikes };

        if (newStrikes === 1) {
          // LẦN 1: Cảnh báo nhẹ, chặn gửi tin
          if (senderKey) {
            await updateUserStatus(senderKey, { piiStrikes: 1 });
          }
          await updateBookingStatus(id, booking.status, { piiStrikes: bookingStrikes });

          return res.status(400).json({
            success: false,
            strike: 1,
            violationLevel: 'warning',
            error: `⚠️ CẢNH BÁO VI PHẠM (Lần 1/3): ${piiCheck.warningMessage} Vui lòng thỏa thuận trên CarMate và bấm [Đề xuất chốt] để mở khóa an toàn.`,
            reason: piiCheck.reason,
            detectedSample: piiCheck.detectedSample
          });
        } else if (newStrikes === 2) {
          // LẦN 2: Cảnh cáo nghiêm trọng + HẠ ĐIỂM TÍN NHIỆM (-15 ĐIỂM)
          const currentTrust = Number(senderUser?.trustScore ?? 98);
          const newTrustScore = Math.max(0, currentTrust - 15);

          if (senderKey) {
            await updateUserStatus(senderKey, {
              trustScore: newTrustScore,
              piiStrikes: 2
            });
          }
          await updateBookingStatus(id, booking.status, { piiStrikes: bookingStrikes });

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
            error: `🚨 CẢNH CÁO VI PHẠM NGHIÊM TRỌNG (Lần 2/3): Bạn tiếp tục cố tình luồn lách thông tin liên lạc! Hệ thống đã TRỪ -15 ĐIỂM TÍN NHIỆM (còn ${newTrustScore}/100). Vi phạm thêm lần nữa, tài khoản sẽ bị KHÓA CẤM VĨNH VIỄN (BAN)!`,
            reason: piiCheck.reason,
            detectedSample: piiCheck.detectedSample
          });
        } else {
          // LẦN 3 TRỞ ĐI: KHÓA TÀI KHOẢN VĨNH VIỄN (BAN)
          if (senderKey) {
            await updateUserStatus(senderKey, {
              isBanned: true,
              status: 'banned',
              piiStrikes: newStrikes,
              banReason: 'Cố tình chia sẻ SĐT/kênh liên lạc ngoài luồng 3 lần liên tiếp'
            });
          }
          await updateBookingStatus(id, booking.status, {
            piiStrikes: bookingStrikes,
            isBanned: true
          });

          // Báo động Telegram Khẩn Cấp
          sendBusinessAlert({
            title: '⛔ TÀI KHOẢN BỊ KHÓA (AUTO-BAN): Vi phạm PII 3 lần liên tiếp',
            details: {
              'Mã yêu cầu': id,
              'Thành viên bị khóa': senderUser?.name || senderName || 'Thành viên',
              'SĐT/ID': senderKey || 'N/A',
              'Lý do': 'Chia sẻ thông tin ngoài luồng 3 lần liên tiếp',
              'Nội dung vi phạm': text
            },
            req
          }).catch(() => {});

          return res.status(403).json({
            success: false,
            strike: newStrikes,
            violationLevel: 'banned',
            isBanned: true,
            error: '⛔ TÀI KHOẢN ĐÃ BỊ KHÓA VĨNH VIỄN (BAN): Bạn đã vi phạm chính sách bảo mật thông tin liên tục 3 lần. Toàn bộ chuyến xe và quyền truy cập đã bị đình chỉ.',
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
