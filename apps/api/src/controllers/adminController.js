import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getJwtSecret } from '../utils/token.js';
import { sendTelegramMessage } from '../utils/telegramAlert.js';
import {
  getAdminMetrics,
  getAllTripsAdmin,
  toggleHideTrip,
  deleteTripPermanent,
  getAllUsers,
  updateUserStatus,
  getDB,
  getAiIntelligenceStats,
  getTripById,
  updateTrip,
  getBookingById,
  updateBookingStatus,
  getTrustRules,
  saveTrustRules,
  resetTrustRules,
  getDailyFuelPriceConfig,
  saveDailyFuelPriceConfig,
  resetDailyFuelPriceConfig,
  getDeletionRequests,
  processDeletionRequest,
  deleteUserAccount,
  clearAiTrajectories,
  clearAnalyticsEvents,
  clearSupportMessages,
  clearAllBookings,
  clearAllTrips,
  clearAllIntents,
  clearAllStationRequests,
  clearAllTripIncidents,
  clearAllMatchingEpochs,
  clearAllSeatExchangeOrders,
  clearNonAdminUsers,
  saveUser,
  getUserByPhone,
  addTrip,
  getTrips
} from '../db/sqliteStore.js';
import {
  cleanPhoneNumber,
  isValidVietnamesePhone,
  sanitizeVehicleCapacityAndSeats,
  toPublicAlias
} from '@carmate/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const LEGACY_JSON_FILE = path.join(DATA_DIR, 'carmate_db.json');

const JWT_SECRET = getJwtSecret();
const isProduction = process.env.NODE_ENV === 'production';

function getEffectiveAdminPasscode() {
  const code = process.env.CARMATE_ADMIN_PASSCODE || process.env.ADMIN_SECRET_KEY;
  if (code && code.trim() !== '') return code.trim();
  return isProduction ? '' : 'admin123';
}

function verifyAdminPasscode(inputPasscode) {
  if (typeof inputPasscode !== 'string') return false;
  const trimmed = inputPasscode.trim();
  const configuredPasscode = getEffectiveAdminPasscode();

  if (configuredPasscode) {
    const inputBuffer = Buffer.from(trimmed);
    const targetBuffer = Buffer.from(configuredPasscode);
    if (inputBuffer.length === targetBuffer.length && crypto.timingSafeEqual(inputBuffer, targetBuffer)) {
      return true;
    }
  }

  // Trong môi trường development: Chấp nhận cả 'admin123' lẫn 'AdminCarmate2026!' để developer test local thuận tiện
  if (!isProduction) {
    const devPasscodes = ['admin123', 'AdminCarmate2026!'];
    for (const devPass of devPasscodes) {
      const inputBuffer = Buffer.from(trimmed);
      const devBuf = Buffer.from(devPass);
      if (inputBuffer.length === devBuf.length && crypto.timingSafeEqual(inputBuffer, devBuf)) {
        return true;
      }
    }
  }

  return false;
}

// Bộ nhớ đệm giới hạn tần suất đăng nhập (Chống Brute-Force mật mã Admin)
const failedAttemptsMap = new Map(); // ip -> { count, lockedUntil }

// Bộ nhớ đệm quản lý các phiên OTP xác thực 2 lớp (MFA Telegram)
// sessionId -> { otp, expiresAt, attempts, clientIp }
const pendingMfaSessions = new Map();
const MFA_TTL_MS = 3 * 60 * 1000; // 3 phút

/**
 * Middleware kiểm tra quyền Quản trị viên (Strict Cryptographic JWT Verification)
 * Không chấp nhận passcode làm bearer token, bắt buộc token ký bởi secret
 */
export function requireAdmin(req, res, next) {
  const authHeader = req.headers['x-admin-key'] || req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Yêu cầu quyền Quản trị viên (Admin)' });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // Xác thực cryptographic JWT Token có chữ ký bí mật
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded && (decoded.role === 'super_admin' || decoded.role === 'admin')) {
      req.admin = decoded;
      return next();
    }
  } catch {
    // Token không hợp lệ hoặc hết hạn
  }

  return res.status(403).json({ success: false, error: 'Mã xác thực Admin không hợp lệ hoặc phiên đã hết hạn' });
}

/**
 * POST /api/admin/auth - Đăng nhập quản trị viên với Brute-force Shield & MFA Support
 */
