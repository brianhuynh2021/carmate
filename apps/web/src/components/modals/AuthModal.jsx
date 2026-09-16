import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Phone } from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { cleanPhoneNumber, isValidVietnamesePhone, normalizePhoneNumber } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import { Segmented } from '../ui/Chip.jsx';
import { GoogleIcon, TelegramIcon } from '../ui/SocialIcons.jsx';
import { auth } from '../../firebase.js';
import api from '../../api/client.js';

const inputClass = 'type-input w-full min-h-11 px-3 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#1a2232]';
const OTP_SESSION_KEY = 'carmate_otp_session_v1';

function readOtpSession() {
  try { return JSON.parse(sessionStorage.getItem(OTP_SESSION_KEY) || '{}'); } catch { return {}; }
}

export default function AuthModal({ onClose, onSuccess, initialPhone = '', title = 'Đăng nhập CarMate', subtitle = 'Quản lý chuyến và nhận phản hồi cho nhu cầu của bạn.', contextNotice }) {
  const [method, setMethod] = useState('phone');
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const verifier = useRef(null);
  const googleContainer = useRef(null);
  const telegramContainer = useRef(null);
  const completed = useRef(false);
  const busyRef = useRef(false);
  const successRef = useRef(onSuccess);
  const closeRef = useRef(onClose);
  successRef.current = onSuccess;
  closeRef.current = onClose;
  const session = readOtpSession();
  const remaining = Math.max(0, Math.ceil(((session.lastSentAt || 0) + 60000 - now) / 1000));

  useEffect(() => {
    let alive = true;
    api.getAuthConfig().then((data) => { if (alive) setConfig(data); }).catch(() => { if (alive) setConfig({}); });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive = false; clearInterval(timer); verifier.current?.clear(); };
  }, []);

  useEffect(() => {
    if (method !== 'phone') { verifier.current?.clear(); verifier.current = null; }
  }, [method]);

  const finish = async (response) => {
    if (!response?.success || !response.user) throw new Error(response?.error || 'Đăng nhập chưa thành công.');
    if (completed.current) return;
    completed.current = true;
    try { sessionStorage.removeItem(OTP_SESSION_KEY); } catch {}
    successRef.current?.(response.user, response.tripIds || []);
    closeRef.current?.();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const runProvider = async (operation) => {
    if (busyRef.current || completed.current) return;
    busyRef.current = true;
    setBusy(true); setError('');
    try { await finishRef.current(await operation()); }
    catch (err) { setError(err.message || 'Không thể đăng nhập. Vui lòng thử lại.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const runProviderRef = useRef(runProvider);
  runProviderRef.current = runProvider;

  useEffect(() => {
    if (method !== 'google' || !config?.googleClientId) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !googleContainer.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: config.googleClientId, auto_select: false,
        callback: (result) => {
          if (!result?.credential) { setError('Google chưa trả về thông tin đăng nhập.'); return; }
          runProviderRef.current(() => api.googleLogin({ idToken: result.credential }));
        }
      });
      googleContainer.current.replaceChildren();
      window.google.accounts.id.renderButton(googleContainer.current, { type: 'standard', size: 'large', text: 'continue_with', shape: 'pill', width: 280 });
    };
    let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (window.google?.accounts?.id) render();
    else {
      if (!script) { script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; document.head.appendChild(script); }
      script.addEventListener('load', render);
    }
    return () => { cancelled = true; script?.removeEventListener('load', render); };
  }, [method, config?.googleClientId]);

  useEffect(() => {
    if (method !== 'telegram' || !config?.telegramBotUsername || !telegramContainer.current) return;
    const callbackName = `carmateTelegramAuth${Date.now()}`;
    window[callbackName] = (user) => runProviderRef.current(() => api.telegramLogin(user));
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', config.telegramBotUsername);
    script.setAttribute('data-size', 'large');
    // Iframe của Telegram tự vẽ nền tối lộ ra ngoài mép bo tròn của nút. Khai báo
    // bán kính đúng bằng nút để widget tự bo, không còn viền đen quanh nút.
    script.setAttribute('data-radius', '20');
    script.setAttribute('data-onauth', `${callbackName}(user)`);
    telegramContainer.current.replaceChildren(script);
    return () => { delete window[callbackName]; };
  }, [method, config?.telegramBotUsername]);

  const sendOtp = async (event) => {
    event.preventDefault();
    if (busyRef.current || remaining > 0) return;
    const clean = cleanPhoneNumber(phone);
    if (!isValidVietnamesePhone(clean)) { setError('Nhập số điện thoại Việt Nam hợp lệ.'); return; }
    const latest = readOtpSession();
    if (latest.lockedUntil > Date.now()) { setError('Bạn đã yêu cầu nhiều mã. Vui lòng thử lại sau hoặc chọn cách đăng nhập khác.'); return; }
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (!verifier.current) verifier.current = new RecaptchaVerifier(auth, 'carmate-auth-recaptcha', { size: 'invisible' });
      const normalized = normalizePhoneNumber(clean);
      const request = await signInWithPhoneNumber(auth, `+84${normalized.slice(1)}`, verifier.current);
      const attempts = (latest.lockedUntil && latest.lockedUntil <= Date.now() ? 0 : Number(latest.attempts) || 0) + 1;
      try { sessionStorage.setItem(OTP_SESSION_KEY, JSON.stringify({ attempts, lastSentAt: Date.now(), lockedUntil: attempts >= 3 ? Date.now() + 900000 : 0 })); } catch {}
      setConfirmation(request); setNow(Date.now());
    } catch {
      verifier.current?.clear(); verifier.current = null;
      setError('Chưa gửi được mã xác thực. Kiểm tra số điện thoại hoặc chọn Google/Telegram.');
    } finally { busyRef.current = false; setBusy(false); }
  };

  const verifyOtp = (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) { setError('Nhập đủ 6 chữ số trong tin nhắn.'); return; }
    runProvider(async () => {
      const result = await confirmation.confirm(otp);
      return api.firebaseLogin({ idToken: await result.user.getIdToken(), phone: normalizePhoneNumber(phone), name: name.trim() || undefined });
    });
  };

  return <Modal onClose={() => !busy && onClose?.()} title={title} subtitle={subtitle} icon={ShieldCheck} zIndex="z-[10020]" bodyClassName="bg-[#DFE5EC] dark:bg-[#0b0f19]">
    <div className="space-y-4">
      {contextNotice && <p className="type-body text-slate-600 dark:text-slate-300">{contextNotice}</p>}
      <Segmented fullWidth value={method} onChange={(value) => { if (!busy) { setMethod(value); setError(''); } }} options={[{ value: 'phone', label: 'Điện thoại', icon: Phone }, { value: 'google', label: 'Google', icon: GoogleIcon }, { value: 'telegram', label: 'Telegram', icon: TelegramIcon }]} />
      {error && <p role="alert" className="type-body p-3 rounded-xl bg-rose-50 text-rose-700">{error}</p>}
      {method === 'phone' && <form onSubmit={confirmation ? verifyOtp : sendOtp} className="space-y-3">
        {!confirmation ? <>
          <label className="type-label grid gap-1.5">Tên hiển thị (không bắt buộc)<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputClass} /></label>
          <label className="type-label grid gap-1.5">Số điện thoại<input type="tel" required autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} /></label>
        </> : <>
          <p className="type-body">Nhập mã gửi đến {phone}.</p>
          <label className="type-label grid gap-1.5">Mã xác thực<input autoComplete="one-time-code" inputMode="numeric" maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className={inputClass} /></label>
          <button type="button" disabled={busy} onClick={() => { setConfirmation(null); setOtp(''); }} className="type-button text-[#0071e3]">Đổi số hoặc gửi lại mã</button>
        </>}
        <div id="carmate-auth-recaptcha" />
        <button type="submit" disabled={busy || (!confirmation && remaining > 0)} className="type-button w-full min-h-11 rounded-xl bg-[#0071e3] text-white disabled:opacity-50">{busy ? 'Đang xử lý…' : confirmation ? 'Xác thực và tiếp tục' : remaining > 0 ? `Gửi lại sau ${remaining}s` : 'Nhận mã xác thực'}</button>
      </form>}
      {method === 'google' && <div className="space-y-3"><div ref={googleContainer} className="flex justify-center" />{!config ? <p className="type-body">Đang tải Google…</p> : !config.googleClientId && <p className="type-body">Google chưa khả dụng. Bạn có thể chọn cách đăng nhập khác.</p>}</div>}
      {method === 'telegram' && <div className="space-y-3"><div ref={telegramContainer} className="flex justify-center" />{!config ? <p className="type-body">Đang tải Telegram…</p> : !config.telegramBotUsername && <p className="type-body">Telegram chưa khả dụng. Bạn có thể chọn cách đăng nhập khác.</p>}</div>}
      <p className="type-caption text-slate-500 dark:text-slate-400">Đăng nhập miễn phí. Thông tin bạn vừa nhập vẫn được giữ nguyên.</p>
    </div>
  </Modal>;
}
