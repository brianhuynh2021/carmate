/**
 * CarMate Analytics & Funnel Tracking Wrapper
 * Tích hợp đa kênh: PostHog (nếu có key) + 0-cost internal SQLite store
 */

let isPosthogInitialized = false;

export function initAnalytics() {
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (posthogKey && typeof window !== 'undefined' && window.posthog) {
    try {
      window.posthog.init(posthogKey, {
        api_host: posthogHost,
        autocapture: true,
        capture_pageview: true,
        persistence: 'localStorage'
      });
      isPosthogInitialized = true;
    } catch (err) {
      console.warn('[Analytics] Không thể khởi tạo PostHog:', err);
    }
  }
}

/**
 * Ghi nhận sự kiện phân tích hành vi người dùng
 * @param {string} eventName Tên sự kiện (ví dụ: 'search_route', 'open_zalo')
 * @param {object} properties Dữ liệu đi kèm (route, direction, price, ...)
 */
export function trackEvent(eventName, properties = {}) {
  if (!eventName) return;

  const enrichedProps = {
    ...properties,
    url: typeof window !== 'undefined' ? window.location.href : '',
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    timestamp: Date.now()
  };

  // 1. PostHog capture (nếu đã kích hoạt)
  if (isPosthogInitialized && typeof window !== 'undefined' && window.posthog) {
    try {
      window.posthog.capture(eventName, enrichedProps);
    } catch {
      // Bỏ qua lỗi kết nối PostHog để không block luồng người dùng
    }
  }

  // 2. Nội bộ SQLite Event Store (0 chi phí, luôn hoạt động)
  if (typeof fetch !== 'undefined') {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('carmate_auth_token') : null;
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          eventName,
          properties: enrichedProps
        })
      }).catch(() => {
        // Silent fail để không ảnh hưởng trải nghiệm UX
      });
    } catch {
      // Silent fail
    }
  }
}

// Shortcut helpers
export const trackPageView = (pageName) => trackEvent('page_view', { page: pageName });
export const trackSearchRoute = (route, meta = {}) => trackEvent('search_route', { route, ...meta });
export const trackViewTrip = (tripId, route) => trackEvent('view_trip', { tripId, route });
export const trackInitiateBooking = (tripId, seats) => trackEvent('initiate_booking', { tripId, seats });
export const trackDriverConfirm = (bookingId, tripId) => trackEvent('driver_confirm', { bookingId, tripId });
export const trackViewBusDetail = (operator, meta = {}) => trackEvent('click_view_bus_detail', { operator, ...meta });
export const trackCallBus = (operator, hotline, meta = {}) => trackEvent('click_call_bus', { operator, hotline, ...meta });
export const trackBusSheetCarMateCta = (operator, meta = {}) => trackEvent('click_bus_sheet_carmate_cta', { operator, ...meta });
