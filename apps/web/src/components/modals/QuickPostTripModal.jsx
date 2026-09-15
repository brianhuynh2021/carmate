import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Car, ArrowLeftRight } from 'lucide-react';
import { VIRTUAL_HUBS, formatVND, getDefaultCorridor, getEndpointHubs } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import api from '../../api/client.js';
import { buildDriverDemandPreview, buildDriverTripPayload, vietnamDate } from '../../utils/driverTripDraft.js';

const corridor = getDefaultCorridor();
const inputClass = 'w-full min-h-11 px-3 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#1a2232] text-sm text-slate-900 dark:text-white';
const blockClass = 'p-4 rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 space-y-3';
const labelClass = 'grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300';
const pickupLabels = { station: 'Tại trạm', doorstep: 'Tận nơi nếu thống nhất', hybrid: 'Tại trạm hoặc điểm khác nếu thống nhất' };

export default function QuickPostTripModal({ isOpen, onClose, currentUser = null, onRequireAuth, onSuccess, onShowToast }) {
  const [draft, setDraft] = useState(() => ({
    direction: 'binh_phuoc_to_tphcm',
    originHubId: 'hub_ql13_tan_khai', destinationHubId: 'hub_ql13_cho_ray',
    date: vietnamDate(new Date(Date.now() + 86400000)), time: '07:00',
    availableSeats: Math.min(2, (Number(currentUser?.vehicle?.capacity) || 5) - 1), capacity: Number(currentUser?.vehicle?.capacity) || 5,
    pricingMode: 'contact', basePricePerSeat: '', pickupMode: 'hybrid', maxDetourKm: 3,
    pickupNotes: '', phoneReal: currentUser?.phone || '', publicContactConsent: false,
    carType: [currentUser?.vehicle?.brand, currentUser?.vehicle?.model].filter(Boolean).join(' '),
    licensePlate: currentUser?.vehicle?.plate || ''
  }));
  const [preview, setPreview] = useState(false);
  const [managedOperators, setManagedOperators] = useState([]);
  const [operatorLoadError, setOperatorLoadError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!currentUser?.id) return () => { cancelled = true; };
    api.getMyOperators().then(result => {
      if (!cancelled) { setManagedOperators((result.data?.profiles || []).filter(p => p.status === 'published')); setOperatorLoadError(false); }
    }).catch(() => { if (!cancelled) setOperatorLoadError(true); });
    return () => { cancelled = true; };
  }, [currentUser?.id]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [demandPreview, setDemandPreview] = useState({ status: 'idle', data: [], count: 0 });
  const demandRequest = useRef(0);
  const publishing = useRef(false);
  const published = useRef(false);
  const field = (key, value) => { setDraft((prev) => ({ ...prev, [key]: value })); setError(''); };
  const towardSaigon = draft.direction === 'binh_phuoc_to_tphcm';
  const originHubs = useMemo(() => getEndpointHubs(corridor.id, towardSaigon ? 'b' : 'a', towardSaigon ? 'b_to_a' : 'a_to_b'), [towardSaigon]);
  const destinationHubs = useMemo(() => getEndpointHubs(corridor.id, towardSaigon ? 'a' : 'b', towardSaigon ? 'b_to_a' : 'a_to_b'), [towardSaigon]);
  const origin = VIRTUAL_HUBS.find((hub) => hub.id === draft.originHubId);
  const destination = VIRTUAL_HUBS.find((hub) => hub.id === draft.destinationHubId);

  const checkDemand = async (savedDraft) => {
    const requestId = ++demandRequest.current;
    setDemandPreview({ status: 'loading', data: [], count: 0 });
    try {
      const result = await api.previewDriverDemand(buildDriverDemandPreview(savedDraft));
      if (requestId !== demandRequest.current) return;
      if (!result?.success || !Array.isArray(result.data)) throw new Error('Demand preview unavailable');
      setDemandPreview({ status: 'ready', data: result.data, count: Number.isFinite(result.count) ? result.count : result.data.length, updatedAt: result.updatedAt });
    } catch {
      if (requestId === demandRequest.current) setDemandPreview({ status: 'error', data: [], count: 0 });
    }
  };

  const publish = async (user, savedDraft) => {
    if (publishing.current || published.current) return;
    publishing.current = true;
    setBusy(true);
    setError('');
    try {
      const payload = buildDriverTripPayload(savedDraft, user, VIRTUAL_HUBS);
      const response = await api.createTrip(payload);
      if (!response?.success || !response?.data?.id) throw new Error(response?.error || 'Chuyến chưa được đăng. Vui lòng thử lại.');
      published.current = true;
      onShowToast?.('Đã đăng chuyến. Khách có thể xem tin và liên hệ với bạn.');
      onSuccess?.(response.data, user);
      onClose();
    } catch (err) {
      setError(err.message || 'Không thể đăng chuyến. Thông tin bạn nhập vẫn được giữ lại.');
    } finally {
      publishing.current = false;
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    setError('');
    if (!preview) { setPreview(true); checkDemand({ ...draft }); return; }
    const savedDraft = { ...draft };
    // Preview validation never sends a request or assigns a guest owner.
    try { buildDriverTripPayload(savedDraft, currentUser || { id: 'draft-preview' }, VIRTUAL_HUBS); }
    catch (err) { setError(err.message); return; }
    if (!currentUser) {
      setAuthPending(true);
      onRequireAuth?.({
        title: 'Đăng nhập để đăng chuyến',
        subtitle: 'Lưu chuyến vào tài khoản để cập nhật và nhận liên hệ. Thông tin vừa nhập được giữ nguyên.',
        onSuccess: (user) => { setAuthPending(false); return publish(user, savedDraft); },
        onCancel: () => setAuthPending(false)
      });
      return;
    }
    publish(currentUser, savedDraft);
  };

  if (!isOpen) return null;
  return (
    <Modal onClose={() => !busy && !authPending && onClose()} title={preview ? 'Xem trước chuyến của bạn' : 'Đăng chuyến'} subtitle="Miễn phí kết nối · Bạn quyết định giá và việc nhận đón" icon={Car} size="lg" bodyClassName="bg-[#DFE5EC] dark:bg-[#0b0f19]">
      <form onSubmit={submit} className="space-y-4">
        {preview ? (
          <section className={blockClass} aria-label="Xem trước tin chuyến">
            <h3 className="font-semibold text-slate-900 dark:text-white">{origin?.shortName || origin?.name} → {destination?.shortName || destination?.name}</h3>
            <p className="text-sm">{draft.time} · {draft.date.split('-').reverse().join('/')} · {draft.availableSeats} chỗ nhận khách</p>
            <p className="font-semibold">{draft.pricingMode === 'contact' ? 'Giá: Liên hệ' : `${formatVND(Number(draft.basePricePerSeat))} / khách`}</p>
            <p className="text-sm">{pickupLabels[draft.pickupMode]}</p>
            {draft.pickupNotes && <p className="text-sm text-slate-600 dark:text-slate-300">{draft.pickupNotes}</p>}
            {draft.carType && <p className="text-sm">Xe: {draft.carType} · {draft.licensePlate}</p>}
            <p className="text-xs text-slate-500">Đây là bản xem trước, chưa xuất hiện công khai.</p>
            <button type="button" onClick={() => { demandRequest.current++; setPreview(false); }} className="text-sm font-medium text-[#0071e3]">Sửa thông tin chuyến</button>
          </section>
        ) : (
          <>
            {currentUser && (managedOperators.length > 0 || operatorLoadError) && <section className={blockClass}>
              {operatorLoadError ? <p className="text-sm text-amber-700">Chưa tải được hồ sơ nhà xe bạn quản lý. Đóng và mở lại biểu mẫu để thử lại.</p> : <label className={labelClass}>Đăng chuyến với tư cách<select className={inputClass} value={draft.operatorId || ''} onChange={event => field('operatorId', event.target.value)}><option value="">Chủ xe cá nhân</option>{managedOperators.map(operator => <option key={operator.id} value={operator.id}>{operator.name}</option>)}</select></label>}
            </section>}
            <section className={blockClass}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Hành trình</h3>
                <button type="button" onClick={() => setDraft((prev) => ({ ...prev, direction: towardSaigon ? 'tphcm_to_binh_phuoc' : 'binh_phuoc_to_tphcm', originHubId: prev.destinationHubId, destinationHubId: prev.originHubId }))} className="flex items-center gap-1 text-xs text-[#0071e3] min-h-10"><ArrowLeftRight className="w-4 h-4" /> Đảo chiều</button>
              </div>
              <label className={labelClass}>Từ trạm/khu vực<select value={draft.originHubId} onChange={(e) => field('originHubId', e.target.value)} className={inputClass}>{originHubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.shortName || hub.name}</option>)}</select></label>
              <label className={labelClass}>Đến trạm/khu vực<select value={draft.destinationHubId} onChange={(e) => field('destinationHubId', e.target.value)} className={inputClass}>{destinationHubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.shortName || hub.name}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>Ngày đi<input type="date" required min={vietnamDate()} value={draft.date} onChange={(e) => field('date', e.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Giờ xuất phát<input type="time" required value={draft.time} onChange={(e) => field('time', e.target.value)} className={inputClass} /></label>
              </div>
            </section>
            <section className={blockClass}>
              <h3 className="text-sm font-semibold">Chỗ và giá</h3>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>Tổng số chỗ của xe<input type="number" min="2" max="55" step="1" required value={draft.capacity} onChange={(e) => setDraft((prev) => ({ ...prev, capacity: e.target.value, availableSeats: Math.min(Number(prev.availableSeats), Math.max(1, Number(e.target.value) - 1)) }))} className={inputClass} /></label>
                <label className={labelClass}>Chỗ nhận khách<input type="number" min="1" max={Math.max(1, Number(draft.capacity) - 1)} step="1" required value={draft.availableSeats} onChange={(e) => field('availableSeats', e.target.value)} className={inputClass} /></label>
              </div>
              <label className={labelClass}>Hiển thị giá<select value={draft.pricingMode} onChange={(e) => field('pricingMode', e.target.value)} className={inputClass}><option value="contact">Liên hệ</option><option value="listed">Niêm yết giá</option></select></label>
              {draft.pricingMode === 'listed' && <label className={labelClass}>Giá mỗi khách (đồng)<input type="number" min="0" step="1000" required value={draft.basePricePerSeat} onChange={(e) => field('basePricePerSeat', e.target.value)} className={inputClass} /></label>}
            </section>
            <section className={blockClass}>
              <h3 className="text-sm font-semibold">Cách đón khách</h3>
              <label className={labelClass}>Bạn có thể đón<select value={draft.pickupMode} onChange={(e) => field('pickupMode', e.target.value)} className={inputClass}>{Object.entries(pickupLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {draft.pickupMode !== 'station' && <label className={labelClass}>Có thể đi vòng thêm tối đa (km)<input type="number" min="0" step="0.5" required value={draft.maxDetourKm} onChange={(e) => field('maxDetourKm', e.target.value)} className={inputClass} /></label>}
              <label className={labelClass}>Ghi chú điểm đón<textarea rows="2" maxLength="500" value={draft.pickupNotes} onChange={(e) => field('pickupNotes', e.target.value)} placeholder="Khu vực có thể ghé, điểm hẹn dễ nhận ra…" className={`${inputClass} py-2`} /></label>
              <p className="text-xs text-slate-500">Trạm là mốc tìm chuyến. Điểm đón cuối cùng do bạn và khách thống nhất.</p>
            </section>
            <section className={blockClass}>
              <h3 className="text-sm font-semibold">Thông tin xe</h3>
              <label className={labelClass}>Dòng xe<input required value={draft.carType} onChange={(e) => field('carType', e.target.value)} className={inputClass} placeholder="Nhập dòng xe của bạn" /></label>
              <label className={labelClass}>Biển số<input required value={draft.licensePlate} onChange={(e) => field('licensePlate', e.target.value.toUpperCase())} className={inputClass} placeholder="Nhập biển số xe của bạn" /></label>
            </section>
          </>
        )}
        {preview && <section className={blockClass} aria-live="polite" aria-label="Nhu cầu phù hợp với chuyến">
          <h3 className="text-sm font-semibold">Nhu cầu đang tìm xe cùng hành trình</h3>
          {demandPreview.status === 'loading' && <p className="text-sm text-slate-600 dark:text-slate-300">Đang kiểm tra nhu cầu đã được đăng…</p>}
          {demandPreview.status === 'error' && <><p className="text-sm text-slate-600 dark:text-slate-300">Chưa kiểm tra được nhu cầu lúc này. Đây không phải kết quả không có khách.</p><button type="button" onClick={() => checkDemand({ ...draft })} className="text-sm text-[#0071e3]">Thử lại</button></>}
          {demandPreview.status === 'ready' && (demandPreview.count === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">Chưa có nhu cầu phù hợp trong dữ liệu CarMate hiện tại. Bạn vẫn có thể đăng chuyến để khách tìm và liên hệ.</p> : <>
            <p className="text-sm font-medium">{demandPreview.count} nhu cầu có thể phù hợp</p>
            <ul className="divide-y divide-slate-200 dark:divide-white/10">{demandPreview.data.slice(0, 3).map((item) => <li key={item.id} className="py-2 text-sm space-y-1">
              <p>{item.originName} → {item.destinationName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.date} · {item.timeSlot} · {item.seats} người</p>
              {item.matchingReason && <p className="text-xs text-slate-600 dark:text-slate-300">{Array.isArray(item.matchingReason) ? item.matchingReason.join(' · ') : item.matchingReason}</p>}
            </li>)}</ul>
            <p className="text-xs text-slate-500">Đây là gợi ý tương thích, chưa có khách nào chốt chuyến với bạn.</p>
          </>)}
          {demandPreview.status === 'ready' && demandPreview.updatedAt && Number.isFinite(new Date(demandPreview.updatedAt).getTime()) && <p className="text-xs text-slate-500">Cập nhật {new Date(demandPreview.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}
        </section>}
        {preview && <section className={blockClass}>
          <label className={labelClass}>Số điện thoại khách có thể liên hệ<input type="tel" autoComplete="tel" required value={draft.phoneReal} onChange={(e) => field('phoneReal', e.target.value)} placeholder="Số điện thoại của bạn" className={inputClass} /></label>
          <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={draft.publicContactConsent} onChange={(e) => field('publicContactConsent', e.target.checked)} className="mt-0.5" />Tôi đồng ý công khai số liên hệ này trên tin chuyến để khách gọi trực tiếp.</label>
        </section>}
        {error && <p role="alert" className="p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="w-full min-h-12 px-4 rounded-2xl bg-[#0071e3] text-white font-semibold disabled:opacity-50">{busy ? 'Đang đăng chuyến…' : preview ? 'Đăng chuyến miễn phí' : 'Xem trước chuyến'}</button>
      </form>
    </Modal>
  );
}
