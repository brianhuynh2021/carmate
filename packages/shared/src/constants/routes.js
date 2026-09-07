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
    botFee: 190000, // Vé cao tốc Hà Nội - Hải Phòng (Nút Cổ Linh - Đình Vũ)
    suggestedRate: 150000,
    minSafePrice: 100000,
    maxSafePrice: 280000,
    marketLimoRef: '220.000đ - 250.000đ',
    traditionalBusRef: '150.000đ - 180.000đ',
    calculationBasis:
      '105km cao tốc 5B Hà Nội - Hải Phòng. Xăng ~160k + vé cao tốc 190k = 350.000đ chi phí toàn xe. Ghép 2-3 người chia sẻ ~130k - 150k/ghế.'
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
    botFee: 110000, // Vé qua hầm Hải Vân + Trạm Phú Bài
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
      '140km x 1.500đ xăng/km + 70.000đ vé cầu đường = 280.000đ chi phí xe. Ghép 2-3 người chia sẻ ~150k - 180k/ghế.'
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
      '100km x 1.500đ xăng/km + 98.000đ vé cao tốc = 248.000đ chi phí xe. Ghép chia sẻ ~140k - 160k/ghế.'
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
    calculationBasis: 'Đèo Bảo Lộc + Cao tốc Dầu Giây. Chia sẻ chi phí nhiên liệu & vé cầu đường qua đèo.'
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
    calculationBasis: '95km QL22 + vé cầu đường An Sương. Chia sẻ hợp lý 100k - 120k/ghế.'
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
  }
};
