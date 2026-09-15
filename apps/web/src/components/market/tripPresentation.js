import { formatVND } from '@carmate/shared';

/** Only a price explicitly listed by the owner is a quote. Legacy formula prices are not. */
export function listedPrice(trip) {
  if (trip?.pricingMode !== 'listed') return null;
  const raw = trip.basePricePerSeat ?? trip.pricePerSeat;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function priceLabel(trip, seats = 1) {
  const price = listedPrice(trip);
  return price === null ? 'Liên hệ' : formatVND(price * seats);
}

export function publicContactPhone(trip) {
  // This field is emitted by the server only after the owner's publication consent.
  const value = String(trip?.publicContactPhone || '').replace(/[\s().-]/g, '');
  return /^\+?\d{9,15}$/.test(value) ? value : '';
}

export function pickupLabel(mode) {
  return ({ station: 'Đón tại trạm', doorstep: 'Có thể đón tận nơi', hybrid: 'Trạm hoặc điểm hẹn linh hoạt' })[mode] || 'Liên hệ để chốt điểm đón';
}

export function freshnessLabel(trip) {
  const raw = trip?.lastConfirmedAt || trip?.lastUpdatedAt || trip?.etaUpdatedAt || trip?.updatedAt || trip?.createdAt;
  if (!raw) return 'Chưa có thời điểm cập nhật';
  const time = new Date(raw);
  return Number.isNaN(time.getTime()) ? 'Chưa có thời điểm cập nhật' : `Cập nhật ${time.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
}

/** Preserve an explicitly searched range, including windows crossing midnight. */
export function parseIntentTimeWindow(value) {
  if (value === 'all' || !value) return { time: '00:00', durationMinutes: 1439 };
  const clocks = String(value).match(/\d{1,2}:\d{2}/g) || [];
  const minute = (clock) => {
    const [hour, minutes] = clock.split(':').map(Number);
    return hour >= 0 && hour < 24 && minutes >= 0 && minutes < 60 ? hour * 60 + minutes : NaN;
  };
  const start = clocks[0] ? minute(clocks[0]) : NaN;
  const end = clocks[1] ? minute(clocks[1]) : NaN;
  if (!Number.isFinite(start)) return { time: '06:00', durationMinutes: 30 };
  const format = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  return { time: format(start), durationMinutes: Number.isFinite(end) ? ((end - start + 1440) % 1440 || 30) : 30 };
}

/** Use Vietnam time and send a RANGE: a single departureTime would override it on the API. */
export function buildIntentTimeWindow(date, time, durationMinutes) {
  const [hour, minute] = String(time).split(':').map(Number);
  const duration = Number(durationMinutes);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59 || !Number.isInteger(duration) || duration < 1 || duration >= 1440) return null;
  const start = Date.parse(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`);
  if (!Number.isFinite(start)) return null;
  const endMinutes = (hour * 60 + minute + duration) % 1440;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  return { timeSlot: `${time}-${endTime}`, departureAt: new Date(start).toISOString(), expiresAt: new Date(start + duration * 60000).toISOString() };
}

export function departureChipTimeRange(chip) {
  if (!chip) return 'all';
  if (/\d{1,2}:\d{2}\s*[-–]/.test(chip.timeSlot || '')) return chip.timeSlot;
  const start = chip.timeSlot || (Number.isFinite(chip.fromHour) ? `${String(chip.fromHour % 24).padStart(2, '0')}:00` : null);
  return start && Number.isFinite(chip.toHour) ? `${start}-${String(chip.toHour % 24).padStart(2, '0')}:00` : start || 'all';
}

/** Preserve the matrix's dated pickup window; never replace it with a 30-minute guess. */
export function bookingPickupWindow(trip) {
  const start = trip?.pickupStartAt == null ? NaN : new Date(trip.pickupStartAt).getTime();
  const end = trip?.pickupEndAt == null ? NaN : new Date(trip.pickupEndAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return {};
  const clock = (value) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  return { pickupStartAt: new Date(start).toISOString(), pickupEndAt: new Date(end).toISOString(), timeSlot: `${clock(start)}-${clock(end)}` };
}
