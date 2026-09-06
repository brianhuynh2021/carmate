import React, { useState } from 'react';
import { Trash2, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import api from '../../api/client.js';

export default function DeleteAccountModal({ currentUser, onClose, onDeleted, onShowToast }) {
  const [confirmed, setConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!currentUser) return null;

  const handleDelete = async () => {
    if (!confirmed || isDeleting) return;
    setIsDeleting(true);
    try {
      await api.deleteAccount();
      onShowToast?.('Đã xóa vĩnh viễn tài khoản và thanh tẩy toàn bộ dữ liệu cá nhân thành công.');
      onDeleted?.();
      onClose();
    } catch (err) {
      onShowToast?.(err.message || 'Không thể xóa tài khoản. Vui lòng thử lại sau.');
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
      title="Xóa vĩnh viễn tài khoản"
      subtitle="Tuân thủ Apple App Store Review & Nghị định 13/2023/NĐ-CP"
      footer={
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Giữ lại tài khoản
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={!confirmed || isDeleting}
            className="font-semibold"
          >
            {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Hộp thông tin tài khoản hiện tại */}
        <div className="p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/60 border border-black/[0.06] text-xs space-y-1">
          <p className="text-slate-500 font-medium">Tài khoản chuẩn bị xóa:</p>
          <p className="font-extrabold text-slate-900 dark:text-white text-sm">
            {currentUser.name} {currentUser.phone ? `(${currentUser.phone})` : currentUser.email ? `(${currentUser.email})` : ''}
          </p>
        </div>

        {/* Danh sách cam kết thanh tẩy dữ liệu */}
        <div className="p-4 rounded-2xl bg-red-500/[0.06] border border-red-500/20 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Hành động này sẽ thực hiện ngay lập tức:</span>
          </div>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-2 pl-1">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5"></span>
              <span><strong>Xóa vĩnh viễn</strong> số điện thoại, email và hồ sơ thành viên khỏi cơ sở dữ liệu.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5"></span>
              <span><strong>Hủy ngay lập tức</strong> tất cả các chuyến xe do bạn đăng đang hoạt động trên sàn.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5"></span>
              <span><strong>Ẩn danh hóa (Anonymize)</strong> lịch sử kết nối cũ để không làm gián đoạn người đi cùng.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5"></span>
              <span><strong>Đăng xuất và hủy mã Token</strong> trên tất cả các thiết bị. Không thể khôi phục lại.</span>
            </li>
          </ul>
        </div>

        {/* Checkbox xác nhận chủ động của người dùng */}
        <label className="flex items-start gap-3 p-3 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/40 border border-black/[0.06] cursor-pointer group">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
          />
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed select-none">
            Tôi hiểu rằng toàn bộ thông tin cá nhân và bài đăng của tôi sẽ bị xóa vĩnh viễn và không thể khôi phục lại.
          </span>
        </label>
      </div>
    </Modal>
  );
}
