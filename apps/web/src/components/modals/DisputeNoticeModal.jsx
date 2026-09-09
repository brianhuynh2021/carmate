import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  MessageSquare,
  Sparkles,
  X,
  Send,
  Ban
} from 'lucide-react';
import api from '../../api/client.js';

const PRESET_DISPUTE_REASONS = [
  '📍 Gõ nhầm số nhà / địa chỉ đón trả',
  '🔢 Gõ nhầm biển số xe hoặc mã chuyến',
  '🛡️ Khóa nhầm / Hệ thống hiểu sai ngữ cảnh',
  '🤝 Hai bên đã chốt miệng nhưng chưa kịp bấm nút',
  '❓ Lý do khác (nhập bên dưới)'
];

export default function DisputeNoticeModal({
  isOpen,
  onClose,
  booking,
  violationNotice,
  onResolved,
  onOpenSupportChat,
  onShowToast
}) {
  const [selectedReason, setSelectedReason] = useState(PRESET_DISPUTE_REASONS[0]);
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !booking) return null;

  const bId = booking.escrowId || booking.id;
  const strike = violationNotice?.strike || 1;
  const sample = violationNotice?.detectedSample || '';

  const handleSubmitDispute = async (e) => {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const cleanReason = selectedReason.replace(/^[^\s]+\s/, ''); // Bỏ emoji đầu
      const res = await api.disputeBooking(bId, {
        reason: cleanReason,
        note: customNote.trim(),
        reporterRole: 'user'
      });

      if (res?.success) {
        onShowToast?.('✓ Khiếu nại đã được chấp thuận. Tài khoản đã được khôi phục quyền hoạt động!', 'success');
        onResolved?.(res.data?.booking);
        onClose?.();
      } else {
        onShowToast?.(res?.error || 'Có lỗi khi gửi khiếu nại', 'error');
      }
    } catch (err) {
      onShowToast?.(err.message || 'Không thể gửi khiếu nại', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 shadow-2xl p-6 text-slate-800 dark:text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề & Biểu tượng */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            {strike >= 3 ? <Ban className="w-6 h-6 text-rose-600" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Khiếu nại & Kháng nghị Cảnh báo</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
                Cấp {strike}/3
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Giải trình nhanh nếu bạn gõ nhầm số nhà, biển số xe hoặc hệ thống AI hiểu sai ngữ cảnh.
            </p>
          </div>
        </div>

        {/* Thẻ ngữ cảnh vi phạm */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] mb-4 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Mã chuyến liên quan:</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">#{bId}</span>
          </div>
          {sample && (
            <div className="pt-1">
              <span className="text-[11px] text-slate-500">Nội dung hệ thống đã bắt lỗi:</span>
              <div className="mt-1 px-3 py-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 font-mono text-amber-900 dark:text-amber-200 text-xs break-all">
                "{sample}"
              </div>
            </div>
          )}
        </div>

        {/* Lựa chọn lý do 1-chạm */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            Chọn lý do giải trình (1-chạm):
          </label>
          <div className="space-y-1.5">
            {PRESET_DISPUTE_REASONS.map((reason) => {
              const isSelected = selectedReason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer border flex items-center justify-between ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 text-primary-700 dark:text-primary-300 font-bold'
                      : 'bg-white dark:bg-white/[0.02] border-black/[0.08] dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span>{reason}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-primary-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ghi chú giải trình bổ sung */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Ghi chú thêm cho CSKH CarMate (tùy chọn):
          </label>
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Ví dụ: Em gõ số nhà 09 đường Nguyễn Huệ..."
            className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-primary-500 focus:bg-white text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-hidden transition-all"
          />
        </div>

        {/* Hàng nút hành động */}
        <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => {
              onClose?.();
              onOpenSupportChat?.();
            }}
            className="px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-primary-500" />
            <span>Chat với CSKH 24/7</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Bỏ qua
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitDispute}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{submitting ? 'Đang xử lý...' : 'Kháng nghị & Mở khóa ngay'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
