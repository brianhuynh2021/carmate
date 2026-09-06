import React from 'react';
import { 
  Car, 
  Users, 
  BadgeCheck, 
  Share2, 
  Check, 
  MapPin, 
  Navigation, 
  Clock, 
  ArrowRight
} from 'lucide-react';
import { formatVND, getTimeSlotLabel, isGoogleMapsUrl, ROUTE_BENCHMARKS, decodeHtmlEntities } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';

export function parseLocation(str) {
  if (!str || typeof str !== 'string') return { main: '', sub: '' };
  const cleanStr = decodeHtmlEntities(str);

  // Check if contains parentheses e.g. "Bù Đốp (Cây xăng Petrolimex 17, QL13)"
  const parenMatch = cleanStr.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch) {
    return { main: parenMatch[1].trim(), sub: parenMatch[2].trim() };
  }
  // Check if contains slash e.g. "Bù Đốp / Lộc Ninh"
  if (cleanStr.includes(' / ')) {
    const parts = cleanStr.split(' / ');
    return { main: parts[0].trim(), sub: parts.slice(1).join(' / ').trim() };
  }
  if (cleanStr.includes('; ')) {
    const parts = cleanStr.split('; ');
    return { main: parts[0].trim(), sub: parts.slice(1).join('; ').trim() };
  }
  return { main: cleanStr.trim(), sub: '' };
}

/**
 * Trích xuất tiêu đề hành lang tuyến to bản, rõ nét để làm điểm neo thị giác (Visual Route Headline)
 */
function getRouteHeadline(item, fromParsed, toParsed) {
  // Ưu tiên trích xuất từ địa điểm đã gõ (ví dụ: Bù Đốp ➔ Sài Gòn)
  if (fromParsed.main && toParsed.main) {
    // Làm gọn tên tỉnh/thành phố để tiêu đề không bị quá dài
    const cleanFrom = fromParsed.main.replace(/^(Huyện|TX\.|Thị xã|TP\.|Thành phố)\s+/i, '');
    const cleanTo = toParsed.main.replace(/^(Huyện|TX\.|Thị xã|TP\.|Thành phố)\s+/i, '');
    return { from: cleanFrom, to: cleanTo };
  }

  // Fallback từ ROUTE_BENCHMARKS
  const benchmark = ROUTE_BENCHMARKS[item.routeCategory];
  if (benchmark?.name) {
    const parts = benchmark.name.split('⇄');
    if (parts.length === 2) {
      return { 
        from: parts[0].trim(), 
        to: parts[1].replace(/\(.*?\)/, '').trim() 
      };
    }
  }

  return { 
    from: item.from || 'Điểm đón', 
    to: item.to || 'Điểm đến' 
  };
}

