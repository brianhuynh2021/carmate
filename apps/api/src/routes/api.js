import { Router } from 'express';
import {
  listTrips,
  getTrip,
  createTrip,
  updateStatus,
  updateTripHandler,
  deleteTripHandler,
  republishTripHandler
} from '../controllers/tripController.js';
import { getMatches, getSocialSuggestions } from '../controllers/matchController.js';
import {
  listBookings,
  createBooking,
  reportDelay,
  cancelBooking,
  completeBooking,
  submitReview,
  getBookingPublicSummary,
  driverConfirmBooking,
  addBookingMessageHandler,
  preConfirmBookingHandler,
  finalConfirmBookingHandler,
  resetBanHandler,
  disputeBookingHandler,
  reportVehicleMismatchHandler,
  reportUnreachablePhoneHandler
} from '../controllers/bookingController.js';
import { getSupportMessagesHandler, sendSupportMessageHandler } from '../controllers/supportController.js';
import { getHealth, getBenchmarks, getStats, getTrustProfile, getPublicTrustRulesHandler } from '../controllers/miscController.js';
import { requestOtp, verifyOtp, zaloLogin, googleLogin, telegramLogin, getMe, updateProfile, deleteAccount, requestAccountDeletion, getAuthConfigHandler } from '../controllers/authController.js';
import {
  createMovementIntentHandler,
  getMovementIntentsHandler,
  runBatchMatchHandler,
  getMatchingEpochsHandler
} from '../controllers/intentController.js';
import {
  placeOrderHandler,
  getOrderBookHandler,
  getMyOrdersHandler,
  expireSlidingTTLHandler
} from '../controllers/seatExchangeController.js';
import {
  riderCheckInHandler,
  getStationQueueHandler,
  getRiderPassHandler,
  cockpitTelemetryHandler,
  cockpitAcceptOfferHandler,
  cockpitRejectOfferHandler,
  cockpitVerifyPinHandler,
  cockpitRegisterVehicleHandler,
  cockpitVehicleStatusHandler,
  cockpitApproveVehicleHandler,
  cockpitReportIncidentHandler,
  cockpitGetIncidentsHandler,
  riderReportCultureViolationHandler,
  riderCancelGraceHandler,
  riderGetRadarRiskHandler,
  resetStationDataHandler
} from '../controllers/stationQueueController.js';
import {
  createStationRequestHandler,
  listStationRequestsHandler,
  updateStationRequestStatusHandler
} from '../controllers/stationRequestController.js';
import {
  getVapidKeyHandler,
  subscribePushHandler,
  unsubscribePushHandler,
  listNotificationsHandler,
  markReadHandler,
  riderOnTheWayHandler,
  schedulerStatusHandler,
  schedulerRunTickHandler,
  timeSlotMatrixHandler,
  driverReadyHandler,
  rescueStatusHandler
} from '../controllers/notificationController.js';
import { requireAuth, optionalAuth, requireTripOwnership, requireBookingParty } from '../middlewares/authMiddleware.js';
import {
  adminAuth,
  getMetrics,
  listAdminTrips,
  toggleHideTripHandler,
  deleteTripAdminHandler,
  listAdminUsers,
  updateUserStatusHandler,
  getAdminReports,
  getAdminAiIntelligence,
  convertTripCarCategoryHandler,
  resolveMismatchReportHandler,
  getAdminTrustRulesHandler,
  updateAdminTrustRulesHandler,
  resetAdminTrustRulesHandler,
  listDeletionRequestsHandler,
  processDeletionRequestHandler,
  deleteUserAdminHandler,
  clearAdminAiTrajectories,
  clearAdminTestData,
  clearAdminBookings,
  requireAdmin
} from '../controllers/adminController.js';
import { authLimiter, postTripLimiter } from '../middlewares/security.js';

const router = Router();

import { suggestLocationsHandler } from '../controllers/locationController.js';
import { agentChatHandler } from '../controllers/agentController.js';
import { recordEvent, getSummary as getAnalyticsSummaryHandler, clearAnalytics as clearAnalyticsHandler } from '../controllers/analyticsController.js';

