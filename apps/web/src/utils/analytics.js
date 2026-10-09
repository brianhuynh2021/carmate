/**
 * CarMate Analytics & Funnel Tracking Wrapper
 * Multi-channel integration: PostHog (if a key is present) + 0-cost internal SQLite store
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
 * Records a user-behavior analytics event
 * @param {string} eventName Event name (e.g. 'search_route', 'open_zalo')
 * @param {object} properties Accompanying data (route, direction, price, ...)
 */
export function trackEvent(eventName, properties = {}) {
  if (!eventName) return;

  const enrichedProps = {
    ...properties,
    url: typeof window !== 'undefined' ? window.location.href : '',
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    timestamp: Date.now()
  };

  // 1. PostHog capture (if enabled)
  if (isPosthogInitialized && typeof window !== 'undefined' && window.posthog) {
    try {
      window.posthog.capture(eventName, enrichedProps);
    } catch {
      // Ignore PostHog connection errors so the user flow is not blocked
    }
  }

  // 2. Internal SQLite Event Store (zero cost, always active)
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
        // Silent fail so the UX is not affected
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
