import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, User, AlertCircle, Mail, Sparkles, Phone, Send, AtSign, Globe } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Segmented } from '../ui/Chip.jsx';
import { GoogleIcon, TelegramIcon } from '../ui/SocialIcons.jsx';
import TermsModal from './TermsModal.jsx';
import PolicyModal from './PolicyModal.jsx';
import api from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { isValidVietnamesePhone, isLikelyFakePhone, cleanPhoneNumber, normalizePhoneNumber } from '@carmate/shared';
import { auth } from '../../firebase.js';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

// Quản lý Rate Limit & Cooldown gửi OTP trong phiên (Chống Spam SMS & Bảo vệ tài chính)
const OTP_SESSION_KEY = 'carmate_otp_session_v1';
const MAX_OTP_ATTEMPTS_PER_SESSION = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // Khóa 15 phút nếu gửi quá 3 lần
const COOLDOWN_DURATION_SEC = 60; // 60 giây chờ giữa các lần gửi

function getOtpSessionState() {
  try {
    const raw = sessionStorage.getItem(OTP_SESSION_KEY);
    if (!raw) return { attempts: 0, lockedUntil: 0, lastSentAt: 0 };
    const parsed = JSON.parse(raw);
    return {
      attempts: Number(parsed.attempts) || 0,
      lockedUntil: Number(parsed.lockedUntil) || 0,
      lastSentAt: Number(parsed.lastSentAt) || 0
    };
  } catch {
    return { attempts: 0, lockedUntil: 0, lastSentAt: 0 };
  }
}

function recordOtpAttempt() {
  try {
    const current = getOtpSessionState();
    const newAttempts = current.attempts + 1;
    const now = Date.now();
    const isLocked = newAttempts >= MAX_OTP_ATTEMPTS_PER_SESSION;
    const state = {
      attempts: newAttempts,
      lockedUntil: isLocked ? now + LOCKOUT_DURATION_MS : current.lockedUntil,
      lastSentAt: now
    };
    sessionStorage.setItem(OTP_SESSION_KEY, JSON.stringify(state));
    return state;
  } catch {
    return { attempts: 1, lockedUntil: 0, lastSentAt: Date.now() };
  }
}

function clearOtpSessionState() {
  try {
    sessionStorage.removeItem(OTP_SESSION_KEY);
  } catch {}
}

