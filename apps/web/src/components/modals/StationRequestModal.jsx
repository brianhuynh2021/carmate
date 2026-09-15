import React, { useState } from 'react';
import { MapPin, ShieldAlert, CheckCircle2, Sparkles, Send, Fuel, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import { api } from '../../api/client.js';
import { isValidVietnamesePhone, cleanPhoneNumber } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';

export default function StationRequestModal({
  onClose,
  initialStationName = '',
  clientCoords = null,
  currentUser = null,
  onShowToast
}) {
  const { t } = useI18n();
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
      title={t('stationReq.s018')}
      subtitle={t('stationReq.s019')}
      icon={MapPin}
      iconTone="primary"
      size="md"
    >
      <div className="space-y-4">
        {/* BANNER NGUYÊN TẮC AN TOÀN & KHÓA CỨNG GIAO DIỆN (HARD WHITELIST DOCTRINE) */}
        <div className="type-caption p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1.5">
          <div className="type-body-strong flex items-center gap-2 text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{t('stationReq.s001')}</span>
          </div>
          <p className="type-caption text-slate-300">
            {t('stationReq.s002')} <strong className="type-body-strong">{t('stationReq.s003')}</strong>{t('stationReq.s004')} <strong className="type-body-strong">{t('stationReq.s005')}</strong>{t('stationReq.s006')}
          </p>
          <div className="type-caption pt-1 flex items-center gap-1.5 text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('stationReq.s007')} <strong className="type-body-strong">{t('stationReq.s008')}</strong> {t('stationReq.s009')}</span>
          </div>
        </div>

        {submittedResult ? (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="type-heading text-white">{t('stationReq.s010')}</h4>
              <p className="type-caption text-slate-300 mt-1">
                {t('stationReq.s011')} <strong className="type-body-strong">{submittedResult.request?.stationName}</strong> {t('stationReq.s012')}
              </p>
              <div className="type-body-strong inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-emerald-500/20 text-emerald-300">
                <span>{submittedResult.request?.requestCount || 1} / 50 đề xuất</span>
              </div>
            </div>
            <p className="type-caption text-slate-400">
              {t('stationReq.s013')}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="type-button w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer transition-all active:scale-[0.99]"
            >
              {t('stationReq.s014')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="type-caption p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="type-label block uppercase text-slate-300 mb-1">
                {t('stationReq.s015')} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder={t('stationReq.s020')}
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                className="type-input w-full h-12 px-3.5 rounded-xl bg-slate-900/90 border border-white/[0.15] text-white placeholder-slate-500 outline-none focus:border-emerald-400 transition-all"
              />
            </div>

            <div>
              <label className="type-label block uppercase text-slate-300 mb-1">
                {t('stationReq.s016')}
              </label>
              <textarea
                rows={2}
                placeholder={t('stationReq.s021')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="type-input w-full p-3 rounded-xl bg-slate-900/90 border border-white/[0.15] text-white placeholder-slate-500 outline-none focus:border-emerald-400 transition-all resize-none"
              />
            </div>

            <div>
              <label className="type-label block uppercase text-slate-300 mb-1">
                {t('stationReq.s017')}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                placeholder={t('stationReq.s022')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="type-input w-full h-12 px-3.5 rounded-xl bg-slate-900/90 border border-white/[0.15] text-white placeholder-slate-500 outline-none focus:border-emerald-400 transition-all"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="type-button w-full h-13 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 uppercase flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
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
