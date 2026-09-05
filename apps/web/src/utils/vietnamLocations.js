/**
 * VIETNAM TRANSPORTATION HUBS & LOCATION PRESETS
 * Cung cấp dữ liệu chuẩn mực cho tính năng Location Suggestion theo chuẩn Grab / Google Maps
 */

export const POPULAR_LOCATIONS = [
  // ── BÌNH PHƯỚC & ĐÔNG NAM BỘ (TUYẾN QL13 & QL14) ──
  {
    name: 'Trung tâm Hành chính Huyện Hớn Quản',
    category: 'building',
    detail: 'Khu phố 3, TT. Tân Khai, Huyện Hớn Quản, Bình Phước',
    icon: 'building',
    keywords: ['tan khai', 'hon quan', 'trung tam hanh chinh', 'binh phuoc']
  },
  {
    name: 'Trung tâm Y tế Khu vực Hớn Quản',
    category: 'hospital',
    detail: 'Quốc lộ 13, Phường Tân Khai, Huyện Hớn Quản, Bình Phước',
    icon: 'hospital',
    keywords: ['benh vien hon quan', 'tan khai', 'y te', 'ql13']
  },
  {
    name: 'Chợ Tân Khai (Hớn Quản)',
    category: 'building',
    detail: 'Đường ĐT756C & Quốc lộ 13, TT. Tân Khai, Hớn Quản, Bình Phước',
    icon: 'building',
    keywords: ['cho tan khai', 'hon quan', 'binh phuoc']
  },
  {
    name: 'Cổng chào TX. Bình Long',
    category: 'highway',
    detail: 'Quốc lộ 13, Phường An Lộc, TX. Bình Long, Bình Phước',
    icon: 'highway',
    keywords: ['binh long', 'an loc', 'cong chao', 'binh phuoc']
  },
  {
    name: 'Ngã 4 Chơn Thành',
    category: 'highway',
    detail: 'Giao lộ QL13 & QL14, Phường Hưng Long, TX. Chơn Thành, Bình Phước',
    icon: 'highway',
    keywords: ['chon thanh', 'nga 4 chon thanh', 'nga tu chon thanh', 'ql13', 'ql14']
  },
  {
    name: 'Cây xăng Petrolimex 17 (Lộc Ninh)',
    category: 'station',
    detail: 'Quốc lộ 13, Xã Lộc Hưng, Huyện Lộc Ninh, Bình Phước',
    icon: 'station',
    keywords: ['cay xang 17', 'loc ninh', 'loc hung', 'binh phuoc']
  },
  {
    name: 'Bến xe Thành phố Đồng Xoài',
    category: 'station',
    detail: 'Đường Phú Riềng Đỏ, Phường Tân Bình, TP. Đồng Xoài, Bình Phước',
    icon: 'station',
    keywords: ['dong xoai', 'ben xe dong xoai', 'phu rieng do']
  },
  {
    name: 'Bình Phước',
    category: 'city',
    detail: 'Lộc Ninh / Tân Khai / Chơn Thành / Đồng Xoài',
    icon: 'city',
    keywords: ['binh phuoc']
  },

  // ── TP. HỒ CHÍ MINH (ĐIỂM ĐÓN TRẢ TRỌNG ĐIỂM) ──
  {
    name: 'Nhà khách Quân đội (Cống Quỳnh)',
    category: 'building',
    detail: '168 Cống Quỳnh, Phường Phạm Ngũ Lão, Quận 1, TP. Hồ Chí Minh',
    icon: 'building',
    keywords: ['nha khach quan doi', 'cong quynh', 'quan 1', 'pham ngu lao', 'sai gon']
  },
  {
    name: 'Đường Cống Quỳnh (Quận 1)',
    category: 'street',
    detail: 'Phường Bến Thành & Cầu Ông Lãnh, Quận 1, TP. Hồ Chí Minh',
    icon: 'street',
    keywords: ['cong quynh', 'quan 1', 'ben thanh', 'cau ong lanh']
  },
  {
    name: 'Bệnh viện Từ Dũ (Cống Quỳnh)',
    category: 'hospital',
    detail: '284 Cống Quỳnh, Phường Phạm Ngũ Lão, Quận 1, TP. Hồ Chí Minh',
    icon: 'hospital',
    keywords: ['tu du', 'benh vien tu du', 'cong quynh', 'quan 1']
  },
  {
    name: 'Bến xe Miền Đông mới',
    category: 'station',
    detail: '501 Hoàng Hữu Nam, TP. Thủ Đức, TP.HCM (Xa Lộ Hà Nội)',
    icon: 'station',
    keywords: ['ben xe mien dong moi', 'mien dong moi', 'thu duc', 'xa lo ha noi']
  },
  {
    name: 'Bến xe Miền Đông cũ (Cầu Bình Triệu)',
    category: 'station',
    detail: '292 Đinh Bộ Lĩnh, Phường 26, Quận Bình Thạnh, TP.HCM',
    icon: 'station',
    keywords: ['ben xe mien dong cu', 'dinh bo linh', 'binh thanh', 'cau binh trieu']
  },
  {
    name: 'Bến xe Miền Tây',
    category: 'station',
    detail: '395 Kinh Dương Vương, Phường An Lạc, Quận Bình Tân, TP.HCM',
    icon: 'station',
    keywords: ['ben xe mien tay', 'kinh duong vuong', 'binh tan', 'an lac']
  },
  {
    name: 'Bến xe An Sương',
    category: 'station',
    detail: 'Quốc lộ 22, Xã Bà Điểm, Huyện Hóc Môn / Quận 12, TP.HCM',
    icon: 'station',
    keywords: ['ben xe an suong', 'an suong', 'ql22', 'hoc mon', 'quan 12']
  },
  {
    name: 'Ngã tư Hàng Xanh',
    category: 'highway',
    detail: 'Điện Biên Phủ & Xô Viết Nghệ Tĩnh, Quận Bình Thạnh, TP.HCM',
    icon: 'highway',
    keywords: ['hang xanh', 'nga tu hang xanh', 'binh thanh', 'dien bien phu']
  },
  {
    name: 'Ngã tư Bình Phước (Thủ Đức)',
    category: 'highway',
    detail: 'Nút giao QL1A & QL13, Phường Hiệp Bình Phước, TP. Thủ Đức, TP.HCM',
    icon: 'highway',
    keywords: ['nga 4 binh phuoc', 'nga tu binh phuoc', 'thu duc', 'ql13', 'ql1a']
  },
  {
    name: 'Sân bay Quốc tế Tân Sơn Nhất',
    category: 'airport',
    detail: 'Đường Trường Sơn, Phường 2, Quận Tân Bình, TP.HCM (Nhà ga T1, T2)',
    icon: 'airport',
    keywords: ['san bay tan son nhat', 'tan son nhat', 'tan binh', 'truong son']
  },
  {
    name: 'Chợ Bến Thành',
    category: 'building',
    detail: 'Đường Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    icon: 'building',
    keywords: ['cho ben thanh', 'ben thanh', 'quan 1', 'le loi']
  },
  {
    name: 'Sài Gòn (TP.HCM)',
    category: 'city',
    detail: 'Trung tâm TP. Hồ Chí Minh (Quận 1, 3, Bình Thạnh, Thủ Đức...)',
    icon: 'city',
    keywords: ['sai gon', 'tp.hcm', 'tp hcm', 'ho chi minh']
  },

  // ── MIỀN BẮC ──
  {
    name: 'Hà Nội',
    category: 'city',
    detail: 'Thủ đô Hà Nội',
    icon: 'city',
    keywords: ['ha noi']
  },
  {
    name: 'Bến xe Mỹ Đình',
    category: 'station',
    detail: 'Số 20 Phạm Hùng, Phường Mỹ Đình 2, Nam Từ Liêm, Hà Nội',
    icon: 'station',
    keywords: ['ben xe my dinh', 'my dinh', 'pham hung', 'nam tu liem', 'ha noi']
  },
  {
    name: 'Bến xe Giáp Bát',
    category: 'station',
    detail: 'Km6 Đường Giải Phóng, Phường Giáp Bát, Hoàng Mai, Hà Nội',
    icon: 'station',
    keywords: ['ben xe giap bat', 'giap bat', 'giai phong', 'hoang mai', 'ha noi']
  },
  {
    name: 'Bến xe Nước Ngầm',
    category: 'station',
    detail: 'Số 1 Ngọc Hồi, Phường Hoàng Liệt, Hoàng Mai, Hà Nội',
    icon: 'station',
    keywords: ['ben xe nuoc ngam', 'nuoc ngam', 'ngoc hoi', 'hoang mai', 'ha noi']
  },
  {
    name: 'Bến xe Gia Lâm',
    category: 'station',
    detail: 'Số 9 Ngô Gia Khảm, Phường Gia Thụy, Long Biên, Hà Nội',
    icon: 'station',
    keywords: ['ben xe gia lam', 'gia lam', 'long bien', 'ha noi']
  },
  {
    name: 'Sân bay Quốc tế Nội Bài',
    category: 'airport',
    detail: 'Xã Phú Minh, Huyện Sóc Sơn, Hà Nội (Nhà ga T1, T2)',
    icon: 'airport',
    keywords: ['san bay noi bai', 'noi bai', 'soc son', 'ha noi']
  },
  {
    name: 'Nút giao Cổ Linh (Cao tốc 5B)',
    category: 'highway',
    detail: 'Long Biên, Hà Nội ➔ Hải Phòng (Đầu cao tốc Hà Nội - Hải Phòng)',
    icon: 'highway',
    keywords: ['nut giao co linh', 'co linh', 'cao toc 5b', 'long bien', 'ha noi']
  },
  {
    name: 'Hải Phòng',
    category: 'city',
    detail: 'Thành phố Cảng Hải Phòng',
    icon: 'city',
    keywords: ['hai phong']
  },
  {
    name: 'Bến xe Vĩnh Niệm',
    category: 'station',
    detail: 'Đường Bùi Viện, Phường Vĩnh Niệm, Lê Chân, Hải Phòng',
    icon: 'station',
    keywords: ['ben xe vinh niem', 'vinh niem', 'bui vien', 'hai phong']
  },
  {
    name: 'Bến xe Cầu Rào',
    category: 'station',
    detail: 'Số 1 Thiên Lôi, Phường Đằng Giang, Ngô Quyền, Hải Phòng',
    icon: 'station',
    keywords: ['ben xe cau rao', 'cau rao', 'thien loi', 'hai phong']
  },
  {
    name: 'Sân bay Cát Bi',
    category: 'airport',
    detail: 'Đường Lê Hồng Phong, Hải An, Hải Phòng',
    icon: 'airport',
    keywords: ['san bay cat bi', 'cat bi', 'hai an', 'hai phong']
  },
  {
    name: 'Quảng Ninh',
    category: 'city',
    detail: 'Hạ Long / Bãi Cháy / Cẩm Phả / Móng Cái',
    icon: 'city',
    keywords: ['quang ninh', 'ha long']
  },
  {
    name: 'Bến xe Bãi Cháy',
    category: 'station',
    detail: 'Số 17 Đường 279, Phường Bãi Cháy, TP. Hạ Long, Quảng Ninh',
    icon: 'station',
    keywords: ['ben xe bai chay', 'bai chay', 'ha long', 'quang ninh']
  },
  {
    name: 'Trạm dừng chân V52 (Hải Dương)',
    category: 'highway',
    detail: 'Cao tốc 5B Hà Nội - Hải Phòng, Gia Lộc, Hải Dương',
    icon: 'highway',
    keywords: ['tram dung v52', 'v52', 'hai duong', 'gia loc']
  },
  {
    name: 'Ninh Bình',
    category: 'city',
    detail: 'TP. Ninh Bình / Tam Điệp / QL1A',
    icon: 'city',
    keywords: ['ninh binh', 'tam diep']
  },
  {
    name: 'Nam Định',
    category: 'city',
    detail: 'Bến xe Nam Định / Đền Trần',
    icon: 'city',
    keywords: ['nam dinh']
  },

  // ── MIỀN TRUNG ──
  {
    name: 'Đà Nẵng',
    category: 'city',
    detail: 'Trung tâm TP. Đà Nẵng',
    icon: 'city',
    keywords: ['da nang']
  },
  {
    name: 'Bến xe Trung tâm Đà Nẵng',
    category: 'station',
    detail: 'Số 185 Tôn Đức Thắng, Phường Hòa Minh, Liên Chiểu, Đà Nẵng',
    icon: 'station',
    keywords: ['ben xe da nang', 'ton duc thang', 'lien chieu', 'da nang']
  },
  {
    name: 'Sân bay Quốc tế Đà Nẵng',
    category: 'airport',
    detail: 'Đường Duy Tân, Phường Hòa Thuận Tây, Hải Châu, Đà Nẵng',
    icon: 'airport',
    keywords: ['san bay da nang', 'duy tan', 'hai chau', 'da nang']
  },
  {
    name: 'Huế',
    category: 'city',
    detail: 'TP. Huế (Bến xe Phía Nam / Phía Bắc)',
    icon: 'city',
    keywords: ['hue', 'thua thien hue']
  },
  {
    name: 'Hội An',
    category: 'city',
    detail: 'Phố cổ Hội An, Quảng Nam',
    icon: 'city',
    keywords: ['hoi an', 'quang nam']
  },
  {
    name: 'Quy Nhơn (Bình Định)',
    category: 'city',
    detail: 'Bến xe Quy Nhơn, Tỉnh Bình Định',
    icon: 'city',
    keywords: ['quy nhon', 'binh dinh']
  },
  {
    name: 'Nha Trang (Khánh Hòa)',
    category: 'city',
    detail: 'Bến xe Phía Nam Nha Trang, Khánh Hòa',
    icon: 'city',
    keywords: ['nha trang', 'khanh hoa']
  },

  // ── MIỀN ĐÔNG & TÂY NGUYÊN ──
  {
    name: 'Vũng Tàu',
    category: 'city',
    detail: 'Bến xe Vũng Tàu / Đường 30/4 / Bãi Trước / Bãi Sau',
    icon: 'city',
    keywords: ['vung tau', 'ba ria']
  },
  {
    name: 'Bà Rịa',
    category: 'city',
    detail: 'Cổng chào TP. Bà Rịa (QL51)',
    icon: 'city',
    keywords: ['ba ria', 'cong chao ba ria', 'ql51']
  },
  {
    name: 'Bến xe Thành phố Vũng Tàu',
    category: 'station',
    detail: 'Số 192 Nam Kỳ Khởi Nghĩa, Phường Thắng Tam, TP. Vũng Tàu',
    icon: 'station',
    keywords: ['ben xe vung tau', 'nam ky khoi nghia', 'vung tau']
  },
  {
    name: 'Trạm dừng chân Long Thành',
    category: 'highway',
    detail: 'Cao tốc Long Thành - Dầu Giây, Huyện Long Thành, Đồng Nai',
    icon: 'highway',
    keywords: ['long thanh', 'tram dung long thanh', 'cao toc long thanh']
  },
  {
    name: 'Đà Lạt (Lâm Đồng)',
    category: 'city',
    detail: 'Bến xe Liên tỉnh Đà Lạt (Đường 3/4)',
    icon: 'city',
    keywords: ['da lat', 'lam dong']
  },
  {
    name: 'Bảo Lộc (Lâm Đồng)',
    category: 'city',
    detail: 'Bến xe Bảo Lộc, Trần Phú, Tỉnh Lâm Đồng',
    icon: 'city',
    keywords: ['bao loc', 'lam dong']
  },
  {
    name: 'Buôn Ma Thuột (Đắk Lắk)',
    category: 'city',
    detail: 'Bến xe Phía Nam Buôn Ma Thuột',
    icon: 'city',
    keywords: ['buon ma thuot', 'dak lak']
  },
  {
    name: 'Tây Ninh',
    category: 'city',
    detail: 'Bến xe Tây Ninh / Trảng Bàng / Gò Dầu',
    icon: 'city',
    keywords: ['tay ninh', 'trang bang', 'go dau']
  }
];

