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
import { requestOtp, verifyOtp, zaloLogin, googleLogin, telegramLogin, firebaseLogin, getMe, updateProfile, deleteAccount, requestAccountDeletion, getAuthConfigHandler,
  verifyPhoneForAccount
} from '../controllers/authController.js';
import {
  createMovementIntentHandler,
  previewDriverConnectionsHandler,
  getMovementIntentsHandler,
  updateMovementIntentHandler,
  cancelMovementIntentHandler,
  confirmIntentCheckpointHandler,
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
  resetStationDataHandler,
  riderAcceptOfferHandler,
  riderCancelIntentHandler,
  cockpitDropoffHandler
} from '../controllers/stationQueueController.js';
import {
  createStationRequestHandler,
  listStationRequestsHandler,
  updateStationRequestStatusHandler
} from '../controllers/stationRequestController.js';
import {
  getTransitDirectoryHandler,
  getAdminTransitDirectoryHandler,
  updateAdminTransitDirectoryHandler
} from '../controllers/transitDirectoryController.js';
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
  corridorTimelineHandler,
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
  requireAdmin,
  getPublicFuelPriceHandler,
  getPublicTariffParamsHandler,
  getAdminFuelPriceHandler,
  updateAdminFuelPriceHandler,
  resetAdminFuelPriceHandler,
  getAdminTariffParamsHandler,
  previewAdminTariffParamsHandler,
  updateAdminTariffParamsHandler,
  resetAdminTariffParamsHandler
} from '../controllers/adminController.js';
import { authLimiter, postTripLimiter, createRateLimiter } from '../middlewares/security.js';
import {
  listOperatorsHandler, getOperatorHandler, listMyOperatorsHandler, updateOwnedOperatorHandler,
  createOperatorClaimHandler, createOperatorReportHandler, getOperatorReportStatusHandler,
  adminListOperatorsHandler, adminGetOperatorHandler, adminCreateOperatorHandler, adminUpdateOperatorHandler,
  adminListClaimsHandler, adminReviewClaimHandler, adminListReportsHandler, adminReviewReportHandler
} from '../controllers/operatorController.js';
import { createAssistedOperatorTrip } from '../controllers/assistedOperatorTripController.js';

const router = Router();
const operatorWriteLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 12 });
const reportLookupLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 });

router.get('/operators', listOperatorsHandler);
router.get('/operators/mine', requireAuth, listMyOperatorsHandler);
router.get('/operators/:id', getOperatorHandler);
router.patch('/operators/:id', requireAuth, operatorWriteLimiter, updateOwnedOperatorHandler);
router.post('/operators/:id/claims', requireAuth, operatorWriteLimiter, createOperatorClaimHandler);
router.post('/operators/:id/reports', operatorWriteLimiter, createOperatorReportHandler);
router.post('/operator-reports/status', reportLookupLimiter, getOperatorReportStatusHandler);
router.get('/admin/operators', requireAdmin, adminListOperatorsHandler);
router.get('/admin/operators/:id', requireAdmin, adminGetOperatorHandler);
router.post('/admin/operators', requireAdmin, adminCreateOperatorHandler);
router.patch('/admin/operators/:id', requireAdmin, adminUpdateOperatorHandler);
router.post('/admin/operators/:id/trips', requireAdmin, createAssistedOperatorTrip);
router.get('/admin/operator-claims', requireAdmin, adminListClaimsHandler);
router.patch('/admin/operator-claims/:id', requireAdmin, adminReviewClaimHandler);
router.get('/admin/operator-reports', requireAdmin, adminListReportsHandler);
router.patch('/admin/operator-reports/:id', requireAdmin, adminReviewReportHandler);

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
router.post('/auth/firebase-login', authLimiter, firebaseLogin);
router.post('/auth/google-login', googleLogin);
router.post('/auth/telegram-login', authLimiter, telegramLogin);
router.post('/auth/zalo-login', zaloLogin);
router.post('/auth/request-otp', authLimiter, requestOtp);
router.post('/auth/verify-otp', authLimiter, verifyOtp);
// Gắn số điện thoại đã xác thực OTP cho tài khoản đăng nhập qua Telegram/Google
router.post('/auth/verify-phone', requireAuth, authLimiter, verifyPhoneForAccount);
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
router.post('/trips', requireAuth, postTripLimiter, createTrip);
router.put('/trips/:id', requireAuth, requireTripOwnership, updateTripHandler);
router.delete('/trips/:id', requireAuth, requireTripOwnership, deleteTripHandler);
router.patch('/trips/:id/status', requireAuth, requireTripOwnership, updateStatus);
router.post('/trips/:id/republish', requireAuth, requireTripOwnership, postTripLimiter, republishTripHandler);