// --- Analytics & Funnel Tracking (Zero-Cost & PostHog Bridge) ---
router.post('/analytics/event', optionalAuth, recordEvent);
router.get('/admin/analytics/summary', requireAdmin, getAnalyticsSummaryHandler);
router.delete('/admin/analytics', requireAdmin, clearAnalyticsHandler);

// --- Agentic AI Concierge & Dispatcher (Stanford Inner Loop & Tools) ---
router.post('/agent/chat', optionalAuth, agentChatHandler);

// --- Auth & Identity (Zero-Cost / Google & Zalo với Auth Limiter & JWT) ---
router.get('/auth/config', getAuthConfigHandler);
router.post('/auth/google-login', googleLogin);
router.post('/auth/telegram-login', authLimiter, telegramLogin);
router.post('/auth/zalo-login', zaloLogin);
router.post('/auth/request-otp', authLimiter, requestOtp);
router.post('/auth/verify-otp', authLimiter, verifyOtp);
router.get('/auth/me', requireAuth, getMe);
router.patch('/auth/profile', requireAuth, updateProfile);
router.put('/auth/profile', requireAuth, updateProfile);
router.post('/auth/deletion-request', requireAuth, requestAccountDeletion);
router.delete('/auth/me', requireAuth, deleteAccount);
router.delete('/auth/account', requireAuth, deleteAccount);

// --- Health & Meta ---
router.get('/health', getHealth);
router.get('/benchmarks', getBenchmarks);
router.get('/stats', getStats);
router.get('/trust', getTrustProfile);
router.get('/trust/:memberId', getTrustProfile);
router.get('/trust-rules/public', getPublicTrustRulesHandler);
router.get('/locations/suggest', suggestLocationsHandler);

// --- Trips (với Post Limiter chống spam và bảo vệ quyền sở hữu Anti-IDOR & PII) ---
router.get('/trips', optionalAuth, listTrips);
router.get('/trips/:id', optionalAuth, getTrip);
router.post('/trips', postTripLimiter, optionalAuth, createTrip);
router.put('/trips/:id', optionalAuth, requireTripOwnership, updateTripHandler);
router.delete('/trips/:id', optionalAuth, requireTripOwnership, deleteTripHandler);
router.patch('/trips/:id/status', optionalAuth, requireTripOwnership, updateStatus);
router.post('/trips/:id/republish', postTripLimiter, optionalAuth, requireTripOwnership, republishTripHandler);

// --- Smart Matching Radar & Social Suggestions ---
router.get('/matches', optionalAuth, getMatches);
router.get('/matches/social-suggestions', optionalAuth, getSocialSuggestions);

// --- Autonomous Zero-Search Matching Engine (Level 3 - MIT & Nobel) ---
router.get('/intents', optionalAuth, getMovementIntentsHandler);
router.post('/intents', optionalAuth, createMovementIntentHandler);
router.post('/intents/match', optionalAuth, runBatchMatchHandler);
router.get('/intents/epochs', optionalAuth, getMatchingEpochsHandler);

// --- Sàn Giao Dịch Ghế Trống (Seat Exchange - LOB, CDA 24/7 Spot Market & Dynamic Sliding TTL) ---
// Đặt lệnh: chống spam bằng postTripLimiter; optionalAuth cho phép khách vãng lai
// đặt lệnh, nhưng khi ĐÃ đăng nhập thì SĐT trong token luôn thắng SĐT gửi từ body.
router.post('/seat-exchange/order', postTripLimiter, optionalAuth, placeOrderHandler);
// Sổ lệnh công khai: mọi lệnh trả ra đều đi qua lớp chắn PII (Nghị định 13/2023).
router.get('/seat-exchange/order-book', optionalAuth, getOrderBookHandler);
// Lịch sử lệnh cá nhân: BẮT BUỘC đăng nhập (chống dò quét bằng số điện thoại).
router.get('/seat-exchange/my-orders', requireAuth, getMyOrdersHandler);
// Quét TTL là tác vụ vận hành nội bộ: chỉ Quản trị viên (chống DoS xoá sạch sổ lệnh).
router.post('/seat-exchange/expire-ttl', requireAdmin, expireSlidingTTLHandler);

