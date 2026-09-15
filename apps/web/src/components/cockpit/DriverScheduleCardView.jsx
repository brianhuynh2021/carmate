import React from 'react';
import { Car, Plus, RefreshCw } from 'lucide-react';
import Button from '../ui/Button.jsx';
import ActiveTripCard from './ActiveTripCard.jsx';
import useOwnedDriverTrips from '../../hooks/useOwnedDriverTrips.js';

export default function DriverScheduleCardView({ currentUser, onSwitchToRadar, onShowToast, onOpenQuickPostTrip, onRequireAuth, onOpenBookings }) {
  const { trips, loading, error, reload } = useOwnedDriverTrips(currentUser);
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-bold text-xl">Chuyến xe của bạn</h2><p className="text-sm text-slate-500">Xem chuyến đã đăng và những cuộc hẹn thực tế.</p></div>
      <div className="flex gap-2"><Button variant="secondary" icon={RefreshCw} disabled={loading || !currentUser} onClick={reload}>Làm mới</Button><Button icon={Plus} onClick={onOpenQuickPostTrip}>Đăng chuyến</Button></div>
    </div>
    {!currentUser ? <div className="rounded-3xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 p-5 space-y-3"><p>Đăng nhập để xem và quản lý các chuyến thuộc tài khoản của bạn.</p><Button onClick={() => onRequireAuth?.({ title: 'Xem chuyến của bạn', subtitle: 'Đăng nhập để quản lý các chuyến bạn đã đăng.' })}>Đăng nhập</Button></div> : <>
      {error && <p role="alert" className="rounded-2xl bg-amber-50 p-3 text-amber-800">{error}</p>}
      {loading && <p role="status" className="text-slate-500">Đang tải chuyến xe…</p>}
      {!loading && !error && !trips.length && <div className="rounded-3xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 p-6"><p className="font-semibold">Bạn chưa có chuyến đang mở.</p><p className="text-sm text-slate-500 mt-1">Nhập tuyến, giờ và chỗ trống để xem trước rồi đăng chuyến.</p></div>}
      {trips.map((trip) => <ActiveTripCard key={trip.id} trip={trip} onRefresh={reload} onShowToast={onShowToast} onOpenBookings={onOpenBookings} />)}
      {!!trips.length && <Button variant="secondary" icon={Car} onClick={onSwitchToRadar}>Quản lý xe đang chạy</Button>}
    </>}
  </section>;
}
