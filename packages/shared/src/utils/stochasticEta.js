/**
 * =============================================================================
 * CARMATE STOCHASTIC ETA — PHÂN PHỐI THỜI GIAN ĐẾN TRẠM
 * =============================================================================
 * Thay thế phép chia `quãng đường / vận tốc tức thời` bằng một PHÂN PHỐI
 * xác suất. Lý do: vận tốc tức thời là biến nhiễu rất mạnh — xe dừng đèn đỏ
 * (v=0) làm ETA nhảy lên vô cực, xe đang đổ đèo (v=95) làm ETA lạc quan giả.
 * Cam kết giờ giấc với khách đi liên tỉnh không thể dựng trên một con số như vậy.
 *
 * Mô hình: T_arrive ~ N(mu, sigma^2) trên trục cọc số s của hành lang.
 *
 *   mu    = t_now + SUM( d_k / v_k )   với mỗi phân đoạn k mà xe còn phải đi qua
 *   sigma = sqrt( SUM( (d_k * sigma_v_k / v_k^2)^2 ) ) + sàn bất định
 *
 * v_k là vận tốc HÀNH TRÌNH lịch sử của phân đoạn k (không phải vận tốc tức
 * thời), lấy từ SEGMENT_SPEED_PROFILE. Càng gần trạm, số phân đoạn còn lại
 * càng ít nên sigma -> 0, đúng trực giác: ETA 3 km chính xác hơn ETA 80 km.
 *
 * Tham chiếu khoa học:
 * - Stochastic Vehicle Routing with Recourse (Gendreau, Laporte & Séguin, 1996)
 * - Travel Time Reliability, Highway Capacity Manual (TRB), hệ số biến thiên CV
 * =============================================================================
 */


/**
 * Hồ sơ vận tốc hành trình theo từng phân đoạn hành lang QL13.
 *
 * `vKmh` là vận tốc trung bình THỰC TẾ đã trừ đèn đỏ và giảm tốc qua khu dân cư
 * (không phải tốc độ tối đa cho phép). `cv` là hệ số biến thiên (Coefficient of
 * Variation = sigma_v / v): đoạn cao tốc thoáng cv thấp, đoạn nội đô cv cao vì
 * phương sai kẹt xe lớn.
 *
 * Dải s tính theo cọc số km của QL13_CORRIDOR_POLYLINE (0 = Lộc Ninh, 142.5 = TSN).
 */
const SEGMENT_SPEED_PROFILE = Object.freeze([
  // Lộc Ninh -> Bình Long: tỉnh lộ thoáng, ít giao cắt
  { fromS: 0, toS: 24.5, vKmh: 58, cv: 0.14, name: 'Lộc Ninh - Bình Long' },
  // Bình Long -> Tân Khai: qua thị xã, nhiều đèn và chợ
  { fromS: 24.5, toS: 44.5, vKmh: 48, cv: 0.20, name: 'Bình Long - Tân Khai' },
  // Tân Khai -> Chơn Thành: quốc lộ thoáng xen khu công nghiệp
  { fromS: 44.5, toS: 56.5, vKmh: 55, cv: 0.18, name: 'Tân Khai - Chơn Thành' },
  // Chơn Thành -> Bàu Bàng: đoạn chạy tốt nhất toàn tuyến
  { fromS: 56.5, toS: 84.5, vKmh: 62, cv: 0.15, name: 'Chơn Thành - Bàu Bàng' },
  // Bàu Bàng -> Sở Sao: mật độ xe container tăng dần
  { fromS: 84.5, toS: 107.0, vKmh: 52, cv: 0.22, name: 'Bàu Bàng - Sở Sao' },
  // Sở Sao -> VSIP/Lái Thiêu: vào vùng đô thị Bình Dương, kẹt giờ cao điểm
  { fromS: 107.0, toS: 126.0, vKmh: 38, cv: 0.30, name: 'Sở Sao - Lái Thiêu' },
  // Lái Thiêu -> Ngã 4 Bình Phước: nút thắt cổ chai nổi tiếng của QL13
  { fromS: 126.0, toS: 132.5, vKmh: 28, cv: 0.38, name: 'Lái Thiêu - Ngã 4 Bình Phước' },
  // Ngã 4 Bình Phước -> Hàng Xanh: nội đô TP.HCM, phương sai lớn nhất tuyến
  { fromS: 132.5, toS: 139.5, vKmh: 24, cv: 0.42, name: 'Ngã 4 Bình Phước - Hàng Xanh' },
  // Hàng Xanh -> Tân Sơn Nhất: xuyên tâm thành phố qua Phạm Văn Đồng
  { fromS: 139.5, toS: 142.5, vKmh: 26, cv: 0.40, name: 'Hàng Xanh - Tân Sơn Nhất' }
]);

