// Shared terms for public search, an active request and a confirmed appointment.
// A forecast or recommendation never constitutes either party's acceptance.
export const PICKUP_MODES = ['station', 'doorstep', 'hybrid'];

export function normalizeConnectionTerms(input = {}) {
  const raw = input.basePricePerSeat ?? input.pricePerSeat ?? input.price;
  const pricingMode = input.pricingMode || (raw == null || raw === '' ? 'contact' : 'listed');
  if (!['listed', 'contact'].includes(pricingMode)) throw new Error('Cách hiển thị giá không hợp lệ.');
  const price = pricingMode === 'contact' ? null : Number(raw);
  if (pricingMode === 'listed' && (raw == null || raw === '' || !Number.isSafeInteger(price) || price < 0)) {
    throw new Error('Giá niêm yết phải là số tiền nguyên không âm.');
  }
  const pickupMode = input.pickupMode || (input.isDoorstep ? 'doorstep' : 'station');
  if (!PICKUP_MODES.includes(pickupMode)) throw new Error('Cách đón không hợp lệ.');
  const maxDetourKm = pickupMode === 'station' ? 0 : Number(input.maxDetourKm ?? 0);
  if (!Number.isFinite(maxDetourKm) || maxDetourKm < 0 || maxDetourKm > 50) {
    throw new Error('Quãng đường có thể đi thêm phải từ 0 đến 50 km.');
  }
  return {
    pricingMode,
    basePricePerSeat: price,
    pricePerSeat: price,
    pickupMode,
    maxDetourKm,
    pickupNotes: String(input.pickupNotes ?? input.pickupNote ?? '').trim().slice(0, 500),
    publicContactConsent: input.publicContactConsent === true
  };
}

export function normalizeTravelDate(value, nowMs = Date.now()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(nowMs));
  if (!value || value === 'Hôm nay' || value === 'today') return today;
  if (['Ngày mai', 'Sáng mai', 'Mai', 'tomorrow'].includes(value)) {
    return normalizeTravelDate(null, nowMs + 86400000);
  }
  const date = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00+07:00`);
  return Number.isFinite(parsed.getTime()) && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(parsed) === date ? date : null;
}

export function getTravelWindow({ date, timeSlot, time, departureTime } = {}, nowMs = Date.now()) {
  const day = normalizeTravelDate(date, nowMs);
  if (!day) return null;
  const midnight = Date.parse(`${day}T00:00:00+07:00`);
  const value = departureTime || timeSlot || time || 'all';
  if (value === 'all') return { start: midnight, end: midnight + 86400000 - 1, date: day };
  const clocks = String(value).match(/\d{1,2}:\d{2}/g) || [];
  const minutes = clocks.map(clock => {
    const [h, m] = clock.split(':').map(Number);
    return h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : NaN;
  });
  if (!minutes.length || minutes.some(n => !Number.isFinite(n))) return null;
  const start = midnight + minutes[0] * 60000;
  let end = minutes.length > 1 ? midnight + minutes[1] * 60000 : start + 30 * 60000;
  if (end < start) end += 86400000;
  return { start, end, date: day };
}

export function requestDeadline(input, nowMs = Date.now()) {
  const window = getTravelWindow(input, nowMs);
  if (!window) throw new Error('Ngày hoặc khung giờ không hợp lệ.');
  const raw = input.expiresAt ?? input.originalDeadlineAt;
  const supplied = raw == null || raw === '' ? window.end : (typeof raw === 'number' ? raw : Date.parse(raw));
  const deadline = Math.min(supplied, window.end);
  if (!Number.isFinite(deadline) || deadline <= nowMs) throw new Error('Thời hạn tìm xe phải ở tương lai và trong khung giờ đã chọn.');
  return deadline;
}

export function connectionPriceLabel(trip, seats = 1) {
  if (trip?.pricingMode === 'contact') return 'Liên hệ';
  const raw = trip?.basePricePerSeat ?? trip?.pricePerSeat ?? trip?.price;
  if (raw == null || raw === '' || !Number.isFinite(Number(raw))) return 'Liên hệ';
  return `${(Number(raw) * seats).toLocaleString('vi-VN')}đ`;
}
