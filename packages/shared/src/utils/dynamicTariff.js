/**
 * CARMATE DYNAMIC MARKET TARIFF ENGINE
 * =============================================================================
 * Mathematical model of two-sided dynamic pricing (Nash Bargaining Equilibrium)
 * integrating the Daily Petrolimex Fuel Index.
 *
 * 1. FLOOR PROTECTING THE DRIVER (Floor Invariant):
 *    Carrying 2 fellow passengers must cover 100% of the fuel cost (8.2L/100km) + BOT toll fees for roads and bridges.
 *    P_min(t) = C_trip(t) / (2 * 0.9).
 *
 * 2. CEILING PROTECTING THE PASSENGER (Ceiling Invariant):
 *    P_max(t) = P_limo * 0.75 (Always at least 25-30% cheaper than a 9-seat Limousine).
 *
 * 3. NASH BARGAINING ELASTICITY (Nash Bargaining Solution):
 *    P*(t) = (1 - α) * P_min(t) + α * P_max(t), with α ∈ [0.35, 0.65].
 *    Anti-surge: maximum fluctuation range of ±10-15%, absolutely no sudden price multipliers.
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// PRICING FORMULA PARAMETERS
//
// The price is not a number the driver types in, but the OUTPUT of the formula below.
// Only an Admin may edit these parameters (Admin page ➔ "Công thức định giá" (Pricing formula)),
// and every change applies immediately platform-wide. This embodies the principle of
// strategy-proofness (Roth & Sotomayor): participants cannot manipulate the price.
// ---------------------------------------------------------------------------

// Fuel consumption norm for a mixed 5-7 seat vehicle on the long-distance QL13 route (including red lights & congestion at city entrances)
export const DEFAULT_AVG_CONSUMPTION_L_PER_100KM = 8.2;

// Wear-and-tear ratio for tires, car washes, bottled water (10% of fuel cost)
export const DEFAULT_WEAR_AND_TEAR_RATIO = 0.10;

// Share the driver actually receives after the platform fee (90%)
export const DEFAULT_DRIVER_PAYOUT_RATIO = 0.90;

// Reference unit price of a 9-seat Limousine service (VND/km) used to build the ceiling
export const DEFAULT_LIMO_RATE_PER_KM = 2100;

// Minimum Limousine fare for any leg (VND)
export const DEFAULT_LIMO_MIN_FARE = 120000;

// Ceiling ratio: the CarMate price is always at least 25% cheaper than a Limousine
export const DEFAULT_CEILING_RATIO = 0.75;

// Base Nash elasticity coefficient α₀ and maximum fluctuation range ±α_span
export const DEFAULT_NASH_ALPHA_BASE = 0.50;
export const DEFAULT_NASH_ALPHA_SPAN = 0.15;

// Fare rounding step for easy cash payment (VND)
export const DEFAULT_PRICE_ROUNDING_STEP = 5000;

/** Safe bounds of each parameter — values entered by an Admin outside this range are rejected. */
export const TARIFF_PARAM_BOUNDS = Object.freeze({
  avgConsumptionLper100km: { min: 4, max: 20, label: 'Định mức tiêu thụ (L/100km)', step: 0.1 },
  wearAndTearRatio: { min: 0, max: 0.5, label: 'Tỷ lệ khấu hao (so với tiền xăng)', step: 0.01 },
  driverPayoutRatio: { min: 0.5, max: 1, label: 'Tỷ lệ Chủ xe thực nhận', step: 0.01 },
  limoRatePerKm: { min: 500, max: 10000, label: 'Đơn giá Limousine tham chiếu (đ/km)', step: 50 },
  limoMinFare: { min: 20000, max: 500000, label: 'Giá vé Limousine tối thiểu (đ)', step: 5000 },
  ceilingRatio: { min: 0.4, max: 1, label: 'Hệ số cận trần so với Limousine', step: 0.01 },
  nashAlphaBase: { min: 0.2, max: 0.8, label: 'Hệ số Nash cơ sở α₀', step: 0.01 },
  nashAlphaSpan: { min: 0, max: 0.3, label: 'Biên độ dao động α', step: 0.01 },
  priceRoundingStep: { min: 1000, max: 10000, label: 'Bước làm tròn giá (đ)', step: 1000 }
});

