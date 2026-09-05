import { verifyToken } from '../utils/token.js';
import { getTripById } from '../db/sqliteStore.js';
import { cleanPhoneNumber } from '@carmate/shared';

/**
 * Middleware bắt buộc đăng nhập (Require Authenticated Session)
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Vui lòng đăng nhập để thực hiện thao tác này'
    });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.'
    });
  }

  req.user = decoded;
  next();
}

/**
 * Middleware tùy chọn xác thực (Gắn user nếu có token)
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  next();
}

/**
 * Middleware siết chặt phân quyền sở hữu bài đăng (Anti-IDOR)
 * Ngăn chặn tuyệt đối việc người dùng A sửa/xóa bài đăng của người dùng B.
 */
export function requireTripOwnership(req, res, next) {
  const tripId = req.params.id;
  if (!tripId) {
    return res.status(400).json({ success: false, error: 'Thiếu mã chuyến đi' });
  }

  const trip = getTripById(tripId);
  if (!trip) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy bài đăng chuyến đi' });
  }

  // Quản trị viên hệ thống có toàn quyền
  if (req.user && req.user.role === 'admin') {
    req.targetTrip = trip;
    return next();
  }

  // Nếu người dùng không phải chủ sở hữu bài đăng
  const userPhone = req.user ? cleanPhoneNumber(req.user.phone) : null;
  const tripPhone = cleanPhoneNumber(trip.phoneReal || trip.phone || '');
  const isOwnerByPhone = userPhone && tripPhone && userPhone === tripPhone;
  const isOwnerById = req.user && trip.userId && req.user.userId === trip.userId;

  if (!isOwnerByPhone && !isOwnerById) {
    return res.status(403).json({
      success: false,
      error: 'Từ chối quyền truy cập: Bạn không có quyền chỉnh sửa hoặc xóa bài đăng của người khác'
    });
  }

  req.targetTrip = trip;
  next();
}
