import React, { useState, useEffect } from 'react';
import { CheckCircle2, Car, MapPin, ArrowRight, ShieldCheck, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { formatVND } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import api from '../../api/client.js';

/**
 * DriverQuickConfirmModal — Magic Link 1-Chạm cho Chủ xe
 * Mở trực tiếp khi Chủ xe bấm link trong tin nhắn Zalo (#confirm-CX-XXXX)
 * Không cần đăng nhập, bảo vệ thông tin PII, xác nhận 1 chạm tức thì.
 */
export default function DriverQuickConfirmModal({ bookingCode, onClose, onShowToast }) {
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [driverNote, setDriverNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchSummary() {
      if (!bookingCode) {
        setError('Mã xác nhận không hợp lệ.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const res = await api.getBookingPublicSummary(bookingCode);
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
  }, [bookingCode]);

  const handleConfirm = async () => {
    if (submitting || !bookingCode) return;
    setSubmitting(true);

    try {
      const res = await api.driverConfirmBooking(bookingCode, { driverNote: driverNote.trim() });
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
      title="Xác nhận đón hành khách"
      subtitle={`Mã giữ chỗ: ${bookingCode}`}
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-xs font-medium">Đang tải thông tin chuyến đi...</p>
        </div>
      ) : error ? (
        <div className="py-8 space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-base">Không thể tải thông tin</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">{error}</p>
          </div>
          <Button variant="secondary" onClick={onClose} className="mt-2">
            Đóng cửa sổ
          </Button>
        </div>
      ) : confirmedSuccess ? (
        <div className="py-6 space-y-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-sm animate-bounce">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-lg">Đã xác nhận đón khách!</h4>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
              Bạn đã đồng ý đón <strong>{passengerName}</strong>. Hệ thống đã ghi nhận lịch hẹn trên CarMate.
            </p>
          </div>

          {/* Chi tiết tóm tắt */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5 text-slate-700">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {booking.from} ➔ {booking.to}
              </span>
            </div>
            {booking.pickupPoint && (
              <p className="text-slate-600">
                Điểm đón: <strong className="text-slate-800">{booking.pickupPoint}</strong>
              </p>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-200/80 text-slate-500 text-[11px]">
              <span>
                Khung giờ: <strong>{booking.timeSlot}</strong>
              </span>
              <span>
                Thu trực tiếp: <strong className="text-emerald-700 font-bold">{formatVND(booking.totalDeal)}</strong>
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              fullWidth
              size="lg"
              onClick={onClose}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Xong · Về trang chủ
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Thẻ thông tin khách đặt */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                  {passengerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{passengerName}</p>
                  <p className="text-[10px] text-slate-500">Đặt qua Zalo · Cam kết không bùng</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200/60 text-xs font-bold tabular">
                {booking.timeSlot}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">{booking.from}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{booking.to}</span>
            </div>

            {booking.pickupPoint && (
              <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200/60 text-xs text-amber-900">
                <span className="font-bold">Điểm đón khách mong muốn: </span>
                <span>{booking.pickupPoint}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
              <span className="text-slate-600">
                Đăng ký: <strong className="text-slate-900">{booking.seats || 1} ghế</strong>
              </span>
              <span className="text-slate-600">
                Phụ xăng chia sẻ:{' '}
                <strong className="text-emerald-700 font-extrabold text-sm tabular">
                  {formatVND(booking.totalDeal)}
                </strong>
              </span>
            </div>
          </div>

          {/* Lời nhắn kèm theo của chủ xe (Tùy chọn) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Ghi chú nhanh cho hành khách (tùy chọn):
            </label>
            <input
              type="text"
              value={driverNote}
              onChange={(e) => setDriverNote(e.target.value)}
              placeholder="VD: Đón đúng giờ ở cây xăng nhé, xe màu trắng..."
              className="w-full h-10 px-3 rounded-xl text-xs bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Nút bấm hành động 1-chạm */}
          <div className="space-y-2 pt-1">
            <Button
              fullWidth
              size="lg"
              disabled={submitting}
              onClick={handleConfirm}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base py-3 cursor-pointer shadow-sm active:scale-[0.99]"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              {submitting ? 'Đang xác nhận...' : '✓ Chủ xe đồng ý nhận đón'}
            </Button>

            <Button fullWidth variant="secondary" onClick={onClose} className="text-xs py-2 text-slate-600">
              Để trả lời sau trên Zalo
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Xác nhận miễn phí 100% · Nhận tiền mặt hoặc chuyển khoản khi đón khách</span>
          </div>
        </div>
      )}
    </Modal>
  );
}
