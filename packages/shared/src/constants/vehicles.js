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
  },
  truck_light: {
    capacity: 2,
    vehicleType: 'truck_light',
    label: 'Xe tải nhẹ tiện chuyến (1T – 3.5T)',
    subLabel: 'Kia K200/K250, Hyundai H150, Isuzu QKR... (Thùng 1T – 3.5T chạy tiện đường/quay đầu rỗng)',
    shortLabel: 'Xe tải nhẹ',
    iconName: 'Truck',
    maxPassengerSeats: 1,
    allowedSeats: [1],
    recommendedSeats: 1,
    hasCargoBed: true,
    isCargoVehicle: true,
    cargoBedCapacityKg: 2500,
    comfortNote: 'Cabin 1 ghế phụ cho khách đi kèm + Thùng xe 1–3.5 tấn nhận xe máy, nông sản, chuyển trọ',
    overloadNotice: 'Xe tải chỉ nhận tối đa 1 người đi cùng ghế phụ (trừ ghế lái của Chủ xe) theo đăng kiểm'
  }
};

/**
 * 6 Nhóm thể tích gửi đồ tiện tuyến bản địa (Không cân đo kg / cm³ phức tạp - Cognitive Load = 0)
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
  },
  motorcycle: {
    id: 'motorcycle',
    name: 'Xe máy / Xe điện về quê',
    shortLabel: 'Xe máy / Xe điện',
    icon: 'Bike',
    emoji: '🛵',
    description: 'Gửi xe máy/xe điện (Wave, Vision, Exciter...) kèm chằng buộc cố định chống trầy xước',
    priceSuggestionText: '250.000đ – 450.000đ',
    basePrice: 320000,
    spaceRequired: 'Khoang thùng xe tải hoặc xe bán tải chằng buộc dây tăng đơ'
  },
  half_truck: {
    id: 'half_truck',
    name: 'Nửa thùng xe / Nông sản (vài tạ – 1 tấn)',
    shortLabel: 'Nửa thùng (~1 tấn)',
    icon: 'Truck',
    emoji: '🌾',
    description: '10–30 bao gạo, sầu riêng, mít, cây giống, phân bón, đồ dọn trọ khối lượng lớn',
    priceSuggestionText: '500.000đ – 900.000đ',
    basePrice: 650000,
    spaceRequired: 'Khoảng 50% khoang thùng xe tải tiện chuyến'
  },
  full_truck: {
    id: 'full_truck',
    name: 'Bao trọn thùng xe tải (Quay đầu rỗng)',
    shortLabel: 'Bao trọn thùng',
    icon: 'Truck',
    emoji: '🚛',
    description: 'Bao trọn khoang thùng xe tải nhẹ 1T–3.5T chạy quay đầu tiện chuyến',
    priceSuggestionText: '1.200.000đ – 2.500.000đ',
    basePrice: 1500000,
    spaceRequired: 'Toàn bộ thùng xe tải tiện chuyến'
  }
};

/**
 * Tính mức tiền phụ xăng gợi ý cho việc gửi đồ tiện chuyến
 * @param {string} cargoTypeId - 'compact_parcel' | 'produce_box' | 'bulky_cargo' | 'motorcycle' | 'half_truck' | 'full_truck'
 * @param {number} [distanceKm=120]
 * @returns {number}
 */
export function getRecommendedCargoPrice(cargoTypeId, distanceKm = 120) {
  const cargo = CARGO_TYPES[cargoTypeId] || CARGO_TYPES.compact_parcel;
  const dist = Number(distanceKm) > 0 ? Number(distanceKm) : 120;
  // Cự ly chuẩn 100km, dao động nhẹ theo quãng đường thực tế
  const factor = Math.max(0.8, Math.min(1.8, dist / 100));
  const calculated = Math.round((cargo.basePrice * factor) / 5000) * 5000;
  return calculated;
}

/**
 * Chuẩn hóa số ghế nhận khách theo dung tích xe
 * @param {number|string} capacity - 5, 7, 'pickup', hoặc 'truck_light'
 * @param {number|string} requestedSeats - Số ghế muốn nhận
 * @returns {{ capacity: number, seats: number, vehicleType: string, hasCargoBed: boolean, isCargoVehicle: boolean }}
 */
export function sanitizeVehicleCapacityAndSeats(capacity, requestedSeats) {
  const capStr = String(capacity || '').toLowerCase();
  let capKey = 5;
  if (capStr === 'truck_light' || capStr.includes('xe tải') || capStr.includes('tải nhẹ') || capStr.includes('k200') || capStr.includes('k250') || capStr.includes('porter') || capStr.includes('h150') || capStr.includes('qkr')) {
    capKey = 'truck_light';
  } else if (capStr === 'pickup' || capStr.includes('bán tải') || capStr.includes('ranger') || capStr.includes('hilux') || capStr.includes('triton')) {
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
    vehicleType: config.vehicleType || (capKey === 'truck_light' ? 'truck_light' : (capKey === 'pickup' ? 'pickup' : (capKey === 7 ? 'mpv_suv' : 'sedan_cuv'))),
    seats,
    hasCargoBed: Boolean(config.hasCargoBed),
    isCargoVehicle: Boolean(config.isCargoVehicle)
  };
}