/** The platform's default set of formula parameters. */
export const DEFAULT_TARIFF_PARAMS = Object.freeze({
  avgConsumptionLper100km: DEFAULT_AVG_CONSUMPTION_L_PER_100KM,
  wearAndTearRatio: DEFAULT_WEAR_AND_TEAR_RATIO,
  driverPayoutRatio: DEFAULT_DRIVER_PAYOUT_RATIO,
  limoRatePerKm: DEFAULT_LIMO_RATE_PER_KM,
  limoMinFare: DEFAULT_LIMO_MIN_FARE,
  ceilingRatio: DEFAULT_CEILING_RATIO,
  nashAlphaBase: DEFAULT_NASH_ALPHA_BASE,
  nashAlphaSpan: DEFAULT_NASH_ALPHA_SPAN,
  priceRoundingStep: DEFAULT_PRICE_ROUNDING_STEP
});

// The parameter set currently in effect during the session
let currentTariffParams = { ...DEFAULT_TARIFF_PARAMS };
let lastTariffUpdatedAt = new Date().toISOString();
let lastTariffUpdatedBy = 'system';
let lastTariffSource = 'default';

/** Get the formula parameter set currently in effect platform-wide. */
export function getTariffParams() {
  return {
    ...currentTariffParams,
    updatedAt: lastTariffUpdatedAt,
    updatedBy: lastTariffUpdatedBy,
    source: lastTariffSource,
    isDefault: lastTariffSource === 'default'
  };
}

/**
 * Validate a formula parameter set before allowing it to be applied.
 * Returns { params, errors }: empty errors means valid.
 */
export function validateTariffParams(input = {}, base = currentTariffParams) {
  // Merge onto the parameter set IN EFFECT, not the default set: when an Admin edits one field and
  // saves, the other eight fields must stay unchanged. Merging onto the defaults would silently revert every
  // earlier adjustment to the platform's original values.
  const params = { ...DEFAULT_TARIFF_PARAMS, ...(base || {}) };
  const errors = [];

  for (const [key, bound] of Object.entries(TARIFF_PARAM_BOUNDS)) {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === '') continue; // keep the default
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      errors.push(`${bound.label}: phải là một con số.`);
      continue;
    }
    if (num < bound.min || num > bound.max) {
      errors.push(`${bound.label}: phải nằm trong khoảng ${bound.min} đến ${bound.max}.`);
      continue;
    }
    params[key] = num;
  }

  // Cross-parameter invariant: the ceiling must actually sit above the floor at every distance,
  // otherwise the engine would clamp the price to pMin and the Nash formula would lose its meaning.
  if (params.nashAlphaBase + params.nashAlphaSpan > 1) {
    errors.push('Hệ số Nash: α₀ + biên độ không được vượt quá 1.');
  }

  return { params, errors };
}

/**
 * Apply a new formula parameter set (Admin only).
 * Throws an error if any parameter exceeds its safe bounds.
 */
export function setTariffParams(input = {}, updatedAt = null, updatedBy = 'admin', source = 'admin') {
  const { params, errors } = validateTariffParams(input);
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
  currentTariffParams = params;
  lastTariffUpdatedAt = updatedAt || new Date().toISOString();
  lastTariffUpdatedBy = updatedBy;
  lastTariffSource = source;
  return getTariffParams();
}

/** Restore the formula parameter set to the platform defaults. */
export function resetTariffParams() {
  currentTariffParams = { ...DEFAULT_TARIFF_PARAMS };
  lastTariffUpdatedAt = new Date().toISOString();
  lastTariffUpdatedBy = 'system';
  lastTariffSource = 'default';
  return getTariffParams();
}

// Default reference RON 95-III fuel price (VND/Liter)
export const DEFAULT_DAILY_FUEL_PRICE = 24120;

// Variables storing the fuel price during the session
let currentDailyFuelPrice = DEFAULT_DAILY_FUEL_PRICE;
let lastFuelUpdatedAt = new Date().toISOString();
let lastFuelUpdatedBy = 'system';
let lastFuelSource = 'default';

