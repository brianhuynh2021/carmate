import React, { useState } from 'react';
import { MapPin, ShieldAlert, CheckCircle2, Sparkles, Send, Fuel, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import { api } from '../../api/client.js';
import { isValidVietnamesePhone, cleanPhoneNumber } from '@carmate/shared';

export default function StationRequestModal({
  onClose,
  initialStationName = '',
  clientCoords = null,
  currentUser = null,
  onShowToast
}) {
  const [stationName, setStationName] = useState(initialStationName);
  const [note, setNote] = useState('');
  const [phone, setPhone] = useState(() => {
    if (currentUser?.phone) return currentUser.phone;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('carmate_rider_phone') || '';
    }
    return '';
  });
  const [loading, setLoading] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = stationName.trim();
    if (!cleanName || cleanName.length < 2) {
      setError('Vui lòng nhập tên điểm hoặc ngã ba muốn đề xuất (tối thiểu 2 ký tự)');
      return;
    }

    const cleanPhone = cleanPhoneNumber(phone);
    if (phone && !isValidVietnamesePhone(cleanPhone)) {
      setError('Số điện thoại không hợp lệ (cần 10 chữ số)');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.createStationRequest({
        stationName: cleanName,
        note: note.trim(),
        userPhone: cleanPhone,
        lat: clientCoords?.lat || null,
        lng: clientCoords?.lng || null
      });

      if (res && res.success) {
        setSubmittedResult(res);
        if (cleanPhone && typeof localStorage !== 'undefined') {
          localStorage.setItem('carmate_rider_phone', cleanPhone);
        }
        onShowToast?.(`Đã gửi đề xuất mở trạm: ${cleanName}!`);
      } else {
        setError(res?.error || 'Không thể gửi đề xuất. Vui lòng thử lại.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối máy chủ khi gửi đề xuất.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Đề xuất mở Trạm ảo mới"
      subtitle="Gom yêu cầu mở điểm đón an toàn dọc hành lang Quốc Lộ 13"
      icon={MapPin}
      iconTone="primary"
      size="md"
    >
      <div className="space-y-4">
        {/* BANNER NGUYÊN TẮC AN TOÀN & KHÓA CỨNG GIAO DIỆN (HARD WHITELIST DOCTRINE) */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1.5 leading-relaxed">
          <div className="flex items-center gap-2 font-bold text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Tại sao CarMate không đón điểm tùy tiện?</span>
          </div>
          <p className="text-slate-300 text-[11px]">
            Đại lộ QL13 có mật độ xe tải cao và gắn camera phạt nguội biển <strong>P.130 (cấm dừng đỗ)</strong>. Để bảo vệ chủ xe khỏi bị phạt và đảm bảo thời gian đón chỉ <strong>30–45 giây</strong>, CarMate chỉ đón tại sân bãi an toàn ngoài lòng đường (Cây xăng Petrolimex/PVOIL, TTTM).
          </p>
          <div className="pt-1 flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Điểm đạt <strong>&gt;50 đề xuất</strong> sẽ được CarMate khảo sát cắm trạm chính thức.</span>
          </div>
        </div>

        {submittedResult ? (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-white">Đã ghi nhận đề xuất thành công!</h4>
              <p className="text-xs text-slate-300 mt-1">
                Khu vực <strong>{submittedResult.request?.stationName}</strong> hiện có:
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold text-sm">
                <span>{submittedResult.request?.requestCount || 1} / 50 đề xuất</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              CarMate sẽ gửi thông báo qua SMS/Zalo ngay khi trạm này được thẩm định an toàn và kích hoạt.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer transition-all active:scale-[0.99]"
            >
              Đã hiểu &amp; Quay lại trạm đón
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold font-mono uppercase text-slate-300 mb-1">
                Tên điểm muốn mở trạm <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Ngã ba Đồng Tâm, Cổng KCN Minh Hưng 3..."
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                className="w-full h-12 px-3.5 rounded-xl bg-slate-900/90 border border-white/[0.15] text-white text-sm placeholder-slate-500 outline-none focus:border-emerald-400 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold font-mono uppercase text-slate-300 mb-1">
                Ghi chú bãi đỗ an toàn (khuyến khích)
              </label>
              <textarea
                rows={2}
                placeholder="VD: Có sân cây xăng Petrolimex đối diện, có bãi đất trống ngoài làn xe ô tô..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-900/90 border border-white/[0.15] text-white text-xs placeholder-slate-500 outline-none focus:border-emerald-400 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold font-mono uppercase text-slate-300 mb-1">
                Số điện thoại để thông báo khi mở trạm
              </label>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="0912 xxx xxx (nhận tin khi trạm mở)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-12 px-3.5 rounded-xl bg-slate-900/90 border border-white/[0.15] text-white text-sm font-mono placeholder-slate-500 outline-none focus:border-emerald-400 transition-all"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-13 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'ĐANG GỬI ĐỀ XUẤT...' : 'GỬI ĐỀ XUẤT VÀO POOL (>50 ĐỀ XUẤT)'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
