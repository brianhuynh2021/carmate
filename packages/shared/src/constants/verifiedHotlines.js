/**
 * =============================================================================
 * VERIFIED HOTLINE DIRECTORY (VERIFIED HOTLINE REGISTRY)
 * =============================================================================
 * THIS IS THE ONLY FILE TO EDIT WHEN THERE IS A NEW NUMBER. Do not scatter numbers through the code.
 *
 * IRON-CLAD RULE:
 *   Only enter a number once you HAVE CALLED IT YOURSELF and heard the right bus operator pick up.
 *   Do not copy from Google, and do not copy from photos of roadside advertising signs.
 *
 * Why so strict: passengers tap this number at their most panicked moment — the driver is
 * out of contact and they have 20 minutes left to be out on the road. If nobody answers, or a
 * stranger does, trust is lost permanently. Better no number than a wrong number.
 *
 * HOW TO ADD A NUMBER:
 *   1. Call the number, confirm it is the right bus operator and the right route.
 *   2. Fill it into the array below, set `verified: true` and record `verifiedAt`.
 *   3. The UI shows the call button automatically. Nothing else needs to change.
 *
 * When the array is empty (as it is now), the whole UI switches to showing
 * ON-THE-GROUND INSTRUCTIONS only — passengers can still catch a ride, just by doing it themselves instead of calling.
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
    id: 'chin-nghia',
    operator: 'Xe khách & Giường nằm Chín Nghĩa',
    shortName: 'Chín Nghĩa',
    corridor: 'Tuyến QL13',
    hotline: '02713 888 777',
    altHotline: '1900 636 636',
    type: 'sleeper_bus',
    frequency: '4 chuyến/ngày (Sáng - Tối)',
    priceRef: '150.000đ - 190.000đ',
    coverage: 'Bù Đốp ⇄ Lộc Ninh ⇄ Bình Long ⇄ Chơn Thành ⇄ Bến xe Miền Đông',
    note: 'Xe giường nằm 40 chỗ tuyến QL13 trả Bến xe Miền Đông',
    fareTable: [
      { route: 'Bù Đốp / Bình Long ➔ Bến xe Miền Đông', price: '150.000 đ – 190.000 đ' }
    ],
    verified: true,
    verifiedAt: '2026-09-13',
    verifiedBy: 'CarMate Transit Team'
  },
  {
    id: 'quoc-dat',
    operator: 'Quốc Đạt (Limousine phòng nằm)',
    shortName: 'Quốc Đạt',
    corridor: 'Tuyến QL13',
    hotline: '0914 068 070',
    altHotline: '02713 605 605',
    type: 'limousine',
    frequency: 'Nhiều chuyến/ngày',
    priceRef: '220.000đ - 260.000đ',
    coverage: 'Bình Long ⇄ Chơn Thành ⇄ Bến Cát ⇄ QL13 ⇄ Bến xe Miền Đông',
    note: 'Limousine phòng nằm cao cấp chạy trục QL13',
    fareTable: [
      { route: 'Bình Phước ➔ Sài Gòn / BX Miền Đông', price: '220.000 đ – 260.000 đ' }
    ],
    verified: true,
    verifiedAt: '2026-09-13',
    verifiedBy: 'CarMate Transit Team'
  },
  {
    id: 'ba-dam',
    operator: 'Xe khách Ba Đàm (Ghế ngồi 29 chỗ)',
    shortName: 'Ba Đàm',
    corridor: 'Tuyến QL13',
    hotline: '0913 723 371',
    altHotline: '02713 879 879',
    type: 'coach',
    frequency: 'Chạy liên tục ban ngày',
    priceRef: '120.000đ - 150.000đ',
    coverage: 'Bù Đăng ⇄ Đồng Xoài ⇄ Chơn Thành ⇄ Bến Cát ⇄ Bến xe Miền Đông',
    note: 'Xe khách liên tỉnh truyền thống đón trả dọc tuyến QL13',
    fareTable: [
      { route: 'Bình Phước ➔ Bến xe Miền Đông', price: '120.000 đ – 150.000 đ' }
    ],
    verified: true,
    verifiedAt: '2026-09-13',
    verifiedBy: 'CarMate Transit Team'
  }
]);

/** Gets the verified hotlines of a corridor (intercity coaches only, no city buses). */
export function getVerifiedHotlines(corridor = 'Tuyến QL13', limit = 8) {
  return VERIFIED_HOTLINES.filter(
    (h) => h.verified && h.hotline && h.type !== 'public_bus' && (!h.corridor || h.corridor === corridor)
  ).slice(0, limit);
}