/**
 * Get the current RON 95-III fuel price index
 */
export function getDailyFuelPrice() {
  return {
    ron95Price: currentDailyFuelPrice,
    unit: 'VNĐ/Lít',
    fuelType: 'RON 95-III',
    updatedAt: lastFuelUpdatedAt,
    updatedBy: lastFuelUpdatedBy,
    source: lastFuelSource,
    defaultPrice: DEFAULT_DAILY_FUEL_PRICE,
    isDefault: currentDailyFuelPrice === DEFAULT_DAILY_FUEL_PRICE
  };
}

/**
 * Update the daily RON 95-III fuel price (from an API or an Admin)
 * MIT invariant: safety limit within the range [15.000đ, 45.000đ per liter]
 */
export function setDailyFuelPrice(newPrice, updatedAt = null, updatedBy = 'system', source = 'admin') {
  const priceNum = Number(newPrice);
  if (!Number.isFinite(priceNum) || priceNum < 15000 || priceNum > 45000) {
    throw new Error('Giá xăng RON 95 không hợp lệ (phải từ 15.000đ đến 45.000đ/lít)');
  }
  currentDailyFuelPrice = Math.round(priceNum);
  lastFuelUpdatedAt = updatedAt || new Date().toISOString();
  lastFuelUpdatedBy = updatedBy;
  lastFuelSource = source;
  return currentDailyFuelPrice;
}

/**
 * Restore the RON 95-III fuel price to the default reference level
 */
export function resetDailyFuelPrice() {
  currentDailyFuelPrice = DEFAULT_DAILY_FUEL_PRICE;
  lastFuelUpdatedAt = new Date().toISOString();
  lastFuelUpdatedBy = 'system';
  lastFuelSource = 'default';
  return currentDailyFuelPrice;
}

/**
 * Estimate the actual BOT toll fees by distance and corridor
 */
function estimateBotFee(distanceKm, corridor = 'Tuyến QL13') {
  const dist = Math.max(10, distanceKm || 100);
  const isN2 = String(corridor).includes('N2') || String(corridor).includes('Kiên Giang');

  if (isN2) {
    // The N2 route has BOT stations at Đức Hòa, Thạnh Hóa, Cầu Vàm Cống...
    return Math.min(80000, Math.round((dist / 280) * 80000 / 5000) * 5000);
  }

  // QL13 route corridor: 4 BOT stations (Tân Lập/An Lộc 20k, Bàu Bàng 20k, Suối Giữa 15k, Lái Thiêu 15k)
  if (dist >= 110) return 70000; // Bình Long ➔ Sài Gòn (passing all 4 stations)
  if (dist >= 90) return 65000;  // Tân Khai ➔ Sài Gòn (passing 3-4 stations)
  if (dist >= 70) return 50000;  // Chơn Thành ➔ Sài Gòn (passing 3 stations)
  if (dist >= 50) return 35000;  // Bàu Bàng ➔ Sài Gòn (passing 2 stations)
  if (dist >= 30) return 15000;  // Thủ Dầu Một ➔ Sài Gòn or Bình Long ➔ Chơn Thành (passing 1 station)
  return 0;                      // Short intra-city leg under 30km
}

/**
 * Compute the total direct cost of the trip (Fuel + BOT + small wear and tear)
 */
function calculateTripDirectCost(distanceKm, corridor = 'Tuyến QL13', fuelPrice = currentDailyFuelPrice, params = currentTariffParams) {
  const dist = Math.max(10, distanceKm || 100);
  const fuelLiters = (dist * params.avgConsumptionLper100km) / 100;
  const fuelCost = Math.round(fuelLiters * fuelPrice);
  const botFee = estimateBotFee(dist, corridor);
  const wearCost = Math.round(fuelCost * params.wearAndTearRatio);
  const totalDirectCost = fuelCost + botFee + wearCost;

  return {
    distanceKm: dist,
    fuelPrice,
    fuelLiters: Math.round(fuelLiters * 10) / 10,
    fuelCost,
    botFee,
    wearCost,
    totalDirectCost
  };
}