// --- Smart Matching Radar & Social Suggestions ---
router.post('/connections/driver-preview', optionalAuth, postTripLimiter, previewDriverConnectionsHandler);
router.get('/matches', optionalAuth, getMatches);
router.get('/matches/social-suggestions', optionalAuth, getSocialSuggestions);

// --- Autonomous Zero-Search Matching Engine (Level 3 - MIT & Nobel) ---
router.get('/intents', optionalAuth, getMovementIntentsHandler);
router.post('/intents', requireAuth, createMovementIntentHandler);
router.post('/intents/match', requireAuth, runBatchMatchHandler);
router.get('/intents/epochs', optionalAuth, getMatchingEpochsHandler);
// Sửa / huỷ lịch trình: bốn thao tác "3 giây" của Taplo Chủ xe nay có hiệu lực thật
router.patch('/intents/:id', requireAuth, updateMovementIntentHandler);
router.delete('/intents/:id', requireAuth, cancelMovementIntentHandler);
router.post('/intents/:id/checkpoint', requireAuth, confirmIntentCheckpointHandler);

// --- Sàn Giao Dịch Ghế Trống (Seat Exchange - LOB, CDA 24/7 Spot Market & Dynamic Sliding TTL) ---
// Đặt lệnh: chống spam bằng postTripLimiter; optionalAuth cho phép khách vãng lai
// đặt lệnh, nhưng khi ĐÃ đăng nhập thì SĐT trong token luôn thắng SĐT gửi từ body.
router.post('/seat-exchange/order', requireAuth, postTripLimiter, placeOrderHandler);
// Sổ lệnh công khai: mọi lệnh trả ra đều đi qua lớp chắn PII (Nghị định 13/2023).
router.get('/seat-exchange/order-book', optionalAuth, getOrderBookHandler);
// Lịch sử lệnh cá nhân: BẮT BUỘC đăng nhập (chống dò quét bằng số điện thoại).
router.get('/seat-exchange/my-orders', requireAuth, getMyOrdersHandler);
// Quét TTL là tác vụ vận hành nội bộ: chỉ Quản trị viên (chống DoS xoá sạch sổ lệnh).
router.post('/seat-exchange/expire-ttl', requireAdmin, expireSlidingTTLHandler);

// --- Bookings / Connections (2-Phase Commit & In-app Chat) ---
router.get('/bookings', requireAuth, listBookings);
// Giữ chỗ BẮT BUỘC đăng nhập: booking gắn với một con người thật (SĐT đã xác thực),
// và chỉ khi đó mới có cơ sở để mở khoá thông tin liên hệ hai chiều.
router.post('/bookings', requireAuth, createBooking);
router.get('/bookings/:id/public-summary', optionalAuth, getBookingPublicSummary);
router.post('/bookings/:id/driver-confirm', requireAuth, driverConfirmBooking);
// Chốt T-40/T-30: chủ xe bấm "Tôi đang đi", và khách tra cứu Chế độ Cứu hộ
router.post('/bookings/:id/driver-ready', requireAuth, driverReadyHandler);
router.get('/bookings/:id/rescue-status', requireAuth, rescueStatusHandler);
router.post('/bookings/:id/messages', requireAuth, addBookingMessageHandler);
router.post('/bookings/:id/pre-confirm', requireAuth, preConfirmBookingHandler);
router.post('/bookings/:id/final-confirm', requireAuth, finalConfirmBookingHandler);
router.post('/bookings/:id/delay', requireAuth, requireBookingParty, reportDelay);
router.post('/bookings/:id/cancel', requireAuth, requireBookingParty, cancelBooking);
router.post('/bookings/:id/complete', requireAuth, requireBookingParty, completeBooking);
router.post('/bookings/:id/review', requireAuth, requireBookingParty, submitReview);

