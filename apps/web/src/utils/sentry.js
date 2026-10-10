/**
 * CarMate Error Monitoring & Sentry Safe Wrapper
 * Fully prevents White Screen of Death incidents and reports errors centrally
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
 * Catches and records unexpected exceptions
 */
export function captureException(error, errorInfo = {}) {
  console.error('[CarMate Crash Caught]:', error, errorInfo);

  const isDev = Boolean(
    import.meta.env?.DEV ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  );

  // 1. Send to Sentry if available
  if (isSentryReady && typeof window !== 'undefined' && window.Sentry) {
    try {
      window.Sentry.captureException(error, { extra: errorInfo });
    } catch {
      // Ignore Sentry connection errors
    }
  }

  // 2. Automatically record into the Analytics SQLite Store with the isDev flag (so the backend does not send a Telegram alert)
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
