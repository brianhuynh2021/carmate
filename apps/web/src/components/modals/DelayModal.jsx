import React, { useState } from 'react';
import { Timer, Send } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Chip from '../ui/Chip.jsx';
import { Field, Input } from '../ui/Field.jsx';

export default function DelayModal({ record, onClose, onSendDelay }) {
  const { t } = useI18n();
  const [minutes, setMinutes] = useState(15);
  const [note, setNote] = useState(t('delayModal.defaultNote'));

  if (!record) return null;

  return (
    <Modal
      onClose={onClose}
      size="sm"
      icon={Timer}
      iconTone="warning"
      title={t('delayModal.title')}
      subtitle={t('delayModal.sendTo', { name: record.contactName })}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onClose}>{t('common.close')}</Button>
          <Button icon={Send} onClick={() => onSendDelay(record.escrowId, minutes, note)}>{t('delayModal.send')}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-2">{t('delayModal.expected')}</p>
          <div className="flex gap-2">
            {[15, 30, 45].map((m) => (
              <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)} className="flex-1 justify-center tabular">
                {t('delayModal.minutes', { n: m })}
              </Chip>
            ))}
          </div>
        </div>
        <Field label={t('delayModal.message')}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
