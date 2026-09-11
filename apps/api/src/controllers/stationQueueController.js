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
import { getUserByPhone, saveUser } from '../db/sqliteStore.js';
import { generateToken } from '../utils/token.js';
import { cleanPhoneNumber } from '@carmate/shared';

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
