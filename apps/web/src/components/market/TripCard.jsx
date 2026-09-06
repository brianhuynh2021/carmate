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
  ArrowRight,
  ShieldCheck
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
 * Trích xuất địa danh đô thị/tỉnh thành lớn để làm tiêu đề vé xe chuẩn Apple Wallet & Fly.io
 * Tránh hoàn toàn việc nhét tên cây xăng/ngã tư dài ngoằng vào tiêu đề chính gây vỡ chữ '...'
 */
export function getCorridorDisplay(item, fromParsed, toParsed) {
  const extractTerritory = (parsed, raw) => {
    const text = ((parsed.sub || '') + ' ' + (parsed.main || '') + ' ' + (raw || '')).toLowerCase();
    
    // Tuyến Sài Gòn / TP.HCM
    if (/sài gòn|tp\.hcm|hồ chí minh|hàng xanh|miền đông|thủ đức|quận\s*\d+/i.test(text)) {
      return { city: 'Sài Gòn', code: 'SGN', point: parsed.main || 'TP.HCM' };
    }
    // Bình Phước & Các Huyện Trục QL13, QL14
    if (/bù đốp/i.test(text)) return { city: 'Bù Đốp', code: 'BĐ', point: parsed.main };
    if (/lộc ninh/i.test(text)) return { city: 'Lộc Ninh', code: 'LN', point: parsed.main };
    if (/bình long/i.test(text)) return { city: 'Bình Long', code: 'BL', point: parsed.main };
    if (/chơn thành/i.test(text)) return { city: 'Chơn Thành', code: 'CT', point: parsed.main };
    if (/đồng xoài/i.test(text)) return { city: 'Đồng Xoài', code: 'ĐX', point: parsed.main };
    if (/phước long/i.test(text)) return { city: 'Phước Long', code: 'PL', point: parsed.main };
    if (/bình phước/i.test(text)) return { city: 'Bình Phước', code: 'BP', point: parsed.main };

    // Đồng Nai & Trục QL20
    if (/gia kiệm/i.test(text)) return { city: 'Gia Kiệm', code: 'GK', point: parsed.main };
    if (/dầu giây/i.test(text)) return { city: 'Dầu Giây', code: 'DG', point: parsed.main };
    if (/long khánh/i.test(text)) return { city: 'Long Khánh', code: 'LK', point: parsed.main };
    if (/định quán/i.test(text)) return { city: 'Định Quán', code: 'ĐQ', point: parsed.main };
    if (/biên hòa|biên hoà/i.test(text)) return { city: 'Biên Hòa', code: 'BH', point: parsed.main };
    if (/đồng nai/i.test(text)) return { city: 'Đồng Nai', code: 'ĐN', point: parsed.main };

    // Các tỉnh thành phố khác
    if (/vũng tàu/i.test(text)) return { city: 'Vũng Tàu', code: 'VT', point: parsed.main };
    if (/bà rịa/i.test(text)) return { city: 'Bà Rịa', code: 'BR', point: parsed.main };
    if (/đà lạt/i.test(text)) return { city: 'Đà Lạt', code: 'DLI', point: parsed.main };
    if (/buôn ma thuột|đắk lắk/i.test(text)) return { city: 'B.M.Thuột', code: 'BMT', point: parsed.main };
    if (/đắk nông|gia nghĩa/i.test(text)) return { city: 'Đắk Nông', code: 'ĐN', point: parsed.main };
    if (/bình dương|thủ dầu một|bến cát/i.test(text)) return { city: 'Bình Dương', code: 'BD', point: parsed.main };
    if (/tây ninh/i.test(text)) return { city: 'Tây Ninh', code: 'TN', point: parsed.main };
    if (/cần thơ/i.test(text)) return { city: 'Cần Thơ', code: 'CT', point: parsed.main };

    // Rút gọn địa danh fallback
    const cleanWord = (parsed.main || '')
      .replace(/^(Cây xăng|Bến xe|Ngã 4|Ngã ba|Ngã 3|Trạm thu phí|KCN|Chợ|Cổng chào)\s+/i, '')
      .split(/[\s,.-]+/)[0] || 'Điểm đón';
    const code = cleanWord.slice(0, 3).toUpperCase();
    return { city: cleanWord, code, point: parsed.main || cleanWord };
  };

  const fromInfo = extractTerritory(fromParsed, item.from);
  const toInfo = extractTerritory(toParsed, item.to);

  // Fallback từ benchmark nếu cần
  const benchmark = ROUTE_BENCHMARKS[item.routeCategory];
  if (benchmark?.name && (fromInfo.city === toInfo.city || !fromInfo.city || !toInfo.city)) {
    const parts = benchmark.name.split('⇄');
    if (parts.length === 2) {
      fromInfo.city = parts[0].trim();
      toInfo.city = parts[1].replace(/\(.*?\)/, '').trim();
      fromInfo.code = fromInfo.city.slice(0, 3).toUpperCase();
      toInfo.code = toInfo.city.slice(0, 3).toUpperCase();
    }
  }

  return { fromInfo, toInfo };
}

