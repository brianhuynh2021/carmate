import { cleanPhoneNumber, getStationStationKm } from '@carmate/shared';

export function dateTimeInput(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
export function evidenceDate(value, label) {
  if (!value) return null;
  const date = new Date(`${value}+07:00`);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} không hợp lệ.`);
  return date.toISOString();
}
export function operatorDraft(profile = {}) {
  return { name: profile.name || '', kind: profile.kind || 'business', contactPhone: profile.contactPhone || '', corridor: profile.corridor || '',
    coverageText: (profile.coverage || []).join('\n'), scheduleNote: profile.scheduleNote || '', pricingMode: profile.pricingMode || 'contact', priceNote: profile.priceNote || '', pickupNote: profile.pickupNote || '',
    sourceKind: profile.source?.kind || 'other', sourceUrl: profile.source?.url || '', sourceLabel: profile.source?.label || '',
    checkedAt: dateTimeInput(profile.checkedAt), freshUntil: dateTimeInput(profile.freshUntil), status: profile.status || 'draft', contactPublicationBasis: profile.contactPublicationBasis || '', authorizationNote: profile.authorizationNote || '' };
}
export function buildOperatorPayload(draft, now = Date.now()) {
  const checkedAt = evidenceDate(draft.checkedAt, 'Thời điểm kiểm tra'), freshUntil = evidenceDate(draft.freshUntil, 'Hạn kiểm tra lại');
  const source = { kind: draft.sourceKind, url: draft.sourceUrl.trim(), label: draft.sourceLabel.trim() };
  if (!draft.name.trim()) throw new Error('Nhập tên hồ sơ.');
  if (source.url) {
    let url; try { url = new URL(source.url); } catch { throw new Error('Đường dẫn nguồn không hợp lệ.'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Nguồn phải là HTTP(S) và không chứa tài khoản đăng nhập.');
  }
  if (checkedAt && Date.parse(checkedAt) > now) throw new Error('Thời điểm đã kiểm tra không được ở tương lai.');
  if (freshUntil && (!checkedAt || Date.parse(freshUntil) <= Date.parse(checkedAt))) throw new Error('Hạn kiểm tra lại phải sau thời điểm đã kiểm tra.');
  if (draft.status === 'published') {
    if (!draft.contactPhone.trim() || !source.label || source.kind === 'legacy_directory') throw new Error('Cần liên hệ và nguồn đã được kiểm tra trước khi công khai.');
    if (!checkedAt || !freshUntil || !draft.contactPublicationBasis || draft.authorizationNote.trim().length < 10) throw new Error('Công khai cần ngày kiểm tra, hạn kiểm tra lại và ghi chú bằng chứng cho phép công khai liên hệ (ít nhất 10 ký tự).');
    if (draft.kind === 'individual' && draft.contactPublicationBasis !== 'owner_consent') throw new Error('Số cá nhân cần bằng chứng chủ số đồng ý.');
    if (draft.contactPublicationBasis === 'official_business_source' && (draft.kind !== 'business' || !['website', 'facebook'].includes(source.kind) || !source.url)) throw new Error('Nguồn chính thức cần website/Facebook của nhà xe và đường dẫn cụ thể.');
  }
  return { name: draft.name.trim(), kind: draft.kind, contactPhone: draft.contactPhone.trim(), corridor: draft.corridor.trim(), coverage: [...new Set(draft.coverageText.split('\n').map(value => value.trim()).filter(Boolean))], scheduleNote: draft.scheduleNote.trim(), pricingMode: draft.pricingMode, priceNote: draft.priceNote.trim(), pickupNote: draft.pickupNote.trim(), source, checkedAt, freshUntil, status: draft.status, contactPublicationBasis: draft.contactPublicationBasis || null, authorizationNote: draft.authorizationNote.trim() };
}
export function buildClaimReview(draft, claim, profile, now = Date.now()) {
  if (!draft.resolutionNote.trim()) throw new Error('Ghi kết luận hoặc lý do từ chối.');
  const result = { status: draft.status, resolutionNote: draft.resolutionNote.trim() };
  if (draft.status === 'approved') {
    if (!profile || !draft.checked || !draft.channel || draft.authorityNote.trim().length < 10) throw new Error('Cần đối chiếu qua liên hệ độc lập, kênh xác nhận và bằng chứng quyền đại diện.');
    const reviewedAt = evidenceDate(draft.reviewedAt, 'Thời điểm kiểm tra quyền');
    if (!reviewedAt || Date.parse(reviewedAt) < Date.parse(claim.createdAt) || Date.parse(reviewedAt) > now) throw new Error('Thời điểm kiểm tra phải sau khi nhận yêu cầu và không ở tương lai.');
    result.evidence = { knownContactPhone: profile.contactPhone, channel: draft.channel, reviewedAt, authorityNote: draft.authorityNote.trim() };
  }
  return result;
}
export function buildAssistedTrip(draft, profile, hubs, now = Date.now()) {
  if (!profile.ownerUserId || profile.status !== 'published') throw new Error('Cần hồ sơ đã công khai và được duyệt người quản lý.');
  const origin = hubs.find(hub => hub.id === draft.originHubId), destination = hubs.find(hub => hub.id === draft.destinationHubId);
  if (!origin || !destination || origin.id === destination.id) throw new Error('Chọn điểm đi và điểm đến khác nhau.');
  const departure = Date.parse(`${draft.date}T${draft.time}:00+07:00`);
  if (!Number.isFinite(departure) || departure <= now) throw new Error('Chọn ngày giờ chạy còn ở tương lai.');
  const capacity = Number(draft.capacity), availableSeats = Number(draft.availableSeats);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 55 || !Number.isInteger(availableSeats) || availableSeats < 1 || availableSeats >= capacity) throw new Error('Xe từ 2–55 chỗ gồm người lái; số chỗ nhận khách phải nhỏ hơn sức chứa.');
  if (!draft.carType.trim() || !draft.licensePlate.trim()) throw new Error('Nhập xe và biển số thực tế của chuyến.');
  const basePricePerSeat = draft.pricingMode === 'contact' ? null : Number(draft.basePricePerSeat);
  if (draft.pricingMode === 'listed' && (draft.basePricePerSeat === '' || !Number.isSafeInteger(basePricePerSeat) || basePricePerSeat < 0)) throw new Error('Nhập giá niêm yết nguyên không âm hoặc chọn Liên hệ.');
  const maxDetourKm = draft.pickupMode === 'station' ? 0 : Number(draft.maxDetourKm);
  if (!Number.isFinite(maxDetourKm) || maxDetourKm < 0 || maxDetourKm > 50) throw new Error('Khoảng đi thêm phải từ 0–50 km.');
  const approvedAt = evidenceDate(draft.approvedAt, 'Thời điểm chủ xe chấp thuận');
  if (!draft.approved || !draft.publicContactConsent || !draft.channel || !approvedAt || Date.parse(approvedAt) > now + 60000 || Date.parse(approvedAt) < now - 7 * 86400000 || draft.evidenceNote.trim().length < 10) throw new Error('Cần sự đồng ý cho chính chuyến này và số liên hệ công khai, kênh, thời điểm trong 7 ngày qua và bằng chứng ít nhất 10 ký tự.');
  const fromKm = getStationStationKm(origin.id), toKm = getStationStationKm(destination.id);
  const trip = { from: origin.shortName || origin.name, to: destination.shortName || destination.name, originHubId: origin.id, destinationHubId: destination.id,
    date: draft.date, time: draft.time, timeSlot: draft.time, capacity, availableSeats, carType: draft.carType.trim(), licensePlate: draft.licensePlate.trim(), phoneReal: cleanPhoneNumber(profile.contactPhone),
    pricingMode: draft.pricingMode, basePricePerSeat, pickupMode: draft.pickupMode, maxDetourKm, pickupNotes: draft.pickupNotes.trim(), publicContactConsent: true };
  if (fromKm != null && toKm != null) trip.direction = toKm > fromKm ? 'binh_phuoc_to_tphcm' : 'tphcm_to_binh_phuoc';
  return { trip, authorization: { approved: true, channel: draft.channel, approvedAt, evidenceNote: draft.evidenceNote.trim(), knownContactPhone: profile.contactPhone } };
}
