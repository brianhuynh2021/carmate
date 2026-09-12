import React from 'react';
import { Sparkles, Car, CheckCircle2, ShieldCheck, ChevronRight } from 'lucide-react';
import { formatVND } from '@carmate/shared';

/**
 * Trả về chuỗi Thứ và Ngày theo định dạng Việt Nam (ví dụ: "Sáng Thứ 3 (15/09)")
 */
function formatTripTimeHeader(departureLabel = '04:30', departureDate = null) {
  let targetDate = new Date();

  if (departureDate) {
    const parsed = new Date(departureDate);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  // Tách giờ để xác định buổi
  let hour = 4;
  if (departureLabel && departureLabel.includes(':')) {
    const [h] = departureLabel.split(':').map(Number);
    if (!isNaN(h)) hour = h;
  } else if (departureLabel && !isNaN(parseInt(departureLabel))) {
    hour = parseInt(departureLabel);
  }

  let session = 'Sáng';
  if (hour >= 11 && hour < 14) session = 'Trưa';
  else if (hour >= 14 && hour < 18) session = 'Chiều';
  else if (hour >= 18 || hour < 4) session = 'Tối';

  const dayOfWeekNames = [
    'Chủ Nhật',
    'Thứ 2',
    'Thứ 3',
    'Thứ 4',
    'Thứ 5',
    'Thứ 6',
    'Thứ 7'
  ];
  const dayName = dayOfWeekNames[targetDate.getDay()] || 'Hôm nay';
  const dayMonth = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

  return `${session} ${dayName} (${dayMonth})`;
}

/**
 * BỐ CỤC THẺ CHUYẾN XE (CORRIDOR TRIP CARD) CHUẨN GIAI ĐOẠN 1
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ [04:30] Sáng Thứ 3 (15/09)           [Còn 3/4 chỗ] [badge]  │
 * ├─────────────────────────────────────────────────────────────┤
 * │  ● Tân Khai, Hớn Quản (đón tận nơi dọc QL13)                │
 * │  ↓                                                          │
 * │  ○ TP.HCM (Cụm Bệnh viện: Chợ Rẫy, Ung Bướu, ĐHYD)         │
 * ├─────────────────────────────────────────────────────────────┤
 * │ [Ảnh xe]  Toyota Vios 2022             170.000 đ / ghế      │
 * │  nhỏ gọn  Biển số: 93A-56x.xx                               │
 * │           (Không khói thuốc, cốp rộng) [ GIỮ CHỖ NGAY ]     │
 * └─────────────────────────────────────────────────────────────┘
 */
export default function CorridorTripCard({
  trip,
  originName = 'Ngã ba Tân Khai',
  originNote = 'đón tận nơi dọc QL13 & cây xăng',
  destName = 'TP.HCM (Cụm Bệnh viện)',
  destNote = 'Cụm BV: Chợ Rẫy, Ung Bướu, ĐHYD / Hàng Xanh',
  segmentPrice = 170000,
  onBookNow
}) {
  if (!trip) return null;

  const seatsAvailable = Number(trip.seatsAvailable ?? 1);
  const totalSeats = Number(trip.totalSeats || trip.capacity || 4);
  const isSoldOut = seatsAvailable <= 0;
  const displayPrice = trip.pricePerSeat || segmentPrice;
  const timeHeader = formatTripTimeHeader(trip.departureLabel, trip.departureDate);
  const vehicleModel = trip.vehicleModel || 'Toyota Vios 2022';
  const maskedPlate = trip.plateMasked || '93A-56x.xx';

  // Tiện ích xe
  const amenitiesText = Array.isArray(trip.amenities) && trip.amenities.length > 0
    ? trip.amenities.slice(0, 2).join(', ')
    : 'Không khói thuốc, cốp rộng';

  return (
    <div
      onClick={() => {
        if (!isSoldOut) onBookNow?.(trip);
      }}
      className={`group w-full rounded-2xl sm:rounded-3xl border transition-all duration-200 p-4 sm:p-5 space-y-3.5 select-none ${
        isSoldOut
          ? 'bg-slate-50/70 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 opacity-75 cursor-not-allowed'
          : 'bg-white dark:bg-[#1c1c1e] border-slate-200/90 dark:border-white/15 shadow-sm hover:shadow-xl hover:border-emerald-500/80 hover:-translate-y-0.5 cursor-pointer'
      }`}
    >
      {/* ── TẦNG 1: DÒNG TIÊU ĐỀ (THỜI GIAN & ĐỘ KHẨN CẤP) ── */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
        {/* Giờ + Thứ/ngày tháng nổi bật */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300/80 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-mono font-bold text-sm sm:text-base shrink-0">
            {trip.departureLabel || '04:30'}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {timeHeader}
          </span>
        </div>

        {/* Badge trạng thái chỗ ngồi góc phải kèm logo CarMate.vn */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Huy hiệu nhận diện chính thức CarMate.vn */}
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100/90 dark:bg-white/10 border border-slate-200/80 dark:border-white/15 text-[10.5px] font-bold text-slate-800 dark:text-slate-100 shrink-0 select-none shadow-2xs">
            <img src="/icons/icon-192.png" alt="CarMate" className="w-3.5 h-3.5 rounded-full object-contain shrink-0" />
            <span className="font-display tracking-tight leading-none">
              Car<span className="bg-gradient-to-r from-[#0099ff] to-[#f59e0b] bg-clip-text text-transparent font-black">Mate</span><span className="text-[#0071e3] font-mono text-[10px]">.vn</span>
            </span>
          </div>

          {isSoldOut ? (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-white/10">
              Đã hết chỗ
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold font-mono bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-800/60 inline-flex items-center gap-1 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Còn {seatsAvailable}/{totalSeats} chỗ</span>
            </span>
          )}

          {trip.isServiceVehicle ? (
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-300/50">
              🚕 Biển vàng
            </span>
          ) : (
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-[#0071e3] dark:text-blue-300 border border-blue-200/60">
              🚗 Xe cá nhân
            </span>
          )}
        </div>
      </div>

      {/* ── TẦNG 2: THÂN THẺ (HÀNH LANG DI CHUYỂN RÕ RÀNG) ── */}
      <div className="space-y-1.5 pl-1">
        {/* Điểm đón */}
        <div className="flex items-start gap-2.5">
          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold shadow-2xs">
            ●
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {trip.fromLocation || originName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {originNote}
            </p>
          </div>
        </div>

        {/* Trục nối dọc */}
        <div className="flex items-center pl-1.5 -my-1 text-slate-300 dark:text-slate-600">
          <span className="text-xs font-mono select-none">↓</span>
        </div>

        {/* Điểm đến */}
        <div className="flex items-start gap-2.5">
          <span className="w-4 h-4 rounded-full border-2 border-[#0071e3] bg-white dark:bg-[#1c1c1e] text-[#0071e3] flex items-center justify-center shrink-0 mt-0.5 text-[8px] font-bold shadow-2xs">
            ○
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {trip.toLocation || destName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {destNote}
            </p>
          </div>
        </div>
      </div>

      {/* ── TẦNG 3: CHÂN THẺ (PHƯƠNG TIỆN, GIÁ & NÚT HÀNH ĐỘNG) ── */}
      <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Bên trái: Thumbnail xe 64x64 + Thông tin xe */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Thumbnail xe 64x64px bo góc tròn mềm mại kèm logo carmate */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 border border-black/[0.08] dark:border-white/15 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-200 relative">
            {trip.carPhotoUrl ? (
              <img
                src={trip.carPhotoUrl}
                alt={vehicleModel}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-1 text-center">
                <img src="/icons/icon-192.png" alt="CarMate" className="w-6 h-6 rounded-lg object-contain opacity-90 mb-0.5 shadow-2xs" />
                <span className="text-[8.5px] font-bold text-slate-600 dark:text-slate-300">
                  carmate.vn
                </span>
              </div>
            )}
          </div>

          {/* Chi tiết tên xe, biển số che đuôi, tiện ích */}
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {vehicleModel}
            </p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Biển số: <span className="font-bold text-slate-700 dark:text-slate-200">{maskedPlate}</span>
            </p>
            <p className="text-[10.5px] text-slate-400 dark:text-slate-500 italic truncate">
              ({amenitiesText})
            </p>
          </div>
        </div>

        {/* Bên phải: Giá cước + Nút CTA GIỮ CHỖ NGAY */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-dashed border-slate-200/60 dark:border-white/5">
          <div className="text-left sm:text-right">
            <div className="flex items-baseline gap-0.5">
              <span className="text-base sm:text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                {formatVND(displayPrice)}
              </span>
              <span className="text-[11px] text-slate-400 font-normal">/ghế</span>
            </div>
            <span className="text-[10px] text-slate-400 block -mt-0.5">
              0đ cọc · Phụ xăng trực tiếp · <strong className="text-[#0071e3] font-semibold">carmate.vn</strong>
            </span>
          </div>

          {/* Nút hành động CTA */}
          <button
            type="button"
            disabled={isSoldOut}
            onClick={(e) => {
              e.stopPropagation();
              if (!isSoldOut) onBookNow?.(trip);
            }}
            className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all duration-150 shrink-0 select-none ${
              isSoldOut
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white shadow-md shadow-emerald-600/30 hover:shadow-lg hover:shadow-emerald-500/40 cursor-pointer'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 fill-white shrink-0" />
            <span>{isSoldOut ? 'Đã hết chỗ' : 'Giữ chỗ ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
