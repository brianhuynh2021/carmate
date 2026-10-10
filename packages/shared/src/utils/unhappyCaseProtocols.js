/**
 * Unhappy Case Protocols & Mechanism Design Invariants for CarMate
 * 
 * Defines standard incident codes, sanction matrices, immutable policies,
 * and emergency lifebuoys for real-world corridor operations along QL13.
 * 
 * Strict Terminology: "Chủ xe" (driver) and "Người đi cùng" / "Khách đi cùng" (fellow passenger).
 * MIT Invariants: System states never reach contradictory or illegal states.
 */

export const UNHAPPY_CASE_CODES = Object.freeze({
  RIDER_NO_SHOW: 'RIDER_NO_SHOW',                   // Case 1: Passenger absent after 5 minutes
  GHOST_PASSENGER: 'GHOST_PASSENGER',               // Case 2: Passenger squeezes in extra people not on the ticket
  LUGGAGE_VIOLATION: 'LUGGAGE_VIOLATION',           // Case 3: Oversized / smelly luggage
  MOTION_SICKNESS_SOILING: 'MOTION_SICKNESS_SOILING', // Case 4: Motion sickness, vomiting onto the interior
  OFF_CORRIDOR_DETOUR: 'OFF_CORRIDOR_DETOUR',       // Case 5: Demands a side trip / into an alley
  EN_ROUTE_BREAKDOWN: 'EN_ROUTE_BREAKDOWN',         // Case 6: Vehicle has a technical failure mid-route
  UNPAID_FARE_FRAUD: 'UNPAID_FARE_FRAUD',           // Case 7: Skips paying the shared fuel contribution
  DRIVER_LATE_CANCELLATION: 'DRIVER_LATE_CANCELLATION', // Case 8: Driver more than 5 minutes late at the station
  CULTURE_VIOLATION_SMOKING: 'CULTURE_VIOLATION_SMOKING', // Case 9: Violates the no-smoking commitment
  CULTURE_VIOLATION_PICKUP_SOLICITING: 'CULTURE_VIOLATION_PICKUP_SOLICITING', // Case 10: Flags down passengers along the road, unlicensed-coach ("dù") style
  CULTURE_VIOLATION_PRICE_GOUGING: 'CULTURE_VIOLATION_PRICE_GOUGING', // Case 11: Demands extra money beyond the agreement
  EARLY_PREDICTION_RISK_FAIL: 'EARLY_PREDICTION_RISK_FAIL' // Case 12: Early prediction of trip no-show risk
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

/**
 * TRANSIT LIFEBUOYS ALONG THE QL13 AXIS
 *
 * Do NOT list any phone number that has not been verified. A passenger dials this number at the very moment
 * they panic the most — a wrong number, a number that changed owners or a number that does not exist is far worse than
 * giving no number at all: it burns all trust at exactly the decisive moment.
 *
 * Until the operations team has called to verify each number and filled it into `hotline`, the
 * system only gives REAL ACTIONABLE instructions that the passenger can follow on the spot:
 * where exactly to stand on QL13, which vehicle to flag down, how to recognize it.
 */
export const EMERGENCY_TRANSIT_LIFEBUOYS = Object.freeze([
  {
    id: 'bus-15',
    name: 'Tuyến Buýt 15 (Chợ Tân Khai ➔ Bến xe Bình Long)',
    frequency: '15 phút/chuyến',
    hotline: null,
    guidance: 'Ra mặt tiền QL13 trước chợ Tân Khai, vẫy trực tiếp khi xe buýt trờ tới.'
  },
  {
    id: 'bus-ql13',
    name: 'Tuyến Buýt QL13 (Bến Cát ➔ Bến xe Miền Đông mới)',
    frequency: '20 phút/chuyến',
    hotline: null,
    guidance: 'Đứng tại trạm buýt gần nhất trên QL13 hướng về Sài Gòn.'
  },
  {
    id: 'coach-intercity',
    name: 'Xe khách liên tỉnh chạy dọc QL13',
    frequency: 'Chạy liên tục trong ngày',
    hotline: null,
    guidance: 'Đứng trong sân cây xăng mặt tiền QL13 (có mái che, đủ sáng) và vẫy xe khách hướng Sài Gòn.'
  },
  {
    id: 'emergency-113',
    name: 'Cảnh sát 113 / Cứu thương 115',
    frequency: 'Trực 24/7',
    hotline: '113',
    guidance: 'Chỉ dùng khi có tình huống mất an toàn cá nhân. Đây là số công khai toàn quốc.'
  }
]);

/**
 * Evaluate the sanction and corresponding action for an incident code
 * @param {string} incidentType - Incident code from UNHAPPY_CASE_CODES
 * @param {object} context - Context data
 * @returns {object} Sanction handling result
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
 * FIXED-ROUTE COACH SCHEDULE ALONG THE QL13 CORRIDOR
 *
 * INVARIANT: `hotline` may only be filled in once the operations team has CALLED TO VERIFY that number.
 * Previously this list contained unverified switchboard numbers; a passenger dialing at exactly the
 * moment of panic and reaching a wrong number loses trust permanently — far worse
 * than honestly saying "no number yet".
 *
 * The same goes for fares: `ticketPrice = null` means unverified, and the UI must
 * display "hỏi giá tại xe" ("ask for the price on the vehicle") rather than make up a specific figure.
 *
 * The real value of this list lies in `guidance`: instructions on WHERE the passenger should stand and
 * WHAT to do to catch the vehicle — something the passenger can do on their own right away, without calling anyone.
 */
export const FIXED_CORRIDOR_COACH_SCHEDULES = Object.freeze([
  {
    id: 'coach-tan-khai',
    operator: 'Xe khách liên tỉnh QL13 (đón tại Tân Khai)',
    departureStation: 'Cây xăng Petrolimex Tân Khai (mặt tiền QL13)',
    destinationStation: 'Bến xe Miền Đông / trung tâm TP.HCM',
    pickupTime: '04:45',
    estimatedArrival: '07:30',
    ticketPrice: null,
    hotline: null,
    frequency: 'Nhiều chuyến trong buổi sáng',
    guidance:
      'Đứng trong sân cây xăng Petrolimex Tân Khai, sát mặt tiền QL13 hướng Sài Gòn, vẫy xe khách khi xe trờ tới. Khu vực có mái che và đèn sáng ban đêm.',
    verified: false
  },
  {
    id: 'coach-chon-thanh',
    operator: 'Xe khách liên tỉnh QL13 (đón tại Chơn Thành)',
    departureStation: 'Ngã tư Chơn Thành (mặt tiền QL13)',
    destinationStation: 'Bến xe Miền Đông (cũ & mới)',
    pickupTime: '05:00',
    estimatedArrival: '07:15',
    ticketPrice: null,
    hotline: null,
    frequency: 'Nhiều chuyến trong buổi sáng',
    guidance:
      'Ra ngã tư Chơn Thành, đứng phía làn đường hướng về Sài Gòn. Đây là nút giao đông xe khách nhất trên trục QL13.',
    verified: false
  },
  {
    id: 'bus-15-morning',
    operator: 'Tuyến Xe Buýt 15 (Bình Long ➔ Thủ Dầu Một)',
    departureStation: 'Mặt tiền chợ Tân Khai / cây xăng QL13',
    destinationStation: 'Bến xe Khách Tỉnh Bình Dương (Thủ Dầu Một)',
    pickupTime: '05:15',
    estimatedArrival: '07:00',
    ticketPrice: null,
    hotline: null,
    frequency: 'Khoảng 15 phút/chuyến',
    guidance:
      'Phương án công cộng giá rẻ. Đứng tại trạm buýt trước chợ Tân Khai; tới Thủ Dầu Một có thể nối tiếp buýt vào trung tâm TP.HCM.',
    verified: false
  },
  {
    id: 'coach-bau-bang',
    operator: 'Xe khách liên tỉnh QL13 (đón tại Bàu Bàng)',
    departureStation: 'Khu vực KCN Bàu Bàng (mặt tiền QL13)',
    destinationStation: 'Sân bay Tân Sơn Nhất / trung tâm TP.HCM',
    pickupTime: '05:30',
    estimatedArrival: '07:15',
    ticketPrice: null,
    hotline: null,
    frequency: 'Nhiều chuyến trong ngày',
    guidance:
      'Đứng mặt tiền QL13 khu vực KCN Bàu Bàng hướng Sài Gòn. Đông công nhân chờ xe vào sáng sớm nên rất dễ bắt.',
    verified: false
  }
]);

/**
 * Only options that have been verified may display a phone number.
 * Use this function everywhere a list is rendered; do not read `hotline` directly.
 */
export function hasVerifiedHotline(option) {
  return Boolean(option?.verified && option?.hotline);
}

/**
 * Compute the early probability of the Driver no-showing / being late:
 * P_fail = w1 * (1 - R_driver) + w2 * S_heartbeat + w3 * D_geo
 * 
 * @param {object} params
 * @param {number} params.trustScore - Trust score [0..100] (default 100)
 * @param {number} params.lastHeartbeatMinutesAgo - Minutes since the driver's app last sent a ping (default 0)
 * @param {boolean} params.isVehicleStationaryAtT45 - Vehicle is still stationary at home at T - 45 minutes
 * @param {number} params.speedKmh - The vehicle's current speed (km/h)
 * @param {number} params.distanceToStationKm - Distance to the pickup station (km)
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

  // 1. Reputation risk index R_driver (the lower the score, the higher the risk)
  const normalizedTrust = Math.max(0, Math.min(100, Number(trustScore) || 100)) / 100;
  const riskReputation = 1 - normalizedTrust;

  // 2. Loss-of-contact risk index S_heartbeat (the longer offline, the higher the risk)
  // No ping for > 60 minutes: risk = 1.0; 30 minutes: 0.5
  const riskHeartbeat = Math.min(1.0, Math.max(0, Number(lastHeartbeatMinutesAgo) / 60));

  // 3. Geographic risk index D_geo (stationary far from the station at the T - 45m mark)
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
  T_MINUS_8H: 'T_MINUS_8H',     // 21:15 the evening before
  T_MINUS_6H: 'T_MINUS_6H',     // 23:15 the night before
  T_MINUS_1_5H: 'T_MINUS_1_5H', // 03:45 early morning (Wake-up signal)
  T_MINUS_45M: 'T_MINUS_45M'    // 04:30 morning (Hard stop cutoff)
});

/**
 * Evaluate the status at the 4 Radar sweep checkpoints
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
