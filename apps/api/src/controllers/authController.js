import { cleanPhoneNumber, isValidVietnamesePhone } from '@carmate/shared';
import {
  getUserByPhone,
  getUserById,
  getUserByEmail,
  saveUser,
  getTripsByPhone,
  deleteUserAccount
} from '../db/sqliteStore.js';
import { generateToken } from '../utils/token.js';

// Bộ nhớ đệm OTP tạm thời trong RAM (5 phút hết hạn, 0đ chi phí SMS)
const otpMap = new Map();

// Bộ nhớ đệm giới hạn tần suất theo từng số điện thoại (Cooldown 60s & Tối đa 5 lần/ngày)
const phoneRateLimitMap = new Map();

/**
 * POST /api/auth/request-otp
 * Khởi tạo mã xác thực OTP kèm cơ chế chống Spam dội bom SMS
 */
export function requestOtp(req, res) {
  try {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập số điện thoại' });
    }

    const cleaned = cleanPhoneNumber(phone);
    if (!cleaned || !isValidVietnamesePhone(cleaned)) {
      return res.status(400).json({
        success: false,
        error: 'Số điện thoại không đúng định dạng nhà mạng Việt Nam (Viettel, Vina, Mobi, Vietnamobile...)'
      });
    }

    const now = Date.now();
    const phoneLimit = phoneRateLimitMap.get(cleaned) || {
      lastRequestedAt: 0,
      count: 0,
      resetAt: now + 24 * 60 * 60 * 1000
    };

    // Reset bộ đếm nếu đã qua 24 giờ
    if (now > phoneLimit.resetAt) {
      phoneLimit.count = 0;
      phoneLimit.resetAt = now + 24 * 60 * 60 * 1000;
    }

    const isDev = process.env.NODE_ENV !== 'production';
    const cooldownMs = isDev ? 5 * 1000 : 60 * 1000; // Dev: 5s để test nhanh; Prod: 60s chống click liên tục

    if (now - phoneLimit.lastRequestedAt < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - (now - phoneLimit.lastRequestedAt)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Vui lòng đợi ${waitSec} giây trước khi yêu cầu mã tiếp theo.`
      });
    }

    const maxDaily = isDev ? 50 : 5;
    if (phoneLimit.count >= maxDaily) {
      return res.status(429).json({
        success: false,
        error: 'Số điện thoại này đã đạt giới hạn nhận mã trong ngày (tối đa 5 lần/ngày). Vui lòng thử lại sau 24h.'
      });
    }

    phoneLimit.count += 1;
    phoneLimit.lastRequestedAt = now;
    phoneRateLimitMap.set(cleaned, phoneLimit);

    // Sinh mã ngẫu nhiên 6 chữ số
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 phút

    otpMap.set(cleaned, { code, expiresAt });

    return res.status(200).json({
      success: true,
      message: 'Mã xác thực đã được tạo thành công',
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
/**
 * POST /api/auth/zalo-login
 * Đăng nhập / Đăng ký qua Zalo Open API Token (OAuth / Mini App)
 * BẮT BUỘC có accessToken hoặc zaloToken được Zalo ký duyệt.
 * Không chấp nhận req.body mạo danh số điện thoại khi không có token.
 */
export async function zaloLogin(req, res) {
  try {
    const { accessToken, zaloToken, token: inputToken, phone: rawPhone, name: reqName } = req.body || {};
    const token = (accessToken || zaloToken || inputToken || '').trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        error:
          'Yêu cầu accessToken từ Zalo SDK. Không thể đăng nhập bằng thông tin mạo danh. Nếu đăng nhập bằng số điện thoại, vui lòng dùng luồng xác thực OTP SMS.'
      });
    }

    const isDevOrTest = process.env.NODE_ENV !== 'production';
    let verifiedZaloId = '';
    let verifiedName = '';
    let verifiedAvatar = '';
    let verifiedPhone = '';

    // Xử lý mock token trong môi trường Test / Development cục bộ
    if (isDevOrTest && token.startsWith('TEST_ZALO_TOKEN_')) {
      const parts = token.replace('TEST_ZALO_TOKEN_', '').split(':');
      verifiedPhone = parts[0] || rawPhone || '';
      verifiedZaloId = parts[1] || `zalo_mock_${Date.now()}`;
      verifiedName = reqName || 'Tài xế Zalo Test';
    } else {
      // Xác thực trực tiếp với máy chủ Zalo Graph API
      try {
        const zaloRes = await fetch(
          `https://graph.zalo.me/v2.0/me?access_token=${encodeURIComponent(token)}&fields=id,name,picture`
        );
        const zaloData = await zaloRes.json().catch(() => ({}));
        if (!zaloRes.ok || zaloData.error || !zaloData.id) {
          return res.status(401).json({
            success: false,
            error: 'Token Zalo không hợp lệ hoặc đã hết hạn từ máy chủ Zalo.'
          });
        }
        verifiedZaloId = String(zaloData.id);
        verifiedName = zaloData.name || '';
        verifiedAvatar = zaloData.picture?.data?.url || '';
      } catch (networkErr) {
        return res.status(502).json({
          success: false,
          error: 'Không thể kết nối đến máy chủ xác thực Zalo: ' + networkErr.message
        });
      }
    }

    const cleaned = verifiedPhone ? cleanPhoneNumber(verifiedPhone) : '';
    const userId = `USR-ZALO-${verifiedZaloId || cleaned || Date.now()}`;

    let user = getUserById(userId) || (cleaned ? getUserByPhone(cleaned) : null);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = {
        id: userId,
        phone: cleaned || '',
        name: verifiedName || reqName?.trim() || `Tài xế Zalo ${userId.slice(-4)}`,
        avatar: verifiedAvatar || '',
        role: 'driver',
        provider: 'zalo',
        trustScore: 100,
        safeTripsCount: 0
      };
      await saveUser(user);
    } else {
      if (verifiedName) user.name = verifiedName;
      if (verifiedAvatar) user.avatar = verifiedAvatar;
      if (cleaned && !user.phone) user.phone = cleaned;
      user.provider = 'zalo';
      await saveUser(user);
    }

    const myTrips = user.phone ? getTripsByPhone(user.phone) : [];
    const tripIds = myTrips.map((t) => t.id);

    const jwtToken = generateToken({
      userId: user.id,
      phone: user.phone || '',
      role: user.role || 'driver',
      name: user.name
    });

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Kích hoạt tài khoản Zalo mới thành công' : 'Đăng nhập Zalo thành công',
      user,
      token: jwtToken,
      tripIds,
      isNewUser
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/auth/google-login
 * Đăng nhập / Đăng ký qua Google Identity Services ID Token
 * BẮT BUỘC có idToken hoặc credential được Google ký duyệt.
 * Không chấp nhận req.body mạo danh email khi không có token.
 */
