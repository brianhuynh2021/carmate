import React, { useEffect, useState } from 'react';
import { Send, ArrowLeft, Phone, Loader2 } from 'lucide-react';
import { cleanPhoneNumber, formatVND } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import api from '../../api/client.js';

const STATUS = { inquiring: 'Đang trao đổi', pre_confirmed: 'Đang chờ xác nhận phương án', confirmed: 'Hai bên đã xác nhận', delayed: 'Đã báo trễ', completed: 'Đã hoàn tất', cancelled: 'Đã hủy', expired: 'Đề nghị đã hết hạn', reassigned: 'Cần kiểm tra phương án thay thế' };
function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const part = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}
function TermsSummary({ terms }) {
  if (!terms) return <p className="type-body">Chưa có phương án đầy đủ để xác nhận.</p>;
  const when = (value) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('vi-VN') : 'Chưa rõ';
  return <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
    <dt className="type-body">Đón tại</dt><dd className="type-body-strong break-words">{terms.pickupPoint || 'Chưa rõ'}</dd>
    <dt className="type-body">Đến</dt><dd className="type-body-strong break-words">{terms.dropoffPoint || 'Chưa rõ'}</dd>
    <dt className="type-body">Khoảng đón</dt><dd className="type-body">{when(terms.pickupStartAt)} – {when(terms.pickupEndAt)}</dd>
    {terms.dropoffLatestAt && <><dt className="type-body">Đến trước</dt><dd className="type-body">{when(terms.dropoffLatestAt)}</dd></>}
    <dt className="type-body">Số người</dt><dd className="type-body">{terms.seats ?? 'Chưa rõ'}</dd>
    <dt className="type-body">Tổng tiền</dt><dd className="type-body">{terms.totalPrice == null ? 'Chưa chốt' : formatVND(terms.totalPrice)}</dd>
  </dl>;
}
function Conversation({ booking, currentUser, onRefreshBookings, onShowToast, onMarkAsRead }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const candidateList = Array.isArray(booking.recoveryCandidates) ? booking.recoveryCandidates : [];
  const [replacementTripId, setReplacementTripId] = useState('');
  const initial = booking.proposalTerms || booking.committedTerms || {};
  const [pickupPoint, setPickupPoint] = useState(initial.pickupPoint || booking.pickupPoint || booking.from || '');
  const [dropoffPoint, setDropoffPoint] = useState(initial.dropoffPoint || booking.dropoffPoint || booking.to || '');
  const [start, setStart] = useState(localDateTime(initial.pickupStartAt || booking.pickupStartAt));
  const [end, setEnd] = useState(localDateTime(initial.pickupEndAt || booking.pickupEndAt));
  const [price, setPrice] = useState(initial.totalPrice ?? booking.totalDeal ?? '');
  const [seats, setSeats] = useState(initial.seats ?? booking.seats ?? 1);
  const id = booking.escrowId || booking.id;
  const userPhone = cleanPhoneNumber(currentUser?.phone || '');
  const effectiveDriverId = booking.status === 'pre_confirmed' ? booking.proposalDriverId || booking.driverId : booking.driverId;
  const effectiveDriverPhone = booking.status === 'pre_confirmed' ? booking.proposalDriverPhone || booking.driverPhone : booking.driverPhone;
  const passengerId = booking.passengerId || (booking.userId !== effectiveDriverId ? booking.userId : null);
  const isDriver = effectiveDriverId ? currentUser?.id === effectiveDriverId : Boolean(userPhone && userPhone === cleanPhoneNumber(effectiveDriverPhone || ''));
  const isPassenger = passengerId ? currentUser?.id === passengerId : Boolean(userPhone && userPhone === cleanPhoneNumber(booking.passengerPhone || booking.userPhone || ''));
  const role = isPassenger && !isDriver ? 'passenger' : isDriver && !isPassenger ? 'driver' : null;
  const isClosed = ['completed', 'cancelled'].includes(booking.status) || booking.needStatus === 'closed';
  const isCommitted = Boolean(booking.committedTerms) && ['confirmed', 'delayed', 'completed'].includes(booking.status) && !booking.needsReplacement;
  const isProposed = booking.status === 'pre_confirmed' && Boolean(booking.proposalTerms);
  const isProposalExpired = booking.preConfirmedExpiresAt && new Date(booking.preConfirmedExpiresAt).getTime() <= Date.now();
  const canAccept = Boolean(role) && isProposed && !isProposalExpired && booking.preConfirmedBy !== role && Boolean(booking.proposalVersion);
  const partner = isPassenger ? booking.driverName || 'Chủ xe' : booking.passengerName || 'Khách';
  const phone = String(isPassenger ? effectiveDriverPhone || booking.driverPhoneDirect || '' : booking.passengerPhone || '').replace(/[\s().-]/g, '');
  const callable = /^\+?\d{9,15}$/.test(phone);
  const run = async (action, success) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); await onRefreshBookings?.(); onMarkAsRead?.(id); if (success) onShowToast?.(success); }
    catch (err) { setError(err.message || 'Chưa thực hiện được. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  };
  const send = (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    run(async () => { await api.sendBookingMessage(id, { text: message.trim(), senderRole: role, senderName: currentUser?.name || role }); setMessage(''); });
  };
  const propose = (event) => {
    event.preventDefault();
    const startAt = new Date(start), endAt = new Date(end);
    if (!pickupPoint.trim() || !dropoffPoint.trim() || !Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt < startAt || price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) {
      setError('Điền đầy đủ điểm đón, điểm đến, khoảng giờ và tổng tiền trước khi gửi phương án.'); return;
    }
    run(async () => {
      await api.preConfirmBooking(id, { ...(replacementTripId ? { replacementTripId } : {}), terms: { pickupPoint: pickupPoint.trim(), dropoffPoint: dropoffPoint.trim(), pickupStartAt: startAt.toISOString(), pickupEndAt: endAt.toISOString(), totalPrice: Number(price), seats: Number(seats) } });
      setShowTerms(false);
    }, 'Đã gửi phương án. Cần bên còn lại xác nhận đúng nội dung này.');
  };
  const inputClass = 'type-input mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#1a2232]';
  return <div className="flex flex-col gap-4 min-w-0">
    <header className="space-y-2"><h3 className="type-heading">{booking.from} → {booking.to}</h3><p className="type-body">{booking.needsReplacement ? 'Đang tìm xe thay thế — chưa có lịch đón mới' : STATUS[booking.status] || 'Chưa rõ trạng thái'}</p>
      {callable && <div className="flex gap-2"><a href={`tel:${phone}`} className="type-button px-3 py-2 rounded-xl bg-emerald-600 text-white inline-flex gap-2 items-center"><Phone className="w-4 h-4" />Gọi {partner}</a><a href={`https://zalo.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="type-button px-3 py-2 rounded-xl bg-[#0071e3] text-white">Mở Zalo</a></div>}
    </header>
    {booking.needsReplacement && <section className="p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 space-y-2">
      <p className="type-body">Yêu cầu ban đầu vẫn được giữ để tìm phương án khác. Xe cũ không còn là phương án đón đã chốt.</p>
      {booking.originalDeadlineAt && <p className="type-body">Hạn đón ban đầu: {new Date(booking.originalDeadlineAt).toLocaleString('vi-VN')}</p>}
      <p className="type-body">{candidateList.length ? `Có ${candidateList.length} chuyến để xem xét; chưa chuyến nào được tự động nhận thay.` : 'Chưa có xe thay thế phù hợp trong dữ liệu hiện có.'}</p>
      {candidateList.map((candidate) => <div key={candidate.tripId || candidate.id} className="p-2 bg-white dark:bg-[#1a2232] rounded-lg"><p className="type-body">{candidate.driverName || candidate.publicContactName || 'Chủ xe'} · {candidate.pickupStartAt ? new Date(candidate.pickupStartAt).toLocaleString('vi-VN') : candidate.departureLabel || candidate.time || 'Hỏi giờ'}</p><p className="type-body">Tổng tiền: {candidate.totalPrice == null ? 'Liên hệ' : formatVND(candidate.totalPrice)}</p>{/^\+?\d{9,15}$/.test(candidate.publicContactPhone || '') && <a className="type-body inline-block mt-1 text-[#0071e3]" href={`tel:${candidate.publicContactPhone}`}>Gọi chủ xe</a>}</div>)}
    </section>}
    {isCommitted && <section className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 space-y-2"><h4 className="type-heading">Phương án hai bên đã xác nhận</h4><TermsSummary terms={booking.committedTerms} /></section>}
    {isProposed && <section className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 space-y-3"><h4 className="type-heading">Phương án đang chờ xác nhận</h4><TermsSummary terms={booking.proposalTerms} /><p className="type-caption">{isProposalExpired ? 'Đề nghị đã hết hiệu lực. Cần gửi lại phương án.' : `Phiên bản ${booking.proposalVersion || 'chưa rõ'} · ${booking.preConfirmedBy === role ? 'Bạn đã đề xuất, đang chờ bên còn lại.' : 'Chỉ xác nhận nếu bạn đồng ý toàn bộ nội dung.'}`}</p>{canAccept && <button disabled={busy} type="button" onClick={() => run(() => api.finalConfirmBooking(id, { proposalVersion: booking.proposalVersion }), 'Hai bên đã xác nhận cùng một phương án đón.')} className="type-button p-3 rounded-xl bg-[#0071e3] text-white disabled:opacity-50">Đồng ý phương án này</button>}</section>}
    {role && !isClosed && !isCommitted && <section>
      <button type="button" onClick={() => setShowTerms(!showTerms)} className="type-button p-2 text-[#0071e3]">{showTerms ? 'Thu gọn phương án' : 'Ghi rõ phương án để hai bên xác nhận'}</button>
      {showTerms && <form onSubmit={propose} className="mt-2 p-3 rounded-xl border border-slate-300 dark:border-white/15 space-y-3">
        {booking.needsReplacement && <label className="type-label block">Chuyến thay thế<select className={inputClass} value={replacementTripId} onChange={(e) => setReplacementTripId(e.target.value)} required><option value="">Chọn chuyến để đề xuất</option>{candidateList.map((candidate) => <option key={candidate.tripId || candidate.id} value={candidate.tripId || candidate.id}>{candidate.driverName || candidate.publicContactName || 'Chủ xe'} · {candidate.pickupStartAt ? new Date(candidate.pickupStartAt).toLocaleString('vi-VN') : candidate.departureLabel || candidate.time || candidate.tripId || candidate.id}</option>)}</select></label>}
        <label className="type-label block">Điểm đón<input className={inputClass} value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} required maxLength={300} /></label>
        <label className="type-label block">Điểm đến<input className={inputClass} value={dropoffPoint} onChange={(e) => setDropoffPoint(e.target.value)} required maxLength={300} /></label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><label className="type-label">Đón từ<input type="datetime-local" required className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></label><label className="type-label">Đón đến<input type="datetime-local" required className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} /></label></div>
        <div className="grid grid-cols-2 gap-2"><label className="type-label">Tổng tiền (đ)<input type="number" min="0" step="1" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} required /></label><label className="type-label">Số người<input type="number" min="1" max="6" step="1" className={inputClass} value={seats} onChange={(e) => setSeats(e.target.value)} required /></label></div>
        <button disabled={busy} className="type-button p-3 rounded-xl bg-[#0071e3] text-white disabled:opacity-50" type="submit">Gửi phương án cho bên còn lại</button>
      </form>}
    </section>}
    <section className="space-y-2 max-h-[38vh] overflow-y-auto" aria-label="Tin nhắn">
      {(booking.messages || []).map((entry, index) => <div key={entry.id || `${entry.createdAt}-${index}`} className="p-3 rounded-xl bg-white dark:bg-[#1a2232] border border-slate-200 dark:border-white/10"><p className="type-caption text-slate-500">{entry.senderName || entry.senderRole || 'Thành viên'}{entry.createdAt ? ` · ${new Date(entry.createdAt).toLocaleString('vi-VN')}` : ''}</p><p className="type-body mt-1 whitespace-pre-wrap break-words">{entry.text || entry.message}</p></div>)}
      {!(booking.messages || []).length && <p className="type-body text-slate-500">Chưa có tin nhắn. Bạn có thể trao đổi số liên hệ, điểm đón và giá tại đây.</p>}
    </section>
    {error && <p role="alert" className="type-body text-rose-700 dark:text-rose-300">{error}</p>}
    {role && !isClosed && <form onSubmit={send} className="flex items-end gap-2"><label className="type-label flex-1">Tin nhắn<textarea value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} maxLength={2000} rows={2} placeholder="Trao đổi trực tiếp với bên còn lại…" /></label><button type="submit" disabled={busy || !message.trim()} className="type-button p-3 rounded-xl bg-[#0071e3] text-white disabled:opacity-50" aria-label="Gửi tin nhắn">{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</button></form>}
    <p className="type-caption text-slate-500">Hai bên tự liên lạc và chốt. Cuộc gọi, tin nhắn bên ngoài chưa tự cập nhật thành cuộc hẹn trên CarMate.</p>
  </div>;
}
export default function InboxModal({ isOpen, onClose, bookings = [], currentUser, onRefreshBookings, initialBookingId, onShowToast, onMarkAsRead, onNavigateTab }) {
  const [selectedId, setSelectedId] = useState(initialBookingId || null);
  useEffect(() => { if (isOpen && initialBookingId) setSelectedId(initialBookingId); }, [isOpen, initialBookingId]);
  if (!isOpen) return null;
  const active = bookings.find((booking) => (booking.escrowId || booking.id) === selectedId);
  return <Modal onClose={onClose} size="5xl" title="Trao đổi và lịch đón" subtitle="Thông tin rõ ràng để hai bên tự quyết định">
    <div className="bg-[#DFE5EC] dark:bg-[#0b0f19] -mx-6 -my-4 p-4 min-h-[300px]">
      {!currentUser ? <p className="type-body">Đăng nhập để xem trao đổi của bạn.</p> : <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
        <nav className={`${active ? 'hidden md:block' : ''} space-y-2`} aria-label="Danh sách yêu cầu">{bookings.map((booking) => { const id = booking.escrowId || booking.id; return <button key={id} type="button" onClick={() => { setSelectedId(id); onMarkAsRead?.(id); }} className={`type-button w-full p-3 text-left rounded-2xl border ${selectedId === id ? 'bg-blue-50 dark:bg-blue-950 border-blue-400' : 'bg-white dark:bg-[#1a2232] border-slate-300/70 dark:border-white/15'}`}><span className="block">{booking.from} → {booking.to}</span><span className="block mt-1">{booking.needsReplacement ? 'Đang tìm xe thay thế' : STATUS[booking.status] || 'Chưa rõ trạng thái'}</span><span className="type-caption block mt-1 text-slate-500">#{id}</span></button>; })}{!bookings.length && <p className="type-body text-slate-500">Chưa có yêu cầu nào.</p>}</nav>
        <main className="min-w-0">{active ? <><button type="button" onClick={() => setSelectedId(null)} className="type-button md:hidden flex items-center gap-2 mb-3"><ArrowLeft className="w-4 h-4" />Danh sách yêu cầu</button><Conversation key={`${active.escrowId || active.id}-${active.proposalVersion || 0}`} booking={active} currentUser={currentUser} onRefreshBookings={onRefreshBookings} onShowToast={onShowToast} onMarkAsRead={onMarkAsRead} />{active.needsReplacement && <button type="button" onClick={() => { onClose?.(); onNavigateTab?.('market'); }} className="type-button mt-3 p-3 rounded-xl border border-[#0071e3] text-[#0071e3]">Tìm thêm chuyến khác</button>}</> : <p className="type-body text-slate-500">Chọn một yêu cầu để xem nội dung trao đổi và phương án đón.</p>}</main>
      </div>}
    </div>
  </Modal>;
}