export default function AuthModal({
  onClose,
  onSuccess,
  initialPhone = '',
  title = 'Đăng Nhập CarMate',
  subtitle = 'Đồng bộ bài đăng · Tiết kiệm chi phí · An toàn & bảo mật',
  contextNotice
}) {
  const { t } = useI18n();
  const { lang, setLang } = useI18n();
  const [authMethod, setAuthMethod] = useState('phone'); // 'phone' | 'google' | 'telegram'
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('minh_carmate');
  const [phoneStep, setPhoneStep] = useState('input'); // 'input' | 'otp'
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);

  // 1. Cooldown 60s (Lưu theo phiên để đóng/mở lại modal không bị reset thời gian chờ)
  const [countdown, setCountdown] = useState(() => {
    const state = getOtpSessionState();
    if (!state.lastSentAt) return 0;
    const elapsed = Math.floor((Date.now() - state.lastSentAt) / 1000);
    return Math.max(0, COOLDOWN_DURATION_SEC - elapsed);
  });

  // 2. Khóa phiên 15 phút (nếu gửi lại quá 3 lần mà không xác thực thành công)
  const [lockRemainingSec, setLockRemainingSec] = useState(() => {
    const state = getOtpSessionState();
    if (!state.lockedUntil) return 0;
    return Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
  });

  const [showGoogleForm, setShowGoogleForm] = useState(false);
  const [showTelegramForm, setShowTelegramForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeLegalModal, setActiveLegalModal] = useState(null); // 'terms' | 'policy' | null
  const [clientId, setClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
  const [telegramBotUsername, setTelegramBotUsername] = useState('carmate_alert_bot');
  const googleBtnRef = useRef(null);
  const telegramBtnRef = useRef(null);

  // Đếm ngược thời gian Cooldown 60s
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown]);

  // Đếm ngược thời gian Khóa phiên 15 phút
  useEffect(() => {
    let timer;
    if (lockRemainingSec > 0) {
      timer = setInterval(() => {
        const state = getOtpSessionState();
        const rem = Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
        setLockRemainingSec(rem);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lockRemainingSec]);

  // Dọn dẹp an toàn widget reCAPTCHA và làm trống phần tử DOM
  const resetRecaptcha = () => {
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch {}
      window.recaptchaVerifier = null;
    }
    const container = document.getElementById('firebase-recaptcha-container');
    if (container) {
      container.innerHTML = '';
    }
  };

  // Thu dọn reCAPTCHA khi unmount
  useEffect(() => {
    return () => {
      resetRecaptcha();
    };
  }, []);

  // Khởi tạo và lấy reCAPTCHA Verifier vô hình an toàn (chống lỗi duplicate render)
  const getOrCreateRecaptchaVerifier = () => {
    if (window.recaptchaVerifier) {
      return window.recaptchaVerifier;
    }
    resetRecaptcha();
    try {
      const verifier = new RecaptchaVerifier(auth, 'firebase-recaptcha-container', {
        size: 'invisible',
        callback: () => {},
        'expired-callback': () => {
          resetRecaptcha();
          setError('Mã reCAPTCHA đã hết hạn, vui lòng bấm gửi lại.');
        }
      });
      window.recaptchaVerifier = verifier;
      return verifier;
    } catch (err) {
      console.warn('[Recaptcha recreation fallback]', err);
      resetRecaptcha();
      // Thay thế phần tử container mới trong DOM nếu element cũ bị lưu cache bởi grecaptcha
      const container = document.getElementById('firebase-recaptcha-container');
      if (container && container.parentNode) {
        const fresh = document.createElement('div');
        fresh.id = 'firebase-recaptcha-container';
        container.parentNode.replaceChild(fresh, container);
      }
      const verifier = new RecaptchaVerifier(auth, 'firebase-recaptcha-container', {
        size: 'invisible',
        callback: () => {}
      });
      window.recaptchaVerifier = verifier;
      return verifier;
    }
  };

  // Gửi mã OTP qua Firebase SMS (Chấp nhận cả 0984883750, 984883750, +84...)
  const handleSendPhoneOtp = async (e) => {
    e?.preventDefault();

    // Kiểm tra giới hạn 3 lần trong phiên (Khóa 15 phút)
    const sessionState = getOtpSessionState();
    if (sessionState.lockedUntil > Date.now()) {
      const waitMin = Math.ceil((sessionState.lockedUntil - Date.now()) / 60000);
      setError(`Bạn đã gửi yêu cầu quá ${MAX_OTP_ATTEMPTS_PER_SESSION} lần trong phiên. Vui lòng thử lại sau ${waitMin} phút.`);
      return;
    }

    // Kiểm tra cooldown 60s
    if (countdown > 0) {
      setError(`Vui lòng chờ ${countdown} giây trước khi gửi lại mã OTP.`);
      return;
    }

    const normalized = normalizePhoneNumber(phone);
    if (!normalized || !isValidVietnamesePhone(normalized)) {
      setError('Số điện thoại không đúng định dạng nhà mạng Việt Nam (Nhập có số 0 hoặc không có số 0 đều được, VD: 0984... hoặc 984...)');
      return;
    }
    if (isLikelyFakePhone(normalized)) {
      setError('Số điện thoại có dấu hiệu số ảo. Vui lòng nhập số thật của bạn.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (import.meta.env.DEV || isLocalhost) {
        try {
          auth.settings.appVerificationDisabledForTesting = true;
        } catch {}
      }
      const formattedPhone = '+84' + normalized.slice(1);
      const verifier = getOrCreateRecaptchaVerifier();
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);

      // Ghi nhận lần gửi mã thành công vào sessionStorage và áp đặt cooldown/lockout
      const updatedState = recordOtpAttempt();
      setConfirmationResult(confirmation);
      setPhoneStep('otp');
      setCountdown(COOLDOWN_DURATION_SEC);
      if (updatedState.lockedUntil > Date.now()) {
        setLockRemainingSec(Math.ceil((updatedState.lockedUntil - Date.now()) / 1000));
      }
    } catch (err) {
      console.error('[Firebase Phone Auth Error]', err);
      resetRecaptcha();
      if (err.code === 'auth/invalid-phone-number') {
        setError('Số điện thoại không hợp lệ theo chuẩn quốc tế (+84).');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Đã gửi quá nhiều yêu cầu SMS từ thiết bị này. Vui lòng thử lại sau ít phút.');
      } else if (err.code === 'auth/captcha-check-failed' || err.message?.includes('already been rendered')) {
        setError('Không thể xác thực reCAPTCHA (do chặn domain hoặc kết nối mạng). Bạn có thể bấm nút "Đăng nhập nhanh" bên dưới để vào ngay.');
      } else if (err.code === 'auth/quota-exceeded') {
        setError('Đã vượt quá hạn mức SMS hôm nay của hệ thống.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Chưa mở vùng Việt Nam (+84) trên Firebase: Vào Firebase Console ➔ Authentication ➔ Settings ➔ SMS Region Policy để chọn Vietnam (+84). Hoặc bấm "Đăng nhập nhanh" bên dưới để kiểm thử ngay.');
      } else {
        setError(err.message || 'Không thể gửi tin nhắn SMS OTP. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Xác thực mã OTP Firebase SMS
  const handleVerifyPhoneOtp = async (e) => {
    e?.preventDefault();
    const code = otp.trim();
    if (!code || code.length < 6) {
      setError('Vui lòng nhập đầy đủ 6 chữ số mã OTP');
      return;
    }

    if (!confirmationResult) {
      setError('Phiên xác thực đã hết hạn, vui lòng gửi lại mã OTP mới');
      setPhoneStep('input');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userCredential = await confirmationResult.confirm(code);
      const fbUser = userCredential.user;
      const idToken = await fbUser.getIdToken();
      const normalized = normalizePhoneNumber(phone) || cleanPhoneNumber(phone);

      const res = await api.firebaseLogin({
        idToken,
        phone: normalized,
        name: name.trim() || undefined
      });

      if (res?.success && res?.user) {
        clearOtpSessionState();
        setCountdown(0);
        setLockRemainingSec(0);
        onSuccess?.(res.user, res.tripIds || []);
        onClose();
      } else {
        setError(res?.error || 'Đăng nhập không thành công');
      }
    } catch (err) {
      console.error('[Firebase OTP Confirm Error]', err);
      if (err.code === 'auth/invalid-verification-code') {
        setError('Mã OTP không chính xác. Vui lòng kiểm tra lại mã đã cài trên Firebase.');
      } else if (err.code === 'auth/code-expired') {
        setError('Mã OTP đã hết hạn. Vui lòng bấm gửi lại mã mới.');
      } else {
        setError(err.message || 'Xác thực OTP không thành công.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Đăng nhập nhanh kiểm thử offline / dev
  const handleDevPhoneLogin = async () => {
    const normalized = normalizePhoneNumber(phone) || '0984883750';
    setLoading(true);
    setError('');
    try {
      const res = await api.firebaseLogin({
        idToken: `TEST_FIREBASE_TOKEN_${normalized}:fb_dev_${Date.now()}`,
        phone: normalized,
        name: name.trim() || `Thành viên ${normalized.slice(-4)}`
      });
      if (res?.success && res?.user) {
        clearOtpSessionState();
        setCountdown(0);
        setLockRemainingSec(0);
        onSuccess?.(res.user, res.tripIds || []);
        onClose();
      } else {
        setError(res?.error || 'Đăng nhập không thành công');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Nhận diện môi trường local (Telegram OAuth Widget chặn localhost theo chính sách bảo mật)
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local'));

  // Tải cấu hình Google Client ID và Telegram Bot từ máy chủ
  useEffect(() => {
    let mounted = true;
    api
      .getAuthConfig()
      .then((cfg) => {
        if (mounted) {
          if (cfg?.googleClientId) setClientId(cfg.googleClientId);
          if (cfg?.telegramBotUsername) setTelegramBotUsername(cfg.telegramBotUsername);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Xử lý xác thực Telegram chính thức (Nhận payload user từ Telegram Widget)
  const handleTelegramAuth = async (user) => {
    if (!user || !user.id) {
      setError('Không nhận được thông tin xác thực từ Telegram');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.telegramLogin(user);
      if (res?.success && res?.user) {
        onSuccess?.(res.user, res.tripIds || []);
        onClose();
      } else {
        setError(res?.error || 'Đăng nhập Telegram không thành công');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Khởi tạo Telegram Login Widget chính thức (Chỉ nạp trên Production, Telegram chặn localhost)
  useEffect(() => {
    if (authMethod !== 'telegram' || isLocalhost || showTelegramForm) return;

    window.onTelegramAuth = handleTelegramAuth;

    const container = telegramBtnRef.current;
    if (!container) return;
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', telegramBotUsername || 'carmate_alert_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '14');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    container.appendChild(script);

    return () => {
      if (container) container.innerHTML = '';
    };
    // Widget Telegram chỉ gắn callback một lần vào script được chèn vào DOM;
    // thêm handleTelegramAuth vào deps sẽ chèn lại widget mỗi lần render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authMethod, telegramBotUsername, isLocalhost, showTelegramForm]);

  // Luồng đăng nhập nhanh Telegram (Hỗ trợ cả Số điện thoại hoặc @username)
  const handleTelegramDevSubmit = async (e) => {
    e?.preventDefault();
    const inputVal = telegramUsername.trim();
    if (!inputVal) {
      setError('Vui lòng nhập Số điện thoại hoặc @username Telegram');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isPhone = /^[0-9+() \-.]{9,15}$/.test(inputVal) && inputVal.replace(/\D/g, '').length >= 9;
      let cleanPhone = '';
      let cleanUser = '';

      if (isPhone) {
        const digits = inputVal.replace(/\D/g, '');
        cleanPhone =
          digits.startsWith('84') && digits.length === 11
            ? '0' + digits.slice(2)
            : digits.length === 9 && !digits.startsWith('0')
              ? '0' + digits
              : digits;

        if (cleanPhone.length >= 10 && (!isValidVietnamesePhone(cleanPhone) || isLikelyFakePhone(cleanPhone))) {
          setError('Số điện thoại không hợp lệ hoặc có dấu hiệu số ảo. Vui lòng nhập số thật của bạn.');
          setLoading(false);
          return;
        }
        cleanUser = `user_${cleanPhone.slice(-4)}`;
      } else {
        cleanUser = inputVal.replace(/^@/, '');
      }

      const seed = cleanPhone || cleanUser;
      const mockId = Math.abs(seed.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 1000000));
      const res = await api.telegramLogin({
        id: mockId,
        first_name: name.trim() || (cleanPhone ? `Thành viên ${cleanPhone.slice(0, 4)}***` : cleanUser),
        username: cleanUser,
        phone: cleanPhone || undefined,
        auth_date: Math.floor(Date.now() / 1000),
        hash: `TEST_TELEGRAM_MOCK_${cleanUser}:${mockId}`
      });

      if (res?.success && res?.user) {
        onSuccess?.(res.user, res.tripIds || []);
        onClose();
      } else {
        setError(res?.error || 'Đăng nhập Telegram không thành công');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý xác thực Google Identity Services chính thức (Nhận JWT credential từ Google)
  const handleGoogleCredential = async (response) => {
    if (!response?.credential) {
      setError('Không nhận được thông tin xác thực từ Google');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.googleLogin({
        idToken: response.credential
      });

      if (res?.success && res?.user) {
        onSuccess?.(res.user, res.tripIds || []);
        onClose();
      } else {
        setError(res?.error || 'Đăng nhập Google không thành công');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Khởi tạo Google Identity Services Button khi component sẵn sàng
  useEffect(() => {
    if (authMethod !== 'google' || showGoogleForm) return;

    let retryTimer = null;
    const initAndRender = () => {
      if (!clientId || !googleBtnRef.current) return false;
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredential,
            auto_select: false,
            cancel_on_tap_outside: true
          });
          googleBtnRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: 280,
            logo_alignment: 'left'
          });
          return true;
        } catch (e) {
          console.error('[GIS] Render error:', e);
          return false;
        }
      }
      return false;
    };

    if (!initAndRender()) {
      let attempts = 0;
      retryTimer = setInterval(() => {
        attempts++;
        if (initAndRender() || attempts > 15) {
          clearInterval(retryTimer);
        }
      }, 250);
    }

    return () => {
      if (retryTimer) clearInterval(retryTimer);
    };
    // Tương tự: Google Identity Services giữ callback đã đăng ký, không nên
    // khởi tạo lại nút đăng nhập mỗi lần render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, authMethod, showGoogleForm]);

  // Luồng đăng nhập nhanh Google (Dùng cho kiểm thử offline / dev test)
  const handleGoogleSubmit = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ email hợp lệ');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      const mockSub = 'user_' + Math.abs(cleanEmail.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0));
      const cleanPhone = phone.trim() ? cleanPhoneNumber(phone) : '';

      if (cleanPhone && cleanPhone.length >= 10 && (!isValidVietnamesePhone(cleanPhone) || isLikelyFakePhone(cleanPhone))) {
        setError('Số điện thoại không hợp lệ hoặc có dấu hiệu số ảo. Vui lòng nhập số thật của bạn.');
        setLoading(false);
        return;
      }

      const res = await api.googleLogin({
        idToken: `TEST_GOOGLE_TOKEN_${cleanEmail}:${mockSub}`,
        email: cleanEmail,
        name: name.trim() || cleanEmail.split('@')[0],
        phone: cleanPhone || undefined
      });

      if (res?.success && res?.user) {
        onSuccess?.(res.user, res.tripIds || []);
        onClose();
      } else {
        setError(res?.error || 'Đăng nhập không thành công');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm" icon={ShieldCheck} iconTone="brand" title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {contextNotice && (
          <div className="p-3 rounded-2xl bg-[#0071e3]/10 dark:bg-[#0071e3]/15 border border-[#0071e3]/20 text-xs font-semibold text-[#0071e3] dark:text-[#2997ff] flex items-center gap-2 leading-relaxed">
            <Sparkles className="w-4 h-4 shrink-0 text-[#0071e3] dark:text-[#2997ff]" />
            <span>{contextNotice}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── BỘ CHUYỂN PHƯƠNG THỨC CHUẨN APPLE HIG (SỐ ĐIỆN THOẠI MẶC ĐỊNH) ── */}
        <div className="flex justify-center">
          <Segmented
            fullWidth
            value={authMethod}
            onChange={(val) => {
              setError('');
              setAuthMethod(val);
            }}
            options={[
              { value: 'phone', label: 'Số điện thoại', icon: Phone },
              { value: 'google', label: 'Google', icon: GoogleIcon },
              { value: 'telegram', label: 'Telegram', icon: TelegramIcon }
            ]}
          />
        </div>

        {/* ── 1. PHƯƠNG THỨC SỐ ĐIỆN THOẠI (SMS OTP QUA FIREBASE) ── */}
        {authMethod === 'phone' && (
          <div className="space-y-3.5">
            {phoneStep === 'input' ? (
              <form onSubmit={handleSendPhoneOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại Việt Nam *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500 dark:text-slate-400 select-none">
                      🇻🇳 +84
                    </span>
                    <input
                      type="tel"
                      required
                      autoFocus
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0984 883 750 hoặc 984 883 750"
                      className="w-full h-12 pl-18 pr-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all shadow-xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-1">
                    Nhập có số 0 hoặc không có số 0 đều được (VD: 0984... hoặc 984...)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('auth2.s004')}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('auth2.s020')}
                      className="w-full h-11 pl-10 pr-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all shadow-xs"
                    />
                  </div>
                </div>

                {/* Container reCAPTCHA vô hình cho Firebase */}
                <div id="firebase-recaptcha-container" />

                {lockRemainingSec > 0 && (
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      Đã vượt quá 3 lần gửi OTP trong phiên. Nút gửi tạm khóa trong{' '}
                      <strong>{Math.floor(lockRemainingSec / 60)}p {lockRemainingSec % 60}s</strong>.
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || countdown > 0 || lockRemainingSec > 0}
                  className="w-full h-12 px-5 rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0055d4] text-white font-bold text-sm shadow-[0_4px_14px_rgba(0,113,227,0.35)] cursor-pointer inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed select-none"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>
                    {loading
                      ? 'Đang gửi mã...'
                      : lockRemainingSec > 0
                      ? `Tạm khóa gửi OTP (${Math.floor(lockRemainingSec / 60)}p ${lockRemainingSec % 60}s)`
                      : countdown > 0
                      ? `Vui lòng đợi (${countdown}s)`
                      : 'Nhận mã OTP qua tin nhắn SMS'}
                  </span>
                </button>

                {/* Tuỳ chọn đăng nhập nhanh thử nghiệm (chỉ hiện ở dev local) */}
                {import.meta.env.DEV && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={handleDevPhoneLogin}
                      className="text-[11px] text-[#86868b] dark:text-slate-400 hover:text-[#0071e3] dark:hover:text-[#2997ff] font-medium transition-colors cursor-pointer"
                    >
                      ⚡ Đăng nhập nhanh không cần SMS (Dev Test)
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <form onSubmit={handleVerifyPhoneOtp} className="space-y-3">
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <Phone className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>
                    Mã xác thực SMS đã được gửi đến số <strong>{normalizePhoneNumber(phone) || phone}</strong>
                  </span>
                </div>

                {lockRemainingSec > 0 && (
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      Đã đạt tối đa 3 lần gửi lại OTP trong phiên. Nút gửi lại tạm khóa trong{' '}
                      <strong>{Math.floor(lockRemainingSec / 60)}p {lockRemainingSec % 60}s</strong>.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-center">
                    Nhập mã xác thực gồm 6 chữ số (OTP)
                  </label>
                  <div className="flex justify-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      className="w-full max-w-[260px] h-13 text-center font-mono text-2xl tracking-[0.5em] font-bold rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-300 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneStep('input');
                      setOtp('');
                      setError('');
                    }}
                    className="text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium transition-colors cursor-pointer"
                  >
                    ← Đổi số khác
                  </button>
                  <button
                    type="button"
                    disabled={countdown > 0 || lockRemainingSec > 0 || loading}
                    onClick={handleSendPhoneOtp}
                    className={`font-semibold transition-colors ${
                      countdown > 0 || lockRemainingSec > 0
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-[#0071e3] hover:underline cursor-pointer'
                    }`}
                  >
                    {lockRemainingSec > 0
                      ? `Khóa gửi lại (${Math.floor(lockRemainingSec / 60)}p ${lockRemainingSec % 60}s)`
                      : countdown > 0
                      ? `Gửi lại mã (${countdown}s)`
                      : 'Gửi lại mã OTP'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{loading ? 'Đang xác thực...' : 'Xác nhận đăng nhập'}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── 2. PHƯƠNG THỨC GOOGLE ── */}
        {authMethod === 'google' && (
          <div className="space-y-3.5">
            {!showGoogleForm ? (
              <div className="space-y-3">
                {/* Khối nút Google Identity Services chính thức */}
                <div className="flex flex-col items-center justify-center min-h-[44px] py-1">
                  {clientId ? (
                    <div ref={googleBtnRef} className="flex justify-center w-full min-h-[44px]" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowGoogleForm(true)}
                      disabled={loading}
                      className="w-full h-12 rounded-2xl bg-white dark:bg-slate-800 border border-black/[0.14] dark:border-slate-600 hover:border-black/[0.3] hover:bg-black/[0.02] text-[#1d1d1f] dark:text-white text-sm font-semibold flex items-center justify-center gap-3 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.06)] cursor-pointer"
                    >
                      <GoogleIcon className="w-5 h-5 shrink-0" />
                      <span>{t('auth2.s001')}</span>
                    </button>
                  )}
                </div>

                {/* Tuỳ chọn đăng nhập kiểm thử offline (chỉ hiện ở dev local) */}
                {import.meta.env.DEV && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setShowGoogleForm(true)}
                      className="text-[11px] text-[#86868b] dark:text-slate-400 hover:text-[#0071e3] dark:hover:text-[#2997ff] font-medium transition-colors cursor-pointer"
                    >
                      {t('auth2.s002')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleGoogleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('auth2.s003')}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ban@gmail.com"
                      className="w-full h-11 pl-9 pr-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('auth2.s004')}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('auth2.s020')}
                      className="w-full h-11 pl-9 pr-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('auth2.s005')}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="VD: 0984 883 750"
                      className="w-full h-11 pl-9 pr-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowGoogleForm(false)}
                    className="py-3 px-4 rounded-2xl text-xs font-bold text-[#86868b] hover:bg-black/[0.04] cursor-pointer"
                  >
                    {t('auth2.s006')}
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-11 sm:h-12 px-5 rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0055d4] text-white font-bold text-sm shadow-[0_4px_14px_rgba(0,113,227,0.35)] cursor-pointer inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 select-none"
                  >
                    <GoogleIcon className="w-4.5 h-4.5 shrink-0" />
                    <span className="leading-none whitespace-nowrap">{loading ? 'Đang xác thực...' : 'Xác nhận đăng nhập Google'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── 2. PHƯƠNG THỨC TELEGRAM (BỔ SUNG) ── */}
        {authMethod === 'telegram' && (
          <div className="space-y-3.5">
            {isLocalhost ? (
              /* Giao diện Localhost mượt mà chuẩn Apple: Không nhúng iframe bị lỗi Bot domain invalid */
              <div className="space-y-3">
                <form onSubmit={handleTelegramDevSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('auth2.s007')}
                    </label>
                    <div className="relative">
                      <AtSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        autoFocus
                        value={telegramUsername}
                        onChange={(e) => setTelegramUsername(e.target.value)}
                        placeholder={t('auth2.s021')}
                        className="w-full h-11 pl-9 pr-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#229ED9] focus:ring-1 focus:ring-[#229ED9]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 sm:h-12 px-5 rounded-2xl bg-[#229ED9] hover:bg-[#1d8bc0] active:bg-[#187cae] text-white font-bold text-sm shadow-[0_4px_14px_rgba(34,158,217,0.35)] hover:shadow-[0_6px_20px_rgba(34,158,217,0.45)] cursor-pointer inline-flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed select-none"
                  >
                    <TelegramIcon className="w-4.5 h-4.5 shrink-0 text-white" />
                    <span className="leading-none whitespace-nowrap">{loading ? 'Đang xác thực...' : 'Đăng nhập với Telegram'}</span>
                  </button>
                </form>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-left space-y-1">
                  <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                    <span>{t('auth2.s008')}</span>
                  </p>
                  <p>
                    {t('auth2.s009')} <code>localhost</code>.
                  </p>
                  <p>
                    {t('auth2.s010')} <code>carmate.fly.dev</code>{t('auth2.s011')} <strong>@BotFather</strong> {t('auth2.s012')} <code>/setdomain</code> {t('auth2.s013')}
                  </p>
                </div>
              </div>
            ) : !showTelegramForm ? (
              /* Môi trường Production: Telegram Widget chính thức */
              <div className="space-y-3">
                {/* Khối nút Telegram Widget chính thức */}
                <div className="flex flex-col items-center justify-center min-h-[48px] py-1">
                  <div ref={telegramBtnRef} className="flex justify-center w-full min-h-[44px]" />
                </div>

                {/* Tuỳ chọn đăng nhập nhanh Telegram (chỉ hiện ở dev local) */}
                {import.meta.env.DEV && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setShowTelegramForm(true)}
                      className="text-[11px] text-[#86868b] dark:text-slate-400 hover:text-[#229ED9] font-medium transition-colors cursor-pointer"
                    >
                      {t('auth2.s014')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleTelegramDevSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('auth2.s007')}
                  </label>
                  <div className="relative">
                    <AtSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value)}
                      placeholder={t('auth2.s021')}
                      className="w-full h-11 pl-9 pr-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#229ED9] focus:ring-1 focus:ring-[#229ED9]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('auth2.s004')}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('auth2.s020')}
                      className="w-full h-11 pl-9 pr-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#229ED9] focus:ring-1 focus:ring-[#229ED9]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowTelegramForm(false)}
                    className="py-3 px-4 rounded-2xl text-xs font-bold text-[#86868b] hover:bg-black/[0.04] cursor-pointer"
                  >
                    {t('auth2.s006')}
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-11 sm:h-12 px-5 rounded-2xl bg-[#229ED9] hover:bg-[#1d8bc0] active:bg-[#187cae] text-white font-bold text-sm shadow-[0_4px_14px_rgba(34,158,217,0.35)] cursor-pointer inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 select-none"
                  >
                    <TelegramIcon className="w-4.5 h-4.5 shrink-0 text-white" />
                    <span className="leading-none whitespace-nowrap">{loading ? 'Đang xác thực...' : 'Xác nhận đăng nhập Telegram'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── FOOTER TINH TẾ CHUẨN APPLE ── */}
        <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
          {/* Micro Trust Badge sang trọng */}
          <div className="flex items-center justify-center gap-1.5 py-1 px-3.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] text-[11px] font-medium text-[#86868b] dark:text-slate-400 w-fit mx-auto border border-black/[0.04] dark:border-white/[0.06]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
            <span>{t('auth2.s015')}</span>
          </div>

          {/* Điều khoản & Pháp lý */}
          <p className="text-[11px] text-center text-[#86868b] dark:text-slate-400 leading-relaxed px-2">
            Bằng việc tiếp tục, bạn đồng ý với{' '}
            <button
              type="button"
              onClick={() => setActiveLegalModal('terms')}
              className="text-[#0071e3] dark:text-blue-400 font-semibold underline underline-offset-2 hover:opacity-85 cursor-pointer inline"
            >
              {t('auth2.s016')}
            </button>{' '}
            &{' '}
            <button
              type="button"
              onClick={() => setActiveLegalModal('policy')}
              className="text-[#0071e3] dark:text-blue-400 font-semibold underline underline-offset-2 hover:opacity-85 cursor-pointer inline"
            >
              {t('auth2.s017')}
            </button>{' '}
            của CarMate.
          </p>

          {/* Chuyển ngôn ngữ nhanh cho khách quốc tế */}
          <div className="flex items-center justify-center gap-1.5 text-xs pt-1 text-[#86868b]">
            <Globe className="w-3.5 h-3.5 text-[#0071e3]" />
            <span className="text-[11px] font-medium">{t('auth2.s018')}</span>
            <button
              type="button"
              onClick={() => setLang('vi')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                lang === 'vi' ? 'text-[#0071e3] bg-[#0071e3]/10' : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              {t('auth2.s019')}
            </button>
            <span className="text-[#86868b] text-[10px]">·</span>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                lang === 'en' ? 'text-[#0071e3] bg-[#0071e3]/10' : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Modal Điều khoản Dịch vụ & An toàn */}
      {activeLegalModal === 'terms' && <TermsModal onClose={() => setActiveLegalModal(null)} zIndex="z-[60]" />}

      {/* Modal Quy chế & Chính sách bảo mật */}
      {activeLegalModal === 'policy' && <PolicyModal onClose={() => setActiveLegalModal(null)} zIndex="z-[60]" />}
    </Modal>
  );
}

