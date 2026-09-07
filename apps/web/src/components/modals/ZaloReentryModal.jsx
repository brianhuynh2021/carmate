import React, { useState } from 'react';
import { CheckCircle2, Clock, PhoneCall, XCircle, ArrowRight, ShieldCheck, MapPin } from 'lucide-react';
import { formatVND } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';
import api from '../../api/client.js';

/**
 * ZaloReentryModal — Apple-grade Re-entry Action Card
 * Tự động bật lên khi hành khách quay lại tab CarMate sau khi mở app Zalo để nhắn chủ xe.
 * Giải quyết triệt để vấn đề "Gãy luồng trạng thái (State Decoupling)"
 */
export default function ZaloReentryModal({ booking, onClose, onConfirmedSchedule, onCancelBooking, onShowToast }) {
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!booking) return null;

  const driverName = booking.driverName || 'Chủ xe';
  const driverPhone = booking.driverPhone || '';
  const cleanPhone = driverPhone.replace(/\D/g, '');

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('carmate_pending_zalo_booking');
      }
      onConfirmedSchedule?.(booking);
      onShowToast?.(`Đã xác nhận hẹn đón với ${driverName}! Chuyến đi được lưu vào mục Chuyến của tôi.`, 'success');
      onClose();
    } finally {
      setConfirming(false);
    }
  };

  const handleWaiting = () => {
    onShowToast?.(`CarMate đang giữ chỗ trong 15 phút. Bạn có thể kiểm tra Zalo và quay lại sau nhé!`, 'info');
    onClose();
  };

  const handleCall = () => {
    if (cleanPhone) {
      window.location.href = `tel:${cleanPhone}`;
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      if (booking.escrowId) {
        await api.cancelBooking(booking.escrowId, 'Khách tìm chuyến khác do chưa liên hệ được');
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('carmate_pending_zalo_booking');
      }
      onCancelBooking?.(booking.escrowId);
      onShowToast?.('Đã huỷ giữ chỗ. Bạn có thể chọn xe khác trên sàn!', 'info');
      onClose();
    } catch {
      onShowToast?.('Đã huỷ giữ chỗ trên máy của bạn.', 'info');
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('carmate_pending_zalo_booking');
      }
      onClose();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={ZaloIcon}
      iconTone="brand"
      title={`${driverName} đã trả lời Zalo của bạn chưa?`}
      subtitle="Cập nhật nhanh để CarMate hỗ trợ giữ chỗ và sắp xếp chuyến tốt nhất"
    >
      <div className="space-y-4">
        {/* Tóm tắt chuyến đi ngắn gọn */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 text-sm">{driverName}</span>
            <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200/60 font-semibold">
              {booking.timeSlot || 'Trong ngày'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-medium text-slate-800">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{booking.from}</span>
            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{booking.to}</span>
          </div>

          <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200/60 text-[11px]">
            <span>
              Số ghế: <strong className="text-slate-800">{booking.seats || 1}</strong>
            </span>
            {booking.totalDeal > 0 && (
              <span>
                Chi phí: <strong className="text-emerald-700 font-bold">{formatVND(booking.totalDeal)}</strong>
              </span>
            )}
          </div>
        </div>

        {/* 4 Lựa chọn Hành Động Kiểu Apple HIG */}
        <div className="space-y-2.5">
          {/* 1. Đã chốt điểm đón thành công */}
          <button
            type="button"
            disabled={confirming || cancelling}
            onClick={handleConfirm}
            className="w-full p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white flex items-center gap-3 transition-all cursor-pointer shadow-sm text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-snug">✓ Đã hẹn đón thành công</p>
              <p className="text-xs text-emerald-100 leading-tight">Chủ xe đã đồng ý, lưu vào Chuyến của tôi</p>
            </div>
          </button>

          {/* 2. Đang đợi chủ xe phản hồi */}
          <button
            type="button"
            disabled={confirming || cancelling}
            onClick={handleWaiting}
            className="w-full p-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 active:scale-[0.99] text-slate-800 flex items-center gap-3 transition-all cursor-pointer text-left border border-slate-200"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 leading-snug">⏳ Vẫn đang đợi phản hồi</p>
              <p className="text-xs text-slate-500 leading-tight">CarMate tiếp tục giữ chỗ cho bạn trong 15 phút</p>
            </div>
          </button>

          {/* 3. Gọi điện thoại trực tiếp */}
          {cleanPhone && (
            <button
              type="button"
              disabled={confirming || cancelling}
              onClick={handleCall}
              className="w-full p-3.5 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-800 flex items-center gap-3 transition-all cursor-pointer text-left border border-slate-200"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 leading-snug">📞 Chủ xe chưa rep? Gọi trực tiếp</p>
                <p className="text-xs text-slate-500 leading-tight">Bấm để gọi SĐT {driverPhone} ngay</p>
              </div>
            </button>
          )}

          {/* 4. Đổi xe khác / Huỷ giữ chỗ */}
          <button
            type="button"
            disabled={confirming || cancelling}
            onClick={handleCancel}
            className="w-full p-3 rounded-xl hover:bg-rose-50 text-rose-600 active:scale-[0.99] flex items-center justify-center gap-2 transition-all cursor-pointer text-xs font-semibold"
          >
            <XCircle className="w-4 h-4" />
            <span>{cancelling ? 'Đang nhả chỗ...' : 'Chủ xe từ chối / Tôi muốn đổi xe khác'}</span>
          </button>
        </div>

        {/* Cam kết minh bạch */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 justify-center pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>CarMate kết nối trực tiếp · Không giam tiền · 0% phí sàn</span>
        </div>
      </div>
    </Modal>
  );
}
