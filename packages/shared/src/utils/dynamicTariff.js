/**
 * CARMATE DYNAMIC MARKET TARIFF ENGINE
 * =============================================================================
 * Mô hình toán học định giá động cân bằng hai mặt (Nash Bargaining Equilibrium)
 * tích hợp Chỉ số Giá Xăng Dầu Hàng Ngày (Daily Petrolimex Fuel Index).
 *
 * 1. CẬN SÀN BẢO VỆ CHỦ XE (Floor Invariant):
 *    Chở 2 khách đi cùng phải bù đắp 100% chi phí xăng (8.2L/100km) + vé BOT cầu đường.
 *    P_min(t) = C_trip(t) / (2 * 0.9).
 *
 * 2. CẬN TRẦN BẢO VỆ NGƯỜI ĐI CÙNG (Ceiling Invariant):
 *    P_max(t) = P_limo * 0.75 (Luôn rẻ hơn xe Limousine 9 chỗ ít nhất 25-30%).
 *
 * 3. CO GIÃN CÂN BẰNG NASH (Nash Bargaining Solution):
 *    P*(t) = (1 - α) * P_min(t) + α * P_max(t), với α ∈ [0.35, 0.65].
 *    Anti-surge: Biên độ dao động tối đa ±10-15%, tuyệt đối không nhân giá sốc.
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// THAM SỐ CÔNG THỨC ĐỊNH GIÁ (PRICING FORMULA PARAMETERS)
//
// Giá không phải là con số Chủ xe tự gõ, mà là ĐẦU RA của công thức bên dưới.
// Chỉ Quản trị viên mới được sửa các tham số này (Trang Admin ➔ Công thức định giá),
// và mọi thay đổi lập tức áp cho toàn sàn. Đây là hiện thân của nguyên tắc
// strategy-proofness (Roth & Sotomayor): người tham gia không thể thao túng giá.
// ---------------------------------------------------------------------------

// Định mức tiêu thụ nhiên liệu xe 5-7 chỗ hỗn hợp đường dài QL13 (có dừng đèn đỏ & kẹt xe cửa ngõ)
export const DEFAULT_AVG_CONSUMPTION_L_PER_100KM = 8.2;

// Tỷ lệ khấu hao hao mòn lốp, rửa xe, nước suối (10% tiền xăng)
export const DEFAULT_WEAR_AND_TEAR_RATIO = 0.10;

// Tỷ lệ thực nhận của Chủ xe sau phí nền tảng (90%)
export const DEFAULT_DRIVER_PAYOUT_RATIO = 0.90;

// Đơn giá tham chiếu xe Limousine 9 chỗ dịch vụ (VNĐ/km) dùng dựng cận trần
export const DEFAULT_LIMO_RATE_PER_KM = 2100;

// Giá vé Limousine tối thiểu cho một chặng bất kỳ (VNĐ)
export const DEFAULT_LIMO_MIN_FARE = 120000;

// Hệ số cận trần: giá CarMate luôn rẻ hơn Limousine ít nhất 25%
export const DEFAULT_CEILING_RATIO = 0.75;

// Hệ số co giãn Nash cơ sở α₀ và biên độ dao động tối đa ±α_span
export const DEFAULT_NASH_ALPHA_BASE = 0.50;
export const DEFAULT_NASH_ALPHA_SPAN = 0.15;

// Bước làm tròn giá vé cho dễ trả tiền mặt (VNĐ)
export const DEFAULT_PRICE_ROUNDING_STEP = 5000;

/** Biên an toàn của từng tham số — Admin nhập ngoài dải này sẽ bị từ chối. */
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

/** Bộ tham số công thức mặc định của nền tảng. */
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

// Bộ tham số đang áp dụng trong phiên làm việc
let currentTariffParams = { ...DEFAULT_TARIFF_PARAMS };
let lastTariffUpdatedAt = new Date().toISOString();
let lastTariffUpdatedBy = 'system';
let lastTariffSource = 'default';

