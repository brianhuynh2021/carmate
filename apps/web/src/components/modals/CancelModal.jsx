import React, { useState } from 'react';
import { AlertTriangle, MessageCircle, HeartHandshake } from 'lucide-react';
import { getZaloChatUrl } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Field, Input } from '../ui/Field.jsx';

export default function CancelModal({ record, onClose, onConfirmCancel }) {
  const { t } = useI18n();
  const [reason, setReason] = useState('Thay đổi lịch trình đột xuất');

  if (!record) return null;

  const handleCancelAndNotify = () => {
    onConfirmCancel(record.escrowId, { reason });
    // Mở Zalo để báo cho đối tác
    if (record.contactPhone) {
      const cancelMsg = `Chào bạn, mình xin phép huỷ chuyến CarMate [${record.escrowId}] ${record.from} ➔ ${record.to} do: ${reason}. Rất xin lỗi vì sự bất tiện này!`;
      window.open(getZaloChatUrl(record.contactPhone, cancelMsg), '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={AlertTriangle}
      iconTone="warning"
      title="Huỷ chuyến đi"
      subtitle={`Mã chuyến ${record.escrowId} · ${record.contactName}`}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onClose}>Quay lại</Button>
          <Button variant="danger" onClick={handleCancelAndNotify}>Xác nhận huỷ</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Lộ trình</p>
          <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{record.from} → {record.to}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-3">
          <HeartHandshake className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong className="font-semibold">Văn hoá đi chung xe văn minh:</strong>
            <p className="mt-0.5">
              CarMate không thu tiền cọc và không phạt tiền. Tuy nhiên nếu đổi lịch, vui lòng thông báo sớm qua Zalo cho đối tác (SĐT: {record.contactPhone}) để họ chủ động sắp xếp xe khác.
            </p>
          </div>
        </div>

        <Field label="Lý do huỷ chuyến">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nhập lý do thay đổi..." />
        </Field>
      </div>
    </Modal>
  );
}
