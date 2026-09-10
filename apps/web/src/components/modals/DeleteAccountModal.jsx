import React, { useState } from 'react';
import { Trash2, AlertTriangle, ShieldCheck, Check, Send } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import api from '../../api/client.js';

const REASON_PRESETS = [
  'Đổi số điện thoại / Email khác',
  'Không còn nhu cầu đi ghép xe',
  'Ít sử dụng dịch vụ',
  'Lý do cá nhân khác'
];

export default function DeleteAccountModal({ currentUser, onClose, onDeleted, onShowToast }) {
  const [selectedReason, setSelectedReason] = useState(REASON_PRESETS[0]);
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!currentUser) return null;

  const isAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.phone?.includes('0984883750') ||
    currentUser?.phone?.includes('0984 883 750');

  const handleSubmitRequest = async () => {
    if (isAdmin) {
      onShowToast?.('Tài khoản Quản trị viên được bảo vệ bởi luật bất biến MIT, không thể tự xoá hoặc yêu cầu xoá.');
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
      title="Yêu cầu xóa tài khoản"
      subtitle="Yêu cầu sẽ được gửi tới Quản trị viên CarMate để đối soát chuyến xe và xử lý."
      footer={
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            {isAdmin ? 'Đóng' : 'Giữ lại tài khoản'}
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmitRequest}
            disabled={isAdmin || !confirmed || isDeleting}
            className="font-semibold"
          >
            {isAdmin ? 'Tài khoản được bảo vệ' : isDeleting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu tới Admin'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {isAdmin && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1 text-left">
            <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Bảo vệ bất biến MIT: Tài khoản Quản trị viên</span>
            </div>
            <p className="leading-relaxed">
              Tài khoản này có quyền Quản trị viên tối cao của CarMate. Theo luật bất biến hệ thống MIT, tài khoản Admin
              không thể tự xoá vĩnh viễn để tránh làm hệ thống mất chủ quyền vận hành.
            </p>
          </div>
        )}

        {/* Hộp thông tin tài khoản hiện tại */}
        <div className="p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/60 border border-black/[0.06] text-xs space-y-1">
          <p className="text-slate-500 font-medium">Tài khoản chuẩn bị gửi yêu cầu xóa:</p>
          <p className="font-extrabold text-slate-900 dark:text-white text-sm">
            {currentUser.name}{' '}
            {currentUser.phone ? `(${currentUser.phone})` : currentUser.email ? `(${currentUser.email})` : ''}
          </p>
        </div>

        {/* Quy trình tiếp nhận an toàn */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-4 h-4 text-[#0071e3] shrink-0" />
            <span>Chuẩn mực đối soát an toàn CarMate:</span>
          </div>
          <p>
            Để đảm bảo không có chuyến xe nào đang dang dở, các khoản chia sẻ chi phí hoặc tranh chấp chưa giải quyết,
            Quản trị viên CarMate sẽ tiếp nhận yêu cầu, kiểm tra lịch sử và thực hiện đóng tài khoản vĩnh viễn trong vòng <strong>24h - 48h</strong>.
          </p>
        </div>

        {/* Chọn lý do muốn đóng tài khoản */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Lý do đóng tài khoản:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {REASON_PRESETS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedReason(r)}
                className={`p-2 rounded-xl text-xs text-left font-medium border transition-all cursor-pointer select-none ${
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
            placeholder="Ghi chú thêm hoặc đóng góp ý kiến (tùy chọn)..."
            className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.1] text-xs text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] resize-none"
          />
        </div>

        {/* Checkbox xác nhận */}
        <label className="flex items-start gap-3 p-3 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/40 border border-black/[0.06] cursor-pointer group">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
          />
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed select-none">
            Tôi xác nhận muốn gửi yêu cầu hủy và xóa tài khoản CarMate này tới Quản trị viên.
          </span>
        </label>
      </div>
    </Modal>
  );
}

