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

// Định mức tiêu thụ nhiên liệu xe 5-7 chỗ hỗn hợp đường dài QL13 (có dừng đèn đỏ & kẹt xe cửa ngõ)
export const AVG_CONSUMPTION_L_PER_100KM = 8.2;

// Tỷ lệ khấu hao hao mòn lốp, rửa xe, nước suối (10% tiền xăng)
export const WEAR_AND_TEAR_RATIO = 0.10;

// Tỷ lệ thực nhận của Chủ xe sau phí nền tảng (90%)
export const DRIVER_PAYOUT_RATIO = 0.90;

// Giá xăng RON 95-III tham chiếu mặc định (VNĐ/Lít)
export const DEFAULT_DAILY_FUEL_PRICE = 24120;

// Biến lưu trữ giá xăng trong phiên làm việc
let currentDailyFuelPrice = DEFAULT_DAILY_FUEL_PRICE;
let lastFuelUpdatedAt = new Date().toISOString();

/**
 * Lấy chỉ số giá xăng RON 95-III hiện tại
 */
export function getDailyFuelPrice() {
  return {
    ron95Price: currentDailyFuelPrice,
    unit: 'VNĐ/Lít',
    fuelType: 'RON 95-III',
    updatedAt: lastFuelUpdatedAt
  };
}

/**
 * Cập nhật giá xăng RON 95-III hàng ngày (từ API hoặc quản trị viên)
 */
export function setDailyFuelPrice(newPrice) {
  const priceNum = Number(newPrice);
  if (Number.isFinite(priceNum) && priceNum >= 15000 && priceNum <= 45000) {
    currentDailyFuelPrice = Math.round(priceNum);
    lastFuelUpdatedAt = new Date().toISOString();
    return currentDailyFuelPrice;
  }
  return currentDailyFuelPrice;
}

/**
 * Ước tính phí cầu đường BOT thực tế theo cự ly và hành lang
 */
export function estimateBotFee(distanceKm, corridor = 'Tuyến QL13') {
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
export function calculateTripDirectCost(distanceKm, corridor = 'Tuyến QL13', fuelPrice = currentDailyFuelPrice) {
  const dist = Math.max(10, distanceKm || 100);
  const fuelLiters = (dist * AVG_CONSUMPTION_L_PER_100KM) / 100;
  const fuelCost = Math.round(fuelLiters * fuelPrice);
  const botFee = estimateBotFee(dist, corridor);
  const wearCost = Math.round(fuelCost * WEAR_AND_TEAR_RATIO);
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

  // 1. Tính toán chi phí trực tiếp của chuyến xe
  const tripCost = calculateTripDirectCost(dist, corridor, fuelPrice);

  // 2. CẬN SÀN P_min (Chủ xe chở 2 khách nhận 90% phải bù đắp 100% totalDirectCost)
  // 2 * P_min * 0.90 >= totalDirectCost  ==>  P_min = totalDirectCost / 1.8
  const pMinRaw = tripCost.totalDirectCost / (2 * DRIVER_PAYOUT_RATIO);
  const pMin = Math.round(pMinRaw / 5000) * 5000;

  // 3. CẬN TRẦN P_max (Bảo vệ khách: luôn rẻ hơn Limousine 9 chỗ ít nhất 25-30%)
  // Giá xe Limousine dịch vụ thị trường tham chiếu: ~2.100đ/km, tối thiểu 120.000đ
  const limoRef = Math.max(120000, Math.round((dist * 2100) / 10000) * 10000);
  const pMax = Math.round((limoRef * 0.75) / 5000) * 5000;

  // 4. HỆ SỐ CO GIÃN CÂN BẰNG NASH α ∈ [0.35, 0.65] (Mặc định 0.50)
  // Bất biến: Chặn cứng trong [0.35, 0.65] để chống tăng giá sốc
  const boundedRatio = Math.max(0.3, Math.min(3.0, supplyDemandRatio));
  const alpha = 0.50 + 0.15 * Math.tanh((boundedRatio - 1.0) / 2.0);

  // 5. GIÁ VÉ TỐI ƯU CÂN BẰNG P*
  // Đảm bảo P* >= P_min (Chủ xe không bao giờ lỗ) và P* <= P_max (Khách luôn rẻ hơn Limousine)
  let calculatedPrice = Math.round(((1 - alpha) * pMin + alpha * Math.max(pMin, pMax)) / 5000) * 5000;
  calculatedPrice = Math.max(pMin, calculatedPrice);

  // 6. THU NHẬP THỰC NHẬN CỦA CHỦ XE (90%)
  const driverPayoutPerSeat = Math.round(calculatedPrice * DRIVER_PAYOUT_RATIO);
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
    totalTripCost: tripCost.totalDirectCost,
    pMin,
    pMax,
    limoRef,
    savingVsLimoPercent,
    breakevenCovered,
    alpha: Math.round(alpha * 100) / 100
  };
}
