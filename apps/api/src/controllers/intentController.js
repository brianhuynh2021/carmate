/**
 * ============================================================================
 * CONTROLLER: ZERO-SEARCH INTENT & BATCH MATCHING (LEVEL 3)
 * ============================================================================
 */

import {
  createIntent,
  getIntents,
  getIntentById,
  updateIntent,
  getMatchingEpochs
} from '../db/sqliteStore.js';

import {
  runBatchMatchingEpoch,
  calculateShapleyFairPrice,
  getCorridorDistanceKm
} from '../services/batchMatchingEngine.js';

import { cleanPhoneNumber, isValidVietnamesePhone } from '@carmate/shared';

/**
 * POST /api/intents - Khai báo ý định di chuyển (Chủ xe hoặc Khách)
 */
export async function createMovementIntentHandler(req, res) {
  try {
    const {
      role = 'passenger', // 'driver' | 'passenger'
      originHubId = '',
      originName = '',
      destinationHubId = '',
      destinationName = '',
      corridor = 'Tuyến QL13',
      date = '',
      timeSlot = '',
      seats = 1,
      isRecurring = false,
      recurringDays = [],
      isDoorstep = false,
      doorstepAddress = '',
      doorstepLat = null,
      doorstepLng = null,
      phone = '',
      contactName = ''
    } = req.body || {};

    const clean = cleanPhoneNumber(phone || req.user?.phone || '');
    if (!clean || !isValidVietnamesePhone(clean)) {
      return res.status(400).json({
        success: false,
        error: 'Số điện thoại không hợp lệ (cần đủ 10 số di động Việt Nam)'
      });
    }

    if (!originName || !destinationName) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng chọn điểm đi và điểm đến hợp lệ'
      });
    }

    // Tính toán ước tính giá Shapley minh bạch ngay khi khai báo ý định
    const distKm = getCorridorDistanceKm(originHubId || originName, destinationHubId || destinationName, corridor);
    const pricingEstimate = calculateShapleyFairPrice({
      distanceKm: distKm,
      corridor,
      numPassengers: Number(seats) || 1,
      isDoorstep: Boolean(isDoorstep)
    });

    const intent = await createIntent({
      userId: req.user?.id || `USR-${clean}`,
      role: role === 'driver' ? 'driver' : 'passenger',
      originHubId,
      originName,
      destinationHubId,
      destinationName,
      corridor,
      date,
      timeSlot,
      seats: Number(seats) || 1,
      isRecurring: Boolean(isRecurring),
      recurringDays: Array.isArray(recurringDays) ? recurringDays : [],
      isDoorstep: Boolean(isDoorstep),
      doorstepAddress,
      doorstepLat,
      doorstepLng,
      phone: clean,
      contactName: contactName || req.user?.name || (role === 'driver' ? 'Chủ xe' : 'Khách đi cùng'),
      estimatedPricing: pricingEstimate
    });

    return res.status(201).json({
      success: true,
      message: 'Khai báo ý định thành công. Hệ thống đang tự động gom phiên khớp lệnh.',
      data: intent,
      estimatedPricing: pricingEstimate
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/intents - Lấy danh sách ý định
 */
export function getMovementIntentsHandler(req, res) {
  try {
    const { role, corridor, date, status, userId } = req.query || {};
    const filter = {};
    if (role) filter.role = role;
    if (corridor) filter.corridor = corridor;
    if (date) filter.date = date;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const intents = getIntents(filter);
    return res.status(200).json({
      success: true,
      data: intents
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/intents/match - Kích hoạt phiên gom khớp lệnh tức thời (Manual hoặc Micro-batch)
 */
export async function runBatchMatchHandler(req, res) {
  try {
    const { epochType = 'micro_batch', corridor, date } = req.body || {};
    const result = await runBatchMatchingEpoch({ epochType, corridor, date });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/intents/epochs - Lịch sử các phiên khớp lệnh
 */
export function getMatchingEpochsHandler(req, res) {
  try {
    const limit = Number(req.query.limit) || 20;
    const epochs = getMatchingEpochs(limit);
    return res.status(200).json({
      success: true,
      data: epochs
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
