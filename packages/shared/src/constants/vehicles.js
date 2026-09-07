/**
 * Cấu hình quy chuẩn các dòng xe & giới hạn số ghế chở khách hợp pháp (Nghị định 100/2019/NĐ-CP)
 * - Xe 4–5 chỗ (Sedan/Hatchback/CUV): 1 Chủ xe cầm lái + tối đa 4 Người đi cùng (khuyên chọn 3 để êm ái hàng sau)
 * - Xe 7 chỗ (MPV/SUV): 1 Chủ xe cầm lái + tối đa 6 Người đi cùng (để trống 1 ghế lái)
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
    comfortNote: 'Tối đa 4 người đi cùng (Khuyên nhận 3 người để hàng ghế sau ngồi thoải mái)',
    overloadNotice: 'Xe 5 chỗ chỉ được nhận tối đa 4 người đi cùng (trừ 1 ghế lái của Chủ xe) theo quy chuẩn an toàn'
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
    comfortNote: 'Tối đa 6 người đi cùng (Trừ 1 ghế lái của Chủ xe, còn lại không gian để vali hành lý)',
    overloadNotice: 'Xe 7 chỗ chỉ được nhận tối đa 6 người đi cùng (trừ 1 ghế lái của Chủ xe) theo quy chuẩn an toàn'
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
