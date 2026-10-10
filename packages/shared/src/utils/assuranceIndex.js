/**
 * =============================================================================
 * PEACE-OF-MIND INDEX (ASSURANCE INDEX)
 * =============================================================================
 * Intercity passengers do not need to understand probability distributions. They need exactly one
 * answer: "Can I be sure I will make the trip?".
 *
 * This file translates the existing mathematical figures (ETA probability, number of backup vehicles
 * on the corridor, driver history) into THREE LEVELS that can be understood at a glance:
 *
 *   🟢 GUARANTEED  >= 95%  "Chuyến đảm bảo"    — has a primary vehicle AND a backup vehicle
 *   🟡 COMMUNITY   >= 70%  "Chuyến cộng đồng"  — one passing vehicle, reputable driver
 *   ⚪ FORMING     the rest "Đang gom khách"   — not certain enough, says plainly that it is not certain
 *
 * PRINCIPLE: better to downgrade than to over-promise. Labeling a trip "đảm bảo" (guaranteed) and then
 * leaving the passenger stranded at the roadside destroys trust in a way that cannot be repaired; labeling
 * a trip "cộng đồng" (community) and then having it run on time only makes the passenger happier.
 * =============================================================================
 */

export const ASSURANCE_LEVELS = Object.freeze({
  GUARANTEED: 'GUARANTEED',
  COMMUNITY: 'COMMUNITY',
  FORMING: 'FORMING'
});

const ASSURANCE_THRESHOLDS = Object.freeze({
  GUARANTEED_MIN: 0.95,
  COMMUNITY_MIN: 0.7,
  // The driver must reach at least this trust level to be considered for "Chuyến đảm bảo" (guaranteed trip)
  GUARANTEED_MIN_TRUST: 85,
  // And the corridor must have at least 1 other vehicle with enough seats as a backup option
  GUARANTEED_MIN_BACKUPS: 1
});

/**
 * COMPUTE THE ASSURANCE INDEX FOR A TRIP SLOT.
 *
 * @param {object} params
 * @param {number} [params.baseCertainty] - Base certainty of the slot tier (0..1)
 * @param {number} [params.trustScore] - Driver trust score (0..100)
 * @param {number} [params.completedTrips] - Number of completed trips
 * @param {number} [params.lateReports] - Number of times reported late for an appointment
 * @param {number} [params.backupCount] - Number of backup vehicles on the same corridor
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

  // On-time rate derived from real history. A new driver (0 trips) must NOT default to
  // 100% — with no data yet we must say there is no data, and must not borrow credibility.
  const onTimeRate = trips > 0 ? Math.max(0, (trips - lates) / trips) : null;

  // Weights: trust 40%, on-time history 35%, tier base certainty 25%.
  // For a driver with no history, that 35% share is taken at a neutral 0.7, neither
  // rewarded nor penalized — they have to actually run trips to climb to a higher level.
  const trustPart = trust / 100;
  const historyPart = onTimeRate == null ? 0.7 : onTimeRate;
  const score = Number((0.4 * trustPart + 0.35 * historyPart + 0.25 * baseCertainty).toFixed(3));

  const reasons = [];
  let level;

  // The GUARANTEED level requires three conditions at once, not just the score:
  // a high score, a reputable driver, AND a real backup vehicle on the corridor.
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
    // Only the GUARANTEED level may promise a specific time to the passenger
    canPromiseTime: level === ASSURANCE_LEVELS.GUARANTEED
  };
}

function getAssuranceLabel(level) {
  switch (level) {
    case ASSURANCE_LEVELS.GUARANTEED:
      return 'Chuyến đảm bảo';
    case ASSURANCE_LEVELS.COMMUNITY:
      return 'Chuyến cộng đồng';
    default:
      return 'Đang gom khách';
  }
}

function getAssuranceBadge(level) {
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
 * Promise sentence shown to the passenger, written in human language rather than jargon.
 * Each level says exactly what it is — it does not borrow a confident tone for an uncertain trip.
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
