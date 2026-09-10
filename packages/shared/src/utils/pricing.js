import { ROUTE_BENCHMARKS } from '../constants/routes.js';
import { findLocationCoords, calculateDistanceKm } from './geo.js';

export const formatVND = (num) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
};

/**
 * Chuyển đổi an toàn chuỗi giá trị tham chiếu sang số nguyên (VND)
 * VD: '220.000đ - 250.000đ' -> 235.000, '180.000đ' -> 180.000
 */
export function parsePriceNumber(val, fallback = 0) {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (!val || typeof val !== 'string') return fallback;
  const nums = val.match(/\d[\d.]*/g);
  if (!nums || nums.length === 0) return fallback;
  const parsed = nums.map((n) => Number(n.replace(/\./g, ''))).filter((n) => Number.isFinite(n) && n > 0);
  if (parsed.length === 0) return fallback;
  if (parsed.length === 1) return parsed[0];
  // Giá trị trung bình của khoảng giá
  return Math.round((parsed[0] + parsed[1]) / 2 / 1000) * 1000;
}

/**
 * Hệ thống Dải Biên Độ Giá Thông Minh (Price Guardrails)
 * Tính toán 3 mốc đối chiếu: Xe khách phổ thông — Điểm ngọt CarMate — Limousine dịch vụ
 * MIT Invariants: Dựa trên Geodesic Haversine x 1.28 + dữ liệu tuyến đường BOT thực tế
 */
