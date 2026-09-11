/**
 * Unhappy Case Protocols & Mechanism Design Invariants for CarMate
 * 
 * Defines standard incident codes, sanction matrices, immutable policies,
 * and emergency lifebuoys for real-world corridor operations along QL13.
 * 
 * Strict Terminology: "Chủ xe" và "Người đi cùng" / "Khách đi cùng".
 * MIT Invariants: System states never reach contradictory or illegal states.
 */

export const UNHAPPY_CASE_CODES = Object.freeze({
  RIDER_NO_SHOW: 'RIDER_NO_SHOW',                   // Case 1: Khách vắng mặt sau 5 phút
  GHOST_PASSENGER: 'GHOST_PASSENGER',               // Case 2: Khách kẹp thêm người ngoài vé
  LUGGAGE_VIOLATION: 'LUGGAGE_VIOLATION',           // Case 3: Hành lý quá khổ / có mùi
  MOTION_SICKNESS_SOILING: 'MOTION_SICKNESS_SOILING', // Case 4: Say xe nôn ói ra nội thất
  OFF_CORRIDOR_DETOUR: 'OFF_CORRIDOR_DETOUR',       // Case 5: Đòi tạt ngang / vào hẻm
  EN_ROUTE_BREAKDOWN: 'EN_ROUTE_BREAKDOWN',         // Case 6: Xe gặp sự cố kỹ thuật giữa đường
  UNPAID_FARE_FRAUD: 'UNPAID_FARE_FRAUD'            // Case 7: Quỵt tiền phụ xăng chia sẻ
});

export const LUGGAGE_POLICY = Object.freeze({
  maxWeightKg: 10,
  maxBags: 1,
  prohibitedItems: [
    'Sầu riêng, mít hoặc trái cây nặng mùi',
    'Hải sản tươi sống, đồ ướp đá rỉ nước',
    'Gia súc, gia cầm sống, thú cưng không lồng chuyên dụng',
    'Hóa chất dễ cháy nổ, bình gas mini, xăng dầu'
  ],
  summaryText: 'Mỗi khách tối đa 1 kiện balo/vali xách tay gọn nhẹ (≤ 10kg). Nghiêm cấm hàng có mùi hoặc hàng tươi sống rỉ nước.'
});

export const CORRIDOR_1D_POLICY = Object.freeze({
  title: 'Kỷ luật Đường ống 1D (Corridor 1D Invariant)',
  ruleText: 'Chủ xe đón và trả khách 100% tại mặt tiền trục QL13/cao tốc theo đúng trạm đã chốt. Tuyệt đối không phục vụ rẽ ngõ hẻm hoặc tạt ngang chợ mua sắm để bảo đảm giờ giấc làm việc.'
});

export const MOTION_SICKNESS_POLICY = Object.freeze({
  reminderText: 'Ý thức đồng hành: Vui lòng tự giác báo chủ xe nếu thấy mệt hoặc say xe (túi nôn luôn có sẵn sau lưng ghế).',
  cleaningFeeRange: '500.000đ – 1.000.000đ',
  obligationText: 'Trường hợp nôn ói làm bẩn nội thất xe, người đi cùng có nghĩa vụ bồi hoàn chi phí dọn dẹp vệ sinh thực tế theo hóa đơn tiệm chăm sóc xe.'
});

export const EMERGENCY_TRANSIT_LIFEBUOYS = Object.freeze([
  {
    id: 'bus-15',
    name: 'Tuyến Buýt 15 (Chợ Tân Khai ➔ Bến xe Bình Long)',
    frequency: '15 phút/chuyến',
    contact: '0271.3888.999'
  },
  {
    id: 'bus-ql13',
    name: 'Tuyến Buýt QL13 (Bến Cát ➔ Bến xe Miền Đông mới)',
    frequency: '20 phút/chuyến',
    contact: '1900.0123'
  },
  {
    id: 'coach-intercity',
    name: 'Xe khách liên tỉnh QL13 (Kumho Samco / Thành Công)',
    frequency: 'Chạy liên tục dọc trục QL13 (vẫy đón tại cây xăng)',
    contact: '1900.6079'
  },
  {
    id: 'rescue-towing',
    name: 'Tổng đài Cứu hộ Giao thông & Xe kéo Bình Phước - Bình Dương',
    frequency: 'Trực 24/7',
    contact: '0903.116.116'
  }
]);

