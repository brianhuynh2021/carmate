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

export default function AuthModal({
  onClose,
  onSuccess,
  initialPhone = '',
  title = 'Đăng Nhập CarMate',
  subtitle = 'Đồng bộ bài đăng · Tiết kiệm chi phí · An toàn & bảo mật',
  contextNotice
}) {
  const { lang, setLang } = useI18n();
  const [authMethod, setAuthMethod] = useState('google'); // 'google' | 'telegram'
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('minh_carmate');
  const [showGoogleForm, setShowGoogleForm] = useState(false);
  const [showTelegramForm, setShowTelegramForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeLegalModal, setActiveLegalModal] = useState(null); // 'terms' | 'policy' | null
  const [clientId, setClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
  const [telegramBotUsername, setTelegramBotUsername] = useState('carmate_alert_bot');
  const googleBtnRef = useRef(null);
  const telegramBtnRef = useRef(null);

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
      const res = await api.googleLogin({
        idToken: `TEST_GOOGLE_TOKEN_${cleanEmail}:${mockSub}`,
        email: cleanEmail,
        name: name.trim() || cleanEmail.split('@')[0],
        phone: phone.trim() || undefined
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

        {/* ── BỘ CHUYỂN PHƯƠNG THỨC CHUẨN APPLE HIG (GOOGLE MẶC ĐỊNH) ── */}
        <div className="flex justify-center">
          <Segmented
            fullWidth
            value={authMethod}
            onChange={(val) => {
              setError('');
              setAuthMethod(val);
            }}
            options={[
              { value: 'google', label: 'Google', icon: GoogleIcon },
              { value: 'telegram', label: 'Telegram', icon: TelegramIcon }
            ]}
          />
        </div>

        {/* ── 1. PHƯƠNG THỨC GOOGLE (MẶC ĐỊNH) ── */}
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
                      <span>Tiếp tục với Google</span>
                    </button>
                  )}
                </div>

                {/* Tuỳ chọn đăng nhập kiểm thử offline */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setShowGoogleForm(true)}
                    className="text-[11px] text-[#86868b] dark:text-slate-400 hover:text-[#0071e3] dark:hover:text-[#2997ff] font-medium transition-colors cursor-pointer"
                  >
                    Dùng form đăng nhập nhanh (Dev Test)
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGoogleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Địa chỉ Email Google (Gmail) *
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
                    Tên hiển thị của bạn (Tùy chọn)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="VD: Tuấn Nguyễn, Chị Linh..."
                      className="w-full h-11 pl-9 pr-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại liên hệ (Tùy chọn)
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
                    Quay lại
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
                      Số điện thoại hoặc Telegram @username *
                    </label>
                    <div className="relative">
                      <AtSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        autoFocus
                        value={telegramUsername}
                        onChange={(e) => setTelegramUsername(e.target.value)}
                        placeholder="VD: 0984 883 750 hoặc @minh_carmate"
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
                    <span>Môi trường thử nghiệm Localhost:</span>
                  </p>
                  <p>
                    Telegram Widget yêu cầu tên miền chính thức và từ chối <code>localhost</code>.
                  </p>
                  <p>
                    Khi deploy lên production (VD: <code>carmate.fly.dev</code>), bạn chỉ cần mở <strong>@BotFather</strong> gõ <code>/setdomain</code> để kích hoạt nút Widget tự động!
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

                {/* Tuỳ chọn đăng nhập nhanh Telegram (Dự phòng) */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setShowTelegramForm(true)}
                    className="text-[11px] text-[#86868b] dark:text-slate-400 hover:text-[#229ED9] font-medium transition-colors cursor-pointer"
                  >
                    Dùng form đăng nhập nhanh @username (Dev Test)
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleTelegramDevSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại hoặc Telegram @username *
                  </label>
                  <div className="relative">
                    <AtSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value)}
                      placeholder="VD: 0984 883 750 hoặc @minh_carmate"
                      className="w-full h-11 pl-9 pr-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#229ED9] focus:ring-1 focus:ring-[#229ED9]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên hiển thị của bạn (Tùy chọn)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="VD: Tuấn Nguyễn, Chị Linh..."
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
                    Quay lại
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
            <span>Bảo mật danh tính · Kết nối an toàn</span>
          </div>

          {/* Điều khoản & Pháp lý */}
          <p className="text-[11px] text-center text-[#86868b] dark:text-slate-400 leading-relaxed px-2">
            Bằng việc tiếp tục, bạn đồng ý với{' '}
            <button
              type="button"
              onClick={() => setActiveLegalModal('terms')}
              className="text-[#0071e3] dark:text-blue-400 font-semibold underline underline-offset-2 hover:opacity-85 cursor-pointer inline"
            >
              Điều khoản dịch vụ
            </button>{' '}
            &{' '}
            <button
              type="button"
              onClick={() => setActiveLegalModal('policy')}
              className="text-[#0071e3] dark:text-blue-400 font-semibold underline underline-offset-2 hover:opacity-85 cursor-pointer inline"
            >
              Chính sách bảo mật
            </button>{' '}
            của CarMate.
          </p>

          {/* Chuyển ngôn ngữ nhanh cho khách quốc tế */}
          <div className="flex items-center justify-center gap-1.5 text-xs pt-1 text-[#86868b]">
            <Globe className="w-3.5 h-3.5 text-[#0071e3]" />
            <span className="text-[11px] font-medium">Ngôn ngữ / Language:</span>
            <button
              type="button"
              onClick={() => setLang('vi')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                lang === 'vi' ? 'text-[#0071e3] bg-[#0071e3]/10' : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              Tiếng Việt
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

