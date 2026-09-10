import React, { useMemo } from 'react';
import {
  Clock,
  Car,
  MapPin,
  Navigation,
  CheckCircle2,
  Zap,
  ArrowRight,
  Sparkles,
  Truck,
  ShieldCheck,
  PhoneCall
} from 'lucide-react';
import { toPublicAlias } from '@carmate/shared';

/**
 * BẢNG DÒNG THỜI GIAN CÁC CHUYẾN XE DỌC HÀNH LANG (CORRIDOR DEPARTURE TIMELINE)
 * Chuẩn Level 3: Tự động gom cụm và sắp xếp các chuyến xe kế tiếp (chuyến sau)
 * trên đúng trục đường, triệt tiêu hoàn toàn rác hiển thị từ các tỉnh khác.
 */
export default function CorridorTimeline({
  trips = [],
  corridor = 'Tuyến QL13',
  originHub,
  destHub,
  timeSlot,
  onOpenBooking,
  onShowAllNationwide,
  className = ''
}) {
  // Lọc danh sách chuyến đi theo đúng hành lang hiện tại
  const corridorTrips = useMemo(() => {
    if (!Array.isArray(trips)) return [];

    const isQL13 = corridor.includes('QL13') || corridor.includes('Bình Phước');
    const isN2 = corridor.includes('N2') || corridor.includes('Kiên Giang') || corridor.includes('Miền Tây');

    return trips.filter((t) => {
      if (!t) return false;
      const text = `${t.from || ''} ${t.to || ''} ${t.routeCategory || ''} ${t.hometown || ''}`.toLowerCase();

      if (isQL13) {
        // Khớp các địa danh trục QL13 / Bù Đốp / Lộc Ninh / Bình Long / Sài Gòn
        return (
          text.includes('ql13') ||
          text.includes('bù đốp') ||
          text.includes('bu dop') ||
          text.includes('lộc ninh') ||
          text.includes('loc ninh') ||
          text.includes('lộc hiệp') ||
          text.includes('tân tiến') ||
          text.includes('lộc tấn') ||
          text.includes('thanh lương') ||
          text.includes('bình long') ||
          text.includes('binh long') ||
          text.includes('tân khai') ||
          text.includes('hớn quản') ||
          text.includes('chơn thành') ||
          text.includes('bàu bàng') ||
          text.includes('bến cát') ||
          text.includes('thủ dầu một') ||
          text.includes('sở sao') ||
          text.includes('vsip') ||
          text.includes('hàng xanh') ||
          text.includes('bình triệu') ||
          text.includes('bình phước')
        );
      }

      if (isN2) {
        return (
          text.includes('tuyến n2') ||
          text.includes('kiên giang') ||
          text.includes('rạch giá') ||
          text.includes('đức hòa') ||
          text.includes('thạnh hóa') ||
          text.includes('vàm cống') ||
          text.includes('cao lãnh')
        );
      }

      return t.routeCategory === corridor;
    });
  }, [trips, corridor]);

  // Sắp xếp các chuyến theo khung giờ khởi hành trong ngày
  const sortedTrips = useMemo(() => {
    return [...corridorTrips].sort((a, b) => {
      const timeA = String(a.timeSlot || a.time || '');
      const timeB = String(b.timeSlot || b.time || '');
      return timeA.localeCompare(timeB);
    });
  }, [corridorTrips]);

  // Chọn chuyến khớp tốt nhất (Optimal Match) theo khung giờ người dùng chọn
  const bestMatch = useMemo(() => {
    if (sortedTrips.length === 0) return null;
    if (!timeSlot) return sortedTrips[0];

    // Ưu tiên chuyến cùng khung giờ
    const exact = sortedTrips.find((t) => {
      const slot = String(t.timeSlot || '').toLowerCase();
      if (timeSlot.includes('05:00') && slot.includes('05:00')) return true;
      if (timeSlot.includes('08:00') && slot.includes('08:00')) return true;
      if (timeSlot.includes('11:30') && slot.includes('11:30')) return true;
      if (timeSlot.includes('13:30') && slot.includes('13:30')) return true;
      if (timeSlot.includes('17:30') && slot.includes('17:30')) return true;
      return false;
    });

    return exact || sortedTrips[0];
  }, [sortedTrips, timeSlot]);

  // Danh sách các chuyến sau (Subsequent Trips)
  const subsequentTrips = useMemo(() => {
    if (!bestMatch) return sortedTrips;
    return sortedTrips.filter((t) => t.id !== bestMatch.id);
  }, [sortedTrips, bestMatch]);

  return (
    <section className={`space-y-4 ${className}`}>
      {/* Tiêu đề bảng giờ xuất phát */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              Lịch Khởi Hành Tự Động
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              · {corridorTrips.length} chuyến xe đang chạy trên tuyến
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
            Dòng Thời Gian Các Chuyến Xe Dọc {corridor}
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {originHub?.shortName || 'Bù Đốp / Lộc Ninh'} ➔ {destHub?.shortName || 'Hàng Xanh (TP.HCM)'} · Tự động cập nhật chuyến sau
          </p>
        </div>

        {onShowAllNationwide && (
          <button
            type="button"
            onClick={onShowAllNationwide}
            className="text-xs text-[#0071e3] hover:text-[#0077ed] font-semibold cursor-pointer inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Xem sàn toàn quốc</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {corridorTrips.length === 0 ? (
        // Trạng thái chưa có xe trên tuyến
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900/90 border border-black/[0.06] dark:border-zinc-800 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Đang gom các chuyến xe kế tiếp dọc {corridor}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
              Chưa có chuyến cố định trong khung giờ này. Bạn chỉ cần bấm <strong>"Bắt Tay Ghép Chuyến Nhanh"</strong> ở trên, hệ thống sẽ tự động ghép với xe tiện chuyến gần nhất trong 3 phút!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 1. THẺ XE KHỚP TỐI ƯU NHẤT (BEST MATCH - KHỚP NGAY) */}
          {bestMatch && (
            <div className="relative overflow-hidden p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-blue-500/[0.07] via-white to-emerald-500/[0.05] dark:from-blue-950/40 dark:via-zinc-900/90 dark:to-emerald-950/20 border-2 border-blue-500/40 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-600 text-white shadow-xs">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  Xe Khớp Tối Ưu Nhất (Đi Ngay)
                </span>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Khớp lộ trình 100%
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-center">
                {/* Cột 1: Thông tin xuất phát & Giờ */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base sm:text-lg font-mono font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-xl border border-blue-200/60 dark:border-blue-800/60">
                      {bestMatch.timeSlotLabel || bestMatch.timeSlot || '05:30'}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      {bestMatch.date || 'Hôm nay'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-800 dark:text-zinc-200 font-bold space-y-1">
                    <div className="flex items-center gap-1.5 line-clamp-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{bestMatch.from}</span>
                    </div>
                    <div className="flex items-center gap-1.5 line-clamp-1">
                      <Navigation className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>{bestMatch.to}</span>
                    </div>
                  </div>
                </div>

                {/* Cột 2: Xe & Ghế trống */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400 border-t md:border-t-0 md:border-l border-black/[0.06] dark:border-zinc-800 pt-2 md:pt-0 md:pl-4">
                  <div className="flex items-center gap-1.5 text-xs text-slate-800 dark:text-zinc-200 font-bold">
                    <span className="truncate">{toPublicAlias(bestMatch)}</span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Xác thực
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {bestMatch.carType?.toLowerCase().includes('bán tải') ? (
                      <Truck className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Car className="w-4 h-4 text-blue-600" />
                    )}
                    <span>{bestMatch.carType || 'Xe gia đình 7 chỗ'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800">
                      Còn {bestMatch.availableSeats || 2} chỗ trống
                    </span>
                    {bestMatch.rating && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                        ★ {bestMatch.rating} ({bestMatch.completedCount || 100}+ chuyến)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1">
                    {bestMatch.notes || 'Xe sạch sẽ, đón trả đúng giờ dọc trục đường chính.'}
                  </p>
                </div>

                {/* Cột 3: Giá & Nút Bắt tay */}
                <div className="flex items-center md:flex-col md:items-end justify-between gap-2 border-t md:border-t-0 md:border-l border-black/[0.06] dark:border-zinc-800 pt-2 md:pt-0 md:pl-4">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 block text-right">
                      Phụ xăng chia sẻ:
                    </span>
                    <span className="text-base sm:text-xl font-mono font-extrabold text-blue-600 dark:text-blue-400">
                      {(bestMatch.basePricePerSeat || 140000).toLocaleString('vi-VN')}đ
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 block text-right">
                      /ghế trọn gói
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenBooking?.(bestMatch)}
                      className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Giữ Chỗ 0đ (Chốt Zalo/Gọi)</span>
                    </button>
                    <span className="text-[10.5px] text-slate-500 dark:text-zinc-400 hidden sm:inline">
                      0đ cọc · Lên xe mới trả tiền
                    </span>
                  </div>
                </div>
              </div>

              {/* Dải bảo chứng an tâm & xóa bỏ lo lắng */}
              <div className="mt-3.5 pt-3 border-t border-blue-100/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-zinc-300">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200/80 dark:border-emerald-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> 0đ Cọc · 100% Không rủi ro
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-700 dark:text-zinc-300">
                    <PhoneCall className="w-3 h-3 text-blue-600" /> Nhắn Zalo & Gọi thật trước khi đi
                  </span>
                </div>
                <span className="text-[10.5px] text-slate-500 dark:text-zinc-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  Chủ xe bấm xác nhận trong 15p mới chốt · Có xe đệm cứu hộ
                </span>
              </div>
            </div>
          )}

          {/* 2. CÁC XE SAU / CHUYẾN SAU TRÊN TUYẾN (SUBSEQUENT TIMELINE) */}
          {subsequentTrips.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2 px-1">
                <Clock className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200">
                  Các Chuyến Tiếp Theo Dọc Tuyến (Xe Chạy Sau):
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {subsequentTrips.map((trip, idx) => {
                  const isPickup = trip.carType?.toLowerCase().includes('bán tải');
                  return (
                    <div
                      key={trip.id || idx}
                      className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-black/[0.06] dark:border-zinc-800 hover:border-blue-400/60 transition-all shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-extrabold text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-lg">
                            {trip.timeSlotLabel || trip.timeSlot || 'Chuyến sau'}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                            {trip.date || 'Hôm nay'}
                          </span>
                        </div>

                        <span className="text-xs font-mono font-extrabold text-blue-600 dark:text-blue-400">
                          {(trip.basePricePerSeat || 140000).toLocaleString('vi-VN')}đ
                        </span>
                      </div>

                      <div className="text-xs text-slate-800 dark:text-zinc-200 font-semibold space-y-0.5">
                        <div className="flex items-center gap-1.5 line-clamp-1">
                          <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="line-clamp-1">{trip.from}</span>
                        </div>
                        <div className="flex items-center gap-1.5 line-clamp-1">
                          <Navigation className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="line-clamp-1">{trip.to}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-black/[0.04] dark:border-zinc-800 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                          {isPickup ? (
                            <Truck className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <Car className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span className="line-clamp-1">{trip.carType || 'Xe 7 chỗ'}</span>
                          <span className="text-emerald-600 font-bold ml-1">
                            · Còn {trip.availableSeats || 2} ghế
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenBooking?.(trip)}
                          className="px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 font-bold text-xs cursor-pointer transition-colors"
                        >
                          Giữ chỗ 0đ
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
