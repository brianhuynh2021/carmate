/**
 * =============================================================================
 * CARMATE STANFORD FRENET FRAME TRANSFORMATION & KINEMATICS ENGINE
 * =============================================================================
 * Applies research by Moritz Werling & Sebastian Thrun (Stanford University)
 * and the Dwell-Time kinematics of Prof. Carlos Daganzo (UC Berkeley).
 *
 * 1. Eliminating the 2D map problem (2D -> 1D Coordinate Projection):
 *    Project the car's GPS coordinates (lat, lon) perpendicularly onto the corridor centerline to obtain:
 *    - s(t): Kilometer marker along the route (1-D linear, O(1) interval checks).
 *    - d(t): Perpendicular offset from the road centerline (meters).
 *    - isOnCorridor: Verifies the vehicle is actually rolling on the route (|d| <= 75m).
 *
 * 2. Kinematic Radar Window (Kinematic TTA Trigger Window):
 *    The radar trigger threshold before a station automatically scales with the actual speed v:
 *    d_trigger = max(3.0 km, (v / 3.6) * 210s / 1000)
 *    (A vehicle at 78 km/h triggers at ~4.5 km; a vehicle at 50 km/h triggers at 3.0 km).
 *
 * 3. MIT Interval Scheduling (seat allocation by overlapping intervals):
 *    Check that the linear segment [s_pickup, s_dropoff] falls within the vehicle's journey.
 * =============================================================================
 */


// Standardized centerline of National Highway 13 (from Lộc Ninh / Bình Long to Sài Gòn & Tân Sơn Nhất Airport)
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
  { id: 'hub_ql13_san_bay_tsn', name: 'Sân bay Quốc tế Tân Sơn Nhất (Phạm Văn Đồng)', lat: 10.8185, lng: 106.6660, s: 142.5 },
  { id: 'hub_ql13_cho_ray', name: 'Cụm BV Chợ Rẫy / ĐHYD (Quận 5)', lat: 10.7578, lng: 106.6596, s: 145.0 }
];

// Lookup map of the s marker for each station
const HUB_S_MAP = new Map(QL13_CORRIDOR_POLYLINE.map((node) => [node.id, node.s]));

/**
 * Get the kilometer marker position (s) of a station on the QL13 corridor
 */
export function getStationStationKm(stationId) {
  return HUB_S_MAP.get(stationId) ?? null;
}

/**
 * Project a GPS coordinate (lat, lng) onto the QL13 centerline (Stanford Frenet Frame)
 * @param {number} lat - GPS latitude
 * @param {number} lng - GPS longitude
 * @param {string} corridor - Route corridor
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

  // Iterate over the centerline segments to find the nearest projection
  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];

    // Project the coordinates using a local flat-plane approximation (Flat Earth Approximation)
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
  // Centerline tolerance threshold: allow a maximum offset of 85 meters (including road shoulders and storefront gas stations)
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
 * 2. COMPUTE THE KINEMATIC RADAR THRESHOLD FROM ACTUAL SPEED (KINEMATIC TRIGGER)
 * @param {number} speedKmh - The vehicle's current speed (km/h)
 * @param {number} ttaSeconds - Desired advance-notice time (default 210 seconds ~ 3.5 minutes)
 * @returns {number} Distance at which the radar must trigger (km)
 */
export function calculateKinematicTriggerDistance(speedKmh = 75, ttaSeconds = 210) {
  const speed = Math.max(20, Number(speedKmh) || 75);
  const speedMs = speed / 3.6;
  const triggerMeters = speedMs * ttaSeconds;
  const triggerKm = triggerMeters / 1000;
  // The minimum threshold is 3.0 km so the driver always has enough reaction time
  return Math.round(Math.max(3.0, triggerKm) * 10) / 10;
}

/**
 * 3. MIT INTERVAL SCHEDULING (SEAT ALLOCATION BY OVERLAPPING INTERVALS)
 * Check whether the passenger's trip interval [s_pickup, s_dropoff] lies within the vehicle's travel range.
 * @param {number} carStartS - The vehicle's starting s marker (km)
 * @param {number} carEndS - The vehicle's ending s marker (km)
 * @param {number} riderPickupS - The passenger's pickup s marker (km)
 * @param {number} riderDropoffS - The passenger's drop-off s marker (km)
 * @returns {boolean} true if the overlapping-interval condition is satisfied
 */
export function isIntervalSchedulingFeasible(carStartS, carEndS, riderPickupS, riderDropoffS) {
  if (riderPickupS == null || riderDropoffS == null) return true;
  // Vehicle traveling southbound (s increases from Bình Long to Sài Gòn)
  const isSouthbound = carEndS > carStartS;
  if (isSouthbound) {
    return (
      riderDropoffS > riderPickupS &&
      riderPickupS >= (carStartS - 2.0) && // Allow a 2km tolerance at the pickup point
      riderDropoffS <= (carEndS + 5.0)    // Allow drop-off in the vicinity of the end point
    );
  }
  // Case where the vehicle travels in the opposite direction (northbound back to Bình Phước)
  return (
    riderDropoffS < riderPickupS &&
    riderPickupS <= (carStartS + 2.0) &&
    riderDropoffS >= (carEndS - 5.0)
  );
}
