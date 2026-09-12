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

import { cleanPhoneNumber, isValidVietnamesePhone, maskPhoneNumber } from '@carmate/shared';

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
    const { role, corridor, date, status, userId, mine } = req.query || {};
    const filter = {};
    if (role) filter.role = role;
    if (corridor) filter.corridor = corridor;
    if (date) filter.date = date;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const intents = getIntents(filter);

    const viewerPhone = cleanPhoneNumber(req.user?.phone || '');
    const viewerId = req.user?.id || null;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

    const isOwner = (intent) =>
      isAdmin ||
      (viewerPhone && cleanPhoneNumber(intent.phone || '') === viewerPhone) ||
      (viewerId && intent.userId === viewerId);

    // `?mine=1`: chỉ trả ý định của chính người đang đăng nhập. Trước đây giao
    // diện phải tải TOÀN BỘ ý định rồi tự lọc theo số điện thoại ở phía client —
    // cách đó chỉ chạy được vì máy chủ lộ số thật của tất cả mọi người.
    const scoped = mine ? intents.filter(isOwner) : intents;

    // LỚP CHẮN PII (Nghị định 13/2023): sàn công khai chỉ được thấy bí danh và
    // số đã che. Số thật, tên thật chỉ hiện với chính chủ hoặc Quản trị viên.
    const data = scoped.map((intent) => {
      if (isOwner(intent)) return { ...intent, isOwner: true };
      const tail = String(intent.id || '').slice(-3).toUpperCase() || 'XXX';
      const safe = { ...intent };
      safe.phoneMasked = maskPhoneNumber(intent.phone || '');
      safe.publicName = intent.role === 'driver' ? `Chủ xe CX-${tail}` : `Người đi cùng KX-${tail}`;
      delete safe.phone;
      delete safe.phoneReal;
      delete safe.contactName;
      delete safe.userId;
      delete safe.matchedBookingId;
      return safe;
    });

    return res.status(200).json({
      success: true,
      data
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
