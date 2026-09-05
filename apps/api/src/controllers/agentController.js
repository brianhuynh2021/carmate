import { runCarMateAgent } from '../agent/carmateAgent.js';

/**
 * POST /api/agent/chat - Giao tiếp với Trợ lý Điều phối CarMate AI
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

    const result = await runCarMateAgent({
      message: message.trim(),
      history,
      userContext
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('[Agent Controller] Lỗi xử lý yêu cầu Agent:', err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi hệ thống khi xử lý yêu cầu với Trợ lý AI: ' + err.message
    });
  }
}