/** Hệ số nhân vận tốc theo khung giờ (giờ cao điểm chạy chậm hơn hồ sơ nền). */
const PEAK_HOUR_FACTORS = Object.freeze([
  { fromHour: 6, toHour: 9, factor: 0.78, cvBoost: 0.10, label: 'Cao điểm sáng' },
  { fromHour: 11, toHour: 13, factor: 0.92, cvBoost: 0.03, label: 'Trưa' },
  { fromHour: 16, toHour: 19, factor: 0.72, cvBoost: 0.12, label: 'Cao điểm chiều' },
  { fromHour: 22, toHour: 24, factor: 1.12, cvBoost: -0.03, label: 'Đêm thoáng' },
  { fromHour: 0, toHour: 5, factor: 1.15, cvBoost: -0.04, label: 'Rạng sáng thoáng' }
]);

/** Sàn bất định: dù xe sát trạm vẫn còn ±40s cho việc tấp lề, tìm chỗ đỗ. */
const SIGMA_FLOOR_SECONDS = 40;

/** Trần vận tốc hiệu chỉnh, chặn trường hợp GPS nhiễu báo 200km/h. */
const MAX_EFFECTIVE_KMH = 90;
const MIN_EFFECTIVE_KMH = 8;

/**
 * Tra hệ số giờ cao điểm cho một mốc thời gian.
 * @param {Date|number} at - Thời điểm cần tra
 * @returns {{factor: number, cvBoost: number, label: string}}
 */
export function getPeakFactor(at = Date.now()) {
  const date = at instanceof Date ? at : new Date(at);
  const hour = date.getHours();
  const hit = PEAK_HOUR_FACTORS.find((p) => hour >= p.fromHour && hour < p.toHour);
  return hit
    ? { factor: hit.factor, cvBoost: hit.cvBoost, label: hit.label }
    : { factor: 1.0, cvBoost: 0, label: 'Bình thường' };
}

/**
 * Cắt dải [fromS, toS] thành các phân đoạn con theo SEGMENT_SPEED_PROFILE.
 * Trả về mảng { lengthKm, vKmh, cv } đã áp hệ số giờ cao điểm.
 */
function sliceSegments(fromS, toS, at) {
  const peak = getPeakFactor(at);
  const out = [];

  for (const seg of SEGMENT_SPEED_PROFILE) {
    const overlapFrom = Math.max(fromS, seg.fromS);
    const overlapTo = Math.min(toS, seg.toS);
    const lengthKm = overlapTo - overlapFrom;
    if (lengthKm <= 0) continue;

    const vKmh = Math.max(MIN_EFFECTIVE_KMH, Math.min(MAX_EFFECTIVE_KMH, seg.vKmh * peak.factor));
    const cv = Math.max(0.05, seg.cv + peak.cvBoost);
    out.push({ lengthKm, vKmh, cv, name: seg.name });
  }

  return out;
}

