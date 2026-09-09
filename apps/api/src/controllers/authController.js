import crypto from 'crypto';
import { cleanPhoneNumber, isValidVietnamesePhone } from '@carmate/shared';
import {
  getUserByPhone,
  getUserById,
  getUserByEmail,
  getUserByTelegramId,
  getUserByGoogleId,
  saveUser,
  getTripsForUser,
  deleteUserAccount
} from '../db/sqliteStore.js';
import { generateToken } from '../utils/token.js';
import { isAdminPhone } from '../utils/adminIdentity.js';

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

    const isTest = process.env.NODE_ENV === 'test' || req.headers['x-carmate-testing'] === 'true';
    const isDev = process.env.NODE_ENV !== 'production';
    const cooldownMs = isTest ? 0 : (isDev ? 5 * 1000 : 60 * 1000); // Test: 0; Dev: 5s; Prod: 60s

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

    const myTrips = getTripsForUser(user || cleaned);
    const tripIds = myTrips.map((t) => t.id);

    // Cấp mã JWT Token bảo mật 7 ngày
    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role || 'passenger',
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
      verifiedName = reqName || 'Chủ xe Zalo Test';
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
        name: verifiedName || reqName?.trim() || `Chủ xe Zalo ${userId.slice(-4)}`,
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

    const myTrips = getTripsForUser(user);
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
        // Chống Audience Confusion: chỉ chấp nhận ID token phát cho chính app CarMate.
        // Nếu không kiểm aud, token Google hợp lệ phát cho ứng dụng khác cũng đăng nhập được.
        const expectedAud = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
        if (expectedAud) {
          const allowedAud = expectedAud
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (!allowedAud.includes(ggData.aud)) {
            return res.status(401).json({
              success: false,
              error: 'Token Google không dành cho ứng dụng này (audience mismatch).'
            });
          }
        } else if (!isDevOrTest) {
          // Ở production bắt buộc phải cấu hình GOOGLE_CLIENT_ID để kiểm aud.
          return res.status(500).json({
            success: false,
            error: 'Máy chủ chưa cấu hình GOOGLE_CLIENT_ID để xác thực Google an toàn.'
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

    const cleanPhone = reqPhone ? cleanPhoneNumber(reqPhone) : '';
    const userId = `USR-GG-${verifiedGoogleId}`;
    let user =
      getUserById(userId) ||
      getUserByGoogleId(verifiedGoogleId) ||
      getUserByEmail(verifiedEmail) ||
      (cleanPhone ? getUserByPhone(cleanPhone) : null);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = {
        id: userId,
        email: verifiedEmail,
        googleId: verifiedGoogleId,
        phone: cleanPhone || '',
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
      let changed = false;
      if (verifiedName && (!user.name || user.name.startsWith('Thành viên'))) {
        user.name = verifiedName;
        changed = true;
      }
      if (verifiedAvatar && !user.avatar) {
        user.avatar = verifiedAvatar;
        changed = true;
      }
      if (cleanPhone && !user.phone) {
        user.phone = cleanPhone;
        changed = true;
      }
      if (!user.googleId || user.googleId !== verifiedGoogleId) {
        user.googleId = verifiedGoogleId;
        changed = true;
      }
      if (!user.email || user.email !== verifiedEmail) {
        user.email = verifiedEmail;
        changed = true;
      }
      if (changed) {
        await saveUser(user);
      }
    }

    const myTrips = getTripsForUser(user);
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
    if (!req.user || (!req.user.phone && !req.user.userId && !req.user.email && !req.user.telegramId)) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
    }

    const user =
      (req.user.userId && getUserById(req.user.userId)) ||
      (req.user.telegramId && getUserByTelegramId(req.user.telegramId)) ||
      (req.user.phone && getUserByPhone(req.user.phone)) ||
      (req.user.email && getUserByEmail(req.user.email));
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy hồ sơ thành viên' });
    }

    const myTrips = getTripsForUser(user);
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
 * PATCH /api/auth/profile
 * Cập nhật thông tin cá nhân & Garage xe của Chủ xe
 * Tuân thủ MIT Invariants (ràng buộc số ghế, biển số xe, ảnh xe thật chính chủ)
 */
export async function updateProfile(req, res) {
  try {
    if (!req.user || (!req.user.phone && !req.user.userId && !req.user.email && !req.user.telegramId)) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
    }

    const existingUser =
      (req.user.userId && getUserById(req.user.userId)) ||
      (req.user.telegramId && getUserByTelegramId(req.user.telegramId)) ||
      (req.user.phone && getUserByPhone(req.user.phone)) ||
      (req.user.email && getUserByEmail(req.user.email));
    if (!existingUser) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy hồ sơ thành viên' });
    }

    const { name, email, phone, avatar, bio, homeAddress, workAddress, vehicle, gender } = req.body || {};

    // 0. Cập nhật số điện thoại nếu người dùng đăng ký qua Google bổ sung số điện thoại
    if (phone !== undefined) {
      const rawP = (phone || '').trim();
      if (rawP) {
        const cleanP = cleanPhoneNumber(rawP);
        if (cleanP && cleanP.length >= 9) {
          existingUser.phone = cleanP;
        } else {
          return res.status(400).json({ success: false, error: 'Số điện thoại không đúng định dạng' });
        }
      }
    }

    // 1. Kiểm tra định dạng Email nếu người dùng cung cấp
    let cleanEmail = existingUser.email;
    if (email !== undefined) {
      const trimmedEmail = (email || '').trim().toLowerCase();
      if (trimmedEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          return res.status(400).json({ success: false, error: 'Địa chỉ email không đúng định dạng' });
        }
        cleanEmail = trimmedEmail;
      } else {
        cleanEmail = null;
      }
    }

    // 2. Validate & Chuẩn hóa Hồ sơ Xe (Vehicle Garage) theo MIT Invariants
    let updatedVehicle = existingUser.vehicle || null;
    if (vehicle !== undefined) {
      if (vehicle === null) {
        updatedVehicle = null;
      } else {
        const brand = (vehicle.brand || '').trim();
        const model = (vehicle.model || '').trim();
        const rawPlate = (vehicle.plate || '').trim().toUpperCase();
        const color = (vehicle.color || '').trim();
        const carCategory = vehicle.carCategory || 'family_car';
        let capacity = Number(vehicle.capacity) || 5;

        // MIT Invariant 1: Sức chứa xe & số ghế khách tối đa
        // Xe 5 chỗ: Tối đa 4 ghế khách; Xe 7 chỗ: Tối đa 6 ghế khách
        if (capacity !== 5 && capacity !== 7 && capacity !== 4) {
          capacity = 5;
        }

        // MIT Invariant 2: Định dạng Biển số xe Việt Nam
        let formattedPlate = rawPlate;
        if (rawPlate) {
          const isMaskedPlate = /[*xX]/.test(rawPlate);
          if (isMaskedPlate) {
            // Biển số đã che bảo mật một phần (VD: 51K-892.** hoặc 51K-***.**)
            formattedPlate = rawPlate;
          } else {
            const cleanPlate = rawPlate.replace(/[^0-9A-Z]/g, '');
            const plateRegex = /^[0-9]{2}[A-Z]{1,2}[0-9]{4,5}$/;
            if (cleanPlate && !plateRegex.test(cleanPlate)) {
              return res.status(400).json({
                success: false,
                error: 'Biển số xe không đúng định dạng Việt Nam (Ví dụ: 51K-892.41, 29A-456.78)'
              });
            }
            if (cleanPlate && !rawPlate.includes('-')) {
              const prefixLen = cleanPlate.length >= 7 && cleanPlate[2] >= 'A' && cleanPlate[2] <= 'Z' && cleanPlate[3] >= 'A' && cleanPlate[3] <= 'Z' ? 4 : 3;
              const prefix = cleanPlate.slice(0, prefixLen);
              const suffix = cleanPlate.slice(prefixLen);
              formattedPlate = `${prefix}-${suffix}`;
            }
          }
        }

        // Ảnh xe thật (Tối thiểu 3 ảnh để nhận huy hiệu xác thực)
        const photos = Array.isArray(vehicle.photos) ? vehicle.photos.filter(Boolean) : [];
        const hasVerifiedPhotos = photos.length >= 3;

        updatedVehicle = {
          brand,
          model,
          plate: formattedPlate,
          color,
          carCategory,
          capacity,
          maxPassengerSeats: capacity === 7 ? 6 : 4,
          perks: Array.isArray(vehicle.perks) ? vehicle.perks : [],
          photos,
          hasVerifiedPhotos,
          updatedAt: new Date().toISOString()
        };
      }
    }

    // 3. Hợp nhất dữ liệu và bảo toàn trạng thái
    const updatedUserObj = {
      ...existingUser,
      name: name !== undefined ? (name || '').trim() || existingUser.name : existingUser.name,
      email: cleanEmail,
      avatar: avatar !== undefined ? avatar : existingUser.avatar,
      gender: gender !== undefined ? (gender || '').trim() : existingUser.gender,
      bio: bio !== undefined ? (bio || '').trim() : existingUser.bio,
      homeAddress: homeAddress !== undefined ? (homeAddress || '').trim() : existingUser.homeAddress,
      workAddress: workAddress !== undefined ? (workAddress || '').trim() : existingUser.workAddress,
      vehicle: updatedVehicle,
      trustScore: updatedVehicle?.hasVerifiedPhotos
        ? Math.min(100, Math.max(existingUser.trustScore || 95, 99))
        : existingUser.trustScore
    };

    const saved = await saveUser(updatedUserObj);

    return res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ và garage xe thành công',
      user: saved
    });
  } catch (err) {
    console.error('[Profile] Lỗi cập nhật hồ sơ:', err);
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

    // MIT Invariant Guard: Tài khoản Quản trị viên (Admin) không thể tự xoá (bảo toàn hệ thống luôn có chủ quản)
    const isAdmin = req.user.role === 'admin' || isAdminPhone(req.user.phone);

    if (isAdmin) {
      return res.status(403).json({
        success: false,
        error:
          'Tài khoản Quản trị viên (Admin) được bảo vệ bởi luật bất biến MIT, không thể tự xoá vĩnh viễn để tránh làm hệ thống mất chủ quyền vận hành. Vui lòng chuyển giao quyền Admin trước.'
      });
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

/**
 * POST /api/auth/telegram-login
 * Đăng nhập / Đăng ký qua Telegram Login Widget / Telegram WebApp
 * Xác thực cryptographic chữ ký hash với TELEGRAM_BOT_TOKEN
 * 100% 0đ chi phí SMS, bảo mật cao chuẩn Telegram
 */
export async function telegramLogin(req, res) {
  try {
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body || {};

    if (!id || !hash) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin xác thực Telegram (id và hash là bắt buộc).'
      });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const isDevOrTest = process.env.NODE_ENV !== 'production';

    // Xử lý mock token trong môi trường Test / Development cục bộ
    if (isDevOrTest && String(hash).startsWith('TEST_TELEGRAM_')) {
      // Cho phép test dev nhanh
    } else {
      if (!botToken) {
        return res.status(500).json({
          success: false,
          error: 'Hệ thống chưa cấu hình TELEGRAM_BOT_TOKEN.'
        });
      }

      // Kiểm tra hạn của auth_date (trong vòng 24 giờ chống replay attack)
      const now = Math.floor(Date.now() / 1000);
      if (auth_date && Math.abs(now - Number(auth_date)) > 86400) {
        return res.status(401).json({
          success: false,
          error: 'Phiên xác thực Telegram đã hết hạn (quá 24 giờ). Vui lòng đăng nhập lại.'
        });
      }

      // Chuẩn thuật toán xác thực Telegram Widget:
      // 1. Tạo data_check_string từ tất cả keys ngoại trừ 'hash', sắp xếp theo a-z
      const dataKeys = Object.keys(req.body)
        .filter((k) => k !== 'hash' && req.body[k] !== undefined && req.body[k] !== null && req.body[k] !== '')
        .sort();

      const dataCheckString = dataKeys.map((k) => `${k}=${req.body[k]}`).join('\n');

      // 2. secret_key = SHA256(botToken)
      const secretKey = crypto.createHash('sha256').update(botToken).digest();

      // 3. computedHash = HMAC-SHA256(dataCheckString, secretKey)
      const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      // 4. So sánh an toàn thời gian timingSafeEqual
      const hashBuf = Buffer.from(String(hash), 'hex');
      const compBuf = Buffer.from(computedHash, 'hex');

      if (hashBuf.length !== compBuf.length || !crypto.timingSafeEqual(hashBuf, compBuf)) {
        return res.status(401).json({
          success: false,
          error: 'Chữ ký xác thực Telegram không hợp lệ hoặc bị can thiệp.'
        });
      }
    }

    const cleanPhone = req.body.phone ? String(req.body.phone).trim().replace(/\D/g, '') : '';
    const formattedPhone =
      cleanPhone.startsWith('84') && cleanPhone.length === 11
        ? '0' + cleanPhone.slice(2)
        : cleanPhone.length === 9 && !cleanPhone.startsWith('0')
          ? '0' + cleanPhone
          : cleanPhone;

    const userId = 'USR-TG-' + id;
    let user =
      (formattedPhone ? getUserByPhone(formattedPhone) : null) ||
      getUserById(userId) ||
      getUserByTelegramId(String(id));
    let isNewUser = false;

    const displayName =
      [first_name, last_name].filter(Boolean).join(' ') ||
      (username
        ? `@${username}`
        : formattedPhone
          ? `Thành viên ${formattedPhone.slice(0, 4)}***`
          : `Thành viên Telegram #${id}`);

    if (!user) {
      isNewUser = true;
      user = {
        id: userId,
        telegramId: String(id),
        username: username || '',
        name: displayName,
        avatar: photo_url || '',
        phone: formattedPhone || '',
        role: 'passenger', // Mặc định người dùng tham gia nền tảng là hành khách
        trustScore: 98,
        safeTripsCount: 0,
        provider: 'telegram'
      };
      await saveUser(user);
    } else {
      // Cập nhật thông tin mới nhất nếu có
      let changed = false;
      if (!user.telegramId || user.telegramId !== String(id)) {
        user.telegramId = String(id);
        changed = true;
      }
      if (formattedPhone && !user.phone) {
        user.phone = formattedPhone;
        changed = true;
      }
      if (displayName && (!user.name || user.name.startsWith('Thành viên') || user.name.startsWith('Google User'))) {
        user.name = displayName;
        changed = true;
      }
      if (photo_url && !user.avatar) {
        user.avatar = photo_url;
        changed = true;
      }
      if (username && user.username !== username) {
        user.username = username;
        changed = true;
      }
      if (changed) {
        await saveUser(user);
      }
    }

    const myTrips = getTripsForUser(user);
    const tripIds = myTrips.map((t) => t.id);

    const jwtToken = generateToken({
      userId: user.id,
      phone: user.phone || '',
      telegramId: user.telegramId || '',
      role: user.role || 'passenger',
      name: user.name
    });

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Kích hoạt tài khoản Telegram mới thành công' : 'Đăng nhập Telegram thành công',
      user,
      token: jwtToken,
      tripIds,
      isNewUser
    });
  } catch (err) {
    console.error('[Telegram Auth Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/auth/config
 * Cung cấp cấu hình công khai cho Frontend (Google Client ID & Telegram Bot)
 * Cho phép Fly.io cập nhật Client ID tại runtime qua fly secrets mà không cần build lại Frontend
 */
export function getAuthConfigHandler(req, res) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME || 'carmate_alert_bot';
  const hasTelegramAuth = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  return res.status(200).json({
    success: true,
    data: {
      googleClientId,
      telegramBotUsername,
      hasTelegramAuth
    }
  });
}

