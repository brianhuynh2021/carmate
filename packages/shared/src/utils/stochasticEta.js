/**
 * =============================================================================
 * CARMATE STOCHASTIC ETA — DISTRIBUTION OF TIME TO ARRIVE AT A STATION
 * =============================================================================
 * Replaces the division `distance / instantaneous speed` with a probability
 * DISTRIBUTION. Reason: instantaneous speed is an extremely noisy variable — a vehicle stopped at a red light
 * (v=0) makes the ETA jump to infinity, a vehicle descending a mountain pass (v=95) gives a falsely optimistic ETA.
 * A time commitment to intercity passengers cannot be built on a number like that.
 *
 * Model: T_arrive ~ N(mu, sigma^2) on the corridor's km-marker axis s.
 *
 *   mu    = t_now + SUM( d_k / v_k )   for each segment k the vehicle still has to pass through
 *   sigma = sqrt( SUM( (d_k * sigma_v_k / v_k^2)^2 ) ) + uncertainty floor
 *
 * v_k is the historical JOURNEY speed of segment k (not the instantaneous
 * speed), taken from SEGMENT_SPEED_PROFILE. The closer to the station, the fewer segments remain
 * so sigma -> 0, matching intuition: an ETA of 3 km is more accurate than an ETA of 80 km.
 *
 * Scientific references:
 * - Stochastic Vehicle Routing with Recourse (Gendreau, Laporte & Séguin, 1996)
 * - Travel Time Reliability, Highway Capacity Manual (TRB), coefficient of variation CV
 * =============================================================================
 */


/**
 * Journey speed profile for each QL13 corridor segment.
 *
 * `vKmh` is the ACTUAL average speed after subtracting red lights and slowing through residential areas
 * (not the maximum permitted speed). `cv` is the coefficient of variation (Coefficient of
 * Variation = sigma_v / v): open highway sections have a low cv, urban sections have a high cv because
 * the congestion variance is large.
 *
 * The s range is measured on the km markers of QL13_CORRIDOR_POLYLINE (0 = Lộc Ninh, 142.5 = TSN).
 */
const SEGMENT_SPEED_PROFILE = Object.freeze([
  // Lộc Ninh -> Bình Long: open provincial road, few intersections
  { fromS: 0, toS: 24.5, vKmh: 58, cv: 0.14, name: 'Lộc Ninh - Bình Long' },
  // Bình Long -> Tân Khai: passes through the town, many lights and markets
  { fromS: 24.5, toS: 44.5, vKmh: 48, cv: 0.20, name: 'Bình Long - Tân Khai' },
  // Tân Khai -> Chơn Thành: open national highway interspersed with industrial parks
  { fromS: 44.5, toS: 56.5, vKmh: 55, cv: 0.18, name: 'Tân Khai - Chơn Thành' },
  // Chơn Thành -> Bàu Bàng: the best-running stretch of the whole route
  { fromS: 56.5, toS: 84.5, vKmh: 62, cv: 0.15, name: 'Chơn Thành - Bàu Bàng' },
  // Bàu Bàng -> Sở Sao: container truck density gradually increases
  { fromS: 84.5, toS: 107.0, vKmh: 52, cv: 0.22, name: 'Bàu Bàng - Sở Sao' },
  // Sở Sao -> VSIP/Lái Thiêu: enters the Bình Dương urban area, congested at peak hours
  { fromS: 107.0, toS: 126.0, vKmh: 38, cv: 0.30, name: 'Sở Sao - Lái Thiêu' },
  // Lái Thiêu -> Ngã 4 Bình Phước: the famous bottleneck of QL13
  { fromS: 126.0, toS: 132.5, vKmh: 28, cv: 0.38, name: 'Lái Thiêu - Ngã 4 Bình Phước' },
  // Ngã 4 Bình Phước -> Hàng Xanh: inner-city TP.HCM, the largest variance on the route
  { fromS: 132.5, toS: 139.5, vKmh: 24, cv: 0.42, name: 'Ngã 4 Bình Phước - Hàng Xanh' },
  // Hàng Xanh -> Tân Sơn Nhất: crossing the city center via Phạm Văn Đồng
  { fromS: 139.5, toS: 142.5, vKmh: 26, cv: 0.40, name: 'Hàng Xanh - Tân Sơn Nhất' }
]);

/** Speed multiplier by time slot (peak hours run slower than the baseline profile). */
const PEAK_HOUR_FACTORS = Object.freeze([
  { fromHour: 6, toHour: 9, factor: 0.78, cvBoost: 0.10, label: 'Cao điểm sáng' },
  { fromHour: 11, toHour: 13, factor: 0.92, cvBoost: 0.03, label: 'Trưa' },
  { fromHour: 16, toHour: 19, factor: 0.72, cvBoost: 0.12, label: 'Cao điểm chiều' },
  { fromHour: 22, toHour: 24, factor: 1.12, cvBoost: -0.03, label: 'Đêm thoáng' },
  { fromHour: 0, toHour: 5, factor: 1.15, cvBoost: -0.04, label: 'Rạng sáng thoáng' }
]);

