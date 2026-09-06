import React from 'react';
import { Car, Users, Star, BadgeCheck, Share2, Check, MapPin, Navigation, AlertTriangle, ExternalLink, Route } from 'lucide-react';
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
    <div className={`relative flex flex-col ${compact ? 'gap-2' : 'gap-3'} select-none`}>
      {/* ── 1. ĐIỂM ĐÓN (XUẤT PHÁT) ── */}
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex flex-col items-center mt-1 shrink-0">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-[#107c41] bg-white dark:bg-slate-900 flex items-center justify-center shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#107c41]" />
          </span>
          {/* Đường line kết nối giữa điểm đón và điểm trả */}
          <span className={`w-[1.5px] ${compact ? 'h-4' : 'h-5'} bg-slate-200 dark:bg-slate-700 my-0.5`} />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-slate-900 dark:text-white leading-tight truncate ${compact ? 'text-xs' : 'text-[14px]'}`}>
            {fromIsMap ? '📍 Vị trí ghim trên Google Maps' : fromParsed.main}
          </p>
          {fromParsed.sub && !fromIsMap && (
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-normal leading-tight">
              {fromParsed.sub}
            </p>
          )}
        </div>
      </div>

      {/* ── 2. ĐIỂM TRẢ (ĐÍCH ĐẾN) ── */}
      <div className="flex items-start gap-3 min-w-0 -mt-1">
        <div className="flex items-center justify-center mt-1 shrink-0">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-[#ff3b30] bg-white dark:bg-slate-900 flex items-center justify-center shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff3b30]" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-slate-900 dark:text-white leading-tight truncate ${compact ? 'text-xs' : 'text-[14px]'}`}>
            {toIsMap ? '📍 Vị trí ghim trên Google Maps' : toParsed.main}
          </p>
          {toParsed.sub && !toIsMap && (
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-normal leading-tight">
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
    <article id={`trip-${item.id}`} className="p-4 sm:p-5 flex flex-col relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.07)] hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
      {/* ── 1. HEADER DANH TÍNH CHỦ XE / HÀNH KHÁCH ── */}
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onViewTrustProfile?.(item)}
          title="Xem hồ sơ tín nhiệm & xác minh"
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
        >
          <span className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/80 flex items-center justify-center text-slate-800 dark:text-slate-200 font-semibold text-xs shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
            {avatarLetter}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[13.5px] text-slate-900 dark:text-white truncate group-hover:text-[#0071e3] transition-colors">
                {driverDisplayName}
              </span>
              <BadgeCheck className="w-3.5 h-3.5 text-[#0071e3] shrink-0" title="Thành viên đã xác thực CCCD & GPLX" />
            </div>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">
              {item.carType || (isConvenient ? 'Tài xế tiện chuyến' : 'Xe gia đình')}
              {item.hometown ? ` · ${item.hometown}` : ''}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {item.rating && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 font-semibold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{item.rating}</span>
            </span>
          )}
          {onShare && (
            <button
              type="button"
              onClick={() => onShare(item)}
              title="Chia sẻ chuyến đi"
              aria-label="Chia sẻ chuyến đi"
              className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Share2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </header>

      {/* ── 2. THANH THỜI GIAN & LỘ TRÌNH ── */}
      <div className="mt-3.5 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-[11.5px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>{getTimeSlotLabel(item, lang)}</span>
          </span>
          {distanceKm && (
            <span className="text-[11.5px] text-slate-400 dark:text-slate-500 font-medium">
              ~{distanceKm} km
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onViewRoute?.(item)}
          className="text-[11.5px] font-medium text-[#0071e3] hover:underline inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
        >
          <span>Xem lộ trình</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* ── 3. TIMELINE HÀNH TRÌNH (TỐI GIẢN CHUẨN APPLE) ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onViewRoute?.(item)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewRoute?.(item); }}
        title="Bấm để xem bản đồ lộ trình chi tiết & đo khoảng cách"
        className="mt-2.5 py-3 px-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group/route"
      >
        <RouteTimeline from={item.from} to={item.to} routeCategory={item.routeCategory} waypointNote={item.waypointNote} />
      </div>

      {/* ── 4. THÔNG TIN XE & SỐ CHỖ ── */}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <div className="min-w-0 flex flex-wrap items-center gap-1.5">
          {isDriver ? (
            <>
              {isConvenient ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 shrink-0">
                  ⚡ Tiện chuyến
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                  🚗 Xe gia đình
                </span>
              )}
              {/* Badge Nhận Gửi Kèm Đồ / Bưu Phẩm */}
              {(item.acceptsParcel || (Array.isArray(item.perks) && item.perks.some(p => /hàng|đồ|bưu phẩm/i.test(p)))) && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/10 text-sky-800 dark:text-sky-300 border border-sky-500/20 shrink-0">
                  📦 Nhận gửi đồ
                </span>
              )}
            </>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20 shrink-0">
              Khách tìm xe
            </span>
          )}
        </div>

        <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400 shrink-0">
          {isDriver ? (
            <span>Còn <strong className="text-slate-900 dark:text-white font-semibold">{item.availableSeats}</strong> chỗ</span>
          ) : (
            <span>Cần <strong className="text-slate-900 dark:text-white font-semibold">{item.seatsNeeded || 1}</strong> chỗ</span>
          )}
        </span>
      </div>

      {item.safetyWarning && (
        <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          <span className="truncate">Lưu ý: {item.safetyWarning}</span>
        </div>
      )}

      {item.notes && (
        <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
          &ldquo;{item.notes}&rdquo;
        </p>
      )}

      {/* Tiện ích ngắn gọn */}
      {perks.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {perks.slice(0, 3).map((p) => (
            <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2.5} />
              <span>{p}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── 5. GIÁ & NÚT CÔNG CỤ (ACTION BUTTON) ── */}
      <footer className="mt-auto pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-xl sm:text-[22px] font-bold text-slate-900 dark:text-white tracking-tight leading-none">
            {formatVND(price)}
          </span>
          <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
            /người
          </span>
        </div>

        <button
          type="button"
          onClick={() => onBook(item)}
          className="h-9 px-4.5 rounded-xl text-xs font-semibold tracking-tight inline-flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-[0.98] shadow-xs bg-[#0071e3] hover:bg-[#0077ed] text-white"
        >
          {isDriver ? 'Ghép chuyến' : 'Đón khách'}
        </button>
      </footer>
    </article>
  );
}