/**
 * Danh sách Palette màu nghệ thuật lấy cảm hứng từ Fly.io & Apple Boarding Pass
 * Mang lại cá tính sống động, phân định rõ ràng giữa các card thay vì đồng màu đơn điệu
 */
const ROUTE_PALETTES = [
  {
    id: 'ocean',
    bgGradient: 'bg-gradient-to-br from-[#0c1427] via-[#152a55] to-[#1d4ed8]',
    accentColor: '#38bdf8',
    glowColor: 'bg-sky-400/20'
  },
  {
    id: 'sunrise',
    bgGradient: 'bg-gradient-to-br from-[#1e102d] via-[#4c1d63] to-[#c2410c]',
    accentColor: '#fb923c',
    glowColor: 'bg-amber-400/20'
  },
  {
    id: 'emerald',
    bgGradient: 'bg-gradient-to-br from-[#042018] via-[#064e3b] to-[#047857]',
    accentColor: '#34d399',
    glowColor: 'bg-emerald-400/20'
  },
  {
    id: 'sunset',
    bgGradient: 'bg-gradient-to-br from-[#270b2e] via-[#5b1548] to-[#be185d]',
    accentColor: '#f472b6',
    glowColor: 'bg-pink-400/20'
  },
  {
    id: 'gold',
    bgGradient: 'bg-gradient-to-br from-[#241703] via-[#633008] to-[#b45309]',
    accentColor: '#fbbf24',
    glowColor: 'bg-amber-400/20'
  },
  {
    id: 'twilight',
    bgGradient: 'bg-gradient-to-br from-[#0a0f1d] via-[#1a2238] to-[#4338ca]',
    accentColor: '#818cf8',
    glowColor: 'bg-indigo-400/20'
  }
];