// --- Báo cáo vi phạm an toàn (chỉ hai bên trong chuyến mới được tố giác) ---
router.post('/bookings/:id/report-vehicle-mismatch', requireAuth, requireBookingParty, reportVehicleMismatchHandler);
router.post('/bookings/:id/report-unreachable-phone', requireAuth, requireBookingParty, reportUnreachablePhoneHandler);
// Gỡ khoá tài khoản là THAO TÁC CHẾ TÀI, chỉ Quản trị viên được làm.
// Trước đây dùng optionalAuth: bất kỳ ai biết mã booking đều gọi ẩn danh để gỡ
// ban cho CẢ HAI bên, vô hiệu hoá toàn bộ hệ thống kỷ luật (kể cả Grim Trigger).
router.post('/bookings/:id/reset-ban', requireAdmin, resetBanHandler);
router.post('/bookings/:id/dispute', requireAuth, disputeBookingHandler);

router.get('/escrows', requireAuth, listBookings);
router.post('/escrows', requireAuth, createBooking);
router.get('/escrows/:id/public-summary', optionalAuth, getBookingPublicSummary);
router.post('/escrows/:id/driver-confirm', requireAuth, driverConfirmBooking);
router.post('/escrows/:id/messages', requireAuth, addBookingMessageHandler);
router.post('/escrows/:id/pre-confirm', requireAuth, preConfirmBookingHandler);
router.post('/escrows/:id/final-confirm', requireAuth, finalConfirmBookingHandler);
router.post('/escrows/:id/delay', requireAuth, requireBookingParty, reportDelay);
router.post('/escrows/:id/cancel', requireAuth, requireBookingParty, cancelBooking);
router.post('/escrows/:id/complete', requireAuth, requireBookingParty, completeBooking);
router.post('/escrows/:id/review', requireAuth, requireBookingParty, submitReview);
router.post('/escrows/:id/report-vehicle-mismatch', requireAuth, requireBookingParty, reportVehicleMismatchHandler);
router.post('/escrows/:id/report-unreachable-phone', requireAuth, requireBookingParty, reportUnreachablePhoneHandler);
router.post('/escrows/:id/reset-ban', requireAdmin, resetBanHandler);
router.post('/escrows/:id/dispute', requireAuth, disputeBookingHandler);

// --- Kênh Hỗ Trợ & Kháng Nghị Trực Tiếp Platform CSKH CarMate ---
router.get('/support/messages', optionalAuth, getSupportMessagesHandler);
router.post('/support/messages', optionalAuth, sendSupportMessageHandler);

// --- Station Curbside Queue & Cockpit Mode Live Dispatch ---
router.post('/station/riders/:intentId/accept', requireAuth, riderAcceptOfferHandler);
router.post('/station/riders/:intentId/cancel', requireAuth, riderCancelIntentHandler);
router.post('/cockpit/dropoff', requireAuth, cockpitDropoffHandler);
router.post('/station/:hubId/checkin', requireAuth, riderCheckInHandler);
router.get('/station/:hubId/status', getStationQueueHandler);
router.get('/station/rider/radar-risk', requireAuth, riderGetRadarRiskHandler);
router.post('/station/rider/report-culture-violation', requireAuth, riderReportCultureViolationHandler);
router.post('/station/rider/cancel-grace', requireAuth, riderCancelGraceHandler);
router.post('/station/rider/on-the-way', requireAuth, riderOnTheWayHandler);
router.get('/station/rider/:intentId', requireAuth, getRiderPassHandler);
router.post('/cockpit/telemetry', requireAuth, cockpitTelemetryHandler);
router.post('/cockpit/accept-offer', requireAuth, cockpitAcceptOfferHandler);
router.post('/cockpit/reject-offer', requireAuth, cockpitRejectOfferHandler);
router.post('/cockpit/verify-pin', requireAuth, cockpitVerifyPinHandler);
router.post('/cockpit/register-vehicle', requireAuth, cockpitRegisterVehicleHandler);
router.get('/cockpit/vehicle-status', requireAuth, cockpitVehicleStatusHandler);
router.post('/cockpit/approve-vehicle', requireAdmin, cockpitApproveVehicleHandler);
router.post('/cockpit/report-incident', requireAuth, cockpitReportIncidentHandler);
router.get('/cockpit/incidents', requireAuth, cockpitGetIncidentsHandler);
router.delete('/station/reset', requireAdmin, resetStationDataHandler);

