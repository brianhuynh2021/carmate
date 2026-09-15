import React, { useState, useEffect } from 'react';
import { CheckCircle2, Car, MapPin, ArrowRight, ShieldCheck, Sparkles, AlertCircle, Loader2, User } from 'lucide-react';
import { formatVND } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import api from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

/**
 * DriverQuickConfirmModal — Magic Link 1-Chạm cho Chủ xe
 * Mở trực tiếp khi Chủ xe bấm link trong tin nhắn Zalo (#confirm-CX-XXXX)
 * Không cần đăng nhập, bảo vệ thông tin PII, xác nhận 1 chạm tức thì.
 */
export default function DriverQuickConfirmModal({ bookingCode, onClose, onShowToast }) {
  const { t } = useI18n();
  // bookingCode có thể là object { code, token } (Magic Link mới) hoặc string (tương thích cũ)
  const codeId = typeof bookingCode === 'object' && bookingCode ? bookingCode.code : bookingCode;
  const accessToken = typeof bookingCode === 'object' && bookingCode ? bookingCode.token || '' : '';
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [driverNote, setDriverNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchSummary() {
      if (!codeId) {
        setError('Mã xác nhận không hợp lệ.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const res = await api.getBookingPublicSummary(codeId, accessToken);
        if (active) {
          if (res?.success && res.data) {
            setBooking(res.data);
            if (res.data.driverConfirmed) {
              setConfirmedSuccess(true);
            }
          } else {
            setError(res?.error || 'Không tìm thấy thông tin đặt chuyến.');
          }
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Không thể tải thông tin đặt chuyến hoặc liên kết đã hết hạn.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchSummary();
    return () => {
      active = false;
    };
  }, [codeId, accessToken]);

  const handleConfirm = async () => {
    if (submitting || !codeId) return;
    setSubmitting(true);

    try {
      const res = await api.driverConfirmBooking(codeId, { driverNote: driverNote.trim() }, accessToken);
      if (res?.success) {
        setConfirmedSuccess(true);
        onShowToast?.('Chủ xe đã xác nhận đón thành công! Chúc chuyến đi thuận buồm xuôi gió.', 'success');
      } else {
        onShowToast?.(res?.error || 'Có lỗi xảy ra khi xác nhận.', 'danger');
      }
    } catch (err) {
      onShowToast?.(err.message || 'Không thể gửi xác nhận. Vui lòng thử lại.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const passengerName = booking?.passengerName || 'Hành khách CarMate';

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={Car}
      iconTone="brand"
      title={t('driverConfirm.s017')}
      subtitle={`Mã giữ chỗ: ${codeId}`}
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="type-caption">{t('driverConfirm.s001')}</p>
        </div>
      ) : error ? (
        <div className="py-8 space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="type-heading text-slate-900">{t('driverConfirm.s002')}</h4>
            <p className="type-caption text-slate-500 mt-1 max-w-xs mx-auto">{error}</p>
          </div>
          <Button variant="secondary" onClick={onClose} className="mt-2">
            {t('driverConfirm.s003')}
          </Button>
        </div>
      ) : confirmedSuccess ? (
        <div className="py-6 space-y-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-sm animate-bounce">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h4 className="type-heading text-slate-900">{t('driverConfirm.s004')}</h4>
            <p className="type-caption text-slate-600 mt-1 max-w-sm mx-auto">
              {t('driverConfirm.s005')} <strong className="type-body-strong">{passengerName}</strong>{t('driverConfirm.s006')}
            </p>
          </div>

          {/* Chi tiết tóm tắt */}
          <div className="type-caption p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-1.5 text-slate-700">
            <div className="type-body-strong flex items-center gap-1.5 text-slate-900">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {booking.from} ➔ {booking.to}
              </span>
            </div>
            {booking.pickupPoint && (
              <p className="type-body text-slate-600">
                {t('driverConfirm.s007')} <strong className="type-body-strong text-slate-800">{booking.pickupPoint}</strong>
              </p>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-200/80 text-slate-500">
              <span>
                {t('driverConfirm.s008')} <strong className="type-body-strong">{booking.timeSlot}</strong>
              </span>
              <span>
                {t('driverConfirm.s009')} <strong className="type-body-strong text-emerald-700">{formatVND(booking.totalDeal)}</strong>
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              fullWidth
              size="lg"
              onClick={onClose}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {t('driverConfirm.s010')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Thẻ thông tin khách đặt */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center">
                  <User className="w-4 h-4" strokeWidth={2.2} />
                </div>
                <div>
                  <p className="type-caption text-slate-900">{passengerName}</p>
                  <p className="type-caption text-slate-500">{t('driverConfirm.s011')}</p>
                </div>
              </div>
              <span className="type-badge px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200/60 tabular">
                {booking.timeSlot}
              </span>
            </div>

            <div className="type-caption flex items-center gap-2 text-slate-800">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">{booking.from}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{booking.to}</span>
            </div>

            {booking.pickupPoint && (
              <div className="type-caption p-2 rounded-xl bg-amber-50/80 border border-amber-200/60 text-amber-900">
                <span className="">{t('driverConfirm.s012')} </span>
                <span>{booking.pickupPoint}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-slate-600">
                {t('driverConfirm.s013')} <strong className="type-body-strong text-slate-900">{booking.seats || 1} ghế</strong>
              </span>
              <span className="text-slate-600">
                Phụ xăng chia sẻ:{' '}
                <strong className="type-body-strong text-emerald-700 tabular">
                  {formatVND(booking.totalDeal)}
                </strong>
              </span>
            </div>
          </div>

          {/* Lời nhắn kèm theo của chủ xe (Tùy chọn) */}
          <div className="space-y-1.5">
            <label className="type-label text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {t('driverConfirm.s014')}
            </label>
            <input
              type="text"
              value={driverNote}
              onChange={(e) => setDriverNote(e.target.value)}
              placeholder={t('driverConfirm.s018')}
              className="type-input w-full h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Nút bấm hành động 1-chạm */}
          <div className="space-y-2 pt-1">
            <Button
              fullWidth
              size="lg"
              disabled={submitting}
              onClick={handleConfirm}
              className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 cursor-pointer shadow-sm active:scale-[0.99]"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              {submitting ? 'Đang xác nhận...' : '✓ Chủ xe đồng ý nhận đón'}
            </Button>

            <Button fullWidth variant="secondary" onClick={onClose} className="py-2 text-slate-600">
              {t('driverConfirm.s015')}
            </Button>
          </div>

          <div className="type-caption flex items-center justify-center gap-2 text-slate-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{t('driverConfirm.s016')}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}
