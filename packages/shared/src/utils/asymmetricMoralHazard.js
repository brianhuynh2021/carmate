/**
 * asymmetricMoralHazard.js
 *
 * MÔ HÌNH TOÁN HỌC & THIẾT KẾ CƠ CHẾ (MECHANISM DESIGN & SYSTEM RELIABILITY)
 * Giải quyết triệt để "Nguy cơ đạo đức bất đối xứng" (Asymmetric Moral Hazard)
 * khi nền tảng không thu tiền cọc và không dùng tiền phạt tức thì.
 *
 * Áp dụng 3 công cụ toán học:
 * 1. Folk Theorem & Grim Trigger (Đòn bẩy thặng dư tương lai)
 * 2. k-out-of-n Reliability Model (Độ tin cậy dự phòng theo hàm mũ)
 * 3. Optimal Stopping Time T* (Thời điểm dừng tối ưu & Dead Man's Switch Heartbeat)
 */

/**
 * 1. FOLK THEOREM & GRIM TRIGGER (ĐÒN BẨY THẶNG DƯ TƯƠNG LAI)
 *
 * Định lý Dân gian (Folk Theorem) trong Trò chơi lặp lại vô hạn:
 * V_future = sum_{t=1}^infinity delta^t * R
 * Với delta ~= 0.98 (hệ số gắn bó), R là mức hỗ trợ chi phí mỗi ngày (~200.000đ).
 * Mỗi tháng dòng tiền thặng dư của chủ xe đạt 4.000.000 - 5.000.000 VNĐ.
 */
export function calculateFutureSurplus({
  dailyCostSharingReturn = 200000,
  workdaysPerMonth = 22,
  discountFactor = 0.98,
  monthsHorizon = 12
} = {}) {
  const monthlyReturn = dailyCostSharingReturn * workdaysPerMonth; // ~4.400.000đ/tháng
  let totalDiscountedSurplus = 0;
  for (let t = 1; t <= monthsHorizon; t++) {
    totalDiscountedSurplus += Math.pow(discountFactor, t) * monthlyReturn;
  }

  return {
    monthlySurplus: monthlyReturn,
    annualSurplus: Math.round(totalDiscountedSurplus),
    dailyCostSharingReturn,
    isSurplusSubstantial: monthlyReturn >= 3500000
  };
}

/**
 * Đánh giá kích hoạt Grim Trigger khi chủ xe vi phạm bùng chuyến
 * Tước quyền tiếp cận thặng dư trong 30 ngày (Grim Trigger Penalty)
 */
export function evaluateGrimTrigger({
  isUnexcusedCancel = false,
  cancelNoticeHoursBefore = 0,
  currentTrustScore = 98,
  monthlySurplus = 4400000
} = {}) {
  if (!isUnexcusedCancel) {
    return {
      triggered: false,
      status: 'GOOD_STANDING',
      penaltyDays: 0,
      trustScoreDeducted: 0,
      newTrustScore: currentTrustScore,
      lossOpportunityValue: 0
    };
  }

  // Nếu huỷ cận giờ (dưới 2 tiếng hoặc sát giờ) không có lý do chính đáng
  const isExtremeBreach = cancelNoticeHoursBefore < 2;
  const penaltyDays = isExtremeBreach ? 30 : 14;
  const trustDeducted = isExtremeBreach ? 35 : 20;
  const newTrust = Math.max(0, currentTrustScore - trustDeducted);

  // Thiệt hại cơ hội của chủ xe do bị tước quyền ghép cuốc
  const lossValue = Math.round((monthlySurplus / 30) * penaltyDays);

  return {
    triggered: true,
    status: 'GRIM_TRIGGER_ACTIVATED',
    penaltyDays,
    suspendedUntil: new Date(Date.now() + penaltyDays * 24 * 60 * 60 * 1000).toISOString(),
    trustScoreDeducted: trustDeducted,
    newTrustScore: newTrust,
    bannedFromPriorityMatching: true,
    lossOpportunityValue: lossValue,
    rationale: `Chủ xe vi phạm bùng chuyến sát giờ (${cancelNoticeHoursBefore}h trước giờ đi). Kích hoạt Grim Trigger: Tước quyền ưu tiên ghép cuốc trong ${penaltyDays} ngày. Thiệt hại cơ hội ước tính: ~${lossValue.toLocaleString('vi-VN')}đ, lớn hơn rất nhiều so với chi phí huỷ 0đ. Cân bằng Nash buộc chủ xe phải duy trì cam kết.`
  };
}

