export const formatVND = (num) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
};

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
