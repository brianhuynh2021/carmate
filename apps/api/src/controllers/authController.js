import crypto from 'crypto';
import { cleanPhoneNumber, isValidVietnamesePhone, normalizePhoneNumber, isLikelyFakePhone } from '@carmate/shared';
import {
  getUserByPhone,
  getUserById,
  getUserByEmail,
  getUserByTelegramId,
  getUserByGoogleId,
  saveUser,
  getTripsForUser,
  deleteUserAccount,
  isUserDeactivated,
  createDeletionRequest
} from '../db/sqliteStore.js';
import { generateToken } from '../utils/token.js';
import { isAdminPhone } from '../utils/adminIdentity.js';
import { sendTelegramMessage } from '../utils/telegramAlert.js';

// Temporary in-RAM OTP cache (expires after 5 minutes, 0 VND SMS cost)
const otpMap = new Map();

// In-memory cache limiting frequency per phone number (60s cooldown & max 5 times/day)
const phoneRateLimitMap = new Map();

/**
 * POST /api/auth/request-otp
 * Generate an OTP verification code with SMS-bombing spam protection
 */
export function requestOtp(req, res) {
  try {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập số điện thoại' });
    }

    const cleaned = normalizePhoneNumber(phone) || cleanPhoneNumber(phone);
    if (!cleaned || !isValidVietnamesePhone(cleaned)) {
      return res.status(400).json({
        success: false,
        error: 'Số điện thoại không đúng định dạng nhà mạng Việt Nam (Nhập có số 0 hoặc không có số 0 đều được, VD: 0984... hoặc 984...)'
      });
    }

    const now = Date.now();
    const phoneLimit = phoneRateLimitMap.get(cleaned) || {
      lastRequestedAt: 0,
      count: 0,
      resetAt: now + 24 * 60 * 60 * 1000
    };

    // Reset the counter if 24 hours have passed
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

    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpMap.set(cleaned, { code, expiresAt });

    return res.status(200).json({
      success: true,
      message: 'Mã xác thực đã được tạo thành công',
      phone: cleaned,
      // Only include devOtp in the development environment for convenient testing at zero cost
      ...(isDev ? { devOtp: code } : {})
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * =============================================================================
 * ATTACH A VERIFIED PHONE NUMBER TO THE LOGGED-IN ACCOUNT
 * =============================================================================
 * Telegram / Google login only returns an id and a name — NO phone number
 * (the Telegram Login Widget does not provide a phone field). The account is therefore created with
 * an empty phone, and the driver only reaches the end of the post-a-trip form to meet the notice "please
 * update your phone number" with nowhere to enter it — a complete dead end.
 *
 * This endpoint is the way out: the user enters the number, receives an OTP, and verifies right there.
 * Unlike PATCH /auth/profile (which changes the number without proof of ownership), here
 * the number is only attached after passing OTP — because it is the number passengers will call to board.
 */
export async function verifyPhoneForAccount(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập trước.' });
    }

    const { phone, otp } = req.body || {};
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập đủ số điện thoại và mã OTP.' });
    }

    const cleaned = normalizePhoneNumber(phone) || cleanPhoneNumber(phone);
    if (!cleaned || !isValidVietnamesePhone(cleaned)) {
      return res.status(400).json({
        success: false,
        error: 'Số điện thoại không đúng định dạng nhà mạng Việt Nam.'
      });
    }
    if (isLikelyFakePhone(cleaned)) {
      return res.status(400).json({
        success: false,
        error: 'Số điện thoại có dấu hiệu số ảo. Khách cần gọi được cho bạn để lên xe.'
      });
    }

    const record = otpMap.get(cleaned);
    const isDev = process.env.NODE_ENV !== 'production';
    const isDevPass = isDev && String(otp).trim() === '123456';
    const isMatch = record && record.code === String(otp).trim() && Date.now() < record.expiresAt;

    if (!isDevPass && !isMatch) {
      return res.status(400).json({ success: false, error: 'Mã OTP không đúng hoặc đã hết hạn.' });
    }

    // The number already belongs to another account: do not allow hijacking it, because every pickup
    // contact and trust history is anchored to the phone number.
    const owner = getUserByPhone(cleaned);
    const me =
      (req.user.userId && getUserById(req.user.userId)) ||
      (req.user.id && getUserById(req.user.id)) ||
      (req.user.phone && getUserByPhone(req.user.phone)) ||
      (req.user.telegramId && getUserByTelegramId(String(req.user.telegramId)));

    if (!me) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy hồ sơ của bạn.' });
    }
    if (owner && owner.id !== me.id) {
      return res.status(409).json({
        success: false,
        error: 'Số điện thoại này đã gắn với một tài khoản khác. Vui lòng đăng nhập bằng số đó hoặc dùng số khác.'
      });
    }

    otpMap.delete(cleaned);

    me.phone = cleaned;
    me.isPhoneVerified = true;
    me.phoneVerifiedAt = new Date().toISOString();
    await saveUser(me);

    // Re-issue the token: the old token carries an empty phone, so every API that checks ownership
    // by phone number would still treat this person as having no number.
    const token = generateToken({
      id: me.id,
      userId: me.id,
      phone: me.phone,
      name: me.name,
      role: me.role || 'passenger'
    });

    return res.status(200).json({
      success: true,
      message: 'Đã xác thực số điện thoại. Bạn có thể đăng chuyến ngay.',
      token,
      user: { ...me, isPhoneVerified: true }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/auth/verify-otp
 * Verify the OTP to log in / register a new account
 */
export async function verifyOtp(req, res) {
  try {
    const { phone, otp, name } = req.body || {};
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập đầy đủ số điện thoại và mã OTP' });
    }

    const cleaned = normalizePhoneNumber(phone) || cleanPhoneNumber(phone);
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

    if (user && isUserDeactivated(user)) {
      return res.status(403).json({
        success: false,
        isDeactivated: true,
        error: '⛔ TÀI KHOẢN ĐÃ BỊ VÔ HIỆU HÓA VĨNH VIỄN: Thời hạn ân hạn khiếu nại (3 ngày) đã kết thúc. Bạn không thể truy cập hệ thống nữa.'
      });
    }

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

    // Issue a secure JWT token valid for 7 days
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
 * Log in / Register via Zalo Open API Token (OAuth / Mini App)
 * An accessToken or zaloToken signed/approved by Zalo is REQUIRED.
 * Does not accept a req.body impersonating a phone number when there is no token.
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

    // Handle mock tokens in the local Test / Development environment
    if (isDevOrTest && token.startsWith('TEST_ZALO_TOKEN_')) {
      const parts = token.replace('TEST_ZALO_TOKEN_', '').split(':');
      verifiedPhone = parts[0] || rawPhone || '';
      verifiedZaloId = parts[1] || `zalo_mock_${Date.now()}`;
      verifiedName = reqName || 'Chủ xe Zalo Test';
    } else {
      // Verify directly with the Zalo Graph API server
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
    if (user && isUserDeactivated(user)) {
      return res.status(403).json({
        success: false,
        error: '⛔ Tài khoản của bạn đã bị vô hiệu hóa vĩnh viễn sau thời gian ân hạn 3 ngày. Không thể đăng nhập vào hệ thống.'
      });
    }
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
 * Log in / Register via Google Identity Services ID Token
 * An idToken or credential signed/approved by Google is REQUIRED.
 * Does not accept a req.body impersonating an email when there is no token.
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

    // Handle mock tokens in the local Test / Development environment
    if (isDevOrTest && token.startsWith('TEST_GOOGLE_TOKEN_')) {
      const parts = token.replace('TEST_GOOGLE_TOKEN_', '').split(':');
      verifiedEmail = (parts[0] || rawEmail || '').trim().toLowerCase();
      verifiedGoogleId = parts[1] || rawGoogleId || 'test_gg_sub';
      verifiedName = reqName || verifiedEmail.split('@')[0] || 'Google User';
    } else {
      // Verify directly with the Google Tokeninfo API server
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
        // Anti Audience Confusion: only accept ID tokens issued for the CarMate app itself.
        // Without checking aud, a valid Google token issued to another application could also log in.
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
          // In production GOOGLE_CLIENT_ID must be configured in order to check aud.
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

    // Issue a secure JWT token valid for 7 days
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
 * POST /api/auth/firebase-login
 * Log in / Register via Firebase Phone Authentication
 * An idToken signed/approved by Firebase is REQUIRED.
 */
export async function firebaseLogin(req, res) {
  try {
    const { idToken, phone: reqPhone, name: reqName } = req.body || {};
    const token = (idToken || '').trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Yêu cầu idToken xác thực từ Firebase Phone Auth.'
      });
    }

    const isDevOrTest = process.env.NODE_ENV !== 'production';
    let verifiedPhone = '';
    let verifiedUid = '';
    let verifiedName = '';

    // Handle mock tokens in the local Test / Dev environment
    if (isDevOrTest && token.startsWith('TEST_FIREBASE_TOKEN_')) {
      const parts = token.replace('TEST_FIREBASE_TOKEN_', '').split(':');
      verifiedPhone = parts[0] || reqPhone || '';
      verifiedUid = parts[1] || `fb_mock_${Date.now()}`;
      verifiedName = reqName || '';
    } else {
      // Verify the token with the Google Identity Toolkit lookup API
      const firebaseApiKey =
        process.env.FIREBASE_API_KEY ||
        process.env.VITE_FIREBASE_API_KEY ||
        'AIzaSyBDDCdttfpC9JfTgEAmviAhWw5Az6kIAvI';
      try {
        const lookupRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token })
          }
        );
        const lookupData = await lookupRes.json().catch(() => ({}));

        if (!lookupRes.ok || !lookupData.users || lookupData.users.length === 0) {
          return res.status(401).json({
            success: false,
            error: 'Token Firebase không hợp lệ hoặc đã hết hạn từ máy chủ Google Identity.'
          });
        }

        const fbUser = lookupData.users[0];
        verifiedUid = fbUser.localId;
        verifiedPhone = fbUser.phoneNumber || reqPhone || '';
        verifiedName = fbUser.displayName || reqName || '';
      } catch (networkErr) {
        return res.status(502).json({
          success: false,
          error: 'Không thể kết nối đến máy chủ xác thực Firebase: ' + networkErr.message
        });
      }
    }

    if (!verifiedPhone && !reqPhone) {
      return res.status(400).json({
        success: false,
        error: 'Không thể trích xuất số điện thoại từ Token Firebase.'
      });
    }

    const rawPhone = verifiedPhone || reqPhone;
    const cleaned = normalizePhoneNumber(rawPhone) || cleanPhoneNumber(rawPhone);

    const userId = `USR-FB-${verifiedUid || cleaned}`;
    let user = (cleaned ? getUserByPhone(cleaned) : null) || getUserById(userId);

    if (user && isUserDeactivated(user)) {
      return res.status(403).json({
        success: false,
        error: '⛔ Tài khoản của bạn đã bị vô hiệu hóa vĩnh viễn sau thời gian ân hạn 3 ngày. Không thể đăng nhập vào hệ thống.'
      });
    }

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = {
        id: userId,
        phone: cleaned,
        firebaseUid: verifiedUid,
        name: verifiedName || reqName?.trim() || `Thành viên ${cleaned.slice(-4)}`,
        avatar: '',
        role: 'passenger',
        provider: 'firebase_phone',
        trustScore: 100,
        isCccdVerified: false,
        isGplxVerified: false,
        safeTripsCount: 0
      };
      await saveUser(user);
    } else {
      let changed = false;
      if (reqName && reqName.trim() && (!user.name || user.name.startsWith('Thành viên'))) {
        user.name = reqName.trim();
        changed = true;
      }
      if (verifiedUid && (!user.firebaseUid || user.firebaseUid !== verifiedUid)) {
        user.firebaseUid = verifiedUid;
        changed = true;
      }
      if (cleaned && !user.phone) {
        user.phone = cleaned;
        changed = true;
      }
      if (changed) {
        await saveUser(user);
      }
    }

    const myTrips = getTripsForUser(user || cleaned);
    const tripIds = myTrips.map((t) => t.id);

    // Issue a secure JWT token valid for 7 days
    const jwtToken = generateToken({
      userId: user.id,
      phone: user.phone || cleaned,
      role: user.role || 'passenger',
      name: user.name
    });

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Kích hoạt tài khoản mới thành công' : 'Đăng nhập thành công',
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
 * Get the current account profile from the JWT Token
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
 * Update personal info & the driver's vehicle Garage
 * Complies with the MIT Invariants (seat-count constraint, license plate, genuine owner-taken vehicle photos)
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

    // 0. Update the phone number if the user registered via Google and is adding a phone number
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

    // 1. Check the Email format if the user provides one
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

    // 2. Validate & normalize the Vehicle Profile (Vehicle Garage) per the MIT Invariants
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

        // MIT Invariant 1: Vehicle capacity & maximum passenger seats
        // 5-seat vehicle: max 4 passenger seats; 7-seat vehicle: max 6 passenger seats
        if (capacity !== 5 && capacity !== 7 && capacity !== 4) {
          capacity = 5;
        }

        // MIT Invariant 2: Vietnamese license plate format
        let formattedPlate = rawPlate;
        if (rawPlate) {
          const isMaskedPlate = /[*xX]/.test(rawPlate);
          if (isMaskedPlate) {
            // Partially masked plate (e.g. 51K-892.** or 51K-***.**)
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

        // Real vehicle photos (minimum 3 photos to receive the verified badge)
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

    // 3. Merge data and preserve state
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
 * Permanently delete the account & purge personal information
 * Complies with Apple App Store Guideline 5.1.1 (v) & Decree 13/2023/ND-CP (Article 16)
 */
export async function deleteAccount(req, res) {
  try {
    if (!req.user || (!req.user.id && !req.user.phone)) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập hoặc phiên làm việc không hợp lệ' });
    }

    // MIT Invariant Guard: an Admin account cannot delete itself (guarantees the system always has an owner)
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
 * POST /api/auth/deletion-request
 * User submits a request to cancel & delete their account to the CarMate admin
 * Ergonomic & invariant standard: no immediate deletion; the request is received so Admin can reconcile trips & obligations
 */
export async function requestAccountDeletion(req, res) {
  try {
    if (!req.user || (!req.user.id && !req.user.userId && !req.user.phone)) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập hoặc phiên làm việc không hợp lệ' });
    }

    const userId = req.user.id || req.user.userId;
    const phone = req.user.phone || '';
    const name = req.user.name || '';
    const email = req.user.email || '';
    const { reason } = req.body || {};

    // MIT Invariant Guard: an Admin account cannot submit a deletion request for itself
    const isAdmin = req.user.role === 'admin' || (phone && isAdminPhone(phone));
    if (isAdmin) {
      return res.status(403).json({
        success: false,
        error:
          'Tài khoản Quản trị viên (Admin) được bảo vệ bởi luật bất biến MIT, không thể gửi yêu cầu xóa tài khoản.'
      });
    }

    const result = await createDeletionRequest({
      userId,
      phone,
      name,
      email,
      reason: reason?.trim() || 'Người dùng yêu cầu đóng tài khoản'
    });

    // Send an instant alert notification to the admin's Telegram if configured
    const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    sendTelegramMessage(
      `⚠️ <b>[CARMATE] YÊU CẦU XÓA TÀI KHOẢN MỚI</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Thành viên:</b> ${name || 'Ẩn danh'} (<code>${userId}</code>)\n` +
        `📞 <b>Số điện thoại:</b> <code>${phone || 'Chưa có'}</code>\n` +
        `📧 <b>Email:</b> <code>${email || 'Chưa có'}</code>\n` +
        `📝 <b>Lý do:</b> ${reason?.trim() || 'Không nêu cụ thể'}\n` +
        `⏰ <b>Thời gian:</b> ${timeStr}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👉 <i>Vui lòng truy cập Cổng Quản Trị để đối soát chuyến xe và xử lý.</i>`,
      { parseMode: 'HTML', req }
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      alreadyExists: result.alreadyExists,
      message:
        result.message ||
        'Yêu cầu xóa tài khoản của bạn đã được gửi thành công tới Quản trị viên. Quản trị viên sẽ kiểm tra các chuyến xe dở dang và xử lý trong vòng 24-48 giờ.',
      data: result.data
    });
  } catch (err) {
    console.error('[Auth] Lỗi khi gửi yêu cầu xóa tài khoản:', err);
    return res.status(500).json({ success: false, error: err.message || 'Không thể gửi yêu cầu xóa tài khoản.' });
  }
}


/**
 * POST /api/auth/telegram-login
 * Log in / Register via Telegram Login Widget / Telegram WebApp
 * Cryptographically verify the hash signature with TELEGRAM_BOT_TOKEN
 * 100% zero SMS cost, high security per the Telegram standard
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

    // Handle mock tokens in the local Test / Development environment
    if (isDevOrTest && String(hash).startsWith('TEST_TELEGRAM_')) {
      // Allow fast dev testing
    } else {
      if (!botToken) {
        return res.status(500).json({
          success: false,
          error: 'Hệ thống chưa cấu hình TELEGRAM_BOT_TOKEN.'
        });
      }

      // Check the auth_date expiry (within 24 hours to prevent replay attacks)
      const now = Math.floor(Date.now() / 1000);
      if (auth_date && Math.abs(now - Number(auth_date)) > 86400) {
        return res.status(401).json({
          success: false,
          error: 'Phiên xác thực Telegram đã hết hạn (quá 24 giờ). Vui lòng đăng nhập lại.'
        });
      }

      // Telegram Widget verification algorithm standard:
      // 1. Build data_check_string from all keys except 'hash', sorted a-z
      const dataKeys = Object.keys(req.body)
        .filter((k) => k !== 'hash' && req.body[k] !== undefined && req.body[k] !== null && req.body[k] !== '')
        .sort();

      const dataCheckString = dataKeys.map((k) => `${k}=${req.body[k]}`).join('\n');

      // 2. secret_key = SHA256(botToken)
      const secretKey = crypto.createHash('sha256').update(botToken).digest();

      // 3. computedHash = HMAC-SHA256(dataCheckString, secretKey)
      const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      // 4. Constant-time comparison with timingSafeEqual
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
        role: 'passenger', // Default: a user joining the platform is a passenger
        trustScore: 98,
        safeTripsCount: 0,
        provider: 'telegram'
      };
      await saveUser(user);
    } else {
      // Update the latest info if available
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
 * Provide public configuration to the Frontend (Google Client ID & Telegram Bot)
 * Allows Fly.io to update the Client ID at runtime via fly secrets without rebuilding the Frontend
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