export async function googleLogin(req, res) {
  try {
    const {
      idToken,
      credential,
      token: inputToken,
      email: rawEmail,
      googleId: rawGoogleId,
      name: reqName,
      phone: reqPhone
    } = req.body || {};
    const token = (idToken || credential || inputToken || '').trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Yêu cầu idToken xác thực từ Google. Không thể đăng nhập bằng thông tin mạo danh email.'
      });
    }

    const isDevOrTest = process.env.NODE_ENV !== 'production';
    let verifiedEmail = '';
    let verifiedGoogleId = '';
    let verifiedName = '';
    let verifiedAvatar = '';

    // Xử lý mock token trong môi trường Test / Development cục bộ
    if (isDevOrTest && token.startsWith('TEST_GOOGLE_TOKEN_')) {
      const parts = token.replace('TEST_GOOGLE_TOKEN_', '').split(':');
      verifiedEmail = (parts[0] || rawEmail || '').trim().toLowerCase();
      verifiedGoogleId = parts[1] || rawGoogleId || 'test_gg_sub';
      verifiedName = reqName || verifiedEmail.split('@')[0] || 'Google User';
    } else {
      // Xác thực trực tiếp với máy chủ Google Tokeninfo API
      try {
        const ggRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
        const ggData = await ggRes.json().catch(() => ({}));
        if (!ggRes.ok || !ggData.email || !ggData.sub) {
          return res.status(401).json({
            success: false,
            error: 'Token Google không hợp lệ hoặc đã hết hạn từ máy chủ Google.'
          });
        }
        if (ggData.email_verified !== true && ggData.email_verified !== 'true') {
          return res.status(401).json({
            success: false,
            error: 'Email Google chưa được xác thực (unverified email).'
          });
        }
        verifiedEmail = ggData.email.trim().toLowerCase();
        verifiedGoogleId = ggData.sub;
        verifiedName = ggData.name || '';
        verifiedAvatar = ggData.picture || '';
      } catch (networkErr) {
        return res.status(502).json({
          success: false,
          error: 'Không thể kết nối đến máy chủ xác thực Google: ' + networkErr.message
        });
      }
    }

    if (!verifiedEmail) {
      return res.status(400).json({ success: false, error: 'Không thể trích xuất địa chỉ email từ Token Google.' });
    }

    const userId = `USR-GG-${verifiedGoogleId}`;
    let user = getUserById(userId) || getUserByEmail(verifiedEmail);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = {
        id: userId,
        email: verifiedEmail,
        googleId: verifiedGoogleId,
        phone: reqPhone ? cleanPhoneNumber(reqPhone) : '',
        name: verifiedName || reqName?.trim() || verifiedEmail.split('@')[0] || 'Thành viên Google',
        avatar: verifiedAvatar || '',
        role: 'passenger',
        provider: 'google',
        trustScore: 100,
        isCccdVerified: false,
        isGplxVerified: false,
        safeTripsCount: 0
      };
      await saveUser(user);
    } else {
      if (verifiedName && (!user.name || user.name.startsWith('Thành viên'))) user.name = verifiedName;
      if (verifiedAvatar && !user.avatar) user.avatar = verifiedAvatar;
      if (reqPhone && !user.phone) user.phone = cleanPhoneNumber(reqPhone);
      user.googleId = verifiedGoogleId;
      user.email = verifiedEmail;
      user.provider = user.provider || 'google';
      await saveUser(user);
    }

    const myTrips = user.phone ? getTripsByPhone(user.phone) : [];
    const tripIds = myTrips.map((t) => t.id);

    // Cấp mã JWT Token bảo mật 7 ngày
    const jwtToken = generateToken({
      userId: user.id,
      phone: user.phone || '',
      email: user.email || '',
      role: user.role || 'passenger',
      name: user.name
    });

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Đăng ký tài khoản Google thành công' : 'Đăng nhập Google thành công',
      user,
      token: jwtToken,
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

/**
 * DELETE /api/auth/me
 * Xóa vĩnh viễn tài khoản & thanh tẩy thông tin cá nhân
 * Tuân thủ Apple App Store Guideline 5.1.1 (v) & Nghị định 13/2023/NĐ-CP (Điều 16)
 */
export async function deleteAccount(req, res) {
  try {
    if (!req.user || (!req.user.id && !req.user.phone)) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập hoặc phiên làm việc không hợp lệ' });
    }

    const result = await deleteUserAccount(req.user.id, req.user.phone);

    return res.status(200).json({
      success: true,
      message: 'Tài khoản và toàn bộ dữ liệu cá nhân của bạn đã được xóa vĩnh viễn khỏi hệ thống.',
      details: result
    });
  } catch (err) {
    console.error('[Auth] Lỗi khi xóa tài khoản:', err);
    return res.status(500).json({ success: false, error: 'Không thể xóa tài khoản. Vui lòng thử lại sau.' });
  }
}