function getPaletteForItem(item) {
  if (item.carCategory === 'convenient_trip') {
    return ROUTE_PALETTES[4]; // Gold sang trọng cho xe tiện chuyến
  }
  // Băm hash để mỗi card sở hữu màu sắc nghệ thuật riêng
  const rawId = String(item.id || item.author || 'trip');
  const hash = rawId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return ROUTE_PALETTES[hash % ROUTE_PALETTES.length];
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

  const price = item.basePricePerSeat || item.expectedPrice || item.suggestedContribution || item.price || 180000;
  const distanceKm = ROUTE_BENCHMARKS[item.routeCategory]?.distanceKm;

  const driverDisplayName = item.publicName && !item.publicName.includes('Test E2E')
    ? item.publicName
    : item.author || (isDriver ? `Bác tài ${item.maskedCode || ''}` : `Khách tìm xe ${item.maskedCode || ''}`);

  const avatarLetter = (driverDisplayName.replace(/^(Chủ xe|Bác tài|Khách|Anh|Chị)\s*/i, '').trim()[0] || (isDriver ? 'T' : 'K')).toUpperCase();

  const fromParsed = parseLocation(item.from);
  const toParsed = parseLocation(item.to);
  const { fromInfo, toInfo } = getCorridorDisplay(item, fromParsed, toParsed);
  const palette = getPaletteForItem(item);

  return (
    <article
      id={`trip-${item.id}`}
      className="flex flex-col relative overflow-hidden rounded-3xl bg-white dark:bg-[#151c28] border border-slate-200/90 dark:border-slate-800/80 shadow-[0_8px_24px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_48px_rgba(0,113,227,0.14)] hover:-translate-y-1.5 transition-all duration-300 group"
    >
      {/* ── 1. VISUAL ROUTE POSTER (FLY.IO ARTWORK + APPLE BOARDING PASS) ── */}
      <div 
        role="button"
        tabIndex={0}
        onClick={() => onViewRoute?.(item)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewRoute?.(item); }}
        className={`relative overflow-hidden p-5 text-white select-none cursor-pointer transition-all duration-300 ${palette.bgGradient}`}
      >
        {/* Glow hiệu ứng nền nghệ thuật */}
        <div className={`absolute -right-8 -bottom-8 w-36 h-36 rounded-full ${palette.glowColor} blur-2xl pointer-events-none`} />
        <div className="absolute -left-8 -top-8 w-36 h-36 rounded-full bg-black/30 blur-xl pointer-events-none" />

        {/* Top Header: Badge trạng thái & Ghế trống */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-md bg-white/15 border border-white/20 text-white shadow-2xs">
            <Car className="w-3 h-3 text-white" strokeWidth={2.5} />
            <span>{isConvenient ? 'Xe tiện chuyến' : 'Xe gia đình'}</span>
            {distanceKm && <span className="text-white/80 font-mono">· ~{distanceKm}km</span>}
          </span>

          {/* Huy hiệu ghế sống động */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide backdrop-blur-md bg-emerald-500/95 text-white border border-emerald-300/40 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            {isDriver ? (
              <span>Còn <span className="font-mono">{item.availableSeats}</span> chỗ</span>
            ) : (
              <span>Cần <span className="font-mono">{item.seatsNeeded || 1}</span> chỗ</span>
            )}
          </span>
        </div>

        {/* Center: Boarding Pass Route Display (Tuyệt đối không bị cắt chữ ...) */}
        <div className="relative z-10 mt-4 mb-2 flex items-center justify-between gap-2">
          {/* Điểm xuất phát */}
          <div className="flex-1 min-w-0">
            <span className="text-[10.5px] font-mono tracking-widest text-white/70 uppercase font-black">
              {fromInfo.code}
            </span>
            <h3 className="text-[20px] sm:text-[22px] font-black tracking-tight text-white leading-none mt-0.5 truncate">
              {fromInfo.city}
            </h3>
            <p className="text-[11.5px] text-white/80 font-medium truncate mt-1">
              {fromParsed.sub ? fromParsed.main : fromInfo.point}
            </p>
          </div>

          {/* Icon tuyến đường cao tốc ở giữa */}
          <div className="flex flex-col items-center justify-center shrink-0 px-2">
            <div className="flex items-center gap-1 text-white/90">
              <span className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/25" />
              <div className="w-10 sm:w-14 border-t-2 border-dashed border-white/40 relative flex items-center justify-center">
                <Car className="w-3.5 h-3.5 text-white/90 absolute -top-2 bg-transparent" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[10px] font-mono text-white/75 mt-1 font-semibold">
              {getTimeSlotLabel(item, lang)}
            </span>
          </div>

          {/* Điểm đích đến */}
          <div className="flex-1 min-w-0 text-right">
            <span className="text-[10.5px] font-mono tracking-widest text-white/70 uppercase font-black">
              {toInfo.code}
            </span>
            <h3 className="text-[20px] sm:text-[22px] font-black tracking-tight text-white leading-none mt-0.5 truncate">
              {toInfo.city}
            </h3>
            <p className="text-[11.5px] text-white/80 font-medium truncate mt-1">
              {toParsed.sub ? toParsed.main : toInfo.point}
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. CARD BODY: THÔNG TIN CHI TIẾT & ĐIỂM ĐÓN THẬT ── */}
      <div className="p-5 flex flex-col flex-1 gap-3.5">
        
        {/* Địa chỉ đón & trả rõ ràng từng ngõ ngách */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => onViewRoute?.(item)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewRoute?.(item); }}
          className="space-y-2 cursor-pointer select-none group/route"
          title="Bấm để xem bản đồ lộ trình"
        >
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#107c41] shrink-0 translate-y-0.5 ring-2 ring-[#107c41]/20" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">Đón:</span>
            <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover/route:text-[#0071e3] transition-colors">
              {fromParsed.sub ? `${fromParsed.main} (${fromParsed.sub})` : fromParsed.main}
            </span>
          </div>
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#ff3b30] shrink-0 translate-y-0.5 ring-2 ring-[#ff3b30]/20" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">Trả:</span>
            <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover/route:text-[#0071e3] transition-colors">
              {toParsed.sub ? `${toParsed.main} (${toParsed.sub})` : toParsed.main}
            </span>
          </div>
        </div>

        {/* Ghi chú chuyến xe */}
        {item.notes && (
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 line-clamp-1 italic px-0.5">
            &ldquo;{item.notes}&rdquo;
          </p>
        )}

        {/* ── 3. DANH TÍNH TÀI XẾ & HỒ SƠ TÍN NHIỆM ── */}
        <div className="mt-auto pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onViewTrustProfile?.(item)}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group/driver"
            title="Xem hồ sơ tín nhiệm & xác minh"
          >
            <div className="relative shrink-0">
              <span className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-xs shadow-2xs group-hover/driver:border-[#0071e3] transition-colors">
                {avatarLetter}
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#107c41] border-2 border-white dark:border-slate-900 flex items-center justify-center" title="Đã xác minh">
                <Check className="w-2 h-2 text-white stroke-[3]" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[13.5px] text-slate-900 dark:text-white truncate group-hover/driver:text-[#0071e3] transition-colors">
                  {driverDisplayName}
                </span>
                <BadgeCheck className="w-4 h-4 text-[#0071e3] shrink-0" />
              </div>
              <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {item.carType || (isConvenient ? 'Xe tiện chuyến' : 'Xe gia đình')}
                {item.rating ? ` · ★ ${item.rating}` : ' · Đã xác thực CCCD'}
              </p>
            </div>
          </button>

          {onShare && (
            <button
              type="button"
              onClick={() => onShare(item)}
              title="Chia sẻ chuyến đi"
              className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700/80 inline-flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── 4. GIÁ PHỤ XĂNG & NÚT GHÉP CHUYẾN APPLE ── */}
        <footer className="pt-2 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-1">
            <span className="text-[22px] sm:text-[24px] font-black text-slate-900 dark:text-white tracking-tight leading-none font-mono">
              {formatVND(price)}
            </span>
            <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-medium">
              /người
            </span>
          </div>

          <button
            type="button"
            onClick={() => onBook(item)}
            className="h-9.5 px-5 rounded-full text-xs font-bold tracking-tight inline-flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-[0.95] shadow-xs hover:shadow-md bg-[#0071e3] hover:bg-[#0077ed] text-white group-hover:bg-[#0077ed]"
          >
            <span>{isDriver ? 'Ghép chuyến' : 'Đón khách'}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </button>
        </footer>
      </div>
    </article>
  );
}
