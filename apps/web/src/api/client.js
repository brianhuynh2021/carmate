/**
 * CarMate API Client
 * Kết nối đồng bộ dữ liệu giữa Web Client và Backend Express Engine (Port 4000).
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const adminToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('carmate_admin_token') : null;
  const authToken = typeof localStorage !== 'undefined' ? localStorage.getItem('carmate_auth_token') : null;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { 'x-admin-key': adminToken } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn(`[API Client] Yêu cầu tới ${endpoint} thất bại:`, error.message);
    throw error;
  }
}

export const api = {
  // Health & Stats
  async getHealth() {
    return request('/health');
  },

  async getStats() {
    return request('/stats');
  },

  async getBenchmarks(routeId) {
    return request(`/benchmarks${routeId ? `?routeId=${encodeURIComponent(routeId)}` : ''}`);
  },

  async getTrustProfile(memberId) {
    return request(`/trust${memberId ? `/${memberId}` : ''}`);
  },

  // Trips
  async getTrips(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== 'all' && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/trips${queryString}`);
  },

  async createTrip(tripData) {
    return request('/trips', {
      method: 'POST',
      body: JSON.stringify(tripData)
    });
  },

  async updateTrip(id, updates) {
    return request(`/trips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  async deleteTrip(id) {
    return request(`/trips/${id}`, {
      method: 'DELETE'
    });
  },

  async republishTrip(id, updates = {}) {
    return request(`/trips/${id}/republish`, {
      method: 'POST',
      body: JSON.stringify(updates)
    });
  },

  // Matches Radar
  async getMatches(params = {}) {
    const query = new URLSearchParams();
    if (params.routeCategory && params.routeCategory !== 'all') query.append('routeCategory', params.routeCategory);
    if (params.direction && params.direction !== 'all') query.append('direction', params.direction);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/matches${queryString}`);
  },

  // Bookings / Zalo Connections
  async getBookings() {
    return request('/bookings');
  },

  async createBooking(bookingData) {
    return request('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
  },

  async reportDelay(id, minutes, reason) {
    return request(`/bookings/${id}/delay`, {
      method: 'POST',
      body: JSON.stringify({ minutes, reason })
    });
  },

  async cancelBooking(id, reason) {
    return request(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async completeBooking(id, feedback = {}) {
    return request(`/bookings/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(feedback)
    });
  },

  async submitReview(id, reviewData = {}) {
    return request(`/bookings/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(reviewData)
    });
  },

  async getBookingPublicSummary(id, token = '') {
    const qs = token ? `?t=${encodeURIComponent(token)}` : '';
    return request(`/bookings/${id}/public-summary${qs}`);
  },

  async driverConfirmBooking(id, payload = {}, token = '') {
    return request(`/bookings/${id}/driver-confirm`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, accessToken: token || payload.accessToken })
    });
  },

  async sendBookingMessage(id, messageData = {}) {
    return request(`/bookings/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(messageData)
    });
  },

  async preConfirmBooking(id, payload = {}) {
    return request(`/bookings/${id}/pre-confirm`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async finalConfirmBooking(id, payload = {}) {
    return request(`/bookings/${id}/final-confirm`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async reportVehicleMismatch(id, data = {}) {
    return request(`/bookings/${id}/report-vehicle-mismatch`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Auth & Identity (0đ chi phí / Zalo & OTP)
  async requestOtp(phone) {
    return request('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
  },

  async verifyOtp(payload) {
    const res = await request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res?.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('carmate_auth_token', res.token);
    }
    return res;
  },

  async getAuthConfig() {
    try {
      const res = await request('/auth/config');
      return res?.data || res || {};
    } catch {
      return { googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '' };
    }
  },

  async googleLogin(payload) {
    const res = await request('/auth/google-login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res?.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('carmate_auth_token', res.token);
    }
    return res;
  },

  async telegramLogin(payload) {
    const res = await request('/auth/telegram-login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res?.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('carmate_auth_token', res.token);
    }
    return res;
  },

  async zaloLogin(payload) {
    const res = await request('/auth/zalo-login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res?.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('carmate_auth_token', res.token);
    }
    return res;
  },

  async getMe() {
    return request('/auth/me');
  },

  async updateProfile(profileData) {
    return request('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData)
    });
  },

  async deleteAccount() {
    const res = await request('/auth/me', {
      method: 'DELETE'
    });
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('carmate_auth_token');
      localStorage.removeItem('carmate_user');
      localStorage.removeItem('carmate_my_trip_ids');
    }
    return res;
  },

  logout() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('carmate_auth_token');
    }
  },

  // --- Admin Engine Calls ---
  async adminAuth(passcode, mfaCode, mfaSessionId) {
    return request('/admin/auth', {
      method: 'POST',
      body: JSON.stringify({ passcode, mfaCode, mfaSessionId })
    });
  },

  async resendAdminMfa(mfaSessionId) {
    return request('/admin/auth', {
      method: 'POST',
      body: JSON.stringify({ mfaSessionId, action: 'resend' })
    });
  },

  async getAdminMetrics() {
    return request('/admin/metrics');
  },

  async getAdminTrips() {
    return request('/admin/trips');
  },

  async toggleHideTrip(id, isHidden) {
    return request(`/admin/trips/${id}/toggle-hide`, {
      method: 'PATCH',
      body: JSON.stringify({ isHidden })
    });
  },

  async deleteAdminTrip(id) {
    return request(`/admin/trips/${id}`, {
      method: 'DELETE'
    });
  },

  async getAdminUsers() {
    return request('/admin/users');
  },

  async updateUserStatus(id, updates) {
    return request(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  },

  async getAdminReports() {
    return request('/admin/reports');
  },

  async adminConvertCarCategory(tripId, carCategory = 'convenient_trip', bookingId = null) {
    return request(`/admin/trips/${tripId}/convert-car-category`, {
      method: 'PATCH',
      body: JSON.stringify({ carCategory, bookingId })
    });
  },

  async adminResolveMismatch(bookingId, status = 'dismissed', note = '') {
    return request(`/admin/bookings/${bookingId}/resolve-mismatch`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note })
    });
  },

  async getAdminAiIntelligence() {
    return request('/admin/ai-intelligence');
  },

  async getAdminAnalyticsSummary() {
    return request('/admin/analytics/summary');
  },

  // Agentic AI Concierge & Dispatcher (Stanford Inner Loop)
  async agentChat(message, history = []) {
    return request('/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history })
    });
  },

  // Dynamic Trust & Reputation Policy Rules
  async getPublicTrustRules() {
    return request('/trust-rules/public');
  },

  async getAdminTrustRules() {
    return request('/admin/trust-rules');
  },

  async updateAdminTrustRules(rules) {
    return request('/admin/trust-rules', {
      method: 'PUT',
      body: JSON.stringify({ rules })
    });
  },

  async resetAdminTrustRules() {
    return request('/admin/trust-rules/reset', {
      method: 'POST'
    });
  }
};

export default api;
