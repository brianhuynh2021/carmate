/**
 * ============================================================================
 * BỘ GIẢ LẬP CHẶNG CUỐI NỘI BỘ (LAST-MILE TRANSIT CALCULATOR - ZERO EXTERNAL API)
 * ============================================================================
 * 
 * Giải quyết bài toán tâm lý: "Xe không đưa tận cửa, từ trạm về nhà thế nào?"
 * - Tự động đối chiếu điểm đến ngõ ngách với Trạm Hub tối ưu trên hành lang QL13.
 * - Tính toán cự ly chặng cuối, dự toán chi phí GrabBike / Xe ôm / Đi bộ.
 * - Đưa ra bảng phân tích tổng chi phí và mức tiết kiệm so với taxi đường dài liên tỉnh.
 */

import { getFixedSegmentTariff } from '../constants/routes.js';

// DANH MỤC CÁC ĐỊA DANH PHỔ BIẾN TẠI TP.HCM & BÌNH PHƯỚC KÈM TRẠM HUB TỐI ƯU
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
 * Tính toán giải pháp chặng cuối dựa trên điểm đến mong muốn của hành khách
 * @param {string} destinationKeyword - Tên hoặc từ khoá điểm đến (VD: "Chợ Bà Chiểu", "Quận 1", "Chợ Rẫy")
 * @param {string} originHubId - Trạm xuất phát của khách (Mặc định: 'hub_ql13_tan_khai')
 * @returns {object} Kết quả phân tích chi phí và gợi ý di chuyển
 */
export function calculateLastMileOption(destinationKeyword = '', originHubId = 'hub_ql13_tan_khai') {
  const cleanInput = String(destinationKeyword || '').trim().toLowerCase();

  // 1. Tìm điểm đến khớp trong danh mục hoặc lấy điểm đầu tiên làm mặc định
  let matchedDestination = POPULAR_LAST_MILE_DESTINATIONS.find((dest) => {
    return (
      dest.id.toLowerCase().includes(cleanInput) ||
      dest.name.toLowerCase().includes(cleanInput) ||
      dest.shortName.toLowerCase().includes(cleanInput) ||
      dest.keywords?.some((k) => cleanInput.includes(k) || k.includes(cleanInput))
    );
  });

  if (!matchedDestination) {
    // Nếu gõ tự do, ước lượng thông minh: mặc định trạm Ngã tư Hàng Xanh
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

  // 2. Tra cứu cước cố định CarMate Metro từ điểm đón tới Hub tối ưu
  const carmateTariff = getFixedSegmentTariff(originHubId, matchedDestination.bestHubId);
  const carmateFareVND = carmateTariff.pricePerSeat;

  // 3. Tính toán tổng chi phí và mức tiết kiệm
  const grabBikeVND = matchedDestination.grabBikeEstimateVND;
  const totalCostVND = carmateFareVND + grabBikeVND;

  // Taxi truyền thống / GrabCar liên tỉnh cùng chặng đường (thường 8.000đ - 9.000đ/km trọn gói ~ 850.000đ)
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
