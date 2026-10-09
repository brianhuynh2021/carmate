/**
 * ============================================================================
 * INTERNAL LAST-MILE SIMULATOR (LAST-MILE TRANSIT CALCULATOR - ZERO EXTERNAL API)
 * ============================================================================
 * 
 * Solves a psychological problem: "The car does not take me to my door, how do I get home from the station?"
 * - Automatically matches alleyway destinations to the optimal station (Hub) on the QL13 corridor.
 * - Computes the last-mile distance, estimates the cost of GrabBike / motorbike taxi ("xe ôm") / walking.
 * - Produces a table analyzing total cost and savings compared with an intercity long-distance taxi.
 */

import { getFixedSegmentTariff } from '../constants/routes.js';

// CATALOG OF POPULAR PLACES IN TP.HCM & BÌNH PHƯỚC WITH THEIR OPTIMAL STATION (HUB)
export const POPULAR_LAST_MILE_DESTINATIONS = [
  {
    id: 'cho_ba_chieu',
    name: 'Chợ Bà Chiểu (Bình Thạnh)',
    shortName: 'Chợ Bà Chiểu',
    icon: '🛍️',
    bestHubId: 'hub_ql13_hang_xanh',
    bestHubName: 'Ngã tư Hàng Xanh',
    keywords: ['bà chiểu', 'ba chieu', 'chợ bà chiểu', 'bình thạnh'],
    distanceToHubKm: 1.5,
    walkingMinutes: 18,
    rideMinutes: 4,
    grabBikeEstimateVND: 15000,
    isWalkable: true,
    note: 'Đi bộ 1.5km hoặc GrabBike 15k là tới cổng chợ'
  },
  {
    id: 'landmark_81',
    name: 'Tòa nhà Landmark 81 / Vinhomes Central Park',
    shortName: 'Landmark 81',
    icon: '🏢',
    bestHubId: 'hub_ql13_hang_xanh',
    bestHubName: 'Ngã tư Hàng Xanh',
    keywords: ['landmark', 'vinhomes', 'central park', 'tân cảng', 'tan cang'],
    distanceToHubKm: 1.8,
    walkingMinutes: 20,
    rideMinutes: 5,
    grabBikeEstimateVND: 15000,
    isWalkable: true,
    note: 'Chạy thẳng Điện Biên Phủ vào đường ven sông'
  },
  {
    id: 'ben_thanh_q1',
    name: 'Chợ Bến Thành / Phố đi bộ Nguyễn Huệ (Quận 1)',
    shortName: 'Bến Thành / Q.1',
    icon: '🏛️',
    bestHubId: 'hub_ql13_hang_xanh',
    bestHubName: 'Ngã tư Hàng Xanh',
    keywords: ['bến thành', 'ben thanh', 'quận 1', 'quan 1', 'nguyễn huệ', 'nguyen hue', 'q.1', 'q1'],
    distanceToHubKm: 4.2,
    walkingMinutes: 50,
    rideMinutes: 12,
    grabBikeEstimateVND: 22000,
    isWalkable: false,
    note: 'Chạy dọc Xô Viết Nghệ Tĩnh / Nguyễn Thị Minh Khai vào trung tâm'
  },
  {
    id: 'bv_cho_ray',
    name: 'Bệnh viện Chợ Rẫy (Nguyễn Chí Thanh - Quận 5)',
    shortName: 'BV Chợ Rẫy (Q.5)',
    icon: '🏥',
    bestHubId: 'hub_ql13_hang_xanh',
    bestHubName: 'Ngã tư Hàng Xanh',
    keywords: ['chợ rẫy', 'cho ray', 'quận 5', 'quan 5', 'q.5', 'q5', 'bệnh viện', 'bv'],
    distanceToHubKm: 7.5,
    walkingMinutes: 90,
    rideMinutes: 18,
    grabBikeEstimateVND: 32000,
    isWalkable: false,
    note: 'Qua Điện Biên Phủ nối dài vào đường 3 Tháng 2'
  },
  {
    id: 'san_bay_tsn_term',
    name: 'Sân bay Quốc tế Tân Sơn Nhất (Ga T1/T2)',
    shortName: 'Sân bay TSN',
    icon: '✈️',
    bestHubId: 'hub_ql13_san_bay_tsn',
    bestHubName: 'Sân bay Tân Sơn Nhất',
    keywords: ['sân bay', 'san bay', 'tân sơn nhất', 'tan son nhat', 'tsn', 'ga t1', 'ga t2', 'airport', 'phi trường'],
    distanceToHubKm: 0.2,
    walkingMinutes: 3,
    rideMinutes: 1,
    grabBikeEstimateVND: 0,
    isWalkable: true,
    note: 'Trạm trả ngay tại sảnh Cột 12 ga Quốc Nội / Quốc Tế'
  },
  {
    id: 'dh_quoc_gia_thu_duc',
    name: 'Làng ĐH Quốc Gia / Khu Công Nghệ Cao (TP. Thủ Đức)',
    shortName: 'ĐH Quốc Gia (Thủ Đức)',
    icon: '🎓',
    bestHubId: 'hub_ql13_nga4_binh_phuoc',
    bestHubName: 'Ngã 4 Bình Phước',
    keywords: ['đại học quốc gia', 'dai hoc quoc gia', 'thủ đức', 'thu duc', 'làng đại học', 'khu công nghệ cao', 'dhqg'],
    distanceToHubKm: 5.2,
    walkingMinutes: 60,
    rideMinutes: 12,
    grabBikeEstimateVND: 25000,
    isWalkable: false,
    note: 'Xuống Ngã 4 Bình Phước rẽ QL1A đi thẳng 5km'
  },
  {
    id: 'van_phuc_urban',
    name: 'Khu Đô Thị Vạn Phúc City (QL13 Hiệp Bình Phước)',
    shortName: 'Vạn Phúc City',
    icon: '🏙️',
    bestHubId: 'hub_ql13_van_phuc_city',
    bestHubName: 'KĐT Vạn Phúc City',
    keywords: ['vạn phúc', 'van phuc', 'hiệp bình phước', 'cân nhơn hòa'],
    distanceToHubKm: 0.1,
    walkingMinutes: 1,
    rideMinutes: 1,
    grabBikeEstimateVND: 0,
    isWalkable: true,
    note: 'Trạm đón/trả ngay cổng chính khu đô thị'
  }
];

