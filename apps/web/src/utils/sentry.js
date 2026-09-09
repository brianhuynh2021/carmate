/**
 * CarMate Error Monitoring & Sentry Safe Wrapper
 * Ngăn chặn hoàn toàn sự cố White Screen of Death và báo lỗi tập trung
 */

import { trackEvent } from './analytics.js';

let isSentryReady = false;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  if (typeof window !== 'undefined' && window.Sentry) {
    try {
      window.Sentry.init({
        dsn,
        environment: import.meta.env.MODE || 'production',
        tracesSampleRate: 0.1
      });
      isSentryReady = true;
    } catch (err) {
      console.warn('[Sentry] Không thể khởi tạo:', err);
    }
  }
}

/**
 * Bắt và ghi nhận ngoại lệ không mong muốn
 */
export function captureException(error, errorInfo = {}) {
  console.error('[CarMate Crash Caught]:', error, errorInfo);

  const isDev = Boolean(
    import.meta.env?.DEV ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  );

  // 1. Gửi tới Sentry nếu có
  if (isSentryReady && typeof window !== 'undefined' && window.Sentry) {
    try {
      window.Sentry.captureException(error, { extra: errorInfo });
    } catch {
      // Bỏ qua lỗi kết nối Sentry
    }
  }

  // 2. Tự động ghi nhận vào Analytics SQLite Store với cờ isDev (để backend không gửi alert Telegram)
  try {
    trackEvent('error_unhandled', {
      message: error?.message || String(error),
      stack: error?.stack ? error.stack.slice(0, 500) : null,
      componentStack: errorInfo?.componentStack ? errorInfo.componentStack.slice(0, 500) : null,
      isDev
    });
  } catch {
    // Silent
  }
}
