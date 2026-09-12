/**
 * =============================================================================
 * DANH BẠ HOTLINE ĐÃ KIỂM CHỨNG (VERIFIED HOTLINE REGISTRY)
 * =============================================================================
 * ĐÂY LÀ FILE DUY NHẤT CẦN SỬA KHI CÓ SỐ MỚI. Không rải số vào code.
 *
 * QUY TẮC BẤT DI BẤT DỊCH:
 *   Chỉ điền số khi ĐÃ TỰ GỌI THỬ và nghe đúng nhà xe bắt máy.
 *   Không chép từ Google, không chép từ ảnh chụp biển quảng cáo ven đường.
 *
 * Vì sao nghiêm ngặt vậy: khách bấm số này đúng lúc hoảng nhất — chủ xe mất
 * liên lạc, còn 20 phút phải ra đường. Gọi mà không ai nghe, hoặc gặp người
 * lạ, thì niềm tin mất vĩnh viễn. Thà không có số còn hơn có số sai.
 *
 * CÁCH THÊM SỐ:
 *   1. Gọi thử số đó, xác nhận đúng nhà xe và đúng tuyến.
 *   2. Điền vào mảng dưới, đặt `verified: true` và ghi `verifiedAt`.
 *   3. Giao diện tự hiện nút gọi. Không cần sửa gì thêm.
 *
 * Khi mảng rỗng (như hiện tại), toàn bộ giao diện tự chuyển sang hiển thị
 * CHỈ DẪN THỰC ĐỊA — khách vẫn bắt được xe, chỉ là tự làm thay vì gọi điện.
 */

export const VERIFIED_HOTLINES = Object.freeze([
  // ─────────────────────────────────────────────────────────────────────
  // CHƯA CÓ SỐ NÀO ĐƯỢC KIỂM CHỨNG.
  //
  // Mẫu để điền (bỏ dấu chú thích và thay bằng số thật đã gọi thử):
  //
  // {
  //   id: 'thanh-cong',
  //   operator: 'Xe khách Thành Công',
  //   corridor: 'Tuyến QL13',
  //   hotline: '02713xxxxxx',
  //   note: 'Đón dọc QL13, gọi trước 15 phút',
  //   verified: true,
  //   verifiedAt: '2026-09-12',
  //   verifiedBy: 'tên người đã gọi kiểm chứng'
  // },
  // ─────────────────────────────────────────────────────────────────────
]);

/** Lấy hotline đã kiểm chứng của một hành lang. */
export function getVerifiedHotlines(corridor = 'Tuyến QL13', limit = 3) {
  return VERIFIED_HOTLINES.filter(
    (h) => h.verified && h.hotline && (!h.corridor || h.corridor === corridor)
  ).slice(0, limit);
}

/** Hành lang này đã có số nào gọi được chưa? */
export function hasAnyVerifiedHotline(corridor = 'Tuyến QL13') {
  return getVerifiedHotlines(corridor).length > 0;
}
