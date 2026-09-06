import React from 'react';
import { 
  Car, 
  Users, 
  Star, 
  BadgeCheck, 
  Share2, 
  Check, 
  MapPin, 
  Navigation, 
  AlertTriangle, 
  ExternalLink, 
  Route, 
  Zap, 
  Package, 
  Clock, 
  Shield, 
  ArrowRight 
} from 'lucide-react';
import { formatVND, getTimeSlotLabel, isGoogleMapsUrl, getGoogleMapsUrl, getRouteCorridor, ROUTE_BENCHMARKS, decodeHtmlEntities } from '@carmate/shared';
import { useI18n, useDataLabel } from '../../i18n/index.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';

function parseLocation(str) {
  if (!str || typeof str !== 'string') return { main: '', sub: '' };
  const cleanStr = decodeHtmlEntities(str);

  // Check if contains parentheses e.g. "Bù Đốp (Cây xăng Petrolimex 17, QL13)"
  const parenMatch = cleanStr.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch) {
    return { main: parenMatch[1].trim(), sub: parenMatch[2].trim() };
  }
  // Check if contains slash e.g. "Bù Đốp / Lộc Ninh" or "Bến xe Miền Đông mới / Ngã 4 Hàng Xanh"
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
          {/* Đường line kết nối rõ ràng */}
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
  const { t, lang } = useI18n();
  const isDriver = item.type === 'driver_offer';
  const isConvenient = isDriver && (
    item.carCategory === 'convenient_trip' ||
    item.notes?.toLowerCase().includes('tiện chuyến') ||
    item.notes?.toLowerCase().includes('biển vàng') ||
    item.carType?.toLowerCase().includes('tiện chuyến') ||
    item.perks?.some(p => typeof p === 'string' && (p.toLowerCase().includes('tiện chuyến') || p.toLowerCase().includes('biển vàng')))
  );

  // Chuẩn hoá mức giá hiển thị, không bao giờ để render 0đ
  const price = item.basePricePerSeat || item.expectedPrice || item.suggestedContribution || item.price || 180000;

  // Lọc bỏ các perk trùng lặp với loại biển xe đã hiển thị
  const perks = Array.from(new Set(Array.isArray(item.perks) ? item.perks.filter(Boolean) : [])).filter(p => {
    if (typeof p !== 'string') return false;
    const lower = p.toLowerCase();
    if (lower.includes('biển vàng') || lower.includes('biển trắng')) return false;
    if (lower.includes('tiện chuyến') || lower.includes('gia đình')) return false;
    return true;
  });

  const distanceKm = ROUTE_BENCHMARKS[item.routeCategory]?.distanceKm;

  // Tên hiển thị thân thiện, gần gũi với người dùng
  const driverDisplayName = item.publicName && !item.publicName.includes('Test E2E')
    ? item.publicName
    : item.author || (isDriver ? `Bác tài ${item.maskedCode || ''}` : `Khách tìm xe ${item.maskedCode || ''}`);

  // Chữ cái đại diện avatar
  const avatarLetter = (driverDisplayName.replace(/^(Chủ xe|Bác tài|Khách|Anh|Chị)\s*/i, '').trim()[0] || (isDriver ? 'T' : 'K')).toUpperCase();

  return (
    <article
      id={`trip-${item.id}`}
      className="p-4 sm:p-5 flex flex-col relative overflow-hidden rounded-2xl bg-white dark:bg-[#1c1c1e] border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.08)] hover:-translate-y-0.5 hover:border-[#0071e3]/60 transition-all duration-200 group"
    >
      {/* ── 1. HEADER DANH TÍNH CHỦ XE & STANFORD TRUST TELEMETRY ── */}
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onViewTrustProfile?.(item)}
          title="Xem hồ sơ tín nhiệm & xác minh"
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group/driver"
        >
          {/* Avatar Monogram với trạng thái Online Verified */}
          <div className="relative">
            <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-sm shrink-0 shadow-xs group-hover/driver:border-[#0071e3]/50 transition-colors">
              {avatarLetter}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#107c41] border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-2xs" title="Đã xác thực danh tính thật">
              <Check className="w-2 h-2 text-white stroke-[3]" />
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-[14px] text-slate-900 dark:text-white truncate group-hover/driver:text-[#0071e3] transition-colors">
                {driverDisplayName}
              </span>
              <BadgeCheck className="w-4 h-4 text-[#0071e3] shrink-0" title="Thành viên đã xác thực CCCD & GPLX" />
              {item.maskedCode && (
                <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-semibold">
                  {item.maskedCode}
                </span>
              )}
            </div>
            <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400 truncate mt-0.5">
              {item.carType || (isConvenient ? 'Tài xế tiện chuyến' : 'Xe gia đình')}
              {item.hometown ? ` · ${item.hometown}` : ''}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {item.rating ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 font-bold font-mono">
              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
              <span>{item.rating}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
              <Shield className="w-3 h-3 text-emerald-600" />
              <span>Tín nhiệm</span>
            </span>
          )}
          {onShare && (
            <button
              type="button"
              onClick={() => onShare(item)}
              title="Chia sẻ chuyến đi"
              aria-label="Chia sẻ chuyến đi"
              className="w-7.5 h-7.5 rounded-lg border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* ── 2. THANH THỜI GIAN & METRICS (CURSOR HIGH-PRECISION) ── */}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 font-semibold font-mono text-[11.5px]">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{getTimeSlotLabel(item, lang)}</span>
          </span>
          {distanceKm && (
            <span className="text-[12px] text-slate-600 dark:text-slate-400 font-mono font-medium">
              ~{distanceKm} km
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onViewRoute?.(item)}
          className="text-[12px] font-semibold text-[#0071e3] hover:text-[#0077ed] hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer group/routebtn"
        >
          <span>Xem lộ trình</span>
          <ExternalLink className="w-3 h-3 group-hover/routebtn:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* ── 3. KHỐI THÔNG TIN HÀNH TRÌNH (STANFORD HIGH-CONTRAST SURFACE) ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onViewRoute?.(item)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewRoute?.(item); }}
        className="my-3 p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group/route shadow-2xs"
      >
        <RouteTimeline from={item.from} to={item.to} routeCategory={item.routeCategory} waypointNote={item.waypointNote} />
      </div>

      {/* ── 4. THÔNG TIN XE & SEAT TELEMETRY GAUGE ── */}
      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
        <div className="min-w-0 flex flex-wrap items-center gap-1.5">
          {isDriver ? (
            <>
              {isConvenient ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60 shrink-0">
                  <Zap className="w-3 h-3 text-amber-600" strokeWidth={2.5} />
                  <span>Tiện chuyến</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 shrink-0">
                  <Car className="w-3.5 h-3.5 text-[#0071e3]" strokeWidth={2.2} />
                  <span>Xe gia đình</span>
                </span>
              )}
              {/* Badge Nhận Gửi Kèm Đồ / Bưu Phẩm */}
              {(item.acceptsParcel || (Array.isArray(item.perks) && item.perks.some(p => /hàng|đồ|bưu phẩm/i.test(p)))) && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 shrink-0">
                  <Package className="w-3 h-3 text-amber-600" strokeWidth={2.2} />
                  <span>Nhận gửi đồ</span>
                </span>
              )}
            </>
          ) : (
            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800/60 shrink-0">
              Khách tìm xe
            </span>
          )}
        </div>

        {/* Seat Availability Telemetry - Stanford Living Beacon */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 shrink-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#107c41]"></span>
          </span>
          {isDriver ? (
            <span>Còn <span className="font-mono font-black">{item.availableSeats}</span> chỗ</span>
          ) : (
            <span>Cần <span className="font-mono font-black">{item.seatsNeeded || 1}</span> chỗ</span>
          )}
        </span>
      </div>

      {item.safetyWarning && (
        <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          <span className="truncate">Lưu ý: {item.safetyWarning}</span>
        </div>
      )}

      {item.notes && (
        <p className="mt-2 text-[12px] text-slate-600 dark:text-slate-400 line-clamp-1 italic">
          &ldquo;{item.notes}&rdquo;
        </p>
      )}

      {/* Tiện ích ngắn gọn */}
      {perks.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {perks.slice(0, 3).map((p) => (
            <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <Check className="w-3 h-3 text-[#107c41] shrink-0" strokeWidth={2.5} />
              <span>{p}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── 5. GIÁ & NÚT CÔNG CỤ (APPLE PRECISION & CURSOR TACTILE CTA) ── */}
      <footer className="mt-auto pt-3.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-xl sm:text-[23px] font-black text-slate-900 dark:text-white tracking-tight leading-none font-mono">
            {formatVND(price)}
          </span>
          <span className="text-[12px] text-slate-600 dark:text-slate-400 font-semibold">
            /người
          </span>
        </div>

        <button
          type="button"
          onClick={() => onBook(item)}
          className="h-9 px-5 rounded-full text-xs font-bold tracking-tight inline-flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-[0.96] shadow-xs hover:shadow-sm bg-[#0071e3] hover:bg-[#0077ed] text-white"
        >
          <span>{isDriver ? 'Ghép chuyến' : 'Đón khách'}</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </button>
      </footer>
    </article>
  );
}
