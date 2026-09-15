import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Car, MapPin, Pause, Phone, Plus, RefreshCw } from 'lucide-react';
import { cleanPhoneNumber, connectionPriceLabel, formatVND } from '@carmate/shared';
import api from '../../api/client.js';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';
import useOwnedDriverTrips from '../../hooks/useOwnedDriverTrips.js';
import { currentManifest, formatAppointmentTime, pointLabel, realPositionPayload } from '../../utils/driverOperations.js';

const panel = 'rounded-3xl border border-slate-300/70 dark:border-white/10 bg-white dark:bg-[#1a2232] p-5 space-y-3 shadow-sm';
const field = 'type-input w-full rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1a2232] px-3 py-3';
const ACTIVE_BOOKING = ['inquiring', 'pre_confirmed', 'confirmed', 'boarded'];

function AppointmentTerms({ terms = {} }) {
  return <div className="space-y-1">
    <p className="type-body"><strong className="type-body-strong">Đón:</strong> {pointLabel(terms.pickupPoint)}</p>
    <p className="type-body"><strong className="type-body-strong">Trả:</strong> {pointLabel(terms.dropoffPoint)}</p>
    <p className="type-body"><strong className="type-body-strong">Giờ đón:</strong> {formatAppointmentTime(terms.pickupStartAt)} – {formatAppointmentTime(terms.pickupEndAt)}</p>
    {terms.dropoffLatestAt && <p className="type-body"><strong className="type-body-strong">Trả trước:</strong> {formatAppointmentTime(terms.dropoffLatestAt)}</p>}
    <p className="type-body"><strong className="type-body-strong">Tổng tiền:</strong> {terms.totalPrice == null ? 'Chưa chốt' : formatVND(terms.totalPrice)} · {terms.seats || '—'} người</p>
  </div>;
}