/**
 * TÍNH PHÂN PHỐI THỜI GIAN ĐẾN TRẠM: T_arrive ~ N(mu, sigma^2)
 *
 * Vận tốc tức thời `currentSpeedKmh` KHÔNG dùng để chia quãng đường. Nó chỉ
 * dùng để hiệu chỉnh nhẹ hồ sơ nền (blend 30%) — nếu xe đang chạy chậm hơn hẳn
 * hồ sơ thì có lý do (mưa, tải nặng) và nên tin một phần, nhưng không để một
 * lần dừng đèn đỏ kéo sập toàn bộ dự báo.
 *
 * @param {object} params
 * @param {number} params.currentS - Cọc số km hiện tại của xe
 * @param {number} params.targetS - Cọc số km của trạm đón
 * @param {number} [params.currentSpeedKmh] - Vận tốc tức thời (chỉ để hiệu chỉnh)
 * @param {number} [params.nowMs] - Mốc thời gian hiện tại
 * @param {number} [params.dwellStopsAhead] - Số trạm phải dừng đón trước khi tới đích
 * @returns {object} { muSeconds, sigmaSeconds, etaMs, distanceKm, segments, isBehind }
 */
export function computeEtaDistribution({
  currentS,
  targetS,
  currentSpeedKmh = null,
  nowMs = Date.now(),
  dwellStopsAhead = 0
}) {
  const sNow = Number(currentS);
  const sTarget = Number(targetS);

  if (!Number.isFinite(sNow) || !Number.isFinite(sTarget)) {
    return {
      muSeconds: null,
      sigmaSeconds: null,
      etaMs: null,
      distanceKm: null,
      segments: [],
      isBehind: false,
      valid: false
    };
  }

  // Xe đã vượt qua trạm: không còn ETA hợp lệ cho chiều đang chạy
  const isBehind = sTarget < sNow;
  const fromS = Math.min(sNow, sTarget);
  const toS = Math.max(sNow, sTarget);
  const distanceKm = Math.round((toS - fromS) * 10) / 10;

  const segments = sliceSegments(fromS, toS, nowMs);

  // Hiệu chỉnh bằng vận tốc tức thời: blend 30% để bám thực địa mà không nhiễu.
  // Chỉ áp dụng khi xe thực sự đang lăn bánh (>15km/h) — xe đứng yên không
  // mang thông tin gì về vận tốc hành trình sắp tới.
  let speedBlend = 1.0;
  const inst = Number(currentSpeedKmh);
  if (Number.isFinite(inst) && inst > 15 && segments.length > 0) {
    const profileV = segments[0].vKmh;
    const ratio = Math.max(0.5, Math.min(1.6, inst / profileV));
    speedBlend = 1 + 0.3 * (ratio - 1);
  }

  let muSeconds = 0;
  let varianceSeconds = 0;

  for (const seg of segments) {
    const v = Math.max(MIN_EFFECTIVE_KMH, seg.vKmh * speedBlend);
    const tSeg = (seg.lengthKm / v) * 3600; // giây
    muSeconds += tSeg;

    // Lan truyền sai số: t = d/v  =>  sigma_t = t * (sigma_v / v) = t * cv
    const sigmaSeg = tSeg * seg.cv;
    varianceSeconds += sigmaSeg * sigmaSeg;
  }

  // Mỗi trạm dừng đón trên đường cộng thêm 60s dwell + phương sai của chính nó
  const dwellSeconds = Math.max(0, Number(dwellStopsAhead) || 0) * 60;
  muSeconds += dwellSeconds;
  varianceSeconds += Math.pow(dwellSeconds * 0.25, 2);

  const sigmaSeconds = Math.sqrt(varianceSeconds) + SIGMA_FLOOR_SECONDS;

  return {
    muSeconds: Math.round(muSeconds),
    sigmaSeconds: Math.round(sigmaSeconds),
    etaMs: nowMs + Math.round(muSeconds * 1000),
    distanceKm,
    segments: segments.map((s) => ({ name: s.name, lengthKm: Math.round(s.lengthKm * 10) / 10, vKmh: Math.round(s.vKmh) })),
    isBehind,
    valid: true,
    peakLabel: getPeakFactor(nowMs).label
  };
}

/**
 * Hàm phân phối tích lũy chuẩn Phi(z) — xấp xỉ Abramowitz & Stegun 26.2.17.
 * Sai số tuyệt đối < 7.5e-8, thừa đủ cho bài toán điều vận.
 */
export function normalCdf(z) {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1 + sign * y);
}

