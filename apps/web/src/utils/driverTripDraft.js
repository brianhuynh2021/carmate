import { normalizePhoneNumber, isValidVietnamesePhone } from '@carmate/shared';

export function vietnamDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
}

// Guest previews reveal route compatibility only; no contact or vehicle identity is sent.
export function buildDriverDemandPreview(draft) {
  return {
    originHubId: draft.originHubId, destinationHubId: draft.destinationHubId,
    direction: draft.direction, routeCategory: 'Tuyến QL13',
    date: draft.date, time: draft.time, timeSlot: draft.time,
    availableSeats: Number(draft.availableSeats), capacity: Number(draft.capacity),
    pricingMode: draft.pricingMode === 'listed' ? 'listed' : 'contact',
    basePricePerSeat: draft.pricingMode === 'listed' ? Number(draft.basePricePerSeat) : null,
    pickupMode: draft.pickupMode,
    maxDetourKm: draft.pickupMode === 'station' ? 0 : Number(draft.maxDetourKm)
  };
}

export function buildDriverTripPayload(draft, user, hubs, now = new Date()) {
  if (!user?.id) throw new Error('Đăng nhập để đăng và quản lý chuyến của bạn.');
  const origin = hubs.find((hub) => hub.id === draft.originHubId);
  const destination = hubs.find((hub) => hub.id === draft.destinationHubId);
  if (!origin || !destination || origin.id === destination.id) throw new Error('Chọn hai điểm đi và đến khác nhau.');
  const departure = new Date(`${draft.date}T${draft.time}:00+07:00`);
  if (!Number.isFinite(departure.getTime()) || departure < now) throw new Error('Chọn giờ khởi hành trong tương lai.');
  const capacity = Number(draft.capacity);
  const seats = Number(draft.availableSeats);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 55 || !Number.isInteger(seats) || seats < 1 || seats >= capacity) {
    throw new Error('Số chỗ nhận khách phải ít hơn tổng số chỗ của xe.');
  }
  const phone = normalizePhoneNumber(draft.phoneReal || user.phone || '');
  if (!isValidVietnamesePhone(phone)) throw new Error('Nhập số điện thoại liên hệ hợp lệ trước khi đăng.');
  if (!draft.publicContactConsent) throw new Error('Xác nhận cho phép khách xem số liên hệ trên tin chuyến.');
  if (!draft.carType?.trim() || !draft.licensePlate?.trim()) throw new Error('Nhập dòng xe và biển số thật trước khi đăng.');
  const pricingMode = draft.pricingMode === 'listed' ? 'listed' : 'contact';
  const price = pricingMode === 'listed' ? Number(draft.basePricePerSeat) : null;
  if (pricingMode === 'listed' && (draft.basePricePerSeat === '' || !Number.isFinite(price) || price < 0)) {
    throw new Error('Nhập giá niêm yết hợp lệ hoặc chọn Liên hệ.');
  }
  const pickupMode = ['station', 'doorstep', 'hybrid'].includes(draft.pickupMode) ? draft.pickupMode : 'hybrid';
  const maxDetourKm = pickupMode === 'station' ? 0 : Number(draft.maxDetourKm);
  if (!Number.isFinite(maxDetourKm) || maxDetourKm < 0) throw new Error('Khoảng đi vòng tối đa phải là số từ 0 trở lên.');
  return {
    type: 'driver_offer', userId: user.id, publicName: user.name || 'Chủ xe',
    ...(draft.operatorId ? { operatorId: draft.operatorId } : {}),
    from: origin.shortName || origin.name, to: destination.shortName || destination.name,
    originHubId: origin.id, destinationHubId: destination.id,
    date: draft.date, time: draft.time, timeSlot: draft.time,
    direction: draft.direction, routeCategory: 'Tuyến QL13',
    capacity, availableSeats: seats, pricingMode, basePricePerSeat: price,
    pickupMode, maxDetourKm, pickupNotes: (draft.pickupNotes || '').trim(),
    notes: (draft.pickupNotes || '').trim(), phoneReal: phone, publicContactConsent: true,
    carType: draft.carType.trim(), licensePlate: draft.licensePlate.trim(), status: 'active'
  };
}

export function createAuthContinuation() {
  let action = null;
  return {
    set(next) { action = typeof next === 'function' ? next : null; },
    take() { const next = action; action = null; return next; },
    clear() { action = null; }
  };
}