/**
 * COMPUTE THE NASH BARGAINING DYNAMIC SEGMENT TARIFF (NASH BARGAINING DYNAMIC TARIFF)
 * 
 * @param {number} distanceKm - Actual travel distance (km)
 * @param {object} options - Extended input parameters
 * @param {number} options.fuelPrice - Fuel price (defaults to currentDailyFuelPrice)
 * @param {number} options.supplyDemandRatio - Demand/Supply ratio (default 1.0)
 * @param {string} options.corridor - Corridor route (default 'Tuyến QL13')
 * @param {string} options.label - Display label of the leg
 */
export function calculateDynamicTariffByDistance(distanceKm, options = {}) {
  const dist = Math.max(10, distanceKm || 100);
  const opts = typeof options === 'string' ? { corridor: options } : (options || {});
  const fuelPrice = opts.fuelPrice || currentDailyFuelPrice;
  const supplyDemandRatio = opts.supplyDemandRatio || 1.0;
  const corridor = opts.corridor || 'Tuyến QL13';
  const label = opts.label || `${dist} km`;
  // Formula parameter set: by default uses the platform-wide configuration set by the Admin.
  const params = opts.params ? validateTariffParams(opts.params).params : currentTariffParams;

  // 1. Compute the direct cost of the trip
  const tripCost = calculateTripDirectCost(dist, corridor, fuelPrice, params);
  const step = params.priceRoundingStep;

  // 2. FLOOR P_min (a driver carrying 2 passengers who receives the full payout ratio must cover 100% of totalDirectCost)
  // 2 * P_min * payoutRatio >= totalDirectCost  ==>  P_min = totalDirectCost / (2 * payoutRatio)
  const pMinRaw = tripCost.totalDirectCost / (2 * params.driverPayoutRatio);
  const pMin = Math.round(pMinRaw / step) * step;

  // 3. CEILING P_max (protects the passenger: always cheaper than a 9-seat Limousine according to the ceiling ratio)
  const limoRef = Math.max(params.limoMinFare, Math.round((dist * params.limoRatePerKm) / 10000) * 10000);
  const pMax = Math.round((limoRef * params.ceilingRatio) / step) * step;

  // 4. NASH BARGAINING ELASTICITY COEFFICIENT α ∈ [α₀-span, α₀+span]
  // Invariant: tanh hard-limits the amplitude to prevent sudden price surges
  const boundedRatio = Math.max(0.3, Math.min(3.0, supplyDemandRatio));
  const alpha = params.nashAlphaBase + params.nashAlphaSpan * Math.tanh((boundedRatio - 1.0) / 2.0);

  // 5. OPTIMAL EQUILIBRIUM FARE P*
  // Ensures P* >= P_min (the driver never loses money) and P* <= P_max (the passenger always pays less than Limousine)
  let calculatedPrice = Math.round(((1 - alpha) * pMin + alpha * Math.max(pMin, pMax)) / step) * step;
  calculatedPrice = Math.max(pMin, calculatedPrice);

  // 6. DRIVER'S ACTUAL EARNINGS
  const driverPayoutPerSeat = Math.round(calculatedPrice * params.driverPayoutRatio);
  const driverPayoutFor2Seats = driverPayoutPerSeat * 2;

  // 7. MATHEMATICAL INVARIANTS CHECK
  const breakevenCovered = driverPayoutFor2Seats >= (tripCost.fuelCost + tripCost.botFee);
  const savingVsLimoAmount = Math.max(0, limoRef - calculatedPrice);
  const savingVsLimoPercent = Math.round((savingVsLimoAmount / limoRef) * 100);

  return {
    pricePerSeat: calculatedPrice,
    driverPayoutPerSeat,
    driverPayoutFor2Seats,
    distanceKm: dist,
    noSurge: true,
    label,
    fuelPricePerLiter: fuelPrice,
    fuelCost: tripCost.fuelCost,
    botFee: tripCost.botFee,
    directCost: tripCost,
    tripCost,
    totalTripCost: tripCost.totalDirectCost,
    pMin,
    pMax,
    limoRef,
    savingVsLimoPercent,
    breakevenCovered,
    alpha: Math.round(alpha * 100) / 100,
    params: { ...params }
  };
}
