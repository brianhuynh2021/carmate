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
