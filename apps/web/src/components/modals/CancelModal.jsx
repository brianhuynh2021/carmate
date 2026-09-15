import React, { useState } from 'react';
import { AlertTriangle, Sparkles, HeartHandshake, CheckCircle2, Clock, MapPin } from 'lucide-react';
import { resolveDriverRealName, formatVND } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Chip from '../ui/Chip.jsx';
import { Field, Input } from '../ui/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';

const PRESET_CANCEL_REASONS = [
  'Đổi lịch khám / thay đổi kế hoạch',
  'Đã tìm được xe khác',
  'Việc bận đột xuất',
  'Chủ xe chưa phản hồi',
  'Lý do khác'
];

export default function CancelModal({ record, onClose, onConfirmCancel }) {
  const { t } = useI18n();
  const [reason, setReason] = useState(PRESET_CANCEL_REASONS[0]);

  if (!record) return null;

  const hostName = resolveDriverRealName(record.targetItem || record.targetTrip || record, record.contactName || 'Chủ xe');
  const totalCost = record.fullTripAmount || record.totalDeal || record.price || 0;

  const cancelMsg = `Chào ${hostName}, mình xin phép huỷ chỗ trên chuyến CarMate [${record.escrowId}] ${record.from} ➔ ${record.to} do: ${reason}. Rất xin lỗi vì sự bất tiện này! Chúc bạn chuyến đi bình an.`;

  const handleCancelAndNotify = () => {
    onConfirmCancel(record.escrowId, { reason });
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={AlertTriangle}
      iconTone="warning"
      title="Xác nhận hủy chuyến"
      subtitle={`Mã vé #${record.escrowId?.replace(/^#/, '')} · Chủ xe: ${hostName}`}
      footer={
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button variant="outline" onClick={onClose} className="rounded-2xl h-11">
            {t('cancelModal2.s001')}
          </Button>
          <Button
            variant="danger"
            onClick={handleCancelAndNotify}
            className="rounded-2xl h-11 bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            <span>Xác nhận hủy chỗ</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Ngữ cảnh chuyến đi đầy đủ: Chống bấm nhầm (Stanford Ergonomics) */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="type-body-strong font-mono text-slate-800 dark:text-slate-200">
              #{record.escrowId?.replace(/^#/, '')}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400">
              {formatVND(totalCost)} · {record.seats || 1} ghế
            </span>
          </div>

          <div className="type-caption flex items-center gap-2 text-slate-900 dark:text-white">
            <span className="truncate">{record.from}</span>
            <span className="text-slate-400">➔</span>
            <span className="truncate">{record.to}</span>
          </div>

          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-white/5">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#0071e3]" />
              <span className="text-slate-700 dark:text-slate-300">{record.timeSlot || 'Giờ hẹn'}</span>
            </span>
            <span>·</span>
            <span>Chủ xe: <strong className="type-body-strong text-slate-800 dark:text-slate-200">{hostName}</strong></span>
          </div>
        </div>

        {/* Cam kết 0đ phạt & Tự động hoàn trả ghế */}
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 flex items-start gap-3">
          <HeartHandshake className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="type-caption text-amber-900 dark:text-amber-200 space-y-1">
            <p className="type-body-strong">CarMate đồng hành văn minh · 0đ cọc · 0đ phạt hủy</p>
            <p className="type-caption text-amber-800 dark:text-amber-300/90">
              Khi bạn bấm xác nhận hủy, hệ thống sẽ <strong className="type-body-strong">tự động mở lại {record.seats || 1} ghế trống</strong> trên trang chủ ngay lập tức để người khác có thể đặt xe, đồng thời bắn thông báo tự động cho Chủ xe.
            </p>
          </div>
        </div>

        {/* Chọn lý do nhanh 1-chạm (Preset reasons) */}
        <div>
          <label className="type-label text-slate-800 dark:text-slate-200 mb-2 block">
            Chọn lý do hủy chuyến nhanh:
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_CANCEL_REASONS.map((r) => (
              <Chip
                key={r}
                active={reason === r}
                onClick={() => setReason(r)}
                className={`type-button-sm cursor-pointer py-1.5 px-3 rounded-full transition-all ${
                  reason === r
                    ? 'bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {r}
              </Chip>
            ))}
          </div>
        </div>

        {reason === 'Lý do khác' && (
          <Field label="Ghi rõ lý do cụ thể:">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do hủy chuyến của bạn..."
            />
          </Field>
        )}

        {/* Khung xem trước tin nhắn thông báo tự động gửi Chủ xe */}
        <div className="p-3 rounded-2xl bg-slate-900 text-slate-200 border border-slate-800 space-y-1.5 text-left">
          <span className="type-caption text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Tin nhắn tự động gửi đến Chủ xe qua In-app / Zalo / Telegram:</span>
          </span>
          <p className="type-caption text-slate-100 p-2.5 rounded-xl bg-black/40 border border-slate-800 select-all">
            {cancelMsg}
          </p>
        </div>
      </div>
    </Modal>
  );
}