export function getPriceGuardrail(from, to, currentPrice = 0) {
  const cleanFrom = String(from || '').toLowerCase().trim();
  const cleanTo = String(to || '').toLowerCase().trim();

  let benchmark = null;
  let routeName = '';
  let distanceKm = 100;
  let fuelCost = 150000;
  let botFee = 50000;
  let busPrice = 160000;
  let busRefText = '160.000đ';
  let limoPrice = 240000;
  let limoRefText = '240.000đ';
  let suggestedPrice = 160000;
  let minSafePrice = 90000;
  let maxSafePrice = 280000;
  let quickPresets = [120000, 140000, 160000, 180000];

  // 1. Kiểm tra kho benchmark chính thức theo danh mục tuyến
  for (const key of Object.keys(ROUTE_BENCHMARKS)) {
    const bm = ROUTE_BENCHMARKS[key];
    const kw = (bm.keyword || '').toLowerCase();
    const short = (bm.shortName || '').toLowerCase();
    if (
      (kw && (cleanFrom.includes(kw) || cleanTo.includes(kw))) ||
      (short && (cleanFrom.includes(short) || cleanTo.includes(short)))
    ) {
      benchmark = bm;
      routeName = bm.shortName || bm.name;
      distanceKm = bm.distanceKm || 100;
      fuelCost = bm.fuelCost || 150000;
      botFee = bm.botFee || 0;
      suggestedPrice = bm.suggestedRate || 160000;
      minSafePrice = bm.minSafePrice || Math.round(suggestedPrice * 0.6);
      maxSafePrice = bm.maxSafePrice || Math.round(suggestedPrice * 1.6);
      busRefText = bm.traditionalBusRef || `${formatVND(Math.round(suggestedPrice * 0.9))}`;
      limoRefText = bm.marketLimoRef || `${formatVND(Math.round(suggestedPrice * 1.35))}`;
      busPrice = parsePriceNumber(bm.traditionalBusRef, Math.round(suggestedPrice * 0.9));
      limoPrice = parsePriceNumber(bm.marketLimoRef, Math.round(suggestedPrice * 1.35));

      const step = suggestedPrice >= 150000 ? 20000 : 10000;
      quickPresets = [
        Math.max(minSafePrice, suggestedPrice - step * 2),
        Math.max(minSafePrice, suggestedPrice - step),
        suggestedPrice,
        Math.min(maxSafePrice, suggestedPrice + step)
      ];
      break;
    }
  }

  // 2. Nếu không thuộc tuyến cố định, tính toán dựa trên tọa độ thực tế Geodesic x 1.28
  if (!benchmark) {
    const c1 = findLocationCoords(cleanFrom);
    const c2 = findLocationCoords(cleanTo);
    if (c1 && c2) {
      const straight = calculateDistanceKm(c1.lat, c1.lng, c2.lat, c2.lng);
      distanceKm = Math.max(10, Math.round(straight * 1.28));
    } else {
      distanceKm = 100;
    }

    if (distanceKm <= 40) {
      suggestedPrice = 60000;
      busPrice = 50000;
      limoPrice = 90000;
      minSafePrice = 35000;
      maxSafePrice = 120000;
      quickPresets = [40000, 50000, 60000, 80000];
    } else if (distanceKm <= 80) {
      suggestedPrice = 90000;
      busPrice = 80000;
      limoPrice = 140000;
      minSafePrice = 55000;
      maxSafePrice = 180000;
      quickPresets = [70000, 80000, 90000, 110000];
    } else if (distanceKm <= 130) {
      suggestedPrice = 150000;
      busPrice = 140000;
      limoPrice = 220000;
      minSafePrice = 90000;
      maxSafePrice = 280000;
      quickPresets = [120000, 140000, 150000, 170000];
    } else if (distanceKm <= 200) {
      suggestedPrice = 180000;
      busPrice = 170000;
      limoPrice = 260000;
      minSafePrice = 110000;
      maxSafePrice = 330000;
      quickPresets = [140000, 160000, 180000, 200000];
    } else if (distanceKm <= 300) {
      suggestedPrice = 230000;
      busPrice = 210000;
      limoPrice = 320000;
      minSafePrice = 140000;
      maxSafePrice = 420000;
      quickPresets = [180000, 210000, 230000, 260000];
    } else {
      suggestedPrice = Math.round((distanceKm * 900) / 10000) * 10000;
      busPrice = Math.round((suggestedPrice * 0.9) / 10000) * 10000;
      limoPrice = Math.round((suggestedPrice * 1.35) / 10000) * 10000;
      minSafePrice = Math.round((suggestedPrice * 0.55) / 10000) * 10000;
      maxSafePrice = Math.round((suggestedPrice * 1.6) / 10000) * 10000;
      quickPresets = [suggestedPrice - 40000, suggestedPrice - 20000, suggestedPrice, suggestedPrice + 30000];
    }
    busRefText = formatVND(busPrice);
    limoRefText = formatVND(limoPrice);
  }

  // Đánh giá mức giá hiện tại (Evaluation & Cognitive Feedback)
  const priceNum = Number(currentPrice) || 0;
  let status = 'sweet_spot';
  let statusTone = 'emerald';
  let statusMessage = '';
  let comparisonBadge = '';
  let savingVsLimoPercent = 0;
  let savingVsLimoAmount = 0;

  if (limoPrice > 0 && priceNum > 0) {
    savingVsLimoAmount = Math.max(0, limoPrice - priceNum);
    savingVsLimoPercent = Math.round((savingVsLimoAmount / limoPrice) * 100);
  }

  if (priceNum > 0) {
    if (priceNum < minSafePrice) {
      status = 'too_low';
      statusTone = 'amber';
      statusMessage = `Mức phụ xăng thấp hơn chi phí lăn bánh tối thiểu (~${formatVND(minSafePrice)}). Dễ khiến người đi cùng nghi ngại chất lượng hoặc chuyến đi thiếu cam kết.`;
      comparisonBadge = 'Mức đóng góp thấp';
    } else if (priceNum < Math.min(busPrice * 0.85, suggestedPrice * 0.85)) {
      status = 'low';
      statusTone = 'sky';
      statusMessage = `Mức chia sẻ rất tiết kiệm (thấp hơn nhiều so với xe khách phổ thông ~${formatVND(busPrice)}). Chuyến xe sẽ nhận được nhiều yêu cầu ghép nhanh chóng.`;
      comparisonBadge = 'Rất tiết kiệm';
    } else if (priceNum <= limoPrice) {
      status = 'sweet_spot';
      statusTone = 'emerald';
      if (savingVsLimoPercent >= 10) {
        statusMessage = `Điểm ngọt hoàn hảo: Tiết kiệm ${savingVsLimoPercent}% so với xe Limousine dịch vụ (${formatVND(limoPrice)}), trải nghiệm xe gia đình êm ái, dễ khớp người đi cùng.`;
        comparisonBadge = `Tiết kiệm ${savingVsLimoPercent}% vs Limousine`;
      } else {
        statusMessage = `Mức chia sẻ chi phí chuẩn tuyến, hợp lý cho chuyến xe gia đình văn minh.`;
        comparisonBadge = 'Chuẩn giá chia sẻ';
      }
    } else if (priceNum <= maxSafePrice) {
      status = 'high';
      statusTone = 'amber';
      statusMessage = `Mức phụ xăng cao hơn xe Limousine dịch vụ (${formatVND(limoPrice)}). Người đi cùng thường sẽ ưu tiên chọn Limousine thay vì đi ghép.`;
      comparisonBadge = 'Cao hơn Limousine';
    } else {
      status = 'too_high';
      statusTone = 'rose';
      statusMessage = `Mức phụ xăng vượt quá khung chia sẻ chi phí hợp lý (~${formatVND(maxSafePrice)}). CarMate là nền tảng chia sẻ chi phí văn minh, không phải xe kinh doanh dịch vụ riêng.`;
      comparisonBadge = 'Vượt khung chia sẻ';
    }
  } else {
    // Mặc định ban đầu
    status = 'sweet_spot';
    statusTone = 'emerald';
    statusMessage = `Điểm ngọt đề xuất cho tuyến này là ${formatVND(suggestedPrice)}/ghế.`;
    comparisonBadge = 'Điểm ngọt đề xuất';
  }

  return {
    routeName,
    distanceKm,
    fuelCost,
    botFee,
    busPrice,
    busRefText,
    limoPrice,
    limoRefText,
    suggestedPrice,
    minSafePrice,
    maxSafePrice,
    quickPresets,
    status,
    statusTone,
    statusMessage,
    comparisonBadge,
    savingVsLimoPercent,
    savingVsLimoAmount
  };
}