/**
 * Đánh giá chế tài và hành động tương ứng với mã sự cố
 * @param {string} incidentType - Mã sự cố thuộc UNHAPPY_CASE_CODES
 * @param {object} context - Dữ liệu ngữ cảnh
 * @returns {object} Kết quả xử lý chế tài
 */
export function evaluateIncidentSanctions(incidentType, context = {}) {
  switch (incidentType) {
    case UNHAPPY_CASE_CODES.GHOST_PASSENGER:
      return {
        action: 'ABSOLUTE_VETO_CANCEL',
        driverReleased: true,
        driverPenalty: 0,
        riderPenalty: 25,
        fareExempt: false,
        isBanned: false,
        message: 'Chủ xe thực thi Quyền phủ quyết tuyệt đối do khách kẹp thêm người. Hủy chuyến không tính lỗi chủ xe. Trừ 25 điểm tín nhiệm khách.'
      };

    case UNHAPPY_CASE_CODES.LUGGAGE_VIOLATION:
      return {
        action: 'LUGGAGE_REJECT_CANCEL',
        driverReleased: true,
        driverPenalty: 0,
        riderPenalty: 15,
        fareExempt: false,
        isBanned: false,
        message: 'Chủ xe từ chối vận chuyển do hành lý vi phạm quy chuẩn (quá 10kg hoặc có mùi). Trừ 15 điểm tín nhiệm khách.'
      };

    case UNHAPPY_CASE_CODES.MOTION_SICKNESS_SOILING:
      return {
        action: 'RECORD_SOILING_INCIDENT',
        driverReleased: false,
        driverPenalty: 0,
        riderPenalty: 0,
        cleaningReimbursementRequired: true,
        suggestedAmountMin: 500000,
        suggestedAmountMax: 1000000,
        message: 'Ghi nhận sự cố làm bẩn nội thất xe. Người đi cùng có nghĩa vụ bồi hoàn phí vệ sinh từ 500.000đ đến 1.000.000đ.'
      };

    case UNHAPPY_CASE_CODES.OFF_CORRIDOR_DETOUR:
      return {
        action: 'ENFORCE_CORRIDOR_1D',
        driverReleased: false,
        driverPenalty: 0,
        riderPenalty: 5,
        message: 'Nhắc nhở Kỷ luật đường ống 1D: Chuyến đi chỉ trả khách trên mặt tiền trục QL13/cao tốc, không vào đường hẻm.'
      };

    case UNHAPPY_CASE_CODES.EN_ROUTE_BREAKDOWN:
      return {
        action: 'EMERGENCY_BREAKDOWN_TERMINATE',
        driverReleased: true,
        driverPenalty: 0,
        riderPenalty: 0,
        fareExempt: true,
        finalFare: 0,
        triggerLifebuoy: true,
        lifebuoys: EMERGENCY_TRANSIT_LIFEBUOYS,
        message: 'Xe gặp sự cố kỹ thuật giữa đường (bất khả kháng). Miễn 100% tiền cước cho khách (0đ) và kích hoạt phao cứu sinh chuyển tiếp.'
      };

    case UNHAPPY_CASE_CODES.UNPAID_FARE_FRAUD:
      return {
        action: 'PERMABAN_RIDER',
        driverReleased: true,
        driverPenalty: 0,
        riderPenalty: 100,
        isBanned: true,
        newTrustScore: 0,
        banReason: 'UNPAID_FARE_FRAUD',
        message: 'Khách có hành vi quỵt tiền phụ xăng. Hệ thống Permaban vĩnh viễn số điện thoại và thiết bị của khách khỏi CarMate.'
      };

    case UNHAPPY_CASE_CODES.RIDER_NO_SHOW:
    default:
      return {
        action: 'PENALIZE_RIDER_NO_SHOW',
        driverReleased: true,
        driverPenalty: 0,
        riderPenalty: 30,
        message: 'Khách vắng mặt tại trạm sau 5 phút dừng đỗ. Trừ 30 điểm tín nhiệm khách, chủ xe được lăn bánh an toàn.'
      };
  }
}
