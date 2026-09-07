import { saveAnalyticsEvent, getAnalyticsSummary } from '../db/sqliteStore.js';
import { sendSystemErrorAlert } from '../utils/telegramAlert.js';

/**
 * POST /api/analytics/event
 * Thu thập sự kiện phân tích hành vi & phễu chuyển đổi (0 chi phí)
 */
export function recordEvent(req, res) {
  try {
    const { eventName, properties, userId } = req.body || {};

    if (!eventName || typeof eventName !== 'string' || eventName.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'eventName là bắt buộc và phải là chuỗi ký tự' });
    }

    if (eventName.length > 100) {
      return res.status(400).json({ success: false, error: 'eventName không được vượt quá 100 ký tự' });
    }

    const trimmedEventName = eventName.trim();
    const effectiveUserId = req.user?.id || userId || null;

    saveAnalyticsEvent({
      eventName: trimmedEventName,
      properties: properties && typeof properties === 'object' ? properties : {},
      userId: effectiveUserId,
      createdAt: Date.now()
    });

    // Nếu là sự kiện crash từ trình duyệt người dùng, tự động bắn cảnh báo Telegram
    if (trimmedEventName === 'error_unhandled') {
      const clientError = new Error(properties?.message || 'Sự cố ngoại lệ trình duyệt (Client Crash)');
      if (properties?.stack) clientError.stack = properties.stack;
      sendSystemErrorAlert({
        error: clientError,
        req,
        source: 'Frontend Browser (Client Crash)'
      }).catch(() => {});
    }

    return res.status(201).json({ success: true, message: 'Ghi nhận sự kiện thành công' });
  } catch (error) {
    console.error('[Analytics] Lỗi khi ghi sự kiện:', error);
    return res.status(500).json({ success: false, error: 'Không thể ghi nhận sự kiện phân tích' });
  }
}

/**
 * GET /api/admin/analytics/summary
 * Xem tổng quan phễu chuyển đổi và các tuyến xe được tìm kiếm nhiều nhất
 */
export function getSummary(req, res) {
  try {
    const summary = getAnalyticsSummary();
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('[Analytics] Lỗi khi lấy thống kê:', error);
    return res.status(500).json({ success: false, error: 'Không thể tải dữ liệu phân tích' });
  }
}
