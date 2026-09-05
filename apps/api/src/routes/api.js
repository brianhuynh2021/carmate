import { Router } from 'express';
import { listTrips, getTrip, createTrip, updateStatus, updateTripHandler, deleteTripHandler } from '../controllers/tripController.js';
import { getMatches } from '../controllers/matchController.js';
import { listBookings, createBooking, reportDelay, cancelBooking, completeBooking, submitReview } from '../controllers/bookingController.js';
import { getHealth, getBenchmarks, getStats, getTrustProfile } from '../controllers/miscController.js';
import { requestOtp, verifyOtp, zaloLogin, getMe } from '../controllers/authController.js';
import { requireAuth, optionalAuth, requireTripOwnership } from '../middlewares/authMiddleware.js';
import {
  adminAuth,
  getMetrics,
  listAdminTrips,
  toggleHideTripHandler,
  deleteTripAdminHandler,
  listAdminUsers,
  updateUserStatusHandler,
  getAdminReports,
  requireAdmin
} from '../controllers/adminController.js';
import { authLimiter, postTripLimiter } from '../middleware/security.js';

const router = Router();

import { suggestLocationsHandler } from '../controllers/locationController.js';
import { agentChatHandler } from '../controllers/agentController.js';

// --- Agentic AI Concierge & Dispatcher (Stanford Inner Loop & Tools) ---
router.post('/agent/chat', optionalAuth, agentChatHandler);

// --- Auth & Identity (Zero-Cost / Zalo & Phone OTP với Auth Limiter & JWT) ---
router.post('/auth/request-otp', authLimiter, requestOtp);
router.post('/auth/verify-otp', authLimiter, verifyOtp);
router.post('/auth/zalo-login', zaloLogin);
router.get('/auth/me', requireAuth, getMe);

// --- Health & Meta ---
router.get('/health', getHealth);
router.get('/stats', getStats);
router.get('/benchmarks', getBenchmarks);
router.get('/trust', getTrustProfile);
router.get('/trust/:memberId', getTrustProfile);
router.get('/locations/suggest', suggestLocationsHandler);

// --- Trips (với Post Limiter chống spam và bảo vệ quyền sở hữu Anti-IDOR) ---
router.get('/trips', listTrips);
router.get('/trips/:id', getTrip);
router.post('/trips', postTripLimiter, optionalAuth, createTrip);
router.put('/trips/:id', optionalAuth, requireTripOwnership, updateTripHandler);
router.delete('/trips/:id', optionalAuth, requireTripOwnership, deleteTripHandler);
router.patch('/trips/:id/status', optionalAuth, requireTripOwnership, updateStatus);

// --- Smart Matching Radar ---
router.get('/matches', getMatches);

// --- Bookings / Zalo Connections (Aliases for /escrows) ---
router.get('/bookings', listBookings);
router.post('/bookings', createBooking);
router.post('/bookings/:id/delay', reportDelay);
router.post('/bookings/:id/cancel', cancelBooking);
router.post('/bookings/:id/complete', completeBooking);
router.post('/bookings/:id/review', submitReview);

router.get('/escrows', listBookings);
router.post('/escrows', createBooking);
router.post('/escrows/:id/delay', reportDelay);
router.post('/escrows/:id/cancel', cancelBooking);
router.post('/escrows/:id/complete', completeBooking);
router.post('/escrows/:id/review', submitReview);

// --- Admin Management Portal Engine ---
router.post('/admin/auth', adminAuth);
router.get('/admin/metrics', requireAdmin, getMetrics);
router.get('/admin/trips', requireAdmin, listAdminTrips);
router.patch('/admin/trips/:id/toggle-hide', requireAdmin, toggleHideTripHandler);
router.delete('/admin/trips/:id', requireAdmin, deleteTripAdminHandler);
router.get('/admin/users', requireAdmin, listAdminUsers);
router.patch('/admin/users/:id', requireAdmin, updateUserStatusHandler);
router.patch('/admin/users/:id/status', requireAdmin, updateUserStatusHandler);
router.get('/admin/reports', requireAdmin, getAdminReports);

export default router;