export default function CockpitMode({ currentUser = null, onBack, onShowToast, onOpenQuickPostTrip, onRequireAuth, onOpenBookings }) {
  const { trips, loading, error: tripError, reload } = useOwnedDriverTrips(currentUser);
  const [selectedId, setSelectedId] = useState('');
  const [tracking, setTracking] = useState(false);
  const [session, setSession] = useState(null);
  const [riders, setRiders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [gpsError, setGpsError] = useState('');
  const [lastPositionAt, setLastPositionAt] = useState(null);
  const [clock, setClock] = useState(Date.now());
  const [busy, setBusy] = useState('');
  const [price, setPrice] = useState('');
  const [pins, setPins] = useState({});
  const [dropoff, setDropoff] = useState(null);
  const selectedRef = useRef(selectedId);
  const ridersRef = useRef(riders);
  const actionRef = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(true);
  selectedRef.current = selectedId;
  ridersRef.current = riders;
  const trip = trips.find((row) => row.id === selectedId);
  const offer = session?.activeOffer;
  const offerRider = riders.find((rider) => rider.intentId === offer?.intentId);
  const positionFresh = !!lastPositionAt && clock - lastPositionAt < 25000 && !gpsError;
  const currentOffer = offer && !offerRider?.driverAccepted && offer.expiresAt > clock;
  const directBookings = bookings.filter((booking) => booking.source !== 'station' && ACTIVE_BOOKING.includes(booking.status));

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; revision.current += 1; }; }, []);
  useEffect(() => {
    if (!selectedId && trips.length) setSelectedId(trips[0].id);
    if (selectedId && !loading && !tripError && !trips.some((row) => row.id === selectedId)) { setTracking(false); setSelectedId(''); }
  }, [trips, selectedId, loading, tripError]);
  useEffect(() => {
    revision.current += 1; setTracking(false); setSession(null); setRiders([]); setBookings([]);
    setLastPositionAt(null); setError(''); setSyncError(''); setGpsError(''); setPins({}); setDropoff(null);
  }, [selectedId, currentUser?.id]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { setPrice(offer?.totalPrice == null ? '' : String(offer.totalPrice)); }, [offer?.intentId, offer?.totalPrice]);

  const refreshPassengers = useCallback(async () => {
    if (!selectedId || !currentUser?.id || actionRef.current) return;
    const version = revision.current;
    try {
      const response = await api.getBookings();
      if (!response?.success) throw new Error(response?.error || 'Không tải được cuộc hẹn.');
      const actualBookings = (response.data || []).filter((booking) => (booking.tripId || booking.targetTripId) === selectedId);
      const ids = [...new Set([
        ...actualBookings.filter((booking) => booking.source === 'station' && ACTIVE_BOOKING.includes(booking.status)).map((booking) => booking.requestId),
        ...ridersRef.current.map((rider) => rider.intentId)
      ].filter(Boolean))];
      const results = await Promise.allSettled(ids.map((id) => api.getRiderPass(id)));
      if (!mounted.current || selectedRef.current !== selectedId || version !== revision.current) return;
      setBookings(actualBookings);
      const updated = new Map(ridersRef.current.map((rider) => [rider.intentId, rider]));
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.success && result.value.intent) {
          const rider = result.value.intent;
          if ((rider.matchedTripId || rider.proposedTripId) === selectedId && ['OFFERED', 'ARRIVING', 'BOARDED'].includes(rider.status)) updated.set(ids[index], rider);
          else updated.delete(ids[index]);
        }
      });
      setRiders([...updated.values()]);
      setSyncError(results.some((result) => result.status === 'rejected' || !result.value?.success) ? 'Chưa cập nhật được một số cuộc hẹn. Làm mới trước khi xác nhận đón/trả.' : '');
    } catch (err) {
      if (mounted.current && selectedRef.current === selectedId && version === revision.current) setSyncError(err.message || 'Chưa cập nhật được cuộc hẹn.');
    }
  }, [selectedId, currentUser?.id]);

  useEffect(() => {
    refreshPassengers(); const timer = setInterval(refreshPassengers, 5000);
    return () => clearInterval(timer);
  }, [refreshPassengers]);

  useEffect(() => {
    if (!tracking || !selectedId || !currentUser?.id) return undefined;
    if (!navigator.geolocation) { setGpsError('Trình duyệt này chưa hỗ trợ vị trí.'); setTracking(false); return undefined; }
    let stopped = false; let inFlight = false;
    const ping = () => {
      if (stopped || inFlight || actionRef.current) return;
      inFlight = true; const version = revision.current;
      navigator.geolocation.getCurrentPosition(async (position) => {
        if (stopped) return;
        try {
          const payload = realPositionPayload(selectedId, position);
          const response = await api.cockpitTelemetry(payload);
          if (stopped || version !== revision.current) return;
          if (!response?.success) throw new Error(response?.error || 'Chưa cập nhật được vị trí xe.');
          setSession(response.session); setRiders(currentManifest(response.session?.manifest));
          setLastPositionAt(position.timestamp); setGpsError('');
        } catch (err) { if (!stopped) setGpsError(err.message || 'Chưa cập nhật được vị trí xe.'); }
        finally { inFlight = false; }
      }, (err) => {
        inFlight = false;
        if (!stopped) setGpsError(err.code === 1 ? 'Bạn chưa cho phép vị trí. Mở quyền vị trí rồi bấm thử lại.' : 'Chưa nhận được GPS mới. Đang chờ lần cập nhật tiếp theo.');
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    };
    ping(); const timer = setInterval(ping, 8000);
    return () => { stopped = true; clearInterval(timer); };
  }, [tracking, selectedId, currentUser?.id]);

  const perform = async (key, request, successMessage) => {
    if (actionRef.current || !selectedId) return;
    actionRef.current = true; revision.current += 1; setBusy(key); setError('');
    const operatedTrip = selectedId;
    try {
      const response = await request();
      if (!response?.success) throw new Error(response?.error || 'Chưa hoàn thành thao tác.');
      if (!mounted.current || selectedRef.current !== operatedTrip) return;
      const rider = response.rider || response.intent;
      if (rider) setRiders((rows) => currentManifest([...rows.filter((row) => row.intentId !== rider.intentId), rider]));
      if (key.startsWith('reject:')) setSession((value) => value ? { ...value, activeOffer: null } : value);
      if (key.startsWith('drop:')) { setDropoff(null); await reload(); }
      if (key.startsWith('pin:')) setPins((value) => ({ ...value, [rider?.intentId]: '' }));
      onShowToast?.(response.message || successMessage);
    } catch (err) { if (mounted.current && selectedRef.current === operatedTrip) setError(err.message || 'Chưa hoàn thành thao tác.'); }
    finally { actionRef.current = false; revision.current += 1; if (mounted.current) setBusy(''); }
  };

  const sendOffer = () => {
    const amount = Number(price);
    if (price.trim() === '' || !Number.isFinite(amount) || amount < 0) { setError('Nhập tổng tiền cho cả nhóm trước khi gửi đề nghị.'); return; }
    perform(`offer:${offer.intentId}`, () => api.cockpitAcceptOffer({ tripId: selectedId, intentId: offer.intentId, totalPrice: amount }), 'Đã gửi đề nghị. Đang chờ khách xác nhận.');
  };

  return <main className="min-h-screen bg-[#DFE5EC] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 pb-16">
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Button variant="secondary" icon={ArrowLeft} onClick={onBack}>Quay lại</Button><div><h1 className="type-page-title">Quản lý xe đang chạy</h1><p className="type-body text-slate-500">Chuyến thật, cuộc hẹn rõ ràng.</p></div></div>
        <Button icon={Plus} onClick={onOpenQuickPostTrip}>Đăng chuyến</Button>
      </header>
      {!currentUser ? <section className={panel}><h2 className="type-heading">Xem chuyến thuộc tài khoản của bạn</h2><p className="type-body">Đăng nhập để quản lý cuộc hẹn và cập nhật vị trí cho chuyến đang đi.</p><Button onClick={() => onRequireAuth?.({ title: 'Quản lý xe của bạn', subtitle: 'Đăng nhập để xem đúng chuyến và các cuộc hẹn của bạn.' })}>Đăng nhập</Button></section> : <>
        {tripError && <p role="alert" className="type-body rounded-2xl p-3 bg-amber-50 text-amber-800">{tripError}</p>}
        <div className="flex justify-between items-center"><p className="type-body text-slate-500">{loading ? 'Đang tải chuyến…' : `${trips.length} chuyến đang mở`}</p><Button variant="secondary" icon={RefreshCw} disabled={loading || !!busy} onClick={() => { reload(); refreshPassengers(); }}>Làm mới</Button></div>
        {!loading && !tripError && !trips.length && <section className={panel}><h2 className="type-heading">Bạn chưa có chuyến đang mở</h2><p className="type-body">Đăng hành trình và thông tin xe trước khi bắt đầu nhận khách.</p></section>}
        {!!trips.length && <section className={panel}>
          <label className="type-label block" htmlFor="cockpit-trip">Chọn chuyến đang thực hiện</label>
          <select id="cockpit-trip" className={field} value={selectedId} disabled={tracking || !!busy} onChange={(event) => setSelectedId(event.target.value)}>{trips.map((row) => <option key={row.id} value={row.id}>{row.from} → {row.to} · {row.date} {row.time || row.timeSlot}</option>)}</select>
          {trip && <><p className="type-body flex flex-wrap gap-3"><span className="inline-flex items-center gap-2"><Car size={16} />{trip.carType || 'Chưa có thông tin xe'} · {trip.licensePlate || trip.plateMask || 'Chưa có biển số'}</span><span>{trip.capacity ? `Xe ${trip.capacity} chỗ` : ''}</span><span>{connectionPriceLabel(trip)}{connectionPriceLabel(trip) !== 'Liên hệ' ? '/ghế' : ''}</span></p>
            <p className="type-body">{session?.seatsAvailable ?? trip.availableSeats ?? '—'} chỗ còn nhận theo dữ liệu chuyến. Mỗi đề nghị được kiểm tra lại theo đoạn đường.</p></>}
          <p className="type-body text-slate-500">Bật vị trí khi bắt đầu đi để tìm khách phù hợp trên phần đường còn lại. Vị trí chỉ được cập nhật khi bạn bật và giữ màn hình này mở. Thao tác khi đã dừng xe.</p>
          <div className="flex flex-wrap items-center gap-3"><Button icon={tracking ? Pause : MapPin} disabled={!trip || !!busy} variant={tracking ? 'secondary' : 'primary'} onClick={() => { setGpsError(''); setTracking((value) => !value); }}>{tracking ? 'Tạm dừng vị trí' : 'Bắt đầu cập nhật vị trí'}</Button><span role="status" className="">{tracking ? positionFresh ? 'Vị trí vừa được cập nhật' : 'Đang chờ vị trí mới' : 'Chưa chia sẻ vị trí'}</span></div>
          {gpsError && <p role="alert" className="type-body text-amber-700 dark:text-amber-300">{gpsError}</p>}
          {lastPositionAt && <p className="type-caption text-slate-500">GPS gần nhất: {formatAppointmentTime(lastPositionAt)}. Dừng cập nhật vị trí không hủy các cuộc hẹn đã chốt.</p>}
        </section>}
        {error && <p role="alert" className="type-body rounded-2xl p-3 bg-red-50 text-red-700">{error}</p>}
        {syncError && <p role="alert" className="type-body rounded-2xl p-3 bg-amber-50 text-amber-800">{syncError}</p>}
        {currentOffer && <section className={panel}>
          <h2 className="type-heading">Có nhu cầu có thể đón trên đường</h2>
          <p className="type-body">{offer.riderCount} người · {offer.stationName} → {offer.destinationName}</p>
          <AppointmentTerms terms={offer.proposalTerms} />
          <label className="type-label block" htmlFor="cockpit-price">Tổng tiền bạn đề nghị cho cả nhóm (đồng)</label>
          <input id="cockpit-price" type="number" min="0" step="1000" className={field} value={price} onChange={(event) => setPrice(event.target.value)} />
          <p className="type-body text-slate-500">Khách cần xác nhận cùng điểm, giờ và giá trước khi cuộc hẹn được chốt. CarMate không thu phí kết nối.</p>
          <div className="flex flex-wrap gap-2"><Button disabled={!!busy || !tracking || !positionFresh} onClick={sendOffer}>Gửi đề nghị đón</Button><Button variant="secondary" disabled={!!busy} onClick={() => perform(`reject:${offer.intentId}`, () => api.cockpitRejectOffer({ tripId: selectedId, intentId: offer.intentId }), 'Đã bỏ qua đề nghị.')}>Bỏ qua</Button></div>
        </section>}
        {trip && <section className={panel}>
          <h2 className="type-heading">Các nhóm khách trên chuyến</h2>
          {!riders.filter((rider) => rider.status !== 'OFFERED' || rider.driverAccepted).length && !directBookings.length && <p className="type-body text-slate-500">Chưa có cuộc hẹn đang theo dõi. Đề xuất mới sẽ xuất hiện khi có nhu cầu phù hợp và vị trí xe còn mới.</p>}
          {riders.filter((rider) => rider.status !== 'OFFERED' || rider.driverAccepted).map((rider) => {
            const phone = cleanPhoneNumber(rider.phone || '');
            return <article key={rider.intentId} className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2"><h3 className="type-heading">{rider.name || 'Khách'} · {rider.seatsNeeded} người</h3>{phone && <a className="type-button inline-flex items-center gap-2 p-2 text-[#0071e3]" href={`tel:${phone}`}><Phone size={16} />Gọi</a>}</div>
              <p className={rider.status === 'OFFERED' ? 'type-body text-amber-700 dark:text-amber-300' : 'type-body text-green-700 dark:text-green-300'}>{rider.status === 'OFFERED' ? 'Chờ khách xác nhận — chưa chốt đón' : rider.status === 'ARRIVING' ? 'Hai bên đã chốt — chờ đón khách' : 'Khách đã lên xe'}</p>
              <AppointmentTerms terms={rider.committedTerms || rider.proposalTerms} />
              {rider.status === 'ARRIVING' && <div className="flex flex-wrap gap-2"><input aria-label={`Mã PIN của ${rider.name || 'khách'}`} className={`type-input ${field} max-w-48`} inputMode="numeric" autoComplete="off" placeholder="PIN khách đọc khi lên xe" maxLength={4} value={pins[rider.intentId] || ''} onChange={(event) => setPins((value) => ({ ...value, [rider.intentId]: event.target.value.replace(/\D/g, '').slice(0, 4) }))} /><Button disabled={!!busy || !/^\d{4}$/.test(pins[rider.intentId] || '')} onClick={() => perform(`pin:${rider.intentId}`, () => api.cockpitVerifyPin({ tripId: selectedId, intentId: rider.intentId, pin: pins[rider.intentId] }), 'Đã ghi nhận khách lên xe.')}>Xác nhận lên xe</Button></div>}
              {rider.status === 'BOARDED' && <Button variant="success" disabled={!!busy} onClick={() => setDropoff(rider)}>Đã đến điểm trả khách</Button>}
            </article>;
          })}
          {directBookings.map((booking) => <article key={booking.escrowId || booking.id} className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-2"><h3 className="type-heading">{booking.passengerName || booking.contactName || 'Khách'} · {booking.seats || '—'} người</h3><p className="type-body">{booking.bothConfirmed ? booking.status === 'boarded' ? 'Đã lên xe' : 'Hai bên đã chốt cuộc hẹn' : 'Đang trao đổi, chưa chốt'}</p>{(booking.committedTerms || booking.proposalTerms) && <AppointmentTerms terms={booking.committedTerms || booking.proposalTerms} />}{onOpenBookings && <Button variant="secondary" onClick={onOpenBookings}>Xem cuộc hẹn và trao đổi</Button>}</article>)}
        </section>}
      </>}
    </div>
    {dropoff && <Modal title="Xác nhận đã trả khách?" subtitle={`${dropoff.name || 'Khách'} · ${dropoff.seatsNeeded} người`} onClose={() => !busy && setDropoff(null)} footer={<div className="flex justify-end gap-2"><Button variant="secondary" disabled={!!busy} onClick={() => setDropoff(null)}>Chưa trả</Button><Button variant="success" disabled={!!busy} onClick={() => perform(`drop:${dropoff.intentId}`, () => api.cockpitDropoff({ tripId: selectedId, intentId: dropoff.intentId }), 'Đã trả khách. Chỗ được cập nhật cho phần hành trình còn lại.')}>Xác nhận đã trả</Button></div>}><p className="type-body">Điểm trả đã chốt: <strong className="type-body-strong">{pointLabel((dropoff.committedTerms || dropoff.proposalTerms)?.dropoffPoint)}</strong>.</p><p className="type-body mt-2">Chỉ xác nhận khi nhóm khách đã xuống xe. Hệ thống hoàn tất cuộc hẹn và cập nhật chỗ cho các đoạn tiếp theo.</p>{error && <p role="alert" className="type-body mt-3 text-red-600">{error}</p>}</Modal>}
  </main>;
}
