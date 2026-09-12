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
  {
    id: 'hoang-yen',
    operator: 'Hoàng Yến Limousine (9 chỗ VIP)',
    shortName: 'Hoàng Yến Limousine',
    corridor: 'Tuyến QL13',
    hotline: '02713 588 588',
    altHotline: '0984 766 766',
    type: 'airport_limousine',
    frequency: '60 phút/chuyến (03:30 - 19:30)',
    priceRef: '200.000đ - 260.000đ',
    coverage: 'Bù Đốp ⇄ Lộc Hiệp ⇄ Lộc Ninh ⇄ Bình Long ⇄ VP 220 QL13 ⇄ Sân bay TSN',
    note: 'Đón trả tận sảnh Ga Quốc Nội TSN & VP 220 QL13 (Bình Thạnh)',
    fareTable: [
      { route: 'Bù Đốp / Lộc Hiệp ➔ Sân bay TSN', price: '260.000 đ' },
      { route: 'Bù Đốp / Lộc Hiệp ➔ VP 220 QL13 (Bình Thạnh)', price: '240.000 đ' },
      { route: 'Lộc Ninh / Bình Long ➔ Sân bay TSN', price: '220.000 đ' },
      { route: 'Lộc Ninh / Bình Long ➔ VP 220 QL13', price: '200.000 đ' }
    ],
    verified: true,
    verifiedAt: '2026-09-12',
    verifiedBy: 'CarMate Transit Team'
  },
  {
    id: 'petro-binh-phuoc',
    operator: 'Petro Bình Phước (Limousine VIP)',
    shortName: 'Petro Bình Phước',
    corridor: 'Tuyến QL13',
    hotline: '02713 555 555',
    altHotline: '0911 400 400',
    type: 'airport_limousine',
    frequency: '60 phút/chuyến (04:00 - 20:00)',
    priceRef: '200.000đ - 260.000đ',
    coverage: 'Bù Đốp / Bù Đăng ⇄ Lộc Ninh ⇄ Bình Long ⇄ Chơn Thành ⇄ Sài Gòn / Sân bay TSN',
    note: 'Đưa đón tận cổng Sân bay Tân Sơn Nhất & BV lớn TP.HCM',
    fareTable: [
      { route: 'Tuyến Sân bay Tân Sơn Nhất', price: '260.000 đ' },
      { route: 'Bù Đốp / Bù Đăng ➔ Sài Gòn', price: '240.000 đ – 260.000 đ' },
      { route: 'Lộc Ninh / Bình Long ➔ Sài Gòn', price: '200.000 đ – 220.000 đ' }
    ],
    verified: true,
    verifiedAt: '2026-09-12',
    verifiedBy: 'CarMate Transit Team'
  },
  {
    id: 'trung-ken',
    operator: 'Trung Kén (Limousine / Giường nằm)',
    shortName: 'Trung Kén',
    corridor: 'Tuyến QL13',
    hotline: '0913 134 509',
    altHotline: '02713 567 567',
    type: 'limousine',
    frequency: 'Nhiều chuyến/ngày',
    priceRef: '220.000đ - 240.000đ',
    coverage: 'Bến xe Bù Đốp ⇄ Lộc Ninh ⇄ Bến Cát ⇄ Lái Thiêu ⇄ Sài Gòn (BX Miền Đông)',
    note: 'Limousine và xe giường nằm chất lượng cao',
    fareTable: [
      { route: 'Bến xe Bù Đốp ➔ Sài Gòn', price: '220.000 đ – 240.000 đ' }
    ],
    verified: true,
    verifiedAt: '2026-09-12',
    verifiedBy: 'CarMate Transit Team'
  },
  {
    id: 'huy-hieu',
    operator: 'Huy Hiếu (Limousine / Ghế ngả VIP)',
    shortName: 'Huy Hiếu Limousine',
    corridor: 'Tuyến QL13',
    hotline: '0977 788 788',
    altHotline: '02713 777 999',
    type: 'airport_limousine',
    frequency: '60 phút/chuyến',
    priceRef: '200.000đ - 220.000đ',
    coverage: 'Lộc Ninh ⇄ Bình Long ⇄ Chơn Thành ⇄ Ga Quốc Nội TSN / Sài Gòn',
    note: 'Đưa đón Ga Quốc Nội Tân Sơn Nhất và nội thành TP.HCM',
    fareTable: [
      { route: 'Lộc Ninh / Bình Long ➔ Ga Quốc Nội TSN / Sài Gòn', price: '200.000 đ – 220.000 đ' }
    ],
    verified: true,
    verifiedAt: '2026-09-12',
    verifiedBy: 'CarMate Transit Team'
  },
  {
    id: 'thanh-cong',
    operator: 'Xe khách & Limousine Thành Công',
    shortName: 'Thành Công',
    corridor: 'Tuyến QL13',
    hotline: '1900 6952',
    altHotline: '02713 888 888',
    type: 'limousine',
    frequency: '30 phút/chuyến (03:00 - 20:30)',
    priceRef: '140.000đ - 180.000đ',
    coverage: 'BX Miền Đông ⇄ Lái Thiêu ⇄ Thủ Dầu Một ⇄ Bến Cát ⇄ Chơn Thành ⇄ Đồng Xoài',
    note: 'Đón dọc QL13 (Cây xăng Petrolimex Lái Thiêu, Cầu Ông Bố, Aeon Mall)',
    fareTable: [
      { route: 'Đồng Xoài ➔ Sân bay Tân Sơn Nhất / BX Miền Đông', price: '160.000 đ - 180.000 đ' },
      { route: 'Chơn Thành / Bến Cát ➔ Sài Gòn', price: '120.000 đ - 140.000 đ' }
    ],
    verified: true,
    verifiedAt: '2026-09-12',
    verifiedBy: 'CarMate Transit Team'
  }
]);

/** Lấy hotline đã kiểm chứng của một hành lang (chỉ xe khách liên tỉnh, không lấy xe buýt). */
export function getVerifiedHotlines(corridor = 'Tuyến QL13', limit = 8) {
  return VERIFIED_HOTLINES.filter(
    (h) => h.verified && h.hotline && h.type !== 'public_bus' && (!h.corridor || h.corridor === corridor)
  ).slice(0, limit);
}

/** Hành lang này đã có số nào gọi được chưa? */
export function hasAnyVerifiedHotline(corridor = 'Tuyến QL13') {
  return getVerifiedHotlines(corridor).length > 0;
}
