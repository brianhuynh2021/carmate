import React, { useState } from 'react';
import { Phone, ShieldCheck, CheckCircle2, ArrowRight, Sparkles, User, KeyRound, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';
import api from '../../api/client.js';

export default function AuthModal({ onClose, onSuccess, initialPhone = '' }) {
  const [authMethod, setAuthMethod] = useState('zalo'); // 'zalo' | 'otp'
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Luồng đăng nhập Zalo (1 chạm - 0đ chi phí)
  const handleZaloLogin = async (e) => {
    e?.preventDefault();
    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) {
      setError('Vui lòng nhập số điện thoại Zalo hợp lệ (10 chữ số)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.zaloLogin({
        phone: phone.trim(),
        name: name.trim() || undefined
      });

      if (res?.success && res?.user) {
        onSuccess?.(res.user, res.tripIds || []);
        onClose();
      } else {
        setError(res?.error || 'Đăng nhập không thành công, vui lòng thử lại');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // 2. Luồng gửi mã OTP
  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) {
      setError('Vui lòng nhập số điện thoại hợp lệ để nhận mã');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.requestOtp(phone.trim());
      if (res?.success) {
        setOtpSent(true);
        if (res.devOtp) {
          setDevOtpHint(res.devOtp);
          setOtp(res.devOtp); // Tự động điền mã mẫu để tiện test 0đ
        }
      } else {
        setError(res?.error || 'Không thể tạo mã xác thực');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // 3. Luồng xác nhận mã OTP
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otp.trim()) {
      setError('Vui lòng nhập mã OTP 6 số');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.verifyOtp({
        phone: phone.trim(),
        otp: otp.trim(),
        name: name.trim() || undefined
      });

      if (res?.success && res?.user) {
        onSuccess?.(res.user, res.tripIds || []);
        onClose();
      } else {
        setError(res?.error || 'Mã xác thực không chính xác');
      }
    } catch (err) {
      setError(err.message || 'Mã xác thực không chính xác hoặc đã hết hạn');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="sm"
      icon={ShieldCheck}
      iconTone="brand"
      title="Đăng Nhập & Kích Hoạt Tài Khoản"
      subtitle="Đồng bộ chuyến xe · Quản lý bài đăng · Tự động kích hoạt"
    >
      <div className="space-y-4">
        {/* Lựa chọn phương thức đăng nhập */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => { setAuthMethod('zalo'); setError(''); }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authMethod === 'zalo'
                ? 'bg-white dark:bg-slate-900 text-[#0068ff] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ZaloIcon className="w-4 h-4" />
            <span>Zalo 1 chạm (0đ)</span>
          </button>

          <button
            type="button"
            onClick={() => { setAuthMethod('otp'); setError(''); }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authMethod === 'otp'
                ? 'bg-white dark:bg-slate-900 text-primary-700 dark:text-primary-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Số điện thoại / OTP</span>
          </button>
        </div>

        {/* Thông điệp rõ ràng: Đăng nhập & Đăng ký hợp nhất */}
        <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 text-[11px] text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span><strong>Chưa có tài khoản?</strong> Chỉ cần nhập số điện thoại, hệ thống sẽ tự động đăng ký tài khoản mới trong 0.05 giây mà không cần mật khẩu.</span>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Tab 1: Đăng nhập Zalo (Ưu tiên số 1 - 0đ) ── */}
        {authMethod === 'zalo' && (
          <form onSubmit={handleZaloLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Số điện thoại Zalo của bạn *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0984 883 750"
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0068ff] focus:ring-1 focus:ring-[#0068ff]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tên hiển thị (Tài xế / Người đi xe)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Tuấn Nguyễn, Anh Hải..."
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0068ff] focus:ring-1 focus:ring-[#0068ff]"
                />
              </div>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              disabled={loading}
              className="bg-[#0068ff] hover:bg-[#0055d4] text-white font-bold text-sm shadow-md py-3 cursor-pointer"
            >
              <ZaloIcon className="w-5 h-5 mr-2" />
              <span>{loading ? 'Đang kết nối...' : 'Tiếp tục với Zalo (0đ chi phí)'}</span>
            </Button>

            <div className="text-center">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                🔒 Cam kết 100% không mất phí, không gửi tin nhắn rác. Mọi chuyến xe bạn đã đăng sẽ tự động đồng bộ.
              </p>
            </div>
          </form>
        )}

        {/* ── Tab 2: Xác thực qua OTP ── */}
        {authMethod === 'otp' && (
          <div className="space-y-3.5">
            {!otpSent ? (
              <form onSubmit={handleRequestOtp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại nhận mã *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="VD: 0984 883 750"
                      className="w-full h-11 pl-9 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  variant="primary"
                  disabled={loading}
                  className="font-bold text-sm py-3 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  <span>{loading ? 'Đang tạo mã...' : 'Nhận mã xác thực OTP'}</span>
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <span>Mã OTP gửi đến: <strong>{phone}</strong></span>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp(''); }}
                    className="text-primary-600 dark:text-primary-400 font-bold hover:underline cursor-pointer"
                  >
                    Đổi số
                  </button>
                </div>

                {devOtpHint && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                    <span>⚡ Mã OTP thử nghiệm miễn phí: <strong>{devOtpHint}</strong></span>
                    <button
                      type="button"
                      onClick={() => setOtp(devOtpHint)}
                      className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-white font-bold cursor-pointer"
                    >
                      Dán mã
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nhập mã xác thực 6 chữ số *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full h-11 px-3 text-center tracking-widest text-lg font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên của bạn (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Tuấn Nguyễn"
                    className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  variant="primary"
                  disabled={loading}
                  className="font-bold text-sm py-3 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  <span>{loading ? 'Đang xác thực...' : 'Xác nhận & Đăng nhập'}</span>
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