export const ROUTE_WAYPOINTS_MAP = {
  'hà nội-hải phòng': [
    'Nút giao Cổ Linh (Long Biên)',
    'Trạm dừng chân V52 (Hải Dương)',
    'Nút giao Yên Mỹ (Hưng Yên)',
    'Nút giao Gia Lộc (Hải Dương)',
    'Nút giao Tràng Duệ (An Dương)',
    'Bến xe Vĩnh Niệm',
    'Bến xe Cầu Rào'
  ],
  'hà nội-quảng ninh': [
    'Nút giao Cổ Linh (Cao tốc 5B)',
    'Cầu Bạch Đằng',
    'Trạm thu phí Đại Yên',
    'Bến xe Bãi Cháy',
    'Cột đồng hồ Hạ Long'
  ],
  'hà nội-ninh bình': [
    'Bến xe Giáp Bát / Nước Ngầm',
    'Nút giao Pháp Vân - Cầu Giẽ',
    'Trạm thu phí Liêm Tuyền (Hà Nam)',
    'Nút giao Mai Sơn (Ninh Bình)',
    'Cầu Non Nước'
  ],
  'bình phước-sài gòn': [
    'Cây xăng Petrolimex 17 (Lộc Ninh)',
    'Ngã 3 Lộc Tấn (QL13)',
    'Cổng chào TX. Bình Long',
    'TT. Tân Khai (Hớn Quản)',
    'Ngã 4 Chơn Thành (QL13 & QL14)',
    'KCN Bàu Bàng (Bến Cát)',
    'Khu du lịch Đại Nam (Thủ Dầu Một)',
    'Ngã 4 Bình Phước (Thủ Đức)',
    'Ngã tư Hàng Xanh'
  ],
  'vũng tàu-sài gòn': [
    'Bến xe Vũng Tàu',
    'Đài Liệt Sĩ / Bùng binh Dầu Khí',
    'Cổng chào Bà Rịa (QL51)',
    'KCN Phú Mỹ',
    'Trạm dừng Long Thành (Cao tốc)',
    'Nút giao Mai Chí Thọ (Sala)'
  ],
  'đà lạt-sài gòn': [
    'Bến xe Liên tỉnh Đà Lạt',
    'Đèo Prenn / Đức Trọng',
    'Bến xe Bảo Lộc',
    'Chân đèo Bảo Lộc / Madagui',
    'Ngã 3 Dầu Giây (Cao tốc)',
    'Suối Tiên / Hàng Xanh'
  ],
  'tây ninh-sài gòn': [
    'Bến xe Tây Ninh',
    'Ngã 3 Gò Dầu',
    'Ngã 3 Trảng Bàng',
    'Bến xe Củ Chi (Cầu vượt)',
    'Bến xe An Sương'
  ],
  'phan thiết-sài gòn': [
    'Vòng xoay Suối Cát (Phan Thiết)',
    'Nút giao Ba Bàu (Hàm Thuận Nam)',
    'Nút giao Dầu Giây (Cao tốc)',
    'Bến xe Miền Đông mới'
  ]
};

