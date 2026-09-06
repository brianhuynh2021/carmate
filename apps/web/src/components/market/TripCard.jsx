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
  Package,
  Camera
} from 'lucide-react';
import { formatVND, getTimeSlotLabel, isGoogleMapsUrl, ROUTE_BENCHMARKS, decodeHtmlEntities, formatTripDateDisplay } from '@carmate/shared';
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
      return { city: 'Sài Gòn', code: 'SGN', region: 'TP. Hồ Chí Minh', point: parsed.main || 'TP.HCM' };
    }
    // Bình Phước & Các Huyện Trục QL13, QL14
    if (/bù đốp/i.test(text)) return { city: 'Bù Đốp', code: 'BĐ', region: 'Bình Phước (QL13)', point: parsed.main };
    if (/lộc ninh/i.test(text)) return { city: 'Lộc Ninh', code: 'LN', region: 'Bình Phước (QL13)', point: parsed.main };
    if (/bình long/i.test(text)) return { city: 'Bình Long', code: 'BL', region: 'Bình Phước (QL13)', point: parsed.main };
    if (/chơn thành/i.test(text)) return { city: 'Chơn Thành', code: 'CT', region: 'Bình Phước (QL13)', point: parsed.main };
    if (/đồng xoài/i.test(text)) return { city: 'Đồng Xoài', code: 'ĐX', region: 'Bình Phước (QL14)', point: parsed.main };
    if (/phước long/i.test(text)) return { city: 'Phước Long', code: 'PL', region: 'Bình Phước (ĐT741)', point: parsed.main };
    if (/bình phước/i.test(text)) return { city: 'Bình Phước', code: 'BP', region: 'Tỉnh Bình Phước', point: parsed.main };

    // Đồng Nai & Trục QL20
    if (/gia kiệm/i.test(text)) return { city: 'Gia Kiệm', code: 'GK', region: 'Đồng Nai (QL20)', point: parsed.main };
    if (/dầu giây/i.test(text)) return { city: 'Dầu Giây', code: 'DG', region: 'Đồng Nai (QL1A/20)', point: parsed.main };
    if (/long khánh/i.test(text)) return { city: 'Long Khánh', code: 'LK', region: 'Tỉnh Đồng Nai', point: parsed.main };
    if (/định quán/i.test(text)) return { city: 'Định Quán', code: 'ĐQ', region: 'Đồng Nai (QL20)', point: parsed.main };
    if (/biên hòa|biên hoà/i.test(text)) return { city: 'Biên Hòa', code: 'BH', region: 'Tỉnh Đồng Nai', point: parsed.main };
    if (/đồng nai/i.test(text)) return { city: 'Đồng Nai', code: 'ĐN', region: 'Tỉnh Đồng Nai', point: parsed.main };

    // Các tỉnh thành phố khác
    if (/vũng tàu/i.test(text)) return { city: 'Vũng Tàu', code: 'VT', region: 'Bà Rịa - Vũng Tàu', point: parsed.main };
    if (/bà rịa/i.test(text)) return { city: 'Bà Rịa', code: 'BR', region: 'Bà Rịa - Vũng Tàu', point: parsed.main };
    if (/đà lạt/i.test(text)) return { city: 'Đà Lạt', code: 'DLI', region: 'Lâm Đồng (QL20)', point: parsed.main };
    if (/buôn ma thuột|đắk lắk/i.test(text)) return { city: 'B.M.Thuột', code: 'BMT', region: 'Đắk Lắk (QL14)', point: parsed.main };
    if (/đắk nông|gia nghĩa/i.test(text)) return { city: 'Đắk Nông', code: 'ĐN', region: 'Tỉnh Đắk Nông', point: parsed.main };
    if (/bình dương|thủ dầu một|bến cát/i.test(text)) return { city: 'Bình Dương', code: 'BD', region: 'Tỉnh Bình Dương', point: parsed.main };
    if (/tây ninh/i.test(text)) return { city: 'Tây Ninh', code: 'TN', region: 'Tỉnh Tây Ninh', point: parsed.main };
    if (/cần thơ/i.test(text)) return { city: 'Cần Thơ', code: 'CT', region: 'Đồng Bằng Sông Cửu Long', point: parsed.main };

    // Rút gọn địa danh fallback
    const cleanWord = (parsed.main || '')
      .replace(/^(Cây xăng|Bến xe|Ngã 4|Ngã ba|Ngã 3|Trạm thu phí|KCN|Chợ|Cổng chào)\s+/i, '')
      .split(/[\s,.-]+/)[0] || 'Điểm đón';
    const code = cleanWord.slice(0, 3).toUpperCase();
    return { city: cleanWord, code, region: 'Tuyến kết nối', point: parsed.main || cleanWord };
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
      fromInfo.region = benchmark.highway || 'Trục chính';
      toInfo.region = 'TP. Hồ Chí Minh';
    }
  }

  return { fromInfo, toInfo };
}

/**
 * 6 Dải màu nghệ thuật sống động lấy cảm hứng từ Fly.io & Apple Boarding Pass
 * Tươi sáng, rực rỡ và phân định tuyệt đối giữa các card
 */
