/**
 * =============================================================================
 * CARMATE STANFORD FRENET FRAME TRANSFORMATION & KINEMATICS ENGINE
 * =============================================================================
 * Áp dụng nghiên cứu của Moritz Werling & Sebastian Thrun (Stanford University)
 * và Động học Dwell-Time của GS. Carlos Daganzo (UC Berkeley).
 *
 * 1. Khử bài toán bản đồ 2 chiều (2D -> 1D Coordinate Projection):
 *    Chiếu tọa độ GPS (lat, lon) của ô tô vuông góc vào tim đường hành lang để thu về:
 *    - s(t): Cọc số km dọc tuyến (1 chiều tuyến tính, O(1) interval checks).
 *    - d(t): Độ lệch vuông góc so với tim đường (mét).
 *    - isOnCorridor: Xác thực xe đang thực sự lăn bánh trên tuyến (|d| <= 75m).
 *
 * 2. Cửa sổ Radar Động học (Kinematic TTA Trigger Window):
 *    Ngưỡng kích hoạt radar trước trạm tự động co giãn theo vận tốc thực tế v:
 *    d_trigger = max(3.0 km, (v / 3.6) * 210s / 1000)
 *    (Xe 78 km/h kích hoạt tại ~4.5 km; Xe 50 km/h kích hoạt tại 3.0 km).
 *
 * 3. MIT Interval Scheduling (Phân bổ ghế theo khoảng gối đầu):
 *    Kiểm tra giao đoạn tuyến tính [s_pickup, s_dropoff] lọt trong hành trình xe.
 * =============================================================================
 */


// Tim đường chuẩn hóa Quốc lộ 13 (Từ Lộc Ninh / Bình Long về Sài Gòn & Sân bay Tân Sơn Nhất)
export const QL13_CORRIDOR_POLYLINE = [
  { id: 'hub_ql13_loc_ninh', name: 'Chợ Lộc Ninh', lat: 11.8540, lng: 106.5920, s: 0.0 },
  { id: 'hub_ql13_binh_long', name: 'TX. Bình Long (Vòng xoay An Lộc)', lat: 11.6482, lng: 106.6074, s: 24.5 },
  { id: 'hub_ql13_tthc_binh_long', name: 'TTHC Bình Long', lat: 11.6350, lng: 106.6110, s: 26.0 },
  { id: 'hub_ql13_tthc_tan_khai', name: 'TTHC Huyện Hớn Quản (Tân Khai)', lat: 11.5650, lng: 106.6330, s: 44.0 },
  { id: 'hub_ql13_tan_khai', name: 'Cây xăng Petrolimex Tân Khai', lat: 11.5620, lng: 106.6340, s: 44.5 },
  { id: 'hub_ql13_minh_hung', name: 'KCN Minh Hưng - Hàn Quốc', lat: 11.5120, lng: 106.6520, s: 51.5 },
  { id: 'hub_ql13_tthc_chon_thanh', name: 'TTHC TX. Chơn Thành', lat: 11.4820, lng: 106.6680, s: 56.0 },
  { id: 'hub_ql13_vincom_chon_thanh', name: 'Vincom Plaza Chơn Thành', lat: 11.4810, lng: 106.6690, s: 56.2 },
  { id: 'hub_ql13_nga4_chon_thanh', name: 'Ngã 4 Chơn Thành', lat: 11.4791, lng: 106.6694, s: 56.5 },
  { id: 'hub_ql13_becamex_chon_thanh', name: 'KCN Becamex Bình Phước', lat: 11.4550, lng: 106.6720, s: 60.0 },
  { id: 'hub_ql13_tthc_bau_bang', name: 'TTHC Huyện Bàu Bàng', lat: 11.2410, lng: 106.6110, s: 84.0 },
  { id: 'hub_ql13_bau_bang', name: 'Trạm dừng KCN Bàu Bàng', lat: 11.2382, lng: 106.6125, s: 84.5 },
  { id: 'hub_ql13_nga4_so_sao', name: 'Ngã 4 Sở Sao / Đại Nam', lat: 11.0423, lng: 106.6341, s: 107.0 },
  { id: 'hub_ql13_vsip1', name: 'KCN VSIP 1 / AEON Mall Canary', lat: 10.9328, lng: 106.6972, s: 122.0 },
  { id: 'hub_ql13_cong_chao_lai_thieu', name: 'Cổng chào Bình Dương (Lái Thiêu)', lat: 10.9015, lng: 106.6985, s: 126.0 },
  { id: 'hub_ql13_nga4_binh_phuoc', name: 'Ngã 4 Bình Phước (Thủ Đức - QL1A)', lat: 10.8525, lng: 106.7214, s: 132.5 },
  { id: 'hub_ql13_van_phuc_city', name: 'Khu đô thị Vạn Phúc City', lat: 10.8410, lng: 106.7125, s: 134.5 },
  { id: 'hub_ql13_binh_trieu', name: 'Cầu Bình Triệu / BX Miền Đông cũ', lat: 10.8175, lng: 106.7118, s: 137.5 },
  { id: 'hub_ql13_hang_xanh', name: 'Ngã tư Hàng Xanh (Bình Thạnh)', lat: 10.8012, lng: 106.7114, s: 139.5 },
  { id: 'hub_ql13_san_bay_tsn', name: 'Sân bay Quốc tế Tân Sơn Nhất (Phạm Văn Đồng)', lat: 10.8185, lng: 106.6660, s: 142.5 }
];

