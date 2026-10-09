import React, { useState } from 'react';
import { Trash2, AlertTriangle, ShieldCheck, Check, Send } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import api from '../../api/client.js';
import { isAdminUser } from '../../utils/adminGate.js';
import { useI18n } from '../../i18n/index.jsx';

const REASON_PRESETS = [
  'Đổi số điện thoại / Email khác',
  'Không còn nhu cầu đi ghép xe',
  'Ít sử dụng dịch vụ',
  'Lý do cá nhân khác'
];

export default function DeleteAccountModal({ currentUser, onClose, onShowToast }) {
  const { t } = useI18n();
  const [selectedReason, setSelectedReason] = useState(REASON_PRESETS[0]);
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!currentUser) return null;

  const isAdmin =
    currentUser?.role === 'admin' ||
    isAdminUser(currentUser);

  const handleSubmitRequest = async () => {
    if (isAdmin) {
      onShowToast?.('Tài khoản Quản trị viên được bảo vệ an toàn đặc biệt, không thể tự xoá.');
      return;
    }
    if (!confirmed || isDeleting) return;
    setIsDeleting(true);
    try {
      const fullReason = note.trim() ? `${selectedReason}: ${note.trim()}` : selectedReason;
      const res = await api.submitAccountDeletionRequest(fullReason);
      onShowToast?.(
        res.message || 'Yêu cầu xóa tài khoản đã được gửi tới Quản trị viên. Chúng tôi sẽ kiểm tra và xử lý trong 24-48 giờ.'
      );
      onClose?.();
    } catch (err) {
      onShowToast?.(err.message || 'Không thể gửi yêu cầu xóa tài khoản. Vui lòng thử lại sau.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={Trash2}
      iconTone="danger"
      title={t('delAccount.s006')}
      subtitle={t('delAccount.s007')}
      footer={
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            {isAdmin ? 'Đóng' : 'Giữ lại tài khoản'}
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmitRequest}
            disabled={isAdmin || !confirmed || isDeleting}
            className=""
          >
            {isAdmin ? 'Tài khoản được bảo vệ' : isDeleting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu tới Admin'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {isAdmin && (
          <div className="type-caption p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-1 text-left">
            <div className="type-body-strong flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{t('delAccount.s001')}</span>
            </div>
            <p className="type-body">
              Tài khoản này có quyền Quản trị viên tối cao của CarMate. Theo quy chuẩn bảo mật an toàn, tài khoản Admin
              không thể tự xoá vĩnh viễn để tránh làm hệ thống mất chủ quyền vận hành.
            </p>
          </div>
        )}

        {/* Current account info box */}
        <div className="type-caption p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/60 border border-black/[0.06] space-y-1">
          <p className="type-body-strong text-slate-500">{t('delAccount.s002')}</p>
          <p className="type-body-strong text-slate-900 dark:text-white">
            {currentUser.name}{' '}
            {currentUser.phone ? `(${currentUser.phone})` : currentUser.email ? `(${currentUser.email})` : ''}
          </p>
        </div>

        {/* Safe intake process */}
        <div className="type-caption p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-slate-600 dark:text-slate-300">
          <div className="type-body-strong flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-4 h-4 text-[#0071e3] shrink-0" />
            <span>{t('delAccount.s003')}</span>
          </div>
          <p className="type-body">
            Để đảm bảo không có chuyến xe nào đang dang dở, các khoản chia sẻ chi phí hoặc tranh chấp chưa giải quyết,
            Quản trị viên CarMate sẽ tiếp nhận yêu cầu, kiểm tra lịch sử và thực hiện đóng tài khoản vĩnh viễn trong vòng <strong className="type-body-strong">24h - 48h</strong>.
          </p>
        </div>

        {/* Select the reason for closing the account */}
        <div className="space-y-2">
          <label className="type-label block text-slate-700 dark:text-slate-300">
            {t('delAccount.s004')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {REASON_PRESETS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedReason(r)}
                className={`type-button p-2 rounded-xl text-left border transition-all cursor-pointer select-none ${
                  selectedReason === r
                    ? 'bg-[#0071e3]/10 border-[#0071e3] text-[#0071e3] dark:text-[#2997ff]'
                    : 'bg-white dark:bg-slate-900 border-black/[0.08] dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-black/[0.02]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t('delAccount.s008')}
            className="type-input w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.1] text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] resize-none"
          />
        </div>

        {/* Confirmation checkbox */}
        <label className="type-label flex items-start gap-3 p-3 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/40 border border-black/[0.06] cursor-pointer group">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="type-input mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
          />
          <span className="type-caption text-slate-700 dark:text-slate-300 select-none">
            {t('delAccount.s005')}
          </span>
        </label>
      </div>
    </Modal>
  );
}