/**
 * XÁC SUẤT XE ĐẾN TRẠM TRONG CỬA SỔ [lowSeconds, highSeconds] KỂ TỪ BÂY GIỜ.
 *
 *   P(low <= T_arrive - t_now <= high) = Phi((high - mu)/sigma) - Phi((low - mu)/sigma)
 *
 * Đây là biểu thức dùng để quyết định có bắn thông báo T-30 hay không.
 *
 * @param {object} distribution - Kết quả computeEtaDistribution()
 * @param {number} lowSeconds - Cận dưới cửa sổ (giây)
 * @param {number} highSeconds - Cận trên cửa sổ (giây)
 * @returns {number} Xác suất trong [0, 1]
 */
export function probabilityArrivalWithin(distribution, lowSeconds, highSeconds) {
  if (!distribution?.valid || distribution.sigmaSeconds == null) return 0;
  const { muSeconds, sigmaSeconds } = distribution;
  if (sigmaSeconds <= 0) return muSeconds >= lowSeconds && muSeconds <= highSeconds ? 1 : 0;

  const zHigh = (highSeconds - muSeconds) / sigmaSeconds;
  const zLow = (lowSeconds - muSeconds) / sigmaSeconds;
  return Math.max(0, Math.min(1, normalCdf(zHigh) - normalCdf(zLow)));
}

/**
 * PHÂN VỊ THỜI GIAN ĐẾN (Quantile) — dùng để hứa giờ AN TOÀN với khách.
 *
 * Hứa theo mu là hứa trượt 50% số lần. Hứa theo p80 nghĩa là 80% số chuyến sẽ
 * đến sớm hơn hoặc đúng mốc đã hứa — đây mới là con số nên hiển thị ra giao diện.
 *
 * Dùng xấp xỉ nghịch đảo Phi của Beasley-Springer-Moro rút gọn.
 *
 * @param {object} distribution - Kết quả computeEtaDistribution()
 * @param {number} p - Phân vị mong muốn (0..1), ví dụ 0.8
 * @returns {number|null} Số giây kể từ bây giờ
 */
export function etaQuantileSeconds(distribution, p = 0.8) {
  if (!distribution?.valid) return null;
  const z = inverseNormalCdf(Math.max(0.001, Math.min(0.999, p)));
  return Math.round(distribution.muSeconds + z * distribution.sigmaSeconds);
}

/** Nghịch đảo Phi — xấp xỉ hữu tỉ Acklam, sai số < 1.15e-9. */
export function inverseNormalCdf(p) {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
         (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * XÁC SUẤT TRỄ HẸN SO VỚI MỐC ĐÃ CAM KẾT VỚI KHÁCH.
 *
 *   P(T_arrive > t_committed + tolerance)
 *
 * Đây là đầu vào quyết định có kích hoạt chuyến Shadow hay không: không chờ
 * đến khi xe THỰC SỰ trễ mới xoay xở, mà hoán đổi ngay khi xác suất trễ vượt ngưỡng.
 *
 * @param {object} distribution - Kết quả computeEtaDistribution()
 * @param {number} committedAtMs - Mốc giờ đã hứa với khách (epoch ms)
 * @param {number} [toleranceSeconds] - Dung sai chấp nhận được (mặc định 300s)
 * @param {number} [nowMs] - Mốc hiện tại
 * @returns {{probability: number, expectedDelaySeconds: number, willBeLate: boolean}}
 */
export function probabilityOfLateness(distribution, committedAtMs, toleranceSeconds = 300, nowMs = Date.now()) {
  if (!distribution?.valid || !Number.isFinite(committedAtMs)) {
    return { probability: 0, expectedDelaySeconds: 0, willBeLate: false };
  }

  const budgetSeconds = (committedAtMs - nowMs) / 1000 + toleranceSeconds;
  const z = (budgetSeconds - distribution.muSeconds) / distribution.sigmaSeconds;
  const probability = Math.max(0, Math.min(1, 1 - normalCdf(z)));
  const expectedDelaySeconds = Math.round(distribution.muSeconds - (committedAtMs - nowMs) / 1000);

  return {
    probability: Number(probability.toFixed(3)),
    expectedDelaySeconds,
    willBeLate: expectedDelaySeconds > toleranceSeconds
  };
}