/**
 * 2. K-OUT-OF-N RELIABILITY MODEL (ĐỘ TIN CẬY DỰ PHÒNG THEO HÀM MŨ)
 *
 * Tính xác suất rủi ro toàn hệ thống đứt gãy khi gom thành Chùm xe song song:
 * P_system_fail = p^m
 * Với p là xác suất bùng đơn lẻ (vd: 10% = 0.1), m là số xe cùng chùm hành lang.
 */
export function calculateSystemFailureProbability(individualFailureRate = 0.1, fleetSize = 3) {
  const p = Math.max(0.01, Math.min(0.5, Number(individualFailureRate) || 0.1));
  const m = Math.max(1, Number(fleetSize) || 1);
  const rawPFail = Math.pow(p, m);
  const pFail = Math.round(rawPFail * 1000000) / 1000000;
  const reliability = 1 - pFail;

  return {
    individualFailureRate: p,
    fleetSize: m,
    systemFailureProbability: pFail,
    reliabilityPercentage: Math.round(reliability * 10000) / 100, // vd: 99.9%
    riskReductionFactor: Math.round(p / pFail) // vd: giảm 100 lần rủi ro
  };
}

/**
 * Gom nhóm Chùm xe song song (Parallel Fleet Packet) trên cùng hành lang
 * Khách được ghép vào một chùm xe có khoảng lệch giờ xuất phát trong ngưỡng delta T (vd: +/- 15 phút)
 */
export function formParallelFleetPacket({
  targetDepartureMinutes = 375, // 06:15 = 6*60 + 15 = 375
  corridor = 'Tuyến QL13',
  candidateCars = [],
  toleranceMinutes = 15,
  individualFailureRate = 0.1
} = {}) {
  // Lọc các xe trên cùng trục hành lang có giờ xuất phát trong khoảng [T - 15p, T + 15p]
  const packetCars = (candidateCars || []).filter((car) => {
    if (corridor && car.corridor && !car.corridor.includes('QL13') && car.corridor !== corridor) {
      return false;
    }
    const carMins = Number(car.departureMinutes ?? parseTimeToMinutes(car.timeSlot || '06:15'));
    return Math.abs(carMins - targetDepartureMinutes) <= toleranceMinutes && Number(car.seats || 0) > 0;
  });

  // Sắp xếp theo thứ tự độ tin cậy tín nhiệm và khoảng cách thời gian
  packetCars.sort((a, b) => {
    const trustDiff = Number(b.trustScore || 95) - Number(a.trustScore || 95);
    if (trustDiff !== 0) return trustDiff;
    const aMins = Math.abs(Number(a.departureMinutes ?? 375) - targetDepartureMinutes);
    const bMins = Math.abs(Number(b.departureMinutes ?? 375) - targetDepartureMinutes);
    return aMins - bMins;
  });

  const fleetSize = packetCars.length;
  const reliabilityStats = calculateSystemFailureProbability(individualFailureRate, Math.max(1, fleetSize));

  return {
    corridor,
    targetDepartureMinutes,
    toleranceMinutes,
    fleetSize,
    primaryCar: packetCars[0] || null,
    standbyCars: packetCars.slice(1),
    reliabilityStats,
    isResilient: fleetSize >= 2
  };
}

/**
 * 3. BÀI TOÁN DỪNG TỐI ƯU (OPTIMAL STOPPING TIME T*) & DEAD MAN'S SWITCH
 *
 * Mốc thời gian sinh tử T*:
 * T* = T_deadline - (T_transit + T_buffer)
 *
 * Nếu đến T - 45 phút mà thiết bị chủ xe không phát nhịp tim (Heartbeat),
 * hệ thống chủ động cưỡng chế chuyển làn trước T* để 100% không làm trễ hẹn của khách.
 */
export function calculateOptimalStoppingTime({
  deadlineHourMinute = '08:15',
  transitMinutes = 100, // Thời gian xe khách/xe buýt chạy từ Tân Khai về Hàng Xanh
  bufferMinutes = 15 // Thời gian đi bộ, đón xe tại cổng trạm
} = {}) {
  const deadlineMins = parseTimeToMinutes(deadlineHourMinute);
  const criticalThresholdMinutes = deadlineMins - (transitMinutes + bufferMinutes); // T* (vd: 08:15 - 115p = 06:20)
  const awakeCheckpointMinutes = criticalThresholdMinutes - 45; // T - 45p (vd: 05:35)

  return {
    deadlineHourMinute,
    deadlineMinutes: deadlineMins,
    transitMinutes,
    bufferMinutes,
    criticalThresholdMinutes, // T*
    criticalThresholdTime: formatMinutesToTime(criticalThresholdMinutes),
    awakeCheckpointMinutes, // Mốc gác cổng nhịp tim
    awakeCheckpointTime: formatMinutesToTime(awakeCheckpointMinutes)
  };
}

