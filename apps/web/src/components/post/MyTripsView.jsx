import React, { useState, useEffect } from 'react';
import { 
  Car, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  PlusCircle, 
  ExternalLink, 
  Users, 
  Clock, 
  ShieldCheck, 
  Sparkles, 
  Fuel, 
  MapPin, 
  LogIn, 
  RefreshCw,
  Info,
  Camera
} from 'lucide-react';
import { 
  formatVND, 
  getTimeSlotLabel, 
  getRouteCorridor, 
  ROUTE_BENCHMARKS,
  formatTripDateDisplay
} from '@carmate/shared';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import { SectionHeader } from '../ui/EmptyState.jsx';
import { RouteTimeline } from '../market/TripCard.jsx';
import { useI18n } from '../../i18n/index.jsx';

export default function MyTripsView({
  driverOffers = [],
  passengerRequests = [],
  currentUser = null,
  onOpenAuth,
  onEditTrip,
  onToggleStatus,
  onDeleteTrip,
  onPostNew,
  onViewInMarket,
  onViewTrip,
  onViewCarPhotos
}) {
  const { lang } = useI18n();
  const [myTripIds, setMyTripIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'open' | 'full'

  // Đồng bộ danh sách chuyến xe theo trạng thái đăng nhập
  const syncTripIds = () => {
    try {
      if (currentUser) {
        const userKey = `carmate_my_trip_ids_${currentUser.id || currentUser.phone}`;
        const stored = JSON.parse(localStorage.getItem(userKey) || localStorage.getItem('carmate_my_trip_ids') || '[]');
        setMyTripIds(Array.isArray(stored) ? stored : []);
      } else {
        // Khi chưa đăng nhập (khách vãng lai): Chỉ lấy chuyến tạo tạm trên máy này
        // Tự động dọn dẹp khóa cũ carmate_my_trip_ids nếu còn sót từ phiên trước
        if (localStorage.getItem('carmate_my_trip_ids')) {
          localStorage.removeItem('carmate_my_trip_ids');
        }
        const guestStored = JSON.parse(localStorage.getItem('carmate_guest_trip_ids') || '[]');
        setMyTripIds(Array.isArray(guestStored) ? guestStored : []);
      }
    } catch {
      setMyTripIds([]);
    }
  };

  useEffect(() => {
    syncTripIds();
  }, [currentUser]);

  // Tổng hợp tất cả chuyến của người dùng
  const allTrips = [...driverOffers, ...passengerRequests];
  const myTrips = allTrips.filter((t) => {
    if (currentUser) {
      if (t.userId && t.userId === currentUser.id) return true;
      if (currentUser.phone && t.phoneReal && t.phoneReal === currentUser.phone) return true;
      return myTripIds.includes(t.id);
    }
    // Chế độ Khách: Chỉ nhận diện chuyến do chính máy này tạo tạm
    return myTripIds.includes(t.id);
  });

  const activeTripsCount = myTrips.filter((t) => t.status !== 'full').length;
  const fullTripsCount = myTrips.filter((t) => t.status === 'full').length;

  const filteredTrips = myTrips.filter((t) => {
    if (statusFilter === 'open') return t.status !== 'full';
    if (statusFilter === 'full') return t.status === 'full';
    return true;
  });

  const handleConfirmDelete = (trip) => {
    const codeStr = trip.maskedCode ? `(${trip.maskedCode})` : '';
    if (window.confirm(`Bạn có chắc chắn muốn xóa chuyến đi "${trip.from} ➔ ${trip.to}" ${codeStr} không?`)) {
      onDeleteTrip?.(trip.id);
      const updated = myTripIds.filter((id) => id !== trip.id);
      setMyTripIds(updated);
      try {
        const storageKey = currentUser ? `carmate_my_trip_ids_${currentUser.id || currentUser.phone}` : 'carmate_guest_trip_ids';
        localStorage.setItem(storageKey, JSON.stringify(updated));
        localStorage.removeItem('carmate_my_trip_ids');
      } catch {}
    }
  };

  const handleClearGuestStorage = () => {
    try {
      localStorage.removeItem('carmate_guest_trip_ids');
      localStorage.removeItem('carmate_my_trip_ids');
      setMyTripIds([]);
      window.dispatchEvent(new Event('storage'));
    } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── 1. HEADER & APPLE CAPSULE SEGMENTED FILTER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SectionHeader
          icon={Car}
          title="Chuyến Đi Của Tôi"
          description={
            currentUser
              ? `Tài khoản: ${currentUser.name} (${currentUser.phone || 'Đã xác thực'}) · Quản lý trạng thái nhận khách thời gian thực.`
              : 'Quản lý, cập nhật giờ khởi hành, giá vé hoặc đóng chỗ khi đã đủ khách.'
          }
        />

        {myTrips.length > 0 && (
          <div className="inline-flex items-center p-1 rounded-full bg-[#e8e8ed] dark:bg-slate-800 border border-black/[0.04] dark:border-white/[0.06] text-xs self-start sm:self-auto shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tất cả ({myTrips.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('open')}
              className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                statusFilter === 'open'
                  ? 'bg-white dark:bg-slate-900 text-[#107c41] dark:text-emerald-400 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Còn chỗ ({activeTripsCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('full')}
              className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                statusFilter === 'full'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Đã đủ ({fullTripsCount})
            </button>
          </div>
        )}
      </div>

      {/* ── 2. CẢNH BÁO / HƯỚNG DẪN ĐỒNG BỘ DÀNH CHO KHÁCH (NẾU CÓ CHUYẾN TẠO TẠM) ── */}
      {!currentUser && myTrips.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#f5f5f7] dark:bg-[#1f1f22] border border-black/[0.06] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Info className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white leading-snug">
                Đang hiển thị {myTrips.length} chuyến xe tạo tạm thời trên trình duyệt này
              </p>
              <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                Đăng nhập bằng Zalo để bảo vệ số điện thoại và đồng bộ vĩnh viễn trên mọi thiết bị.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-3 py-1.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-xs transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5 active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập Zalo đồng bộ</span>
            </button>
            <button
              type="button"
              onClick={handleClearGuestStorage}
              className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium text-xs transition-all cursor-pointer"
              title="Làm sạch dữ liệu lưu tạm trên máy này"
            >
              Làm sạch
            </button>
          </div>
        </div>
      )}

      {/* ── 3. NỘI DUNG CHÍNH (GUEST PASSPORT HERO HOẶC DANH SÁCH THẺ) ── */}
      {myTrips.length === 0 ? (
        !currentUser ? (
          /* Apple Privacy Passport Hero: Khi người dùng chưa đăng nhập */
          <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] inline-flex items-center justify-center border border-[#0071e3]/20 shadow-xs">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg sm:text-xl tracking-tight">
                Hộ Chiếu Số CarMate · Chuyến Đi Của Tôi
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Bạn đang duyệt ở chế độ <strong>Khách</strong> (Chưa đăng nhập). Hãy đăng nhập bằng Số điện thoại Zalo hoặc Google để tự động đồng bộ tất cả chuyến xe của bạn trên mọi thiết bị và quản lý nhận khách an toàn.
              </p>
            </div>

            {/* Ba trụ cột bảo vệ người dùng chuẩn Apple */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-lg mx-auto text-left pt-2">
              <div className="p-3 rounded-2xl bg-[#f5f5f7] dark:bg-[#252528] border border-black/[0.04] dark:border-white/[0.04]">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3]" />
                  <span>100% 0đ SMS</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Xác thực Zalo 1 chạm không tốn phí viễn thông
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-[#f5f5f7] dark:bg-[#252528] border border-black/[0.04] dark:border-white/[0.04]">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                  <Lock className="w-3.5 h-3.5 text-[#107c41]" />
                  <span>Bảo Mật SĐT</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Chỉ người ghép xe thành công mới liên hệ
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-[#f5f5f7] dark:bg-[#252528] border border-black/[0.04] dark:border-white/[0.04]">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Đồng Bộ Đa Thiết Bị</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Quản lý bài đăng tức thì trên máy tính và điện thoại
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-sm transition-all cursor-pointer shadow-md active:scale-95 inline-flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập bằng Zalo / Số điện thoại</span>
              </button>

              <button
                type="button"
                onClick={onPostNew}
                className="w-full sm:w-auto px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-all cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4 text-slate-500" />
                <span>Tạo chuyến xe mới</span>
              </button>
            </div>
          </div>
        ) : (
          /* Empty state: Khi đã đăng nhập nhưng chưa tạo chuyến nào */
          <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] inline-flex items-center justify-center border border-[#0071e3]/20 shadow-xs">
              <Car className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">
                Chào {currentUser.name}! Bạn chưa đăng chuyến đi nào.
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Khi bạn đăng chuyến đi (Chủ xe có ghế trống hoặc Khách cần tìm xe), bài đăng sẽ hiển thị tại đây để bạn cập nhật giờ chạy, giá vé hoặc đóng chỗ khi đã đủ khách.
              </p>
            </div>
            <Button variant="primary" size="md" icon={PlusCircle} onClick={onPostNew} className="shadow-sm">
              Tạo chuyến đầu tiên ngay
            </Button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-medium">
            <span>Đang hiển thị {filteredTrips.length} / {myTrips.length} chuyến</span>
            <span>Tự động đồng bộ với bảng tin cộng đồng</span>
          </div>

          {filteredTrips.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.08] space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Không có chuyến đi nào trong mục này
              </p>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="text-xs text-[#0071e3] hover:underline font-semibold cursor-pointer"
              >
                Quay lại xem tất cả chuyến đi
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTrips.map((trip) => {
                const isDriver = trip.type === 'driver_offer';
                const isFull = trip.status === 'full';
                const price = trip.basePricePerSeat || trip.expectedPrice || trip.suggestedContribution || 150000;
                const seats = trip.availableSeats || trip.seatsNeeded || 1;
                const isConvenient = isDriver && (
                  trip.carCategory === 'convenient_trip' ||
                  trip.notes?.toLowerCase().includes('tiện chuyến') ||
                  trip.carType?.toLowerCase().includes('tiện chuyến')
                );

                // Tra cứu định mức kỹ thuật xăng RON 95 + BOT tuyến này
                const corridor = getRouteCorridor(trip.from, trip.to);
                const benchmark = corridor ? ROUTE_BENCHMARKS[corridor] : null;
                const fuelBotRef = benchmark ? benchmark.suggestedRate : (trip.suggestedContribution || price);

                return (
                  <div
                    key={trip.id}
                    className={`p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1c1c1e] border transition-all duration-200 flex flex-col justify-between gap-4 relative group ${
                      isFull
                        ? 'border-slate-200 dark:border-slate-800 opacity-85 bg-slate-50/50 dark:bg-[#18181a]'
                        : 'border-black/[0.08] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_0_0_1.5px_rgba(0,113,227,0.3),0_12px_28px_rgba(0,113,227,0.1)] active:shadow-[0_0_0_2px_rgba(0,113,227,0.5)] hover:border-[#0071e3]/50 active:border-[#0071e3]/80'
                    }`}
                  >
                    <div className="space-y-3.5">
                      {/* ── A. TOP BAR: CURSOR CODE BADGE & APPLE STATUS PILL ── */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          {trip.maskedCode && (
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 tracking-tight">
                              {trip.maskedCode}
                            </span>
                          )}

                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                            isDriver
                              ? isConvenient
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60'
                          }`}>
                            {isDriver ? (isConvenient ? 'Tiện chuyến' : 'Chủ xe gia đình') : 'Khách tìm xe'}
                          </span>

                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">
                            · {trip.date ? formatTripDateDisplay(trip.date) : 'Hôm nay'}
                          </span>
                        </div>

                        {/* Status Beacon */}
                        {isFull ? (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11.5px] font-bold inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                            <Lock className="w-3 h-3 text-slate-500" />
                            <span>Đã đủ người</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[11.5px] font-bold inline-flex items-center gap-1.5 border border-emerald-200/90 dark:border-emerald-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#107c41] animate-pulse" />
                            <span>Đang nhận khách</span>
                          </span>
                        )}
                      </div>

                      {/* ── B. ROUTE TIMELINE TRONG APPLE WARM CONTAINER ── */}
                      <div className="p-3.5 sm:p-4 rounded-xl bg-[#f5f5f7] dark:bg-[#252528] border border-black/[0.04] dark:border-white/[0.04]">
                        <RouteTimeline from={trip.from} to={trip.to} waypointNote={trip.waypointNote} compact />

                        {trip.waypointNote && (
                          <div className="mt-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center gap-1.5 text-[11.5px] text-slate-600 dark:text-slate-400 font-medium truncate">
                            <MapPin className="w-3 h-3 text-[#0071e3] shrink-0" />
                            <span className="truncate">Điểm đón: {trip.waypointNote}</span>
                          </div>
                        )}
                      </div>

                      {/* ── C. CURSOR TELEMETRY & COST BENCHMARK STRIP ── */}
                      <div className="space-y-2 pt-1 border-t border-black/[0.06] dark:border-white/[0.06]">
                        <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-[16px] text-[#0071e3] dark:text-[#2997ff] font-mono tabular">
                              {formatVND(price)}
                            </span>
                            <span className="text-[12px] text-slate-600 dark:text-slate-400 font-medium inline-flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span>{isDriver ? `Còn ${seats} chỗ trống` : `Cần ${seats} ghế`}</span>
                            </span>
                          </div>

                          <span className="text-[12px] text-slate-600 dark:text-slate-400 font-medium inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Giờ chạy: <strong className="text-slate-900 dark:text-white font-semibold">{getTimeSlotLabel(trip)}</strong></span>
                          </span>
                        </div>

                        {/* Inline Telemetry Badges */}
                        <div className="flex items-center gap-2 flex-wrap text-[11px]">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 font-mono font-medium" title="Định mức chi phí nhiên liệu & vé trạm thu phí theo quy chuẩn kỹ thuật">
                            <Fuel className="w-3 h-3 text-slate-500" />
                            <span>Định mức xăng + BOT: ~{formatVND(fuelBotRef)}</span>
                          </span>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 font-medium" title="Kết nối trực tiếp qua Zalo không mất phí viễn thông">
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            <span>Zalo Direct (0đ SMS)</span>
                          </span>

                          {trip.carPhotos && trip.carPhotos.length >= 3 && (
                            <button
                              type="button"
                              onClick={() => onViewCarPhotos?.(trip)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 font-medium hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="Xem các góc ảnh xe thực tế đã tải lên"
                            >
                              <Camera className="w-3 h-3 text-emerald-600" />
                              <span>{trip.carPhotos.length} ảnh xe (Đã che biển)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── D. ACTION TOOLBAR (APPLE TACTILE SQUIRCLE BUTTONS) ── */}
                    <div className="pt-3 flex items-center justify-between gap-2 border-t border-black/[0.06] dark:border-white/[0.06] flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEditTrip?.(trip)}
                          className="h-8.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200/80 dark:border-slate-700 font-semibold text-xs active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Chỉnh sửa thông tin lộ trình, giờ chạy và giá vé"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onToggleStatus?.(trip.id, isFull ? 'active' : 'full')}
                          className={`h-8.5 px-3 rounded-xl font-semibold text-xs active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                            isFull
                              ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-800/60 shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
                          }`}
                          title={isFull ? 'Mở lại bài đăng để tiếp tục nhận khách' : 'Đánh dấu đã đủ người để không nhận thêm liên hệ Zalo'}
                        >
                          {isFull ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          <span>{isFull ? 'Mở nhận khách' : 'Báo đủ chỗ'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewTrip ? onViewTrip(trip) : onViewInMarket?.(trip)}
                          className="h-8.5 px-3.5 rounded-xl bg-[#0071e3]/10 hover:bg-[#0071e3]/20 text-[#0071e3] dark:text-[#2997ff] border border-[#0071e3]/20 font-bold text-xs active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Xem chi tiết thẻ vé & chia sẻ bài đăng"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Xem bài</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(trip)}
                          className="h-8.5 px-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 font-semibold text-xs active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
                          title="Xóa bài đăng này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
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
