import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, Loader2, Phone } from 'lucide-react';
import { VIRTUAL_HUBS, getDefaultCorridor, toLocalIsoDate } from '@carmate/shared';
import api from '../../api/client.js';
import CorridorTripCard from '../market/CorridorTripCard.jsx';
import TripDetailBottomSheet from '../market/TripDetailBottomSheet.jsx';
import InstantBookingModal from '../modals/InstantBookingModal.jsx';
import MovementIntentModal from '../intent/MovementIntentModal.jsx';

function savedPassId() {
  try { return JSON.parse(localStorage.getItem('carmate_active_station_pass') || 'null')?.intentId || null; }
  catch { return null; }
}
const STATUS = { WAITING: 'Đang tìm xe', OFFERED: 'Có đề nghị đón — cần bạn xác nhận', ARRIVING: 'Hai bên đã xác nhận đón', BOARDED: 'Đã lên xe', COMPLETED: 'Đã hoàn tất', CANCELLED: 'Đã hủy', EXPIRED: 'Nhu cầu đã hết hạn' };

export default function StationRiderView({ hubId = 'hub_ql13_tan_khai', initialDestinationHubId, currentUser, onBack, onShowToast, onViewBookedTab, onBookingCreated, onRequireAuth }) {
  const [from, setFrom] = useState(hubId);
  const [to, setTo] = useState(initialDestinationHubId || (hubId === 'hub_ql13_hang_xanh' ? 'hub_ql13_tan_khai' : 'hub_ql13_hang_xanh'));
  const [date, setDate] = useState(toLocalIsoDate(new Date()));
  const [time, setTime] = useState('');
  const [seats, setSeats] = useState(1);
  const [matrix, setMatrix] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const searchSequence = useRef(0);
  const [selected, setSelected] = useState(null);
  const [enquiry, setEnquiry] = useState(null);
  const [showIntent, setShowIntent] = useState(false);
  const [showStationRequest, setShowStationRequest] = useState(false);
  const [passId, setPassId] = useState(savedPassId);
  const [pass, setPass] = useState(null);
  const [passError, setPassError] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const origin = VIRTUAL_HUBS.find((h) => h.id === from);
  const destination = VIRTUAL_HUBS.find((h) => h.id === to);
  const trips = (matrix?.slots || []).filter((slot) => slot.tier !== 'SHADOW' && (slot.tripId || slot.id));

  useEffect(() => { searchSequence.current += 1; setMatrix(null); setBusy(false); }, [from, to, date, time, seats]);
  const search = async () => {
    if (!from || !to || from === to) { setError('Chọn hai trạm khác nhau.'); return; }
    const sequence = ++searchSequence.current;
    setBusy(true); setError('');
    try {
      const result = await api.getTimeSlotMatrix({ from, to, date, timeSlot: time || 'all', seats, corridor: getDefaultCorridor().dataKey });
      if (sequence !== searchSequence.current) return;
      if (!result?.success) throw new Error('Chưa tải được kết quả.');
      setMatrix(result);
    } catch (err) { if (sequence === searchSequence.current) { setMatrix(null); setError(err.message || 'Chưa tải được kết quả.'); } }
    finally { if (sequence === searchSequence.current) setBusy(false); }
  };
  const refreshPass = useCallback(async () => {
    if (!currentUser || !passId) return;
    try {
      const result = await api.getRiderPass(passId);
      if (!result?.success || !result.intent) throw new Error('Chưa xác minh được lịch đón.');
      const updated = { ...result.intent, intentId: result.intent.intentId || passId };
      setPass(updated); setPassError('');
      try { localStorage.setItem('carmate_active_station_pass', JSON.stringify({ intentId: passId, hubId: updated.hubId || from, pass: updated, savedAt: Date.now() })); } catch { /* optional device cache */ }
    } catch (err) { setPassError(err.message || 'Chưa cập nhật được trạng thái đón.'); }
  }, [currentUser, passId, from]);
  useEffect(() => { setPass(null); }, [currentUser?.id]);
  useEffect(() => {
    if (!currentUser) { setPass(null); return; }
    refreshPass();
    const timer = setInterval(refreshPass, 10000);
    return () => clearInterval(timer);
  }, [currentUser, refreshPass]);
  useEffect(() => {
    const sync = (event) => { if (event.key === 'carmate_active_station_pass') setPassId(savedPassId()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const createStationRequest = async (draft) => {
    const result = await api.stationCheckIn(draft.originHubId, {
      destinationHubId: draft.destinationHubId, seatsNeeded: draft.seats, phone: draft.phone, name: draft.contactName,
      date: draft.date, timeSlot: draft.timeSlot, pickupStartAt: draft.departureAt, pickupEndAt: draft.expiresAt,
      pickupMode: draft.pickupMode,
      pickupPoint: draft.pickupMode === 'station' ? draft.originName : draft.pickupNotes,
      pickupNotes: draft.pickupNotes, clientLat: draft.clientLat ?? null, clientLng: draft.clientLng ?? null
    });
    if (!result?.success || !result.intent?.intentId) throw new Error(result?.error || 'Chưa lưu được yêu cầu đón.');
    const saved = result.intent;
    setPassId(saved.intentId); setPass(saved); setPassError('');
    try { localStorage.setItem('carmate_active_station_pass', JSON.stringify({ intentId: saved.intentId, hubId: saved.hubId, pass: saved, savedAt: Date.now() })); } catch { /* optional recovery cache */ }
    return { success: true, data: { ...saved, originName: saved.hubName, destinationName: saved.destinationName,
      date: saved.pickupStartAt ? new Date(saved.pickupStartAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) : draft.date,
      timeSlot: saved.pickupStartAt ? new Date(saved.pickupStartAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : draft.timeSlot,
      expiresAt: saved.originalDeadlineAt } };
  };
  const updatePass = async (action) => {
    if (passBusy || !pass) return;
    setPassBusy(true); setPassError('');
    try {
      const result = action === 'accept'
        ? await api.riderAcceptStationOffer({ intentId: passId, proposalVersion: pass.proposalVersion })
        : await api.cancelStationRequest({ intentId: passId, action: action === 'replace' ? 'find_another' : 'stop', reason: 'Khách chủ động thay đổi yêu cầu đón' });
      if (!result?.success) throw new Error(result?.message || 'Chưa cập nhật được yêu cầu.');
      setConfirmCancel(false);
      await refreshPass();
      onShowToast?.(action === 'accept' ? 'Đã xác nhận phương án đón.' : action === 'replace' ? 'Đã giữ nhu cầu để tìm xe khác.' : 'Đã hủy yêu cầu đón.');
    } catch (err) { setPassError(err.message || 'Chưa cập nhật được yêu cầu.'); }
    finally { setPassBusy(false); }
  };
  const passPhone = String(pass?.carInfo?.driverPhone || '').replace(/[\s().-]/g, '');
  const inputClass = 'mt-1 w-full rounded-xl p-3 bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/15 text-sm';
  return <div className="min-h-screen bg-[#DFE5EC] dark:bg-[#0b0f19] text-slate-900 dark:text-white p-4 pb-24">
    <div className="max-w-2xl mx-auto space-y-4">
      <header className="flex items-center gap-3"><button onClick={onBack} type="button" aria-label="Quay lại" className="p-3"><ArrowLeft className="w-5 h-5" /></button><div><h1 className="font-bold text-lg">Tìm xe qua trạm</h1><p className="text-xs text-slate-500">Trạm làm mốc · Điểm đón linh hoạt theo hai bên</p></div></header>
      {passId && !currentUser && <button type="button" className="w-full p-3 text-sm rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70" onClick={() => onRequireAuth?.({ title: 'Xem lịch đón đã lưu', subtitle: 'Đăng nhập để xác minh và cập nhật trạng thái chuyến của bạn.' })}>Đăng nhập để xem lịch đón đã lưu</button>}
      {passId && currentUser && <section className="p-4 bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/15 rounded-2xl space-y-3">
        <h2 className="font-bold">Lịch đón của bạn</h2>
        {passError && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{passError} Thông tin trước đó có thể đã thay đổi.</p>}
        {pass ? <>
          <p className="font-semibold">{pass.status === 'OFFERED' && !pass.driverAccepted ? 'Đang tìm xe phù hợp' : STATUS[pass.status] || 'Chưa rõ trạng thái'}</p>
          <p className="text-sm">{pass.committedTerms?.pickupPoint || pass.pickupPoint || pass.originName || origin?.name || 'Chưa rõ điểm đón'} → {pass.committedTerms?.dropoffPoint || pass.destinationName || 'Chưa rõ điểm đến'}</p>
          {pass.carInfo && <p className="text-sm">{pass.carInfo.driverName || 'Chủ xe'} · {pass.carInfo.vehicleModel || 'Chưa rõ dòng xe'} · {pass.carInfo.plate || 'Chưa rõ biển số'}</p>}
          {pass.status === 'WAITING' && <p className="text-sm">Chưa có xe nhận đón. Bạn có thể xem thêm chuyến phía dưới.</p>}
          {pass.status === 'OFFERED' && !pass.driverAccepted && <p className="text-sm">Chưa có chủ xe gửi đề nghị nhận đón. Bạn chưa cần ra trạm.</p>}
          {pass.status === 'OFFERED' && pass.driverAccepted && <>
            <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-xl text-sm space-y-1"><p>Điểm đón: {pass.proposalTerms?.pickupPoint || pass.pickupPoint || 'Chưa có'}</p><p>Điểm đến: {pass.proposalTerms?.dropoffPoint || pass.destinationName || 'Chưa có'}</p><p>Thời gian: {pass.proposalTerms?.pickupStartAt ? new Date(pass.proposalTerms.pickupStartAt).toLocaleString('vi-VN') : 'Cần chủ xe xác nhận'} – {pass.proposalTerms?.pickupEndAt ? new Date(pass.proposalTerms.pickupEndAt).toLocaleString('vi-VN') : 'Chưa rõ giờ cuối'}</p><p>Số người: {pass.proposalTerms?.seats ?? pass.seats ?? 'Chưa rõ'}</p><p>Tổng tiền: {pass.proposalTerms?.totalPrice == null ? 'Chưa chốt' : `${Number(pass.proposalTerms.totalPrice).toLocaleString('vi-VN')}đ`}</p></div>
            <button type="button" disabled={passBusy || !pass.proposalVersion || !pass.proposalTerms} onClick={() => updatePass('accept')} className="p-3 bg-[#0071e3] text-white rounded-xl disabled:opacity-50">Đồng ý phương án đón này</button>
          </>}
          {pass.committedTerms && ['ARRIVING', 'BOARDED', 'COMPLETED'].includes(pass.status) && <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-sm space-y-1"><p>Khoảng đón đã chốt: {new Date(pass.committedTerms.pickupStartAt).toLocaleString('vi-VN')} – {new Date(pass.committedTerms.pickupEndAt).toLocaleString('vi-VN')}</p><p>{pass.committedTerms.seats} người · Tổng tiền {pass.committedTerms.totalPrice == null ? 'Chưa rõ' : `${Number(pass.committedTerms.totalPrice).toLocaleString('vi-VN')}đ`}</p>{pass.committedTerms.dropoffLatestAt && <p>Đến trước: {new Date(pass.committedTerms.dropoffLatestAt).toLocaleString('vi-VN')}</p>}<p>{pass.telemetryFresh === false ? 'Vị trí xe chưa được cập nhật gần đây. Liên hệ chủ xe để kiểm tra.' : 'Giờ hẹn đã được hai bên xác nhận; thời gian xe đến thực tế có thể thay đổi.'}</p></div>}
          {['ARRIVING', 'BOARDED', 'COMPLETED'].includes(pass.status) && pass.pin && <p className="text-sm">Mã lên xe: <strong className="text-2xl font-mono tracking-widest">{pass.pin}</strong></p>}
          {/^[+]?[0-9]{9,15}$/.test(passPhone) && <a href={`tel:${passPhone}`} className="inline-flex gap-2 p-3 rounded-xl bg-emerald-600 text-white text-sm"><Phone className="w-4 h-4" />Gọi chủ xe</a>}
          {!['BOARDED', 'COMPLETED', 'CANCELLED', 'EXPIRED'].includes(pass.status) && <div>{confirmCancel ? <div className="space-y-2 text-sm"><p>Hủy yêu cầu đón {pass.pickupPoint || origin?.name} → {pass.destinationName} của bạn?</p><button disabled={passBusy} type="button" className="p-3 rounded-xl bg-rose-600 text-white mr-2" onClick={() => updatePass('cancel')}>Xác nhận hủy</button><button disabled={passBusy} type="button" className="p-3 rounded-xl border border-[#0071e3] text-[#0071e3] mr-2" onClick={() => updatePass('replace')}>Tìm xe khác, giữ nhu cầu</button><button type="button" onClick={() => setConfirmCancel(false)} className="p-3">Quay lại</button></div> : <button type="button" onClick={() => setConfirmCancel(true)} className="p-2 text-sm text-rose-700 dark:text-rose-300">Hủy yêu cầu đón</button>}</div>}
        </> : <p className="text-sm">Đang xác minh lịch đón đã lưu…</p>}
        <button type="button" onClick={() => onViewBookedTab?.('booked')} className="text-sm text-[#0071e3] p-2">Xem yêu cầu và phương án đi tiếp</button>
      </section>}
      <form onSubmit={(event) => { event.preventDefault(); search(); }} className="p-4 bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/15 rounded-2xl space-y-3">
        <div className="grid grid-cols-2 gap-3"><label className="text-sm">Trạm đi<select className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)}>{VIRTUAL_HUBS.map((h) => <option key={h.id} value={h.id}>{h.shortName || h.name}</option>)}</select></label><label className="text-sm">Trạm đến<select className={inputClass} value={to} onChange={(e) => setTo(e.target.value)}>{VIRTUAL_HUBS.map((h) => <option key={h.id} value={h.id}>{h.shortName || h.name}</option>)}</select></label></div>
        <div className="grid grid-cols-2 gap-3"><label className="text-sm">Ngày đi<input className={inputClass} type="date" required min={toLocalIsoDate(new Date())} value={date} onChange={(e) => setDate(e.target.value)} /></label><label className="text-sm">Giờ muốn đi<input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} /><span className="text-xs text-slate-500">Bỏ trống để xem cả ngày</span></label></div>
        <label className="block text-sm">Số người<select className={inputClass} value={seats} onChange={(e) => setSeats(Number(e.target.value))}>{[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n} người</option>)}</select></label>
        <button type="submit" disabled={busy} className="w-full p-3 bg-[#0071e3] rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}Tìm chuyến</button>
        <p className="text-xs text-slate-500">Không cần đăng nhập để tìm xe hoặc gọi số chủ xe đã công khai. Tìm kiếm không tự đăng nhu cầu.</p>
      </form>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {matrix && <section className="space-y-3"><h2 className="font-bold">{trips.length ? `${trips.length} chuyến phù hợp` : 'Chưa có chuyến phù hợp'}</h2>{trips.map((trip) => <CorridorTripCard key={trip.tripId || trip.id} trip={trip} onSelectTrip={setSelected} />)}{!trips.length && <p className="text-sm">Chưa thấy xe phù hợp trong dữ liệu hiện có. Hãy thử khung giờ khác hoặc đăng nhu cầu.</p>}</section>}
      <button type="button" onClick={() => setShowStationRequest(true)} className="w-full p-3 rounded-xl bg-[#0071e3] text-white font-semibold">Yêu cầu xe đón theo khung giờ này</button>
      <p className="text-xs text-slate-500">Bạn sẽ xem lại điểm đón, giờ và số người trước khi gửi. Chưa tạo yêu cầu khi chỉ tìm kiếm.</p>
      <button type="button" onClick={() => setShowIntent(true)} className="w-full p-3 rounded-xl border border-[#0071e3] text-[#0071e3] text-sm">Đăng nhu cầu lên bảng tìm xe</button>
    </div>
    {selected && <TripDetailBottomSheet isOpen trip={selected} initialSeats={seats} originName={origin?.name} destName={destination?.name} onClose={() => setSelected(null)} onConfirmBook={(trip, requestedSeats) => { setSelected(null); setEnquiry({ ...trip, initialSeats: requestedSeats }); }} />}
    {enquiry && <InstantBookingModal isOpen trip={enquiry} originHub={origin} destinationHub={destination} currentUser={currentUser} onRequireAuth={onRequireAuth} onClose={() => setEnquiry(null)} onBookingSuccess={onBookingCreated} onShowToast={onShowToast} onViewBookedTab={onViewBookedTab} />}
    {showStationRequest && <MovementIntentModal isOpen requestMode="station" initialOriginHubId={from} initialDestHubId={to} initialDate={date} initialTimeSlot={time || 'all'} initialSeats={seats} currentUser={currentUser} onRequireAuth={onRequireAuth} onClose={() => setShowStationRequest(false)} onShowToast={onShowToast} onCreateRequest={createStationRequest} />}
    {showIntent && <MovementIntentModal isOpen initialOriginHubId={from} initialDestHubId={to} initialDate={date} initialTimeSlot={time} initialSeats={seats} currentUser={currentUser} onRequireAuth={onRequireAuth} onClose={() => setShowIntent(false)} onShowToast={onShowToast} onSuccess={() => onViewBookedTab?.('booked')} />}
  </div>;
}