function removeAccents(str = '') {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Tìm gợi ý địa điểm cục bộ tức thời 0ms (Fuzzy token matching)
 */
export function searchLocations(query = '', limit = 8) {
  const clean = removeAccents(query);
  if (!clean) {
    return POPULAR_LOCATIONS.slice(0, limit);
  }

  const tokens = clean.split(/[\s,.-]+/).filter(t => t.length >= 2);

  const scored = POPULAR_LOCATIONS.map(item => {
    const normName = removeAccents(item.name);
    const normDetail = removeAccents(item.detail);
    const normKeywords = (item.keywords || []).map(k => removeAccents(k)).join(' ');

    let score = 0;
    if (normName.includes(clean)) score += 100;
    if (normDetail.includes(clean)) score += 60;
    if (normKeywords.includes(clean)) score += 80;

    tokens.forEach(token => {
      if (normName.includes(token)) score += 30;
      else if (normDetail.includes(token) || normKeywords.includes(token)) score += 15;
    });

    return { ...item, score };
  })
  .filter(item => item.score > 0)
  .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored.slice(0, limit);
  }

  // Fallback nếu không có kết quả khớp: Trả về địa điểm nổi bật + tuỳ chọn chính xác từ khoá người dùng
  return [
    {
      name: query,
      detail: 'Vị trí tuỳ chỉnh (Gõ trực tiếp)',
      category: 'building',
      isCustom: true
    },
    ...POPULAR_LOCATIONS.slice(0, Math.max(1, limit - 1))
  ];
}

