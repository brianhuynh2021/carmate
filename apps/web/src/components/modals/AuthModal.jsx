import React, { useState } from 'react';
import { Phone, ShieldCheck, User, AlertCircle, Mail, ArrowRight, Sparkles } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { GoogleIcon, ZaloIcon } from '../ui/SocialIcons.jsx';
import TermsModal from './TermsModal.jsx';
import PolicyModal from './PolicyModal.jsx';
import api from '../../api/client.js';

export default function AuthModal({ onClose, onSuccess, initialPhone = '' }) {
  const [authTab, setAuthTab] = useState('google'); // 'google' | 'zalo'
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showGoogleForm, setShowGoogleForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeLegalModal, setActiveLegalModal] = useState(null); // 'terms' | 'policy' | null

  // 1. Luồng đăng nhập Google 1 chạm (0đ chi phí)
  const handleGoogleSubmit = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ email Google (Gmail) hợp lệ');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.googleLogin({
        email: email.trim(),
        name: name.trim() || email.trim().split('@')[0],
        phone: phone.trim() || undefined
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

  // 2. Luồng đăng nhập Zalo 1 chạm (0đ SMS viễn thông)
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

  return (
    <Modal
      onClose={onClose}
      size="sm"
      icon={ShieldCheck}
      iconTone="brand"
      title="Đăng Nhập CarMate"
      subtitle="Đồng bộ bài đăng · Tiết kiệm chi phí · 100% an toàn"
    >
      <div className="space-y-4">
        {/* Lựa chọn phương thức: Google hoặc Zalo (Apple Capsule Segmented) */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-black/[0.04] dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => { setAuthTab('google'); setError(''); }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              authTab === 'google'
                ? 'bg-white dark:bg-slate-900 text-[#1d1d1f] dark:text-white shadow-xs'
                : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
          >
            <GoogleIcon className="w-4 h-4 shrink-0" />
            <span>Google 1 chạm</span>
          </button>

          <button
            type="button"
            onClick={() => { setAuthTab('zalo'); setError(''); }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              authTab === 'zalo'
                ? 'bg-white dark:bg-slate-900 text-[#0068ff] shadow-xs'
                : 'text-[#86868b] hover:text-[#0068ff]'
            }`}
          >
            <ZaloIcon className="w-4 h-4 shrink-0" />
            <span>Số Zalo (0đ SMS)</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── TAB 1: GOOGLE 1 CHẠM ── */}
        {authTab === 'google' && (
          <div className="space-y-3.5">
            {!showGoogleForm ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/60 border border-black/[0.06] dark:border-slate-700/60 text-center space-y-1.5">
                  <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 shadow-xs flex items-center justify-center mx-auto border border-black/[0.06]">
                    <GoogleIcon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-[#1d1d1f] dark:text-white pt-1">Đăng nhập tài khoản Google</p>
                  <p className="text-[11.5px] text-[#86868b] dark:text-slate-400 leading-relaxed px-1">
                    Xác thực danh tính 1 chạm, tự động bảo vệ tài khoản và đồng bộ chuyến xe miễn phí.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGoogleForm(true)}
                  disabled={loading}
                  className="w-full h-12 rounded-2xl bg-white dark:bg-slate-800 border border-black/[0.14] dark:border-slate-600 hover:border-black/[0.3] hover:bg-black/[0.02] text-[#1d1d1f] dark:text-white text-sm font-semibold flex items-center justify-center gap-3 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.06)] cursor-pointer"
                >
                  <GoogleIcon className="w-5 h-5 shrink-0" />
                  <span>Tiếp tục với Google</span>
                </button>
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
                    Số điện thoại Zalo liên hệ đón (Tùy chọn)
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

                  <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    disabled={loading}
                    className="bg-[#0071e3] hover:bg-[#0055d4] text-white font-bold text-sm shadow-md py-3 rounded-2xl cursor-pointer"
                  >
                    <span>{loading ? 'Đang xác thực...' : 'Xác nhận đăng nhập Google'}</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── TAB 2: ZALO 1 CHẠM (0Đ SMS) ── */}
        {authTab === 'zalo' && (
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
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0984 883 750"
                  className="w-full h-11 pl-9 pr-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0068ff] focus:ring-1 focus:ring-[#0068ff]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tên hiển thị (Tài xế / Hành khách)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Tuấn Nguyễn, Anh Hải..."
                  className="w-full h-11 pl-9 pr-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0068ff] focus:ring-1 focus:ring-[#0068ff]"
                />
              </div>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              disabled={loading}
              className="bg-[#0068ff] hover:bg-[#0055d4] text-white font-bold text-sm shadow-md py-3 rounded-2xl cursor-pointer"
            >
              <ZaloIcon className="w-5 h-5 mr-2" />
              <span>{loading ? 'Đang kết nối...' : 'Tiếp tục với Zalo (0đ chi phí)'}</span>
            </Button>
          </form>
        )}

        {/* ── FOOTER TINH TẾ CHUẨN APPLE (THAY THẾ CHỮ XẤU CŨ) ── */}
        <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
          {/* Micro Trust Badge sang trọng */}
          <div className="flex items-center justify-center gap-1.5 py-1 px-3.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] text-[11px] font-medium text-[#86868b] dark:text-slate-400 w-fit mx-auto border border-black/[0.04] dark:border-white/[0.06]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
            <span>Bảo mật danh tính · 100% không tốn phí SMS</span>
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
        </div>
      </div>

      {/* Modal Điều khoản Dịch vụ & An toàn */}
      {activeLegalModal === 'terms' && (
        <TermsModal onClose={() => setActiveLegalModal(null)} zIndex="z-[60]" />
      )}

      {/* Modal Quy chế & Chính sách bảo mật */}
      {activeLegalModal === 'policy' && (
        <PolicyModal onClose={() => setActiveLegalModal(null)} zIndex="z-[60]" />
      )}
    </Modal>
  );
}