export function RouteTimeline({ from, to, routeCategory, waypointNote, compact = false }) {
  const fromIsMap = isGoogleMapsUrl(from);
  const toIsMap = isGoogleMapsUrl(to);
  const fromParsed = parseLocation(from);
  const toParsed = parseLocation(to);

  return (
    <div className={`relative flex flex-col ${compact ? 'gap-2' : 'gap-2.5'} select-none`}>
      {/* ── 1. ĐIỂM ĐÓN (XUẤT PHÁT) ── */}
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex flex-col items-center mt-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#107c41] ring-4 ring-[#107c41]/20 shrink-0" />
          <span className={`w-[2px] ${compact ? 'h-3.5' : 'min-h-[20px] h-full'} bg-slate-300 dark:bg-slate-600 my-1`} />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`font-bold text-slate-900 dark:text-white leading-snug truncate ${compact ? 'text-xs' : 'text-[14px]'}`}>
            {fromIsMap ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#107c41] shrink-0" />
                <span>Vị trí ghim trên Google Maps</span>
              </span>
            ) : fromParsed.main}
          </p>
          {fromParsed.sub && !fromIsMap && (
            <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5 truncate font-medium leading-snug">
              {fromParsed.sub}
            </p>
          )}
        </div>
      </div>

      {/* ── 2. ĐIỂM TRẢ (ĐÍCH ĐẾN) ── */}
      <div className="flex items-start gap-3 min-w-0 -mt-1">
        <div className="flex items-center justify-center mt-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff3b30] ring-4 ring-[#ff3b30]/20 shrink-0" />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`font-bold text-slate-900 dark:text-white leading-snug truncate ${compact ? 'text-xs' : 'text-[14px]'}`}>
            {toIsMap ? (
              <span className="inline-flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-[#ff3b30] shrink-0" />
                <span>Vị trí ghim trên Google Maps</span>
              </span>
            ) : toParsed.main}
          </p>
          {toParsed.sub && !toIsMap && (
            <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5 truncate font-medium leading-snug">
              {toParsed.sub}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TripCard({ item, onBook, onShare, onViewTrustProfile, onViewRoute }) {
  const { lang } = useI18n();
  const isDriver = item.type === 'driver_offer';
  const isConvenient = isDriver && (
    item.carCategory === 'convenient_trip' ||
    item.notes?.toLowerCase().includes('tiện chuyến') ||
    item.notes?.toLowerCase().includes('biển vàng') ||
    item.carType?.toLowerCase().includes('tiện chuyến')
  );

  // Chuẩn hoá mức giá hiển thị
  const price = item.basePricePerSeat || item.expectedPrice || item.suggestedContribution || item.price || 180000;
  const distanceKm = ROUTE_BENCHMARKS[item.routeCategory]?.distanceKm;

  // Tên hiển thị thân thiện, gần gũi
  const driverDisplayName = item.publicName && !item.publicName.includes('Test E2E')
    ? item.publicName
    : item.author || (isDriver ? `Bác tài ${item.maskedCode || ''}` : `Khách tìm xe ${item.maskedCode || ''}`);

  const avatarLetter = (driverDisplayName.replace(/^(Chủ xe|Bác tài|Khách|Anh|Chị)\s*/i, '').trim()[0] || (isDriver ? 'T' : 'K')).toUpperCase();

  const fromParsed = parseLocation(item.from);
  const toParsed = parseLocation(item.to);
  const headline = getRouteHeadline(item, fromParsed, toParsed);

  return (
    <article
      id={`trip-${item.id}`}
      className="flex flex-col relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161b26] border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_36px_rgba(0,113,227,0.08)] hover:-translate-y-1 hover:border-[#0071e3]/40 transition-all duration-200 group"
    >
      {/* ── 1. VISUAL ROUTE HEADER (ĐIỂM NEO THỊ GIÁC PHONG CÁCH FLY.IO) ── */}
      <div 
        role="button"
        tabIndex={0}
        onClick={() => onViewRoute?.(item)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewRoute?.(item); }}
        className={`relative p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 cursor-pointer select-none transition-colors ${
          isDriver 
            ? 'bg-gradient-to-br from-blue-50/80 via-slate-50/60 to-white dark:from-[#0071e3]/10 dark:via-slate-900 dark:to-[#161b26]' 
            : 'bg-gradient-to-br from-indigo-50/80 via-slate-50/60 to-white dark:from-indigo-950/20 dark:via-slate-900 dark:to-[#161b26]'
        }`}
      >
        {/* Decorative road curves in background (subtle texture) */}
        <div className="absolute right-0 top-0 bottom-0 w-32 opacity-10 dark:opacity-5 pointer-events-none overflow-hidden">
          <svg viewBox="0 0 100 100" className="w-full h-full text-[#0071e3]" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M10 100 C 40 80, 20 40, 90 10" />
            <path d="M30 100 C 60 80, 40 40, 110 10" strokeDasharray="4 4" />
          </svg>
        </div>

        {/* Top Meta Line: Loại xe / Vai trò + Ghế trống */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isDriver ? (
              <>
                <Car className="w-3.5 h-3.5 text-[#0071e3] shrink-0" strokeWidth={2.2} />
                <span>{isConvenient ? 'Tiện chuyến' : 'Xe gia đình'}</span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 text-[#0071e3] shrink-0" strokeWidth={2.2} />
                <span>Khách tìm xe</span>
              </>
            )}
            {distanceKm && <span>· ~{distanceKm}km</span>}
          </div>

          {/* Seat Beacon Badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-extrabold shadow-2xs shrink-0 ${
            isDriver
              ? 'bg-emerald-50 text-[#107c41] border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60'
              : 'bg-blue-50 text-[#0071e3] border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isDriver ? 'bg-[#107c41]' : 'bg-[#0071e3]'} animate-pulse`} />
            {isDriver ? (
              <span>Còn <span className="font-mono font-black">{item.availableSeats}</span> chỗ</span>
            ) : (
              <span>Cần <span className="font-mono font-black">{item.seatsNeeded || 1}</span> chỗ</span>
            )}
          </span>
        </div>

        {/* Route Headline: To bản, dứt khoát, nhận diện trong 0.5s */}
        <div className="mt-2.5 flex items-center gap-2 text-slate-900 dark:text-white font-black text-[17px] sm:text-[18px] tracking-tight leading-snug">
          <span className="truncate">{headline.from}</span>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0071e3] group-hover:translate-x-0.5 transition-all shrink-0" strokeWidth={2.5} />
          <span className="truncate">{headline.to}</span>
        </div>

        {/* Departure Time */}
        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 font-mono text-[11px] font-bold shadow-2xs">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{getTimeSlotLabel(item, lang)}</span>
          </span>
          {item.waypointNote && (
            <span className="text-slate-500 dark:text-slate-400 truncate text-[11.5px]">
              · {item.waypointNote}
            </span>
          )}
        </div>
      </div>

      {/* ── 2. CARD CONTENT (KHÔNG GIAN THOÁNG ĐÃNG, TINH GỌN CHỮ) ── */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 gap-3.5">
        
        {/* Điểm đón & trả chi tiết (Thanh mảnh, không nhét vào hộp xám dày) */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => onViewRoute?.(item)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewRoute?.(item); }}
          className="space-y-2 cursor-pointer group/routeinfo select-none"
          title="Bấm để xem lộ trình"
        >
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#107c41] shrink-0 translate-y-0.5 ring-2 ring-[#107c41]/20" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 shrink-0">Đón:</span>
            <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover/routeinfo:text-[#0071e3] transition-colors">
              {fromParsed.sub ? `${fromParsed.main} (${fromParsed.sub})` : fromParsed.main}
            </span>
          </div>
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#ff3b30] shrink-0 translate-y-0.5 ring-2 ring-[#ff3b30]/20" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 shrink-0">Trả:</span>
            <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover/routeinfo:text-[#0071e3] transition-colors">
              {toParsed.sub ? `${toParsed.main} (${toParsed.sub})` : toParsed.main}
            </span>
          </div>
        </div>

        {/* Ghi chú ngắn gọn (Nếu có) */}
        {item.notes && (
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
            &ldquo;{item.notes}&rdquo;
          </p>
        )}

        {/* ── 3. DANH TÍNH CHỦ XE / KHÁCH (1 DÒNG SẠCH SẼ KIỂU FLY.IO) ── */}
        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onViewTrustProfile?.(item)}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group/driver"
            title="Xem hồ sơ tín nhiệm & xác minh"
          >
            <div className="relative shrink-0">
              <span className="w-8.5 h-8.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs shadow-2xs group-hover/driver:border-[#0071e3]/50 transition-colors">
                {avatarLetter}
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#107c41] border-2 border-white dark:border-slate-900 flex items-center justify-center" title="Đã xác thực danh tính">
                <Check className="w-1.5 h-1.5 text-white stroke-[3]" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-[13px] text-slate-900 dark:text-white truncate group-hover/driver:text-[#0071e3] transition-colors">
                  {driverDisplayName}
                </span>
                <BadgeCheck className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
              </div>
              <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 truncate">
                {item.carType || (isConvenient ? 'Tài xế tiện chuyến' : 'Xe gia đình')}
                {item.rating ? ` · ★ ${item.rating}` : ' · Tín nhiệm'}
              </p>
            </div>
          </button>

          {onShare && (
            <button
              type="button"
              onClick={() => onShare(item)}
              title="Chia sẻ chuyến đi"
              className="w-7.5 h-7.5 rounded-lg border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── 4. GIÁ TIỀN & NÚT GHÉP CHUYẾN (APPLE MINIMALIST CTA) ── */}
        <footer className="pt-2 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-[22px] font-black text-slate-900 dark:text-white tracking-tight leading-none font-mono">
              {formatVND(price)}
            </span>
            <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-medium">
              /người
            </span>
          </div>

          <button
            type="button"
            onClick={() => onBook(item)}
            className="h-9 px-4.5 rounded-full text-xs font-bold tracking-tight inline-flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-[0.96] shadow-xs hover:shadow-md bg-[#0071e3] hover:bg-[#0077ed] text-white"
          >
            <span>{isDriver ? 'Ghép chuyến' : 'Đón khách'}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </button>
        </footer>
      </div>
    </article>
  );
}