/**
 * Compute a last-mile solution based on the passenger's desired destination
 * @param {string} destinationKeyword - Destination name or keyword (e.g. "Chợ Bà Chiểu", "Quận 1", "Chợ Rẫy")
 * @param {string} originHubId - The passenger's departure station (default: 'hub_ql13_tan_khai')
 * @returns {object} Cost analysis result and travel suggestions
 */
export function calculateLastMileOption(destinationKeyword = '', originHubId = 'hub_ql13_tan_khai') {
  const cleanInput = String(destinationKeyword || '').trim().toLowerCase();

  // 1. Find a matching destination in the catalog or take the first one as the default
  let matchedDestination = POPULAR_LAST_MILE_DESTINATIONS.find((dest) => {
    return (
      dest.id.toLowerCase().includes(cleanInput) ||
      dest.name.toLowerCase().includes(cleanInput) ||
      dest.shortName.toLowerCase().includes(cleanInput) ||
      dest.keywords?.some((k) => cleanInput.includes(k) || k.includes(cleanInput))
    );
  });

  if (!matchedDestination) {
    // If typed freely, estimate smartly: default to the Ngã tư Hàng Xanh station
    matchedDestination = {
      id: 'custom_dest',
      name: destinationKeyword || 'Điểm đến nội thành TP.HCM',
      shortName: destinationKeyword || 'Nội thành TP.HCM',
      icon: '📍',
      bestHubId: 'hub_ql13_hang_xanh',
      bestHubName: 'Ngã tư Hàng Xanh',
      distanceToHubKm: 2.5,
      walkingMinutes: 30,
      rideMinutes: 7,
      grabBikeEstimateVND: 18000,
      isWalkable: false,
      note: 'Từ Trạm Hàng Xanh bắt GrabBike/Xe ôm vào ngõ ngách'
    };
  }

  // 2. Look up the CarMate Metro fixed fare from the pickup point to the optimal Hub
  const carmateTariff = getFixedSegmentTariff(originHubId, matchedDestination.bestHubId);
  const carmateFareVND = carmateTariff.pricePerSeat;

  // 3. Compute total cost and savings
  const grabBikeVND = matchedDestination.grabBikeEstimateVND;
  const totalCostVND = carmateFareVND + grabBikeVND;

  // Traditional taxi / intercity GrabCar over the same route (usually 8.000đ - 9.000đ/km, ~850.000đ all-inclusive)
  const taxiEstimatedFareVND = Math.round(Math.max(650000, (carmateTariff.distanceKm + matchedDestination.distanceToHubKm) * 8500) / 10000) * 10000;
  const savingsVND = Math.max(0, taxiEstimatedFareVND - totalCostVND);

  return {
    destination: matchedDestination,
    bestHubId: matchedDestination.bestHubId,
    bestHubName: matchedDestination.bestHubName,
    carmateFareVND,
    grabBikeVND,
    totalCostVND,
    taxiEstimatedFareVND,
    savingsVND,
    distanceToHubKm: matchedDestination.distanceToHubKm,
    walkingMinutes: matchedDestination.walkingMinutes,
    rideMinutes: matchedDestination.rideMinutes,
    isWalkable: matchedDestination.isWalkable
  };
}
