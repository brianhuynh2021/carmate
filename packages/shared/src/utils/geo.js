/**
 * TIỆN ÍCH ĐỊNH VỊ ĐỊA LÝ & HÀNH LANG TUYẾN ĐƯỜNG LIÊN TỈNH (GEO & CORRIDORS)
 * Phục vụ trải nghiệm trực quan hóa bản đồ, điểm đón mốc thực tế và tính năng "Có gần tôi không?"
 */

import { ROUTE_BENCHMARKS } from '../constants/routes.js';

// Công thức Haversine tính khoảng cách giữa 2 toạ độ GPS (đơn vị km)
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Bán kính trái đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
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
      name: 'Chợ Bù Đốp / Bến xe Bù Đốp (TT. Thanh Bình)',
      address: 'Đường ĐT759B, TT. Thanh Bình, Huyện Bù Đốp, Tỉnh Bình Phước',
      lat: 11.9832,
      lng: 106.8124
    },
    endLandmark: {
      name: 'Ngã tư Hàng Xanh / Bến xe Miền Đông',
      address: 'Điện Biên Phủ / Xô Viết Nghệ Tĩnh, Q. Bình Thạnh, TP.HCM',
      lat: 10.8012,
      lng: 106.7114
    },
    popularPickups: [
      'Chợ Bù Đốp (TT. Thanh Bình)',
      'Chợ Tân Tiến / Cầu Tân Tiến (Bù Đốp)',
      'Chợ Lộc Hiệp (Lộc Ninh)',
      'Ngã 3 Lộc Tấn (Giao ĐT759B & QL13)',
      'Chợ Lộc Ninh (Khu phố Ninh Thịnh / Cây xăng 17)',
      'Ngã 3 Thanh Lương',
      'Cổng chào TX. Bình Long (Bình Phước)',
      'Chợ Tân Khai / Hớn Quản',
      'Ngã 4 Chơn Thành (Giao QL13 & QL14)',
      'KCN Chơn Thành / KCN Minh Hưng',
      'KCN Bàu Bàng / Bến Cát',
      'Đại Nam / Ngã 4 Sở Sao (Bình Dương)',
      'KCN VSIP 1 / AEON Mall Canary',
      'Cổng chào Lái Thiêu',
      'Ngã 4 Bình Phước (Thủ Đức - TP.HCM)',
      'Cầu Bình Triệu / Bến xe Miền Đông cũ'
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
        name: 'Chợ Bù Đốp (TT. Thanh Bình)',
        sub: 'Điểm đầu tuyến ĐT759B kết nối QL13',
        lat: 11.9832,
        lng: 106.8124,
        isStart: true,
        type: 'pickup'
      },
      {
        name: 'Chợ Tân Tiến / Cầu Tân Tiến',
        sub: 'Bù Đốp',
        lat: 11.9351,
        lng: 106.7321,
        type: 'pickup'
      },
      {
        name: 'Chợ Lộc Hiệp',
        sub: 'Lộc Ninh, ĐT759B',
        lat: 11.9012,
        lng: 106.6623,
        type: 'pickup'
      },
      {
        name: 'Ngã 3 Lộc Tấn (Giao QL13)',
        sub: 'Nút giao ĐT759B & Quốc lộ 13',
        lat: 11.8845,
        lng: 106.5912,
        type: 'pickup'
      },
      {
        name: 'Chợ Lộc Ninh / Cây xăng 17',
        sub: 'Khu phố Ninh Thịnh, QL13',
        lat: 11.8421,
        lng: 106.5972,
        type: 'pickup'
      },
      {
        name: 'Ngã 3 Thanh Lương',
        sub: 'Ranh Lộc Ninh - Bình Long',
        lat: 11.7250,
        lng: 106.5980,
        type: 'waypoint'
      },
      {
        name: 'Cổng chào TX. Bình Long',
        sub: 'Vòng xoay An Lộc, QL13',
        lat: 11.6482,
        lng: 106.6025,
        type: 'waypoint'
      },
      {
        name: 'Chợ Tân Khai / Hớn Quản',
        sub: 'Trung tâm Huyện Hớn Quản, QL13',
        lat: 11.5620,
        lng: 106.6340,
        type: 'waypoint'
      },
      {
        name: 'Ngã 4 Chơn Thành',
        sub: 'Nút giao QL13, Tuyến N2 & QL14',
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
        sub: 'Đầu cầu Vĩnh Bình, Thuận An',
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
      {
        name: 'Bến xe Vũng Tàu',
        sub: 'Xuất phát TP. Vũng Tàu',
        lat: 10.3541,
        lng: 107.0851,
        isStart: true,
        type: 'pickup'
      },
      { name: 'TP. Bà Rịa', sub: 'Cổng chào Bà Rịa QL51', lat: 10.4952, lng: 107.1685, type: 'waypoint' },
      { name: 'Thị xã Phú Mỹ', sub: 'Dọc QL51 cổng KCN', lat: 10.6015, lng: 107.0542, type: 'waypoint' },
      { name: 'Trạm dừng chân Long Thành', sub: 'Nút vào Cao tốc', lat: 10.7412, lng: 106.9582, type: 'waypoint' },
      {
        name: 'Nút giao Vành Đai 2 / Mai Chí Thọ',
        sub: 'Đầu TP. Thủ Đức',
        lat: 10.7925,
        lng: 106.7725,
        type: 'dropoff'
      },
      {
        name: 'Ngã tư Hàng Xanh / Q1',
        sub: 'Điểm cuối TP.HCM',
        lat: 10.8012,
        lng: 106.7114,
        isEnd: true,
        type: 'dropoff'
      }
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
    popularDropoffs: ['Suối Tiên (TP. Thủ Đức)', 'Ngã tư Hàng Xanh (Bình Thạnh)', 'Sân bay Tân Sơn Nhất'],
    waypoints: [
      { name: 'Bến xe Đà Lạt', sub: 'Đầu tuyến Lâm Đồng', lat: 11.9254, lng: 108.4412, isStart: true, type: 'pickup' },
      { name: 'Bến xe Bảo Lộc', sub: 'Trần Phú, TP. Bảo Lộc', lat: 11.5425, lng: 107.8085, type: 'waypoint' },
      { name: 'Madagui / Đạ Huoai', sub: 'Chân đèo Bảo Lộc', lat: 11.4015, lng: 107.5452, type: 'waypoint' },
      { name: 'Ngã 3 Dầu Giây', sub: 'Vào cao tốc Long Thành', lat: 10.9652, lng: 107.1354, type: 'waypoint' },
      {
        name: 'Ngã tư Hàng Xanh (TP.HCM)',
        sub: 'Điểm trả trung tâm',
        lat: 10.8012,
        lng: 106.7114,
        isEnd: true,
        type: 'dropoff'
      }
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
    popularDropoffs: ['Bến xe Miền Đông mới (Thủ Đức)', 'Ngã tư Hàng Xanh (Bình Thạnh)', 'Quận 1 / Bến Thành'],
    waypoints: [
      {
        name: 'Vòng xoay Suối Cát (Phan Thiết)',
        sub: 'Đầu cao tốc Phan Thiết',
        lat: 10.9215,
        lng: 108.0752,
        isStart: true,
        type: 'pickup'
      },
      {
        name: 'Nút giao Ba Bàu (Hàm Thuận Nam)',
        sub: 'Điểm đón cao tốc',
        lat: 10.8845,
        lng: 107.9852,
        type: 'waypoint'
      },
      { name: 'Nút giao Dầu Giây', sub: 'Chuyển tiếp cao tốc LT-DG', lat: 10.9652, lng: 107.1354, type: 'waypoint' },
      {
        name: 'Bến xe Miền Đông mới',
        sub: 'Điểm trả TP.HCM',
        lat: 10.8814,
        lng: 106.8291,
        isEnd: true,
        type: 'dropoff'
      }
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
    popularDropoffs: ['Bến xe An Sương (Quận 12)', 'Ngã 4 Bảy Hiền (Tân Bình)', 'Quận 10 / Bệnh viện 115'],
    waypoints: [
      {
        name: 'Bến xe Tây Ninh',
        sub: 'Trung tâm TP. Tây Ninh',
        lat: 11.3092,
        lng: 106.0984,
        isStart: true,
        type: 'pickup'
      },
      { name: 'Ngã 3 Gò Dầu', sub: 'QL22 giao QL22B', lat: 11.1685, lng: 106.2652, type: 'waypoint' },
      { name: 'Ngã 3 Trảng Bàng', sub: 'Dọc QL22', lat: 11.0345, lng: 106.3685, type: 'waypoint' },
      { name: 'Bến xe Củ Chi', sub: 'Cửa ngõ TP.HCM', lat: 10.9752, lng: 106.4952, type: 'waypoint' },
      {
        name: 'Bến xe An Sương (Q12)',
        sub: 'Điểm kết thúc tuyến QL22',
        lat: 10.8462,
        lng: 106.6134,
        isEnd: true,
        type: 'dropoff'
      }
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
  vinh: { name: 'Vinh', lat: 18.6796, lng: 105.6813 },
  'hà tĩnh': { name: 'Hà Tĩnh', lat: 18.3559, lng: 105.9059 },
  'đà nẵng': { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022 },
  huế: { name: 'Huế', lat: 16.4637, lng: 107.5909 },
  'quảng nam': { name: 'Quảng Nam', lat: 15.5651, lng: 108.4735 },
  'quảng ngãi': { name: 'Quảng Ngãi', lat: 15.1205, lng: 108.7923 },
  'bình định': { name: 'Bình Định', lat: 13.782, lng: 109.2197 },
  'quy nhơn': { name: 'Quy Nhơn', lat: 13.782, lng: 109.2197 },
  'phú yên': { name: 'Phú Yên', lat: 13.0882, lng: 109.3135 },
  'tuy hòa': { name: 'Tuy Hòa', lat: 13.0882, lng: 109.3135 },
  'khánh hòa': { name: 'Khánh Hòa', lat: 12.2388, lng: 109.1967 },
  'nha trang': { name: 'Nha Trang', lat: 12.2388, lng: 109.1967 },
  'ninh thuận': { name: 'Ninh Thuận', lat: 11.5653, lng: 108.9959 },
  'phan rang': { name: 'Phan Rang', lat: 11.5653, lng: 108.9959 },
  'bình thuận': { name: 'Bình Thuận', lat: 10.9333, lng: 108.1 },
  'phan thiết': { name: 'Phan Thiết', lat: 10.9333, lng: 108.1 },
  'lâm đồng': { name: 'Lâm Đồng', lat: 11.9404, lng: 108.4583 },
  'đà lạt': { name: 'Đà Lạt', lat: 11.9404, lng: 108.4583 },
  'bảo lộc': { name: 'Bảo Lộc', lat: 11.5476, lng: 107.809 },
  'đắk lắk': { name: 'Đắk Lắk', lat: 12.6667, lng: 108.05 },
  'buôn ma thuột': { name: 'Buôn Ma Thuột', lat: 12.6667, lng: 108.05 },
  'gia lai': { name: 'Gia Lai', lat: 13.9833, lng: 108.0 },
  pleiku: { name: 'Pleiku', lat: 13.9833, lng: 108.0 },
  'kon tum': { name: 'Kon Tum', lat: 14.35, lng: 108.0 },
  'đắk nông': { name: 'Đắk Nông', lat: 12.0, lng: 107.6833 },
  'sài gòn': { name: 'TP.HCM', lat: 10.8231, lng: 106.6297 },
  'tp.hcm': { name: 'TP.HCM', lat: 10.8231, lng: 106.6297 },
  'tp hcm': { name: 'TP.HCM', lat: 10.8231, lng: 106.6297 },
  'hồ chí minh': { name: 'TP.HCM', lat: 10.8231, lng: 106.6297 },
  'bình dương': { name: 'Bình Dương', lat: 11.1685, lng: 106.6496 },
  'thủ dầu một': { name: 'Thủ Dầu Một', lat: 10.9805, lng: 106.6519 },
  'bình phước': { name: 'Bình Phước', lat: 11.7512, lng: 106.7234 },
  'đồng xoài': { name: 'Đồng Xoài', lat: 11.5333, lng: 106.8833 },
  'lộc ninh': { name: 'Lộc Ninh', lat: 11.8385, lng: 106.5925 },
  'bình long': { name: 'Bình Long', lat: 11.65, lng: 106.6 },
  'chơn thành': { name: 'Chơn Thành', lat: 11.45, lng: 106.6333 },
  'đồng nai': { name: 'Đồng Nai', lat: 10.9575, lng: 106.8427 },
  'biên hòa': { name: 'Biên Hòa', lat: 10.9575, lng: 106.8427 },
  'vũng tàu': { name: 'Bà Rịa - Vũng Tàu', lat: 10.346, lng: 107.0843 },
  'bà rịa': { name: 'Bà Rịa', lat: 10.4962, lng: 107.1685 },
  'tây ninh': { name: 'Tây Ninh', lat: 11.3092, lng: 106.0984 },
  'long an': { name: 'Long An', lat: 10.5333, lng: 106.4 },
  'tiền giang': { name: 'Tiền Giang', lat: 10.35, lng: 106.35 },
  'mỹ tho': { name: 'Mỹ Tho', lat: 10.35, lng: 106.35 },
  'bến tre': { name: 'Bến Tre', lat: 10.2333, lng: 106.3833 },
  'vĩnh long': { name: 'Vĩnh Long', lat: 10.25, lng: 105.9667 },
  'cần thơ': { name: 'Cần Thơ', lat: 10.0452, lng: 105.7469 },
  'an giang': { name: 'An Giang', lat: 10.3833, lng: 105.4167 },
  'đồng tháp': { name: 'Đồng Tháp', lat: 10.45, lng: 105.6333 },
  'kiên giang': { name: 'Kiên Giang', lat: 10.0167, lng: 105.0833 },
  'cà mau': { name: 'Cà Mau', lat: 9.1769, lng: 105.15 }
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
    if (fromCoords)
      candidates.push({
        name: `Điểm đón (${trip.from})`,
        sub: 'Khu vực xuất phát',
        lat: fromCoords.lat,
        lng: fromCoords.lng
      });
    if (toCoords)
      candidates.push({ name: `Điểm trả (${trip.to})`, sub: 'Khu vực đích đến', lat: toCoords.lat, lng: toCoords.lng });

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
  return /^(https?:\/\/)?(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(
    str.trim()
  );
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

/**
 * Giải mã các thực thể HTML cũ nếu bị dính trong dữ liệu (VD: &#x2F; -> /)
 */
export function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/&amp;/gi, '&')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export function parseLocation(str) {
  if (!str || typeof str !== 'string') return { main: '', sub: '' };
  const rawClean = decodeHtmlEntities(str).trim();

  // Kháng dữ liệu pentest / HTML tags: không hiển thị thô ra giao diện người dùng
  if (/<[a-z]|onerror|onload|script|&lt;|&gt;/i.test(rawClean)) {
    return { main: 'Điểm hẹn đón dọc tuyến', sub: 'Thoả thuận điểm đón qua Zalo' };
  }

  // 0. Khử rò rỉ từ khoá xe, số ghế thừa thãi bám vào địa danh (VD: "Hớn Quản xe Mazda 2 chỗ" -> "Hớn Quản")
  const VEHICLE_LEAK_REGEX =
    /(?:\s+|-|,|\/)?\s*(?:xe\s*)?(?:mazda\s*\d*|vios|xpander|innova|veloz|kia\s*\w*|hyundai\s*\w*|honda\s*\w*|toyota\s*\w*|ford\s*\w*|vinfast\s*\w*|carnival|accent|city|cerato|k3|cx-?\d+|sedan|suv|mpv|nhà|oto|ô tô|hơi|ghép|gia đình|\d+\s*chỗ|chỗ|còn\s*\d*|giá|sđt|zalo|lúc|khoảng|đón|phụ|ai tiện|ai có).*/i;

  let cleanStr = rawClean;
  const strippedVehicle = rawClean.replace(VEHICLE_LEAK_REGEX, '').trim();
  if (strippedVehicle && strippedVehicle.length >= 2) {
    cleanStr = strippedVehicle;
  }

  const isSaigon = (s) =>
    /sài gòn|sai gon|tp\.hcm|tphcm|tp\s*hcm|hồ chí minh|ho chi minh|miền đông|miền tây|an sương|hàng xanh|thủ đức|quận\s*\d+|tân bình|bình tân|bình thạnh|gò vấp|phú nhuận|tân phú|bình chánh|hóc môn|củ chi|nhà bè|cần giờ|cống quỳnh|tân sơn nhất|chợ rẫy|từ dũ|bến thành|suối tiên/i.test(
      s
    );
  const isBinhPhuoc = (s) => /bình phước|binh phuoc/i.test(s);

  // 1. Phân tích ngoặc đơn: e.g. "Đường Cống Quỳnh (Quận 1)" hoặc "Bù Đốp (Cây xăng Petrolimex 17)"
  const parenMatch = cleanStr.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch) {
    const partA = parenMatch[1].trim();
    const partB = parenMatch[2].trim();

    // Nếu partA là tên đường/địa điểm chi tiết ở Sài Gòn kèm Quận (VD: "Đường Cống Quỳnh (Quận 1)")
    if (isSaigon(partB) || isSaigon(partA)) {
      if (
        /^(?:đường|phố|hẻm|ngõ|số|cây xăng|chợ|bệnh viện|bv|trường|kcn|tòa|toà|chung cư|nhà khách|khách sạn)(?:\s+|$|[.,;])/i.test(
          partA
        )
      ) {
        return {
          main: 'Sài Gòn',
          sub: `${partA}, ${partB}`
        };
      }
      if (/^(sài gòn|tp\.hcm|hồ chí minh|tp\s*hồ chí minh)$/i.test(partA)) {
        return {
          main: 'Sài Gòn',
          sub: partB
        };
      }
      return {
        main: partA,
        sub: partB
      };
    }

    // Nếu partA là địa điểm chi tiết kèm Huyện/Tỉnh ở partB (VD: "Cây xăng 17 (Bù Đốp)", "Chợ Tân Khai (Hớn Quản)")
    if (
      /^(?:đường|phố|hẻm|ngõ|số|cây xăng|chợ|bệnh viện|bv|trường|kcn|trung tâm|tt\.?|ubnd)(?:\s+|$|[.,;])/i.test(
        partA
      )
    ) {
      return {
        main: partB,
        sub: partA
      };
    }

    return { main: partA, sub: partB };
  }

  // 2. Phân tích dấu phẩy hành chính: e.g. "trung tâm hành chính Tân Khai, Hớn Quản, Bình Phước"
  if (cleanStr.includes(',')) {
    const parts = cleanStr.split(',').map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];

    if (isSaigon(last) || isSaigon(cleanStr)) {
      const spotParts = parts.filter((p) => !/^(sài gòn|tp\.hcm|tp\s*hồ chí minh|hồ chí minh)$/i.test(p));
      return {
        main: 'Sài Gòn',
        sub: spotParts.join(', ') || cleanStr
      };
    }

    if (isBinhPhuoc(last)) {
      const spotParts = parts.slice(0, -1);
      const sub = spotParts
        .join(', ')
        .replace(/trung tâm hành chính/gi, 'TT. Hành chính')
        .replace(/bệnh viện/gi, 'BV.')
        .replace(/cây xăng/gi, 'Cây xăng');
      return {
        main: 'Bình Phước',
        sub: sub || cleanStr
      };
    }

    // Các tỉnh thành khác có từ 2 cấp trở lên (VD: "Mũi Né, Phan Thiết")
    if (parts.length >= 2) {
      return {
        main: last,
        sub: parts.slice(0, -1).join(', ')
      };
    }
  }

  // 3. Phân tích dấu gạch chéo e.g. "Bù Đốp / Lộc Ninh"
  if (cleanStr.includes(' / ')) {
    const parts = cleanStr.split(' / ');
    return { main: parts[0].trim(), sub: parts.slice(1).join(' / ').trim() };
  }

  // 4. Phân tích dấu chấm phẩy "; "
  if (cleanStr.includes('; ')) {
    const parts = cleanStr.split('; ');
    return { main: parts[0].trim(), sub: parts.slice(1).join('; ').trim() };
  }

  // 5. Phân tích Mốc địa danh + Quận/Huyện/Thị xã không có dấu phẩy (VD: "trung tâm hành chính Hớn Quản", "UBND Huyện Hớn Quản", "Chợ Tân Khai Hớn Quản")
  const LANDMARK_PREFIX_REGEX =
    /(?:trung tâm hành chính|tt\.?\s*hành chính|ubnd|ủy ban nhân dân|bệnh viện|bv|trung tâm y tế|chợ|cây xăng|bến xe|bx|cổng chào|ngã 3|ngã ba|ngã 4|ngã tư|vòng xoay|bùng binh|kcn|khu công nghiệp|trường|đại học|cao đẳng|toà nhà|tòa nhà|chung cư|siêu thị|khách sạn|nhà ga|ga|sân bay|cầu|nút giao)/i;

  const KNOWN_AREAS = [
    { name: 'Hớn Quản', regex: /hớn\s*quản/i },
    { name: 'Tân Khai', regex: /tân\s*khai/i },
    { name: 'Bù Đốp', regex: /bù\s*đốp/i },
    { name: 'Lộc Ninh', regex: /lộc\s*ninh/i },
    { name: 'Bình Long', regex: /bình\s*long/i },
    { name: 'Chơn Thành', regex: /chơn\s*thành/i },
    { name: 'Đồng Xoài', regex: /đồng\s*xoài/i },
    { name: 'Bù Đăng', regex: /bù\s*đăng/i },
    { name: 'Bù Gia Mập', regex: /bù\s*gia\s*mập/i },
    { name: 'Phú Riềng', regex: /phú\s*riềng/i },
    { name: 'Đồng Phú', regex: /đồng\s*phú/i },
    { name: 'Bình Phước', regex: /bình\s*phước/i },
    { name: 'Thủ Dầu Một', regex: /thủ\s*dầu\s*một/i },
    { name: 'Bến Cát', regex: /bến\s*cát/i },
    { name: 'Dĩ An', regex: /dĩ\s*an/i },
    { name: 'Thuận An', regex: /thuận\s*an/i },
    { name: 'Tân Uyên', regex: /tân\s*uyên/i },
    { name: 'Bàu Bàng', regex: /bàu\s*bàng/i },
    { name: 'Biên Hòa', regex: /biên\s*h[oò]a/i },
    { name: 'Long Thành', regex: /long\s*thành/i },
    { name: 'Nhơn Trạch', regex: /nhơn\s*trạch/i },
    { name: 'Vũng Tàu', regex: /vũng\s*tàu/i },
    { name: 'Bà Rịa', regex: /bà\s*rịa/i },
    { name: 'Tây Ninh', regex: /tây\s*ninh/i },
    { name: 'Trảng Bàng', regex: /trảng\s*bàng/i },
    { name: 'Đà Lạt', regex: /đà\s*lạt/i },
    { name: 'Bảo Lộc', regex: /bảo\s*lộc/i }
  ];

  if (LANDMARK_PREFIX_REGEX.test(cleanStr)) {
    for (const area of KNOWN_AREAS) {
      if (area.regex.test(cleanStr)) {
        return {
          main: area.name,
          sub: cleanStr
        };
      }
    }
  }

  // 6. Địa danh con thuộc Sài Gòn (VD: "Bến xe Miền Đông", "Ngã tư Hàng Xanh")
  if (isSaigon(cleanStr) && !/^(sài gòn|tp\.hcm|hồ chí minh|tp\s*hồ chí minh)$/i.test(cleanStr)) {
    return {
      main: 'Sài Gòn',
      sub: cleanStr
    };
  }

  return { main: cleanStr.trim(), sub: '' };
}

/**
 * Định dạng biển số xe bảo mật (Privacy Masked Plate)
 * Chuẩn MIT Invariants: Che toàn bộ số phía sau (VD: "93A - xxxxx") để giữ kín danh tính chủ xe trên sàn công khai.
 * VD: "93A - 541.86" -> "93A - xxxxx"
 *     "51K-123.45"   -> "51K - xxxxx"
 *     "60B-9876"     -> "60B - xxxxx"
 *     "93A - ***.86" -> "93A - xxxxx"
 */
export function maskLicensePlate(plateStr, fallbackLocation = '') {
  const fallback = fallbackLocation?.includes('Bình Phước') ? '93A - xxxxx' : '51K - xxxxx';
  if (!plateStr || typeof plateStr !== 'string') {
    return fallback;
  }
  const s = plateStr.trim();
  if (!s) {
    return fallback;
  }
  // Bóc tách tiền tố biển số: 2 số tỉnh + 1-2 chữ cái (VD: 93A, 51K, 60B, 29LD)
  const matchSeries = s.match(/^([0-9]{2}\s*[A-Z]{1,2})/i);
  if (matchSeries) {
    const series = matchSeries[1].replace(/\s+/g, '').toUpperCase();
    return `${series} - xxxxx`;
  }
  const clean = s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const matchClean = clean.match(/^([0-9]{2}[A-Z]{1,2})/);
  if (matchClean) {
    return `${matchClean[1]} - xxxxx`;
  }
  return fallback;
}

/**
 * Trích xuất địa danh đô thị/tỉnh thành lớn để làm tiêu đề hành trình chuẩn Apple Wallet & Fly.io
 * Tuyệt đối KHÔNG cắt đôi từ ghép tiếng Việt (như "Phan Thiết" thành "Phan", "Bến Tre" thành "Bến")
 */
export function getCorridorDisplay(item, fromParsed, toParsed) {
  const extractTerritory = (parsed, raw) => {
    const text = ((parsed.sub || '') + ' ' + (parsed.main || '') + ' ' + (raw || '')).toLowerCase();

    // Tuyến Sài Gòn / TP.HCM
    if (/sài gòn|tp\.hcm|hồ chí minh|hàng xanh|miền đông|thủ đức|quận\s*\d+|tân bình|bình tân|an phú/i.test(text)) {
      return { city: 'Sài Gòn', code: 'SGN', region: 'TP. Hồ Chí Minh', point: parsed.main || 'TP.HCM' };
    }

    // Bình Thuận / Ninh Thuận (Phan Thiết, Phan Rang, Mũi Né...)
    if (/phan thiết|mũi né|hàm tiến|tiến thành|bình thuận/i.test(text)) {
      return { city: 'Phan Thiết', code: 'PTH', region: 'Bình Thuận (QL1A)', point: parsed.main || 'Phan Thiết' };
    }
    if (/la gi|hàm tân/i.test(text)) {
      return { city: 'La Gi', code: 'LG', region: 'Bình Thuận', point: parsed.main || 'La Gi' };
    }
    if (/phan rang|tháp chàm|ninh thuận/i.test(text)) {
      return { city: 'Phan Rang', code: 'PR', region: 'Ninh Thuận (QL1A)', point: parsed.main || 'Phan Rang' };
    }

    // Khánh Hòa & Nam Trung Bộ
    if (/nha trang|cam ranh|khánh hòa|khánh hoà/i.test(text)) {
      return { city: 'Nha Trang', code: 'NTR', region: 'Khánh Hòa (QL1A)', point: parsed.main || 'Nha Trang' };
    }
    if (/tuy hòa|tuy hoà|phú yên/i.test(text)) {
      return { city: 'Tuy Hòa', code: 'TYH', region: 'Phú Yên (QL1A)', point: parsed.main || 'Tuy Hòa' };
    }
    if (/quy nhơn|bình định/i.test(text)) {
      return { city: 'Quy Nhơn', code: 'UIH', region: 'Bình Định (QL1A)', point: parsed.main || 'Quy Nhơn' };
    }
    if (/quảng ngãi/i.test(text)) {
      return { city: 'Quảng Ngãi', code: 'QNG', region: 'Quảng Ngãi (QL1A)', point: parsed.main || 'Quảng Ngãi' };
    }
    if (/đà nẵng/i.test(text)) {
      return { city: 'Đà Nẵng', code: 'DAD', region: 'TP. Đà Nẵng', point: parsed.main || 'Đà Nẵng' };
    }
    if (/huế|thừa thiên/i.test(text)) {
      return { city: 'Huế', code: 'HUI', region: 'Thừa Thiên Huế', point: parsed.main || 'Huế' };
    }

    // Miền Bắc
    if (/hà nội|thủ đô/i.test(text)) {
      return { city: 'Hà Nội', code: 'HAN', region: 'Thủ đô Hà Nội', point: parsed.main || 'Hà Nội' };
    }
    if (/hải phòng/i.test(text)) {
      return { city: 'Hải Phòng', code: 'HPH', region: 'TP. Hải Phòng', point: parsed.main || 'Hải Phòng' };
    }
    if (/quảng ninh|hạ long/i.test(text)) {
      return { city: 'Hạ Long', code: 'HL', region: 'Tỉnh Quảng Ninh', point: parsed.main || 'Hạ Long' };
    }
    if (/vinh|nghệ an/i.test(text)) {
      return { city: 'TP. Vinh', code: 'VII', region: 'Nghệ An (QL1A)', point: parsed.main || 'Vinh' };
    }
    if (/thanh hóa|thanh hoá/i.test(text)) {
      return { city: 'Thanh Hóa', code: 'TH', region: 'Tỉnh Thanh Hóa', point: parsed.main || 'Thanh Hóa' };
    }

    // Bình Phước & Các Huyện Trục QL13, QL14
    if (/bù đốp/i.test(text)) return { city: 'Bù Đốp', code: 'BĐ', region: 'Bình Phước (QL13)', point: parsed.main };
    if (/lộc ninh/i.test(text))
      return { city: 'Lộc Ninh', code: 'LN', region: 'Bình Phước (QL13)', point: parsed.main };
    if (/bình long/i.test(text))
      return { city: 'Bình Long', code: 'BL', region: 'Bình Phước (QL13)', point: parsed.main };
    if (/tân khai|hớn quản/i.test(text))
      return { city: 'Tân Khai', code: 'TK', region: 'Bình Phước (QL13)', point: parsed.main };
    if (/chơn thành/i.test(text))
      return { city: 'Chơn Thành', code: 'CT', region: 'Bình Phước (QL13)', point: parsed.main };
    if (/đồng xoài/i.test(text))
      return { city: 'Đồng Xoài', code: 'ĐX', region: 'Bình Phước (QL14)', point: parsed.main };
    if (/phước long/i.test(text))
      return { city: 'Phước Long', code: 'PL', region: 'Bình Phước (ĐT741)', point: parsed.main };
    if (/bù đăng/i.test(text)) return { city: 'Bù Đăng', code: 'BĐG', region: 'Bình Phước (QL14)', point: parsed.main };
    if (/bình phước/i.test(text))
      return { city: 'Bình Phước', code: 'BP', region: 'Tỉnh Bình Phước', point: parsed.main };

    // Đồng Nai & Trục QL20
    if (/gia kiệm/i.test(text)) return { city: 'Gia Kiệm', code: 'GK', region: 'Đồng Nai (QL20)', point: parsed.main };
    if (/dầu giây/i.test(text))
      return { city: 'Dầu Giây', code: 'DG', region: 'Đồng Nai (QL1A/20)', point: parsed.main };
    if (/long khánh/i.test(text))
      return { city: 'Long Khánh', code: 'LK', region: 'Tỉnh Đồng Nai', point: parsed.main };
    if (/định quán/i.test(text))
      return { city: 'Định Quán', code: 'ĐQ', region: 'Đồng Nai (QL20)', point: parsed.main };
    if (/biên hòa|biên hoà/i.test(text))
      return { city: 'Biên Hòa', code: 'BH', region: 'Tỉnh Đồng Nai', point: parsed.main };
    if (/đồng nai/i.test(text)) return { city: 'Đồng Nai', code: 'ĐN', region: 'Tỉnh Đồng Nai', point: parsed.main };

    // Tây Nguyên & Lâm Đồng
    if (/đà lạt/i.test(text)) return { city: 'Đà Lạt', code: 'DLI', region: 'Lâm Đồng (QL20)', point: parsed.main };
    if (/bảo lộc/i.test(text)) return { city: 'Bảo Lộc', code: 'BL', region: 'Lâm Đồng (QL20)', point: parsed.main };
    if (/buôn ma thuột|đắk lắk/i.test(text))
      return { city: 'B.M.Thuột', code: 'BMT', region: 'Đắk Lắk (QL14)', point: parsed.main };
    if (/đắk nông|gia nghĩa/i.test(text))
      return { city: 'Gia Nghĩa', code: 'GN', region: 'Đắk Nông (QL14)', point: parsed.main };
    if (/pleiku|gia lai/i.test(text))
      return { city: 'Pleiku', code: 'PXU', region: 'Gia Lai (QL14)', point: parsed.main };
    if (/kon tum/i.test(text)) return { city: 'Kon Tum', code: 'KT', region: 'Tỉnh Kon Tum', point: parsed.main };

    // Bình Dương
    if (/thủ dầu một/i.test(text))
      return { city: 'Thủ Dầu Một', code: 'TDM', region: 'Bình Dương (QL13)', point: parsed.main };
    if (/bến cát/i.test(text)) return { city: 'Bến Cát', code: 'BC', region: 'Bình Dương (QL13)', point: parsed.main };
    if (/bình dương/i.test(text))
      return { city: 'Bình Dương', code: 'BD', region: 'Tỉnh Bình Dương', point: parsed.main };

    // Tây Ninh & Bà Rịa - Vũng Tàu
    if (/vũng tàu/i.test(text))
      return { city: 'Vũng Tàu', code: 'VT', region: 'Bà Rịa - Vũng Tàu', point: parsed.main };
    if (/bà rịa/i.test(text)) return { city: 'Bà Rịa', code: 'BR', region: 'Bà Rịa - Vũng Tàu', point: parsed.main };
    if (/tây ninh/i.test(text)) return { city: 'Tây Ninh', code: 'TN', region: 'Tỉnh Tây Ninh', point: parsed.main };

    // Đồng Bằng Sông Cửu Long (Miền Tây)
    if (/bến tre/i.test(text)) return { city: 'Bến Tre', code: 'BTR', region: 'Bến Tre (QL60)', point: parsed.main };
    if (/mỹ tho|tiền giang/i.test(text))
      return { city: 'Mỹ Tho', code: 'MT', region: 'Tiền Giang (QL1A)', point: parsed.main };
    if (/cần thơ/i.test(text)) return { city: 'Cần Thơ', code: 'VCA', region: 'TP. Cần Thơ', point: parsed.main };
    if (/cà mau/i.test(text)) return { city: 'Cà Mau', code: 'CAH', region: 'Tỉnh Cà Mau', point: parsed.main };
    if (/long xuyên|an giang/i.test(text))
      return { city: 'Long Xuyên', code: 'LX', region: 'An Giang', point: parsed.main };
    if (/rạch giá|kiên giang/i.test(text))
      return { city: 'Rạch Giá', code: 'VKG', region: 'Kiên Giang', point: parsed.main };
    if (/phú quốc/i.test(text)) return { city: 'Phú Quốc', code: 'PQC', region: 'Kiên Giang', point: parsed.main };

    // Rút gọn địa danh fallback THÔNG MINH (Tuyệt đối KHÔNG cắt đôi từ ghép tiếng Việt)
    let cleanWord = (parsed.main || raw || '')
      .replace(
        /^(Cây xăng|Bến xe|Ngã 4|Ngã tư|Ngã ba|Ngã 3|Trạm thu phí|KCN|Chợ|Cổng chào|UBND|BV|Bệnh viện|Trường|Công viên)\s+/i,
        ''
      )
      .replace(/\(.*?\)/g, '')
      .trim();

    if (cleanWord.includes('/')) cleanWord = cleanWord.split('/')[0].trim();
    if (cleanWord.includes('-')) cleanWord = cleanWord.split('-')[0].trim();

    const words = cleanWord.split(/\s+/).filter(Boolean);
    let displayCity = words.length > 2 ? words.slice(0, 2).join(' ') : cleanWord;
    if (!displayCity) displayCity = 'Điểm đón';

    // Tạo mã code 3 chữ cái chuẩn IATA từ các chữ cái đầu
    let code = 'LOT';
    if (words.length >= 2) {
      const w1 = words[0]
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .slice(0, 1)
        .toUpperCase();
      const w2 = words[1]
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .slice(0, 2)
        .toUpperCase();
      code = (w1 + w2).slice(0, 3);
    } else if (words.length === 1 && words[0]) {
      code = words[0]
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .slice(0, 3)
        .toUpperCase();
    }

    return {
      city: displayCity,
      code,
      region: parsed.sub || item.hometown || 'Tuyến kết nối',
      point: parsed.main || cleanWord
    };
  };

  const fromInfo = extractTerritory(fromParsed, item.from);
  const toInfo = extractTerritory(toParsed, item.to);

  // Fallback từ benchmark nếu cần
  const benchmark = ROUTE_BENCHMARKS[item.routeCategory];
  if (benchmark?.name && (fromInfo.city === toInfo.city || !fromInfo.city || !toInfo.city)) {
    const parts = benchmark.name.split('⇄');
    if (parts.length === 2) {
      fromInfo.city = parts[0].trim();
      toInfo.city = parts[1].replace(/\(.*?\)/, '').trim();
      fromInfo.code = fromInfo.city.slice(0, 3).toUpperCase();
      toInfo.code = toInfo.city.slice(0, 3).toUpperCase();
      fromInfo.region = benchmark.highway || 'Trục chính';
      toInfo.region = 'TP. Hồ Chí Minh';
    }
  }

  return { fromInfo, toInfo };
}
