import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getJwtSecret } from '../utils/token.js';
import {
  getAdminMetrics,
  getAllTripsAdmin,
  toggleHideTrip,
  deleteTripPermanent,
  getAllUsers,
  updateUserStatus,
  getDB
} from '../db/sqliteStore.js';

const JWT_SECRET = getJwtSecret();
const ADMIN_PASSCODE = process.env.CARMATE_ADMIN_PASSCODE || process.env.ADMIN_SECRET_KEY;

const isProduction = process.env.NODE_ENV === 'production';

if (!ADMIN_PASSCODE || ADMIN_PASSCODE.trim() === '') {
  if (isProduction) {
    throw new Error('FATAL SECURITY ERROR: CARMATE_ADMIN_PASSCODE must be configured in production!');
  }
  console.warn('[Security Notice] CARMATE_ADMIN_PASSCODE chưa cấu hình trong dev. Sử dụng mã dev tạm thời.');
}

const EFFECTIVE_ADMIN_PASSCODE = ADMIN_PASSCODE || (!isProduction ? 'admin123' : '');
const ADMIN_MFA_CODE = process.env.CARMATE_ADMIN_MFA_CODE || '';

// Bộ nhớ đệm giới hạn tần suất đăng nhập (Chống Brute-Force mật mã Admin)
const failedAttemptsMap = new Map(); // ip -> { count, lockedUntil }

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
export function adminAuth(req, res) {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const tracker = failedAttemptsMap.get(clientIp);

    // 1. Kiểm tra khóa IP nếu đã thử sai quá 5 lần
    if (tracker && tracker.lockedUntil > now) {
      const waitMinutes = Math.ceil((tracker.lockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        error: `Phát hiện nhiều lần nhập sai mật mã Admin. Tạm khóa bảo vệ trong ${waitMinutes} phút.`
      });
    }

    const { passcode, mfaCode } = req.body || {};

    // 2. Kiểm tra mật mã chính bằng crypto.timingSafeEqual chống Timing Attack
    let isPasscodeValid = false;
    if (typeof passcode === 'string' && EFFECTIVE_ADMIN_PASSCODE) {
      const inputBuffer = Buffer.from(passcode);
      const targetBuffer = Buffer.from(EFFECTIVE_ADMIN_PASSCODE);
      if (inputBuffer.length === targetBuffer.length) {
        isPasscodeValid = crypto.timingSafeEqual(inputBuffer, targetBuffer);
      }
    }

    if (!isPasscodeValid) {
      const currentFailures = (tracker?.count || 0) + 1;
      if (currentFailures >= 5) {
        failedAttemptsMap.set(clientIp, { count: currentFailures, lockedUntil: now + 15 * 60 * 1000 });
        return res.status(429).json({
          success: false,
          error: 'Nhập sai quá 5 lần! Cổng Quản Trị bị tạm khóa 15 phút để chống tấn công dò mật khẩu.'
        });
      } else {
        failedAttemptsMap.set(clientIp, { count: currentFailures, lockedUntil: 0 });
        return res.status(401).json({
          success: false,
          error: `Mã bảo mật Admin không chính xác. Còn lại ${5 - currentFailures} lần thử.`
        });
      }
    }

    // 3. Kiểm tra MFA nếu được kích hoạt
    if (ADMIN_MFA_CODE) {
      if (!mfaCode) {
        return res.status(200).json({
          success: true,
          requireMfa: true,
          message: 'Mật mã chính xác. Vui lòng nhập mã xác thực bảo vệ 2 lớp (MFA/OTP).'
        });
      }
      if (mfaCode.trim() !== ADMIN_MFA_CODE.trim()) {
        return res.status(401).json({
          success: false,
          error: 'Mã xác thực 2 lớp (MFA) không chính xác.'
        });
      }
    }

    // Đăng nhập thành công -> Xóa bộ đếm lỗi
    failedAttemptsMap.delete(clientIp);

    // 4. Ký mã JWT Token thật có chữ ký mật mã (Cryptographic Signature, hạn 2 tiếng)
    const adminToken = jwt.sign(
      { role: 'super_admin', sessionType: 'admin_portal', issuedAt: now },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.status(200).json({
      success: true,
      token: adminToken,
      role: 'super_admin',
      message: 'Đăng nhập trang quản trị bảo mật thành công (JWT 2h)'
    });
  } catch (err) {
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
 * GET /api/admin/users - Danh sách thành viên & tài xế
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

    return res.status(200).json({
      success: true,
      data: {
        delayed,
        cancelled,
        reviewsWithFlags,
        summary: {
          totalDelays: delayed.length,
          totalCancellations: cancelled.length,
          lowRatingFlags: reviewsWithFlags.length
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