/** Lấy bộ tham số công thức đang áp dụng cho toàn sàn. */
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
 * Kiểm định một bộ tham số công thức trước khi cho phép áp dụng.
 * Trả về { params, errors }: errors rỗng nghĩa là hợp lệ.
 */
export function validateTariffParams(input = {}) {
  const params = { ...DEFAULT_TARIFF_PARAMS };
  const errors = [];

  for (const [key, bound] of Object.entries(TARIFF_PARAM_BOUNDS)) {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === '') continue; // giữ mặc định
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

  // Bất biến liên tham số: cận trần phải thực sự nằm trên cận sàn ở mọi cự ly,
  // nếu không engine sẽ kẹp giá về pMin và công thức Nash mất ý nghĩa.
  if (params.nashAlphaBase + params.nashAlphaSpan > 1) {
    errors.push('Hệ số Nash: α₀ + biên độ không được vượt quá 1.');
  }

  return { params, errors };
}

/**
 * Áp dụng bộ tham số công thức mới (chỉ Quản trị viên).
 * Ném lỗi nếu bất kỳ tham số nào vượt biên an toàn.
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

/** Khôi phục bộ tham số công thức về mặc định của nền tảng. */
export function resetTariffParams() {
  currentTariffParams = { ...DEFAULT_TARIFF_PARAMS };
  lastTariffUpdatedAt = new Date().toISOString();
  lastTariffUpdatedBy = 'system';
  lastTariffSource = 'default';
  return getTariffParams();
}

// Giá xăng RON 95-III tham chiếu mặc định (VNĐ/Lít)
export const DEFAULT_DAILY_FUEL_PRICE = 24120;

// Biến lưu trữ giá xăng trong phiên làm việc
let currentDailyFuelPrice = DEFAULT_DAILY_FUEL_PRICE;
let lastFuelUpdatedAt = new Date().toISOString();
let lastFuelUpdatedBy = 'system';
let lastFuelSource = 'default';

/**
 * Lấy chỉ số giá xăng RON 95-III hiện tại
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
 * Cập nhật giá xăng RON 95-III hàng ngày (từ API hoặc Quản trị viên)
 * Bất biến MIT: Giới hạn an toàn trong dải [15.000đ, 45.000đ/Lít]
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
 * Khôi phục giá xăng RON 95-III về mức tham chiếu mặc định
 */
export function resetDailyFuelPrice() {
  currentDailyFuelPrice = DEFAULT_DAILY_FUEL_PRICE;
  lastFuelUpdatedAt = new Date().toISOString();
  lastFuelUpdatedBy = 'system';
  lastFuelSource = 'default';
  return currentDailyFuelPrice;
}

/**
 * Ước tính phí cầu đường BOT thực tế theo cự ly và hành lang
 */
function estimateBotFee(distanceKm, corridor = 'Tuyến QL13') {
  const dist = Math.max(10, distanceKm || 100);
  const isN2 = String(corridor).includes('N2') || String(corridor).includes('Kiên Giang');

  if (isN2) {
    // Tuyến N2 có các trạm BOT Đức Hòa, Thạnh Hóa, Cầu Vàm Cống...
    return Math.min(80000, Math.round((dist / 280) * 80000 / 5000) * 5000);
  }

  // Hành lang Tuyến QL13: 4 trạm BOT (Tân Lập/An Lộc 20k, Bàu Bàng 20k, Suối Giữa 15k, Lái Thiêu 15k)
  if (dist >= 110) return 70000; // Bình Long ➔ Sài Gòn (qua cả 4 trạm)
  if (dist >= 90) return 65000;  // Tân Khai ➔ Sài Gòn (qua 3-4 trạm)
  if (dist >= 70) return 50000;  // Chơn Thành ➔ Sài Gòn (qua 3 trạm)
  if (dist >= 50) return 35000;  // Bàu Bàng ➔ Sài Gòn (qua 2 trạm)
  if (dist >= 30) return 15000;  // Thủ Dầu Một ➔ Sài Gòn hoặc Bình Long ➔ Chơn Thành (qua 1 trạm)
  return 0;                      // Chặng ngắn nội ô dưới 30km
}

