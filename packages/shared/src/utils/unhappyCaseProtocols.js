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
  UNPAID_FARE_FRAUD: 'UNPAID_FARE_FRAUD',           // Case 7: Quỵt tiền phụ xăng chia sẻ
  DRIVER_LATE_CANCELLATION: 'DRIVER_LATE_CANCELLATION', // Case 8: Chủ xe trễ > 5 phút tại trạm
  CULTURE_VIOLATION_SMOKING: 'CULTURE_VIOLATION_SMOKING', // Case 9: Vi phạm cam kết không khói thuốc
  CULTURE_VIOLATION_PICKUP_SOLICITING: 'CULTURE_VIOLATION_PICKUP_SOLICITING', // Case 10: Vẫy khách dù dọc đường
  CULTURE_VIOLATION_PRICE_GOUGING: 'CULTURE_VIOLATION_PRICE_GOUGING', // Case 11: Đòi thêm tiền ngoài thỏa thuận
  EARLY_PREDICTION_RISK_FAIL: 'EARLY_PREDICTION_RISK_FAIL' // Case 12: Dự báo rủi ro bùng chuyến sớm
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
export function evaluateIncidentSanctions(incidentType, _context = {}) {
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

    case UNHAPPY_CASE_CODES.DRIVER_LATE_CANCELLATION:
      return {
        action: 'GRACE_CANCEL_PASSENGER',
        driverReleased: true,
        driverPenalty: 15,
        riderPenalty: 0,
        fareExempt: true,
        finalFare: 0,
        isBanned: false,
        message: 'Chủ xe trễ quá 5 phút tại trạm đón. Người đi cùng được hủy chuyến miễn phạt (0đ), điểm tín nhiệm được bảo toàn nguyên vẹn.'
      };

    case UNHAPPY_CASE_CODES.CULTURE_VIOLATION_SMOKING:
    case UNHAPPY_CASE_CODES.CULTURE_VIOLATION_PICKUP_SOLICITING:
    case UNHAPPY_CASE_CODES.CULTURE_VIOLATION_PRICE_GOUGING:
      return {
        action: 'GRIM_TRIGGER_SUSPENSION',
        driverReleased: true,
        driverPenalty: 50,
        riderPenalty: 0,
        fareExempt: true,
        isSuspended: true,
        suspensionDays: 30,
        message: 'Kích hoạt Cơ chế Trừng phạt Grim Trigger: Đình chỉ tài khoản Chủ xe 30 ngày do vi phạm cam kết văn hóa chuyến đi (hút thuốc/bắt khách dù/tăng giá).'
      };

    case UNHAPPY_CASE_CODES.EARLY_PREDICTION_RISK_FAIL:
      return {
        action: 'EARLY_FAIL_RESCUE',
        driverReleased: true,
        driverPenalty: 20,
        riderPenalty: 0,
        fareExempt: true,
        finalFare: 0,
        triggerLifebuoy: true,
        lifebuoys: FIXED_CORRIDOR_COACH_SCHEDULES,
        message: 'Hệ thống phát hiện rủi ro bùng chuyến sớm từ xa. Hủy chuyến sớm 0đ phạt cho khách và kích hoạt cứu trợ xe khách QL13.'
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

/**
 * Lịch xe khách tuyến cố định dọc hành lang QL13 (Physical Transit Lifebuoys)
 */
export const FIXED_CORRIDOR_COACH_SCHEDULES = Object.freeze([
  {
    id: 'thanh-cong-0445',
    operator: 'Xe khách Thành Công (Tuyến QL13)',
    departureStation: 'Cây xăng Petrolimex Tân Khai',
    destinationStation: 'Bến xe Miền Đông / CMT8',
    pickupTime: '04:45',
    estimatedArrival: '07:30',
    ticketPrice: 90000,
    hotline: '1900 6962',
    frequency: '30 phút/chuyến',
    notes: 'Có thể đứng tại cây xăng vẫy trực tiếp hoặc gọi hotline đón trước 15 phút.'
  },
  {
    id: 'kumho-samco-0500',
    operator: 'Kumho Samco Buslines (QL13 Express)',
    departureStation: 'Ngã tư Chơn Thành / QL13',
    destinationStation: 'Bến xe Miền Đông (cũ & mới)',
    pickupTime: '05:00',
    estimatedArrival: '07:15',
    ticketPrice: 95000,
    hotline: '1900 6065',
    frequency: '20 phút/chuyến',
    notes: 'Xe giường nằm cao cấp, đón dọc mặt tiền QL13.'
  },
  {
    id: 'bus-15-morning',
    operator: 'Tuyến Xe Buýt 15 (Bình Long ➔ Thủ Dầu Một)',
    departureStation: 'Mặt tiền chợ Tân Khai / Cây xăng QL13',
    destinationStation: 'Bến xe Khách Tỉnh Bình Dương (Thủ Dầu Một)',
    pickupTime: '05:15',
    estimatedArrival: '07:00',
    ticketPrice: 35000,
    hotline: '0271 3888 999',
    frequency: '15 phút/chuyến',
    notes: 'Phương án cứu sinh công cộng giá rẻ, kết nối tiếp buýt nhanh vào trung tâm TP.HCM.'
  },
  {
    id: 'petro-binh-phuoc-0530',
    operator: 'Petro Bình Phước Limousine',
    departureStation: 'Trạm thu phí Bàu Bàng',
    destinationStation: 'Sân bay Tân Sơn Nhất / Quận 1',
    pickupTime: '05:30',
    estimatedArrival: '07:15',
    ticketPrice: 140000,
    hotline: '0271 3888 888',
    frequency: '60 phút/chuyến',
    notes: 'Xe Limousine VIP 9 chỗ đón dọc hành lang QL13.'
  }
]);

/**
 * Tính toán xác suất bùng chuyến / trễ hẹn sớm của Chủ xe:
 * P_fail = w1 * (1 - R_driver) + w2 * S_heartbeat + w3 * D_geo
 * 
 * @param {object} params
 * @param {number} params.trustScore - Điểm uy tín [0..100] (mặc định 100)
 * @param {number} params.lastHeartbeatMinutesAgo - Số phút từ lần cuối app chủ xe gửi ping (mặc định 0)
 * @param {boolean} params.isVehicleStationaryAtT45 - Xe vẫn đứng yên tại nhà lúc T - 45 phút
 * @param {number} params.speedKmh - Tốc độ hiện tại của xe (km/h)
 * @param {number} params.distanceToStationKm - Khoảng cách đến trạm đón (km)
 * @returns {object} { riskProbability: number, isHighRisk: boolean, riskLevel: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL', details: object }
 */
export function calculateEarlyFailureRisk({
  trustScore = 100,
  lastHeartbeatMinutesAgo = 0,
  isVehicleStationaryAtT45 = false,
  speedKmh = 0,
  distanceToStationKm = 0
} = {}) {
  const w1 = 0.30;
  const w2 = 0.35;
  const w3 = 0.35;

  // 1. Chỉ số rủi ro uy tín R_driver (điểm càng thấp rủi ro càng cao)
  const normalizedTrust = Math.max(0, Math.min(100, Number(trustScore) || 100)) / 100;
  const riskReputation = 1 - normalizedTrust;

  // 2. Chỉ số rủi ro mất liên lạc S_heartbeat (offline càng lâu rủi ro càng cao)
  // Không ping trong > 60 phút: rủi ro = 1.0; 30 phút: 0.5
  const riskHeartbeat = Math.min(1.0, Math.max(0, Number(lastHeartbeatMinutesAgo) / 60));

  // 3. Chỉ số rủi ro địa lý D_geo (đứng yên xa trạm ở mốc T - 45m)
  let riskGeo = 0.0;
  if (isVehicleStationaryAtT45) {
    riskGeo = 1.0;
  } else if (distanceToStationKm > 15 && speedKmh < 10) {
    riskGeo = 0.8;
  } else if (distanceToStationKm > 5 && speedKmh < 5) {
    riskGeo = 0.5;
  }

  const riskProbability = Number((w1 * riskReputation + w2 * riskHeartbeat + w3 * riskGeo).toFixed(3));
  const isHighRisk = riskProbability >= 0.65;

  let riskLevel = 'LOW';
  if (riskProbability >= 0.85) riskLevel = 'CRITICAL';
  else if (riskProbability >= 0.65) riskLevel = 'HIGH';
  else if (riskProbability >= 0.40) riskLevel = 'MEDIUM';

  return {
    riskProbability,
    isHighRisk,
    riskLevel,
    weights: { w1, w2, w3 },
    components: {
      riskReputation: Number(riskReputation.toFixed(3)),
      riskHeartbeat: Number(riskHeartbeat.toFixed(3)),
      riskGeo: Number(riskGeo.toFixed(3))
    },
    suggestedAction: isHighRisk ? 'DISPATCH_SHADOW_OR_FALLBACK' : 'MONITOR'
  };
}

export const RADAR_CHECKPOINTS = Object.freeze({
  T_MINUS_8H: 'T_MINUS_8H',     // 21:15 tối hôm trước
  T_MINUS_6H: 'T_MINUS_6H',     // 23:15 đêm hôm trước
  T_MINUS_1_5H: 'T_MINUS_1_5H', // 03:45 rạng sáng (Wake-up signal)
  T_MINUS_45M: 'T_MINUS_45M'    // 04:30 sáng (Hard stop cutoff)
});

/**
 * Đánh giá trạng thái tại 4 chốt quét Radar
 */
export function evaluateRadarSweepCheckpoint({
  checkpoint,
  driverConfirmed = false,
  lastHeartbeatMinutesAgo = 0,
  isStationary = false,
  distanceToStationKm = 0,
  trustScore = 100,
  candidateShadowTrips = []
}) {
  const risk = calculateEarlyFailureRisk({
    trustScore,
    lastHeartbeatMinutesAgo,
    isVehicleStationaryAtT45: checkpoint === RADAR_CHECKPOINTS.T_MINUS_45M && isStationary,
    distanceToStationKm
  });

  switch (checkpoint) {
    case RADAR_CHECKPOINTS.T_MINUS_8H:
      return {
        checkpoint,
        status: driverConfirmed ? 'HEALTHY' : 'PENDING_REMINDER',
        requiresPing: !driverConfirmed,
        action: driverConfirmed ? 'NONE' : 'SEND_PUSH_REMINDER',
        message: driverConfirmed
          ? 'Chủ xe đã chốt lịch ngày mai lúc 21:15.'
          : 'Gửi thông báo đẩy nhẹ nhàng nhắc nhở Chủ xe chốt lịch trước 22:00.'
      };

    case RADAR_CHECKPOINTS.T_MINUS_6H:
      if (!driverConfirmed || lastHeartbeatMinutesAgo > 180) {
        const availableShadow = candidateShadowTrips.find(t => (t.availableSeats || t.seats) > 0);
        return {
          checkpoint,
          status: 'SUSPICIOUS_DRIFT',
          requiresShadowSwap: !!availableShadow,
          shadowTrip: availableShadow || null,
          action: availableShadow ? 'SWAP_SHADOW_FLEET' : 'ALERT_PASSENGER_OPTION',
          message: availableShadow
            ? 'Tự động hoán đổi sang Shadow Fleet để bảo vệ lịch trình Người đi cùng.'
            : 'Chưa có Shadow Fleet, tiếp tục theo dõi sát ở chốt 03:45 rạng sáng.'
        };
      }
      return {
        checkpoint,
        status: 'HEALTHY',
        action: 'NONE',
        message: 'Chuyến xe ổn định lúc 23:15 đêm.'
      };

    case RADAR_CHECKPOINTS.T_MINUS_1_5H:
      return {
        checkpoint,
        status: lastHeartbeatMinutesAgo < 30 ? 'WAKEUP_VERIFIED' : 'WAKEUP_WARNING',
        action: lastHeartbeatMinutesAgo < 30 ? 'NONE' : 'TRIGGER_WAKEUP_PULSE',
        risk,
        message: lastHeartbeatMinutesAgo < 30
          ? 'Chủ xe đã thức giấc và thiết bị đang kết nối lúc 03:45.'
          : 'Cảnh báo: Không phát hiện tín hiệu thức giấc từ Chủ xe lúc 03:45.'
      };

    case RADAR_CHECKPOINTS.T_MINUS_45M:
    default:
      if (risk.isHighRisk) {
        return {
          checkpoint,
          status: 'EARLY_FAIL_ABORT',
          action: 'UNFREEZE_PASSENGER_FALLBACK',
          risk,
          fare: 0,
          transitFallbacks: FIXED_CORRIDOR_COACH_SCHEDULES,
          message: 'Chốt an toàn 04:30: Chủ xe không xuất phát đúng hẹn. Tự động giải phóng vé khách (0đ phạt), bật phương án xe khách QL13 cứu sinh.'
        };
      }
      return {
        checkpoint,
        status: 'CLEARED_FOR_PICKUP',
        action: 'READY_AT_STATION',
        risk,
        message: 'Chủ xe đang di chuyển tiếp cận trạm đón đúng tiến độ.'
      };
  }
}
