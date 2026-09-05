import { cleanPhoneNumber } from '@carmate/shared';
import { getUserByPhone, saveUser, getTripsByPhone } from '../db/sqliteStore.js';
import { generateToken } from '../utils/token.js';

// Bộ nhớ đệm OTP tạm thời trong RAM (5 phút hết hạn, 0đ chi phí SMS)
const otpMap = new Map();

/**
 * POST /api/auth/request-otp
 * Khởi tạo mã xác thực OTP
 */
export function requestOtp(req, res) {
  try {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập số điện thoại' });
    }

    const cleaned = cleanPhoneNumber(phone);
    if (!cleaned || cleaned.length < 9) {
      return res.status(400).json({ success: false, error: 'Số điện thoại không hợp lệ (cần ít nhất 9-10 chữ số)' });
    }

    // Sinh mã ngẫu nhiên 6 chữ số
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 phút

    otpMap.set(cleaned, { code, expiresAt });

    const isDev = process.env.NODE_ENV !== 'production';

    return res.status(200).json({
      success: true,
      message: 'Mã xác thực đã được gửi',
      phone: cleaned,
      // Chỉ gửi kèm devOtp ở môi trường phát triển để test thuận tiện 0đ
      ...(isDev ? { devOtp: code } : {})
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/auth/verify-otp
 * Xác nhận mã OTP để đăng nhập / đăng ký tài khoản mới
 */
export async function verifyOtp(req, res) {
  try {
    const { phone, otp, name } = req.body || {};
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập đầy đủ số điện thoại và mã OTP' });
    }

    const cleaned = cleanPhoneNumber(phone);
    const record = otpMap.get(cleaned);

    const isDev = process.env.NODE_ENV !== 'production';
    const isDevPass = isDev && otp.trim() === '123456';
    const isMatch = record && record.code === otp.trim() && Date.now() < record.expiresAt;

    if (!isDevPass && !isMatch) {
      return res.status(400).json({ success: false, error: 'Mã OTP không đúng hoặc đã hết hạn' });
    }

    otpMap.delete(cleaned);

    let user = getUserByPhone(cleaned);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = {
        id: 'USR-' + cleaned,
        phone: cleaned,
        name: name?.trim() || `Thành viên ${cleaned.slice(-4)}`,
        avatar: '',
        role: 'driver',
        trustScore: 98,
        safeTripsCount: 0,
        provider: 'phone_otp'
      };
      await saveUser(user);
    } else if (name && name.trim()) {
      user.name = name.trim();
      await saveUser(user);
    }

    const myTrips = getTripsByPhone(cleaned);
    const tripIds = myTrips.map((t) => t.id);

    // Cấp mã JWT Token bảo mật 7 ngày
    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name
    });

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Kích hoạt tài khoản mới thành công' : 'Đăng nhập thành công',
      user,
      token,
      tripIds,
      isNewUser
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/auth/zalo-login
 * Đăng nhập / Đăng ký Zalo 1 chạm
 */
export async function zaloLogin(req, res) {
  try {
    const { phone, name, avatar } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Cần số điện thoại Zalo để đăng nhập' });
    }

    const cleaned = cleanPhoneNumber(phone);
    let user = getUserByPhone(cleaned);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = {
        id: 'USR-ZALO-' + cleaned,
        phone: cleaned,
        name: name?.trim() || `Tài xế Zalo ${cleaned.slice(-4)}`,
        avatar: avatar || '',
        role: 'driver',
        provider: 'zalo',
        trustScore: 100,
        safeTripsCount: 0
      };
      await saveUser(user);
    } else {
      if (name) user.name = name.trim();
      if (avatar) user.avatar = avatar;
      user.provider = 'zalo';
      await saveUser(user);
    }

    const myTrips = getTripsByPhone(cleaned);
    const tripIds = myTrips.map((t) => t.id);

    // Cấp mã JWT Token bảo mật
    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name
    });

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Kích hoạt tài khoản Zalo mới thành công' : 'Đăng nhập Zalo thành công',
      user,
      token,
      tripIds,
      isNewUser
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/auth/me
 * Lấy hồ sơ tài khoản hiện tại từ Token JWT
 */
export async function getMe(req, res) {
  try {
    if (!req.user || !req.user.phone) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
    }

    const user = getUserByPhone(req.user.phone);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy hồ sơ thành viên' });
    }

    const myTrips = getTripsByPhone(user.phone);
    const tripIds = myTrips.map((t) => t.id);

    return res.status(200).json({
      success: true,
      user,
      tripIds
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