/**
 * Tính tổng chi phí trực tiếp của chuyến xe (Xăng + BOT + Khấu hao nhỏ)
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
 * TÍNH TOÁN CƯỚC PHÂN ĐOẠN ĐỘNG CÂN BẰNG NASH (NASH BARGAINING DYNAMIC TARIFF)
 * 
 * @param {number} distanceKm - Cự ly di chuyển thực tế (km)
 * @param {object} options - Các tham số đầu vào mở rộng
 * @param {number} options.fuelPrice - Giá xăng dầu (mặc định lấy currentDailyFuelPrice)
 * @param {number} options.supplyDemandRatio - Tỷ lệ Cầu/Cung (mặc định 1.0)
 * @param {string} options.corridor - Tuyến hành lang (mặc định 'Tuyến QL13')
 * @param {string} options.label - Nhãn hiển thị chặng đường
 */
export function calculateDynamicTariffByDistance(distanceKm, options = {}) {
  const dist = Math.max(10, distanceKm || 100);
  const opts = typeof options === 'string' ? { corridor: options } : (options || {});
  const fuelPrice = opts.fuelPrice || currentDailyFuelPrice;
  const supplyDemandRatio = opts.supplyDemandRatio || 1.0;
  const corridor = opts.corridor || 'Tuyến QL13';
  const label = opts.label || `${dist} km`;
  // Bộ tham số công thức: mặc định lấy cấu hình toàn sàn do Quản trị viên đặt.
  const params = opts.params ? validateTariffParams(opts.params).params : currentTariffParams;

  // 1. Tính toán chi phí trực tiếp của chuyến xe
  const tripCost = calculateTripDirectCost(dist, corridor, fuelPrice, params);
  const step = params.priceRoundingStep;

  // 2. CẬN SÀN P_min (Chủ xe chở 2 khách nhận đủ tỷ lệ payout phải bù 100% totalDirectCost)
  // 2 * P_min * payoutRatio >= totalDirectCost  ==>  P_min = totalDirectCost / (2 * payoutRatio)
  const pMinRaw = tripCost.totalDirectCost / (2 * params.driverPayoutRatio);
  const pMin = Math.round(pMinRaw / step) * step;

  // 3. CẬN TRẦN P_max (Bảo vệ khách: luôn rẻ hơn Limousine 9 chỗ theo hệ số cận trần)
  const limoRef = Math.max(params.limoMinFare, Math.round((dist * params.limoRatePerKm) / 10000) * 10000);
  const pMax = Math.round((limoRef * params.ceilingRatio) / step) * step;

  // 4. HỆ SỐ CO GIÃN CÂN BẰNG NASH α ∈ [α₀-span, α₀+span]
  // Bất biến: tanh chặn cứng biên độ để chống tăng giá sốc
  const boundedRatio = Math.max(0.3, Math.min(3.0, supplyDemandRatio));
  const alpha = params.nashAlphaBase + params.nashAlphaSpan * Math.tanh((boundedRatio - 1.0) / 2.0);

  // 5. GIÁ VÉ TỐI ƯU CÂN BẰNG P*
  // Đảm bảo P* >= P_min (Chủ xe không bao giờ lỗ) và P* <= P_max (Khách luôn rẻ hơn Limousine)
  let calculatedPrice = Math.round(((1 - alpha) * pMin + alpha * Math.max(pMin, pMax)) / step) * step;
  calculatedPrice = Math.max(pMin, calculatedPrice);

  // 6. THU NHẬP THỰC NHẬN CỦA CHỦ XE
  const driverPayoutPerSeat = Math.round(calculatedPrice * params.driverPayoutRatio);
  const driverPayoutFor2Seats = driverPayoutPerSeat * 2;

  // 7. KIỂM THỬ BẤT BIẾN TOÁN HỌC (INVARIANTS CHECK)
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
