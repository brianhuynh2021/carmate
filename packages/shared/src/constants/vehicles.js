/**
 * Cấu hình quy chuẩn các dòng xe & giới hạn số ghế chở khách hợp pháp (Nghị định 100/2019/NĐ-CP)
 * - Xe 4–5 chỗ (Sedan/Hatchback/CUV): 1 tài xế + tối đa 4 khách (khuyên chọn 3 để êm ái hàng sau)
 * - Xe 7 chỗ (MPV/SUV): 1 tài xế + tối đa 6 khách (để trống 1 ghế lái)
 */
export const VEHICLE_SEAT_CONFIGS = {
  5: {
    capacity: 5,
    label: 'Xe 4–5 chỗ',
    subLabel: 'Sedan / CUV / Hatchback (Vios, Accent, City, CX-5...)',
    shortLabel: '5 chỗ',
    iconName: 'Car',
    maxPassengerSeats: 4,
    allowedSeats: [1, 2, 3, 4],
    recommendedSeats: 3,
    comfortNote: 'Tối đa 4 khách (Khuyên nhận 3 khách để hàng ghế sau ngồi thoải mái)',
    overloadNotice: 'Xe 5 chỗ chỉ được chở tối đa 4 khách (trừ 1 ghế tài xế) theo quy định an toàn giao thông'
  },
  7: {
    capacity: 7,
    label: 'Xe 7 chỗ',
    subLabel: 'MPV / SUV rộng rãi (Xpander, Veloz, Innova, SantaFe...)',
    shortLabel: '7 chỗ',
    iconName: 'Bus',
    maxPassengerSeats: 6,
    allowedSeats: [1, 2, 3, 4, 5, 6],
    recommendedSeats: 5,
    comfortNote: 'Tối đa 6 khách (Trừ 1 ghế tài xế, còn lại không gian để vali hành lý)',
    overloadNotice: 'Xe 7 chỗ chỉ được chở tối đa 6 khách (trừ 1 ghế tài xế) theo quy định an toàn giao thông'
  }
};

/**
 * Chuẩn hóa số ghế nhận khách theo dung tích xe
 * @param {number|string} capacity - 5 hoặc 7 chỗ
 * @param {number|string} requestedSeats - Số ghế muốn nhận
 * @returns {{ capacity: number, seats: number }}
 */
export function sanitizeVehicleCapacityAndSeats(capacity, requestedSeats) {
  const cap = Number(capacity) === 7 ? 7 : 5;
  const config = VEHICLE_SEAT_CONFIGS[cap];
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
  return { capacity: cap, seats };
}
