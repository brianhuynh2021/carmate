import {
  getDB,
  getBookings,
  getBookingById,
  getTripById,
  addBooking,
  updateBookingStatus,
  updateTrip,
  getUserById,
  getUserByPhone,
  saveUser,
  updateUserStatus,
  saveSupportMessage,
  resolveDisputeAndUnban,
  isUserDeactivated,
  getOrCreateUserForPenalty,
  applyCancellationPenalty
} from '../db/sqliteStore.js';
import { findStandbyBufferOffer } from '../services/batchMatchingEngine.js';
import { cleanPhoneNumber, normalizePhoneNumber, detectPiiLeak, maskPhoneNumber, isValidVietnamesePhone, isLikelyFakePhone, getPriceGuardrail, resolveDriverRealName, resolveFullPlate } from '@carmate/shared';
import crypto from 'crypto';
import { generateToken } from '../utils/token.js';
import { sendBusinessAlert, sendDirectBookingTelegramAlert, sendNewBookingTelegramAlert, sendBookingCancelledTelegramAlert } from '../utils/telegramAlert.js';
import { dispatchNotification } from '../services/notificationService.js';
import { sendEmailNotification } from '../utils/emailAlert.js';

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
    let user = req.user;
    const queryPhone = cleanPhoneNumber(req.query?.phone || req.headers?.['x-user-phone'] || '');

    // Nếu chưa có token nhưng có SĐT từ header/query hợp lệ:
    if (!user && queryPhone) {
      const dbUser = getUserByPhone(queryPhone);
      user = dbUser || { phone: queryPhone, role: 'rider' };
    }

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
          (user.id && (b.userId === user.id || b.creatorId === user.id || b.driverId === user.id || b.passengerId === user.id))
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
    let targetTrip = null;
    if (targetTripId) {
      targetTrip = getTripById(targetTripId);
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

        // BẤT BIẾN SỨC CHỨA (MIT): số ghế đặt phải nằm trong giới hạn thật của xe.
        // Trước đây không kiểm gì cả — đặt 99 ghế trên xe 2 ghế vẫn trả 201 và
        // ghi thẳng vào sổ, khiến sàn rơi vào trạng thái mâu thuẫn.
        // seats = 0 là HỢP LỆ với ghép hàng / chở xe máy: món hàng đi cùng chuyến
        // nhưng không chiếm ghế người ngồi nào.
        const requestedSeats = Number(body.seats ?? body.seatsNeeded ?? 1);
        if (!Number.isFinite(requestedSeats) || requestedSeats < 0) {
          return res.status(400).json({
            success: false,
            error: 'Số ghế phải là số không âm.'
          });
        }

        const seatsOnOffer = Number(
          targetTrip.availableSeats ?? targetTrip.seats ?? targetTrip.capacity ?? 0
        );
        // requestedSeats === 0 là ghép hàng (không chiếm ghế) nên luôn được đi tiếp.
        // Với yêu cầu CÓ chiếm ghế thì chuyến hết chỗ phải bị từ chối: điều kiện cũ
        // `seatsOnOffer > 0 && ...` vô hiệu hoá chính nó khi seatsOnOffer === 0,
        // nên chuyến 2 ghế vẫn nhận được booking thứ 3.
        if (requestedSeats > 0 && requestedSeats > seatsOnOffer) {
          return res.status(400).json({
            success: false,
            error: seatsOnOffer === 0
              ? 'Chuyến này đã hết chỗ.'
              : `Chuyến này chỉ còn ${seatsOnOffer} ghế trống, không thể đặt ${requestedSeats} ghế.`
          });
        }
        body.seats = requestedSeats;

        const isTargetPassenger = targetTrip.type === 'passenger_request';
        const tripPhoneFinal = targetTrip.phoneReal || targetTrip.phone;

        if (isTargetPassenger) {
          // Bên ra kèo là Người đi cùng đăng tìm xe
          body.passengerPhone = tripPhoneFinal;
          body.passengerName = targetTrip.publicName || targetTrip.name || 'Người đi cùng';
          body.passengerId = targetTrip.userId;
          body.driverPhone = req.user?.phone || body.driverPhone || '';
          body.driverName = req.user?.name || body.driverName || 'Chủ xe';
          body.driverId = req.user?.id || body.driverId || '';
        } else {
          // Bên ra kèo là Chủ xe đăng xe trống
          body.driverPhone = tripPhoneFinal;
          const driverUser = (targetTrip?.userId && getUserById(targetTrip.userId)) ||
                             (tripPhoneFinal && getUserByPhone(tripPhoneFinal));
          body.driverName = resolveDriverRealName(targetTrip, driverUser?.name || body.driverName || 'Chủ xe');
          body.driverId = targetTrip.userId;
          body.passengerPhone = body.passengerPhone || req.user?.phone || '';
          body.passengerName = body.passengerName || req.user?.name || 'Người đi cùng';
          body.passengerId = req.user?.id || body.passengerId || '';
        }

        body.targetPhone = tripPhoneFinal;
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

    // Chuẩn hóa danh tính Người đi cùng và Chủ xe dự phòng nếu chưa có
    body.passengerPhone = body.passengerPhone || body.userPhone || body.phone || req.user?.phone || '';
    body.passengerName = body.passengerName || body.userName || body.contactName || req.user?.name || 'Người đi cùng';
    body.driverName = body.driverName || 'Chủ xe';

    // UNIFIED AUTH / UPSERT FLOW: Khách giữ chỗ trước bằng SĐT không cần tài khoản hay mật khẩu từ trước
    let guestUserRecord = null;
    let guestToken = null;
    if (!req.user && body.passengerPhone) {
      const cleaned = cleanPhoneNumber(body.passengerPhone);
      if (isValidVietnamesePhone(cleaned)) {
        try {
          guestUserRecord = getUserByPhone(cleaned);
          const rawName = body.passengerName;
          const displayName =
            rawName && rawName.trim() && rawName.trim() !== 'Người đi cùng' && rawName.trim() !== 'Khách đi cùng'
              ? rawName.trim()
              : (guestUserRecord?.name || `Khách ${cleaned.slice(-4)}`);

          if (!guestUserRecord) {
            guestUserRecord = {
              id: 'USR-' + cleaned,
              phone: cleaned,
              name: displayName,
              avatar: '',
              role: 'rider',
              trustScore: 98,
              safeTripsCount: 0,
              provider: 'quick_advance_booking'
            };
            await saveUser(guestUserRecord);
          } else if (
            rawName &&
            rawName.trim() &&
            rawName.trim() !== 'Người đi cùng' &&
            rawName.trim() !== 'Khách đi cùng' &&
            (!guestUserRecord.name ||
              guestUserRecord.name.startsWith('Khách ') ||
              guestUserRecord.name.startsWith('Người ') ||
              guestUserRecord.name.startsWith('Thành viên '))
          ) {
            guestUserRecord.name = rawName.trim();
            await saveUser(guestUserRecord);
          }

          guestToken = generateToken({
            userId: guestUserRecord.id,
            phone: guestUserRecord.phone,
            role: guestUserRecord.role || 'rider',
            name: guestUserRecord.name
          });

          body.userId = guestUserRecord.id;
          body.passengerId = guestUserRecord.id;
          body.passengerPhone = guestUserRecord.phone;
          body.passengerName = guestUserRecord.name;
        } catch (authErr) {
          console.warn('[createBooking] Unified auth upsert warning:', authErr.message);
        }
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

    // Mã vé do MÁY CHỦ sinh, không nhận từ client. Client cũ tự sinh CX-1000..9999
    // (chỉ 9000 giá trị) và addBooking dùng INSERT OR REPLACE với escrowId là khoá
    // chính — hai khách trùng mã thì vé người sau GHI ĐÈ vé người trước, ghế vẫn
    // bị trừ hai lần. Nghịch lý ngày sinh: ~50% va chạm sau khoảng 112 vé.
    body.escrowId = `ESC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    delete body.id;

    // Trạng thái do MÁY CHỦ quyết, không nhận từ client. Trước đây client gửi kèm
    // `status: 'confirmed'` là đủ để mở khoá SĐT thật của Chủ xe (xem isInstantConfirmed
    // bên dưới) — bất kỳ ai cũng moi được số của mọi Chủ xe chỉ bằng một request POST,
    // không cần đăng nhập và không cần Chủ xe đồng ý.
    // Mọi booking bắt đầu ở 'inquiring'; chỉ luồng chốt hai chiều (confirmBooking) mới
    // được nâng lên 'confirmed'.
    body.status = 'inquiring';
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

    // BẤT BIẾN GHẾ NGỒI (MIT): Trừ số ghế khả dụng của chuyến xe trong CSDL
    let remainingSeatsAfterBooking = null;
    if (targetTrip && targetTrip.id) {
      // Đọc lại bản ghi ngay trước khi trừ: targetTrip được nạp từ đầu request và
      // có thể đã cũ nếu một booking khác vừa chen vào giữa chừng.
      const freshTrip = getTripById(targetTrip.id) || targetTrip;
      const currentSeats = Number(freshTrip.availableSeats ?? freshTrip.seats ?? freshTrip.capacity ?? 4);
      const requestedSeats = Number(body.seats || 1);
      const updatedSeats = Math.max(0, currentSeats - requestedSeats);
      remainingSeatsAfterBooking = updatedSeats;
      await updateTrip(targetTrip.id, {
        availableSeats: updatedSeats,
        status: updatedSeats === 0 ? 'full' : (targetTrip.status || 'active')
      });
      targetTrip.availableSeats = updatedSeats;
      if (updatedSeats === 0) targetTrip.status = 'full';
    }

    const booking = await addBooking(body);

    // Mở khoá thông tin 2 chiều cho luồng Match & Reveal (Biển số thật & SĐT Chủ xe)
    if (targetTrip) {
      const driverUser = (targetTrip.userId && getUserById(targetTrip.userId)) ||
                         (targetTrip.phoneReal && getUserByPhone(targetTrip.phoneReal)) ||
                         (body.driverPhone && getUserByPhone(body.driverPhone));
      booking.fullPlate = resolveFullPlate(targetTrip, '');
      booking.driverPhone = targetTrip.phoneReal || targetTrip.phone || '';
      booking.driverName = resolveDriverRealName(targetTrip, driverUser?.name || targetTrip.driverRealName || targetTrip.authorName || body.driverName || 'Chủ xe');
      booking.carModel = targetTrip.carType || targetTrip.vehicleModel || '';
      booking.availableSeats = remainingSeatsAfterBooking;
    }

    // 1. Bắn tin nhắn đẩy Telegram rung chuông sau 0.5s về máy Admin / Chủ xe (Concierge MVP)
    sendNewBookingTelegramAlert({
      timeLabel: body.timeLabel || body.timeSlot || `${body.time || '04:30'} ${body.date || ''}`.trim(),
      passengerPhone: body.passengerPhone,
      seats: body.seats || 1,
      from: body.from,
      to: body.to,
      remainingSeats: remainingSeatsAfterBooking ?? 0,
      carModel: targetTrip?.carType || body.carModel || '',
      fullPlate: resolveFullPlate(targetTrip, ''),
      req
    }).catch(() => {});

    // 2. Gửi thông báo Telegram trực tiếp đến Chủ Xe cá nhân (nếu có liên kết Telegram ID riêng)
    const driverUser = (targetTrip?.userId && getUserById(targetTrip.userId)) ||
                       (targetTrip?.phoneReal && getUserByPhone(targetTrip.phoneReal)) ||
                       (body.driverPhone && getUserByPhone(body.driverPhone));
    const driverTelegramId = targetTrip?.telegramId || driverUser?.telegramId;

    if (driverTelegramId) {
      sendDirectBookingTelegramAlert({
        targetTelegramId: driverTelegramId,
        booking,
        passengerName: body.contactName || 'Người đi cùng',
        req
      }).catch(() => {});
    }

    // 2. Gửi Email thông báo trực tiếp đến Chủ Xe (nếu có Email)
    const driverEmail = targetTrip?.email || driverUser?.email;
    if (driverEmail) {
      const emailSubject = `[CarMate] Có yêu cầu ghép chuyến mới tuyến ${booking.from} ➔ ${booking.to}`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
          <h2 style="color: #0071e3; margin-top: 0;">🚗 Yêu Cầu Ghép Chuyến Mới</h2>
          <p style="color: #334155; font-size: 14px;">Chào <strong>${targetTrip?.publicName || driverUser?.name || 'Chủ xe'}</strong>,</p>
          <p style="color: #334155; font-size: 14px;">Bạn vừa nhận được một yêu cầu kết nối đi chung xe trên hệ thống CarMate:</p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin: 16px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 6px 0; font-size: 13px;"><strong>Lộ trình:</strong> ${booking.from} ➔ ${booking.to}</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Khởi hành:</strong> ${booking.date || 'Hôm nay'} ${booking.time || ''}</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Số ghế đặt:</strong> ${booking.seatsBooked || booking.seats || 1} người</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Điểm đón đề xuất:</strong> ${booking.pickupPoint || 'Thỏa thuận tiện đường'}</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Lời nhắn:</strong> "${booking.passengerNote || 'Không có ghi chú'}"</p>
          </div>
          <p style="color: #475569; font-size: 13px;">Mở CarMate vào mục <strong>Hộp thư</strong> để trao đổi điểm đón cụ thể và bấm nút <strong>[Chốt chuyến 15 phút]</strong>.</p>
          <p style="font-size: 11px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
            🛡️ Số điện thoại thật của 2 bên được bảo mật 100% và chỉ tự động hiển thị sau khi 2 bên cùng chốt chuyến.
          </p>
        </div>
      `;
      sendEmailNotification({
        to: driverEmail,
        subject: emailSubject,
        html: emailHtml,
        text: `Yêu cầu ghép chuyến mới từ ${body.contactName || 'Người đi cùng'}: ${booking.from} ➔ ${booking.to}`
      }).catch(() => {});
    }

    // 3. Bắn thông báo Telegram về điện thoại của founder (0 chi phí)
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

    // Chỉ tin trạng thái đã ghi xuống CSDL, không tin trường client gửi lên.
    const isInstantConfirmed = booking.status === 'confirmed';
    const sanitizedBooking = {
      ...booking,
      phoneReal: maskPhoneNumber(booking.phoneReal || booking.contactPhone || ''),
      contactPhone: maskPhoneNumber(booking.contactPhone || ''),
      driverPhone: isInstantConfirmed ? (booking.driverPhone || targetTrip?.phoneReal || targetTrip?.phone || '') : maskPhoneNumber(booking.driverPhone || ''),
      driverPhoneDirect: isInstantConfirmed ? (booking.driverPhone || targetTrip?.phoneReal || targetTrip?.phone || '') : null,
      passengerPhone: maskPhoneNumber(booking.passengerPhone || '')
    };

    const responsePayload = {
      success: true,
      message: 'Đã gửi yêu cầu ghép chuyến thành công',
      data: sanitizedBooking
    };

    if (guestToken && guestUserRecord) {
      responsePayload.token = guestToken;
      responsePayload.user = guestUserRecord;
    }

    return res.status(201).json(responsePayload);
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
 * POST /api/bookings/:id/cancel - Huỷ kết nối chuyến đi (Thang phạt dốc thời gian & Radar cứu hộ)
 */
export async function cancelBooking(req, res) {
  try {
    const { id } = req.params;
    const { reason = 'Thay đổi lịch trình đột xuất', phone = '' } = req.body || {};

    const booking = getBookingById(id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    // 1. Xác định thời điểm khởi hành của chuyến xe để đo lường delta t
    let departureTimeMs = null;
    let trip = null;
    if (booking.tripId) {
      trip = getTripById(booking.tripId);
    }

    const tripDate = booking.date || trip?.date;
    const tripTimeSlot = booking.timeSlot || trip?.timeSlot || '';

    if (tripDate) {
      const hourMatch = String(tripTimeSlot).match(/(\d{1,2}):(\d{2})/);
      const departureDate = new Date(tripDate);
      if (hourMatch) {
        departureDate.setHours(parseInt(hourMatch[1], 10), parseInt(hourMatch[2], 10), 0, 0);
      } else {
        departureDate.setHours(12, 0, 0, 0);
      }
      departureTimeMs = departureDate.getTime();
    }

    const nowMs = Date.now();
    let deltaMinutes = 180; // Mặc định > 2 tiếng nếu không xác định được giờ cụ thể
    if (departureTimeMs && !isNaN(departureTimeMs)) {
      deltaMinutes = (departureTimeMs - nowMs) / (60 * 1000);
    }

    const cancellingPhone = phone || booking.passengerPhone || trip?.phoneReal || '';
    const isDriverCancelling =
      req.body?.cancellingRole === 'driver' ||
      cancellingPhone === trip?.phoneReal ||
      cancellingPhone === booking?.driverPhone;

    // 2. Tính toán thang phạt dốc thời gian & Grim Trigger (30 ngày tước quyền nếu chủ xe bùng sát giờ)
    const penaltyResult = await applyCancellationPenalty(
      booking,
      cancellingPhone,
      deltaMinutes,
      isDriverCancelling ? 'driver' : 'passenger'
    );

    // 3. KÍCH HOẠT ĐIỀU PHỐI XE HỖ TRỢ / CHUYỂN LÀN VÔ HÌNH (SILENT FALLBACK N+1)
    // Tuyệt đối không để khách bị bùng chuyến nếu còn xe trên hành lang
    let salvageInfo = null;

    // Kích hoạt nếu chủ xe huỷ trước giờ chạy hoặc trong vòng 90 phút
    if (isDriverCancelling || deltaMinutes < 90) {
      const db = getDB();
      const allActiveTrips = (db.trips || []).filter((t) => t.status === 'active' && !t.isHidden);
      const standbyCandidate = findStandbyBufferOffer(
        { ...booking, corridor: trip?.routeCategory || 'Tuyến QL13', direction: trip?.direction },
        allActiveTrips.filter((t) => t.id !== booking.tripId)
      );

      if (standbyCandidate) {
        const supportVehicleModel = standbyCandidate.carModel || standbyCandidate.vehicleModel || 'Toyota Vios (Đen)';
        const supportPlate = standbyCandidate.licensePlate || standbyCandidate.plate || '61A - 892.41';
        const supportTime = standbyCandidate.timeSlot || standbyCandidate.time || '06:25';
        const supportDriver = standbyCandidate.authorName || standbyCandidate.driverName || 'Anh Hải (Chủ xe)';

        salvageInfo = {
          salvaged: true,
          supportDispatched: true,
          standbyTripId: standbyCandidate.id,
          supportTripId: standbyCandidate.id,
          supportDriverName: supportDriver,
          supportVehicleModel,
          supportPlate,
          supportPickupTime: supportTime,
          supportPhone: standbyCandidate.phoneReal || standbyCandidate.phone,
          note: `CarMate điều phối xe hỗ trợ: Xe ${supportVehicleModel} (${supportPlate}) sẽ đón bạn lúc ${supportTime} tại trạm đón.`
        };
      }
    }

    // 4. Cập nhật booking vào database
    // Nếu có xe hỗ trợ thay thế -> chuyển sang 'reassigned' (vé của khách vẫn giữ hiệu lực)
    const newStatus = salvageInfo?.supportDispatched ? 'reassigned' : 'cancelled';
    const updated = await updateBookingStatus(id, newStatus, {
      cancelReason: reason,
      cancelledAt: new Date().toISOString(),
      penaltyTier: penaltyResult.penaltyTier,
      penaltyPoints: penaltyResult.penaltyPoints,
      salvageInfo,
      supportDispatched: Boolean(salvageInfo?.supportDispatched)
    });

    // 5. Nếu chủ xe bị huỷ ghế, phục hồi lại số ghế trống trên chuyến xe.
    // Bản ghi trip dùng `availableSeats`; ghi vào `seats` chỉ tạo ra trường rác và
    // ghế huỷ không bao giờ quay lại sàn, đồng thời chuyến kẹt status 'full' vĩnh viễn.
    if (trip && trip.id) {
      const freshTrip = getTripById(trip.id) || trip;
      const currentSeats = Number(freshTrip.availableSeats ?? 0);
      const bookedSeats = Number(booking.seats || 1);
      const restoredSeats = currentSeats + bookedSeats;
      await updateTrip(trip.id, {
        availableSeats: restoredSeats,
        // Mở lại chuyến khi đã có chỗ trống, nếu trước đó bị khoá vì hết ghế
        status: restoredSeats > 0 && freshTrip.status === 'full' ? 'active' : freshTrip.status
      });
    }

    // 6. Bắn thông báo In-app/Push và Telegram cho Chủ xe
    try {
      const driverPhone = trip?.phoneReal || trip?.phone || booking?.driverPhone;
      const bookedSeats = Number(booking.seats || 1);
      const passengerPhone = booking.passengerPhone || booking.phone || '0984******';
      const cleanDigits = String(passengerPhone).replace(/\D/g, '');
      const maskedPassenger = cleanDigits.length >= 8
        ? `${cleanDigits.slice(0, 3)}***${cleanDigits.slice(-4)}`
        : '098***xxxx';
      const tripDate = booking.date || trip?.date || '';
      const tripTime = booking.timeSlot || trip?.timeSlot || '';

      if (driverPhone) {
        dispatchNotification({
          phone: driverPhone,
          kind: 'booking_cancelled',
          title: 'Hành khách hủy đặt chỗ',
          body: `Khách ${maskedPassenger} vừa hủy ${bookedSeats} ghế chuyến ${tripTime} ngày ${tripDate}. Đã mở lại ${bookedSeats} chỗ trống trên hệ thống.`,
          data: { bookingId: booking.id || id, tripId: trip?.id, reason }
        }).catch((e) => console.warn('[Cancel] Không gửi được in-app notification:', e.message));
      }

      sendBookingCancelledTelegramAlert({
        targetTelegramId: trip?.telegramId,
        passengerPhone,
        seats: bookedSeats,
        timeSlot: tripTime,
        date: tripDate,
        from: booking.from || trip?.from,
        to: booking.to || trip?.to,
        reason,
        req
      }).catch((e) => console.warn('[Cancel] Không gửi được telegram alert:', e.message));
    } catch (notifyErr) {
      console.warn('[Cancel] Lỗi gửi thông báo hủy chỗ:', notifyErr.message);
    }

    return res.status(200).json({
      success: true,
      message: penaltyResult.message,
      penalty: penaltyResult,
      salvageInfo,
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

    // Chống IDOR: chỉ trả tóm tắt (chứa tên khách/chủ xe, lộ trình, số tiền) cho ai có
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
        driverName: resolveDriverRealName(booking, booking.driverName || 'Chủ xe'),
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
      text: `⚡ ${proposerTitle} đã ĐỀ XUẤT CHỐT CHUYẾN & tạm giữ chỗ trong 15 phút. Vui lòng ${receiverTitle} bấm [✅ Xác nhận chốt chuyến ngay] để hoàn tất chuyến đi!`,
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

    const sanitizedUpdated = {
      ...updated,
      phoneReal: maskPhoneNumber(updated.phoneReal || updated.contactPhone || ''),
      contactPhone: maskPhoneNumber(updated.contactPhone || ''),
      driverPhone: maskPhoneNumber(updated.driverPhone || ''),
      passengerPhone: maskPhoneNumber(updated.passengerPhone || '')
    };

    return res.status(200).json({
      success: true,
      message: `${proposerTitle} đã đề xuất chốt chuyến & tạm giữ chỗ 15 phút.`,
      data: sanitizedUpdated
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
      text: '🎉 Chúc mừng 2 bạn! Chuyến đi đã được CHỐT CHÍNH THỨC 2 CHIỀU. Tên thật và số điện thoại liên hệ của 2 bên đã được mở khóa an toàn kèm nút Gọi điện / Sao chép số.',
      createdAt: now.toISOString()
    };

    const existingMsgs = Array.isArray(existing.messages) ? existing.messages : [];
    const updatedMsgs = [...existingMsgs, systemMsg];

    // KHÔNG trừ ghế ở đây. Ghế đã được giữ ngay khi tạo booking (xem createBooking),
    // vì chỗ phải được khoá từ lúc khách đặt chứ không phải lúc hai bên chốt.
    // Trừ thêm lần nữa tại đây từng làm ghế biến mất gấp đôi cho cùng một khách.

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


/**
 * =========================================================================
 * BÁO CÁO VI PHẠM AN TOÀN & CAM KẾT (SAFETY INVARIANTS)
 * =========================================================================
 *
 * Màn hình quản trị `resolve-mismatch` vốn đã tồn tại và chờ xử lý
 * `booking.vehicleMismatchReport`, nhưng endpoint để KHÁCH gửi báo cáo thì
 * chưa từng được hiện thực (trả 404). Nghĩa là người đi cùng không có bất kỳ
 * cách nào tố giác xe nhồi nhét, bị bán khách giữa đường hay bị chặt chém —
 * còn quản trị viên thì ngồi chờ những báo cáo không bao giờ tới.
 */

/** Ba nhóm vi phạm an toàn được ghi nhận, kèm mức trừ điểm tín nhiệm. */
const VEHICLE_MISMATCH_TYPES = {
  overcrowded: {
    title: 'Xe nhồi nhét khách / Chở quá tải',
    severity: 'high',
    trustPenalty: 25
  },
  passenger_transfer: {
    title: 'Bắt sang xe / Đổi xe giữa đường (Xe dù)',
    severity: 'critical',
    trustPenalty: 35
  },
  price_gouging: {
    title: 'Chặt chém giá / Đòi thêm tiền ngoài thỏa thuận',
    severity: 'high',
    trustPenalty: 25
  },
  wrong_plate: {
    title: 'Sai biển số so với thông tin đã đăng',
    severity: 'medium',
    trustPenalty: 15
  }
};

/**
 * POST /api/bookings/:id/report-vehicle-mismatch
 * Người đi cùng tố giác hành vi vi phạm cam kết an toàn của chuyến xe.
 */
export async function reportVehicleMismatchHandler(req, res) {
  try {
    const { id } = req.params;
    const { mismatchType = '', actualPlate = '', passengerNote = '' } = req.body || {};

    const rule = VEHICLE_MISMATCH_TYPES[mismatchType];
    if (!rule) {
      return res.status(400).json({
        success: false,
        error: `Loại vi phạm không hợp lệ. Chọn một trong: ${Object.keys(VEHICLE_MISMATCH_TYPES).join(', ')}`
      });
    }

    const booking = getBookingById(id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    const report = {
      mismatchType,
      mismatchTitle: rule.title,
      severity: rule.severity,
      actualPlate: actualPlate || '',
      declaredPlate: booking.licensePlate || booking.plate || '',
      // Ghi chú do khách tự gõ nên có thể lọt SĐT/danh tính; che trước khi lưu.
      passengerNote: detectPiiLeak(String(passengerNote).slice(0, 1000)).maskedText,
      reportedBy: maskPhoneNumber(req.user?.phone || booking.passengerPhone || ''),
      reportedAt: new Date().toISOString(),
      status: 'pending',
      trustPenalty: rule.trustPenalty
    };

    const updated = await updateBookingStatus(id, booking.status || 'zalo_active', {
      vehicleMismatchReport: report
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    // Trừ điểm tín nhiệm chủ xe và đếm số lần bị tố giác.
    // Cố ý KHÔNG khoá tài khoản tự động: một báo cáo một phía chưa đủ căn cứ,
    // quản trị viên xác minh qua `resolve-mismatch` rồi mới ra chế tài nặng.
    const driverPhone = cleanPhoneNumber(booking.driverPhone || '');
    if (driverPhone) {
      // Tạo hồ sơ nếu chủ xe chưa đăng ký, để họ không thoát chế tài.
      const driver = await getOrCreateUserForPenalty(driverPhone, { role: 'driver' });
      if (driver) {
        await saveUser({
          ...driver,
          trustScore: Math.max(10, Number(driver.trustScore ?? 98) - rule.trustPenalty),
          mismatchReports: Number(driver.mismatchReports || 0) + 1
        });
      }
    }

    sendBusinessAlert({
      title: `⚠️ BÁO CÁO VI PHẠM AN TOÀN (${rule.severity.toUpperCase()})`,
      details: {
        'Mã chuyến': id,
        'Hành vi': rule.title,
        'Biển số khai báo': report.declaredPlate || '(không có)',
        'Biển số thực tế': report.actualPlate || '(không ghi nhận)',
        'Trừ điểm tín nhiệm': rule.trustPenalty,
        'Ghi chú của khách': passengerNote || '(không có)'
      },
      req
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Đã ghi nhận báo cáo vi phạm. Đội ngũ vận hành sẽ xác minh và xử lý.',
      data: report
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/report-unreachable-phone
 * Báo số điện thoại ảo / gọi mãi không nghe máy.
 */
export async function reportUnreachablePhoneHandler(req, res) {
  try {
    const { id } = req.params;
    const { unreachablePhone = '', reason = '' } = req.body || {};

    const clean = cleanPhoneNumber(unreachablePhone);
    if (!clean) {
      return res.status(400).json({ success: false, error: 'Thiếu số điện thoại cần báo cáo' });
    }

    const booking = getBookingById(id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    const report = {
      unreachablePhoneMasked: maskPhoneNumber(clean),
      reason: String(reason).slice(0, 500),
      reportedBy: maskPhoneNumber(req.user?.phone || ''),
      reportedAt: new Date().toISOString(),
      status: 'pending',
      looksFake: isLikelyFakePhone(clean)
    };

    const updated = await updateBookingStatus(id, booking.status || 'zalo_active', {
      unreachablePhoneReport: report
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến đi' });
    }

    // Số bị báo không liên lạc được làm giảm độ tin cậy, nhưng chưa khoá ngay:
    // mất sóng hay hết pin cũng cho ra cùng hiện tượng.
    const reported = await getOrCreateUserForPenalty(clean);
    if (reported) {
      await saveUser({
        ...reported,
        trustScore: Math.max(10, Number(reported.trustScore ?? 98) - 10),
        unreachableReports: Number(reported.unreachableReports || 0) + 1
      });
    }

    sendBusinessAlert({
      title: '📵 BÁO CÁO SỐ ĐIỆN THOẠI KHÔNG LIÊN LẠC ĐƯỢC',
      details: {
        'Mã chuyến': id,
        'Số bị báo': report.unreachablePhoneMasked,
        'Nghi số ảo': report.looksFake ? 'CÓ' : 'không',
        'Lý do': reason || '(không có)'
      },
      req
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Đã ghi nhận báo cáo số điện thoại không liên lạc được.',
      data: report
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