export const calculatePricing = (item, seats = 1) => {
  if (!item) {
    return { unitPrice: 0, total: 0, hasDiscount: false, savedAmount: 0, discountPercent: 0 };
  }
  const basePrice = item.basePricePerSeat || item.expectedPrice || 180000;
  const discountPercent = item.customDiscountPercent !== undefined ? item.customDiscountPercent : 0;

  if (seats >= 2 && discountPercent > 0 && item.type === 'driver_offer') {
    const discountedUnit = Math.round(basePrice * (1 - discountPercent / 100));
    const total = discountedUnit * seats;
    const originalTotal = basePrice * seats;
    return {
      unitPrice: discountedUnit,
      total,
      hasDiscount: true,
      savedAmount: originalTotal - total,
      discountPercent
    };
  }

  return {
    unitPrice: basePrice,
    total: basePrice * seats,
    hasDiscount: false,
    savedAmount: 0,
    discountPercent: 0
  };
};

/**
 * Cấu hình cam kết tùy chọn của nền tảng:
 * - Cọc 50.000đ/ghế (hủy trước 8 tiếng hoàn 100%)
 * - Hoặc cam kết 100% giá trị chuyến
 * Nền tảng chỉ kết nối; mọi thỏa thuận chi tiết do hai bên tự trao đổi.
 */
export const getDepositConfig = (item, seatsCount = 1) => {
  const depositPerSeat = 50000;
  return {
    depositPerSeat,
    depositAmount: depositPerSeat * seatsCount,
    depositLabel: '50k / ghế'
  };
};