// --- Station Requests Pool (Gom đề xuất mở trạm ảo mới - Hard Whitelist & Zero Roadside Stops) ---
router.post('/station-requests', optionalAuth, createStationRequestHandler);
router.get('/station-requests', optionalAuth, listStationRequestsHandler);
router.patch('/admin/station-requests/:id', requireAdmin, updateStationRequestStatusHandler);

// --- Ma Trận Khe Thời Gian (Time-Slotted Corridor) ---
router.get('/corridor/time-slots', timeSlotMatrixHandler);
router.get('/corridor/timeline', corridorTimelineHandler);

// --- Danh Bạ Nhà Xe Tuyến Cố Định (lưới đỡ khi chưa có chuyến CarMate) ---
router.get('/transit-directory', getTransitDirectoryHandler);

// --- Chỉ Số Nhiên Liệu Hàng Ngày (Daily Petrolimex Fuel Index) ---
router.get('/fuel-price', getPublicFuelPriceHandler);
router.get('/tariff-params', getPublicTariffParamsHandler);

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
router.get('/admin/transit-directory', requireAdmin, getAdminTransitDirectoryHandler);
router.put('/admin/transit-directory', requireAdmin, updateAdminTransitDirectoryHandler);
router.post('/admin/scheduler-run', requireAdmin, schedulerRunTickHandler);
router.get('/admin/trips', requireAdmin, listAdminTrips);
router.patch('/admin/trips/:id/toggle-hide', requireAdmin, toggleHideTripHandler);
router.delete('/admin/trips/:id', requireAdmin, deleteTripAdminHandler);
router.patch('/admin/trips/:id/convert-car-category', requireAdmin, convertTripCarCategoryHandler);
router.get('/admin/users', requireAdmin, listAdminUsers);
// Tạo hồ sơ Chủ xe (và chuyến đầu tiên) thay cho bác tài trong giai đoạn đi mời.
router.post('/admin/drivers', requireAdmin, (_req, res) => res.status(410).json({ success: false, error: 'Dùng Hồ sơ nhà xe để nhập thông tin có nguồn và nhận quyền quản lý. Luồng tạo tài khoản hộ đã ngừng.' }));
router.patch('/admin/users/:id', requireAdmin, updateUserStatusHandler);
router.patch('/admin/users/:id/status', requireAdmin, updateUserStatusHandler);
router.get('/admin/reports', requireAdmin, getAdminReports);
router.patch('/admin/bookings/:id/resolve-mismatch', requireAdmin, resolveMismatchReportHandler);
router.get('/admin/ai-intelligence', requireAdmin, getAdminAiIntelligence);
router.get('/admin/trust-rules', requireAdmin, getAdminTrustRulesHandler);
router.put('/admin/trust-rules', requireAdmin, updateAdminTrustRulesHandler);
router.post('/admin/trust-rules/reset', requireAdmin, resetAdminTrustRulesHandler);
router.get('/admin/fuel-price', requireAdmin, getAdminFuelPriceHandler);
router.put('/admin/fuel-price', requireAdmin, updateAdminFuelPriceHandler);
router.post('/admin/fuel-price/reset', requireAdmin, resetAdminFuelPriceHandler);

// --- Công thức định giá: chỉ Quản trị viên được nâng tham số, áp dụng ngay toàn sàn ---
router.get('/admin/tariff-params', requireAdmin, getAdminTariffParamsHandler);
router.post('/admin/tariff-params/preview', requireAdmin, previewAdminTariffParamsHandler);
router.put('/admin/tariff-params', requireAdmin, updateAdminTariffParamsHandler);
router.post('/admin/tariff-params/reset', requireAdmin, resetAdminTariffParamsHandler);
router.get('/admin/deletion-requests', requireAdmin, listDeletionRequestsHandler);
router.post('/admin/deletion-requests/:id/process', requireAdmin, processDeletionRequestHandler);
router.delete('/admin/users/:id', requireAdmin, deleteUserAdminHandler);
router.delete('/admin/ai-trajectories', requireAdmin, clearAdminAiTrajectories);
router.delete('/admin/test-data', requireAdmin, clearAdminTestData);
router.delete('/admin/bookings', requireAdmin, clearAdminBookings);

export default router;
