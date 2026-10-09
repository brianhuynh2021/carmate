import {
  getDB,
  getBookings,
  getBookingById,
  getTripById,
  addBooking,
  updateBookingStatus,
  getUserById,
  getUserByPhone,
  saveUser,
  updateUserStatus,
  saveSupportMessage,
  resolveDisputeAndUnban,
  getOrCreateUserForPenalty
} from '../db/sqliteStore.js';
import { getBookingRole, getTripAvailableSeatsForSegment, proposeAppointment, confirmAppointment, cancelAppointment, completeAppointment } from '../services/bookingCommitment.js';
import { findStandbyBufferOffer } from '../services/batchMatchingEngine.js';
import { cleanPhoneNumber, normalizePhoneNumber, detectPiiLeak, maskPhoneNumber, isLikelyFakePhone, getTravelWindow, resolveDriverRealName, resolveFullPlate } from '@carmate/shared';
import crypto from 'crypto';
import { sendBusinessAlert, sendDirectBookingTelegramAlert, sendNewBookingTelegramAlert } from '../utils/telegramAlert.js';
import { sendEmailNotification } from '../utils/emailAlert.js';

/**
 * Constant-time comparison of the access token (anti timing attack).
 */
function tokenMatches(provided, expected) {
  if (!provided || !expected || typeof provided !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Check booking access rights for the Magic Link endpoints (no login).
 * Allowed when: (1) the access token matches, OR (2) the logged-in user is a member of the trip,
 * OR (3) is an Admin. Prevents IDOR enumeration of bookings by guessing the escrowId (CX-xxxx).
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
 * GET /api/bookings - Get the list of connected trips (My trips)
 * Prevent PII leakage: only return bookings of the logged-in user themselves, or Admin
 */
export function listBookings(req, res) {
  try {
    let user = req.user;
    // If not logged in: never return a public booking list
    if (!user) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    const allBookings = getBookings();
    let userBookings = [];

    // System admin: view everything
    if (user.role === 'admin' || user.role === 'super_admin') {
      userBookings = allBookings;
    } else {
      // Only the current passenger and the explicitly proposed/current owner.
      userBookings = allBookings.filter((booking) => getBookingRole(user, booking));
    }

    const now = Date.now();
    const sanitizedBookings = userBookings.map((b) => {
      // 1. Check if it is in pre_confirmed for more than 15 minutes -> automatically switch to expired
      if (b.status === 'pre_confirmed' && b.preConfirmedExpiresAt) {
        const expiresTime = new Date(b.preConfirmedExpiresAt).getTime();
        if (now > expiresTime) {
          b.status = 'inquiring';
          b.proposalTerms = null;
          b.proposalVersion = null;
          updateBookingStatus(b.escrowId || b.id, 'inquiring', { proposalTerms: null, proposalVersion: null, needStatus: 'open' });
        }
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
 * POST /api/bookings - Create a new trip connection (Initial status: inquiring)
 */
export async function createBooking(req, res) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập để lưu nhu cầu và nhận cập nhật.' });
    const body = { ...req.body };
    for (const field of ['bothConfirmed', 'committedTerms', 'proposalTerms', 'proposalVersion', 'seatReserved', 'seatReleasedAt', 'accessToken', 'driverConfirmed', 'readyConfirmedAt', 'supportDispatched', 'salvageInfo', 'rescueMode', 'creatorId', 'creatorPhone', 'passengerId', 'driverId', 'proposalDriverId', 'proposalDriverPhone', 'preConfirmedBy', 'preConfirmedExpiresAt', 'commitmentHistory']) delete body[field];

    if (!body.from || !body.to) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin bắt buộc: điểm đón (from) hoặc điểm đến (to)'
      });
    }

    // Attach the logged-in user's info
    if (req.user) {
      body.userId = req.user.id || body.userId;
      body.userPhone = req.user.phone || body.userPhone;
      body.creatorId = req.user.id;
      body.creatorPhone = req.user.phone || '';
    }

    // If there is a tripId, query the real phone number of the trip from the DB
    const targetTripId = body.tripId || body.targetTripId || body.targetId || (body.targetItem && body.targetItem.id);
    let targetTrip = null;
    if (!targetTripId) return res.status(400).json({ success: false, error: 'Cần chọn một chuyến xe thật để gửi đề nghị.' });
    if (targetTripId) {
      targetTrip = getTripById(targetTripId);
      if (!targetTrip) return res.status(404).json({ success: false, error: 'Chuyến xe không còn tồn tại.' });
      if (targetTrip.type !== 'driver_offer' || !['active','full'].includes(targetTrip.status || 'active') || targetTrip.isHidden || targetTrip.isBanned) return res.status(409).json({ success: false, error: 'Chuyến xe không còn nhận yêu cầu.' });
      const tripWindow = getTravelWindow(targetTrip);
      if (!tripWindow || tripWindow.end <= Date.now()) return res.status(409).json({ success: false, error: 'Khoảng giờ của chuyến xe đã hết.' });
      body.tripId = targetTrip.id;
      body.originHubId = body.originHubId || body.hubId || targetTrip.originHubId;
      body.destinationHubId = body.destinationHubId || targetTrip.destinationHubId;
      if (targetTrip) {
        // MIT INVARIANT: block self-booking / sending a request to one's own trip
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

        // CAPACITY INVARIANT (MIT): the number of seats booked must be within the vehicle's real limit.
        // Previously nothing was checked — booking 99 seats on a 2-seat vehicle still returned 201 and
        // was written straight into the ledger, leaving the platform in a contradictory state.
        // seats = 0 is VALID for cargo matching / motorbike carriage: the item rides along with the trip
        // but does not take up any passenger's seat.
        const requestedSeats = Number(body.seats ?? body.seatsNeeded ?? 1);
        if (!Number.isInteger(requestedSeats) || requestedSeats < 1) {
          return res.status(400).json({
            success: false,
            error: 'Số người phải là số nguyên dương.'
          });
        }

        const seatsOnOffer = getTripAvailableSeatsForSegment(targetTrip, body);
        // requestedSeats === 0 is cargo matching (takes no seat), so it is always allowed to proceed.
        // For requests that DO take a seat, a trip with no seats left must be rejected: the old condition
        // `seatsOnOffer > 0 && ...` disabled itself when seatsOnOffer === 0,
        // so a 2-seat trip still accepted a 3rd booking.
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
          // The proposing party is the passenger posting a ride request
          body.passengerPhone = tripPhoneFinal;
          body.passengerName = targetTrip.publicName || targetTrip.name || 'Người đi cùng';
          body.passengerId = targetTrip.userId;
          body.driverPhone = req.user?.phone || body.driverPhone || '';
          body.driverName = req.user?.name || body.driverName || 'Chủ xe';
          body.driverId = req.user?.id || body.driverId || '';
        } else {
          // The proposing party is the driver posting an empty vehicle
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

    // Normalize the passenger and fallback driver identities if not present yet
    body.passengerPhone = body.passengerPhone || body.userPhone || body.phone || req.user?.phone || '';
    body.passengerName = body.passengerName || body.userName || body.contactName || req.user?.name || 'Người đi cùng';
    body.driverName = body.driverName || 'Chủ xe';

    // The price is listed by the driver or agreed by both parties; there is no fuel-surcharge bracket.
    const rawPrice = body.totalDeal ?? body.price ??
      (targetTrip?.pricingMode === 'listed' && targetTrip.basePricePerSeat != null
        ? Number(targetTrip.basePricePerSeat) * Number(body.seats ?? 1) : null);
    body.totalDeal = rawPrice == null || rawPrice === '' ? null : Number(rawPrice);
    if (body.totalDeal != null && (!Number.isFinite(body.totalDeal) || body.totalDeal < 0)) {
      return res.status(400).json({ success: false, error: 'Tổng giá phải là số không âm hoặc để Liên hệ.' });
    }
    const parent = body.requestId && getBookings().find((b) => b.requestId === body.requestId && getBookingRole(req.user, b) === 'passenger');
    body.requestId = parent?.requestId || crypto.randomUUID();
    body.originalRequestedAt = parent?.originalRequestedAt || Date.now();
    body.originalDeadlineAt = parent?.originalDeadlineAt || (body.pickupEndAt ? new Date(body.pickupEndAt).getTime() : getTravelWindow(body)?.end ?? null);
    body.inquiryExpiresAt = Math.min(Date.now() + 5 * 60000, body.originalDeadlineAt || Infinity);
    if (!Number.isFinite(body.originalDeadlineAt) || body.originalDeadlineAt <= Date.now()) {
      return res.status(400).json({ success: false, error: 'Hạn giờ không hợp lệ.' });
    }
    body.needStatus = 'open';
    body.needsReplacement = false;
    body.seatReserved = false;
    body.bothConfirmed = false;

    // The ticket code is generated by the SERVER, not accepted from the client. The old client generated CX-1000..9999 itself
    // (only 9000 values) and addBooking uses INSERT OR REPLACE with escrowId as the primary
    // key — when two passengers collide on a code, the later ticket OVERWRITES the earlier one, and seats
    // are still deducted twice. Birthday paradox: ~50% collision after about 112 tickets.
    body.escrowId = `ESC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    delete body.id;

    // The status is decided by the SERVER, not accepted from the client. Previously the client sent
    // `status: 'confirmed'` and that was enough to unlock the driver's real phone number (see isInstantConfirmed
    // below) — anyone could extract every driver's number with a single POST request,
    // without logging in and without the driver's consent.
    // Every booking starts at 'inquiring'; only the two-way confirmation flow (confirmBooking) may
    // promote it to 'confirmed'.
    body.status = 'inquiring';
    body.createdAt = Date.now();
    body.commitmentType = body.commitmentType || 'inquiry_chat';
    body.messages = Array.isArray(body.messages) ? body.messages : [];

    // If the passenger left a message, initialize the first message in the chat thread
    if (body.passengerNote && body.messages.length === 0) {
      body.messages.push({
        id: `MSG-${Date.now()}`,
        senderRole: 'passenger',
        senderName: body.contactName || 'Người đi cùng',
        text: body.passengerNote,
        createdAt: new Date().toISOString()
      });
    }

    // A request under discussion does not take a seat yet. The seat is held atomically when the
    // other party confirms the exact point–time–price version in confirmAppointment.
    const remainingSeatsAfterBooking = targetTrip ? getTripAvailableSeatsForSegment(targetTrip, body) : null;

    const booking = await addBooking(body);

    // Unlock two-way information for the Match & Reveal flow (real license plate & driver's phone number)
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

    // 1. Fire a Telegram push notification that rings after 0.5s on the Admin / driver's device (Concierge MVP)
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

    // 2. Send a Telegram notification directly to the individual driver (if they have a separate linked Telegram ID)
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

    // 2. Send an Email notification directly to the driver (if they have an Email)
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
            Hai bên có thể liên hệ trực tiếp; xác nhận trên CarMate để lưu đúng điểm, giờ và tổng giá đã chốt.
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

    // 3. Fire a Telegram notification to the founder's phone (zero cost)
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

    // Both authenticated participants can contact one another before deciding.
    const responsePayload = {
      success: true, message: 'Đã lưu yêu cầu. Chuyến chỉ được chốt khi hai bên xác nhận cùng điều kiện.',
      data: { ...booking, driverPhoneDirect: booking.driverPhone || targetTrip?.phoneReal || targetTrip?.phone || null }
    };

    return res.status(201).json(responsePayload);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/bookings/:id/delay - Report a delay for the trip appointment
 */
export async function reportDelay(req, res) {
  try {
    const existing = getBookingById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy cuộc hẹn.' });
    if (!getBookingRole(req.user, existing)) return res.status(403).json({ success: false, error: 'Bạn không thuộc cuộc hẹn này.' });
    const minutes = Number(req.body?.minutes);
    if (!Number.isFinite(minutes) || minutes < 0) return res.status(400).json({ success: false, error: 'Số phút trễ không hợp lệ.' });
    const updated = await updateBookingStatus(req.params.id, existing.status, {
      delayedMinutes: minutes, delayNote: String(req.body?.note || ''), delayedAt: new Date().toISOString(),
      journeyRisk: minutes > 0 ? 'late' : null, estimatedPickupAt: req.body?.estimatedPickupAt || null });
    return res.json({ success: true, message: 'Đã cập nhật dự báo trễ. Giờ hẹn đã chốt không tự thay đổi.', data: updated });
  } catch (err) { return res.status(err.status || 500).json({ success: false, error: err.message }); }
}

/**
 * POST /api/bookings/:id/cancel - Cancel the trip connection (time-sloped penalty scale & rescue Radar)
 */
export async function cancelBooking(req, res) {
  try {
    const updated = cancelAppointment({ bookingId: req.params.id, user: req.user,
      reason: req.body?.reason || 'Thay đổi nhu cầu', keepNeed: req.body?.action === 'find_another' });
    if (updated.needsReplacement) {
      const trip = getTripById(updated.tripId);
      const candidate = findStandbyBufferOffer({ ...updated, corridor: trip?.routeCategory, direction: trip?.direction },
        (getDB().trips || []).filter((t) => t.id !== updated.tripId && t.status === 'active' && !t.isHidden));
      if (candidate) {
        updated.recoveryCandidates = [{ tripId: candidate.id, status: 'candidate', requiresBothConfirmations: true,
          driverName: candidate.authorName || candidate.driverName || null,
          vehicleModel: candidate.carModel || candidate.vehicleModel || null,
          plate: candidate.licensePlate || candidate.plate || null,
          timeSlot: candidate.timeSlot || candidate.time || null,
          basePricePerSeat: candidate.basePricePerSeat ?? null }];
        await updateBookingStatus(req.params.id, updated.status, { recoveryCandidates: updated.recoveryCandidates });
      }
    }
    return res.json({ success: true, message: updated.needsReplacement
      ? 'Nhu cầu và hạn giờ ban đầu được giữ lại. Xe thay thế cần hai bên xác nhận.'
      : 'Đã kết thúc nhu cầu và dừng tìm xe.', data: updated, salvageInfo: null });
  } catch (err) { return res.status(err.status || 500).json({ success: false, error: err.message }); }
}

/**
 * POST /api/bookings/:id/complete - Safely complete the trip
 */
export async function completeBooking(req, res) {
  try {
    const updated = completeAppointment({ bookingId: req.params.id, user: req.user });
    return res.json({ success: true, message: 'Đã ghi nhận hoàn tất. Xe tiếp tục hành trình và có thể nhận khách trên đoạn còn lại.', data: updated });
  } catch (err) { return res.status(err.status || 500).json({ success: false, error: err.message }); }
}

/**
 * POST /api/bookings/:id/review - Two-way review (driver reviews passenger or passenger reviews driver)
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
      reviewerRole, // 'driver' (driver reviews passenger) or 'passenger' (passenger reviews driver)
      targetRole: reviewerRole === 'driver' ? 'passenger' : 'driver',
      rating: Number(rating) || 5,
      tags: Array.isArray(tags) ? tags : [],
      comment: String(comment || '').trim(),
      createdAt: new Date().toISOString()
    };

    const existingReviews = Array.isArray(booking.reviews) ? booking.reviews : [];
    // Update or add a new review for this role
    const filteredReviews = existingReviews.filter((r) => r.reviewerRole !== reviewerRole);
    const updatedReviews = [...filteredReviews, reviewEntry];

    // Check the safety flag / warning if there is a violation (e.g. no-show, late arrival, rudeness)
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
 * GET /api/bookings/:id/public-summary - Non-sensitive public information summary
 * Used for the driver opening the Magic Link from Zalo (no login required, PII protected)
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

    // Anti-IDOR: only return the summary (containing passenger/driver names, route, amount) to whoever has a
    // valid access token or is a trip member/Admin. The escrowId (CX-xxxx) is easy to guess.
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
 * POST /api/bookings/:id/driver-confirm - Driver confirms the pickup in 1 tap from the Zalo Magic link (no login required)
 */
export async function driverConfirmBooking(req, res) {
  try {
    const existing = getBookingById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy cuộc hẹn.' });
    if (getBookingRole(req.user, existing) !== 'driver') return res.status(403).json({ success: false, error: 'Chỉ chủ xe của cuộc hẹn được xác nhận sẵn sàng.' });
    if (!existing.bothConfirmed || existing.needStatus === 'closed') return res.status(409).json({ success: false, error: 'Hai bên cần chốt cuộc hẹn trước khi báo sẵn sàng.' });
    const updated = await updateBookingStatus(req.params.id, existing.status, {
      driverConfirmed: true, readyConfirmedAt: new Date().toISOString(), driverNote: String(req.body?.driverNote || ''),
      rescueMode: false, rescueActivatedAt: null });
    return res.json({ success: true, message: 'Đã báo sẵn sàng. Giờ hẹn đã chốt được giữ nguyên.', data: updated });
  } catch (err) { return res.status(err.status || 500).json({ success: false, error: err.message }); }
}

/**
 * POST /api/bookings/:id/messages - Send a message in the anonymous chat thread
 * AI PII protection: automatically detect and block attempts to bypass with phone numbers / off-platform keywords
 */
export async function addBookingMessageHandler(req, res) {
  try {
    const existing = getBookingById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy cuộc trò chuyện.' });
    const senderRole = getBookingRole(req.user, existing);
    if (!senderRole) return res.status(403).json({ success: false, error: 'Bạn không thuộc cuộc trò chuyện này.' });
    const content = String(req.body?.text || '').trim();
    if (!content || content.length > 4000) return res.status(400).json({ success: false, error: 'Tin nhắn cần từ 1 đến 4.000 ký tự.' });
    const newMessage = { id: crypto.randomUUID(), senderRole, senderName: req.user.name || '', text: content, createdAt: new Date().toISOString() };
    const updated = await updateBookingStatus(req.params.id, existing.status, { messages: [...(existing.messages || []), newMessage], lastMessageAt: newMessage.createdAt });
    return res.json({ success: true, message: 'Đã gửi tin nhắn.', data: { newMessage, booking: updated } });
  } catch (err) { return res.status(err.status || 500).json({ success: false, error: err.message }); }
}

/**
 * POST /api/bookings/:id/pre-confirm - Propose to confirm the trip & soft-lock the seat for a limited time (15 minute TTL)
 */
export async function preConfirmBookingHandler(req, res) {
  try {
    const updated = proposeAppointment({ bookingId: req.params.id, user: req.user,
      terms: req.body?.terms || {}, replacementTripId: req.body?.replacementTripId || null });
    return res.json({ success: true, message: 'Đã gửi đề nghị điểm, giờ và giá. Đang chờ bên còn lại xác nhận.', data: updated });
  } catch (err) { return res.status(err.status || 500).json({ success: false, error: err.message }); }
}

/**
 * POST /api/bookings/:id/final-confirm - Officially confirm the trip (Mutual Commitment - 2PC)
 * Hard-deducts the seat and officially unlocks both parties' real phone numbers
 */
export async function finalConfirmBookingHandler(req, res) {
  try {
    const updated = confirmAppointment({ bookingId: req.params.id, user: req.user, proposalVersion: req.body?.proposalVersion });
    return res.json({ success: true, message: 'Hai bên đã xác nhận cùng cuộc hẹn. Chỗ đã được giữ.', data: updated });
  } catch (err) { return res.status(err.status || 500).json({ success: false, error: err.message }); }
}

/**
 * Reset the violation status and remove the lock (Unban / Reset Strikes)
 * For users recovering their account or for the test environment
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
 * POST /api/bookings/:id/dispute - Receive a dispute (Dispute) against a warning or ban
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

    // 1. Save into support_messages
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

    // 2. Unlock and remove the violation immediately (Stanford Ergonomics & Instant Relief)
    await resolveDisputeAndUnban({
      bookingId: id,
      userId: req.user?.id || booking.userId || booking.driverId,
      phone: senderKey,
      reason,
      note
    });

    // 3. Create a resolution confirmation message from the Admin Team in the chat
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

    // 4. Send a Telegram notification to the Admin
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
 * SAFETY VIOLATION REPORTS & COMMITMENTS (SAFETY INVARIANTS)
 * =========================================================================
 *
 * The admin screen `resolve-mismatch` already existed and waited to handle
 * `booking.vehicleMismatchReport`, but the endpoint for PASSENGERS to submit a report
 * was never implemented (it returned 404). That means a passenger had no way
 * to report an overcrowded vehicle, being handed off to another vehicle mid-route, or price gouging —
 * while the admin sat waiting for reports that never arrived.
 */

/** Three categories of safety violation that are recorded, with the trust-score deduction for each. */
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
 * A passenger reports behavior that violates the trip's safety commitments.
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
      // The note is typed by the passenger so it may leak a phone number/identity; mask it before saving.
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

    // Deduct the driver's trust score and count the number of times reported.
    // Deliberately do NOT auto-lock the account: a one-sided report is not enough grounds,
    // the admin verifies via `resolve-mismatch` before imposing a heavy sanction.
    const driverPhone = cleanPhoneNumber(booking.driverPhone || '');
    if (driverPhone) {
      // Create a profile if the driver has not registered, so they cannot escape the sanction.
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
 * Report a fake phone number / one that is never answered when called.
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

    // A number reported as unreachable lowers trust, but is not locked right away:
    // losing signal or a dead battery produces the same symptom.
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
