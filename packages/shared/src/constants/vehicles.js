/**
 * Cấu hình quy chuẩn các dòng xe & giới hạn số ghế chở khách hợp pháp (Nghị định 100/2019/NĐ-CP)
 * - Xe 4–5 chỗ (Sedan/Hatchback/CUV): 1 Chủ xe cầm lái + tối đa 4 Người đi cùng (khuyên chọn 3 để êm ái hàng sau)
 * - Xe 7 chỗ (MPV/SUV): 1 Chủ xe cầm lái + tối đa 6 Người đi cùng (để trống 1 ghế lái)
 */
export const VEHICLE_SEAT_CONFIGS = {
  5: {
    capacity: 5,
    vehicleType: 'sedan_cuv',
    label: 'Xe 4–5 chỗ',
    subLabel: 'Sedan / CUV / Hatchback (Vios, Accent, City, CX-5...)',
    shortLabel: '5 chỗ',
    iconName: 'Car',
    maxPassengerSeats: 4,
    allowedSeats: [1, 2, 3, 4],
    recommendedSeats: 3,
    comfortNote: 'Tối đa 4 người đi cùng (Khuyên nhận 3 người để hàng ghế sau ngồi thoải mái)',
    overloadNotice: 'Xe 5 chỗ chỉ được nhận tối đa 4 người đi cùng (trừ 1 ghế lái của Chủ xe) theo quy chuẩn an toàn'
  },
  7: {
    capacity: 7,
    vehicleType: 'mpv_suv',
    label: 'Xe 7 chỗ',
    subLabel: 'MPV / SUV rộng rãi (Xpander, Veloz, Innova, SantaFe...)',
    shortLabel: '7 chỗ',
    iconName: 'Bus',
    maxPassengerSeats: 6,
    allowedSeats: [1, 2, 3, 4, 5, 6],
    recommendedSeats: 5,
    comfortNote: 'Tối đa 6 người đi cùng (Trừ 1 ghế lái của Chủ xe, còn lại không gian để vali hành lý)',
    overloadNotice: 'Xe 7 chỗ chỉ được nhận tối đa 6 người đi cùng (trừ 1 ghế lái của Chủ xe) theo quy chuẩn an toàn'
  },
  pickup: {
    capacity: 5,
    vehicleType: 'pickup',
    label: 'Xe bán tải (Pick-up)',
    subLabel: 'Ford Ranger, Hilux, Triton, D-Max... (Cabin 5 chỗ + Thùng hàng ~800kg)',
    shortLabel: 'Bán tải',
    iconName: 'Truck',
    maxPassengerSeats: 4,
    allowedSeats: [1, 2, 3, 4],
    recommendedSeats: 3,
    hasCargoBed: true,
    cargoBedCapacityKg: 800,
    comfortNote: 'Cabin 4 khách ngồi thoải mái + Thùng sau siêu rộng nhận đồ cồng kềnh, chuyển trọ sinh viên, nông sản quê',
    overloadNotice: 'Xe bán tải cabin kép chở tối đa 4 người đi cùng (trừ 1 ghế lái) theo quy định đăng kiểm'
  }
};

/**
 * 3 Nhóm thể tích gửi đồ tiện tuyến bản địa (Không cân đo kg / cm³ phức tạp - Cognitive Load = 0)
 */
export const CARGO_TYPES = {
  compact_parcel: {
    id: 'compact_parcel',
    name: 'Bưu phẩm / Đồ gọn nhẹ',
    shortLabel: 'Đồ gọn nhẹ',
    icon: 'Package',
    emoji: '📦',
    description: 'Tài liệu, balo nhỏ, bưu phẩm quà quê gia đình (< 5kg)',
    priceSuggestionText: '30.000đ – 50.000đ',
    basePrice: 40000,
    spaceRequired: 'Để gọn gàng ở cốp sau hoặc sàn xe'
  },
  produce_box: {
    id: 'produce_box',
    name: 'Thùng xốp / Nông sản quê',
    shortLabel: 'Thùng xốp',
    icon: 'Box',
    emoji: '🧊',
    description: 'Thùng xốp trái cây (sầu riêng, mít...), hải sản ướp đá, bao gạo 10–25kg, đồ ăn quê lên phố',
    priceSuggestionText: '70.000đ – 120.000đ',
    basePrice: 90000,
    spaceRequired: 'Cốp xe hoặc khoang thùng lót bạt kín'
  },
  bulky_cargo: {
    id: 'bulky_cargo',
    name: 'Đồ chuyển trọ / Thùng bán tải',
    shortLabel: 'Chuyển trọ / Cồng kềnh',
    icon: 'Truck',
    emoji: '🛻',
    description: 'Vali lớn, quạt cây, nệm gấp, thùng carton đồ sinh viên/người đi làm chuyển trọ',
    priceSuggestionText: '150.000đ – 300.000đ',
    basePrice: 200000,
    spaceRequired: 'Thùng xe bán tải hoặc gập hàng ghế sau'
  }
};

/**
 * Tính mức tiền phụ xăng gợi ý cho việc gửi đồ tiện chuyến
 * @param {string} cargoTypeId - 'compact_parcel' | 'produce_box' | 'bulky_cargo'
 * @param {number} [distanceKm=120]
 * @returns {number}
 */
export function getRecommendedCargoPrice(cargoTypeId, distanceKm = 120) {
  const cargo = CARGO_TYPES[cargoTypeId] || CARGO_TYPES.compact_parcel;
  const dist = Number(distanceKm) > 0 ? Number(distanceKm) : 120;
  // Cự ly chuẩn 100km, dao động nhẹ theo quãng đường thực tế
  const factor = Math.max(0.8, Math.min(1.5, dist / 100));
  const calculated = Math.round((cargo.basePrice * factor) / 5000) * 5000;
  return calculated;
}

/**
 * Chuẩn hóa số ghế nhận khách theo dung tích xe
 * @param {number|string} capacity - 5, 7, hoặc 'pickup'
 * @param {number|string} requestedSeats - Số ghế muốn nhận
 * @returns {{ capacity: number, seats: number, vehicleType: string, hasCargoBed: boolean }}
 */
export function sanitizeVehicleCapacityAndSeats(capacity, requestedSeats) {
  const capStr = String(capacity || '').toLowerCase();
  let capKey = 5;
  if (capStr === 'pickup' || capStr.includes('bán tải') || capStr.includes('ranger') || capStr.includes('hilux') || capStr.includes('triton')) {
    capKey = 'pickup';
  } else if (Number(capacity) === 7) {
    capKey = 7;
  }
  const config = VEHICLE_SEAT_CONFIGS[capKey] || VEHICLE_SEAT_CONFIGS[5];
  let seats;
  if (
    requestedSeats !== undefined &&
    requestedSeats !== null &&
    requestedSeats !== '' &&
    !isNaN(Number(requestedSeats))
  ) {
    seats = Number(requestedSeats);
  } else {
    seats = config.recommendedSeats;
  }
  if (seats < 1) seats = 1;
  if (seats > config.maxPassengerSeats) seats = config.maxPassengerSeats;
  return {
    capacity: config.capacity,
    vehicleCapacity: capKey,
    vehicleType: config.vehicleType || (capKey === 'pickup' ? 'pickup' : (capKey === 7 ? 'mpv_suv' : 'sedan_cuv')),
    seats,
    hasCargoBed: Boolean(config.hasCargoBed)
  };
}
