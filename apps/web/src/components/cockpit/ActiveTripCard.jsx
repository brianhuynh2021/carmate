import React, { useState } from 'react';
import { Car, Phone, Trash2, Users } from 'lucide-react';
import { cleanPhoneNumber, connectionPriceLabel } from '@carmate/shared';
import api from '../../api/client.js';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';
import { confirmedTripManifest, pointLabel } from '../../utils/driverOperations.js';

export default function ActiveTripCard({ trip, onCancelTrip, onRefresh, onShowToast, onOpenBookings }) {
  const [showCancel, setShowCancel] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState('');
  if (!trip) return null;
  const manifest = confirmedTripManifest(trip);
  const pending = (trip.manifest || []).filter((rider) => !rider.bothConfirmed && ['inquiring', 'pre_confirmed'].includes(rider.status));
  const pickupLabel = { station: 'Đón tại trạm', doorstep: 'Có đón tận nơi', hybrid: 'Trạm hoặc điểm đón phù hợp' }[trip.pickupMode] || 'Liên hệ về điểm đón';
  const price = connectionPriceLabel(trip);
  const cancelTrip = async () => {
    if (canceling) return;
    setCanceling(true); setError('');
    try {
      const response = await api.deleteTrip(trip.id);
      if (!response?.success) throw new Error(response?.error || 'Chưa hủy được chuyến.');
      setShowCancel(false); onCancelTrip?.(trip.id); await onRefresh?.();
      onShowToast?.('Đã hủy chuyến. Xem trạng thái các cuộc hẹn trong Chuyến của tôi.');
    } catch (err) { setError(err.message || 'Chưa hủy được chuyến. Vui lòng thử lại.'); }
    finally { setCanceling(false); }
  };
  return (
    <article className="rounded-3xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="type-heading">{trip.from || 'Chưa có điểm đi'} → {trip.to || 'Chưa có điểm đến'}</h3>
          <p className="type-body text-slate-500">{trip.date || 'Chưa có ngày'} · {trip.time || trip.timeSlot || 'Chưa có giờ'}</p></div>
        <span className="type-body-strong rounded-xl bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-[#0071e3]">{price}{price !== 'Liên hệ' ? '/ghế' : ''}</span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <span className="inline-flex gap-2 items-center"><Car size={16} />{trip.carType || 'Chưa có thông tin xe'} · {trip.licensePlate || trip.plateMask || 'Chưa có biển số'}</span>
        <span className="inline-flex gap-2 items-center"><Users size={16} />{Number.isFinite(Number(trip.availableSeats)) ? `${trip.availableSeats} chỗ còn nhận` : 'Chưa có số chỗ'}</span>
        {Number.isFinite(Number(trip.capacity)) && <span>Xe {trip.capacity} chỗ, gồm người lái</span>}
      </div>
      <p className="type-body text-slate-500">{pickupLabel}{trip.pickupNotes ? ` · ${trip.pickupNotes}` : ''}. Chỗ được kiểm tra lại theo đoạn đường khách đi khi chốt.</p>
      <section className="space-y-2">
        <h4 className="type-heading">{manifest.length} nhóm khách đã chốt{pending.length ? ` · ${pending.length} yêu cầu đang trao đổi` : ''}</h4>
        {manifest.length === 0 && <p className="type-body text-slate-500">Chưa có cuộc hẹn đã được hai bên xác nhận.</p>}
        {manifest.map((rider, index) => {
          const phone = cleanPhoneNumber(rider.passengerPhone || '');
          const terms = rider.committedTerms || {};
          return <div key={rider.bookingId || index} className="rounded-2xl bg-slate-50 dark:bg-white/5 p-3 flex items-center justify-between gap-3">
            <div><p className="type-body-strong">{rider.passengerName || 'Khách'} · {terms.seats || rider.seatsBooked || '—'} người</p>
              <p className="type-body text-slate-500">{pointLabel(terms.pickupPoint || rider.pickupSpot)} → {pointLabel(terms.dropoffPoint || rider.dropoffSpot)}</p>
              <p className="type-caption text-slate-500">{rider.status === 'boarded' ? 'Đã lên xe' : 'Đã xác nhận cuộc hẹn'}</p></div>
            {phone && <a className="type-button inline-flex items-center gap-2 text-[#0071e3] p-2" href={`tel:${phone}`}><Phone size={16} />Gọi</a>}
          </div>;
        })}
      </section>
      <div className="flex flex-wrap gap-2">
        {onOpenBookings && <Button variant="secondary" onClick={onOpenBookings}>Xem các cuộc hẹn</Button>}
        <Button variant="dangerGhost" icon={Trash2} onClick={() => setShowCancel(true)}>Hủy chuyến</Button>
      </div>
      {showCancel && <Modal title="Hủy chuyến này?" subtitle={`${trip.from || ''} → ${trip.to || ''} · ${trip.date || ''} ${trip.time || trip.timeSlot || ''}`} onClose={() => !canceling && setShowCancel(false)}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" disabled={canceling} onClick={() => setShowCancel(false)}>Giữ chuyến</Button><Button variant="danger" disabled={canceling} onClick={cancelTrip}>{canceling ? 'Đang hủy…' : 'Xác nhận hủy'}</Button></div>}>
        <p className="type-body">Chuyến sẽ ngừng nhận khách. Các cuộc hẹn liên quan được ghi nhận hủy; nhu cầu còn hiệu lực được mở lại để khách tìm phương án khác. Chưa có xe thay thế được xác nhận.</p>
        {!!manifest.length && <p className="type-body-strong mt-3">Có {manifest.length} nhóm khách đã chốt. Hãy liên hệ trực tiếp để khách biết thay đổi.</p>}
        {error && <p role="alert" className="type-body mt-3 text-red-600">{error}</p>}
      </Modal>}
    </article>
  );
}
