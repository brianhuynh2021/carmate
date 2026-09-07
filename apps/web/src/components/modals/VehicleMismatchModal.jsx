import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Car, Users, CheckCircle2, FileText, Info } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Field, Input } from '../ui/Field.jsx';

const MISMATCH_OPTIONS = [
  {
    id: 'yellow_plate',
    label: 'Xe biển vàng (Dịch vụ)',
    desc: 'Tài xế đăng ký xe gia đình biển trắng nhưng thực tế đón bằng xe dịch vụ kinh doanh biển vàng.'
  },
  {
    id: 'overcrowded',
    label: 'Nhồi nhét khách / Ghép xe',
    desc: 'Xe nhồi nhét quá số lượng ghế, chở quá tải hoặc bắt khách sang xe khác giữa đường.'
  },
  {
    id: 'different_car',
    label: 'Khác mẫu xe / Biển số',
    desc: 'Mẫu xe hoặc biển số xe thực tế đến đón khác hoàn toàn so với thông tin trên CarMate.'
  },
  {
    id: 'other',
    label: 'Sai lệch loại xe khác',
    desc: 'Các vấn đề phát sinh khác liên quan đến phương tiện đón khách.'
  }
];

export default function VehicleMismatchModal({ record, onClose, onSubmitReport }) {
  const [mismatchType, setMismatchType] = useState('yellow_plate');
  const [actualPlate, setActualPlate] = useState('');
  const [passengerNote, setPassengerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!record) return null;

  const targetName = record.contactName || record.driverName || 'Bác tài';
  const declaredLabel =
    record.carCategory === 'convenient_trip'
      ? '⚡ Xe tiện chuyến (Biển vàng)'
      : '🚗 Xe gia đình (Biển trắng)';

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      await onSubmitReport?.({
        bookingId: record.escrowId || record.id,
        mismatchType,
        actualPlate: actualPlate.trim().toUpperCase(),
        passengerNote: passengerNote.trim()
      });
      onClose();
    } catch (err) {
      console.error('Lỗi gửi báo cáo sai lệch xe:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={ShieldAlert}
      iconTone="danger"
      title="Báo cáo sai lệch loại xe"
      subtitle={`Phản ánh chuyến đi với ${targetName} (${record.escrowId || record.id})`}
      footer={
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Đóng
          </Button>
          <Button
            className="bg-[#d70015] hover:bg-[#b50011] text-white font-bold"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Đang gửi...' : 'Gửi báo cáo sự cố'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Thẻ thông tin chuyến xe & khai báo ban đầu */}
        <div className="p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/60 border border-black/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Khai báo trên CarMate:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{declaredLabel}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-black/[0.04] dark:border-white/[0.05]">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Lộ trình:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
              {record.from} ➔ {record.to}
            </span>
          </div>
        </div>

        {/* Chọn lý do sai lệch */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
            Vấn đề thực tế xe đón bạn gặp phải: <span className="text-rose-500">*</span>
          </label>
          <div className="space-y-2">
            {MISMATCH_OPTIONS.map((opt) => {
              const isSelected = mismatchType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMismatchType(opt.id)}
                  className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500/20 shadow-2xs'
                      : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#151c2e] text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{opt.label}</span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                        isSelected
                          ? 'border-rose-600 bg-rose-600 text-white'
                          : 'border-slate-300 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nhập biển số thực tế đón (tùy chọn) */}
        <Field
          label="Biển số xe thực tế đón bạn (nếu có)"
          optional="Không bắt buộc"
          hint="VD: 51G-889.99 hoặc 93A-289.45"
        >
          <Input
            value={actualPlate}
            onChange={(e) => setActualPlate(e.target.value)}
            placeholder="VD: 51G-889.99"
            className="font-mono uppercase font-bold"
          />
        </Field>

        {/* Ghi chú chi tiết */}
        <Field
          label="Chi tiết phản ánh của bạn"
          optional="Khuyên dùng"
          hint="Mô tả cụ thể sự việc để Ban Quản Trị đối soát với Bác tài"
        >
          <textarea
            rows={3}
            value={passengerNote}
            onChange={(e) => setPassengerNote(e.target.value)}
            placeholder="VD: Xe biển vàng dán chữ dịch vụ, trên xe có sẵn khách lạ khác, bắt trả thêm tiền hoặc đổi sang xe khác..."
            className="w-full p-3 rounded-2xl border text-xs text-slate-900 dark:text-white bg-white dark:bg-[#151c2e] border-slate-200/90 dark:border-white/[0.08] focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15 outline-none transition-all"
          />
        </Field>

        {/* Cam kết an toàn & bảo vệ quyền lợi */}
        <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 text-xs">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11.5px]">
            <b>CarMate cam kết bảo mật tuyệt đối:</b> Báo cáo này sẽ được chuyển thẳng đến điện thoại của Ban Quản Trị qua Telegram để can thiệp và đổi loại xe hoặc khóa tài xế vi phạm.
          </p>
        </div>
      </div>
    </Modal>
  );
}
