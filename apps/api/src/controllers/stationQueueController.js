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

export function riderCheckInHandler(req, res) {
  try {
    const { hubId } = req.params;
    const { destinationHubId, seatsNeeded, phone, name } = req.body || {};

    const result = riderCheckIn({
      hubId,
      destinationHubId,
      seatsNeeded,
      phone,
      name
    });

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
