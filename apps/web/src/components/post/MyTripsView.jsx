import React, { useState, useEffect } from 'react';
import { Car, Edit3, Trash2, CheckCircle2, Lock, Unlock, PlusCircle, ExternalLink, Users, Clock, AlertCircle } from 'lucide-react';
import { formatVND } from '@carmate/shared';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import { SectionHeader } from '../ui/EmptyState.jsx';
import { RouteTimeline } from '../market/TripCard.jsx';

export default function MyTripsView({
  driverOffers = [],
  passengerRequests = [],
  onEditTrip,
  onToggleStatus,
  onDeleteTrip,
  onPostNew,
  onViewInMarket,
  onViewTrip
}) {
  const [myTripIds, setMyTripIds] = useState([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('carmate_my_trip_ids') || '[]');
      setMyTripIds(Array.isArray(stored) ? stored : []);
    } catch {
      setMyTripIds([]);
    }
  }, []);

  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'open' | 'full'

  // Tổng hợp tất cả chuyến của người dùng
  const allTrips = [...driverOffers, ...passengerRequests];
  const myTrips = allTrips.filter(t => myTripIds.includes(t.id));
  const activeTripsCount = myTrips.filter(t => t.status !== 'full').length;
  const fullTripsCount = myTrips.filter(t => t.status === 'full').length;

  const filteredTrips = myTrips.filter(t => {
    if (statusFilter === 'open') return t.status !== 'full';
    if (statusFilter === 'full') return t.status === 'full';
    return true;
  });

  const handleConfirmDelete = (trip) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa bài đăng "${trip.from} ➔ ${trip.to}" (${trip.maskedCode}) không?`)) {
      onDeleteTrip?.(trip.id);
      // Cập nhật lại localStorage
      const updated = myTripIds.filter(id => id !== trip.id);
      setMyTripIds(updated);
      try {
        localStorage.setItem('carmate_my_trip_ids', JSON.stringify(updated));
      } catch {}
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SectionHeader
          icon={Car}
          title="Bài Đăng Của Tôi"
          description="Quản lý, chỉnh sửa giờ chạy, giá vé hoặc đánh dấu đã đủ người cho các bài đăng của bạn."
        />
        {myTrips.length > 0 && (
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs self-start sm:self-auto shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tất cả ({myTrips.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'open'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Đang nhận khách ({activeTripsCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('full')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'full'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Đã đủ chỗ ({fullTripsCount})
            </button>
          </div>
        )}
      </div>

      {myTrips.length === 0 ? (
        <div className="surface p-8 sm:p-12 text-center rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 inline-flex items-center justify-center shadow-inner">
            <Car className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">
              Bạn chưa có bài đăng nào trên thiết bị này
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Khi bạn đăng chuyến đi (Chủ xe có ghế trống hoặc Khách cần tìm xe), bài đăng sẽ được lưu tự động tại đây để bạn tiện chỉnh sửa hoặc đóng bài khi đã đủ người.
            </p>
          </div>
          <Button variant="primary" size="md" icon={PlusCircle} onClick={onPostNew} className="shadow-sm">
            Đăng chuyến đầu tiên ngay
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-medium">
            <span>Đang hiển thị {filteredTrips.length} / {myTrips.length} bài đăng</span>
            <span>Tự động đồng bộ với bảng tin cộng đồng</span>
          </div>

          {filteredTrips.length === 0 ? (
            <div className="p-8 text-center surface rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Không có bài đăng nào trong mục này
              </p>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium cursor-pointer"
              >
                Quay lại xem tất cả bài đăng
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTrips.map((trip) => {
                const isDriver = trip.type === 'driver_offer';
                const isFull = trip.status === 'full';
                const price = trip.basePricePerSeat || trip.expectedPrice || 150000;
                const seats = trip.availableSeats || trip.seatsNeeded || 1;

                return (
                <div
                  key={trip.id}
                  className={`surface p-5 rounded-2xl border transition-all space-y-4 relative ${
                    isFull
                      ? 'border-slate-200 dark:border-slate-800 opacity-80 bg-slate-50/50 dark:bg-slate-900/40'
                      : 'border-slate-200/90 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-800 shadow-xs'
                  }`}
                >
                  {/* Top Bar: Code, Role & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">
                        {trip.maskedCode}
                      </span>
                      <Badge tone={isDriver ? 'primary' : 'warning'}>
                        {isDriver ? 'Chủ xe' : 'Khách tìm xe'}
                      </Badge>
                      <span className="text-xs text-slate-400">· {trip.date || 'Hôm nay'}</span>
                    </div>

                    {isFull ? (
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Đã đủ người</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Đang nhận khách</span>
                      </span>
                    )}
                  </div>

                  {/* Lộ trình */}
                  <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50">
                    <RouteTimeline from={trip.from} to={trip.to} waypointNote={trip.waypointNote} compact />
                  </div>

                  {/* Chi tiết Giá vé & Số chỗ */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-slate-900 dark:text-white tabular">
                        {formatVND(price)}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {isDriver ? `Còn ${seats} chỗ trống` : `Cần ${seats} ghế`}
                      </span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Giờ chạy: <strong>{trip.timeSlotLabel || trip.timeSlot}</strong>
                    </span>
                  </div>

                  {/* Thanh công cụ Quản lý bài đăng (Action Toolbar) */}
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="xs"
                        icon={Edit3}
                        onClick={() => onEditTrip?.(trip)}
                        className="h-8 text-xs font-semibold"
                      >
                        Chỉnh sửa
                      </Button>

                      <Button
                        variant={isFull ? 'outline' : 'ghost'}
                        size="xs"
                        icon={isFull ? Unlock : Lock}
                        onClick={() => onToggleStatus?.(trip.id, isFull ? 'active' : 'full')}
                        className="h-8 text-xs text-slate-600 dark:text-slate-300"
                        title={isFull ? 'Mở lại bài đăng nhận khách' : 'Đánh dấu đã đủ người để không nhận thêm Zalo'}
                      >
                        {isFull ? 'Mở nhận khách' : 'Báo đủ chỗ'}
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="xs"
                        icon={ExternalLink}
                        onClick={() => onViewTrip ? onViewTrip(trip) : onViewInMarket?.(trip)}
                        className="h-8 text-xs font-bold text-primary-600 dark:text-primary-400 shadow-2xs"
                        title="Xem chi tiết thẻ vé & chia sẻ bài đăng"
                      >
                        Xem bài
                      </Button>

                      <Button
                        variant="ghost"
                        size="xs"
                        icon={Trash2}
                        onClick={() => handleConfirmDelete(trip)}
                        className="h-8 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Xóa bài đăng này"
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}
    </div>
  );
}