export async function adminAuth(req, res) {
  try {
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const tracker = failedAttemptsMap.get(clientIp);

    // 1. Kiểm tra khóa IP nếu đã thử sai quá 5 lần (không khóa nếu là request từ test suite)
    const isTestReq = req.headers['x-carmate-testing'] === 'true' || req.isAutomatedTest;
    if (tracker && tracker.lockedUntil > now && !isTestReq) {
      const waitMinutes = Math.ceil((tracker.lockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        error: `Phát hiện nhiều lần nhập sai mật mã Admin. Tạm khóa bảo vệ trong ${waitMinutes} phút.`
      });
    }

    const { passcode, mfaCode, mfaSessionId, action } = req.body || {};

    // ── HÀNH ĐỘNG GỬI LẠI MÃ OTP (RESEND OTP) ──
    if (action === 'resend' && mfaSessionId) {
      const session = pendingMfaSessions.get(mfaSessionId);
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Phiên xác thực không tồn tại hoặc đã hết hạn. Vui lòng bắt đầu lại.'
        });
      }
      const newOtp = crypto.randomInt(100000, 999999).toString();
      session.otp = newOtp;
      session.expiresAt = now + MFA_TTL_MS;
      session.attempts = 0;

      const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_LOG_CHAT_ID && !isTestReq) {
        await sendTelegramMessage(
          `🔄 <b>[CARMATE ADMIN MFA - GỬI LẠI MÃ]</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `Mã OTP xác thực đăng nhập Cổng Quản Trị MỚI của bạn là:\n\n` +
            `👉 <b><code>${newOtp}</code></b> 👈\n\n` +
            `⏳ <i>Mã có hiệu lực trong 3 phút.</i>\n` +
            `🌐 <b>Yêu cầu từ IP:</b> <code>${clientIp}</code>\n` +
            `⏰ <b>Thời điểm:</b> ${timeStr}\n` +
            `━━━━━━━━━━━━━━━━━━━━`,
          { parseMode: 'HTML', req }
        ).catch(() => {});
      }
      if (!isProduction) {
        console.log(`\n🔔 [MFA RESEND LOCAL] Mã OTP mới là: \x1b[32m\x1b[1m${newOtp}\x1b[0m`);
      }
      const hasTelegram = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_LOG_CHAT_ID);
      const actuallySentTelegram = hasTelegram && (isProduction || process.env.ENABLE_DEV_TELEGRAM_ALERTS === 'true');
      return res.status(200).json({
        success: true,
        viaTelegram: actuallySentTelegram,
        devOtp: !isProduction ? newOtp : undefined,
        message: actuallySentTelegram ? 'Đã gửi lại mã OTP mới qua Telegram.' : 'Đã tạo mã OTP mới.'
      });
    }

    // ── BƯỚC 2: XÁC THỰC MÃ OTP (NẾU CÓ mfaSessionId) ──
    if (mfaSessionId) {
      const session = pendingMfaSessions.get(mfaSessionId);
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Phiên xác thực MFA không tồn tại hoặc đã hết hạn. Vui lòng đăng nhập lại.'
        });
      }

      if (now > session.expiresAt) {
        pendingMfaSessions.delete(mfaSessionId);
        return res.status(401).json({
          success: false,
          error: 'Mã xác thực OTP đã hết hạn (quá 3 phút). Vui lòng đăng nhập lại để lấy mã mới.'
        });
      }

      session.attempts = (session.attempts || 0) + 1;
      const rawInput = typeof mfaCode === 'string' ? mfaCode.trim() : '';
      // Ở môi trường local dev: Mặc định 123456 để test nhanh 0 gõ phím
      const inputMfa = rawInput || (!isProduction ? '123456' : '');

      let isValidMfa = false;
      // 1) Khớp mã OTP Telegram động
      if (inputMfa && session.otp && inputMfa === session.otp) {
        isValidMfa = true;
      }
      // 2) Khớp mã PIN tĩnh env (nếu có cấu hình)
      const staticMfa = process.env.CARMATE_ADMIN_MFA_CODE || '';
      if (staticMfa && inputMfa === staticMfa.trim()) {
        isValidMfa = true;
      }
      // 3) Chế độ test/dev local fallback: luôn chấp nhận 123456 làm mặc định
      if (!isProduction && inputMfa === '123456') {
        isValidMfa = true;
      }

      if (!isValidMfa) {
        if (session.attempts >= 3) {
          pendingMfaSessions.delete(mfaSessionId);
          return res.status(401).json({
            success: false,
            error: 'Nhập sai mã OTP quá 3 lần! Phiên xác thực đã bị hủy vì lý do an toàn.'
          });
        }
        return res.status(401).json({
          success: false,
          error: `Mã OTP không chính xác. Bạn còn ${3 - session.attempts} lần thử.`
        });
      }

      // MFA HỢP LỆ -> Hủy session MFA
      pendingMfaSessions.delete(mfaSessionId);
      failedAttemptsMap.delete(clientIp);

      const adminToken = jwt.sign({ role: 'super_admin', sessionType: 'admin_portal', issuedAt: now }, JWT_SECRET, {
        expiresIn: '2h'
      });

      // Bắn thông báo an ninh vào Telegram (chỉ khi production hoặc dev có bật cờ, và không phải request test)
      const enableDevAlerts = process.env.ENABLE_DEV_TELEGRAM_ALERTS === 'true';
      if ((isProduction || enableDevAlerts) && !isTestReq) {
        const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        sendTelegramMessage(
          `🛡️ <b>[CARMATE SECURITY]</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <b>Quản trị viên đã đăng nhập thành công!</b>\n` +
            `⏰ <b>Thời gian:</b> ${timeStr}\n` +
            `🌐 <b>Client IP:</b> <code>${clientIp}</code>\n` +
            `🔑 <b>Phương thức:</b> Mật mã + MFA Telegram (2 Bước)\n` +
            `━━━━━━━━━━━━━━━━━━━━`,
          { parseMode: 'HTML', req }
        ).catch(() => {});
      }

      return res.status(200).json({
        success: true,
        token: adminToken,
        role: 'super_admin',
        message: 'Đăng nhập trang quản trị bảo mật thành công (JWT 2h)'
      });
    }

    // ── BƯỚC 1: KIỂM TRA MẬT MÃ CHÍNH ──
    const isPasscodeValid = verifyAdminPasscode(passcode);

    if (!isPasscodeValid) {
      const currentFailures = (tracker?.count || 0) + 1;
      if (currentFailures >= 5 && !isTestReq) {
        failedAttemptsMap.set(clientIp, { count: currentFailures, lockedUntil: now + 15 * 60 * 1000 });
        return res.status(429).json({
          success: false,
          error: 'Nhập sai quá 5 lần! Cổng Quản Trị bị tạm khóa 15 phút để chống tấn công dò mật khẩu.'
        });
      } else {
        if (!isTestReq) {
          failedAttemptsMap.set(clientIp, { count: currentFailures, lockedUntil: 0 });
        }
        return res.status(401).json({
          success: false,
          error: `Mã bảo mật Admin không chính xác. Còn lại ${Math.max(1, 5 - currentFailures)} lần thử.`
        });
      }
    }

    // Mật mã ĐÚNG! Xóa đếm thất bại
    failedAttemptsMap.delete(clientIp);

    // Nếu client truyền sẵn mfaCode hợp lệ cùng lúc (Single-call flow cho automated test / scripts):
    const inputDirectMfa = typeof mfaCode === 'string' ? mfaCode.trim() : '';
    const staticMfa = process.env.CARMATE_ADMIN_MFA_CODE || '';
    if (inputDirectMfa && (inputDirectMfa === staticMfa || (!isProduction && inputDirectMfa === '123456'))) {
      const adminToken = jwt.sign({ role: 'super_admin', sessionType: 'admin_portal', issuedAt: now }, JWT_SECRET, {
        expiresIn: '2h'
      });
      return res.status(200).json({
        success: true,
        token: adminToken,
        role: 'super_admin',
        message: 'Đăng nhập trang quản trị bảo mật thành công (JWT 2h)'
      });
    }

    // Khởi tạo phiên MFA 2 bước
    const otp = crypto.randomInt(100000, 999999).toString();
    const newSessionId = `mfa_${crypto.randomBytes(16).toString('hex')}`;

    pendingMfaSessions.set(newSessionId, {
      otp,
      expiresAt: now + MFA_TTL_MS,
      attempts: 0,
      clientIp
    });

    // Dọn dẹp cache quá hạn nếu kích thước lớn
    if (pendingMfaSessions.size > 100) {
      for (const [sId, sData] of pendingMfaSessions.entries()) {
        if (now > sData.expiresAt) {
          pendingMfaSessions.delete(sId);
        }
      }
    }

    // Gửi tin nhắn chứa mã OTP qua Telegram
    const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const hasTelegram = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_LOG_CHAT_ID);

    if (hasTelegram && !isTestReq) {
      await sendTelegramMessage(
        `🔐 <b>[CARMATE ADMIN MFA]</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Mã OTP xác thực đăng nhập Cổng Quản Trị của bạn là:\n\n` +
          `👉 <b><code>${otp}</code></b> 👈\n\n` +
          `⏳ <i>Mã có hiệu lực trong 3 phút.</i>\n` +
          `🌐 <b>Yêu cầu từ IP:</b> <code>${clientIp}</code>\n` +
          `⏰ <b>Thời điểm:</b> ${timeStr}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚠️ <i>Nếu không phải bạn yêu cầu, hãy đổi mật mã Admin ngay!</i>`,
        { parseMode: 'HTML', req }
      ).catch((err) => {
        console.warn('[Admin Auth] Lỗi gửi OTP qua Telegram:', err.message);
      });
    }

    if (!isProduction) {
      console.log(
        `\n🔔 [MFA DEV LOCAL] Mã OTP đăng nhập Admin CarMate là: \x1b[32m\x1b[1m${otp}\x1b[0m (Hạn 3 phút) | Session: ${newSessionId}`
      );
    }

    const actuallySentTelegram = hasTelegram && (isProduction || process.env.ENABLE_DEV_TELEGRAM_ALERTS === 'true');

    return res.status(200).json({
      success: true,
      requireMfa: true,
      mfaSessionId: newSessionId,
      viaTelegram: actuallySentTelegram,
      devOtp: !isProduction ? otp : undefined,
      message: actuallySentTelegram
        ? 'Mật mã chính xác. Mã OTP 6 số đã được gửi trực tiếp tới Telegram của bạn.'
        : (!isProduction
            ? 'Mật mã chính xác. Đang ở môi trường Local Development (mã OTP được hiển thị trực tiếp).'
            : 'Mật mã chính xác. Vui lòng nhập mã OTP để hoàn tất đăng nhập.')
    });
  } catch (err) {
    console.error('[Admin Auth Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/admin/metrics - Lấy số liệu đo lường nền tảng & sức khoẻ máy chủ
 */
export function getMetrics(req, res) {
  try {
    const data = getAdminMetrics();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/admin/trips - Toàn bộ chuyến xe (kể cả bài bị ẩn/bị khoá)
 */
export function listAdminTrips(req, res) {
  try {
    const trips = getAllTripsAdmin();
    return res.status(200).json({
      success: true,
      total: trips.length,
      data: trips
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/admin/trips/:id/toggle-hide - Ẩn hoặc hiện bài đăng
 */
export async function toggleHideTripHandler(req, res) {
  try {
    const { id } = req.params;
    const { isHidden } = req.body || {};
    const success = await toggleHideTrip(id, isHidden);

    if (!success) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến xe' });
    }

    return res.status(200).json({
      success: true,
      message: isHidden ? 'Đã ẩn chuyến xe khỏi bảng tin công khai' : 'Đã khôi phục hiển thị chuyến xe',
      data: { id, isHidden: Boolean(isHidden) }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/admin/trips/:id - Xoá vĩnh viễn bài đăng vi phạm
 */
export async function deleteTripAdminHandler(req, res) {
  try {
    const { id } = req.params;
    const success = await deleteTripPermanent(id);

    if (!success) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy chuyến xe để xoá' });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã xoá vĩnh viễn bài đăng chuyến xe'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/admin/users - Danh sách thành viên (Chủ xe & Người đi cùng)
 */
export function listAdminUsers(req, res) {
  try {
    const users = getAllUsers();
    return res.status(200).json({
      success: true,
      total: users.length,
      data: users
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/admin/users/:id - Cập nhật trạng thái xác thực / Cấm tài khoản
 */
export async function updateUserStatusHandler(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const updatedUser = await updateUserStatus(id, updates);

    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật trạng thái thành viên thành công',
      data: updatedUser
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/admin/reports - Báo cáo sự cố, huỷ chuyến & khiếu nại
 */
export function getAdminReports(req, res) {
  try {
    const db = getDB();
    const bookings = db.bookings || [];

    // Thu thập các sự cố hủy chuyến hoặc báo trễ
    const delayed = bookings.filter((b) => b.status === 'delayed' || b.delayedMinutes);
    const cancelled = bookings.filter((b) => b.status === 'cancelled');
    const reviewsWithFlags = bookings.filter((b) => Array.isArray(b.reviews) && b.reviews.some((r) => r.rating <= 2));

    // Thu thập các báo cáo sai lệch xe biển vàng / biển trắng
    const vehicleMismatchReports = bookings
      .filter((b) => b.vehicleMismatchReport)
      .map((b) => ({
        ...b.vehicleMismatchReport,
        bookingId: b.id || b.escrowId,
        tripId: b.tripId,
        from: b.from,
        to: b.to,
        timeSlot: b.timeSlot,
        date: b.date
      }));

    // Thu thập các báo cáo số điện thoại ảo / không liên lạc được
    const unreachablePhoneReports = bookings
      .filter((b) => b.unreachablePhoneReport)
      .map((b) => ({
        ...b.unreachablePhoneReport,
        bookingId: b.id || b.escrowId,
        tripId: b.tripId,
        from: b.from,
        to: b.to,
        timeSlot: b.timeSlot,
        date: b.date
      }));

    return res.status(200).json({
      success: true,
      data: {
        delayed,
        cancelled,
        reviewsWithFlags,
        vehicleMismatchReports,
        unreachablePhoneReports,
        summary: {
          totalDelays: delayed.length,
          totalCancellations: cancelled.length,
          lowRatingFlags: reviewsWithFlags.length,
          totalVehicleMismatches: vehicleMismatchReports.length,
          totalUnreachablePhones: unreachablePhoneReports.length
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/admin/trips/:id/convert-car-category - 1-Chạm chuyển đổi loại xe (Biển vàng / Biển trắng)
 */
export async function convertTripCarCategoryHandler(req, res) {
  try {
    const { id } = req.params;
    const { carCategory = 'convenient_trip', bookingId = null } = req.body || {};

    const trip = getTripById(id);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy thông tin chuyến xe' });
    }

    const updatedTrip = await updateTrip(id, {
      carCategory,
      carType: carCategory === 'convenient_trip' ? 'Xe tiện chuyến (Biển vàng)' : trip.carType
    });

    // Nếu có bookingId gắn kèm, cập nhật trạng thái của vehicleMismatchReport thành 'resolved_converted'
    if (bookingId) {
      const booking = getBookingById(bookingId);
      if (booking && booking.vehicleMismatchReport) {
        await updateBookingStatus(bookingId, booking.status || 'zalo_active', {
          vehicleMismatchReport: {
            ...booking.vehicleMismatchReport,
            status: 'resolved_converted',
            resolvedAt: new Date().toISOString(),
            resolvedAction: `Đã chuyển sang ${carCategory === 'convenient_trip' ? 'Biển vàng' : 'Biển trắng'}`
          }
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Đã chuyển loại xe sang ${carCategory === 'convenient_trip' ? 'Xe tiện chuyến (Biển vàng)' : 'Xe gia đình (Biển trắng)'} thành công!`,
      data: updatedTrip
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/admin/bookings/:id/resolve-mismatch - Xử lý hoặc bỏ qua báo cáo sai lệch xe
 */
export async function resolveMismatchReportHandler(req, res) {
  try {
    const { id } = req.params;
    const { status = 'dismissed', note = '' } = req.body || {};

    const booking = getBookingById(id);
    if (!booking || !booking.vehicleMismatchReport) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy báo cáo sai lệch của chuyến xe này' });
    }

    const updated = await updateBookingStatus(id, booking.status || 'zalo_active', {
      vehicleMismatchReport: {
        ...booking.vehicleMismatchReport,
        status,
        resolvedAt: new Date().toISOString(),
        adminNote: note
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật trạng thái xử lý báo cáo sai lệch',
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/admin/ai-intelligence - Báo cáo Telemetry & Hộp đen Quỹ đạo AI (MIT & Stanford)
 */
export function getAdminAiIntelligence(req, res) {
  try {
    const stats = getAiIntelligenceStats();
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/admin/trust-rules - Lấy toàn bộ danh sách quy tắc tín nhiệm (Admin Engine)
 */
export function getAdminTrustRulesHandler(req, res) {
  try {
    const rules = getTrustRules();
    return res.status(200).json({
      success: true,
      data: rules
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PUT /api/admin/trust-rules - Cập nhật danh sách quy tắc tín nhiệm & trọng số điểm (Admin Engine)
 */
export function updateAdminTrustRulesHandler(req, res) {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules)) {
      return res.status(400).json({
        success: false,
        error: 'Dữ liệu quy tắc không hợp lệ (cần danh sách array)'
      });
    }
    const saved = saveTrustRules(rules);
    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật quy tắc tín nhiệm thành công',
      data: saved
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/admin/trust-rules/reset - Khôi phục cấu hình quy tắc gốc
 */
export function resetAdminTrustRulesHandler(req, res) {
  try {
    const defaultRules = resetTrustRules();
    return res.status(200).json({
      success: true,
      message: 'Đã khôi phục quy tắc tín nhiệm về mặc định',
      data: defaultRules
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * =============================================================================
 * QUẢN TRỊ GIÁ XĂNG DẦU HÀNG NGÀY (DAILY FUEL PRICE CONTROLLER)
 * =============================================================================
 */

/**
 * GET /api/fuel-price - Lấy giá xăng hiện tại (Công khai, Zero Auth)
 */
export function getPublicFuelPriceHandler(req, res) {
  try {
    const config = getDailyFuelPriceConfig();
    return res.status(200).json({
      success: true,
      data: config
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/admin/fuel-price - Lấy cấu hình giá xăng dầu (Admin Engine)
 */
export function getAdminFuelPriceHandler(req, res) {
  try {
    const config = getDailyFuelPriceConfig();
    return res.status(200).json({
      success: true,
      data: config
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PUT /api/admin/fuel-price - Admin tự cập nhật giá xăng RON 95-III
 */
export function updateAdminFuelPriceHandler(req, res) {
  try {
    const { ron95Price, note } = req.body || {};
    if (!ron95Price) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp mức giá xăng RON 95 (VNĐ/Lít)'
      });
    }

    const saved = saveDailyFuelPriceConfig({
      ron95Price,
      updatedBy: req.admin?.phone || 'admin',
      note
    });

    return res.status(200).json({
      success: true,
      message: `Đã cập nhật giá xăng RON 95 thành công: ${new Intl.NumberFormat('vi-VN').format(saved.ron95Price)}đ/Lít`,
      data: saved
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/admin/fuel-price/reset - Khôi phục giá xăng về mức tham chiếu mặc định (24.120đ)
 */
export function resetAdminFuelPriceHandler(req, res) {
  try {
    const config = resetDailyFuelPriceConfig();
    return res.status(200).json({
      success: true,
      message: 'Đã khôi phục giá xăng RON 95 về mức tham chiếu mặc định (24.120đ)',
      data: config
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/admin/deletion-requests - Lấy danh sách các yêu cầu xóa tài khoản
 */
export function listDeletionRequestsHandler(req, res) {
  try {
    const { status } = req.query || {};
    const requests = getDeletionRequests(status);
    return res.status(200).json({
      success: true,
      total: requests.length,
      data: requests
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/admin/deletion-requests/:id/process - Quản trị viên xử lý yêu cầu xóa (Duyệt hoặc Từ chối)
 */
export async function processDeletionRequestHandler(req, res) {
  try {
    const { id } = req.params;
    const { action } = req.body || {};

    if (!action || (action !== 'approved' && action !== 'rejected')) {
      return res.status(400).json({
        success: false,
        error: 'Hành động không hợp lệ. Vui lòng truyền action: "approved" hoặc "rejected".'
      });
    }

    const adminName = req.admin?.role === 'super_admin' ? 'Super Admin' : 'Quản trị viên';
    const result = await processDeletionRequest(id, action, adminName);

    return res.status(200).json(result);
  } catch (err) {
    console.error('[Admin Process Deletion Request Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/admin/users/:id - Quản trị viên chủ động xóa tài khoản thành viên
 */
export async function deleteUserAdminHandler(req, res) {
  try {
    const { id } = req.params;
    const result = await deleteUserAccount(id);
    return res.status(200).json({
      success: true,
      message: 'Đã xóa vĩnh viễn tài khoản thành viên khỏi hệ thống.',
      details: result
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/admin/ai-trajectories - Xóa toàn bộ quỹ đạo AI để làm sạch telemetry
 */
export function clearAdminAiTrajectories(req, res) {
  try {
    const deletedCount = clearAiTrajectories();
    return res.status(200).json({
      success: true,
      message: `Đã dọn sạch ${deletedCount} quỹ đạo AI`,
      count: deletedCount
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/admin/test-data - Dọn sạch toàn bộ dữ liệu kiểm thử (Analytics, AI Trajectories, Support Messages, Bookings)
 */
export function clearAdminTestData(req, res) {
  try {
    const trajCount = clearAiTrajectories();
    const analyticsCount = clearAnalyticsEvents();
    const supportCount = clearSupportMessages();
    const bookingsCount = clearAllBookings();
    const tripsCount = clearAllTrips();
    const intentsCount = clearAllIntents();
    const stationCount = clearAllStationRequests();
    const incidentsCount = clearAllTripIncidents();
    const epochsCount = clearAllMatchingEpochs();
    const exchangeCount = clearAllSeatExchangeOrders();
    const usersCount = clearNonAdminUsers();

    // Đồng bộ file carmate_db.json về trạng thái sạch chuẩn
    try {
      if (fs.existsSync(LEGACY_JSON_FILE)) {
        const cleanJson = {
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          stats: {
            members: 1,
            tripsCompleted: 0,
            routes: 0,
            avgRating: 5.0
          },
          driverOffers: [],
          passengerRequests: [],
          bookings: [],
          users: [
            {
              id: 'USR-0984883750',
              phone: '0984883750',
              name: 'Nguyễn Thành Huỳnh',
              role: 'admin',
              trustScore: 99,
              safeTripsCount: 0,
              provider: 'zalo',
              isCccdVerified: 1,
              isGplxVerified: 1,
              isBanned: 0,
              createdAt: '2026-09-01T08:00:00.000Z',
              updatedAt: new Date().toISOString(),
              email: 'huynh.nguyen@carmate.vn'
            }
          ]
        };
        fs.writeFileSync(LEGACY_JSON_FILE, JSON.stringify(cleanJson, null, 2), 'utf-8');
      }
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'Đã dọn sạch toàn bộ dữ liệu kiểm thử thành công, đưa hệ thống về 0',
      data: {
        tripsCleared: tripsCount,
        bookingsCleared: bookingsCount,
        intentsCleared: intentsCount,
        stationRequestsCleared: stationCount,
        incidentsCleared: incidentsCount,
        epochsCleared: epochsCount,
        exchangeCleared: exchangeCount,
        usersCleared: usersCount,
        aiTrajectoriesCleared: trajCount,
        analyticsCleared: analyticsCount,
        supportMessagesCleared: supportCount
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/admin/bookings - Dọn sạch toàn bộ lịch hẹn chuyến xe
 */
export function clearAdminBookings(req, res) {
  try {
    const bookingsCount = clearAllBookings();
    const intentsCount = clearAllIntents();
    return res.status(200).json({
      success: true,
      message: 'Đã dọn sạch toàn bộ lịch hẹn và ý định thành công',
      data: {
        bookingsCleared: bookingsCount,
        intentsCleared: intentsCount
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Hỗ trợ Test Suite kiểm tra MFA
 */
export function _getPendingMfaSession(sessionId) {
  return pendingMfaSessions.get(sessionId);
}
export function _clearPendingMfaSessions() {
  pendingMfaSessions.clear();
}

/**
 * POST /api/admin/drivers — Tạo hồ sơ Chủ xe (và chuyến đầu tiên) thay cho bác tài.
 *
 * Giai đoạn mời Chủ xe tham gia: đội vận hành gặp trực tiếp, xem giấy tờ tận nơi
 * rồi nhập hộ. Bác tài chưa cần cài ứng dụng; khi nào họ đăng nhập bằng chính số
 * điện thoại này qua OTP thì nhận lại nguyên hồ sơ và các chuyến đã đăng.
 */
export async function createDriverProfileHandler(req, res) {
  try {
    const body = req.body || {};

    // ── 1. Hồ sơ Chủ xe ────────────────────────────────────────────────
    const name = String(body.name || '').trim();
    const phone = cleanPhoneNumber(body.phone || '');
    const plate = String(body.plate || body.licensePlate || '').trim();
    const carType = String(body.carType || body.vehicleModel || '').trim();

    if (!name) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập tên Chủ xe.' });
    }
    if (!isValidVietnamesePhone(phone)) {
      return res.status(400).json({ success: false, error: 'Số điện thoại không hợp lệ (10 số, đầu 03/05/07/08/09).' });
    }
    if (!plate) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập biển số xe.' });
    }
    if (!carType) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập dòng xe.' });
    }

    const existing = getUserByPhone(phone);
    if (existing && existing.isBanned) {
      return res.status(400).json({ success: false, error: 'Số điện thoại này đang bị khoá trên hệ thống.' });
    }

    // Sức chứa xe chuẩn hoá theo quy chuẩn ghế (5/7 chỗ, bán tải, xe tải nhẹ)
    const { capacity, vehicleType, hasCargoBed, isCargoVehicle } = sanitizeVehicleCapacityAndSeats(
      body.capacity || body.vehicleCapacity || 5,
      body.availableSeats
    );

    const now = new Date().toISOString();
    const user = {
      ...(existing || {}),
      id: existing?.id || `USR-${phone}`,
      phone,
      name,
      role: 'driver',
      // Admin gặp trực tiếp và đối chiếu giấy tờ tận nơi nên đánh dấu đã xác minh.
      // Cờ createdByAdmin giữ lại dấu vết ai là người nhập hộ.
      isCccdVerified: 1,
      isGplxVerified: 1,
      isDriverVerified: true,
      createdByAdmin: true,
      createdByAdminAt: existing?.createdByAdminAt || now,
      isBanned: 0,
      trustScore: existing?.trustScore ?? 80,
      vehicle: {
        ...(existing?.vehicle || {}),
        plate,
        brand: carType.split(/\s+/)[0] || '',
        model: carType,
        capacity,
        color: String(body.color || '').trim() || existing?.vehicle?.color || '',
        photos: Array.isArray(existing?.vehicle?.photos) ? existing.vehicle.photos : [],
        status: 'VERIFIED'
      },
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    await saveUser(user);

    // ── 2. Chuyến xe đầu tiên (tuỳ chọn) ───────────────────────────────
    let createdTrip = null;
    const wantsTrip = Boolean(body.from && body.to && body.date && body.time);

    if (wantsTrip) {
      const requestedSeats = Number(body.availableSeats ?? 2);
      const { seats } = sanitizeVehicleCapacityAndSeats(capacity, requestedSeats);
      const price = Number(body.basePricePerSeat ?? 0);

      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Vui lòng nhập mức phụ xăng hợp lệ cho chuyến xe.',
          data: { user: { id: user.id, phone: user.phone, name: user.name } }
        });
      }

      // Chặn trùng khung giờ: một Chủ xe không thể chạy hai chuyến cùng lúc.
      const sameDayTrips = getTrips({ type: 'drivers', includeHidden: true }).filter(
        (t) =>
          cleanPhoneNumber(t.phoneReal || t.phone || '') === phone &&
          String(t.date) === String(body.date) &&
          t.status !== 'cancelled' &&
          t.status !== 'completed'
      );
      const clash = sameDayTrips.find((t) => String(t.time || '').slice(0, 5) === String(body.time).slice(0, 5));
      if (clash) {
        return res.status(400).json({
          success: false,
          error: `Chủ xe đã có chuyến (#${clash.id}) khởi hành lúc ${clash.time} cùng ngày.`,
          data: { user: { id: user.id, phone: user.phone, name: user.name } }
        });
      }

      const tripId = `DRV-${Date.now()}`;
      const startHour = parseInt(String(body.time).split(':')[0], 10);
      const tripPayload = {
        id: tripId,
        type: 'driver_offer',
        status: 'active',
        maskedCode: `CX-${Math.floor(100 + Math.random() * 900)}`,
        from: String(body.from).trim(),
        to: String(body.to).trim(),
        originHubId: body.originHubId || null,
        destinationHubId: body.destinationHubId || null,
        date: String(body.date).trim(),
        time: String(body.time).trim(),
        timeSlot: body.timeSlot || `${String(body.time).trim()}-${String(startHour + 2).padStart(2, '0')}:00`,
        availableSeats: seats,
        capacity,
        vehicleType,
        hasCargoBed,
        isCargoVehicle,
        basePricePerSeat: price,
        phoneReal: phone,
        userId: user.id,
        publicName: toPublicAlias(name) || name,
        carType,
        licensePlate: plate,
        plateMask: plate.replace(/\d{2}$/, 'xx'),
        routeCategory: body.routeCategory || 'Tuyến QL13',
        direction: body.direction || null,
        notes: String(body.notes || '').trim(),
        createdByAdmin: true,
        isHidden: 0,
        isBanned: 0,
        createdAt: Date.now()
      };
      createdTrip = await addTrip(tripPayload);
    }

    return res.status(201).json({
      success: true,
      message: createdTrip
        ? 'Đã tạo hồ sơ Chủ xe và đăng chuyến lên sàn.'
        : 'Đã tạo hồ sơ Chủ xe.',
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          vehicle: user.vehicle,
          isExisting: Boolean(existing)
        },
        trip: createdTrip || null
      }
    });
  } catch (err) {
    console.error('[createDriverProfileHandler] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
