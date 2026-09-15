import {
  riderCheckIn,
  getStationQueue,
  getRiderPass,
  telemetryPing,
  driverAcceptOffer,
  driverRejectOffer,
  driverVerifyPin,
  riderAcceptStationOffer,
  driverCompleteDropoff,
  cancelRiderIntent,
  getActiveCockpitSessions,
  resetAllStationData
} from '../services/stationQueueService.js';
import {
  getUserByPhone,
  getUserById,
  getAllUsers,
  saveUser,
  updateUser,
  reportTripIncidentDb,
  getTripIncidents,
  permabanUser,
  getTripById
} from '../db/sqliteStore.js';
import { ownsTrip } from '../services/bookingCommitment.js';
import {
  cleanPhoneNumber,
  evaluateIncidentSanctions,
  UNHAPPY_CASE_CODES,
  FIXED_CORRIDOR_COACH_SCHEDULES,
  calculateEarlyFailureRisk,
  evaluateRadarSweepCheckpoint,
  RADAR_CHECKPOINTS
} from '@carmate/shared';
import { sendBusinessAlert } from '../utils/telegramAlert.js';

export async function riderCheckInHandler(req, res) {
  if (!req.user) return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập để lưu nhu cầu.' });
  try {
    const result = riderCheckIn({ ...(req.body || {}), hubId: req.params.hubId,
      userId: req.user.id, phone: req.user.phone || req.body?.phone || '', name: req.user.name || req.body?.name || '' });
    return res.status(result.success ? 201 : 400).json(result);
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
}

export function getStationQueueHandler(req, res) {
  try {
    const { hubId } = req.params;
    const result = getStationQueue(hubId);
    return res.json(result);
  } catch (err) {
    console.error('[getStationQueueHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function getRiderPassHandler(req, res) {
  try {
    const result = getRiderPass(req.params.intentId);
    if (!result.success) return res.status(404).json(result);
    const own = ownsRider(req.user, result.intent);
    const driver = ownsTrip(req.user, getTripById(result.intent.matchedTripId || result.intent.proposedTripId));
    if (!own && !driver) return res.status(403).json({ success: false, error: 'Bạn không thuộc cuộc hẹn này.' });
    if (!own) { result.intent = { ...result.intent }; delete result.intent.pin; }
    return res.json(result);
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
}

export async function cockpitTelemetryHandler(req, res) {
  try {
    const trip = getTripById(req.body?.tripId);
    if (!trip || !ownsTrip(req.user, trip)) return res.status(403).json({ success: false, error: 'Chỉ chủ chuyến xe được cập nhật vị trí.' });
    const result = telemetryPing({ ...(req.body || {}), tripId: trip.id,
      driverPhone: trip.phoneReal || trip.phone || req.user.phone || '', driverName: req.user.name || trip.authorName || '',
      plate: trip.licensePlate || trip.plate || '', vehicleModel: trip.vehicleModel || trip.carModel || '',
      destinationHubId: trip.destinationHubId, corridor: trip.routeCategory || trip.corridor || 'Tuyến QL13',
      seatsAvailable: trip.availableSeats });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
}

export async function cockpitAcceptOfferHandler(req, res) {
  try {
    if (!ownsTrip(req.user, getTripById(req.body?.tripId))) return res.status(403).json({ success: false, error: 'Bạn không sở hữu chuyến xe này.' });
    const result = driverAcceptOffer({ ...(req.body || {}), user: req.user });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
}

export async function cockpitRejectOfferHandler(req, res) {
  if (!ownsTrip(req.user, getTripById(req.body?.tripId))) return res.status(403).json({ success: false, error: 'Bạn không sở hữu chuyến xe này.' });
  return res.json(driverRejectOffer(req.body || {}));
}

export async function cockpitVerifyPinHandler(req, res) {
  if (!ownsTrip(req.user, getTripById(req.body?.tripId))) return res.status(403).json({ success: false, error: 'Bạn không sở hữu chuyến xe này.' });
  const result = driverVerifyPin({ ...(req.body || {}), user: req.user });
  return res.status(result.success ? 200 : 400).json(result);
}

export function resetStationDataHandler(req, res) {
  resetAllStationData();
  return res.json({ success: true, message: 'Đã dọn sạch hàng đợi trạm ảo' });
}

/**
 * POST /api/cockpit/register-vehicle
 * Chủ xe khai báo xe (Biển số, Loại xe, Số ghế) -> Lưu PENDING và báo Telegram Solo Founder
 */
export async function cockpitRegisterVehicleHandler(req, res) {
  try {
    const { plate, model, seats, photos, amenities, phone, name, userId } = req.body || {};
    const cleanPlate = (plate || '').toUpperCase().trim();
    const cleanModel = (model || '').trim();
    const cleanPhone = cleanPhoneNumber(phone || userId);
    const id = userId || (cleanPhone ? `USR-${cleanPhone}` : `USR-${Date.now()}`);

    if (!cleanPlate || !cleanModel) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập đầy đủ biển số xe và hiệu xe' });
    }

    let user = getUserById(id) || (cleanPhone ? getUserByPhone(cleanPhone) : null);
    if (!user) {
      user = {
        id,
        phone: cleanPhone || '',
        name: name || `Chủ xe ${cleanPlate}`,
        role: 'driver',
        createdAt: new Date().toISOString()
      };
    }

    const vehicleData = {
      plate: cleanPlate,
      model: cleanModel,
      seats: Number(seats) || 2,
      photos: Array.isArray(photos) ? photos : [],
      amenities: Array.isArray(amenities) ? amenities : [],
      status: 'PENDING',
      registeredAt: new Date().toISOString()
    };

    user.vehicle = vehicleData;
    user.vehicleStatus = 'PENDING';
    user.carModel = cleanModel;
    user.licensePlate = cleanPlate;
    user.role = 'driver';
    user.isDriverVerified = false;

    await saveUser(user);

    // Bắn Webhook Telegram báo về điện thoại Solo Founder (0đ)
    try {
      await sendBusinessAlert({
        title: '🚗 [CHỦ XE MỚI ĐĂNG KÝ COCKPIT QL13]',
        details: {
          'Chủ xe': `${user.name || 'Chủ xe mới'} (${user.phone || 'Chưa cập nhật SĐT'})`,
          'Biển số': cleanPlate,
          'Hiệu xe': cleanModel,
          'Số ghế mở': `${vehicleData.seats} ghế`,
          'Trạng thái': '⏳ Chờ kích hoạt (PENDING)',
          'Hành động': '👉 Nhấc máy gọi 30s xác minh hoặc bấm Duyệt trên Web Admin'
        },
        req
      });
    } catch (teleErr) {
      console.warn('[cockpitRegisterVehicleHandler] Lỗi gửi Telegram bot:', teleErr.message);
    }

    return res.json({
      success: true,
      message: 'Hồ sơ đã gửi thành công, đang chờ kích hoạt',
      vehicleStatus: 'PENDING',
      vehicle: vehicleData,
      user
    });
  } catch (err) {
    console.error('[cockpitRegisterVehicleHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/cockpit/vehicle-status
 * Kiểm tra trạng thái duyệt xe của người dùng
 */
export function cockpitVehicleStatusHandler(req, res) {
  try {
    const userId = req.query.userId || req.query.phone;
    if (!userId) {
      return res.json({ success: true, vehicleStatus: 'NONE' });
    }

    const user = getUserById(userId) || getUserByPhone(cleanPhoneNumber(userId));
    if (!user || !user.vehicle) {
      return res.json({ success: true, vehicleStatus: 'NONE' });
    }

    const vehicleStatus = user.vehicleStatus || user.vehicle.status || 'PENDING';
    return res.json({
      success: true,
      vehicleStatus,
      isDriverVerified: Boolean(user.isDriverVerified),
      vehicle: user.vehicle
    });
  } catch (err) {
    console.error('[cockpitVehicleStatusHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/cockpit/approve-vehicle
 * Duyệt 1-chạm kích hoạt xe (Founder / Admin / Dev Demo)
 */
export async function cockpitApproveVehicleHandler(req, res) {
  try {
    const { userId, phone, plate } = req.body || {};
    let user = null;
    if (userId) user = getUserById(userId);
    if (!user && phone) user = getUserByPhone(cleanPhoneNumber(phone));

    if (!user) {
      // Fallback: Tìm theo plate trong tất cả users
      const all = getAllUsers();
      user = all.find((u) => u.vehicle?.plate === plate || u.licensePlate === plate);
    }

    if (!user) {
      // Nếu là dev demo mà chưa có user, tạo mock user đã duyệt
      user = {
        id: userId || `USR-${Date.now()}`,
        phone: phone || '0912345678',
        name: 'Chủ xe cá nhân',
        role: 'driver',
        vehicle: {
          plate: plate || '93A-541.86',
          model: 'Mitsubishi Xpander - Trắng',
          seats: 3,
          status: 'VERIFIED',
          registeredAt: new Date().toISOString()
        }
      };
    }

    if (!user.vehicle) {
      user.vehicle = {
        plate: plate || user.licensePlate || '93A-541.86',
        model: user.carModel || 'Mitsubishi Xpander - Trắng',
        seats: 3
      };
    }

    user.vehicle.status = 'VERIFIED';
    user.vehicleStatus = 'VERIFIED';
    user.isDriverVerified = true;

    await saveUser(user);

    return res.json({
      success: true,
      message: 'Hồ sơ xe đã được kích hoạt thành công!',
      vehicleStatus: 'VERIFIED',
      vehicle: user.vehicle
    });
  } catch (err) {
    console.error('[cockpitApproveVehicleHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Báo cáo sự cố chuyến đi (Unhappy Cases) từ buồng lái Cockpit
 * Hỗ trợ 7 kịch bản: GHOST_PASSENGER, LUGGAGE_VIOLATION, MOTION_SICKNESS_SOILING,
 * OFF_CORRIDOR_DETOUR, EN_ROUTE_BREAKDOWN, UNPAID_FARE_FRAUD, RIDER_NO_SHOW
 */
export async function cockpitReportIncidentHandler(req, res) {
  try {
    const {
      bookingId,
      tripId,
      incidentType,
      reporterRole = 'Chủ xe',
      reporterPhone,
      riderPhone,
      driverPhone,
      note,
      context = {}
    } = req.body || {};

    if (!incidentType) {
      return res.status(400).json({ success: false, error: 'Thiếu mã sự cố (incidentType)' });
    }

    // 1. Đánh giá chế tài theo bất biến toán học
    const sanctions = evaluateIncidentSanctions(incidentType, context);

    // 2. Chế tài đối với tài khoản khách hoặc chủ xe
    let bannedUserResult = null;
    let suspendedDriverResult = null;
    if (sanctions.isBanned && riderPhone) {
      bannedUserResult = await permabanUser(riderPhone, sanctions.banReason || incidentType);
    } else if (sanctions.riderPenalty > 0 && riderPhone) {
      const cleanRider = cleanPhoneNumber(riderPhone);
      const riderUser = getUserByPhone(cleanRider);
      if (riderUser) {
        const currentScore = Number(riderUser.trustScore ?? 100);
        const newScore = Math.max(0, currentScore - sanctions.riderPenalty);
        await updateUser(riderUser.id || cleanRider, { trustScore: newScore });
      }
    }

    if (driverPhone) {
      const cleanDriver = cleanPhoneNumber(driverPhone);
      const driverUser = getUserByPhone(cleanDriver);
      if (driverUser) {
        if (sanctions.isSuspended) {
          const days = sanctions.suspensionDays || 30;
          const suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
          const currentScore = Number(driverUser.trustScore ?? 100);
          const newScore = Math.max(0, currentScore - (sanctions.driverPenalty || 50));
          suspendedDriverResult = await updateUser(driverUser.id || cleanDriver, {
            isSuspended: true,
            suspendedUntil,
            suspensionReason: incidentType,
            trustScore: newScore
          });
        } else if (sanctions.driverPenalty > 0) {
          const currentScore = Number(driverUser.trustScore ?? 100);
          const newScore = Math.max(0, currentScore - sanctions.driverPenalty);
          await updateUser(driverUser.id || cleanDriver, { trustScore: newScore });
        }
      }
    }

    // 3. Ghi nhật ký sự cố vào cơ sở dữ liệu
    const incidentRecord = await reportTripIncidentDb({
      bookingId,
      tripId,
      incidentType,
      reporterRole,
      reporterPhone,
      riderPhone,
      driverPhone,
      sanctionAction: sanctions.action,
      driverPenalty: sanctions.driverPenalty || 0,
      riderPenalty: sanctions.riderPenalty || 0,
      fareExempt: sanctions.fareExempt || false,
      isBanned: sanctions.isBanned || false,
      note,
      context,
      sanctions
    });

    // 4. Bắn thông báo Telegram nội bộ cho vận hành nếu có sự cố nghiêm trọng
    try {
      if (sanctions.isBanned || sanctions.isSuspended || sanctions.fareExempt || sanctions.action === 'ABSOLUTE_VETO_CANCEL') {
        await sendBusinessAlert(
          `⚠️ [SỰ CỐ CARMATE] ${sanctions.action}\n` +
          `• Loại sự cố: ${incidentType}\n` +
          `• Người báo cáo: ${reporterRole} (${reporterPhone || 'Ẩn danh'})\n` +
          `• Khách đi cùng: ${riderPhone || 'N/A'}\n` +
          `• Chủ xe: ${driverPhone || 'N/A'}\n` +
          `• Ghi chú: ${note || 'Không có'}\n` +
          `• Kết quả: ${sanctions.message}`
        );
      }
    } catch {}

    return res.json({
      success: true,
      incident: incidentRecord,
      sanctions,
      bannedUser: bannedUserResult,
      suspendedDriver: suspendedDriverResult,
      message: sanctions.message
    });
  } catch (err) {
    console.error('[cockpitReportIncidentHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Lấy lịch sử sự cố chuyến đi
 */
export async function cockpitGetIncidentsHandler(req, res) {
  try {
    const { riderPhone, driverPhone, incidentType, limit } = req.query || {};
    const incidents = getTripIncidents({ riderPhone, driverPhone, incidentType, limit });
    return res.json({ success: true, incidents });
  } catch (err) {
    console.error('[cockpitGetIncidentsHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 11. NGƯỜI ĐI CÙNG BÁO CÁO VI PHẠM VĂN HÓA (HÚT THUỐC, BẮT KHÁCH DÙ, TĂNG GIÁ) -> GRIM TRIGGER 30 NGÀY
 */
export async function riderReportCultureViolationHandler(req, res) {
  try {
    const {
      bookingId,
      tripId,
      violationType, // 'SMOKING' | 'PICKUP_SOLICITING' | 'PRICE_GOUGING'
      reporterPhone,
      driverPhone,
      note
    } = req.body || {};

    let incidentType = UNHAPPY_CASE_CODES.CULTURE_VIOLATION_SMOKING;
    if (violationType === 'PICKUP_SOLICITING' || violationType === UNHAPPY_CASE_CODES.CULTURE_VIOLATION_PICKUP_SOLICITING) {
      incidentType = UNHAPPY_CASE_CODES.CULTURE_VIOLATION_PICKUP_SOLICITING;
    } else if (violationType === 'PRICE_GOUGING' || violationType === UNHAPPY_CASE_CODES.CULTURE_VIOLATION_PRICE_GOUGING) {
      incidentType = UNHAPPY_CASE_CODES.CULTURE_VIOLATION_PRICE_GOUGING;
    }

    const sanctions = evaluateIncidentSanctions(incidentType, { violationType, note });

    // Kích hoạt Grim Trigger: đình chỉ Chủ xe 30 ngày
    let suspendedDriver = null;
    if (driverPhone) {
      const cleanDriver = cleanPhoneNumber(driverPhone);
      const driverUser = getUserByPhone(cleanDriver);
      if (driverUser) {
        const days = sanctions.suspensionDays || 30;
        const suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        const currentScore = Number(driverUser.trustScore ?? 100);
        const newScore = Math.max(0, currentScore - (sanctions.driverPenalty || 50));
        suspendedDriver = await updateUser(driverUser.id || cleanDriver, {
          isSuspended: true,
          suspendedUntil,
          suspensionReason: incidentType,
          trustScore: newScore
        });
      }
    }

    const incidentRecord = await reportTripIncidentDb({
      bookingId,
      tripId,
      incidentType,
      reporterRole: 'Người đi cùng',
      reporterPhone,
      driverPhone,
      sanctionAction: sanctions.action,
      driverPenalty: sanctions.driverPenalty || 50,
      riderPenalty: 0,
      fareExempt: true,
      note,
      sanctions
    });

    try {
      await sendBusinessAlert(
        `🚨 [BÁO CÁO VI PHẠM VĂN HÓA - GRIM TRIGGER 30 NGÀY]\n` +
        `• Vi phạm: ${incidentType}\n` +
        `• Khách báo: ${reporterPhone || 'Ẩn danh'}\n` +
        `• Chủ xe vi phạm: ${driverPhone || 'N/A'}\n` +
        `• Ghi chú: ${note || 'Không có'}\n` +
        `• Chế tài: Đình chỉ 30 ngày, trừ 50 điểm tín nhiệm Chủ xe.`
      );
    } catch {}

    return res.json({
      success: true,
      sanctions,
      incident: incidentRecord,
      suspendedDriver,
      message: 'Đã tiếp nhận báo cáo vi phạm văn hóa. Cơ chế Grim Trigger đã kích hoạt đình chỉ quyền chia sẻ chuyến đi của Chủ xe 30 ngày.'
    });
  } catch (err) {
    console.error('[riderReportCultureViolationHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * 12. NGƯỜI ĐI CÙNG HỦY CHUYẾN MIỄN PHẠT DO CHỦ XE TRỄ QUÁ 5 PHÚT
 */
export async function riderCancelGraceHandler(req, res) {
  const result = getRiderPass(req.body?.intentId);
  if (!result.success || !ownsRider(req.user, result.intent)) return res.status(403).json({ success: false, error: 'Bạn không sở hữu nhu cầu này.' });
  const cancelled = cancelRiderIntent(req.body.intentId, req.body?.note || 'Khách cần đổi xe', { user: req.user, keepNeed: req.body?.action !== 'stop' });
  return res.status(cancelled.success ? 200 : 400).json({ ...cancelled, message: cancelled.success ? 'Đã ghi nhận. Nhu cầu và hạn giờ ban đầu được giữ lại khi tìm xe khác.' : cancelled.error, sanctions: { riderPenalty: 0, driverPenalty: 0 } });
}

/**
 * 13. TRA CỨU ĐIỂM RỦI RO BÙNG CHUYẾN SỚM (EARLY RISK & RADAR SWEEP)
 */
export async function riderGetRadarRiskHandler(req, res) {
  try {
    const {
      driverPhone,
      trustScore,
      lastHeartbeatMinutesAgo = 0,
      speedKmh = 0,
      distanceToStationKm = 0,
      checkpoint = RADAR_CHECKPOINTS.T_MINUS_45M,
      driverConfirmed = true,
      isStationary = false
    } = req.query || {};

    let effectiveTrust = Number(trustScore);
    if (isNaN(effectiveTrust) && driverPhone) {
      const user = getUserByPhone(cleanPhoneNumber(driverPhone));
      if (user) effectiveTrust = Number(user.trustScore ?? 100);
    }
    if (isNaN(effectiveTrust)) effectiveTrust = 100;

    const risk = calculateEarlyFailureRisk({
      trustScore: effectiveTrust,
      lastHeartbeatMinutesAgo: Number(lastHeartbeatMinutesAgo) || 0,
      speedKmh: Number(speedKmh) || 0,
      distanceToStationKm: Number(distanceToStationKm) || 0,
      isVehicleStationaryAtT45: checkpoint === RADAR_CHECKPOINTS.T_MINUS_45M && (isStationary === 'true' || isStationary === true)
    });

    const activeSessions = getActiveCockpitSessions();
    const candidateShadowTrips = activeSessions.filter(s => s.seatsAvailable > 0);

    const checkpointEvaluation = evaluateRadarSweepCheckpoint({
      checkpoint,
      driverConfirmed: driverConfirmed === 'true' || driverConfirmed === true,
      lastHeartbeatMinutesAgo: Number(lastHeartbeatMinutesAgo) || 0,
      isStationary: isStationary === 'true' || isStationary === true,
      distanceToStationKm: Number(distanceToStationKm) || 0,
      trustScore: effectiveTrust,
      candidateShadowTrips
    });

    return res.json({
      success: true,
      risk,
      checkpointEvaluation,
      candidateShadowTrips,
      fixedCoachSchedules: FIXED_CORRIDOR_COACH_SCHEDULES
    });
  } catch (err) {
    console.error('[riderGetRadarRiskHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}


function ownsRider(user, rider) {
  return Boolean(user && rider && (rider.userId ? user.id === rider.userId : (user.phone && cleanPhoneNumber(user.phone) === rider.phone)));
}
export function riderAcceptOfferHandler(req, res) {
  const intentId = req.params.intentId || req.body?.intentId;
  const pass = getRiderPass(intentId);
  if (!pass.success || !ownsRider(req.user, pass.intent)) return res.status(403).json({ success: false, error: 'Bạn không sở hữu nhu cầu này.' });
  const result = riderAcceptStationOffer({ intentId, proposalVersion: req.body?.proposalVersion, user: req.user });
  return res.status(result.success ? 200 : 400).json(result);
}
export function riderCancelIntentHandler(req, res) {
  const result = cancelRiderIntent(req.params.intentId || req.body?.intentId, req.body?.reason || 'Khách hủy', { user: req.user, keepNeed: req.body?.action === 'find_another' });
  return res.status(result.success ? 200 : 400).json(result);
}
export function cockpitDropoffHandler(req, res) {
  if (!ownsTrip(req.user, getTripById(req.body?.tripId))) return res.status(403).json({ success: false, error: 'Bạn không sở hữu chuyến xe này.' });
  const result = driverCompleteDropoff({ ...(req.body || {}), user: req.user });
  return res.status(result.success ? 200 : 400).json(result);
}
