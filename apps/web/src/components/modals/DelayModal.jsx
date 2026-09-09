import React, { useState } from 'react';
import { Timer, Send, Clock, Sparkles } from 'lucide-react';
import { getZaloChatUrl } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Chip from '../ui/Chip.jsx';
import { Field, Input } from '../ui/Field.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';

export default function DelayModal({ record, onClose, onSendDelay }) {
  const [minutes, setMinutes] = useState(15);
  const [note, setNote] = useState('Do kẹt xe / việc bận đột xuất');

  if (!record) return null;

  const targetName = record.contactName || 'bạn';
  const delayMsg = `Chào ${targetName}, mình xin phép báo trễ khoảng ${minutes} phút (${note}). Mình đang di chuyển đến điểm đón sớm nhất có thể! Rất mong bạn thông cảm nhé.`;

  const handleConfirmAndSend = () => {
    onSendDelay(record.escrowId, minutes, note);
    if (record.contactPhone) {
      window.open(getZaloChatUrl(record.contactPhone, delayMsg), '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={Timer}
      iconTone="warning"
      title="Báo trễ giờ hẹn văn minh"
      subtitle={`Gửi thông báo tới ${record.contactName} (${record.escrowId})`}
      footer={
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button className="bg-[#0068ff] hover:bg-[#0055d4] text-white font-bold" onClick={handleConfirmAndSend}>
            <ZaloIcon className="w-4 h-4 mr-1.5" />
            <span>Báo trễ & Nhắn Zalo</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Thời gian dự kiến trễ thêm:</span>
          </p>
          <div className="flex gap-2">
            {[15, 30, 45].map((m) => (
              <Chip
                key={m}
                active={minutes === m}
                onClick={() => setMinutes(m)}
                className="flex-1 justify-center tabular font-bold cursor-pointer"
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
            placeholder="VD: Kẹt xe ngã tư, việc gấp phát sinh..."
          />
        </Field>

        {/* Khung xem trước tin nhắn Zalo gửi đối tác */}
        <div className="p-3 rounded-2xl bg-slate-900 text-slate-200 border border-slate-800 space-y-1.5 text-left">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Tin nhắn tự động soạn gửi qua Zalo:
          </span>
          <p className="text-xs text-slate-100 font-sans leading-relaxed p-2 rounded-xl bg-black/40 border border-slate-800 select-all">
            {delayMsg}
          </p>
        </div>
      </div>
    </Modal>
  );
}