// Bản đồ tra cứu mốc cọc s cho từng trạm
const HUB_S_MAP = new Map(QL13_CORRIDOR_POLYLINE.map((node) => [node.id, node.s]));

/**
 * Lấy vị trí cọc số km (s) của trạm trên hành lang QL13
 */
export function getStationStationKm(stationId) {
  return HUB_S_MAP.get(stationId) ?? null;
}

/**
 * Chiếu tọa độ GPS (lat, lng) vào tim đường QL13 (Stanford Frenet Frame)
 * @param {number} lat - Vĩ độ GPS
 * @param {number} lng - Kinh độ GPS
 * @param {string} corridor - Hành lang tuyến
 * @returns {object} { s, d, isOnCorridor, closestNode, segmentIndex }
 */
export function projectToCorridorFrenet(lat, lng, corridor = 'Tuyến QL13') {
  if (lat == null || lng == null) {
    return { s: 0, d: 9999, isOnCorridor: false, closestNode: null };
  }

  const polyline = QL13_CORRIDOR_POLYLINE;
  let minDistanceMeters = Infinity;
  let bestS = 0;
  let closestNode = polyline[0];
  let bestSegmentIndex = 0;

  // Lặp qua các đoạn tim đường để tìm hình chiếu gần nhất
  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];

    // Chiếu tọa độ theo xấp xỉ hệ tọa độ phẳng địa phương (Flat Earth Approximation)
    const latRad = (lat * Math.PI) / 180;
    const mPerDegLat = 111132.954;
    const mPerDegLng = 111412.84 * Math.cos(latRad);

    const x = (lng - p1.lng) * mPerDegLng;
    const y = (lat - p1.lat) * mPerDegLat;

    const dx = (p2.lng - p1.lng) * mPerDegLng;
    const dy = (p2.lat - p1.lat) * mPerDegLat;
    const segLenSq = dx * dx + dy * dy;

    let t = 0;
    if (segLenSq > 0) {
      t = Math.max(0, Math.min(1, (x * dx + y * dy) / segLenSq));
    }

    const projX = t * dx;
    const projY = t * dy;
    const distMeters = Math.hypot(x - projX, y - projY);

    if (distMeters < minDistanceMeters) {
      minDistanceMeters = distMeters;
      const segDistanceKm = p2.s - p1.s;
      bestS = p1.s + t * segDistanceKm;
      closestNode = t > 0.5 ? p2 : p1;
      bestSegmentIndex = i;
    }
  }

  const d = Math.round(minDistanceMeters);
  // Ngưỡng dung sai tim đường: Cho phép lệch tối đa 85 mét (bao gồm lề đường và cây xăng mặt tiền)
  const isOnCorridor = d <= 85;

  return {
    s: Math.round(bestS * 10) / 10,
    d,
    isOnCorridor,
    closestNode,
    segmentIndex: bestSegmentIndex,
    corridor
  };
}

/**
 * 2. TÍNH NGƯỠNG RADAR ĐỘNG HỌC THEO VẬN TỐC THỰC TẾ (KINEMATIC TRIGGER)
 * @param {number} speedKmh - Vận tốc hiện tại của xe (km/h)
 * @param {number} ttaSeconds - Thời gian báo trước mong muốn (mặc định 210 giây ~ 3.5 phút)
 * @returns {number} Khoảng cách radar cần kích hoạt (km)
 */
export function calculateKinematicTriggerDistance(speedKmh = 75, ttaSeconds = 210) {
  const speed = Math.max(20, Number(speedKmh) || 75);
  const speedMs = speed / 3.6;
  const triggerMeters = speedMs * ttaSeconds;
  const triggerKm = triggerMeters / 1000;
  // Ngưỡng tối thiểu là 3.0 km để tài xế luôn có đủ thời gian phản xạ
  return Math.round(Math.max(3.0, triggerKm) * 10) / 10;
}

/**
 * 3. MIT INTERVAL SCHEDULING (PHÂN BỔ GHẾ THEO KHOẢNG GỐI ĐẦU)
 * Kiểm tra khoảng hành trình của khách [s_pickup, s_dropoff] có nằm trong dải di chuyển của xe không.
 * @param {number} carStartS - Mốc s xuất phát của xe (km)
 * @param {number} carEndS - Mốc s kết thúc của xe (km)
 * @param {number} riderPickupS - Mốc s đón khách (km)
 * @param {number} riderDropoffS - Mốc s trả khách (km)
 * @returns {boolean} true nếu thỏa mãn điều kiện gối đầu
 */
export function isIntervalSchedulingFeasible(carStartS, carEndS, riderPickupS, riderDropoffS) {
  if (riderPickupS == null || riderDropoffS == null) return true;
  // Xe chạy hướng Nam (s tăng dần từ Bình Long về Sài Gòn)
  const isSouthbound = carEndS > carStartS;
  if (isSouthbound) {
    return (
      riderDropoffS > riderPickupS &&
      riderPickupS >= (carStartS - 2.0) && // Cho phép dung sai 2km điểm đón
      riderDropoffS <= (carEndS + 5.0)    // Cho phép trả trong vùng lân cận điểm cuối
    );
  }
  // Trường hợp xe chạy hướng ngược lại (Bắc về Bình Phước)
  return (
    riderDropoffS < riderPickupS &&
    riderPickupS <= (carStartS + 2.0) &&
    riderDropoffS >= (carEndS - 5.0)
  );
}