const ROUTE_PALETTES = [
  {
    id: 'sunset-magenta',
    bgGradient: 'bg-gradient-to-br from-[#3b0764] via-[#6b21a8] to-[#db2777]',
    glowColor: 'bg-pink-500/25'
  },
  {
    id: 'ocean-electric',
    bgGradient: 'bg-gradient-to-br from-[#0c2340] via-[#0369a1] to-[#0284c7]',
    glowColor: 'bg-sky-400/25'
  },
  {
    id: 'amber-dawn',
    bgGradient: 'bg-gradient-to-br from-[#451a03] via-[#b45309] to-[#ea580c]',
    glowColor: 'bg-amber-400/25'
  },
  {
    id: 'emerald-mint',
    bgGradient: 'bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#10b981]',
    glowColor: 'bg-emerald-400/25'
  },
  {
    id: 'royal-indigo',
    bgGradient: 'bg-gradient-to-br from-[#1e1b4b] via-[#4338ca] to-[#7c3aed]',
    glowColor: 'bg-indigo-400/25'
  },
  {
    id: 'rose-coral',
    bgGradient: 'bg-gradient-to-br from-[#4c0519] via-[#9f1239] to-[#f43f5e]',
    glowColor: 'bg-rose-400/25'
  }
];

function getPaletteForItem(item) {
  if (item.carCategory === 'convenient_trip') {
    return ROUTE_PALETTES[2]; // Amber Gold cho xe tiện chuyến
  }
  const raw = String(item.id || item.author || 'trip');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  return ROUTE_PALETTES[positiveHash % ROUTE_PALETTES.length];
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

export default function TripCard({ item, onBook, onShare, onViewTrustProfile, onViewRoute, onViewCarPhotos }) {
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

  // Danh sách tiện ích phục vụ Progressive Disclosure khi hover / chạm
  const perksList = Array.from(new Set(Array.isArray(item.perks) ? item.perks.filter(Boolean) : [])).filter(p => {
    if (typeof p !== 'string') return false;
    const lower = p.toLowerCase();
    return !lower.includes('biển vàng') && !lower.includes('biển trắng') && !lower.includes('tiện chuyến') && !lower.includes('gia đình');
  });
  const defaultPerks = isDriver 
    ? (item.acceptsParcel ? ['Máy lạnh', 'Không khói thuốc', 'Nhận gửi đồ'] : ['Máy lạnh', 'Không khói thuốc', 'Cốp rộng'])
    : ['Đúng giờ', 'Không hút thuốc'];
  const displayPerks = perksList.length > 0 ? perksList.slice(0, 3) : defaultPerks;

  return (
    <article
      id={`trip-${item.id}`}
      className="flex flex-col relative overflow-hidden rounded-3xl bg-white dark:bg-[#151c28] border border-slate-200/90 dark:border-slate-800/80 shadow-[0_8px_24px_rgba(0,0,0,0.05)] hover:shadow-[0_24px_54px_rgba(0,113,227,0.16)] hover:-translate-y-2 active:scale-[0.985] transition-all duration-300 ease-out group select-none"
    >
      {/* ── 1. VISUAL ROUTE POSTER (FLY.IO ARTWORK + APPLE BOARDING PASS) ── */}
      <div 
        role="button"
        tabIndex={0}
        onClick={() => onViewRoute?.(item)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewRoute?.(item); }}
        className={`relative overflow-hidden p-5 text-white cursor-pointer transition-all duration-300 ${palette.bgGradient}`}
      >
        {/* Glow hiệu ứng nền nghệ thuật đa tầng */}
        <div className={`absolute -right-8 -bottom-8 w-40 h-40 rounded-full ${palette.glowColor} blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500`} />
        <div className="absolute -left-8 -top-8 w-40 h-40 rounded-full bg-black/25 blur-xl pointer-events-none" />

        {/* Top Header: Badge phân loại xe & Số ghế trống */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-md bg-white/15 border border-white/20 text-white shadow-2xs group-hover:bg-white/20 transition-colors">
            <Car className="w-3 h-3 text-white" strokeWidth={2.5} />
            <span>{isConvenient ? 'Xe tiện chuyến' : 'Xe gia đình'}</span>
            {distanceKm && <span className="text-white/80 font-mono">· ~{distanceKm}km</span>}
          </span>

          {/* Huy hiệu ghế sống động */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide backdrop-blur-md bg-emerald-500/95 text-white border border-emerald-300/40 shadow-sm group-hover:bg-emerald-500 transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            {isDriver ? (
              <span>Còn <span className="font-mono">{item.availableSeats}</span> chỗ</span>
            ) : (
              <span>Cần <span className="font-mono">{item.seatsNeeded || 1}</span> chỗ</span>
            )}
          </span>
        </div>

        {/* Center: Boarding Pass Route Display (Tuyệt đối KHÔNG bị cắt chữ ...) */}
        <div className="relative z-10 mt-4 mb-1 flex items-center justify-between gap-2">
          {/* Điểm xuất phát lớn */}
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-mono tracking-widest text-white/70 uppercase font-black block">
              {fromInfo.code}
            </span>
            <h3 className="text-[21px] sm:text-[23px] font-black tracking-tight text-white leading-none mt-1 truncate">
              {fromInfo.city}
            </h3>
            <p className="text-[11.5px] text-white/80 font-medium truncate mt-1.5">
              {fromInfo.region}
            </p>
          </div>

          {/* Icon tuyến đường cao tốc & Micro-animation xe lăn bánh khi lướt qua */}
          <div className="flex flex-col items-center justify-center shrink-0 px-2.5">
            <div className="flex items-center gap-1 text-white/90">
              <span className="w-2 h-2 rounded-full bg-white/90 ring-2 ring-white/30" />
              <div className="w-11 sm:w-15 border-t-2 border-dashed border-white/40 group-hover:border-white/70 relative flex items-center justify-center transition-colors">
                <Car className="w-3.5 h-3.5 text-white absolute -top-2 transition-transform duration-300 ease-out group-hover:translate-x-2.5" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-white group-hover:translate-x-1 transition-transform duration-200" />
            </div>
            {/* Tag ngày & giờ xuất phát chuẩn kính mờ - Không còn mập mờ "Sáng Thứ 3" */}
            <span className="mt-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[10px] font-mono font-bold text-white tracking-wide group-hover:bg-white/25 transition-colors text-center">
              {item.date ? `${formatTripDateDisplay(item.date)} · ` : ''}{getTimeSlotLabel(item, lang)}
            </span>
          </div>

          {/* Điểm đích đến lớn */}
          <div className="flex-1 min-w-0 text-right">
            <span className="text-[11px] font-mono tracking-widest text-white/70 uppercase font-black block">
              {toInfo.code}
            </span>
            <h3 className="text-[21px] sm:text-[23px] font-black tracking-tight text-white leading-none mt-1 truncate">
              {toInfo.city}
            </h3>
            <p className="text-[11.5px] text-white/80 font-medium truncate mt-1.5">
              {toInfo.region}
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. CARD BODY: THÔNG TIN CHI TIẾT ĐIỂM ĐÓN / TRẢ ── */}
      <div className="p-5 flex flex-col flex-1 gap-3">
        
        {/* Địa chỉ đón & trả rõ ràng từng ngõ ngách, phân cấp rõ rệt */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => onViewRoute?.(item)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewRoute?.(item); }}
          className="space-y-2.5 cursor-pointer select-none group/route"
          title="Bấm để xem bản đồ lộ trình"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0 border border-emerald-200 dark:border-emerald-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block leading-tight">Điểm đón</span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover/route:text-[#0071e3] transition-colors mt-0.5">
                {fromParsed.sub ? `${fromParsed.main} (${fromParsed.sub})` : fromParsed.main}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0 border border-rose-200 dark:border-rose-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block leading-tight">Điểm trả</span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover/route:text-[#0071e3] transition-colors mt-0.5">
                {toParsed.sub ? `${toParsed.main} (${toParsed.sub})` : toParsed.main}
              </p>
            </div>
          </div>
        </div>

        {/* ── PROGRESSIVE DISCLOSURE: BẬT MÍ TIỆN ÍCH KHI LƯỚT CHUỘT / CHẠM ── */}
        <div className="overflow-hidden transition-all duration-300 max-h-0 opacity-0 group-hover:max-h-8 group-hover:opacity-100 group-focus-within:max-h-8 group-focus-within:opacity-100">
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {displayPerks.map((p, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-blue-50/80 dark:bg-blue-950/40 text-[#0071e3] dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50 shadow-2xs">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
                <span>{p}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Ghi chú chuyến xe */}
        {item.notes && (
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 line-clamp-1 italic px-0.5">
            &ldquo;{item.notes}&rdquo;
          </p>
        )}

        {/* Nút xem ảnh xe thực tế nếu chủ xe đã tải (Tối thiểu 3 hình, tối đa 5 hình) */}
        {isDriver && item.carPhotos && item.carPhotos.length >= 3 && (
          <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Camera className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block truncate">
                  Có {item.carPhotos.length} ảnh xe thực tế
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-medium">
                  Đã che biển số · Góc Trước, Sau, Thân xe
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewCarPhotos?.(item);
              }}
              className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors shadow-2xs cursor-pointer shrink-0"
            >
              Xem ảnh
            </button>
          </div>
        )}

        {/* ── 3. DANH TÍNH TÀI XẾ & HỒ SƠ TÍN NHIỆM ── */}
        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
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
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#107c41] border-2 border-white dark:border-slate-900 flex items-center justify-center">
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
            className="h-9.5 px-5 rounded-full text-xs font-bold tracking-tight inline-flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-[0.92] shadow-xs hover:shadow-md bg-[#0071e3] hover:bg-[#0077ed] text-white group/btn"
          >
            <span>{isDriver ? 'Ghép chuyến' : 'Đón khách'}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover/btn:translate-x-1 transition-transform duration-200" />
          </button>
        </footer>
      </div>
    </article>
  );
}
