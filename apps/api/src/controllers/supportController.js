import {
  saveSupportMessage,
  getSupportMessages,
  resolveDisputeAndUnban
} from '../db/sqliteStore.js';
import { sendBusinessAlert } from '../utils/telegramAlert.js';

/**
 * GET /api/support/messages - Lấy danh sách tin nhắn trò chuyện với Platform CSKH CarMate
 */
export async function getSupportMessagesHandler(req, res) {
  try {
    const { bookingId, userId, phone, limit = 50 } = req.query || {};
    const effectiveUserId = req.user?.id || userId;
    const effectivePhone = req.user?.phone || phone;

    const messages = getSupportMessages({
      bookingId,
      userId: effectiveUserId,
      phone: effectivePhone,
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 50))
    });

    // Nếu chưa có tin nhắn nào, gửi lời chào đầu tiên từ Platform Support
    if (messages.length === 0) {
      const welcomeMsg = {
        id: 'SUP-WELCOME',
        senderRole: 'platform',
        senderName: 'CSKH CarMate (Trực tuyến 24/7)',
        message: '👋 Xin chào bạn! Đây là Kênh Hỗ Trợ & Khiếu Nại Trực Tiếp của Ban Quản Trị CarMate. Nếu bạn gặp bất kỳ sự cố nào hoặc tài khoản bị khóa nhầm ("khóa lộn"), hãy nhắn tin tại đây để được hỗ trợ gỡ khóa và giải quyết ngay lập tức nhé!',
        createdAt: Date.now(),
        type: 'support',
        status: 'open'
      };
      return res.status(200).json({
        success: true,
        data: [welcomeMsg]
      });
    }

    return res.status(200).json({
      success: true,
      data: messages
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/support/messages - Gửi tin nhắn đến Platform CSKH & Tự động xử lý khiếu nại (Ambient Resolution)
 */
export async function sendSupportMessageHandler(req, res) {
  try {
    const { bookingId, userId, phone, senderName, type = 'support' } = req.body || {};
    const text = (req.body?.text || req.body?.message || '').trim();
    if (!text) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập nội dung cần hỗ trợ' });
    }

    const effectiveUserId = req.user?.id || userId;
    const effectivePhone = req.user?.phone || phone;
    const effectiveName = req.user?.name || senderName || 'Thành viên';

    // 1. Lưu tin nhắn của người dùng
    const userMsg = saveSupportMessage({
      bookingId: bookingId || null,
      userId: effectiveUserId || null,
      phone: effectivePhone || null,
      senderRole: 'user',
      senderName: effectiveName,
      message: text.trim(),
      type,
      status: 'open'
    });

    const lowerText = text.toLowerCase();
    const isUnbanIntent =
      type === 'ban_dispute' ||
      type === 'strike_dispute' ||
      /(mở khóa|mo khoa|khóa lộn|khoa lon|khóa nhầm|khoa nham|bị khóa|bi khoa|bị ban|bi ban|unban|gõ nhầm|go nham|nhầm số|nham so|kháng nghị|khang nghi|khiếu nại|khieu nai|oan|giúp em mở|giup em mo)/i.test(
        lowerText
      );

    let platformReply = null;
    let isUnbanned = false;

    if (isUnbanIntent) {
      // Tự động gỡ khóa và phục hồi điểm tín nhiệm tức thì (Instant Relief UX)
      await resolveDisputeAndUnban({
        bookingId: bookingId || null,
        userId: effectiveUserId,
        phone: effectivePhone,
        reason: 'Khiếu nại khóa lộn / gõ nhầm qua Kênh CSKH Trực Tiếp',
        note: text.trim()
      });
      isUnbanned = true;

      // Phản hồi từ Platform Support
      platformReply = saveSupportMessage({
        bookingId: bookingId || null,
        userId: effectiveUserId || null,
        phone: effectivePhone || null,
        senderRole: 'platform',
        senderName: 'CSKH CarMate (Trực tuyến 24/7)',
        message:
          '✅ Dạ CarMate xin chào bạn! Hệ thống Hỗ trợ Khẩn cấp đã tiếp nhận giải trình của bạn. Chúng tôi đã tiến hành kiểm tra lại giao dịch và MỞ KHÓA TÀI KHOẢN của bạn ngay lập tức. Toàn bộ quyền đăng bài, đặt chuyến và điểm tín nhiệm đã được khôi phục. Chúc bạn có những hành trình thuận lợi và an toàn cùng CarMate!',
        type: 'ban_dispute',
        status: 'resolved'
      });

      // Gửi báo động Telegram cho Admin
      sendBusinessAlert({
        title: '🛡️ AUTO-UNBAN: Khôi phục tài khoản qua Kênh CSKH Platform',
        details: {
          'Người dùng': effectiveName,
          'SĐT/ID': effectivePhone || effectiveUserId || 'N/A',
          'Mã chuyến liên quan': bookingId || 'N/A',
          'Nội dung khiếu nại': text.trim()
        },
        req
      }).catch(() => {});
    } else {
      // Phản hồi hỗ trợ thành viên / người đi cùng thông thường
      platformReply = saveSupportMessage({
        bookingId: bookingId || null,
        userId: effectiveUserId || null,
        phone: effectivePhone || null,
        senderRole: 'platform',
        senderName: 'CSKH CarMate (Trực tuyến 24/7)',
        message:
          'Dạ CarMate đã nhận được tin nhắn của bạn! Chuyên viên hỗ trợ của chúng tôi sẽ phản hồi thêm nếu có thông tin mới. Nếu bạn cần hỗ trợ khẩn cấp về an toàn chuyến đi hoặc gỡ khóa tài khoản, hãy ghi rõ yêu cầu để hệ thống xử lý tự động ngay nhé!',
        type: 'support',
        status: 'open'
      });
    }

    return res.status(201).json({
      success: true,
      message: isUnbanned ? 'Đã gỡ khóa tài khoản thành công.' : 'Đã gửi tin nhắn hỗ trợ thành công.',
      data: {
        userMessage: userMsg,
        platformReply,
        isUnbanned
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
