/**
 * CarMate API Client
 * Keeps data in sync between the Web Client and the Backend Express Engine (Port 4000).
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export function getStoredAuthToken() {
  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('carmate_auth_token');
    if (token) return token;
  }
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|; )carmate_auth_token=([^;]*)/);
    if (match && match[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

export function setStoredAuthToken(token) {
  if (!token) return;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('carmate_auth_token', token);
    } catch {}
  }
  if (typeof document !== 'undefined') {
    try {
      document.cookie = `carmate_auth_token=${encodeURIComponent(token)}; path=/; max-age=7776000; SameSite=Lax; secure`;
    } catch {}
  }
}

export function removeStoredAuthToken() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem('carmate_auth_token');
    } catch {}
  }
  if (typeof document !== 'undefined') {
    try {
      document.cookie = 'carmate_auth_token=; path=/; max-age=0; SameSite=Lax; secure';
      document.cookie = 'carmate_user_cached=; path=/; max-age=0; SameSite=Lax; secure';
    } catch {}
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const adminToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('carmate_admin_token') : null;
  const authToken = getStoredAuthToken();
  let userPhone = null;
  if (typeof localStorage !== 'undefined') {
    try {
      const cachedUser = JSON.parse(localStorage.getItem('carmate_user') || '{}');
      if (cachedUser?.phone) userPhone = cachedUser.phone;
    } catch {}
  }
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { 'x-admin-key': adminToken } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(userPhone ? { 'x-user-phone': userPhone } : {}),
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.error || `HTTP error! status: ${response.status}`);
      err.data = data;
      err.status = response.status;
      throw err;
    }
    return data;
  } catch (error) {
    console.warn(`[API Client] Yêu cầu tới ${endpoint} thất bại:`, error.message);
    throw error;
  }
}

export const api = {
  async listOperators(params = {}) {
    return request(`/operators?${new URLSearchParams(params)}`);
  },
  async getOperator(id) { return request(`/operators/${encodeURIComponent(id)}`); },
  async getMyOperators() { return request('/operators/mine'); },
  async updateOperator(id, body) { return request(`/operators/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }); },
  async claimOperator(id, body) { return request(`/operators/${encodeURIComponent(id)}/claims`, { method: 'POST', body: JSON.stringify(body) }); },
  async reportOperator(id, body) { return request(`/operators/${encodeURIComponent(id)}/reports`, { method: 'POST', body: JSON.stringify(body) }); },
  async getOperatorReportStatus(body) { return request('/operator-reports/status', { method: 'POST', body: JSON.stringify(body) }); },
  async adminListOperators(params = {}) { return request(`/admin/operators?${new URLSearchParams(params)}`); },
  async adminGetOperator(id) { return request(`/admin/operators/${encodeURIComponent(id)}`); },
  async adminCreateOperator(body) { return request('/admin/operators', { method: 'POST', body: JSON.stringify(body) }); },
  async adminUpdateOperator(id, body) { return request(`/admin/operators/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }); },
  async adminListOperatorClaims(params = {}) { return request(`/admin/operator-claims?${new URLSearchParams(params)}`); },
  async adminReviewOperatorClaim(id, body) { return request(`/admin/operator-claims/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }); },
  async adminListOperatorReports(params = {}) { return request(`/admin/operator-reports?${new URLSearchParams(params)}`); },
  async adminReviewOperatorReport(id, body) { return request(`/admin/operator-reports/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }); },
  async adminApplyReportedPhone(id, body) { return request(`/admin/operator-reports/${encodeURIComponent(id)}/apply-phone`, { method: 'POST', body: JSON.stringify(body) }); },
  async adminQuickPublishOperator(id, body = {}) { return request(`/admin/operators/${encodeURIComponent(id)}/quick-publish`, { method: 'POST', body: JSON.stringify(body) }); },
  async adminCreateOperatorTrip(id, body) { return request(`/admin/operators/${encodeURIComponent(id)}/trips`, { method: 'POST', body: JSON.stringify(body) }); },
  async previewDriverDemand(draft) {
    return request('/connections/driver-preview', { method: 'POST', body: JSON.stringify(draft) });
  },
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

  async getTrip(id) {
    return request(`/trips/${id}`);
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

  // Social Smart Matches
  async getSocialMatches(params = {}) {
    const query = new URLSearchParams();
    if (params.tripId) query.append('tripId', params.tripId);
    if (params.userRole) query.append('userRole', params.userRole);
    if (params.routeCategory && params.routeCategory !== 'all') query.append('routeCategory', params.routeCategory);
    if (params.direction && params.direction !== 'all') query.append('direction', params.direction);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/matches/social-suggestions${queryString}`);
  },

  // Bookings / Zalo Connections
  async getBookings(params = {}) {
    const query = new URLSearchParams();
    if (params?.phone) query.append('phone', params.phone);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/bookings${queryString}`);
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

  async resetBookingBan(id) {
    return request(`/bookings/${id}/reset-ban`, {
      method: 'POST'
    });
  },

  async disputeBooking(id, payload = {}) {
    return request(`/bookings/${id}/dispute`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getSupportMessages(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/support/messages${query ? '?' + query : ''}`);
  },

  async sendSupportMessage(payload = {}) {
    return request('/support/messages', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Auth & Identity (zero cost / Zalo & OTP)
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
    if (res?.token) {
      setStoredAuthToken(res.token);
    }
    return res;
  },

  /**
   * Attaches an OTP-verified phone number to the currently logged-in account.
   * Used for people who sign in via Telegram/Google — these two channels do not provide a phone number.
   * The server issues a new token because the old token carries an empty phone.
   */
  async verifyPhoneForAccount(phone, otp) {
    const res = await request('/auth/verify-phone', {
      method: 'POST',
      body: JSON.stringify({ phone, otp })
    });
    if (res?.token) {
      setStoredAuthToken(res.token);
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

  async firebaseLogin(payload) {
    const res = await request('/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res?.token) {
      setStoredAuthToken(res.token);
    }
    return res;
  },

  async googleLogin(payload) {
    const res = await request('/auth/google-login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res?.token) {
      setStoredAuthToken(res.token);
    }
    return res;
  },

  async telegramLogin(payload) {
    const res = await request('/auth/telegram-login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res?.token) {
      setStoredAuthToken(res.token);
    }
    return res;
  },

  async zaloLogin(payload) {
    const res = await request('/auth/zalo-login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res?.token) {
      setStoredAuthToken(res.token);
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

  async submitAccountDeletionRequest(reason) {
    return request('/auth/deletion-request', {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async deleteAccount() {
    const res = await request('/auth/me', {
      method: 'DELETE'
    });
    removeStoredAuthToken();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('carmate_user');
        localStorage.removeItem('carmate_my_trip_ids');
      } catch {}
    }
    return res;
  },

  logout() {
    removeStoredAuthToken();
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

  /**
   * Creates a driver profile (and the first trip) on the driver's behalf while the operations team is
   * out inviting drivers. The driver does not need to install the app yet; when they sign in with this very
   * phone number via OTP, they receive the full profile and the trips already posted.
   */
  async adminCreateDriver(payload) {
    return request('/admin/drivers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
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

  async adminClearAnalytics() {
    return request('/admin/analytics', {
      method: 'DELETE'
    });
  },

  async adminClearAiTrajectories() {
    return request('/admin/ai-trajectories', {
      method: 'DELETE'
    });
  },

  async adminClearTestData() {
    return request('/admin/test-data', {
      method: 'DELETE'
    });
  },

  async adminClearBookings() {
    return request('/admin/bookings', {
      method: 'DELETE'
    });
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
  },

  async getAdminDeletionRequests(status = '') {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/admin/deletion-requests${query}`);
  },

  async processAdminDeletionRequest(requestId, action, note = '') {
    return request(`/admin/deletion-requests/${requestId}/process`, {
      method: 'POST',
      body: JSON.stringify({ action, note })
    });
  },

  async deleteUserAdmin(userId) {
    return request(`/admin/users/${userId}`, {
      method: 'DELETE'
    });
  },

  // --- Curbside Station Queue & Cockpit Mode Telemetry ---
  async fetchJson(endpoint, options = {}) {
    return request(endpoint, options);
  },

  async stationCheckIn(hubId, payload) {
    return request(`/station/${hubId}/checkin`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getStationQueue(hubId) {
    return request(`/station/${hubId}/status`);
  },

  async getRiderPass(intentId) {
    return request(`/station/rider/${intentId}`);
  },

  async cockpitTelemetry(payload) {
    return request('/cockpit/telemetry', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async cockpitAcceptOffer(payload) {
    return request('/cockpit/accept-offer', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async cockpitRejectOffer(payload) {
    return request('/cockpit/reject-offer', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async cockpitVerifyPin(payload) {
    return request('/cockpit/verify-pin', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async cockpitDropoff(payload) {
    return request('/cockpit/dropoff', { method: 'POST', body: JSON.stringify(payload) });
  },

  async cockpitRegisterVehicle(payload) {
    return request('/cockpit/register-vehicle', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async cockpitVehicleStatus(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/cockpit/vehicle-status${query ? `?${query}` : ''}`);
  },

  async cockpitApproveVehicle(payload) {
    return request('/cockpit/approve-vehicle', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async resetStationData() {
    return request('/station/reset', {
      method: 'DELETE'
    });
  },

  // --- Station Requests Pool (collects proposals to open new virtual stations) ---
  async createStationRequest(payload) {
    return request('/station-requests', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getStationRequests(status = '') {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/station-requests${qs}`);
  },

  async updateStationRequestStatus(id, status, adminNote = '') {
    return request(`/admin/station-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNote })
    });
  },

  // --- Movement Intents & Batch Matching (Level 3 Autonomous Engine) ---
  async createMovementIntent(payload) {
    return request('/intents', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /** Edit a pending schedule: shift the time or change the seat count. */
  async updateMovementIntent(id, updates) {
    return request(`/intents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  },

  /** The driver confirms a gatekeeping checkpoint (NIGHT_LOCK / MORNING_WAKE / RED_LINE). */
  async confirmIntentCheckpoint(id, checkpoint) {
    return request(`/intents/${id}/checkpoint`, {
      method: 'POST',
      body: JSON.stringify({ checkpoint })
    });
  },

  /** Cancel a schedule (pending or already matched with a passenger). */
  async cancelMovementIntent(id, reason = '') {
    return request(`/intents/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  },

  async getMovementIntents(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return request(`/intents${qs ? `?${qs}` : ''}`);
  },

  async runBatchMatch(payload = {}) {
    return request('/intents/match', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getMatchingEpochs(limit = 20) {
    return request(`/intents/epochs?limit=${limit}`);
  },

  // --- Cockpit Incidents & Unhappy Cases Protocols ---
  async reportCockpitIncident(payload) {
    return request('/cockpit/report-incident', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getCockpitIncidents(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return request(`/cockpit/incidents${qs ? `?${qs}` : ''}`);
  },

  // --- Rider Unhappy Cases, Grim Trigger & Radar Sweep ---
  async reportRiderCultureViolation(payload) {
    return request('/station/rider/report-culture-violation', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async riderCancelGrace(payload) {
    return request('/station/rider/cancel-grace', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getRiderRadarRisk(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return request(`/station/rider/radar-risk${qs ? `?${qs}` : ''}`);
  },

  // ── Time Slot Matrix ─────────────────────────────────────────────────
  async getTimeSlotMatrix({ from, to, date = null, timeSlot = null, seats = 1, corridor = null, matchingPreference = 'balanced' } = {}) {
    const query = new URLSearchParams({ from, to, seats: String(seats) });
    if (date) query.append('date', date);
    query.append('matchingPreference', matchingPreference);
    if (timeSlot && timeSlot !== 'all') query.append('timeSlot', timeSlot);
    if (corridor) query.append('corridor', corridor);
    return request(`/corridor/time-slots?${query.toString()}`);
  },

  async getCorridorTimeline({ from, to, seats = 1, corridor = null } = {}) {
    const q = new URLSearchParams({ from, to, seats: String(seats) });
    if (corridor) q.append('corridor', corridor);
    return request(`/corridor/timeline?${q.toString()}`);
  },

  async riderAcceptStationOffer({ intentId, proposalVersion }) {
    return request(`/station/riders/${encodeURIComponent(intentId)}/accept`, { method: 'POST', body: JSON.stringify({ proposalVersion }) });
  },
  async cancelStationRequest({ intentId, reason, action = 'stop' }) {
    return request(`/station/riders/${encodeURIComponent(intentId)}/cancel`, { method: 'POST', body: JSON.stringify({ reason, action }) });
  },

  // ── T-30 Handshake ───────────────────────────────────────────────────
  async confirmOnTheWay(intentId, coords = {}) {
    return request('/station/rider/on-the-way', {
      method: 'POST',
      body: JSON.stringify({ intentId, ...coords })
    });
  },

  // ── Push Notifications & Inbox ───────────────────────────────────────
  async getVapidKey() {
    return request('/notifications/vapid-key');
  },

  async subscribePush(subscription, phone) {
    return request('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription, phone })
    });
  },

  async unsubscribePush(endpoint) {
    return request('/notifications/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint })
    });
  },

  async getNotifications(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') query.append(key, val);
    });
    const qs = query.toString();
    return request(`/notifications${qs ? `?${qs}` : ''}`);
  },

  async markNotificationsRead(payload = {}) {
    return request('/notifications/read', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // ── Rescue Mode & Readiness Confirmation ─────────────────────────────
  async getRescueStatus(bookingId) {
    return request(`/bookings/${bookingId}/rescue-status`);
  },

  async confirmDriverReady(bookingId) {
    return request(`/bookings/${bookingId}/driver-ready`, { method: 'POST' });
  },

  async getSchedulerStatus() {
    return request('/admin/scheduler-status');
  },

  // ── Daily Fuel Index (Daily Petrolimex Fuel Index) ───────────────────
  async getFuelPrice() {
    return request('/fuel-price');
  },

  /** Pricing-formula parameters currently applied marketplace-wide (public). */
  async getTariffParams() {
    return request('/tariff-params');
  },

  async getAdminFuelPrice() {
    return request('/admin/fuel-price');
  },

  async updateAdminFuelPrice(data) {
    return request('/admin/fuel-price', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async resetAdminFuelPrice() {
    return request('/admin/fuel-price/reset', {
      method: 'POST'
    });
  },

  // ── Pricing formula: only admins can raise parameters ──
  async getAdminTariffParams() {
    return request('/admin/tariff-params');
  },

  async previewAdminTariffParams(params) {
    return request('/admin/tariff-params/preview', {
      method: 'POST',
      body: JSON.stringify({ params })
    });
  },

  async updateAdminTariffParams(data) {
    return request('/admin/tariff-params', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async resetAdminTariffParams() {
    return request('/admin/tariff-params/reset', {
      method: 'POST'
    });
  }
};

export default api;
