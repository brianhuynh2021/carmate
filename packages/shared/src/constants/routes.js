import { parseLocation } from '../utils/geo.js';

export const DEFAULT_FALLBACK_ROUTES = [
  { from: 'Lộc Ninh', to: 'Sài Gòn', count: 0 },
  { from: 'Bù Đốp', to: 'TP. Hồ Chí Minh', count: 0 },
  { from: 'Bình Long', to: 'Sài Gòn', count: 0 },
  { from: 'Đồng Xoài', to: 'TP. Hồ Chí Minh', count: 0 },
  { from: 'Phan Thiết', to: 'Sài Gòn', count: 0 },
  { from: 'Vũng Tàu', to: 'Sài Gòn', count: 0 },
  { from: 'Bình Phước', to: 'Kiên Giang', count: 0 },
  { from: 'Hà Nội', to: 'Hải Phòng', count: 0 },
  { from: 'Sài Gòn', to: 'Đà Lạt', count: 0 }
];

/**
 * Trích xuất động các cặp tuyến HOT nhất từ dữ liệu chuyến xe thực tế đang mở.
 * Phân tích và nhóm theo cự ly / địa danh vĩ mô, sắp xếp theo số lượng xe nhiều nhất.
 */
export function computeHotRoutes(trips = []) {
  if (!Array.isArray(trips) || trips.length === 0) {
    return DEFAULT_FALLBACK_ROUTES;
  }

  const routeMap = new Map();

  for (const t of trips) {
    if (!t || !t.from || !t.to) continue;
    const fromP = parseLocation(t.from);
    const toP = parseLocation(t.to);
    const fromMain = (fromP.main || t.from).split(/[(/]/)[0].trim();
    const toMain = (toP.main || t.to).split(/[(/]/)[0].trim();
    if (!fromMain || !toMain || fromMain.toLowerCase() === toMain.toLowerCase()) continue;

    const pair = [fromMain, toMain].sort((a, b) => a.localeCompare(b, 'vi'));
    const key = `${pair[0]}:::${pair[1]}`;

    if (!routeMap.has(key)) {
      routeMap.set(key, {
        from: fromMain,
        to: toMain,
        count: 0
      });
    }
    routeMap.get(key).count += 1;
  }

  const dynamicRoutes = Array.from(routeMap.values()).sort((a, b) => b.count - a.count);

  if (dynamicRoutes.length >= 3) {
    return dynamicRoutes.slice(0, 8);
  }

  const existing = new Set(dynamicRoutes.map((r) => `${r.from}:::${r.to}`));
  const merged = [...dynamicRoutes];
  for (const def of DEFAULT_FALLBACK_ROUTES) {
    const k = `${def.from}:::${def.to}`;
    if (!existing.has(k)) {
      merged.push({ ...def });
    }
    if (merged.length >= 6) break;
  }

  return merged;
}

// BẢNG ĐỊNH MỨC CHI PHÍ XĂNG & CẦU ĐƯỜNG THỰC TẾ THEO QUY CHUẨN KỸ THUẬT
// Cơ sở tính toán: Định mức tiêu hao nhiên liệu xe 5-7 chỗ (6.5L - 7.5L RON 95/100km) + Phí cầu đường / trạm thu phí
export const ROUTE_BENCHMARKS = {
  // ── MIỀN BẮC ──
  'Tuyến CT Hà Nội - Hải Phòng': {
    name: 'Hà Nội ⇄ Hải Phòng (Cao Tốc 5B ~105km)',
    shortName: 'Hà Nội ⇄ Hải Phòng',
    keyword: 'Hải Phòng',
    region: 'north',
    distanceKm: 105,
    fuelCost: 160000, // ~7.5L xăng RON 95
    botFee: 190000, // Phí cao tốc Hà Nội - Hải Phòng (Nút Cổ Linh - Đình Vũ)
    suggestedRate: 150000,
    minSafePrice: 100000,
    maxSafePrice: 280000,
    marketLimoRef: '220.000đ - 250.000đ',
    traditionalBusRef: '150.000đ - 180.000đ',
    calculationBasis:
      '105km cao tốc 5B Hà Nội - Hải Phòng. Xăng ~160k + phí cao tốc 190k = 350.000đ chi phí toàn xe. Ghép 2-3 người chia sẻ ~130k - 150k/ghế.'
  },
  'Tuyến CT Pháp Vân - Ninh Bình': {
    name: 'Hà Nội ⇄ Ninh Bình / Nam Định (~95km)',
    shortName: 'Hà Nội ⇄ Ninh Bình',
    keyword: 'Ninh Bình',
    region: 'north',
    distanceKm: 95,
    fuelCost: 145000,
    botFee: 110000, // Cao tốc Pháp Vân - Cầu Giẽ - Cao Bồ
    suggestedRate: 130000,
    minSafePrice: 80000,
    maxSafePrice: 250000,
    marketLimoRef: '180.000đ - 200.000đ',
    traditionalBusRef: '120.000đ',
    calculationBasis: 'Cao tốc Pháp Vân - Cầu Giẽ - Cao Bồ. Xăng + phí cao tốc chia sẻ hợp lý ~120k - 140k/ghế.'
  },

  // ── MIỀN TRUNG ──
  'Tuyến Đà Nẵng - Huế': {
    name: 'Đà Nẵng ⇄ Huế (Hầm Hải Vân ~100km)',
    shortName: 'Đà Nẵng ⇄ Huế',
    keyword: 'Huế',
    region: 'central',
    distanceKm: 100,
    fuelCost: 150000,
    botFee: 110000, // Phí qua hầm Hải Vân + Trạm Phú Bài
    suggestedRate: 140000,
    minSafePrice: 90000,
    maxSafePrice: 260000,
    marketLimoRef: '180.000đ - 220.000đ',
    traditionalBusRef: '130.000đ',
    calculationBasis: '100km qua hầm Hải Vân. Chia sẻ chi phí xăng và phí hầm/BOT ~130k - 150k/ghế.'
  },

  // ── MIỀN NAM ──
  'Tuyến QL13': {
    name: 'Bình Phước (Bù Đốp/Lộc Ninh/Đồng Xoài) ⇄ Sài Gòn (~140km)',
    shortName: 'Bình Phước ⇄ Sài Gòn',
    keyword: 'Bình Phước',
    region: 'south',
    distanceKm: 140,
    fuelCost: 210000, // ~9L xăng RON 95
    botFee: 70000, // Trạm Lái Thiêu, Suối Giữa, Bàu Bàng, Tân Lập
    suggestedRate: 180000,
    minSafePrice: 100000,
    maxSafePrice: 350000,
    marketLimoRef: '240.000đ - 260.000đ',
    traditionalBusRef: '200.000đ - 220.000đ',
    calculationBasis:
      '140km x 1.500đ xăng/km + 70.000đ phí cầu đường = 280.000đ chi phí xe. Ghép 2-3 người chia sẻ ~150k - 180k/ghế.'
  },
  'Tuyến QL51': {
    name: 'Vũng Tàu / Bà Rịa ⇄ Sài Gòn (Cao Tốc Long Thành ~100km)',
    shortName: 'Vũng Tàu ⇄ Sài Gòn',
    keyword: 'Vũng Tàu',
    region: 'south',
    distanceKm: 100,
    fuelCost: 150000,
    botFee: 98000, // Trạm Cao tốc Long Thành - Dầu Giây + QL51
    suggestedRate: 160000,
    minSafePrice: 90000,
    maxSafePrice: 300000,
    marketLimoRef: '220.000đ - 260.000đ',
    traditionalBusRef: '180.000đ',
    calculationBasis:
      '100km x 1.500đ xăng/km + 98.000đ phí cao tốc = 248.000đ chi phí xe. Ghép chia sẻ ~140k - 160k/ghế.'
  },
  'Tuyến QL20': {
    name: 'Bảo Lộc / Đà Lạt (Lâm Đồng) ⇄ Sài Gòn (~180-300km)',
    shortName: 'Bảo Lộc / Đà Lạt ⇄ Sài Gòn',
    keyword: 'Bảo Lộc',
    region: 'south',
    distanceKm: 200,
    fuelCost: 320000,
    botFee: 80000,
    suggestedRate: 200000,
    minSafePrice: 120000,
    maxSafePrice: 450000,
    marketLimoRef: '270.000đ - 320.000đ',
    traditionalBusRef: '250.000đ',
    calculationBasis: 'Đèo Bảo Lộc + Cao tốc Dầu Giây. Chia sẻ chi phí nhiên liệu & phí cầu đường qua đèo.'
  },
  'Tuyến QL1A': {
    name: 'Phan Thiết / Bình Thuận ⇄ Sài Gòn (Cao Tốc Dầu Giây ~200km)',
    shortName: 'Phan Thiết ⇄ Sài Gòn',
    keyword: 'Phan Thiết',
    region: 'south',
    distanceKm: 190,
    fuelCost: 285000,
    botFee: 120000,
    suggestedRate: 190000,
    minSafePrice: 110000,
    maxSafePrice: 400000,
    marketLimoRef: '250.000đ - 280.000đ',
    traditionalBusRef: '220.000đ',
    calculationBasis: 'Cao tốc Phan Thiết - Dầu Giây 200km. Xăng + phí cao tốc chia sẻ.'
  },
  'Tuyến QL22': {
    name: 'Tây Ninh (Trảng Bàng / Gò Dầu / TP) ⇄ Sài Gòn (~100km)',
    shortName: 'Tây Ninh ⇄ Sài Gòn',
    keyword: 'Tây Ninh',
    region: 'south',
    distanceKm: 95,
    fuelCost: 140000,
    botFee: 35000,
    suggestedRate: 110000,
    minSafePrice: 60000,
    maxSafePrice: 250000,
    marketLimoRef: '150.000đ - 180.000đ',
    traditionalBusRef: '120.000đ',
    calculationBasis: '95km QL22 + phí cầu đường An Sương. Chia sẻ hợp lý 100k - 120k/ghế.'
  },
  'Tuyến CT Long Thành': {
    name: 'Long Thành / Nhơn Trạch / Đồng Nai ⇄ Sài Gòn (~60km)',
    shortName: 'Long Thành ⇄ Sài Gòn',
    keyword: 'Long Thành',
    region: 'south',
    distanceKm: 55,
    fuelCost: 85000,
    botFee: 40000,
    suggestedRate: 80000,
    minSafePrice: 50000,
    maxSafePrice: 200000,
    marketLimoRef: '120.000đ - 150.000đ',
    traditionalBusRef: '90.000đ',
    calculationBasis: 'Tuyến ngắn dân văn phòng đi lại hàng ngày. Chi phí chia đôi nhẹ nhàng.'
  },
  'Tuyến QL1K': {
    name: 'Biên Hòa / Dĩ An ⇄ Sài Gòn (~30km)',
    shortName: 'Biên Hòa ⇄ Sài Gòn',
    keyword: 'Biên Hòa',
    region: 'south',
    distanceKm: 30,
    fuelCost: 45000,
    botFee: 15000,
    suggestedRate: 50000,
    minSafePrice: 30000,
    maxSafePrice: 150000,
    marketLimoRef: '90.000đ - 120.000đ',
    traditionalBusRef: '60.000đ',
    calculationBasis: '30km tiện đường đi làm hàng ngày.'
  },
  'Tuyến QL50': {
    name: 'Gò Công / Tiền Giang ⇄ Sài Gòn (~80km)',
    shortName: 'Gò Công ⇄ Sài Gòn',
    keyword: 'Gò Công',
    region: 'south',
    distanceKm: 80,
    fuelCost: 120000,
    botFee: 25000,
    suggestedRate: 110000,
    minSafePrice: 65000,
    maxSafePrice: 250000,
    marketLimoRef: '150.000đ - 170.000đ',
    traditionalBusRef: '130.000đ',
    calculationBasis: '80km qua phà/cầu Mỹ Lợi.'
  },
  'Tuyến QL60': {
    name: 'Bến Tre (Châu Thành / TP) ⇄ Sài Gòn (~90km)',
    shortName: 'Bến Tre ⇄ Sài Gòn',
    keyword: 'Bến Tre',
    region: 'south',
    distanceKm: 90,
    fuelCost: 135000,
    botFee: 35000,
    suggestedRate: 130000,
    minSafePrice: 75000,
    maxSafePrice: 280000,
    marketLimoRef: '160.000đ - 190.000đ',
    traditionalBusRef: '140.000đ',
    calculationBasis: '90km qua cầu Rạch Miễu + Cao tốc Trung Lương.'
  },
  'Tuyến CT Trung Lương': {
    name: 'Mỹ Tho / Tiền Giang ⇄ Sài Gòn (Cao Tốc ~70km)',
    shortName: 'Mỹ Tho ⇄ Sài Gòn',
    keyword: 'Mỹ Tho',
    region: 'south',
    distanceKm: 70,
    fuelCost: 105000,
    botFee: 35000,
    suggestedRate: 100000,
    minSafePrice: 55000,
    maxSafePrice: 220000,
    marketLimoRef: '140.000đ - 160.000đ',
    traditionalBusRef: '110.000đ',
    calculationBasis: '70km cao tốc TP.HCM - Trung Lương.'
  },
  'Tuyến N2 - Kiên Giang': {
    name: 'Bình Phước ⇄ Kiên Giang / Miền Tây (Tuyến N2 ~280km)',
    shortName: 'Bình Phước ⇄ Kiên Giang',
    keyword: 'Kiên Giang',
    region: 'south',
    distanceKm: 280,
    fuelCost: 420000,
    botFee: 110000, // BOT Tuyến N2 + Cầu Vàm Cống / Rạch Sỏi
    suggestedRate: 260000,
    minSafePrice: 150000,
    maxSafePrice: 500000,
    marketLimoRef: '320.000đ - 380.000đ',
    traditionalBusRef: '220.000đ - 250.000đ',
    calculationBasis:
      '280km trục Tuyến N2 nối Bình Phước - Long An - Đồng Tháp - Cần Thơ - Kiên Giang. Chiều xe tải/xe tiện tuyến chở nông sản & hàng hóa 2 chiều chia sẻ chi phí rất hiệu quả.'
  }
};

// BẢNG HÀNH LANG ĐIỂM ĐÓN / TRẢ DỌC ĐƯỜNG (CORRIDOR WAYPOINTS) THEO TRỤC QUỐC LỘ & CAO TỐC
export const CORRIDOR_WAYPOINTS = {
  'Tuyến QL13': [
    'Bù Đốp (TT. Thanh Bình)',
    'Tân Tiến / Lộc Hiệp',
    'Ngã 3 Lộc Tấn / Cửa khẩu Hoa Lư',
    'Chợ Lộc Ninh / Cây xăng 17',
    'TX. Bình Long / Thanh Lương',
    'Tân Khai / Huyện Hớn Quản',
    'Ngã 4 Chơn Thành (Giao N2 & QL14)',
    'KCN Bàu Bàng / Bến Cát',
    'Ngã 4 Sở Sao / Đại Nam (Thủ Dầu Một)',
    'Aeon Mall Canary / KCN VSIP 1',
    'Lái Thiêu / Cổng chào Bình Dương',
    'Ngã 4 Bình Phước (Thủ Đức)',
    'Cầu Bình Triệu / BX Miền Đông cũ',
    'Ngã tư Hàng Xanh (Bình Thạnh)'
  ],
  'Tuyến QL51': [
    'Hàng Xanh / Mai Chí Thọ (TP. Thủ Đức)',
    'Đầu cao tốc Long Thành - Dầu Giây (Nút An Phú)',
    'Phà Cát Lái / KCN Nhơn Trạch',
    'Ngã 3 Vũng Tàu / Vòng xoay Tam Hiệp',
    'Trạm dừng chân Mekong Long Thành',
    'Ngã 3 Mỹ Xuân / Thị xã Phú Mỹ',
    'TP. Bà Rịa / Cổng chào Bà Rịa',
    'Bãi Trước / Bãi Sau TP. Vũng Tàu'
  ],
  'Tuyến QL20': [
    'Nút giao Dầu Giây / Cao tốc Long Thành',
    'Định Quán / Đá Ba Chồng',
    'Tân Phú / Rừng Nam Cát Tiên',
    'Chân đèo Chuối / Thị trấn Mađaguôi',
    'Đèo Bảo Lộc / TP. Bảo Lộc',
    'Huyện Di Linh / Ngã 3 Hòa Ninh',
    'Đức Trọng / Sân bay Liên Khương',
    'Đèo Prenn / Trung tâm TP. Đà Lạt'
  ],
  'Tuyến CT Hà Nội - Hải Phòng': [
    'Nút giao Cổ Linh / AEON Mall Long Biên',
    'Trạm thu phí Văn Giang (Hưng Yên)',
    'Nút giao Yên Mỹ / Ân Thi',
    'Nút giao Gia Lộc / TP. Hải Dương',
    'Nút giao Đình Vũ / Cảng Đình Vũ',
    'Nhà hát lớn / Trung tâm TP. Hải Phòng'
  ],
  'Tuyến CT Pháp Vân - Ninh Bình': [
    'Nút giao Pháp Vân / Bến xe Nước Ngầm',
    'Trạm thu phí Thường Tín (Hà Nội)',
    'Nút giao Vực Vòng / Đồng Văn (Hà Nam)',
    'TP. Phủ Lý (Hà Nam)',
    'Nút giao Liêm Tuyền / TP. Nam Định',
    'Nút giao Cao Bồ / TP. Ninh Bình',
    'Khu du lịch Tràng An / Tam Cốc'
  ],
  'Tuyến Đà Nẵng - Huế': [
    'Cầu Rồng / Bến xe Trung tâm Đà Nẵng',
    'Khu công nghiệp Hòa Khánh / Liên Chiểu',
    'Cửa hầm Hải Vân (Phía Nam)',
    'Thị trấn Lăng Cô / Đầm Cầu Hai',
    'Huyện Phú Lộc / Nước Ngọt',
    'Phú Bài (Sân bay / TX. Hương Thủy)',
    'Bến xe Phía Nam / Trung tâm TP. Huế'
  ],
  'Tuyến QL1A': [
    'Bến xe Miền Tây / Vòng xoay An Lạc',
    'Thị xã Bến Lức (Long An)',
    'TP. Tân An (Long An)',
    'TP. Mỹ Tho (Tiền Giang)',
    'Thị xã Cai Lậy / Cái Bè',
    'Cầu Mỹ Thuận / TP. Vĩnh Long',
    'Bến xe Trung tâm TP. Cần Thơ'
  ],
  'Tuyến N2 - Kiên Giang': [
    'Ngã 4 Chơn Thành / QL13 (Bình Phước)',
    'Bến Cát / Cầu Thầy Cai',
    'Thị trấn Hậu Nghĩa / Đức Hòa (Long An)',
    'Thạnh Hóa / Tân Thạnh (Tuyến N2)',
    'Tháp Mười / Cao Lãnh (Đồng Tháp)',
    'Cầu Vàm Cống / Thốt Nốt (Cần Thơ)',
    'Ngã 3 Lộ Tẻ / Cao tốc Lộ Tẻ - Rạch Sỏi',
    'TP. Rạch Giá / Hà Tiên (Kiên Giang)'
  ]
};

/**
 * Lấy danh sách điểm đón dọc đường theo tên tuyến hoặc từ khóa
 */
export function getCorridorWaypoints(routeCategoryOrKeyword) {
  if (!routeCategoryOrKeyword) return [];
  const clean = routeCategoryOrKeyword.trim().toLowerCase();

  for (const [key, waypoints] of Object.entries(CORRIDOR_WAYPOINTS)) {
    if (
      key.toLowerCase().includes(clean) ||
      clean.includes(key.toLowerCase()) ||
      (ROUTE_BENCHMARKS[key]?.keyword && clean.includes(ROUTE_BENCHMARKS[key].keyword.toLowerCase()))
    ) {
      return waypoints;
    }
  }

  // Fallback thử tìm theo từ khóa chung
  if (clean.includes('kiên giang') || clean.includes('rạch giá') || clean.includes('hà tiên') || clean.includes('miền tây') || clean.includes('tuyến n2')) {
    return CORRIDOR_WAYPOINTS['Tuyến N2 - Kiên Giang'];
  }
  if (clean.includes('bình phước') || clean.includes('bù đốp') || clean.includes('đồng xoài') || clean.includes('ql13')) {
    return CORRIDOR_WAYPOINTS['Tuyến QL13'];
  }
  if (clean.includes('vũng tàu') || clean.includes('bà rịa') || clean.includes('ql51')) {
    return CORRIDOR_WAYPOINTS['Tuyến QL51'];
  }
  if (clean.includes('đà lạt') || clean.includes('bảo lộc') || clean.includes('lâm đồng') || clean.includes('ql20')) {
    return CORRIDOR_WAYPOINTS['Tuyến QL20'];
  }
  if (clean.includes('hải phòng') || clean.includes('5b')) {
    return CORRIDOR_WAYPOINTS['Tuyến CT Hà Nội - Hải Phòng'];
  }
  if (clean.includes('ninh bình') || clean.includes('nam định') || clean.includes('pháp vân')) {
    return CORRIDOR_WAYPOINTS['Tuyến CT Pháp Vân - Ninh Bình'];
  }
  if (clean.includes('huế') || clean.includes('đà nẵng') || clean.includes('hải vân')) {
    return CORRIDOR_WAYPOINTS['Tuyến Đà Nẵng - Huế'];
  }

  return [];
}

/**
 * MẠNG LƯỚI TRẠM ĐÓN ẢO CHUẨN HÓA (VIRTUAL HUBS - DARP-MP)
 * Định vị các nút giao vàng dọc tuyến hành lang chính để xe lướt qua không phải vòng hẻm.
 * Thời gian dừng đỗ chuẩn hóa 5 phút (300s) curbside window.
 */
export const VIRTUAL_HUBS = [
  // ── HÀNH LANG TUYẾN QL13 (TP.HCM ⇄ BÌNH DƯƠNG ⇄ BÌNH PHƯỚC: BÙ ĐỐP - LỘC NINH) ──
  {
    id: 'hub_ql13_hang_xanh',
    name: 'Ngã tư Hàng Xanh (Bình Thạnh - TP.HCM)',
    shortName: 'Ngã 4 Hàng Xanh',
    corridor: 'Tuyến QL13',
    lat: 10.8012,
    lng: 106.7114,
    landmark: 'Cây xăng Comeco Hàng Xanh / Điện Biên Phủ',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_binh_trieu',
    name: 'Cầu Bình Triệu / Bến xe Miền Đông cũ (Bình Thạnh)',
    shortName: 'Cầu Bình Triệu / BX Miền Đông',
    corridor: 'Tuyến QL13',
    lat: 10.8175,
    lng: 106.7118,
    landmark: 'Cầu Bình Triệu 1 - Đinh Bộ Lĩnh / QL13',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_nga4_binh_phuoc',
    name: 'Ngã 4 Bình Phước (Thủ Đức - TP.HCM)',
    shortName: 'Ngã 4 Bình Phước',
    corridor: 'Tuyến QL13',
    lat: 10.8525,
    lng: 106.7214,
    landmark: 'Cây xăng Petrolimex QL13 giao QL1A',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_cong_chao_lai_thieu',
    name: 'Cổng chào Bình Dương / Lái Thiêu (Thuận An)',
    shortName: 'Cổng chào Lái Thiêu',
    corridor: 'Tuyến QL13',
    lat: 10.9015,
    lng: 106.6985,
    landmark: 'Cổng chào Bình Dương - QL13',
    curbsideWindowSeconds: 300,
    isMajorJunction: false
  },
  {
    id: 'hub_ql13_vsip1',
    name: 'Cổng KCN VSIP 1 / AEON Mall Bình Dương',
    shortName: 'KCN VSIP 1 / AEON Mall',
    corridor: 'Tuyến QL13',
    lat: 10.9328,
    lng: 106.6972,
    landmark: 'Cổng chính KCN VSIP 1 - Đại lộ Bình Dương',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_nga4_so_sao',
    name: 'Ngã 4 Sở Sao / Trạm dừng Đại Nam (Thủ Dầu Một)',
    shortName: 'Ngã 4 Sở Sao',
    corridor: 'Tuyến QL13',
    lat: 11.0423,
    lng: 106.6341,
    landmark: 'Ngã 4 Sở Sao - Cây xăng Đại Nam',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_bau_bang',
    name: 'Trạm dừng KCN Bàu Bàng / Mỹ Phước',
    shortName: 'KCN Bàu Bàng',
    corridor: 'Tuyến QL13',
    lat: 11.2382,
    lng: 106.6125,
    landmark: 'Cổng KCN Bàu Bàng - QL13',
    curbsideWindowSeconds: 300,
    isMajorJunction: false
  },
  {
    id: 'hub_ql13_nga4_chon_thanh',
    name: 'Ngã 4 Chơn Thành (Giao Tuyến N2 & QL14)',
    shortName: 'Ngã 4 Chơn Thành',
    corridor: 'Tuyến QL13',
    lat: 11.4791,
    lng: 106.6694,
    landmark: 'Bùng binh Chơn Thành - Trạm xăng Tín Nghĩa',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_minh_hung',
    name: 'KCN Minh Hưng - Hàn Quốc (Chơn Thành)',
    shortName: 'KCN Minh Hưng',
    corridor: 'Tuyến QL13',
    lat: 11.5120,
    lng: 106.6520,
    landmark: 'Cổng KCN Minh Hưng Hàn Quốc - QL13',
    curbsideWindowSeconds: 300,
    isMajorJunction: false
  },
  {
    id: 'hub_ql13_tan_khai',
    name: 'Cây xăng Petrolimex Tân Khai / Chợ Tân Khai (Hớn Quản)',
    shortName: 'Petrolimex Tân Khai',
    corridor: 'Tuyến QL13',
    lat: 11.5620,
    lng: 106.6340,
    landmark: 'Cây xăng Petrolimex Tân Khai / Cổng Huyện ủy Hớn Quản QL13',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_binh_long',
    name: 'Cổng chào TX. Bình Long / Bến xe Bình Long',
    shortName: 'TX. Bình Long (An Lộc)',
    corridor: 'Tuyến QL13',
    lat: 11.6482,
    lng: 106.6025,
    landmark: 'Cổng chào Thị xã Bình Long QL13 - Vòng xoay An Lộc',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_thanh_luong',
    name: 'Ngã 3 Thanh Lương (Ranh Bình Long - Lộc Ninh)',
    shortName: 'Ngã 3 Thanh Lương',
    corridor: 'Tuyến QL13',
    lat: 11.7250,
    lng: 106.5980,
    landmark: 'Ngã 3 Thanh Lương QL13',
    curbsideWindowSeconds: 300,
    isMajorJunction: false
  },
  {
    id: 'hub_ql13_cho_loc_ninh',
    name: 'Chợ Lộc Ninh / Cây xăng 17 (Bình Phước)',
    shortName: 'Chợ Lộc Ninh (Cây xăng 17)',
    corridor: 'Tuyến QL13',
    lat: 11.8421,
    lng: 106.5972,
    landmark: 'Khu phố Ninh Thịnh / Cây xăng 17 QL13',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_hoa_lu',
    name: 'Cửa khẩu Quốc tế Hoa Lư (Lộc Ninh)',
    shortName: 'Cửa khẩu Hoa Lư',
    corridor: 'Tuyến QL13',
    lat: 11.9568,
    lng: 106.5312,
    landmark: 'Trạm kiểm soát liên hợp Cửa khẩu Hoa Lư',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_loc_tan',
    name: 'Ngã 3 Lộc Tấn (Giao ĐT759B & QL13)',
    shortName: 'Ngã 3 Lộc Tấn',
    corridor: 'Tuyến QL13',
    lat: 11.8845,
    lng: 106.5912,
    landmark: 'Ngã 3 Lộc Tấn - Điểm rẽ vào Lộc Hiệp & Bù Đốp',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_loc_hiep',
    name: 'Chợ Lộc Hiệp / Ngã 3 Lộc Hiệp (Lộc Ninh)',
    shortName: 'Chợ Lộc Hiệp',
    corridor: 'Tuyến QL13',
    lat: 11.9012,
    lng: 106.6623,
    landmark: 'Chợ Lộc Hiệp - ĐT759B kết nối Bù Đốp',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_tan_tien',
    name: 'Chợ Tân Tiến / Cầu Tân Tiến (Bù Đốp)',
    shortName: 'Chợ Tân Tiến (Bù Đốp)',
    corridor: 'Tuyến QL13',
    lat: 11.9351,
    lng: 106.7321,
    landmark: 'Chợ Tân Tiến - ĐT759B',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql13_budop',
    name: 'Chợ Bù Đốp / Bến xe Bù Đốp (TT. Thanh Bình)',
    shortName: 'Chợ Bù Đốp (TT. Thanh Bình)',
    corridor: 'Tuyến QL13',
    lat: 11.9832,
    lng: 106.8124,
    landmark: 'Cây xăng Petrolimex Thanh Bình / Chợ Bù Đốp (Đầu tuyến)',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_ql14_dong_xoai',
    name: 'Ngã 3 Đồng Xoài / Tượng đài Chiến Thắng (Nhánh QL14)',
    shortName: 'TP. Đồng Xoài (Nhánh QL14)',
    corridor: 'Tuyến QL13',
    lat: 11.5328,
    lng: 106.8834,
    landmark: 'Bùng binh Ngã 3 Hùng Vương - ĐT741 / QL14',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },

  // ── HÀNH LANG TUYẾN N2 (ĐÔNG NAM BỘ ⇄ MIỀN TÂY / KIÊN GIANG) ──
  {
    id: 'hub_n2_chon_thanh',
    name: 'Ngã 4 Chơn Thành (Điểm kết nối QL13 - Tuyến N2)',
    shortName: 'Ngã 4 Chơn Thành (N2)',
    corridor: 'Tuyến N2 - Kiên Giang',
    lat: 11.4791,
    lng: 106.6694,
    landmark: 'Bùng binh Chơn Thành - Điểm đầu N2',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_n2_thay_cai',
    name: 'Cầu Thầy Cai / Bến Cát (Ranh Bình Dương - Củ Chi)',
    shortName: 'Cầu Thầy Cai',
    corridor: 'Tuyến N2 - Kiên Giang',
    lat: 11.0251,
    lng: 106.4912,
    landmark: 'Trạm dừng chân Cầu Thầy Cai',
    curbsideWindowSeconds: 300,
    isMajorJunction: false
  },
  {
    id: 'hub_n2_hau_nghia',
    name: 'Thị trấn Hậu Nghĩa / Đức Hòa (Long An)',
    shortName: 'Hậu Nghĩa (Đức Hòa)',
    corridor: 'Tuyến N2 - Kiên Giang',
    lat: 10.8924,
    lng: 106.4215,
    landmark: 'Vòng xoay Hậu Nghĩa - ĐT825 giao Tuyến N2',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_n2_thanh_hoa',
    name: 'Thị trấn Thạnh Hóa / Cầu Tuyên Nhơn (Long An)',
    shortName: 'Thạnh Hóa (Long An)',
    corridor: 'Tuyến N2 - Kiên Giang',
    lat: 10.6512,
    lng: 106.1824,
    landmark: 'Trạm xăng Cầu Tuyên Nhơn - Tuyến N2',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_n2_thap_muoi',
    name: 'Thị trấn Mỹ An / Tháp Mười (Đồng Tháp)',
    shortName: 'Tháp Mười (Đồng Tháp)',
    corridor: 'Tuyến N2 - Kiên Giang',
    lat: 10.5185,
    lng: 105.8521,
    landmark: 'Bến xe Mỹ An - Nút giao N2',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_n2_cau_cao_lanh',
    name: 'Nút giao Cầu Cao Lãnh (Đồng Tháp)',
    shortName: 'Cầu Cao Lãnh',
    corridor: 'Tuyến N2 - Kiên Giang',
    lat: 10.4214,
    lng: 105.6542,
    landmark: 'Trạm dừng chân Cao Lãnh / Quốc lộ 30',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_n2_vam_cong',
    name: 'Cầu Vàm Cống / Thốt Nốt (Cần Thơ)',
    shortName: 'Cầu Vàm Cống',
    corridor: 'Tuyến N2 - Kiên Giang',
    lat: 10.3125,
    lng: 105.5124,
    landmark: 'Trạm dừng chân Cầu Vàm Cống',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_n2_lo_te',
    name: 'Ngã 3 Lộ Tẻ / Cao tốc Lộ Tẻ - Rạch Sỏi',
    shortName: 'Ngã 3 Lộ Tẻ',
    corridor: 'Tuyến N2 - Kiên Giang',
    lat: 10.1852,
    lng: 105.3214,
    landmark: 'Nút giao Lộ Tẻ - Đầu cao tốc Rạch Sỏi',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  },
  {
    id: 'hub_n2_rach_gia',
    name: 'Bến xe Rạch Sỏi / TP. Rạch Giá (Kiên Giang)',
    shortName: 'TP. Rạch Giá',
    corridor: 'Tuyến N2 - Kiên Giang',
    lat: 9.9612,
    lng: 105.1245,
    landmark: 'Bến xe Rạch Sỏi - Đường Mai Thị Hồng Hạnh',
    curbsideWindowSeconds: 300,
    isMajorJunction: true
  }
];

/**
 * CẤU HÌNH ĐÓN TẬN CỬA NHÀ (DOORSTEP PICKUP - MIT COMPENSATED PRICING)
 * Cho phép khách có con nhỏ/đồ nặng chọn đón tận cửa với phụ phí xăng ngõ ngách minh bạch.
 * Phụ phí được chia sẻ công bằng (Pareto Optimal) giảm trừ giá vé cho các khách khác cùng xe.
 */
export const DOORSTEP_CONFIG = {
  DEFAULT_SURCHARGE: 40000, // +40.000đ phụ phí hỗ trợ xăng ngõ ngách
  MAX_NEIGHBORHOOD_RADIUS_KM: 2.0, // Bán kính láng giềng tối đa 2.0km (tiện lợi cho bà con xóm ấp)
  MAX_CURBSIDE_WAIT_SECONDS: 300, // Tối đa 5 phút chờ trước cửa
  COMPENSATION_DISCOUNT_RATIO: 0.5, // 50% tiền phụ phí chia lại giảm giá cho khách cùng xe
  LABEL: 'Cần đón tận nhà (+40k phụ phí xăng)',
  NOTE: 'Đón tận cửa nhà (+40.000đ hỗ trợ xăng ngõ ngách · Bán kính láng giềng ≤ 2km)'
};

/**
 * Lấy danh sách Trạm đón ảo theo tuyến hành lang
 */
export function getVirtualHubsByCorridor(corridorKey) {
  if (!corridorKey) return VIRTUAL_HUBS;
  const clean = corridorKey.trim().toLowerCase();
  return VIRTUAL_HUBS.filter(
    (hub) => hub.corridor.toLowerCase().includes(clean) || clean.includes(hub.corridor.toLowerCase())
  );
}

/**
 * Tìm Trạm đón ảo gần nhất với toạ độ GPS cho trước
 */
export function findNearestVirtualHub(lat, lng, corridorKey = null) {
  if (lat == null || lng == null) return null;
  const hubs = corridorKey ? getVirtualHubsByCorridor(corridorKey) : VIRTUAL_HUBS;
  if (hubs.length === 0) return null;

  let bestHub = null;
  let minDistance = Infinity;

  for (const hub of hubs) {
    const dLat = ((hub.lat - lat) * Math.PI) / 180;
    const dLng = ((hub.lng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat * Math.PI) / 180) * Math.cos((hub.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (dist < minDistance) {
      minDistance = dist;
      bestHub = { ...hub, distanceKm: Math.round(dist * 10) / 10 };
    }
  }

  return bestHub;
}

/**
 * Lấy thông tin Trạm đón ảo theo mã ID trạm (hỗ trợ cả slug linh hoạt)
 */
export function getVirtualHubById(hubId) {
  if (!hubId) return null;
  const clean = String(hubId).trim().toLowerCase().replace(/-/g, '_');
  return (
    VIRTUAL_HUBS.find(
      (hub) =>
        hub.id.toLowerCase() === clean ||
        hub.id.toLowerCase().replace(/-/g, '_') === clean ||
        hub.id.toLowerCase().includes(clean)
    ) || null
  );
}

/**
 * BẢNG ĐỊNH GIÁ PHÂN ĐOẠN CỐ ĐỊNH HÀNH LANG QL13 (METRO TARIFF ON QL13)
 * MIT Invariants: Cước phí phân đoạn cố định như vé metro, bảo đảm minh bạch 100%.
 * Tuyệt đối KHÔNG surge pricing (no_surge: true) vào giờ cao điểm, ban đêm hay mưa bão.
 */
export const CORRIDOR_FIXED_SEGMENTS = {
  // Bình Long ➔ Hàng Xanh: 130.000đ (Chủ xe nhận 234k/2 ghế)
  'hub_ql13_binh_long:::hub_ql13_hang_xanh': { pricePerSeat: 130000, distanceKm: 115, label: 'Bình Long ➔ Hàng Xanh' },
  'hub_ql13_binh_long:::hub_ql13_binh_trieu': { pricePerSeat: 130000, distanceKm: 110, label: 'Bình Long ➔ Bình Triệu' },
  'hub_ql13_binh_long:::hub_ql13_nga4_binh_phuoc': { pricePerSeat: 125000, distanceKm: 105, label: 'Bình Long ➔ Ngã 4 Bình Phước' },
  'hub_ql13_binh_long:::hub_ql13_nga4_chon_thanh': { pricePerSeat: 45000, distanceKm: 40, label: 'Bình Long ➔ Chơn Thành' },
  'hub_ql13_binh_long:::hub_n2_chon_thanh': { pricePerSeat: 45000, distanceKm: 40, label: 'Bình Long ➔ Chơn Thành' },
  'hub_ql13_binh_long:::hub_ql13_tan_khai': { pricePerSeat: 30000, distanceKm: 25, label: 'Bình Long ➔ Tân Khai' },

  // Tân Khai ➔ Hàng Xanh: 110.000đ (Chủ xe nhận 198k/2 ghế)
  'hub_ql13_tan_khai:::hub_ql13_hang_xanh': { pricePerSeat: 110000, distanceKm: 95, label: 'Tân Khai ➔ Hàng Xanh' },
  'hub_ql13_tan_khai:::hub_ql13_binh_trieu': { pricePerSeat: 110000, distanceKm: 90, label: 'Tân Khai ➔ Bình Triệu' },
  'hub_ql13_tan_khai:::hub_ql13_nga4_binh_phuoc': { pricePerSeat: 105000, distanceKm: 85, label: 'Tân Khai ➔ Ngã 4 Bình Phước' },
  'hub_ql13_tan_khai:::hub_ql13_nga4_chon_thanh': { pricePerSeat: 35000, distanceKm: 20, label: 'Tân Khai ➔ Chơn Thành' },
  'hub_ql13_tan_khai:::hub_n2_chon_thanh': { pricePerSeat: 35000, distanceKm: 20, label: 'Tân Khai ➔ Chơn Thành' },
  'hub_ql13_tan_khai:::hub_ql13_binh_long': { pricePerSeat: 30000, distanceKm: 25, label: 'Tân Khai ➔ Bình Long' },

  // Chơn Thành ➔ Hàng Xanh: 90.000đ (Chủ xe nhận 162k/2 ghế)
  'hub_ql13_nga4_chon_thanh:::hub_ql13_hang_xanh': { pricePerSeat: 90000, distanceKm: 75, label: 'Chơn Thành ➔ Hàng Xanh' },
  'hub_ql13_nga4_chon_thanh:::hub_ql13_binh_trieu': { pricePerSeat: 90000, distanceKm: 70, label: 'Chơn Thành ➔ Bình Triệu' },
  'hub_ql13_nga4_chon_thanh:::hub_ql13_nga4_binh_phuoc': { pricePerSeat: 85000, distanceKm: 65, label: 'Chơn Thành ➔ Ngã 4 Bình Phước' },
  'hub_ql13_nga4_chon_thanh:::hub_ql13_binh_long': { pricePerSeat: 45000, distanceKm: 40, label: 'Chơn Thành ➔ Bình Long' },
  'hub_ql13_nga4_chon_thanh:::hub_ql13_tan_khai': { pricePerSeat: 35000, distanceKm: 20, label: 'Chơn Thành ➔ Tân Khai' },
  'hub_n2_chon_thanh:::hub_ql13_hang_xanh': { pricePerSeat: 90000, distanceKm: 75, label: 'Chơn Thành ➔ Hàng Xanh' },
  'hub_n2_chon_thanh:::hub_ql13_binh_long': { pricePerSeat: 45000, distanceKm: 40, label: 'Chơn Thành ➔ Bình Long' },

  // Lộc Ninh / Bù Đốp
  'hub_ql13_cho_loc_ninh:::hub_ql13_hang_xanh': { pricePerSeat: 150000, distanceKm: 135, label: 'Lộc Ninh ➔ Hàng Xanh' },
  'hub_ql13_cho_loc_ninh:::hub_ql13_nga4_chon_thanh': { pricePerSeat: 65000, distanceKm: 60, label: 'Lộc Ninh ➔ Chơn Thành' },
  'hub_ql13_cho_loc_ninh:::hub_ql13_binh_long': { pricePerSeat: 35000, distanceKm: 25, label: 'Lộc Ninh ➔ Bình Long' },
  'hub_ql13_budop:::hub_ql13_hang_xanh': { pricePerSeat: 160000, distanceKm: 155, label: 'Bù Đốp ➔ Hàng Xanh' },
  'hub_ql13_budop:::hub_ql13_nga4_chon_thanh': { pricePerSeat: 75000, distanceKm: 80, label: 'Bù Đốp ➔ Chơn Thành' },
  'hub_ql13_budop:::hub_ql13_binh_long': { pricePerSeat: 45000, distanceKm: 45, label: 'Bù Đốp ➔ Bình Long' }
};

export const DRIVER_STATION_PAYOUT_RATIO = 0.9; // Chủ xe nhận 90% cước chia sẻ cố định

/**
 * Tra cứu bảng cước phân đoạn cố định Metro Tariff dọc hành lang
 */
export function getFixedSegmentTariff(originHubId, destHubId) {
  if (!originHubId || !destHubId) {
    return {
      pricePerSeat: 110000,
      driverPayoutPerSeat: 99000,
      driverPayoutFor2Seats: 198000,
      distanceKm: 95,
      noSurge: true,
      label: 'Tân Khai ➔ Hàng Xanh'
    };
  }

  const cleanOrigin = String(originHubId).trim().toLowerCase();
  const cleanDest = String(destHubId).trim().toLowerCase();

  const keyForward = `${cleanOrigin}:::${cleanDest}`;
  const keyReverse = `${cleanDest}:::${cleanOrigin}`;

  const match = CORRIDOR_FIXED_SEGMENTS[keyForward] || CORRIDOR_FIXED_SEGMENTS[keyReverse];

  if (match) {
    const pricePerSeat = match.pricePerSeat;
    const driverPayoutPerSeat = Math.round(pricePerSeat * DRIVER_STATION_PAYOUT_RATIO);
    return {
      pricePerSeat,
      driverPayoutPerSeat,
      driverPayoutFor2Seats: driverPayoutPerSeat * 2,
      distanceKm: match.distanceKm,
      noSurge: true,
      label: match.label
    };
  }

  // Fallback tính theo khoảng cách Haversine nếu trạm chưa nằm trong bảng chi tiết
  const h1 = getVirtualHubById(originHubId);
  const h2 = getVirtualHubById(destHubId);
  let distanceKm = 95;
  if (h1 && h2) {
    const dLat = ((h2.lat - h1.lat) * Math.PI) / 180;
    const dLng = ((h2.lng - h1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((h1.lat * Math.PI) / 180) * Math.cos((h2.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    distanceKm = Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.28);
  }

  let pricePerSeat = 110000;
  if (distanceKm <= 30) pricePerSeat = 35000;
  else if (distanceKm <= 50) pricePerSeat = 45000;
  else if (distanceKm <= 80) pricePerSeat = 90000;
  else if (distanceKm <= 100) pricePerSeat = 110000;
  else if (distanceKm <= 125) pricePerSeat = 130000;
  else if (distanceKm <= 145) pricePerSeat = 150000;
  else pricePerSeat = 160000;

  const driverPayoutPerSeat = Math.round(pricePerSeat * DRIVER_STATION_PAYOUT_RATIO);

  return {
    pricePerSeat,
    driverPayoutPerSeat,
    driverPayoutFor2Seats: driverPayoutPerSeat * 2,
    distanceKm,
    noSurge: true,
    label: `${h1?.shortName || originHubId} ➔ ${h2?.shortName || destHubId}`
  };
}

