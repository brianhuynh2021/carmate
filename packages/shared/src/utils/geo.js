/**
 * TIỆN ÍCH ĐỊNH VỊ ĐỊA LÝ & HÀNH LANG TUYẾN ĐƯỜNG LIÊN TỈNH (GEO & CORRIDORS)
 * Phục vụ trải nghiệm trực quan hóa bản đồ, điểm đón mốc thực tế và tính năng "Có gần tôi không?"
 */

// Công thức Haversine tính khoảng cách giữa 2 toạ độ GPS (đơn vị km)
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Bán kính trái đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function formatDistance(km) {
  if (km == null) return '';
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)} km`;
}

// Danh mục hành lang tuyến và các điểm mốc vàng (Cây xăng, Ngã tư, Bến xe, Cổng chào)
export const ROUTE_CORRIDORS = {
  'Tuyến QL13': {
    name: 'Bình Phước ⇄ Sài Gòn (QL13)',
    highway: 'Quốc Lộ 13',
    center: [11.35, 106.65],
    zoom: 9,
    startLandmark: {
      name: 'Cây xăng Petrolimex 17 (QL13, Lộc Ninh)',
      address: 'QL13, Xã Lộc Hưng, Huyện Lộc Ninh, Tỉnh Bình Phước',
      lat: 11.8385,
      lng: 106.5925
    },
    endLandmark: {
      name: 'Ngã tư Hàng Xanh / Bến xe Miền Đông mới',
      address: 'Điện Biên Phủ / Xô Viết Nghệ Tĩnh, Q. Bình Thạnh, TP.HCM',
      lat: 10.8012,
      lng: 106.7114
    },
    popularPickups: [
      'Cây xăng Petrolimex 17 (QL13, Lộc Ninh)',
      'Chợ Lộc Ninh (Khu phố Ninh Thịnh)',
      'Ngã 3 Lộc Tấn (Giao ĐT759 & QL13)',
      'Cổng chào TX. Bình Long (Bình Phước)',
      'Ngã 4 Chơn Thành (Giao QL13 & QL14)',
      'KCN Chơn Thành / KCN Minh Hưng',
      'Đại Nam / Bến Cát (Bình Dương)',
      'Ngã 4 Bình Phước (Thủ Đức - TP.HCM)'
    ],
    popularDropoffs: [
      'Ngã tư Hàng Xanh (Bình Thạnh, TP.HCM)',
      'Bến xe Miền Đông mới (TP. Thủ Đức)',
      'Bến xe Miền Đông cũ (Cầu Bình Triệu)',
      'Khu vực Quận 1 (Chợ Bến Thành / Hàm Nghi)',
      'Quận Tân Bình (Sân bay Tân Sơn Nhất)',
      'Đại học Bách Khoa / Q.10'
    ],
    waypoints: [
      {
        name: 'Cây xăng 17 QL13 (Lộc Ninh)',
        sub: 'Điểm xuất phát đầu tuyến',
        lat: 11.8385,
        lng: 106.5925,
        isStart: true,
        type: 'pickup'
      },
      {
        name: 'Chợ Lộc Ninh',
        sub: 'Khu phố Ninh Thịnh',
        lat: 11.8421,
        lng: 106.5972,
        type: 'pickup'
      },
      {
        name: 'Cổng chào TX. Bình Long',
        sub: 'Đón dọc QL13',
        lat: 11.6482,
        lng: 106.6025,
        type: 'waypoint'
      },
      {
        name: 'Ngã 4 Chơn Thành',
        sub: 'Nút giao QL13 & QL14',
        lat: 11.4791,
        lng: 106.6694,
        type: 'waypoint'
      },
      {
        name: 'KCN Bàu Bàng / Mỹ Phước 3',
        sub: 'Bến Cát, Bình Dương',
        lat: 11.1682,
        lng: 106.6115,
        type: 'waypoint'
      },
      {
        name: 'TP. Thủ Dầu Một',
        sub: 'Khu du lịch Đại Nam / Ngã 4 Sở Sao',
        lat: 11.0285,
        lng: 106.6341,
        type: 'waypoint'
      },
      {
        name: 'Cổng chào Bình Dương / Lái Thiêu',
        sub: 'Đầu cầu Vĩnh Bình',
        lat: 10.9165,
        lng: 106.6982,
        type: 'waypoint'
      },
      {
        name: 'Ngã 4 Bình Phước (Thủ Đức)',
        sub: 'Cửa ngõ Đông Bắc TP.HCM',
        lat: 10.8652,
        lng: 106.7214,
        type: 'dropoff'
      },
      {
        name: 'Cầu Bình Triệu / Bến xe Miền Đông cũ',
        sub: 'Quận Bình Thạnh',
        lat: 10.8194,
        lng: 106.7112,
        type: 'dropoff'
      },
      {
        name: 'Ngã tư Hàng Xanh',
        sub: 'Điểm trả trung tâm Bình Thạnh',
        lat: 10.8012,
        lng: 106.7114,
        type: 'dropoff'
      },
      {
        name: 'Bến xe Miền Đông mới (Q9)',
        sub: 'Xa Lộ Hà Nội, TP. Thủ Đức',
        lat: 10.8814,
        lng: 106.8291,
        isEnd: true,
        type: 'dropoff'
      }
    ]
  },

  'Tuyến QL51': {
    name: 'Vũng Tàu ⇄ Sài Gòn (Cao Tốc Long Thành & QL51)',
    highway: 'QL51 & Cao tốc Long Thành - Dầu Giây',
    center: [10.55, 106.9],
    zoom: 9,
    startLandmark: {
      name: 'Cây xăng Thắng Nhất, Đường 30/4, TP. Vũng Tàu',
      address: 'Đường 30/4, Phường Thắng Nhất, TP. Vũng Tàu',
      lat: 10.3782,
      lng: 107.0954
    },
    endLandmark: {
      name: 'Hàng Xanh / Quận 1 / Mai Chí Thọ, TP.HCM',
      address: 'Khu đô thị Sala / Mai Chí Thọ, TP. Thủ Đức',
      lat: 10.7712,
      lng: 106.6985
    },
    popularPickups: [
      'Cây xăng Thắng Nhất, Đường 30/4, Vũng Tàu',
      'Bến xe Vũng Tàu (Đường Nam Kỳ Khởi Nghĩa)',
      'Bùng binh Dầu Khí / Đài Liệt Sĩ Vũng Tàu',
      'Cổng chào TP. Bà Rịa (QL51)',
      'KCN Phú Mỹ (Thị xã Phú Mỹ)',
      'Trạm dừng chân Mekong (Long Thành)'
    ],
    popularDropoffs: [
      'Nút giao Mai Chí Thọ (Sala / Hầm Thủ Thiêm)',
      'Ngã tư Hàng Xanh (Bình Thạnh)',
      'Bến xe Miền Đông mới (Thủ Đức)',
      'Chợ Bến Thành / Quận 1'
    ],
    waypoints: [
      { name: 'Bến xe Vũng Tàu', sub: 'Xuất phát TP. Vũng Tàu', lat: 10.3541, lng: 107.0851, isStart: true, type: 'pickup' },
      { name: 'TP. Bà Rịa', sub: 'Cổng chào Bà Rịa QL51', lat: 10.4952, lng: 107.1685, type: 'waypoint' },
      { name: 'Thị xã Phú Mỹ', sub: 'Dọc QL51 cổng KCN', lat: 10.6015, lng: 107.0542, type: 'waypoint' },
      { name: 'Trạm dừng chân Long Thành', sub: 'Nút vào Cao tốc', lat: 10.7412, lng: 106.9582, type: 'waypoint' },
      { name: 'Nút giao Vành Đai 2 / Mai Chí Thọ', sub: 'Đầu TP. Thủ Đức', lat: 10.7925, lng: 106.7725, type: 'dropoff' },
      { name: 'Ngã tư Hàng Xanh / Q1', sub: 'Điểm cuối TP.HCM', lat: 10.8012, lng: 106.7114, isEnd: true, type: 'dropoff' }
    ]
  },

  'Tuyến QL20': {
    name: 'Bảo Lộc / Đà Lạt ⇄ Sài Gòn (QL20)',
    highway: 'Quốc Lộ 20 & Cao tốc Dầu Giây',
    center: [11.45, 107.5],
    zoom: 8,
    startLandmark: {
      name: 'Quảng trường Lâm Viên / Bến xe Đà Lạt',
      address: 'Trần Quốc Toản, Phường 1, TP. Đà Lạt',
      lat: 11.9362,
      lng: 108.4452
    },
    endLandmark: {
      name: 'Suối Tiên / Ngã tư Hàng Xanh, TP.HCM',
      address: 'Xa Lộ Hà Nội, TP.HCM',
      lat: 10.8012,
      lng: 106.7114
    },
    popularPickups: [
      'Bến xe Liên tỉnh Đà Lạt (Đường 3 Tháng 4)',
      'Bến xe Bảo Lộc (Trần Phú, Lộc Sơn)',
      'Chân Đèo Bảo Lộc / Madagui',
      'Định Quán / Tân Phú (Đồng Nai)',
      'Ngã 3 Dầu Giây (Cao tốc)'
    ],
    popularDropoffs: [
      'Suối Tiên (TP. Thủ Đức)',
      'Ngã tư Hàng Xanh (Bình Thạnh)',
      'Sân bay Tân Sơn Nhất'
    ],
    waypoints: [
      { name: 'Bến xe Đà Lạt', sub: 'Đầu tuyến Lâm Đồng', lat: 11.9254, lng: 108.4412, isStart: true, type: 'pickup' },
      { name: 'Bến xe Bảo Lộc', sub: 'Trần Phú, TP. Bảo Lộc', lat: 11.5425, lng: 107.8085, type: 'waypoint' },
      { name: 'Madagui / Đạ Huoai', sub: 'Chân đèo Bảo Lộc', lat: 11.4015, lng: 107.5452, type: 'waypoint' },
      { name: 'Ngã 3 Dầu Giây', sub: 'Vào cao tốc Long Thành', lat: 10.9652, lng: 107.1354, type: 'waypoint' },
      { name: 'Ngã tư Hàng Xanh (TP.HCM)', sub: 'Điểm trả trung tâm', lat: 10.8012, lng: 106.7114, isEnd: true, type: 'dropoff' }
    ]
  },

  'Tuyến QL1A': {
    name: 'Phan Thiết ⇄ Sài Gòn (Cao Tốc Dầu Giây)',
    highway: 'Cao tốc Phan Thiết - Dầu Giây & QL1A',
    center: [10.9, 107.6],
    zoom: 8,
    startLandmark: {
      name: 'Cây xăng số 5, Trần Hưng Đạo, TP. Phan Thiết',
      address: 'Trần Hưng Đạo, TP. Phan Thiết, Bình Thuận',
      lat: 10.9324,
      lng: 108.0991
    },
    endLandmark: {
      name: 'Bến xe Miền Đông mới / Ngã 4 Hàng Xanh',
      address: 'TP. Thủ Đức / Bình Thạnh, TP.HCM',
      lat: 10.8012,
      lng: 106.7114
    },
    popularPickups: [
      'Cây xăng số 5, Trần Hưng Đạo, Phan Thiết',
      'Vòng xoay Suối Cát (Đầu Cao Tốc)',
      'Hàm Tân / La Gi (Bình Thuận)',
      'Xuân Lộc (Đồng Nai)'
    ],
    popularDropoffs: [
      'Bến xe Miền Đông mới (Thủ Đức)',
      'Ngã tư Hàng Xanh (Bình Thạnh)',
      'Quận 1 / Bến Thành'
    ],
    waypoints: [
      { name: 'Vòng xoay Suối Cát (Phan Thiết)', sub: 'Đầu cao tốc Phan Thiết', lat: 10.9215, lng: 108.0752, isStart: true, type: 'pickup' },
      { name: 'Nút giao Ba Bàu (Hàm Thuận Nam)', sub: 'Điểm đón cao tốc', lat: 10.8845, lng: 107.9852, type: 'waypoint' },
      { name: 'Nút giao Dầu Giây', sub: 'Chuyển tiếp cao tốc LT-DG', lat: 10.9652, lng: 107.1354, type: 'waypoint' },
      { name: 'Bến xe Miền Đông mới', sub: 'Điểm trả TP.HCM', lat: 10.8814, lng: 106.8291, isEnd: true, type: 'dropoff' }
    ]
  },

  'Tuyến QL22': {
    name: 'Tây Ninh ⇄ Sài Gòn (QL22)',
    highway: 'Quốc Lộ 22',
    center: [11.1, 106.3],
    zoom: 9,
    startLandmark: {
      name: 'Bến xe Tây Ninh (Đường Trưng Nữ Vương)',
      address: 'Phường 2, TP. Tây Ninh',
      lat: 11.3092,
      lng: 106.0984
    },
    endLandmark: {
      name: 'Ngã tư An Sương / Bến xe An Sương, TP.HCM',
      address: 'Quốc Lộ 22, Quận 12, TP.HCM',
      lat: 10.8462,
      lng: 106.6134
    },
    popularPickups: [
      'Bến xe Tây Ninh (Đường Trưng Nữ Vương)',
      'Ngã 3 Trảng Bàng (QL22)',
      'Thị trấn Gò Dầu (Cầu Gò Dầu)',
      'KCN Trảng Bàng / KCN Linh Trung 3',
      'Củ Chi (Cầu vượt Củ Chi / Bến xe Củ Chi)'
    ],
    popularDropoffs: [
      'Bến xe An Sương (Quận 12)',
      'Ngã 4 Bảy Hiền (Tân Bình)',
      'Quận 10 / Bệnh viện 115'
    ],
    waypoints: [
      { name: 'Bến xe Tây Ninh', sub: 'Trung tâm TP. Tây Ninh', lat: 11.3092, lng: 106.0984, isStart: true, type: 'pickup' },
      { name: 'Ngã 3 Gò Dầu', sub: 'QL22 giao QL22B', lat: 11.1685, lng: 106.2652, type: 'waypoint' },
      { name: 'Ngã 3 Trảng Bàng', sub: 'Dọc QL22', lat: 11.0345, lng: 106.3685, type: 'waypoint' },
      { name: 'Bến xe Củ Chi', sub: 'Cửa ngõ TP.HCM', lat: 10.9752, lng: 106.4952, type: 'waypoint' },
      { name: 'Bến xe An Sương (Q12)', sub: 'Điểm kết thúc tuyến QL22', lat: 10.8462, lng: 106.6134, isEnd: true, type: 'dropoff' }
    ]
  }
};

export const PROVINCE_COORDINATES = {
  'hà nội': { name: 'Hà Nội', lat: 21.0285, lng: 105.8542 },
  'hải phòng': { name: 'Hải Phòng', lat: 20.8449, lng: 106.6881 },
  'quảng ninh': { name: 'Quảng Ninh', lat: 20.9505, lng: 107.0734 },
  'hạ long': { name: 'Hạ Long', lat: 20.9505, lng: 107.0734 },
  'ninh bình': { name: 'Ninh Bình', lat: 20.2506, lng: 105.9745 },
  'nam định': { name: 'Nam Định', lat: 20.4344, lng: 106.1773 },
  'thái bình': { name: 'Thái Bình', lat: 20.4463, lng: 106.3366 },
  'hưng yên': { name: 'Hưng Yên', lat: 20.6464, lng: 106.0511 },
  'hải dương': { name: 'Hải Dương', lat: 20.9373, lng: 106.3146 },
  'bắc ninh': { name: 'Bắc Ninh', lat: 21.1861, lng: 106.0763 },
  'bắc giang': { name: 'Bắc Giang', lat: 21.2731, lng: 106.1946 },
  'vĩnh phúc': { name: 'Vĩnh Phúc', lat: 21.3089, lng: 105.6049 },
  'phú thọ': { name: 'Phú Thọ', lat: 21.3228, lng: 105.3283 },
  'thái nguyên': { name: 'Thái Nguyên', lat: 21.5942, lng: 105.8482 },
  'lạng sơn': { name: 'Lạng Sơn', lat: 21.8537, lng: 106.7624 },
  'thanh hóa': { name: 'Thanh Hóa', lat: 19.8067, lng: 105.7852 },
  'nghệ an': { name: 'Nghệ An', lat: 18.6796, lng: 105.6813 },
  'vinh': { name: 'Vinh', lat: 18.6796, lng: 105.6813 },
  'hà tĩnh': { name: 'Hà Tĩnh', lat: 18.3559, lng: 105.9059 },
  'đà nẵng': { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022 },
  'huế': { name: 'Huế', lat: 16.4637, lng: 107.5909 },
  'quảng nam': { name: 'Quảng Nam', lat: 15.5651, lng: 108.4735 },
  'quảng ngãi': { name: 'Quảng Ngãi', lat: 15.1205, lng: 108.7923 },
  'bình định': { name: 'Bình Định', lat: 13.7820, lng: 109.2197 },
  'quy nhơn': { name: 'Quy Nhơn', lat: 13.7820, lng: 109.2197 },
  'phú yên': { name: 'Phú Yên', lat: 13.0882, lng: 109.3135 },
  'tuy hòa': { name: 'Tuy Hòa', lat: 13.0882, lng: 109.3135 },
  'khánh hòa': { name: 'Khánh Hòa', lat: 12.2388, lng: 109.1967 },
  'nha trang': { name: 'Nha Trang', lat: 12.2388, lng: 109.1967 },
  'ninh thuận': { name: 'Ninh Thuận', lat: 11.5653, lng: 108.9959 },
  'phan rang': { name: 'Phan Rang', lat: 11.5653, lng: 108.9959 },
  'bình thuận': { name: 'Bình Thuận', lat: 10.9333, lng: 108.1000 },
  'phan thiết': { name: 'Phan Thiết', lat: 10.9333, lng: 108.1000 },
  'lâm đồng': { name: 'Lâm Đồng', lat: 11.9404, lng: 108.4583 },
  'đà lạt': { name: 'Đà Lạt', lat: 11.9404, lng: 108.4583 },
  'bảo lộc': { name: 'Bảo Lộc', lat: 11.5476, lng: 107.8090 },
  'đắk lắk': { name: 'Đắk Lắk', lat: 12.6667, lng: 108.0500 },
  'buôn ma thuột': { name: 'Buôn Ma Thuột', lat: 12.6667, lng: 108.0500 },
  'gia lai': { name: 'Gia Lai', lat: 13.9833, lng: 108.0000 },
  'pleiku': { name: 'Pleiku', lat: 13.9833, lng: 108.0000 },
  'kon tum': { name: 'Kon Tum', lat: 14.3500, lng: 108.0000 },
  'đắk nông': { name: 'Đắk Nông', lat: 12.0000, lng: 107.6833 },
  'sài gòn': { name: 'TP.HCM', lat: 10.8231, lng: 106.6297 },
  'tp.hcm': { name: 'TP.HCM', lat: 10.8231, lng: 106.6297 },
  'tp hcm': { name: 'TP.HCM', lat: 10.8231, lng: 106.6297 },
  'hồ chí minh': { name: 'TP.HCM', lat: 10.8231, lng: 106.6297 },
  'bình dương': { name: 'Bình Dương', lat: 11.1685, lng: 106.6496 },
  'thủ dầu một': { name: 'Thủ Dầu Một', lat: 10.9805, lng: 106.6519 },
  'bình phước': { name: 'Bình Phước', lat: 11.7512, lng: 106.7234 },
  'đồng xoài': { name: 'Đồng Xoài', lat: 11.5333, lng: 106.8833 },
  'lộc ninh': { name: 'Lộc Ninh', lat: 11.8385, lng: 106.5925 },
  'bình long': { name: 'Bình Long', lat: 11.6500, lng: 106.6000 },
  'chơn thành': { name: 'Chơn Thành', lat: 11.4500, lng: 106.6333 },
  'đồng nai': { name: 'Đồng Nai', lat: 10.9575, lng: 106.8427 },
  'biên hòa': { name: 'Biên Hòa', lat: 10.9575, lng: 106.8427 },
  'vũng tàu': { name: 'Bà Rịa - Vũng Tàu', lat: 10.3460, lng: 107.0843 },
  'bà rịa': { name: 'Bà Rịa', lat: 10.4962, lng: 107.1685 },
  'tây ninh': { name: 'Tây Ninh', lat: 11.3092, lng: 106.0984 },
  'long an': { name: 'Long An', lat: 10.5333, lng: 106.4000 },
  'tiền giang': { name: 'Tiền Giang', lat: 10.3500, lng: 106.3500 },
  'mỹ tho': { name: 'Mỹ Tho', lat: 10.3500, lng: 106.3500 },
  'bến tre': { name: 'Bến Tre', lat: 10.2333, lng: 106.3833 },
  'vĩnh long': { name: 'Vĩnh Long', lat: 10.2500, lng: 105.9667 },
  'cần thơ': { name: 'Cần Thơ', lat: 10.0452, lng: 105.7469 },
  'an giang': { name: 'An Giang', lat: 10.3833, lng: 105.4167 },
  'đồng tháp': { name: 'Đồng Tháp', lat: 10.4500, lng: 105.6333 },
  'kiên giang': { name: 'Kiên Giang', lat: 10.0167, lng: 105.0833 },
  'cà mau': { name: 'Cà Mau', lat: 9.1769, lng: 105.1500 }
};

export function findLocationCoords(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') return null;
  const lower = locationStr.toLowerCase().trim();
  for (const [key, val] of Object.entries(PROVINCE_COORDINATES)) {
    if (lower.includes(key)) {
      return val;
    }
  }
  return null;
}

export function getRouteCorridor(routeCategory) {
  if (!routeCategory) return null;
  return ROUTE_CORRIDORS[routeCategory] || null;
}

// Tìm trạm đón / điểm trên tuyến gần vị trí người dùng nhất
export function findNearestWaypoint(userLat, userLng, routeCategoryOrTrip) {
  if (!userLat || !userLng) return null;

  const trip = typeof routeCategoryOrTrip === 'object' && routeCategoryOrTrip !== null ? routeCategoryOrTrip : null;
  const routeCategory = trip ? trip.routeCategory : routeCategoryOrTrip;

  const corridor = getRouteCorridor(routeCategory);
  if (corridor && corridor.waypoints) {
    let nearest = null;
    let minDistance = Infinity;

    corridor.waypoints.forEach((wp) => {
      const dist = calculateDistanceKm(userLat, userLng, wp.lat, wp.lng);
      if (dist != null && dist < minDistance) {
        minDistance = dist;
        nearest = wp;
      }
    });

    if (nearest) {
      return {
        waypoint: nearest,
        distanceKm: minDistance,
        formattedDistance: formatDistance(minDistance),
        isWalkable: minDistance <= 1.0,
        isSuperClose: minDistance <= 2.5,
        isConvenient: minDistance <= 7.0
      };
    }
  }

  // Nếu là tuyến tự do toàn quốc (không có corridor định sẵn), tính khoảng cách tới điểm đi hoặc điểm đến
  if (trip && (trip.from || trip.to)) {
    const fromCoords = findLocationCoords(trip.from);
    const toCoords = findLocationCoords(trip.to);
    const candidates = [];
    if (fromCoords) candidates.push({ name: `Điểm đón (${trip.from})`, sub: 'Khu vực xuất phát', lat: fromCoords.lat, lng: fromCoords.lng });
    if (toCoords) candidates.push({ name: `Điểm trả (${trip.to})`, sub: 'Khu vực đích đến', lat: toCoords.lat, lng: toCoords.lng });

    let nearest = null;
    let minDistance = Infinity;
    candidates.forEach((wp) => {
      const dist = calculateDistanceKm(userLat, userLng, wp.lat, wp.lng);
      if (dist != null && dist < minDistance) {
        minDistance = dist;
        nearest = wp;
      }
    });

    if (nearest) {
      return {
        waypoint: nearest,
        distanceKm: minDistance,
        formattedDistance: formatDistance(minDistance),
        isWalkable: minDistance <= 1.0,
        isSuperClose: minDistance <= 2.5,
        isConvenient: minDistance <= 10.0
      };
    }
  }

  return null;
}

/**
 * Kiểm tra xem chuỗi có phải link Google Maps hay không
 * Hỗ trợ các định dạng:
 * - maps.app.goo.gl/...
 * - goo.gl/maps/...
 * - google.com/maps/...
 * - maps.google.com/...
 */
export function isGoogleMapsUrl(str) {
  if (!str || typeof str !== 'string') return false;
  return /^(https?:\/\/)?(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(str.trim());
}

/**
 * Trả về URL Google Maps chuẩn xác:
 * - Nếu đã là link Google Maps: giữ nguyên (đảm bảo tiền tố https://)
 * - Nếu là địa chỉ / cột mốc: trả về link tìm kiếm Google Maps chính thức
 */
export function getGoogleMapsUrl(locationOrUrl) {
  if (!locationOrUrl || typeof locationOrUrl !== 'string') return 'https://www.google.com/maps';
  const trimmed = locationOrUrl.trim();
  if (isGoogleMapsUrl(trimmed)) {
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

