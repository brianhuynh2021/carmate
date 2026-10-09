import React, { useState } from 'react';
import { Timer, Clock, Sparkles } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Chip from '../ui/Chip.jsx';
import { Field, Input } from '../ui/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';

export default function DelayModal({ record, onClose, onSendDelay }) {
  const { t } = useI18n();
  const [minutes, setMinutes] = useState(15);
  const [note, setNote] = useState('Do kẹt xe / việc bận đột xuất');

  if (!record) return null;

  const targetName = record.contactName || 'bạn';
  const delayMsg = `Chào ${targetName}, mình xin phép báo trễ khoảng ${minutes} phút (${note}). Mình đang di chuyển đến điểm đón sớm nhất có thể! Rất mong bạn thông cảm nhé.`;

  const handleConfirmAndSend = () => {
    onSendDelay(record.escrowId, minutes, note);
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={Timer}
      iconTone="warning"
      title={t('delayModal2.s004')}
      subtitle={`Gửi thông báo tới ${record.contactName} (${record.escrowId})`}
      footer={
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button variant="outline" onClick={onClose}>
            {t('delayModal2.s001')}
          </Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleConfirmAndSend}>
            <Timer className="w-4 h-4 mr-1.5" />
            <span>Xác nhận báo trễ +{minutes}p</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="type-caption text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('delayModal2.s002')}</span>
          </p>
          <div className="flex gap-2">
            {[15, 30, 45].map((m) => (
              <Chip
                key={m}
                active={minutes === m}
                onClick={() => setMinutes(m)}
                className="type-button-sm flex-1 justify-center tabular cursor-pointer"
              >
                +{m} phút
              </Chip>
            ))}
          </div>
        </div>

        <Field label="Lý do báo trễ:">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('delayModal2.s005')}
          />
        </Field>

        {/* Preview frame of the Zalo message sent to the partner */}
        <div className="p-3 rounded-2xl bg-slate-900 text-slate-200 border border-slate-800 space-y-1.5 text-left">
          <span className="type-caption text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            {t('delayModal2.s003')}
          </span>
          <p className="type-caption text-slate-100 p-2 rounded-xl bg-black/40 border border-slate-800 select-all">
            {delayMsg}
          </p>
        </div>
      </div>
    </Modal>
  );
}
