import {
  riderCheckIn,
  getStationQueue,
  getRiderPass,
  telemetryPing,
  driverAcceptOffer,
  driverRejectOffer,
  driverVerifyPin,
  resetAllStationData
} from '../services/stationQueueService.js';
import { getUserByPhone, getUserById, getAllUsers, saveUser } from '../db/sqliteStore.js';
import { generateToken } from '../utils/token.js';
import { cleanPhoneNumber } from '@carmate/shared';
import { sendBusinessAlert } from '../utils/telegramAlert.js';

export async function riderCheckInHandler(req, res) {
  try {
    const { hubId } = req.params;
    const { destinationHubId, seatsNeeded, phone, name, clientLat, clientLng } = req.body || {};

    const result = riderCheckIn({
      hubId,
      destinationHubId,
      seatsNeeded,
      phone,
      name,
      clientLat,
      clientLng
    });

    // Unified Auth / Upsert: Tự động khởi tạo hoặc nạp tài khoản định danh ngầm (0.05s)
    if (phone) {
      try {
        const cleaned = cleanPhoneNumber(phone);
        if (cleaned) {
          let userRecord = getUserByPhone(cleaned);
          const displayName = (name && name.trim() && name.trim() !== 'Khách đi cùng')
            ? name.trim()
            : (userRecord?.name || `Khách ${cleaned.slice(-4)}`);

          if (!userRecord) {
            userRecord = {
              id: 'USR-' + cleaned,
              phone: cleaned,
              name: displayName,
              avatar: '',
              role: 'rider',
              trustScore: 98,
              safeTripsCount: 0,
              provider: 'station_quick_checkin'
            };
            await saveUser(userRecord);
          } else if (name && name.trim() && name.trim() !== 'Khách đi cùng' && (!userRecord.name || userRecord.name.startsWith('Khách ') || userRecord.name.startsWith('Thành viên '))) {
            userRecord.name = name.trim();
            await saveUser(userRecord);
          }

          const token = generateToken({
            userId: userRecord.id,
            phone: userRecord.phone,
            role: userRecord.role || 'rider',
            name: userRecord.name
          });

          result.token = token;
          result.user = userRecord;
        }
      } catch (authErr) {
        console.warn('[riderCheckInHandler] Unified auth upsert warning:', authErr.message);
      }
    }

    return res.status(201).json(result);
  } catch (err) {
    console.error('[riderCheckInHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
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

export function getRiderPassHandler(req, res) {
  try {
    const { intentId } = req.params;
    const result = getRiderPass(intentId);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('[getRiderPassHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export function cockpitTelemetryHandler(req, res) {
  try {
    const result = telemetryPing(req.body || {});
    return res.json(result);
  } catch (err) {
    console.error('[cockpitTelemetryHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export function cockpitAcceptOfferHandler(req, res) {
  try {
    const { tripId, intentId } = req.body || {};
    const result = driverAcceptOffer({ tripId, intentId });
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('[cockpitAcceptOfferHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export function cockpitRejectOfferHandler(req, res) {
  try {
    const { tripId, intentId } = req.body || {};
    const result = driverRejectOffer({ tripId, intentId });
    return res.json(result);
  } catch (err) {
    console.error('[cockpitRejectOfferHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export function cockpitVerifyPinHandler(req, res) {
  try {
    const { tripId, intentId, pin } = req.body || {};
    const result = driverVerifyPin({ tripId, intentId, pin });
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('[cockpitVerifyPinHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
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

