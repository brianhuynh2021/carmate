/**
 * adminGate.js — NHẬN DIỆN QUẢN TRỊ VIÊN Ở PHÍA GIAO DIỆN
 *
 * Số điện thoại admin trước đây bị viết cứng RẢI RÁC trong 4 component
 * (Header, UserProfileModal, DeleteAccountModal...) dưới dạng
 * `currentUser.phone?.includes('0984...')`. Hai vấn đề:
 *   1. Muốn đổi/chuyển giao admin phải đi sửa từng chỗ, sót một chỗ là lệch.
 *   2. Số cá nhân nằm rải trong bundle công khai.
 *
 * Nay gom về MỘT nơi và ưu tiên vai trò do MÁY CHỦ cấp (`role`), vì đó mới là
 * nguồn sự thật. Số điện thoại chỉ là lối dự phòng cho môi trường phát triển,
 * và đọc từ biến môi trường VITE_ADMIN_PHONE.
 *
 * LƯU Ý BẢO MẬT: hàm này CHỈ quyết định hiện hay ẩn nút trên giao diện.
 * Mọi endpoint quản trị đều được máy chủ chặn bằng JWT ký (requireAdmin),
 * nên sửa biến ở trình duyệt không cấp thêm quyền gì.
 */

const ENV_ADMIN_PHONES = (import.meta.env?.VITE_ADMIN_PHONE || '')
  .split(',')
  .map((s) => String(s).replace(/\D/g, ''))
  .filter(Boolean);

export function isAdminUser(currentUser) {
  if (!currentUser) return false;

  // 1. Vai trò do máy chủ cấp — nguồn sự thật
  if (currentUser.role === 'admin' || currentUser.role === 'super_admin') return true;

  // 2. Dự phòng theo số điện thoại (chỉ khi đã cấu hình VITE_ADMIN_PHONE)
  if (ENV_ADMIN_PHONES.length === 0) return false;
  const phone = String(currentUser.phone || '').replace(/\D/g, '');
  return Boolean(phone) && ENV_ADMIN_PHONES.includes(phone);
}
