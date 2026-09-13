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

  // ── XỬ LÝ TÂM LÝ THỰC CHIẾN ĐÓN / TRẢ ────────────────────────────────
  const tripOriginCity = trip.fromLocation || trip.originName || 'Bình Long';
  const pickupTime = trip.departureLabel || '04:30';

  // Nhận diện điểm đến y tế / bệnh viện
  const isHospital = /(viện|bệnh viện|chợ rẫy|ung bướu|y dược|pasteur|nhi đồng|hùng vương|từ dũ)/i.test(
    `${destName} ${destNote || ''}`
  );

  // Subtext điểm đón: làm rõ nguồn gốc chuyến đi và tính tiện chuyến đón đúng giờ
  const pickupSubtext = tripOriginCity && tripOriginCity.toLowerCase() !== originName.toLowerCase()
    ? `Xe xuất phát từ [${tripOriginCity}], tiện đường ghé đón (~${pickupTime} có mặt tại trạm ${originName})`
    : `Đón đúng giờ tại trạm ${originName} (~${pickupTime} có mặt · ${originNote || 'Tiện đường ghé đón'})`;

  // Tag và Subtext điểm trả: điểm neo tâm lý tiết kiệm 70k Grab/taxi vào viện
  const dropoffBadge = isHospital ? 'Trả tận cổng bệnh viện' : 'Chở thẳng tới điểm đến';
  const dropoffSubtext = isHospital
    ? 'Chở thẳng tới cổng viện (Tiết kiệm ~70k tiền Grab từ bến xe)'
    : 'Không thả giữa đường (Tiết kiệm ~50k-70k tiền Grab từ bến xe)';

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

          {trip.assurance?.level === 'GUARANTEED' || trip.tier === 'GUARANTEED' || trip.isVerified || trip.isHostCar ? (
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/50"
              title="Chuyến cố định hàng tuần của chủ xe quen, khởi hành đúng giờ"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Xe nhà chạy định kỳ</span>
            </span>
          ) : (
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-[#0071e3] dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50"
              title="Xe đi ghép tự do giữa hai cá nhân, chia sẻ chi phí lăn bánh"
            >
              <span>Xe tiện chuyến</span>
            </span>
          )}
        </div>
      </div>

      {/* ── TẦNG 2: THÂN THẺ (HÀNH LANG DI CHUYỂN RÕ RÀNG - XÓA CẢM GIÁC KHÁCH PHỤ) ── */}
      <div className="space-y-2 pl-1">
        {/* Điểm đón: luôn hiển thị đúng trạm khách chọn làm tiêu đề chính */}
        <div className="flex items-start gap-2.5">
          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold shadow-2xs">
            ●
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {originName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              {pickupSubtext}
            </p>
          </div>
        </div>

        {/* Trục nối dọc */}
        <div className="flex items-center pl-1.5 -my-1 text-slate-300 dark:text-slate-600">
          <span className="text-xs font-mono select-none">↓</span>
        </div>

        {/* Điểm đến: ghim trạm khách chọn, gắn badge trả tận nơi & neo tâm lý tiết kiệm Grab */}
        <div className="flex items-start gap-2.5">
          <span className="w-4 h-4 rounded-full border-2 border-[#0071e3] bg-white dark:bg-[#1c1c1e] text-[#0071e3] flex items-center justify-center shrink-0 mt-0.5 text-[8px] font-bold shadow-2xs">
            ○
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {destName}
              </p>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-flex items-center shrink-0 select-none ${
                  isHospital
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/60'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-[#0071e3] dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60'
                }`}
              >
                {dropoffBadge}
              </span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium leading-relaxed">
              {dropoffSubtext}
            </p>
          </div>
        </div>
      </div>

      {/* ── TẦNG 3: CHÂN THẺ (PHƯƠNG TIỆN, GIÁ TRỌN GÓI & NÚT XẢ ÁP LỰC) ── */}
      <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        {/* Bên trái: Thumbnail xe + Thông tin xe (Bảo toàn không gian không bao giờ vỡ chữ) */}
        <div className="flex items-center gap-3 min-w-0 md:min-w-[200px] flex-1">
          {/* Thumbnail xe bo góc tròn mềm mại kèm logo carmate */}
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shrink-0 border border-black/[0.08] dark:border-white/15 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-200 relative">
            {trip.carPhotoUrl ? (
              <img
                src={trip.carPhotoUrl}
                alt={vehicleModel}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-1 text-center">
                <img src="/icons/icon-192.png" alt="CarMate" className="w-5 h-5 rounded-lg object-contain opacity-90 mb-0.5 shadow-2xs" />
                <span className="text-[8px] font-bold text-slate-600 dark:text-slate-300">
                  carmate.vn
                </span>
              </div>
            )}
          </div>

          {/* Chi tiết tên xe, biển số che đuôi, tiện ích */}
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {vehicleModel}
            </p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Biển số: <span className="font-bold text-slate-700 dark:text-slate-200">{maskedPlate}</span>
            </p>
            <p className="text-[10.5px] text-slate-400 dark:text-slate-500 italic truncate">
              ({amenitiesText})
            </p>
          </div>
        </div>

        {/* Bên phải: Giá cước trọn gói + Cụm nút CTA giải tỏa áp lực */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-dashed border-slate-200/60 dark:border-white/5">
          <div className="text-left sm:text-right space-y-0.5 shrink-0">
            <div className="flex items-baseline sm:justify-end gap-0.5">
              <span className="text-base sm:text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                {formatVND(displayPrice)}
              </span>
              <span className="text-[11px] text-slate-400 font-normal">/ghế</span>
            </div>
            <p className="text-[10.5px] sm:text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center sm:justify-end gap-1 whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Giá trọn gói · 0đ cọc · Không phụ thu</span>
            </p>
          </div>

          {/* Nút hành động CTA & Dòng phụ giải tỏa áp lực (Tuân thủ danh xưng Chủ xe) */}
          <div className="flex flex-col items-stretch sm:items-end shrink-0">
            <button
              type="button"
              disabled={isSoldOut}
              onClick={(e) => {
                e.stopPropagation();
                if (!isSoldOut) onBookNow?.(trip);
              }}
              className={`w-full sm:w-auto h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all duration-150 shrink-0 select-none ${
                isSoldOut
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white shadow-md shadow-emerald-600/30 hover:shadow-lg hover:shadow-emerald-500/40 cursor-pointer'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 fill-white shrink-0" />
              <span>{isSoldOut ? 'Đã hết chỗ' : 'Giữ chỗ ngay (0đ cọc)'}</span>
            </button>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center sm:text-right mt-1 font-normal whitespace-nowrap">
              Chủ xe xác nhận qua SĐT trong 5p · Không đi hủy tự do
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
