import { runCarMateAgent } from '../agent/carmateAgent.js';
import { recordAiTrajectory } from '../db/sqliteStore.js';

/**
 * POST /api/agent/chat - Giao tiếp với Trợ lý Điều phối CarMate AI
 * Tích hợp Hộp đen lưu trữ Quỹ đạo AI (MIT & Stanford Trajectory Hub)
 */
export async function agentChatHandler(req, res) {
  try {
    const { message, history = [] } = req.body || {};

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập nội dung câu hỏi hoặc yêu cầu tìm chuyến đi'
      });
    }

    const userContext = req.user ? {
      userId: req.user.userId,
      phone: req.user.phone,
      name: req.user.name,
      role: req.user.role
    } : {};

    const startTime = Date.now();
    const result = await runCarMateAgent({
      message: message.trim(),
      history,
      userContext
    });
    const executionTimeMs = Date.now() - startTime;

    // Phân tích nhu cầu tìm xe & phát hiện Tuyến đường thiếu xe (Unmet Demand)
    const suggestionsCount = Array.isArray(result.suggestedTrips) ? result.suggestedTrips.length : 0;
    const isRideQuery = /tìm|xe|chuyến|đi|về|đón|chở|từ|bến|hàng xanh/i.test(message);
    const unmetDemand = isRideQuery && suggestionsCount === 0;

    let requestedRoute = result.requestedRoute || '';
    if (!requestedRoute) {
      const lower = message.toLowerCase();
      if (lower.includes('bù đốp')) requestedRoute = 'Bù Đốp ➔ Sài Gòn';
      else if (lower.includes('đồng xoài')) requestedRoute = 'Đồng Xoài ➔ Sài Gòn';
      else if (lower.includes('chơn thành')) requestedRoute = 'Chơn Thành ➔ Sài Gòn';
      else if (lower.includes('bình phước')) requestedRoute = 'Bình Phước ➔ Sài Gòn';
      else if (lower.includes('hải phòng')) requestedRoute = 'Hà Nội ➔ Hải Phòng';
      else if (lower.includes('vũng tàu')) requestedRoute = 'Sài Gòn ➔ Vũng Tàu';
    }

    // Ghi nhận quỹ đạo suy luận vào Hộp đen AI Observability
    try {
      recordAiTrajectory({
        userGoal: message.trim(),
        requestedRoute,
        reasoningSteps: result.reasoningSteps || [],
        suggestionsCount,
        executionTimeMs,
        unmetDemand
      });
    } catch (e) {
      console.warn('[Agent Controller] Lỗi lưu trajectory:', e.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        ...result,
        executionTimeMs
      }
    });
  } catch (err) {
    console.error('[Agent Controller] Lỗi xử lý yêu cầu Agent:', err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi hệ thống khi xử lý yêu cầu với Trợ lý AI: ' + err.message
    });
  }
}