/**
 * Đánh giá trạng thái nhịp tim (Dead Man's Switch Heartbeat Monitor)
 */
export function evaluateHeartbeatEscort({
  scheduledDeparture = '06:15',
  deadline = '08:15',
  currentHourMinute = '05:35',
  lastDriverHeartbeatHourMinute = null,
  hasStandbyCar = true,
  standbyCarInfo = null
} = {}) {
  const stopping = calculateOptimalStoppingTime({
    deadlineHourMinute: deadline,
    transitMinutes: 100,
    bufferMinutes: 15
  });

  const currentMins = parseTimeToMinutes(currentHourMinute);
  const scheduledMins = parseTimeToMinutes(scheduledDeparture);
  const lastHbMins = lastDriverHeartbeatHourMinute ? parseTimeToMinutes(lastDriverHeartbeatHourMinute) : null;

  // Kiểm tra xe có phát nhịp tim sáng sớm không (trong vòng 60 phút qua)
  const isHeartbeatPresent = lastHbMins != null && currentMins - lastHbMins <= 60;

  // Nếu đã qua mốc Awake Checkpoint (T - 45p) mà vẫn bặt vô âm tín
  const isPastAwakeCheckpoint = currentMins >= stopping.awakeCheckpointMinutes;
  const isCritical = isPastAwakeCheckpoint && !isHeartbeatPresent;

  if (!isCritical) {
    return {
      action: 'HEARTBEAT_HEALTHY',
      isSafe: true,
      stoppingTime: stopping,
      message: 'Nhịp tim chủ xe bình thường. Lộ trình cam kết được duy trì.'
    };
  }

  // CƯỠNG CHẾ GIẢI CỨU TRƯỚC MỐC SINH TỬ T*
  if (hasStandbyCar && standbyCarInfo) {
    return {
      action: 'SILENT_FAILOVER_STANDBY_CAR',
      isSafe: true,
      stoppingTime: stopping,
      switchedToStandbyCar: true,
      standbyCar: standbyCarInfo,
      message: `Chủ xe chính không phản hồi lúc ${currentHourMinute}. Hệ thống tự động chuyển làn sang xe dự phòng N+1 (${standbyCarInfo.plate || 'Toyota Vios'}) xuất phát lúc ${standbyCarInfo.timeSlot || '06:25'} để đảm bảo đến đích trước ${deadline}.`
    };
  }

  // Nếu không còn xe cá nhân nào trong chùm -> Kích hoạt phao cứu sinh vật lý tại cổng trạm
  return {
    action: 'ACTIVATE_PHYSICAL_LIFEBUOY',
    isSafe: true,
    stoppingTime: stopping,
    physicalTransitOption: {
      station: 'Cổng cây xăng Petrolimex Tân Khai',
      busLine: 'Tuyến Buýt 15 (Bình Long ➔ Thủ Dầu Một / Miền Đông)',
      busInterval: '10–15 phút/chuyến (Vé 25.000đ)',
      coachExpress: 'Xe khách Thành Công / Chín Tèo / Quốc Đạt',
      recommendedBoardingTime: formatMinutesToTime(stopping.criticalThresholdMinutes - 15) // vd: 06:05
    },
    message: `Chủ xe chính không phát nhịp tim lúc ${currentHourMinute}. Hệ thống kích hoạt phương án đón xe khách/xe buýt tại cổng trạm lúc ${formatMinutesToTime(stopping.criticalThresholdMinutes - 15)} để chắc chắn kịp giờ làm ${deadline}.`
  };
}

/**
 * Tiện ích chuyển đổi giờ "HH:mm" sang số phút tính từ 00:00
 */
export function parseTimeToMinutes(timeStr = '06:15') {
  if (!timeStr || typeof timeStr !== 'string') return 375;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
  return (isNaN(h) ? 6 : h) * 60 + (isNaN(m) ? 15 : m);
}

/**
 * Tiện ích chuyển đổi số phút sang chuỗi "HH:mm"
 */
export function formatMinutesToTime(totalMinutes = 375) {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
