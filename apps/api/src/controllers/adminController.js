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
  resetTrustRules
} from '../db/sqliteStore.js';

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
  } catch (err) {
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
      return res.status(200).json({
        success: true,
        message: 'Đã gửi lại mã OTP mới qua Telegram.'
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
      const inputMfa = typeof mfaCode === 'string' ? mfaCode.trim() : '';

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
      // 3) Chế độ test/dev local fallback
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

    return res.status(200).json({
      success: true,
      requireMfa: true,
      mfaSessionId: newSessionId,
      viaTelegram: hasTelegram,
      message: hasTelegram
        ? 'Mật mã chính xác. Mã OTP 6 số đã được gửi trực tiếp tới Telegram của bạn.'
        : 'Mật mã chính xác. Vui lòng nhập mã OTP để hoàn tất đăng nhập.'
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

    return res.status(200).json({
      success: true,
      data: {
        delayed,
        cancelled,
        reviewsWithFlags,
        vehicleMismatchReports,
        summary: {
          totalDelays: delayed.length,
          totalCancellations: cancelled.length,
          lowRatingFlags: reviewsWithFlags.length,
          totalVehicleMismatches: vehicleMismatchReports.length
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
 * Hỗ trợ Test Suite kiểm tra MFA
 */
export function _getPendingMfaSession(sessionId) {
  return pendingMfaSessions.get(sessionId);
}
export function _clearPendingMfaSessions() {
  pendingMfaSessions.clear();
}
