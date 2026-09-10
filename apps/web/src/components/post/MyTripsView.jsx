import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Car,
  Edit3,
  Trash2,
  Lock,
  Unlock,
  Plus,
  ExternalLink,
  Users,
  Clock,
  Sparkles,
  MapPin,
  LogIn,
  ArrowRight,
  Camera,
  Check,
  Truck,
  Package
} from 'lucide-react';
import {
  formatVND,
  getTimeSlotLabel,
  formatCleanDateLabel,
  isTripExpired,
  toPublicAlias,
  parseLocation
} from '@carmate/shared';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';
import { SectionHeader } from '../ui/EmptyState.jsx';
import { getCarDisplay } from '../market/TripCard.jsx';

function SeatOccupancyGauge({ trip, bookings = [] }) {
  if (trip.type !== 'driver_offer') return null;
  const isPickup = trip.vehicleType === 'pickup' || trip.hasCargoBed || (trip.carType && /bán tải|ranger|hilux|triton|d-max/i.test(trip.carType));
  const capacity = isPickup ? 5 : (Number(trip.capacity) || 5);
  const maxPassengerSeats = Math.max(1, capacity - 1);
  const passengerBookings = bookings.filter((b) => !b.isCargoBooking);
  const cargoBookings = bookings.filter((b) => b.isCargoBooking);
  const confirmedCount = passengerBookings.filter((b) => b.status === 'confirmed').length;
  const heldCount = passengerBookings.filter((b) => b.status === 'pre_confirmed' || b.status === 'inquiring').length;

  const passengerSlots = [];
  for (let i = 0; i < confirmedCount; i++) {
    passengerSlots.push({ id: `conf-${i}`, status: 'confirmed' });
  }
  for (let i = 0; i < heldCount; i++) {
    passengerSlots.push({ id: `held-${i}`, status: 'held' });
  }
  const remainingToRender = Math.max(0, maxPassengerSeats - passengerSlots.length);
  for (let i = 0; i < remainingToRender; i++) {
    passengerSlots.push({ id: `empty-${i}`, status: 'empty' });
  }

  const showCargoSlot = isPickup || trip.acceptsParcel;
  const hasCargoBooked = cargoBookings.some((b) => b.status === 'confirmed');
  const hasCargoHeld = cargoBookings.some((b) => b.status === 'pre_confirmed' || b.status === 'inquiring');

  return (
    <div className="p-3 rounded-2xl bg-[#f8f9fa] dark:bg-[#202024] border border-black/[0.04] dark:border-white/[0.06] space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          {isPickup ? <Truck className="w-3.5 h-3.5 text-amber-600" /> : <Car className="w-3.5 h-3.5 text-[#0071e3]" />}
          <span>
            {isPickup ? 'Sơ đồ bán tải (Cabin 4 chỗ + Thùng ~800kg)' : `Sơ đồ khoang xe (${capacity} chỗ)`}
          </span>
        </span>
        <span className="text-[11px] font-mono font-bold text-slate-500">
          {confirmedCount}/{maxPassengerSeats} khách{showCargoSlot ? (hasCargoBooked ? ' · 📦 Có hàng' : ' · Nhận hàng') : ''}
        </span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {/* Ghế Chủ xe */}
        <div
          className="flex-1 min-w-[56px] py-1.5 px-2 rounded-xl bg-slate-200/90 dark:bg-slate-700/80 border border-slate-300/80 dark:border-slate-600 flex flex-col items-center justify-center gap-0.5 text-center shadow-2xs"
          title="Ghế Chủ xe cầm lái"
        >
          <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200">Chủ xe</span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        </div>

        {/* Các ghế hành khách */}
        {passengerSlots.map((slot) => {
          if (slot.status === 'confirmed') {
            return (
              <div
                key={slot.id}
                className="flex-1 min-w-[56px] py-1.5 px-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 flex flex-col items-center justify-center gap-0.5 text-center shadow-2xs"
                title="Ghế đã chốt thành công 2 chiều"
              >
                <span className="text-[10px] font-bold">Đã chốt</span>
                <Check className="w-2.5 h-2.5 text-emerald-600" />
              </div>
            );
          }
          if (slot.status === 'held') {
            return (
              <div
                key={slot.id}
                className="flex-1 min-w-[56px] py-1.5 px-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 flex flex-col items-center justify-center gap-0.5 text-center shadow-2xs animate-pulse"
                title="Ghế đang giữ chỗ 15 phút"
              >
                <span className="text-[10px] font-bold">Giữ 15p</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              </div>
            );
          }
          return (
            <div
              key={slot.id}
              className="flex-1 min-w-[56px] py-1.5 px-2 rounded-xl bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-0.5 text-center"
              title="Ghế trống sẵn sàng nhận khách ghép"
            >
              <span className="text-[10px] font-medium">Trống</span>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
          );
        })}

        {/* Khoang thùng xe hoặc cốp xe gửi đồ */}
        {showCargoSlot && (
          <div
            className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 text-center shadow-2xs ${
              hasCargoBooked
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                : hasCargoHeld
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 animate-pulse'
                : isPickup
                ? 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-300/80 dark:border-amber-700/80 text-amber-900 dark:text-amber-200'
                : 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-800/80 text-blue-900 dark:text-blue-200'
            }`}
            title={isPickup ? 'Thùng xe bán tải chịu tải ~800kg sẵn sàng nhận hàng' : 'Cốp xe nhận gửi hàng tiện chuyến'}
          >
            <span className="text-[10px] font-bold flex items-center gap-1">
              {isPickup ? '🛻 Thùng xe' : '📦 Cốp xe'}
            </span>
            <span className="text-[9px] font-mono opacity-85">
              {hasCargoBooked ? '✓ Có hàng' : hasCargoHeld ? 'Đang hỏi' : isPickup ? '~800kg' : 'Nhận đồ'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyTripsView({
  driverOffers = [],
  passengerRequests = [],
  currentUser = null,
  onTripsCountChange,
  onOpenAuth,
  onEditTrip,
  onToggleStatus,
  onDeleteTrip,
  onPostNew,
  onRePublishTrip,
  onViewInMarket,
  onViewTrip,
  onViewCarPhotos,
  bookedEscrows = [],
  onViewBookings
}) {
  const [myTripIds, setMyTripIds] = useState([]);
  const [viewTab, setViewTab] = useState('open'); // 'open' | 'full' | 'history'

  // Tổng hợp tất cả chuyến của người dùng
  const allTrips = useMemo(() => [...driverOffers, ...passengerRequests], [driverOffers, passengerRequests]);
  const userPhoneClean = currentUser?.phone ? String(currentUser.phone).replace(/\D/g, '') : '';
  const myTrips = useMemo(() => {
    return allTrips.filter((t) => {
      if (currentUser) {
        if (t.userId && t.userId === currentUser.id) return true;
        if (userPhoneClean && t.phoneReal && String(t.phoneReal).replace(/\D/g, '') === userPhoneClean) return true;
        return myTripIds.includes(t.id);
      }
      // Chế độ Khách: Chỉ nhận diện chuyến do chính máy này tạo tạm
      return myTripIds.includes(t.id);
    });
  }, [allTrips, currentUser, userPhoneClean, myTripIds]);

  // Báo cáo số lượng chuyến thực tế về cho App (Đồng bộ tuyệt đối với Badge ở Header)
  useEffect(() => {
    onTripsCountChange?.(myTrips.length);
  }, [myTrips.length, onTripsCountChange]);

  // Đồng bộ danh sách bài đăng theo trạng thái đăng nhập & dọn sạch ID ma
  useEffect(() => {
    try {
      if (currentUser) {
        const userKey = `carmate_my_trip_ids_${currentUser.id || currentUser.phone}`;
        const stored = JSON.parse(localStorage.getItem(userKey) || localStorage.getItem('carmate_my_trip_ids') || '[]');
        const validStored = Array.isArray(stored) ? stored : [];
        if (allTrips.length > 0) {
          const clean = validStored.filter((id) => allTrips.some((t) => t.id === id));
          if (clean.length !== validStored.length) {
            localStorage.setItem(userKey, JSON.stringify(clean));
          }
          setMyTripIds(clean);
        } else {
          setMyTripIds(validStored);
        }
      } else {
        if (localStorage.getItem('carmate_my_trip_ids')) {
          localStorage.removeItem('carmate_my_trip_ids');
        }
        const guestStored = JSON.parse(localStorage.getItem('carmate_guest_trip_ids') || '[]');
        const validGuest = Array.isArray(guestStored) ? guestStored : [];
        if (allTrips.length > 0) {
          const clean = validGuest.filter((id) => allTrips.some((t) => t.id === id));
          if (clean.length !== validGuest.length) {
            localStorage.setItem('carmate_guest_trip_ids', JSON.stringify(clean));
          }
          setMyTripIds(clean);
        } else {
          setMyTripIds(validGuest);
        }
      }
    } catch {
      setMyTripIds([]);
    }
  }, [currentUser, allTrips]);

  // Phân chia danh mục chuẩn Apple: Đang mở (open) | Đã đủ (full) | Lịch sử (history)
  const activeTrips = useMemo(() => myTrips.filter((t) => !isTripExpired(t)), [myTrips]);
  const historyTrips = useMemo(() => myTrips.filter((t) => isTripExpired(t)), [myTrips]);

  const activeOpenTrips = useMemo(() => activeTrips.filter((t) => t.status !== 'full'), [activeTrips]);
  const activeFullTrips = useMemo(() => activeTrips.filter((t) => t.status === 'full'), [activeTrips]);

  const filteredTrips = useMemo(() => {
    if (viewTab === 'history') return historyTrips;
    if (viewTab === 'full') return activeFullTrips;
    return activeOpenTrips;
  }, [viewTab, historyTrips, activeFullTrips, activeOpenTrips]);

  // Tìm danh sách khách đã đặt cho từng chuyến (Smart Cross-Link)
  const getBookingsForTrip = (tripId) => {
    if (!bookedEscrows || bookedEscrows.length === 0) return [];
    return bookedEscrows.filter(
      (b) => b.tripId === tripId || b.targetItem?.id === tripId || b.targetTrip?.id === tripId
    );
  };

  const [tripToDelete, setTripToDelete] = useState(null);

  const handleExecuteDelete = () => {
    if (!tripToDelete) return;
    const trip = tripToDelete;
    setTripToDelete(null);
    onDeleteTrip?.(trip.id);
    const updated = myTripIds.filter((id) => id !== trip.id);
    setMyTripIds(updated);
    try {
      const storageKey = currentUser
        ? `carmate_my_trip_ids_${currentUser.id || currentUser.phone}`
        : 'carmate_guest_trip_ids';
      localStorage.setItem(storageKey, JSON.stringify(updated));
      localStorage.removeItem('carmate_my_trip_ids');
    } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* ── 1. APPLE SECTION HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SectionHeader
          icon={FileText}
          title="Bài Đăng Của Tôi"
          description="Quản lý bài đăng ghép xe · Cập nhật giờ chạy, chi phí phụ xăng và kiểm tra khách đã giữ chỗ"
        />
        {onPostNew && (
          <div className="shrink-0">
            <button
              type="button"
              onClick={onPostNew}
              className="px-4 py-2 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] text-white text-xs font-bold shadow-xs hover:shadow-md hover:shadow-blue-500/25 transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Đăng Bài Mới</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 2. APPLE SEGMENTED CONTROL 1 TẦNG (LIQUID MOTION) ── */}
      {myTrips.length > 0 && (
        <div className="flex items-center justify-between gap-2 p-1 rounded-full bg-[#f0f0f2] dark:bg-slate-900 border border-black/[0.04] dark:border-white/[0.06] overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 w-full min-w-max sm:min-w-0">
            <button
              type="button"
              onClick={() => setViewTab('open')}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer select-none min-h-[36px] active:scale-95 ${
                viewTab === 'open'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Đang mở</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-bold tabular ${
                  viewTab === 'open'
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                    : 'bg-black/[0.05] dark:bg-white/[0.06] text-slate-500'
                }`}
              >
                {activeOpenTrips.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewTab('full')}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer select-none min-h-[36px] active:scale-95 ${
                viewTab === 'full'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Đã đủ chỗ</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-bold tabular ${
                  viewTab === 'full'
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                    : 'bg-black/[0.05] dark:bg-white/[0.06] text-slate-500'
                }`}
              >
                {activeFullTrips.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewTab('history')}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer select-none min-h-[36px] active:scale-95 ${
                viewTab === 'history'
                  ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3 h-3 text-amber-500" />
              <span>Lịch sử</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-bold tabular ${
                  viewTab === 'history'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200'
                    : 'bg-black/[0.05] dark:bg-white/[0.06] text-slate-500'
                }`}
              >
                {historyTrips.length}
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center text-xs text-slate-500 dark:text-slate-400 pr-3 font-medium">
            <span>{filteredTrips.length} bài đăng</span>
          </div>
        </div>
      )}

      {/* ── 3. NỘI DUNG CHÍNH (EMPTY STATE HOẶC DANH SÁCH THẺ BENTO) ── */}
      {myTrips.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.03)] space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] inline-flex items-center justify-center border border-[#0071e3]/20 shadow-xs">
            <FileText className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight">
              {currentUser ? `Chào ${currentUser.name}! Bạn chưa có bài đăng nào` : 'Bạn chưa có bài đăng nào'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
              Đăng chuyến xe nếu bạn có ghế trống, hoặc đăng nhu cầu tìm xe tiện đường để kết nối bạn đồng hành.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onPostNew}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white font-bold text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo bài đăng ngay</span>
            </button>

            {!currentUser && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full sm:w-auto px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập để đồng bộ</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTrips.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.08] space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {viewTab === 'history'
                  ? 'Chưa có bài đăng nào trong lịch sử'
                  : viewTab === 'full'
                    ? 'Không có bài đăng nào đang đóng chỗ'
                    : 'Không có bài đăng nào đang mở'}
              </p>
              <button
                type="button"
                onClick={() => setViewTab(viewTab === 'open' ? 'full' : 'open')}
                className="text-xs text-[#0071e3] hover:underline font-semibold cursor-pointer"
              >
                Xem các bài đăng khác
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTrips.map((trip) => {
                const isDriver = trip.type === 'driver_offer';
                const isFull = trip.status === 'full';
                const expired = isTripExpired(trip);
                const price = trip.basePricePerSeat || trip.expectedPrice || trip.suggestedContribution || 150000;
                const seats = trip.availableSeats || trip.seatsNeeded || 1;
                const tripBookings = getBookingsForTrip(trip.id);
                const carDisplay = getCarDisplay(trip.carType, trip.capacity);
                const fromParsed = parseLocation(trip.from);
                const toParsed = parseLocation(trip.to);
                const pickupSpot = trip.pickupSpot || trip.waypointNote || fromParsed.sub || toParsed.sub;

                return (
                  <article
                    key={trip.id}
                    className={`p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#1c1c1e] border transition-all duration-200 flex flex-col justify-between gap-4 relative group ${
                      expired
                        ? 'border-amber-500/20 bg-amber-50/10 dark:bg-[#1f1e1a] opacity-90'
                        : isFull
                          ? 'border-slate-200 dark:border-slate-800 opacity-85 bg-slate-50/40 dark:bg-[#18181a]'
                          : 'border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,113,227,0.08)] hover:border-[#0071e3]/40'
                    }`}
                  >
                    <div className="space-y-3.5">
                      {/* ── A. HEADER: GIỜ, MÃ & PILL TRẠNG THÁI ── */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-base sm:text-lg tabular tracking-tight">
                            {getTimeSlotLabel(trip).replace(/\s*\([^)]*\)/g, '')}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            · {formatCleanDateLabel(trip.date)}
                          </span>
                          {trip.maskedCode && (
                            <span className="font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {trip.maskedCode}
                            </span>
                          )}
                        </div>

                        {/* Status Beacon */}
                        {expired ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold inline-flex items-center gap-1.5 border border-amber-200/80">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>Đã qua giờ</span>
                          </span>
                        ) : isFull ? (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>{isDriver ? 'Đã đủ chỗ' : 'Đã có xe'}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1.5 border border-emerald-200/80 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{isDriver ? 'Đang nhận khách' : 'Đang tìm xe'}</span>
                          </span>
                        )}
                      </div>

                      {/* ── B. LỘ TRÌNH A ➔ B CHUẨN DASHBOARD (ĐỒNG BỘ MŨI TÊN NGANG) ── */}
                      <div
                        onClick={() => (onViewTrip ? onViewTrip(trip) : onViewInMarket?.(trip))}
                        className="space-y-2 cursor-pointer group/route"
                        title="Bấm để xem chi tiết lộ trình"
                      >
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white pt-0.5">
                          <span className="text-[16px] font-bold tracking-tight truncate max-w-[43%]">
                            {fromParsed.main}
                          </span>
                          <div className="shrink-0 flex items-center px-0.5 text-slate-400 dark:text-slate-500 group-hover/route:text-[#0071e3] transition-colors">
                            <svg
                              className="w-7 h-3 text-current shrink-0 group-hover/route:translate-x-0.5 transition-transform duration-200"
                              viewBox="0 0 28 12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M2 6h22.5M18.5 2.5L24.5 6L18.5 9.5" />
                            </svg>
                          </div>
                          <span className="text-[16px] font-bold tracking-tight truncate max-w-[43%]">
                            {toParsed.main}
                          </span>
                        </div>

                        {pickupSpot && (
                          <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400 bg-[#f5f5f7] dark:bg-[#252528] px-3 py-1.5 rounded-xl truncate">
                            <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="truncate">
                              Đón: {pickupSpot}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* ── C. THÔNG SỐ: GIÁ, SỐ GHẾ, DÒNG XE ── */}
                      <div className="flex items-center justify-between text-xs gap-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.06] flex-wrap">
                        <div className="flex items-baseline gap-1">
                          <span className="font-extrabold text-[17px] text-[#0071e3] font-mono tabular">
                            {formatVND(price)}
                          </span>
                          <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-medium">/ghế</span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium text-[12px]">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>{isDriver ? `Nhận ghép ${seats} ghế` : `Cần ${seats} ghế`}</span>
                          </span>
                          {isDriver && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span className="inline-flex items-center gap-1">
                                <Car className="w-3.5 h-3.5 text-slate-400" />
                                <span className="truncate max-w-[120px]">{carDisplay}</span>
                              </span>
                              {trip.carPhotos && trip.carPhotos.length > 0 && (
                                <>
                                  <span className="text-slate-300 dark:text-slate-600">·</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onViewCarPhotos?.(trip);
                                    }}
                                    className="inline-flex items-center gap-1 text-[#0071e3] hover:underline cursor-pointer"
                                    title="Xem các góc ảnh xe thật"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                    <span>{trip.carPhotos.length} ảnh</span>
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* ── C2. SƠ ĐỒ LẤP ĐẦY GHẾ XE (SEAT OCCUPANCY GAUGE) ── */}
                      {isDriver && (
                        <SeatOccupancyGauge trip={trip} bookings={tripBookings} />
                      )}

                      {/* ── D. CẦU NỐI THÔNG MINH: KHÁCH ĐÃ ĐẶT CHỖ (CROSS-LINK STRIP) ── */}
                      {tripBookings.length > 0 && (
                        <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-between gap-2 animate-in fade-in duration-200">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                              {tripBookings.length}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-emerald-950 dark:text-emerald-100 truncate">
                                {tripBookings.length} người đi cùng đã giữ chỗ
                              </p>
                              <p className="text-[10.5px] text-emerald-700 dark:text-emerald-300 truncate">
                                {tripBookings.map((b) => toPublicAlias(b.contactName)).join(', ')}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onViewBookings?.(trip, tripBookings)}
                            className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shrink-0 inline-flex items-center gap-1 transition-all active:scale-95 shadow-2xs cursor-pointer"
                            title="Chuyển sang xem lịch hẹn & liên hệ với khách"
                          >
                            <span>Xem hẹn</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ── E. ACTION TOOLBAR (APPLE TACTILE SQUIRCLE) ── */}
                    <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.06] space-y-2">
                      {expired ? (
                        <button
                          type="button"
                          onClick={() => onRePublishTrip?.(trip)}
                          className="w-full h-9 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs active:scale-[0.98] transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                          title="Tái đăng chuyến này cho ngày mai trong 2 giây"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-100" />
                          <span>⚡ Tái đăng chuyến này cho ngày mai</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 w-full">
                          {/* Nút Toggle 1-chạm: Nhận khách ⇄ Tạm đóng */}
                          <button
                            type="button"
                            onClick={() => onToggleStatus?.(trip.id, isFull ? 'active' : 'full')}
                            className={`flex-1 h-9 px-3 rounded-xl font-bold text-xs active:scale-95 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                              isFull
                                ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/90 shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 shadow-2xs'
                            }`}
                            title={isFull ? 'Mở lại bài đăng để tiếp tục nhận khách' : 'Đánh dấu đã đủ chỗ'}
                          >
                            {isFull ? (
                              <>
                                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Mở nhận khách</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5 text-slate-500" />
                                <span>Báo đủ chỗ</span>
                              </>
                            )}
                          </button>

                          {/* Nút Chỉnh sửa */}
                          <button
                            type="button"
                            onClick={() => onEditTrip?.(trip)}
                            className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 font-semibold text-xs active:scale-95 transition-all inline-flex items-center justify-center gap-1 cursor-pointer shadow-2xs whitespace-nowrap"
                            title="Chỉnh sửa thông tin lộ trình, giờ chạy hoặc giá"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                            <span className="hidden sm:inline">Chỉnh sửa</span>
                          </button>

                          {/* Nút Sao chép chạy lại ngày mai */}
                          <button
                            type="button"
                            onClick={() => onRePublishTrip?.(trip)}
                            className="h-9 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 font-semibold text-xs active:scale-95 transition-all inline-flex items-center justify-center gap-1 cursor-pointer shadow-2xs whitespace-nowrap"
                            title="Tạo thêm 1 chuyến tương tự cho ngày mai (1-chạm)"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span className="hidden md:inline">Ngày mai</span>
                          </button>

                          {/* Nút Xem trên sàn */}
                          <button
                            type="button"
                            onClick={() => (onViewTrip ? onViewTrip(trip) : onViewInMarket?.(trip))}
                            className="h-9 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 font-semibold text-xs active:scale-95 transition-all inline-flex items-center justify-center cursor-pointer shadow-2xs"
                            title="Xem chi tiết bài đăng trên sàn"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                          </button>

                          {/* Nút Xoá */}
                          <button
                            type="button"
                            onClick={() => setTripToDelete(trip)}
                            className="w-9 h-9 rounded-xl text-rose-600 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/40 border border-rose-200/70 active:scale-95 transition-all inline-flex items-center justify-center cursor-pointer shrink-0"
                            title="Gỡ bài đăng khỏi hệ thống"
                            aria-label="Xóa bài đăng"
                          >
                            <Trash2 className="w-4 h-4 text-rose-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL XÁC NHẬN XOÁ BÀI ĐĂNG CHUẨN APPLE HIG ── */}
      {tripToDelete && (
        <Modal
          onClose={() => setTripToDelete(null)}
          size="sm"
          icon={Trash2}
          iconTone="danger"
          title="Xác nhận xoá bài đăng"
          subtitle="Thao tác này sẽ gỡ bài khỏi sàn ghép xe"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTripToDelete(null)}
                className="px-4 font-semibold text-slate-700 dark:text-slate-300"
              >
                Giữ lại
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleExecuteDelete}
                className="px-5 font-bold rounded-full shadow-sm"
              >
                Xác nhận xoá
              </Button>
            </div>
          }
        >
          <div className="p-1 space-y-3.5 text-left">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {tripToDelete.maskedCode || 'Mã chuyến'}
                </span>
                <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatVND(
                    tripToDelete.basePricePerSeat ||
                      tripToDelete.price ||
                      tripToDelete.expectedPrice ||
                      tripToDelete.suggestedContribution ||
                      0
                  )}
                  /{tripToDelete.type === 'passenger_request' ? 'người' : 'ghế'}
                </span>
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                {tripToDelete.from} ➔ {tripToDelete.to}
              </div>
              <div className="text-[11.5px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Giờ khởi hành: {getTimeSlotLabel(tripToDelete)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Bài đăng này sẽ được gỡ khỏi danh sách tìm kiếm và không thể hoàn tác. Nếu đã có người đi cùng hẹn trước, bạn vui lòng chủ động thông báo cho họ nhé.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