// --- Bookings / Connections (2-Phase Commit & In-app Chat) ---
router.get('/bookings', optionalAuth, listBookings);
router.post('/bookings', optionalAuth, createBooking);
router.get('/bookings/:id/public-summary', optionalAuth, getBookingPublicSummary);
router.post('/bookings/:id/driver-confirm', optionalAuth, driverConfirmBooking);
// Chốt T-40/T-30: chủ xe bấm "Tôi đang đi", và khách tra cứu Chế độ Cứu hộ
router.post('/bookings/:id/driver-ready', optionalAuth, driverReadyHandler);
router.get('/bookings/:id/rescue-status', optionalAuth, rescueStatusHandler);
router.post('/bookings/:id/messages', optionalAuth, addBookingMessageHandler);
router.post('/bookings/:id/pre-confirm', optionalAuth, preConfirmBookingHandler);
router.post('/bookings/:id/final-confirm', optionalAuth, finalConfirmBookingHandler);
router.post('/bookings/:id/delay', optionalAuth, requireBookingParty, reportDelay);
router.post('/bookings/:id/cancel', optionalAuth, requireBookingParty, cancelBooking);
router.post('/bookings/:id/complete', optionalAuth, requireBookingParty, completeBooking);
router.post('/bookings/:id/review', optionalAuth, requireBookingParty, submitReview);

// --- Báo cáo vi phạm an toàn (chỉ hai bên trong chuyến mới được tố giác) ---
router.post('/bookings/:id/report-vehicle-mismatch', optionalAuth, requireBookingParty, reportVehicleMismatchHandler);
router.post('/bookings/:id/report-unreachable-phone', optionalAuth, requireBookingParty, reportUnreachablePhoneHandler);
// Gỡ khoá tài khoản là THAO TÁC CHẾ TÀI, chỉ Quản trị viên được làm.
// Trước đây dùng optionalAuth: bất kỳ ai biết mã booking đều gọi ẩn danh để gỡ
// ban cho CẢ HAI bên, vô hiệu hoá toàn bộ hệ thống kỷ luật (kể cả Grim Trigger).
router.post('/bookings/:id/reset-ban', requireAdmin, resetBanHandler);
router.post('/bookings/:id/dispute', optionalAuth, disputeBookingHandler);

router.get('/escrows', optionalAuth, listBookings);
router.post('/escrows', optionalAuth, createBooking);
router.get('/escrows/:id/public-summary', optionalAuth, getBookingPublicSummary);
router.post('/escrows/:id/driver-confirm', optionalAuth, driverConfirmBooking);
router.post('/escrows/:id/messages', optionalAuth, addBookingMessageHandler);
router.post('/escrows/:id/pre-confirm', optionalAuth, preConfirmBookingHandler);
router.post('/escrows/:id/final-confirm', optionalAuth, finalConfirmBookingHandler);
router.post('/escrows/:id/delay', optionalAuth, requireBookingParty, reportDelay);
router.post('/escrows/:id/cancel', optionalAuth, requireBookingParty, cancelBooking);
router.post('/escrows/:id/complete', optionalAuth, requireBookingParty, completeBooking);
router.post('/escrows/:id/review', optionalAuth, requireBookingParty, submitReview);
router.post('/escrows/:id/report-vehicle-mismatch', optionalAuth, requireBookingParty, reportVehicleMismatchHandler);
router.post('/escrows/:id/report-unreachable-phone', optionalAuth, requireBookingParty, reportUnreachablePhoneHandler);
router.post('/escrows/:id/reset-ban', requireAdmin, resetBanHandler);
router.post('/escrows/:id/dispute', optionalAuth, disputeBookingHandler);

// --- Kênh Hỗ Trợ & Kháng Nghị Trực Tiếp Platform CSKH CarMate ---
router.get('/support/messages', optionalAuth, getSupportMessagesHandler);
router.post('/support/messages', optionalAuth, sendSupportMessageHandler);

