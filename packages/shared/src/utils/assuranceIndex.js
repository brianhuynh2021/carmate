/**
 * =============================================================================
 * CHỈ SỐ AN TÂM (ASSURANCE INDEX)
 * =============================================================================
 * Khách đi liên tỉnh không cần hiểu phân phối xác suất. Họ cần đúng một câu trả
 * lời: "Tôi có chắc chắn đi được không?".
 *
 * File này dịch các con số toán học đã có (xác suất ETA, số xe dự phòng trên
 * hành lang, lịch sử chủ xe) thành BA MỨC nhìn phát hiểu ngay:
 *
 *   🟢 GUARANTEED  >= 95%  "Chuyến đảm bảo"    — có xe chính VÀ xe dự phòng
 *   🟡 COMMUNITY   >= 70%  "Chuyến cộng đồng"  — một xe tiện chuyến, chủ xe uy tín
 *   ⚪ FORMING     còn lại "Đang gom khách"    — chưa đủ chắc, nói thẳng là chưa chắc
 *
 * NGUYÊN TẮC: thà hạ mức còn hơn hứa quá. Gắn nhãn "đảm bảo" cho một chuyến rồi
 * để khách đứng đường là phá huỷ niềm tin theo cách không sửa được; gắn nhãn
 * "cộng đồng" cho một chuyến rồi nó chạy đúng giờ thì khách chỉ thấy vui hơn.
 * =============================================================================
 */

export const ASSURANCE_LEVELS = Object.freeze({
  GUARANTEED: 'GUARANTEED',
  COMMUNITY: 'COMMUNITY',
  FORMING: 'FORMING'
});

export const ASSURANCE_THRESHOLDS = Object.freeze({
  GUARANTEED_MIN: 0.95,
  COMMUNITY_MIN: 0.7,
  // Chủ xe phải đạt tối thiểu mức uy tín này mới được xét "Chuyến đảm bảo"
  GUARANTEED_MIN_TRUST: 85,
  // Và hành lang phải có ít nhất 1 xe khác đủ ghế làm phương án dự phòng
  GUARANTEED_MIN_BACKUPS: 1
});

/**
 * TÍNH CHỈ SỐ AN TÂM CHO MỘT KHE CHUYẾN.
 *
 * @param {object} params
 * @param {number} [params.baseCertainty] - Độ chắc chắn nền của tầng khe (0..1)
 * @param {number} [params.trustScore] - Điểm uy tín chủ xe (0..100)
 * @param {number} [params.completedTrips] - Số chuyến đã hoàn tất
 * @param {number} [params.lateReports] - Số lần bị báo trễ hẹn
 * @param {number} [params.backupCount] - Số xe dự phòng cùng hành lang
 * @returns {object} { level, label, score, reasons, canPromiseTime }
 */
export function computeAssurance({
  baseCertainty = 0.5,
  trustScore = 100,
  completedTrips = 0,
  lateReports = 0,
  backupCount = 0
} = {}) {
  const trust = Math.max(0, Math.min(100, Number(trustScore) || 0));
  const trips = Math.max(0, Number(completedTrips) || 0);
  const lates = Math.max(0, Number(lateReports) || 0);
  const backups = Math.max(0, Number(backupCount) || 0);

  // Tỷ lệ đúng giờ suy từ lịch sử thật. Chủ xe mới (0 chuyến) KHÔNG được mặc
  // định 100% — chưa có dữ liệu thì phải nói là chưa có, không được vay uy tín.
  const onTimeRate = trips > 0 ? Math.max(0, (trips - lates) / trips) : null;

  // Trọng số: uy tín 40%, lịch sử đúng giờ 35%, độ chắc chắn nền của tầng 25%.
  // Chủ xe chưa có lịch sử thì phần 35% đó tính ở mức trung tính 0.7, không
  // thưởng cũng không phạt — họ phải chạy thật để leo lên mức cao hơn.
  const trustPart = trust / 100;
  const historyPart = onTimeRate == null ? 0.7 : onTimeRate;
  const score = Number((0.4 * trustPart + 0.35 * historyPart + 0.25 * baseCertainty).toFixed(3));

  const reasons = [];
  let level;

  // Mức ĐẢM BẢO đòi hỏi đồng thời 3 điều kiện, không chỉ mỗi điểm số:
  // điểm cao, chủ xe uy tín, VÀ có xe dự phòng thật trên hành lang.
  const qualifiesGuaranteed =
    score >= ASSURANCE_THRESHOLDS.GUARANTEED_MIN &&
    trust >= ASSURANCE_THRESHOLDS.GUARANTEED_MIN_TRUST &&
    backups >= ASSURANCE_THRESHOLDS.GUARANTEED_MIN_BACKUPS;

  if (qualifiesGuaranteed) {
    level = ASSURANCE_LEVELS.GUARANTEED;
    reasons.push(`Có ${backups} xe cùng tuyến sẵn sàng hỗ trợ nếu xe chính gặp sự cố`);
  } else if (score >= ASSURANCE_THRESHOLDS.COMMUNITY_MIN) {
    level = ASSURANCE_LEVELS.COMMUNITY;
    if (backups === 0) reasons.push('Chưa có xe dự phòng cùng khung giờ trên tuyến');
  } else {
    level = ASSURANCE_LEVELS.FORMING;
    reasons.push('Hệ thống đang gom thêm khách và xe cho khung giờ này');
  }

  if (onTimeRate != null) {
    reasons.unshift(`Đã chạy ${trips} chuyến · đúng giờ ${Math.round(onTimeRate * 100)}%`);
  } else {
    reasons.unshift('Chủ xe chưa có lịch sử chuyến trên CarMate');
  }

  return {
    level,
    label: getAssuranceLabel(level),
    badge: getAssuranceBadge(level),
    score,
    onTimeRate,
    completedTrips: trips,
    backupCount: backups,
    reasons,
    // Chỉ mức ĐẢM BẢO mới được phép hứa một mốc giờ cụ thể với khách
    canPromiseTime: level === ASSURANCE_LEVELS.GUARANTEED
  };
}

export function getAssuranceLabel(level) {
  switch (level) {
    case ASSURANCE_LEVELS.GUARANTEED:
      return 'Chuyến đảm bảo';
    case ASSURANCE_LEVELS.COMMUNITY:
      return 'Chuyến cộng đồng';
    default:
      return 'Đang gom khách';
  }
}

export function getAssuranceBadge(level) {
  switch (level) {
    case ASSURANCE_LEVELS.GUARANTEED:
      return '🟢';
    case ASSURANCE_LEVELS.COMMUNITY:
      return '🟡';
    default:
      return '⚪';
  }
}

/**
 * Câu cam kết hiển thị cho khách, viết bằng lời người chứ không phải thuật ngữ.
 * Mức nào nói đúng mức đó — không mượn giọng chắc chắn cho một chuyến chưa chắc.
 */
export function getAssurancePromise(assurance, departureLabel = '') {
  if (!assurance) return '';
  const at = departureLabel ? `đúng ${departureLabel}` : 'đúng giờ hẹn';

  switch (assurance.level) {
    case ASSURANCE_LEVELS.GUARANTEED:
      return `Có xe đón ${at} tại trạm. Nếu xe chính gặp sự cố, hệ thống tự điều xe chạy sau tiếp quản.`;
    case ASSURANCE_LEVELS.COMMUNITY:
      return `Chủ xe nhận đón ${at}. Hệ thống theo dõi sát và báo bạn ngay nếu có thay đổi.`;
    default:
      return 'Chưa có xe chốt cho khung giờ này. Đăng ký để hệ thống gom và ghép xe cho bạn.';
  }
}