/**
 * Gọi API gợi ý địa chỉ trực tuyến (OpenStreetMap / Backend API)
 */
export async function fetchLocationSuggestions(query = '', limit = 8) {
  if (!query || query.trim().length < 2) {
    return searchLocations('', limit);
  }

  try {
    const res = await fetch(`/api/locations/suggest?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[Location Service] Falling back to offline matcher:', err);
  }

  return searchLocations(query, limit);
}

/**
 * Lấy danh sách điểm mốc đề xuất cho tuyến đường cụ thể
 */
export function getSuggestedWaypoints(from = '', to = '') {
  const cleanFrom = removeAccents(from);
  const cleanTo = removeAccents(to);

  for (const [routeKey, waypoints] of Object.entries(ROUTE_WAYPOINTS_MAP)) {
    const [partA, partB] = routeKey.split('-');
    const normA = removeAccents(partA);
    const normB = removeAccents(partB);
    if (
      (cleanFrom.includes(normA) && cleanTo.includes(normB)) ||
      (cleanFrom.includes(normB) && cleanTo.includes(normA))
    ) {
      return waypoints;
    }
  }

  return [
    'Tiện đón dọc Quốc Lộ',
    'Các cây xăng lớn tiện đường',
    'Đón trả tại các nút giao cao tốc'
  ];
}
