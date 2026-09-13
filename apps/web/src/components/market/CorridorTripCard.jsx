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
  _destName = 'Cụm BV Chợ Rẫy / BV Đại học Y Dược',
  segmentPrice = 165000,
  isEarliest = false,
  tripIndex = 0,
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
  const vehicleTypeLabel = is7Seater ? 'Xe nhà 7 chỗ' : 'Xe nhà 5 chỗ';

  // Lấy USP thực chiến cho từng chuyến xe (Tufte Data-Ink)
  const uspLabel = (() => {
    if (trip.usp) return trip.usp;
    if (trip.pickupSubtext) return trip.pickupSubtext;
    if (isEarliest || tripIndex === 0) {
      const fromClean = cleanStationName(originName, 'Tân Khai');
      return `Đón trạm ${fromClean}`;
    }
    if (tripIndex === 1) {
      const driverName = trip.driverName || 'Huỳnh';
      const rating = trip.driverRating ? `★${trip.driverRating}` : '★5.0';
      return `Chủ xe ${driverName} (${rating})`;
    }
    return 'Không nhồi nhét ghế';
  })();

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
      className={`group w-full rounded-2xl border transition-all duration-150 px-3 py-2.5 sm:px-3.5 select-none ${
        isSoldOut
          ? 'bg-slate-50/70 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 opacity-70 cursor-not-allowed'
          : isEarliest
          ? 'bg-blue-50/30 dark:bg-blue-950/20 border-blue-400/60 dark:border-blue-500/40 ring-1 ring-blue-500/20 shadow-2xs hover:shadow-md hover:border-[#0071e3] hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer'
          : 'bg-white dark:bg-[#1c1c1e] border-slate-200/90 dark:border-white/15 shadow-2xs hover:shadow-md hover:border-slate-300 dark:hover:border-white/25 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer'
      }`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        {/* ── CỘT 1: GIỜ CHẠY & BUỔI (Khóa cứng w-[70px]) ── */}
        <div className="w-[70px] shrink-0 text-left">
          <div className="text-[15px] sm:text-base font-extrabold font-mono text-slate-900 dark:text-white leading-tight">
            {trip.departureLabel || '04:30'}
          </div>
          <div className="mt-0.5">
            {isEarliest ? (
              <span className="inline-block text-[8.5px] font-bold px-1.5 py-0.2 rounded-full bg-[#0071e3] text-white tracking-tight">
                Gần nhất
              </span>
            ) : (
              <span className="text-[10px] sm:text-[10.5px] font-medium text-slate-500 dark:text-slate-400 truncate block">
                {timeSubLabel}
              </span>
            )}
          </div>
        </div>

        {/* ── CỘT 2: LOẠI XE & ĐIỂM ĐẶC TRƯNG (Bung trọn vẹn không bị cắt ...) ── */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white truncate leading-tight">
            {vehicleTypeLabel}
          </div>
          <div
            className={`text-[11px] font-medium truncate mt-0.5 leading-tight ${
              isEarliest
                ? 'text-emerald-700 dark:text-emerald-400'
                : tripIndex === 1
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-purple-700 dark:text-purple-400'
            }`}
          >
            {uspLabel}
          </div>
        </div>

        {/* ── CỘT 3: GIÁ VÉ, SỐ CHỖ & NÚT TRÒN 26PX (Khóa cứng shrink-0) ── */}
        <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 text-right">
          <div>
            <div className="text-[13.5px] sm:text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 leading-tight">
              {formatVND(displayPrice)}
            </div>
            <div className="text-[10px] mt-0.5 font-semibold">
              {isSoldOut ? (
                <span className="text-slate-400">Hết chỗ</span>
              ) : seatsAvailable === 1 ? (
                <span className="text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                  Còn 1 chỗ
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                  Còn {seatsAvailable} chỗ
                </span>
              )}
            </div>
          </div>

          {/* Affordance icon › 26px: Chỉ chuyến Gần nhất có nút xanh đậm Apple Blue, các chuyến còn lại màu xám nhạt */}
          <div
            className={`w-[26px] h-[26px] rounded-full flex items-center justify-center transition-colors duration-150 shrink-0 font-bold text-xs ${
              isEarliest
                ? 'bg-[#0071e3] text-white shadow-2xs group-hover:scale-110'
                : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 group-hover:bg-[#0071e3] group-hover:text-white'
            }`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
