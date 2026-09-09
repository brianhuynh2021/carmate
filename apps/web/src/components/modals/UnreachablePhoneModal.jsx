import React, { useState } from 'react';
import { PhoneOff, ShieldAlert, AlertTriangle, Phone, CheckCircle2, Info } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Field, Input } from '../ui/Field.jsx';

const UNREACHABLE_OPTIONS = [
  {
    id: 'fake_number',
    label: 'Số không có thực / Thuê bao không tồn tại',
    desc: 'Tổng đài báo số máy không đúng hoặc chưa từng được kích hoạt trên mạng viễn thông.'
  },
  {
    id: 'unreachable',
    label: 'Thuê bao tắt máy / Ngoài vùng phủ sóng liên tục',
    desc: 'Đã cố gắng gọi nhiều lần vào các thời điểm khác nhau nhưng không thể liên lạc được.'
  },
  {
    id: 'rejected',
    label: 'Nhầm số / Người lạ nghe máy / Bị chửi bới',
    desc: 'Người nghe máy là người khác, không phải người đặt chuyến hoặc báo không có nhu cầu đi.'
  },
  {
    id: 'no_answer',
    label: 'Đổ chuông nhưng cố tình không nhấc máy',
    desc: 'Đã gọi từ 3 cuộc trở lên gần giờ hẹn nhưng đối tác hoàn toàn không nghe máy hay gọi lại.'
  }
];

export default function UnreachablePhoneModal({ record, onClose, onSubmitReport }) {
  const [reason, setReason] = useState('fake_number');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!record) return null;

  const targetName = record.contactName || record.driverName || record.passengerName || 'Đối tác chuyến đi';
  const targetPhone =
    record.phoneReal ||
    record.contactPhone ||
    record.driverPhone ||
    record.passengerPhone ||
    'Không rõ';

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      await onSubmitReport?.({
        bookingId: record.escrowId || record.id,
        reason,
        note: note.trim()
      });
      onClose();
    } catch (err) {
      console.error('Lỗi gửi báo cáo số ảo / không liên lạc được:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={PhoneOff}
      iconTone="danger"
      title="Báo cáo số ảo / Không liên lạc được"
      subtitle={`Phản ánh sự cố liên lạc với ${targetName} (${record.escrowId || record.id})`}
      footer={
        <div className="flex flex-col-reverse sm:grid sm:grid-cols-2 gap-2.5 sm:gap-3 w-full">
          <Button variant="outline" onClick={onClose} disabled={submitting} className="w-full">
            Quay lại
          </Button>
          <Button
            className="bg-[#d70015] hover:bg-[#b50011] text-white font-bold w-full"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Đang gửi...' : 'Xác nhận báo cáo & Huỷ'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Lưu ý thời gian phản hồi (Grace Period MIT & Stanford) */}
        <div className="p-3 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/50 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <Info className="w-4 h-4 text-[#0071e3] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Lưu ý trước khi báo cáo sự cố:</p>
            <p className="opacity-90 text-[11.5px] mt-0.5">
              Sau khi chốt chuyến, đối tác có thể đang lái xe hoặc bận việc. Bạn hãy ưu tiên nhắn tin Zalo/SMS hoặc chờ ít nhất 15 phút trước khi báo cáo để đảm bảo quyền lợi công bằng cho cả hai bên.
            </p>
          </div>
        </div>

        {/* Thẻ đối tác bị phản ánh */}
        <div className="p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/60 border border-black/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Đối tác bị phản ánh:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{targetName}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-black/[0.04] dark:border-white/[0.05]">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Số điện thoại:</span>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{targetPhone}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-black/[0.04] dark:border-white/[0.05]">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Lộ trình:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
              {record.from} ➔ {record.to}
            </span>
          </div>
        </div>

        {/* Danh sách lý do */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Chọn vấn đề bạn gặp phải:
          </label>
          <div className="grid grid-cols-1 gap-2">
            {UNREACHABLE_OPTIONS.map((opt) => {
              const isSelected = reason === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setReason(opt.id)}
                  className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'border-rose-600 bg-rose-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">{opt.label}</p>
                      <p className="text-[11px] opacity-75 mt-0.5 leading-snug">{opt.desc}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ghi chú thêm */}
        <Field label="Ghi chú chi tiết (Tùy chọn)" hint="Mô tả cụ thể số lần gọi hoặc phản hồi từ tổng đài">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: Đã gọi 3 cuộc lúc 07:15 và 07:30 tổng đài báo thuê bao không tồn tại..."
          />
        </Field>

        {/* Chế tài bảo vệ & trừng phạt */}
        <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Chế tài bảo vệ & công bằng:</p>
            <p className="opacity-90 leading-relaxed text-[11.5px]">
              • Đối tác vi phạm sẽ bị <b>trừ 30 điểm tín nhiệm</b> và <b>khóa tài khoản vĩnh viễn</b> nếu tái phạm.<br />
              • Chuyến đi này sẽ được <b>huỷ an toàn ngay lập tức</b>, điểm uy tín của bạn được giữ nguyên 100%.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