// --- Station Curbside Queue & Cockpit Mode Live Dispatch ---
router.post('/station/:hubId/checkin', riderCheckInHandler);
router.get('/station/:hubId/status', getStationQueueHandler);
router.get('/station/rider/radar-risk', riderGetRadarRiskHandler);
router.post('/station/rider/report-culture-violation', riderReportCultureViolationHandler);
router.post('/station/rider/cancel-grace', riderCancelGraceHandler);
router.post('/station/rider/on-the-way', riderOnTheWayHandler);
router.get('/station/rider/:intentId', getRiderPassHandler);
router.post('/cockpit/telemetry', cockpitTelemetryHandler);
router.post('/cockpit/accept-offer', cockpitAcceptOfferHandler);
router.post('/cockpit/reject-offer', cockpitRejectOfferHandler);
router.post('/cockpit/verify-pin', cockpitVerifyPinHandler);
router.post('/cockpit/register-vehicle', cockpitRegisterVehicleHandler);
router.get('/cockpit/vehicle-status', cockpitVehicleStatusHandler);
router.post('/cockpit/approve-vehicle', cockpitApproveVehicleHandler);
router.post('/cockpit/report-incident', cockpitReportIncidentHandler);
router.get('/cockpit/incidents', cockpitGetIncidentsHandler);
router.delete('/station/reset', resetStationDataHandler);

// --- Station Requests Pool (Gom đề xuất mở trạm ảo mới - Hard Whitelist & Zero Roadside Stops) ---
router.post('/station-requests', optionalAuth, createStationRequestHandler);
router.get('/station-requests', optionalAuth, listStationRequestsHandler);
router.patch('/admin/station-requests/:id', requireAdmin, updateStationRequestStatusHandler);

// --- Ma Trận Khe Thời Gian (Time-Slotted Corridor) ---
router.get('/corridor/time-slots', timeSlotMatrixHandler);

// --- Thông Báo Đẩy & Hộp Thư In-App (Kênh đánh thức khách ngoài giờ mở app) ---
router.get('/notifications/vapid-key', getVapidKeyHandler);
router.post('/notifications/subscribe', optionalAuth, subscribePushHandler);
router.post('/notifications/unsubscribe', optionalAuth, unsubscribePushHandler);
router.get('/notifications', optionalAuth, listNotificationsHandler);
router.post('/notifications/read', optionalAuth, markReadHandler);

// --- Admin Management Portal Engine ---
router.post('/admin/auth', adminAuth);
router.get('/admin/metrics', requireAdmin, getMetrics);
router.get('/admin/scheduler-status', requireAdmin, schedulerStatusHandler);
router.post('/admin/scheduler-run', requireAdmin, schedulerRunTickHandler);
router.get('/admin/trips', requireAdmin, listAdminTrips);
router.patch('/admin/trips/:id/toggle-hide', requireAdmin, toggleHideTripHandler);
router.delete('/admin/trips/:id', requireAdmin, deleteTripAdminHandler);
router.patch('/admin/trips/:id/convert-car-category', requireAdmin, convertTripCarCategoryHandler);
router.get('/admin/users', requireAdmin, listAdminUsers);
router.patch('/admin/users/:id', requireAdmin, updateUserStatusHandler);
router.patch('/admin/users/:id/status', requireAdmin, updateUserStatusHandler);
router.get('/admin/reports', requireAdmin, getAdminReports);
router.patch('/admin/bookings/:id/resolve-mismatch', requireAdmin, resolveMismatchReportHandler);
router.get('/admin/ai-intelligence', requireAdmin, getAdminAiIntelligence);
router.get('/admin/trust-rules', requireAdmin, getAdminTrustRulesHandler);
router.put('/admin/trust-rules', requireAdmin, updateAdminTrustRulesHandler);
router.post('/admin/trust-rules/reset', requireAdmin, resetAdminTrustRulesHandler);
router.get('/admin/deletion-requests', requireAdmin, listDeletionRequestsHandler);
router.post('/admin/deletion-requests/:id/process', requireAdmin, processDeletionRequestHandler);
router.delete('/admin/users/:id', requireAdmin, deleteUserAdminHandler);
router.delete('/admin/ai-trajectories', requireAdmin, clearAdminAiTrajectories);
router.delete('/admin/test-data', requireAdmin, clearAdminTestData);
router.delete('/admin/bookings', requireAdmin, clearAdminBookings);

export default router;
