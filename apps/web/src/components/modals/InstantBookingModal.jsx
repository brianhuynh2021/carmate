import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Phone, MessageCircle } from 'lucide-react';
import { toLocalIsoDate, cleanPhoneNumber, isValidVietnamesePhone } from '@carmate/shared';
import api from '../../api/client.js';
import { listedPrice, priceLabel, publicContactPhone, pickupLabel, bookingPickupWindow } from '../market/tripPresentation.js';

/** Viewing a trip never creates a booking or debits seats. */
export default function InstantBookingModal({ isOpen, onClose, onViewBookedTab, trip, originHub, destinationHub, currentUser, onBookingSuccess, onShowToast, onRequireAuth }) {
  const [pickupPoint, setPickupPoint] = useState(() => originHub?.landmark || originHub?.name || trip?.fromLocation || trip?.from || '');
  const [dropoffPoint, setDropoffPoint] = useState(() => destinationHub?.landmark || destinationHub?.name || trip?.toLocation || trip?.to || '');
  const [contactPhone, setContactPhone] = useState(currentUser?.phone || '');
  const [contactName, setContactName] = useState(currentUser?.name || '');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const seats = Math.max(1, Number(trip?.initialSeats) || 1);

  if (!isOpen || !trip || typeof document === 'undefined') return null;
  const phone = publicContactPhone(trip);
  const price = listedPrice(trip);
  const createEnquiry = async (user) => {
    if (!user || submitting.current || created) return;
    const passengerPhone = cleanPhoneNumber(contactPhone || user.phone || '');
    if (!isValidVietnamesePhone(passengerPhone)) { setError('Nhập số điện thoại liên hệ ở ô bên dưới rồi gửi lại yêu cầu.'); return; }
    if (!pickupPoint.trim() || !dropoffPoint.trim()) { setError('Vui lòng nhập điểm đón và điểm đến.'); return; }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const date = trip.departureDate === 'Ngày mai' ? toLocalIsoDate(new Date(Date.now() + 86400000)) : trip.departureDate === 'Hôm nay' ? toLocalIsoDate(new Date()) : trip.departureDate || trip.date;
      const result = await api.createBooking({
        tripId: trip.tripId || trip.id,
        targetTripId: trip.tripId || trip.id,
        from: originHub?.name || trip.fromLocation || trip.from || pickupPoint.trim(),
        to: destinationHub?.name || trip.toLocation || trip.to || dropoffPoint.trim(),
        pickupPoint: pickupPoint.trim(), dropoffPoint: dropoffPoint.trim(),
        originHubId: originHub?.id || trip.originHubId,
        destinationHubId: destinationHub?.id || trip.destinationHubId,
        date, time: trip.departureLabel || trip.time || '', timeSlot: trip.departureLabel || trip.time || '',
        ...bookingPickupWindow(trip),
        seats, price, totalDeal: price === null ? null : price * seats,
        pricingMode: trip.pricingMode || 'contact', pickupMode: trip.pickupMode || 'hybrid',
        passengerPhone, passengerName: contactName.trim() || user.name || 'Khách', status: 'inquiring'
      });
      if (!result?.success || !result.data) throw new Error('Chưa ghi nhận được yêu cầu. Vui lòng thử lại.');
      setCreated(result.data);
      onBookingSuccess?.(result.data);
      onShowToast?.('Đã gửi yêu cầu. Chưa có chủ xe xác nhận đón.');
    } catch (err) { setError(err.message || 'Chưa gửi được yêu cầu.'); }
    finally { submitting.current = false; setBusy(false); }
  };
  const submit = () => {
    if (!currentUser) {
      onRequireAuth?.({ title: 'Đăng nhập để gửi yêu cầu', subtitle: 'Giữ nguyên chuyến, số người và điểm đón bạn đã chọn.', onSuccess: createEnquiry });
      return;
    }
    createEnquiry(currentUser);
  };
  const inputClass = 'type-input w-full mt-1 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#1a2232] p-3';
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="enquiry-title">
      <section className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-[#DFE5EC] dark:bg-[#0b0f19] p-5 space-y-4 text-slate-900 dark:text-white">
        <header className="flex justify-between items-center"><h2 id="enquiry-title" className="type-title">{created ? 'Đã gửi yêu cầu' : 'Liên hệ chuyến này'}</h2><button type="button" onClick={onClose} aria-label="Đóng" className="type-button p-3"><X className="w-5 h-5" /></button></header>
        <p className="type-body">{trip.departureDate || trip.date} · {trip.departureLabel || trip.time || 'Chưa rõ giờ'} · {seats} người · {priceLabel(trip, seats)}</p>
        {bookingPickupWindow(trip).timeSlot && <p className="type-body">Khoảng dự kiến qua trạm: {bookingPickupWindow(trip).timeSlot}. Cần chủ xe xác nhận trước khi đón.</p>}
        <p className="type-body">{pickupLabel(trip.pickupMode)}. Hai bên tự chốt điểm đón và tiền chuyến đi. CarMate kết nối miễn phí.</p>
        {phone && <div className="grid grid-cols-2 gap-2"><a className="type-button p-3 rounded-xl bg-emerald-600 text-white flex items-center justify-center gap-2" href={`tel:${phone}`}><Phone className="w-4 h-4" />Gọi chủ xe</a><a className="type-button p-3 rounded-xl bg-blue-600 text-white flex items-center justify-center gap-2" href={`https://zalo.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-4 h-4" />Mở Zalo</a></div>}
        {created ? <>
          <p role="status" className="type-body p-4 bg-white dark:bg-[#1a2232] rounded-2xl">Yêu cầu #{created.escrowId || created.id}. Chỉ khi hai bên xác nhận cùng một phương án đón, CarMate mới ghi nhận cuộc hẹn. Bạn chưa cần ra trạm.</p>
          <button type="button" onClick={() => { onClose?.(); onViewBookedTab?.('booked', created); }} className="type-button w-full p-3 bg-[#0071e3] text-white rounded-xl">Theo dõi yêu cầu</button>
        </> : <>
          <div className="space-y-3"><label className="type-label block">Điểm muốn được đón<input className={inputClass} value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} maxLength={300} /></label><label className="type-label block">Điểm muốn đến<input className={inputClass} value={dropoffPoint} onChange={(e) => setDropoffPoint(e.target.value)} maxLength={300} /></label></div>
          <div className="grid grid-cols-2 gap-3"><label className="type-label block">Tên liên hệ<input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={80} /></label><label className="type-label block">Số điện thoại liên hệ<input type="tel" className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder={currentUser?.phone ? 'Dùng số đăng nhập' : 'Nhập số để liên hệ'} /></label></div>
          <p className="type-caption text-slate-500">Số liên hệ đi cùng yêu cầu này, không công khai thành tin tìm xe.</p>
          <p className="type-caption text-slate-600 dark:text-slate-300">Bạn có thể tự gọi và chốt bên ngoài. Nếu muốn theo dõi yêu cầu trên CarMate, hãy gửi dưới đây; thao tác này chưa giữ chỗ và chưa xác nhận đón.</p>
          {error && <p role="alert" className="type-body text-rose-700 dark:text-rose-300">{error}</p>}
          <button type="button" onClick={submit} disabled={busy || !pickupPoint.trim() || !dropoffPoint.trim()} className="type-button w-full p-3 bg-[#0071e3] text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? 'Đang gửi…' : 'Gửi yêu cầu trên CarMate'}</button>
        </>}
      </section>
    </div>, document.body
  );
}
