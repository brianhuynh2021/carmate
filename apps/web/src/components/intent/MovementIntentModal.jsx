import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowUpDown, Loader2, CheckCircle2 } from 'lucide-react';
import { VIRTUAL_HUBS, getDefaultCorridor, getEndpointHubs, toLocalIsoDate, cleanPhoneNumber, isValidVietnamesePhone } from '@carmate/shared';
import api from '../../api/client.js';
import { parseIntentTimeWindow, buildIntentTimeWindow } from '../market/tripPresentation.js';

const corridor = getDefaultCorridor();
export const SAIGON_HUB_IDS = getEndpointHubs(corridor.id, 'a').map((h) => h.id);
export const BINH_PHUOC_HUB_IDS = getEndpointHubs(corridor.id, 'b').map((h) => h.id);
const allHubs = VIRTUAL_HUBS.filter((h) => [...SAIGON_HUB_IDS, ...BINH_PHUOC_HUB_IDS].includes(h.id));

export default function MovementIntentModal({ isOpen, onClose, initialRole = 'passenger', initialOriginHubId, initialDestHubId, initialDate, initialTimeSlot, initialSeats = 1, currentUser, onSuccess, onShowToast, onRequireAuth, requestMode = 'intent', onCreateRequest }) {
  // The modal stays mounted while authentication is open. Auth never resets this draft.
  const [originHubId, setOriginHubId] = useState(initialOriginHubId || 'hub_ql13_tan_khai');
  const [destinationHubId, setDestinationHubId] = useState(initialDestHubId || 'hub_ql13_hang_xanh');
  const [date, setDate] = useState(initialDate || toLocalIsoDate(new Date(Date.now() + 86400000)));
  const [time, setTime] = useState(() => parseIntentTimeWindow(initialTimeSlot).time);
  const [toleranceMinutes, setToleranceMinutes] = useState(() => parseIntentTimeWindow(initialTimeSlot).durationMinutes);
  const [seats, setSeats] = useState(initialSeats);
  const [pickupMode, setPickupMode] = useState('station');
  const [pickupNotes, setPickupNotes] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [name, setName] = useState(currentUser?.name || '');
  const [publicContactConsent, setPublicContactConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  if (!isOpen || typeof document === 'undefined') return null;
  const isStationRequest = requestMode === 'station';
  const origin = allHubs.find((h) => h.id === originHubId);
  const destination = allHubs.find((h) => h.id === destinationHubId);
  const window = buildIntentTimeWindow(date, time, toleranceMinutes);
  const expiry = new Date(window?.expiresAt || NaN);
  const durationOptions = [...new Set([15, 30, 60, 120, toleranceMinutes])].sort((a, b) => a - b);
  const close = () => { if (submitted) onSuccess?.(submitted); onClose?.(); };
  const publish = async (user) => {
    if (!user || submitting.current) return;
    const contactPhone = cleanPhoneNumber(phone || user.phone || '');
    if (!isValidVietnamesePhone(contactPhone)) { setError('Vui lòng nhập số điện thoại liên hệ hợp lệ.'); return; }
    if (!origin || !destination || originHubId === destinationHubId) { setError('Chọn điểm đi và điểm đến khác nhau.'); return; }
    if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) { setError('Chọn thời gian tìm xe còn hiệu lực.'); return; }
    if (pickupMode !== 'station' && !pickupNotes.trim()) { setError('Nhập điểm muốn đón để chủ xe xem có thể ghé hay không.'); return; }
    if (isStationRequest && pickupMode !== 'station' && !pickupCoords) { setError('Chọn vị trí hiện tại để xe tính đường ghé đón, hoặc đổi sang đón tại trạm.'); return; }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const payload = {
        role: initialRole, originHubId, destinationHubId,
        originName: origin.shortName || origin.name, destinationName: destination.shortName || destination.name,
        corridor: corridor.dataKey, date, timeSlot: window.timeSlot,
        departureAt: window.departureAt, expiresAt: window.expiresAt, toleranceMinutes, publishDemandConsent: true,
        seats, pickupMode, pickupNotes: pickupNotes.trim(), phone: contactPhone,
        ...(pickupCoords ? { clientLat: pickupCoords.lat, clientLng: pickupCoords.lng, doorstepLat: pickupCoords.lat, doorstepLng: pickupCoords.lng } : {}),
        contactName: name.trim() || user.name || 'Khách', publicContactConsent,
        pricingMode: 'contact', isRecurring: false, recurringDays: []
      };
      const result = onCreateRequest ? await onCreateRequest(payload, user) : await api.createMovementIntent(payload);
      if (!result?.success || !result.data) throw new Error('Chưa lưu được nhu cầu. Vui lòng thử lại.');
      setSubmitted(result.data);
      onShowToast?.(isStationRequest ? 'Đã lưu yêu cầu đón. Chưa có chủ xe nhận đón.' : 'Đã đăng nhu cầu. Chưa có xe nhận đón.');
    } catch (err) { setError(err.message || 'Chưa đăng được nhu cầu.'); }
    finally { submitting.current = false; setBusy(false); }
  };
  const chooseCurrentLocation = () => {
    if (!navigator.geolocation) { setError('Thiết bị chưa hỗ trợ lấy vị trí. Bạn có thể chọn đón tại trạm.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition((position) => {
      setPickupCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setPickupNotes((value) => value.trim() || 'Vị trí hiện tại của tôi');
      setLocating(false);
    }, () => { setLocating(false); setError('Chưa lấy được vị trí. Cho phép định vị hoặc chọn đón tại trạm.'); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };
  const submit = (event) => {
    event.preventDefault();
    if (!currentUser) {
      onRequireAuth?.({ title: isStationRequest ? 'Đăng nhập để yêu cầu đón' : 'Đăng nhập để đăng nhu cầu', subtitle: 'Giữ nguyên nơi đi, giờ và số người bạn đã chọn.', contextNotice: 'Chỉ nhu cầu bạn chủ động gửi mới được đăng.', onSuccess: publish });
      return;
    }
    publish(currentUser);
  };
  const inputClass = 'type-input w-full mt-1 p-3 rounded-xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/15';
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="movement-intent-title">
      <section className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-[#DFE5EC] dark:bg-[#0b0f19] rounded-3xl p-5 text-slate-900 dark:text-white">
        <header className="flex justify-between items-center mb-3"><h2 id="movement-intent-title" className="type-title">{submitted ? 'Nhu cầu đã được lưu' : isStationRequest ? 'Yêu cầu xe đón' : 'Đăng nhu cầu tìm xe'}</h2><button onClick={close} type="button" className="type-button p-3" aria-label="Đóng"><X className="w-5 h-5" /></button></header>
        {submitted ? <div className="space-y-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          <p className="type-body">{submitted.originName} → {submitted.destinationName}</p>
          <p className="type-body">{submitted.date || date} · {submitted.timeSlot || window?.timeSlot || time} · {submitted.seats || submitted.seatsNeeded || seats} người</p>
          <p className="type-body">Đang tìm chủ xe phù hợp. Chưa có xe nhận đón; bạn chưa cần ra trạm. Nhu cầu tự hết hiệu lực lúc {new Date(submitted.expiresAt || submitted.originalDeadlineAt || expiry).toLocaleString('vi-VN')}.</p>
          <button onClick={close} type="button" className="type-button w-full p-3 rounded-xl bg-[#0071e3] text-white">{isStationRequest ? 'Theo dõi yêu cầu đón' : 'Xem nhu cầu của tôi'}</button>
        </div> : <form onSubmit={submit} className="space-y-4">
          <p className="type-body text-slate-600 dark:text-slate-300">{isStationRequest ? 'Gửi yêu cầu đón để xe đang đi qua hành lang có thể đề nghị nhận bạn. Yêu cầu này chưa phải cuộc hẹn; chỉ ra điểm đón sau khi hai bên xác nhận.' : 'Đăng tuyến, khung giờ và số người dưới bí danh để chủ xe phù hợp tìm thấy. Số điện thoại chỉ công khai nếu bạn chọn cho phép bên dưới.'}</p>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
            <label className="type-label">Trạm gần điểm đi<select value={originHubId} onChange={(e) => setOriginHubId(e.target.value)} className={inputClass}>{allHubs.map((h) => <option key={h.id} value={h.id}>{h.shortName || h.name}</option>)}</select></label>
            <button type="button" aria-label="Đảo chiều" className="type-button p-3 mb-1" onClick={() => { setOriginHubId(destinationHubId); setDestinationHubId(originHubId); }}><ArrowUpDown className="w-4 h-4" /></button>
            <label className="type-label">Trạm gần điểm đến<select value={destinationHubId} onChange={(e) => setDestinationHubId(e.target.value)} className={inputClass}>{allHubs.map((h) => <option key={h.id} value={h.id}>{h.shortName || h.name}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3"><label className="type-label">Ngày đi<input className={inputClass} type="date" value={date} min={toLocalIsoDate(new Date())} onChange={(e) => setDate(e.target.value)} required /></label><label className="type-label">Có thể đón từ<input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></label></div>
          <div className="grid grid-cols-2 gap-3"><label className="type-label">Số người<select className={inputClass} value={seats} onChange={(e) => setSeats(Number(e.target.value))}>{[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n} người</option>)}</select></label><label className="type-label">Khoảng thời gian có thể đón<select className={inputClass} value={toleranceMinutes} onChange={(e) => setToleranceMinutes(Number(e.target.value))}>{durationOptions.map((n) => <option key={n} value={n}>{n === 1439 && time === '00:00' ? 'Cả ngày, đến 23:59' : `${n} phút`}</option>)}</select></label></div>
          <p className="type-caption text-slate-500">Nhu cầu hết hiệu lực lúc {Number.isFinite(expiry.getTime()) ? expiry.toLocaleString('vi-VN') : '—'}. Không có cam kết chủ xe sẽ phản hồi trước thời điểm này.</p>
          <label className="type-label block">Cách muốn đón<select className={inputClass} value={pickupMode} onChange={(e) => { setPickupMode(e.target.value); setPickupCoords(null); }}><option value="station">Tại trạm đã chọn</option><option value="hybrid">Trạm hoặc điểm hẹn gần đó</option><option value="doorstep">Đề nghị đón tận nơi</option></select></label>
          {pickupMode !== 'station' && <label className="type-label block">Điểm muốn đón<input className={inputClass} value={pickupNotes} onChange={(e) => { setPickupNotes(e.target.value); setPickupCoords(null); }} maxLength={300} placeholder="Tên đường, địa điểm dễ nhận biết" required /><span className="text-slate-500">Chủ xe cần đồng ý trước. Không ghi thông tin riêng tư không cần thiết.</span></label>}
          {isStationRequest && pickupMode !== 'station' && <div className="p-3 rounded-xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/15 space-y-2"><button type="button" disabled={locating} onClick={chooseCurrentLocation} className="type-button p-2 text-[#0071e3] disabled:opacity-50">{locating ? 'Đang lấy vị trí…' : pickupCoords ? 'Lấy lại vị trí hiện tại' : 'Dùng vị trí hiện tại làm điểm đón'}</button><p className="type-caption text-slate-500">{pickupCoords ? 'Đã chọn vị trí hiện tại. Xe sẽ tính đường ghé điểm này; chủ xe vẫn cần đồng ý.' : 'Đứng tại điểm muốn được đón rồi chọn vị trí. Nếu hẹn ở nơi khác, bạn có thể đăng nhu cầu và liên hệ chủ xe để chốt.'}</p></div>}
          <section><h3 className="type-heading">Thông tin liên hệ riêng</h3><div className="grid grid-cols-2 gap-3 mt-2"><label className="type-label">Tên<input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label><label className="type-label">Số điện thoại<input className={inputClass} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={currentUser?.phone ? 'Dùng số đăng nhập nếu bỏ trống' : 'Nhập số điện thoại để chủ xe liên hệ'} required={Boolean(currentUser && !currentUser.phone)} /></label></div><p className="type-caption text-slate-500 mt-2">{isStationRequest ? 'Thông tin liên hệ đi cùng yêu cầu đón này, không đăng công khai thành tin tìm xe.' : 'Tên và số này phục vụ liên hệ. Chỉ chọn công khai bên dưới nếu bạn muốn người xem nhu cầu gọi trực tiếp.'}</p></section>
          {!isStationRequest && <label className="type-label flex items-start gap-2"><input type="checkbox" checked={publicContactConsent} onChange={(e) => setPublicContactConsent(e.target.checked)} className="type-input mt-1" /><span>Tôi đồng ý công khai số điện thoại cùng nhu cầu để chủ xe liên hệ trực tiếp. Có thể bỏ chọn và trao đổi qua CarMate.</span></label>}
          <p className="type-caption text-slate-500">CarMate kết nối miễn phí. Giá và điểm đón cuối cùng do hai bên chốt.</p>
          {error && <p role="alert" className="type-body text-rose-700 dark:text-rose-300">{error}</p>}
          <button type="submit" disabled={busy} className="type-button w-full rounded-xl p-3 bg-[#0071e3] text-white disabled:opacity-50 flex justify-center items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? 'Đang gửi…' : isStationRequest ? 'Gửi yêu cầu đón' : 'Đăng nhu cầu tìm xe'}</button>
        </form>}
      </section>
    </div>, document.body
  );
}
