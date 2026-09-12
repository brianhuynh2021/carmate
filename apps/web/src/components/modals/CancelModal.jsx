import React, { useState } from 'react';
import { AlertTriangle, Sparkles, HeartHandshake } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Chip from '../ui/Chip.jsx';
import { Field, Input } from '../ui/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';

const PRESET_CANCEL_REASONS = [
  'Đối tác không nghe máy / không phản hồi',
  'Việc gia đình đột xuất',
  'Thay đổi lịch trình công tác',
  'Kẹt xe / phương tiện gặp sự cố',
  'Đã tìm được phương án khác'
];

export default function CancelModal({ record, onClose, onConfirmCancel }) {
  const { t } = useI18n();
  const [reason, setReason] = useState(PRESET_CANCEL_REASONS[0]);

  if (!record) return null;

  const cancelMsg = `Chào ${record.contactName || 'bạn'}, mình xin phép huỷ chuyến CarMate [${record.escrowId}] ${record.from} ➔ ${record.to} do: ${reason}. Rất xin lỗi vì sự bất tiện đột xuất này! Chúc bạn chuyến đi bình an.`;

  const handleCancelAndNotify = () => {
    onConfirmCancel(record.escrowId, { reason });
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={AlertTriangle}
      iconTone="warning"
      title={t('cancelModal2.s008')}
      subtitle={`Mã chuyến ${record.escrowId} · Đối tác: ${record.contactName}`}
      footer={
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button variant="outline" onClick={onClose}>
            {t('cancelModal2.s001')}
          </Button>
          <Button variant="danger" onClick={handleCancelAndNotify} className="font-semibold">
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            <span>{t('cancelModal2.s002')}</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="p-3.5 rounded-2xl bg-[#f5f5f7] border border-black/[0.06] text-sm">
          <p className="text-xs text-[#86868b]">{t('cancelModal2.s003')}</p>
          <p className="font-bold text-[#1d1d1f] mt-0.5">
            {record.from} ➔ {record.to}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <HeartHandshake className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong className="font-bold">{t('cancelModal2.s004')}</strong>
            <p className="mt-0.5">
              CarMate <strong>{t('cancelModal2.s005')}</strong> (0đ phạt). Để giữ gìn uy tín cộng đồng, xin
              vui lòng thông báo sớm qua App trước 1-2 tiếng để đối tác kịp thu xếp bạn đồng hành khác.
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-[#1d1d1f] mb-2 block">{t('cancelModal2.s006')}</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_CANCEL_REASONS.map((r) => (
              <Chip key={r} active={reason === r} onClick={() => setReason(r)} className="text-xs cursor-pointer">
                {r}
              </Chip>
            ))}
          </div>
        </div>

        <Field label="Hoặc ghi rõ lý do cụ thể:">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('cancelModal2.s009')} />
        </Field>

        {/* Khung xem trước tin nhắn gửi đối tác */}
        <div className="p-3 rounded-2xl bg-slate-900 text-slate-200 border border-slate-800 space-y-1.5 text-left">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            {t('cancelModal2.s007')}
          </span>
          <p className="text-xs text-slate-100 font-sans leading-relaxed p-2 rounded-xl bg-black/40 border border-slate-800 select-all">
            {cancelMsg}
          </p>
        </div>
      </div>
    </Modal>
  );
}
