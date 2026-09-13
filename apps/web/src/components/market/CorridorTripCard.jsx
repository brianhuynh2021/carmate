import React from 'react';
import { ChevronRight } from 'lucide-react';
import { formatVND } from '@carmate/shared';

/**
 * Helper format buổi và ngày ngắn gọn cho card rút gọn
 */
function formatShortTime(departureLabel = '04:30', departureDate = null) {
  let hour = 4;
  if (departureLabel && departureLabel.includes(':')) {
    const [h] = departureLabel.split(':').map(Number);
    if (!isNaN(h)) hour = h;
  }
  let session = 'Sáng';
  if (hour >= 11 && hour < 14) session = 'Trưa';
  else if (hour >= 14 && hour < 18) session = 'Chiều';
  else if (hour >= 18 || hour < 4) session = 'Tối';

  if (departureDate === 'Ngày mai') {
    return `${session} mai`;
  }
  if (departureDate === 'Hôm nay' || !departureDate) {
    return `${session} nay`;
  }

  const targetDate = new Date(departureDate);
  if (!isNaN(targetDate.getTime())) {
    const d = targetDate.getDate();
    const m = targetDate.getMonth() + 1;
    return `${session} (${d}/${m})`;
  }

  return `${session} nay`;
}

/**
 * Helper rút gọn trạm đón/trả hiển thị gãy gọn trên màn hình hẹp
 */
function cleanStationName(raw, fallback = '') {
  const text = String(raw || fallback).trim();
  if (!text) return fallback;
  if (/tân khai/i.test(text)) return 'Tân Khai';
  if (/bù đốp/i.test(text)) return 'Bù Đốp';
  if (/lộc ninh/i.test(text)) return 'Lộc Ninh';
  if (/bình long/i.test(text)) return 'Bình Long';
  if (/chơn thành/i.test(text)) return 'Chơn Thành';
  if (/bàu bàng/i.test(text)) return 'Bàu Bàng';
  if (/chợ rẫy/i.test(text)) return 'BV Chợ Rẫy (TP.HCM)';
  if (/hàng xanh/i.test(text)) return 'Hàng Xanh';
  if (/tân sơn nhất|tsn/i.test(text)) return 'Sân bay TSN';
  if (/bến xe miền đông|bình triệu/i.test(text)) return 'Bình Triệu / BX';
  return text.split('/')[0].replace(/\(.*?\)/g, '').trim();
}

/**
 * THẺ CHUYẾN XE RÚT GỌN (COMPACT TRIP CARD ~85px)
 *
 * Chuẩn Scannable List (BlaBlaCar / Vexere Style):
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 07:00    Xe 7 chỗ gia đình                 165.000 đ        │
 * │ Sáng mai Tân Khai (QL13) ➔ Chợ Rẫy/ĐHYD    Còn 2 chỗ  ›     │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Khách lướt ngón tay thấy ngay 3-4 lựa chọn trong ngày, không bị ngộp thở vì chữ.
 * Chạm vào dòng hoặc icon › mở Bottom Sheet chi tiết đầy đủ ngữ cảnh & uy tín.
 */
export default function CorridorTripCard({
  trip,
  originName = 'Tân Khai (QL13)',
  destName = 'Cụm BV Chợ Rẫy / BV Đại học Y Dược',
  segmentPrice = 165000,
  onSelectTrip,
  onBookNow
}) {
  if (!trip) return null;

  const seatsAvailable = Number(trip.seatsAvailable ?? 1);
  const isSoldOut = seatsAvailable <= 0;
  const displayPrice = trip.pricePerSeat || segmentPrice;
  const timeSubLabel = formatShortTime(trip.departureLabel, trip.departureDate);

  // Phân loại xe
  const totalSeats = Number(trip.totalSeats || trip.capacity || 4);
  const is7Seater = totalSeats >= 6 || /7 chỗ|xpander|innova|veloz|fortuner|carnival/i.test(trip.vehicleModel || '');
  const vehicleTypeLabel = is7Seater ? 'Xe 7 chỗ gia đình' : 'Xe gia đình tiện chuyến';

  const fromLabel = cleanStationName(originName, 'Tân Khai');
  const toLabel = cleanStationName(destName, 'Chợ Rẫy');

  const handleClick = () => {
    if (isSoldOut) return;
    if (onSelectTrip) onSelectTrip(trip);
    else if (onBookNow) onBookNow(trip);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`group w-full rounded-2xl border transition-all duration-150 p-3 sm:p-3.5 select-none ${
        isSoldOut
          ? 'bg-slate-50/70 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 opacity-70 cursor-not-allowed'
          : 'bg-white dark:bg-[#1c1c1e] border-slate-200/90 dark:border-white/15 shadow-2xs hover:shadow-md hover:border-[#0071e3]/60 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer'
      }`}
    >
      <div className="flex items-center justify-between gap-2.5 sm:gap-3.5 min-w-0">
        {/* ── CỘT 1: GIỜ CHẠY & BUỔI ── */}
        <div className="shrink-0 min-w-[68px] sm:min-w-[78px]">
          <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white leading-tight">
            {trip.departureLabel || '04:30'}
          </div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {timeSubLabel}
          </div>
        </div>

        {/* Vạch chia nhẹ */}
        <div className="w-px h-8 bg-slate-100 dark:bg-white/10 shrink-0" />

        {/* ── CỘT 2: LOẠI XE & LỘ TRÌNH ── */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">
            {vehicleTypeLabel}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1 font-medium">
            <span className="truncate">{fromLabel}</span>
            <span className="text-slate-400 shrink-0 font-normal">➔</span>
            <span className="truncate text-slate-700 dark:text-slate-300 font-semibold">{toLabel}</span>
          </div>
        </div>

        {/* ── CỘT 3: GIÁ VÉ, SỐ CHỖ & ICON › ── */}
        <div className="shrink-0 flex items-center gap-2 sm:gap-3 text-right">
          <div>
            <div className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 leading-tight">
              {formatVND(displayPrice)}
            </div>
            <div className="text-[10.5px] sm:text-[11px] mt-0.5 font-medium">
              {isSoldOut ? (
                <span className="text-slate-400">Hết chỗ</span>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Còn {seatsAvailable} chỗ
                </span>
              )}
            </div>
          </div>

          {/* Affordance icon › */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-white/10 group-hover:bg-[#0071e3] group-hover:text-white text-slate-400 flex items-center justify-center transition-colors duration-150 shrink-0">
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
