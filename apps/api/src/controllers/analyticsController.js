import { saveAnalyticsEvent, getAnalyticsSummary, clearAnalyticsEvents } from '../db/sqliteStore.js';
import { sendSystemErrorAlert } from '../utils/telegramAlert.js';

/**
 * POST /api/analytics/event
 * Collect behavior analytics events & conversion funnel (zero cost)
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

    // If it is a crash event from the user's browser, automatically fire a Telegram alert (Production environment only)
    if (trimmedEventName === 'error_unhandled') {
      const isDevEvent =
        properties?.isDev ||
        properties?.stack?.includes('localhost') ||
        properties?.stack?.includes('127.0.0.1') ||
        req?.headers?.origin?.includes('localhost') ||
        req?.headers?.referer?.includes('localhost') ||
        req?.ip === '::1' ||
        req?.ip === '127.0.0.1';

      if (!isDevEvent || process.env.ENABLE_DEV_TELEGRAM_ALERTS === 'true') {
        const clientError = new Error(properties?.message || 'Sự cố ngoại lệ trình duyệt (Client Crash)');
        if (properties?.stack) clientError.stack = properties.stack;
        sendSystemErrorAlert({
          error: clientError,
          req,
          source: 'Frontend Browser (Client Crash)'
        }).catch(() => {});
      } else {
        console.warn(
          `[Analytics Local Crash Ignored for Telegram]: ${properties?.message || 'Client Crash'} (Localhost/Dev)`
        );
      }
    }

    return res.status(201).json({ success: true, message: 'Ghi nhận sự kiện thành công' });
  } catch (error) {
    console.error('[Analytics] Lỗi khi ghi sự kiện:', error);
    return res.status(500).json({ success: false, error: 'Không thể ghi nhận sự kiện phân tích' });
  }
}

/**
 * GET /api/admin/analytics/summary
 * View the conversion funnel overview and the most searched routes
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

/**
 * DELETE /api/admin/analytics
 * Admin deletes all analytics events
 */
export function clearAnalytics(req, res) {
  try {
    const deletedCount = clearAnalyticsEvents();
    return res.json({
      success: true,
      message: `Đã dọn sạch ${deletedCount} sự kiện phân tích`,
      count: deletedCount
    });
  } catch (error) {
    console.error('[Analytics] Lỗi khi xoá sự kiện:', error);
    return res.status(500).json({ success: false, error: 'Không thể xoá dữ liệu phân tích' });
  }
}
