/**
 * Danh tính Quản trị viên hệ thống (System Admin Identity)
 *
 * Số điện thoại admin được dùng làm "MIT Invariant Guard": tài khoản admin không thể
 * tự xoá để hệ thống luôn có chủ quản. Trước đây số này bị hardcode trực tiếp trong
 * mã nguồn (lộ trên repo); nay đọc từ biến môi trường ADMIN_PHONE để giấu khỏi source.
 *
 * Fallback về số vận hành hiện tại nếu chưa cấu hình env — giữ nguyên hành vi bảo vệ
 * cho các môi trường chưa kịp set biến, tránh vô tình mở khoá xoá tài khoản admin.
 */

// Có thể khai báo nhiều số, phân tách bằng dấu phẩy (ví dụ số cũ + số mới khi chuyển giao).
const RAW_ADMIN_PHONES = process.env.ADMIN_PHONE || process.env.CARMATE_ADMIN_PHONE || '0984883750';

function normalize(p) {
  return String(p || '').replace(/[^0-9]/g, '');
}

const ADMIN_PHONE_SET = new Set(
  RAW_ADMIN_PHONES.split(',')
    .map((s) => normalize(s))
    .filter(Boolean)
);

/**
 * Kiểm tra một số điện thoại (ở bất kỳ định dạng nào) có phải là admin hệ thống không.
 */
export function isAdminPhone(phone) {
  const cleaned = normalize(phone);
  if (!cleaned) return false;
  return ADMIN_PHONE_SET.has(cleaned);
}

/**
 * Số điện thoại admin chính (số đầu tiên) — dùng làm fallback liên hệ nội bộ.
 */
export function getPrimaryAdminPhone() {
  return [...ADMIN_PHONE_SET][0] || '';
}