/** Uncertainty floor: even when the vehicle is right next to the station there is still ±40s for pulling over and finding a place to park. */
const SIGMA_FLOOR_SECONDS = 40;

/** Cap on the adjusted speed, blocking the case where a noisy GPS reports 200km/h. */
const MAX_EFFECTIVE_KMH = 90;
const MIN_EFFECTIVE_KMH = 8;

/**
 * Look up the peak-hour factor for a point in time.
 * @param {Date|number} at - The point in time to look up
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
 * Cut the range [fromS, toS] into sub-segments according to SEGMENT_SPEED_PROFILE.
 * Returns an array of { lengthKm, vKmh, cv } with the peak-hour factor applied.
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
 * COMPUTE THE TIME-TO-STATION DISTRIBUTION: T_arrive ~ N(mu, sigma^2)
 *
 * Instantaneous speed `currentSpeedKmh` is NOT used to divide the distance. It is only
 * used to lightly adjust the baseline profile (30% blend) — if the vehicle is running clearly slower than
 * the profile there is a reason (rain, heavy load) and it should be partly trusted, but a single
 * red-light stop must not collapse the entire forecast.
 *
 * @param {object} params
 * @param {number} params.currentS - The vehicle's current km marker
 * @param {number} params.targetS - The km marker of the pickup station
 * @param {number} [params.currentSpeedKmh] - Instantaneous speed (only for adjustment)
 * @param {number} [params.nowMs] - The current timestamp
 * @param {number} [params.dwellStopsAhead] - Number of pickup stops to make before reaching the destination
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

  // The vehicle has passed the station: there is no longer a valid ETA for the current direction of travel
  const isBehind = sTarget < sNow;
  const fromS = Math.min(sNow, sTarget);
  const toS = Math.max(sNow, sTarget);
  const distanceKm = Math.round((toS - fromS) * 10) / 10;

  const segments = sliceSegments(fromS, toS, nowMs);

  // Adjust with the instantaneous speed: 30% blend to stay close to reality without noise.
  // Only applied when the vehicle is actually rolling (>15km/h) — a stationary vehicle carries no
  // information about the upcoming journey speed.
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
    const tSeg = (seg.lengthKm / v) * 3600; // seconds
    muSeconds += tSeg;

    // Error propagation: t = d/v  =>  sigma_t = t * (sigma_v / v) = t * cv
    const sigmaSeg = tSeg * seg.cv;
    varianceSeconds += sigmaSeg * sigmaSeg;
  }

  // Each pickup stop on the way adds 60s of dwell + its own variance
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
 * Standard normal cumulative distribution function Phi(z) — Abramowitz & Stegun 26.2.17 approximation.
 * Absolute error < 7.5e-8, more than enough for dispatching.
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
 * PROBABILITY THAT THE VEHICLE ARRIVES AT THE STATION WITHIN THE WINDOW [lowSeconds, highSeconds] FROM NOW.
 *
 *   P(low <= T_arrive - t_now <= high) = Phi((high - mu)/sigma) - Phi((low - mu)/sigma)
 *
 * This is the expression used to decide whether to fire the T-30 notification.
 *
 * @param {object} distribution - Result of computeEtaDistribution()
 * @param {number} lowSeconds - Lower bound of the window (seconds)
 * @param {number} highSeconds - Upper bound of the window (seconds)
 * @returns {number} Probability in [0, 1]
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
 * ARRIVAL-TIME QUANTILE (Quantile) — used to promise a SAFE time to the passenger.
 *
 * Promising by mu means missing the promise 50% of the time. Promising by p80 means 80% of trips will
 * arrive earlier than or exactly at the promised time — this is the number that should be shown in the UI.
 *
 * Uses a condensed Beasley-Springer-Moro inverse Phi approximation.
 *
 * @param {object} distribution - Result of computeEtaDistribution()
 * @param {number} p - Desired quantile (0..1), e.g. 0.8
 * @returns {number|null} Number of seconds from now
 */
export function etaQuantileSeconds(distribution, p = 0.8) {
  if (!distribution?.valid) return null;
  const z = inverseNormalCdf(Math.max(0.001, Math.min(0.999, p)));
  return Math.round(distribution.muSeconds + z * distribution.sigmaSeconds);
}

/** Inverse Phi — Acklam rational approximation, error < 1.15e-9. */
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
 * PROBABILITY OF BEING LATE RELATIVE TO THE TIME COMMITTED TO THE PASSENGER.
 *
 *   P(T_arrive > t_committed + tolerance)
 *
 * This is the input for deciding whether to activate a Shadow trip: don't wait until the vehicle is
 * ACTUALLY late before scrambling; swap immediately when the lateness probability exceeds the threshold.
 *
 * @param {object} distribution - Result of computeEtaDistribution()
 * @param {number} committedAtMs - The time promised to the passenger (epoch ms)
 * @param {number} [toleranceSeconds] - Acceptable tolerance (default 300s)
 * @param {number} [nowMs] - The current timestamp
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
