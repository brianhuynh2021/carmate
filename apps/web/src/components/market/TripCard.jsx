import React from 'react';
import { Car, Users, Star, BadgeCheck, Share2, Check, MapPin, Navigation, AlertTriangle, ExternalLink, Route } from 'lucide-react';
import { formatVND, getTimeSlotLabel, isGoogleMapsUrl, getGoogleMapsUrl, getRouteCorridor, ROUTE_BENCHMARKS } from '@carmate/shared';
import { useI18n, useDataLabel } from '../../i18n/index.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';

function parseLocation(str) {
  if (!str || typeof str !== 'string') return { main: '', sub: '' };
  // Check if contains parentheses e.g. "Bù Đốp (Cây xăng Petrolimex 17, QL13)"
  const parenMatch = str.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch) {
    return { main: parenMatch[1].trim(), sub: parenMatch[2].trim() };
  }
  // Check if contains slash e.g. "Bù Đốp / Lộc Ninh"
  if (str.includes(' / ')) {
    const parts = str.split(' / ');
    return { main: parts[0].trim(), sub: parts.slice(1).join(' / ').trim() };
  }
  return { main: str.trim(), sub: '' };
}

export function RouteTimeline({ from, to, routeCategory, waypointNote, compact = false }) {
  const fromIsMap = isGoogleMapsUrl(from);
  const toIsMap = isGoogleMapsUrl(to);
  const fromParsed = parseLocation(from);
  const toParsed = parseLocation(to);
  const corridor = getRouteCorridor(routeCategory);

  // Lọc bỏ trạm trùng với điểm đón hoặc điểm trả (chỉ khi có corridor)
  const intermediateWaypoints = corridor?.waypoints
    ?.filter((wp) => {
      const name = wp.name.toLowerCase();
      const fromMain = fromParsed.main.toLowerCase();
      const toMain = toParsed.main.toLowerCase();
      return !name.includes(fromMain) && !fromMain.includes(name.split(' (')[0].toLowerCase()) &&
             !name.includes(toMain) && !toMain.includes(name.split(' (')[0].toLowerCase());
    })
    ?.slice(0, 3) || [];

  return (
    <div className="space-y-2">
      {/* ── 1. ĐIỂM ĐÓN (XUẤT PHÁT) ── */}
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 mt-0.5">
          ĐÓN
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-slate-900 dark:text-white leading-snug truncate ${compact ? 'text-xs' : 'text-[13.5px]'}`}>
            {fromIsMap ? '📍 Vị trí ghim trên Google Maps' : fromParsed.main}
          </p>
          {fromParsed.sub && !fromIsMap && (
            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              {fromParsed.sub}
            </p>
          )}
        </div>
      </div>

      {/* ── 2. HÀNH LANG DI CHUYỂN DỌC TUYẾN ── */}
      {!compact && (
        <div className="relative pl-6 py-0.5">
          <span className="absolute left-[11px] top-0 bottom-0 w-[1px] bg-slate-200 dark:bg-white/10" aria-hidden="true" />
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 truncate">
            <span className="w-1 h-1 rounded-full bg-primary-500 shrink-0" />
            {waypointNote ? (
              <span className="truncate">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Tiện đón trả: </span>
                {waypointNote}
              </span>
            ) : corridor ? (
              <span className="truncate">
                <span className="text-slate-600 dark:text-slate-400 font-medium">{corridor.highway}: </span>
                {intermediateWaypoints.length > 0
                  ? intermediateWaypoints.map(w => w.name.split(' (')[0]).join(', ')
                  : 'Đón trả linh hoạt dọc tuyến'}
              </span>
            ) : (
              <span className="truncate">Lộ trình trực tiếp · Đón trả linh hoạt</span>
            )}
          </div>
        </div>
      )}

      {/* ── 3. ĐIỂM TRẢ (ĐÍCH ĐẾN) ── */}
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 mt-0.5">
          TRẢ
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-slate-900 dark:text-white leading-snug truncate ${compact ? 'text-xs' : 'text-[13.5px]'}`}>
            {toIsMap ? '📍 Vị trí ghim trên Google Maps' : toParsed.main}
          </p>
          {toParsed.sub && !toIsMap && (
            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate">
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

  return (
    <article id={`trip-${item.id}`} className="p-5 flex flex-col relative overflow-hidden rounded-2xl bg-white border border-black/[0.08] hover:border-black/[0.16] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all duration-200">
      {/* ── 1. HEADER DANH TÍNH ── */}
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onViewTrustProfile?.(item)}
          title="Xem hồ sơ tín nhiệm & xác minh"
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
        >
          <span className={`w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
            isDriver
              ? 'bg-[#f5f5f7] text-[#1d1d1f] border-black/[0.06]'
              : 'bg-[#0071e3]/10 text-[#0071e3] border-[#0071e3]/20'
          }`}>
            {isDriver ? <Car className="w-4 h-4" /> : <Users className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-sm text-[#1d1d1f] truncate group-hover:text-[#0071e3] transition-colors">
                {item.maskedCode}
              </span>
              <BadgeCheck className="w-3.5 h-3.5 text-[#0071e3] shrink-0" title="Thành viên đã xác thực" />
            </div>
            <p className="text-xs text-[#86868b] truncate">
              {isDriver ? (
                <span>{item.hometown ? `Đồng hương ${item.hometown}` : (item.carType || (isConvenient ? 'Tài xế tiện chuyến' : 'Chủ xe gia đình'))}</span>
              ) : (
                <span>{item.hometown ? `Đồng hương ${item.hometown}` : (t('common.passengerFull') || 'Người tìm xe')}</span>
              )}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {item.rating && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 font-mono font-semibold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{item.rating}</span>
            </span>
          )}
          {onShare && (
            <button
              type="button"
              onClick={() => onShare(item)}
              title="Chia sẻ vé"
              aria-label="Chia sẻ vé"
              className="w-7 h-7 rounded-lg border border-black/[0.08] inline-flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] active:scale-90 transition-all cursor-pointer"
            >
              <Share2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </header>

      {/* ── 2. HÀNH LANG LỘ TRÌNH (THIẾT KẾ TUYẾN TÍNH, BỎ HỘP LỒNG HỘP) ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onViewRoute?.(item)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewRoute?.(item); }}
        title="Bấm để xem bản đồ lộ trình chi tiết & đo khoảng cách"
        className="mt-3.5 py-3 border-y border-black/[0.06] cursor-pointer group/route transition-colors hover:bg-black/[0.02] -mx-5 px-5"
      >
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#f5f5f7] border border-black/[0.06] text-xs font-mono font-semibold text-[#1d1d1f]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#107c41] shrink-0" />
              <span>{getTimeSlotLabel(item, lang)}</span>
            </span>
            {distanceKm && (
              <span className="text-[11px] font-mono text-[#86868b]">
                ~{distanceKm} km
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-[#86868b] group-route:text-[#0071e3] inline-flex items-center gap-1 transition-colors">
            <span>Bản đồ lộ trình</span>
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>

        <RouteTimeline from={item.from} to={item.to} routeCategory={item.routeCategory} waypointNote={item.waypointNote} />
      </div>

      {/* ── 3. THÔNG TIN XE & SỐ GHẾ ── */}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <div className="min-w-0 flex flex-wrap items-center gap-1.5">
          {isDriver ? (
            <>
              {isConvenient ? (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shrink-0">
                  ⚡ Tiện chuyến
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shrink-0">
                  🚗 Xe gia đình
                </span>
              )}
              {/* Badge Nhận Gửi Kèm Đồ / Bưu Phẩm */}
              {(item.acceptsParcel || (Array.isArray(item.perks) && item.perks.some(p => /hàng|đồ|bưu phẩm/i.test(p)))) && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0 inline-flex items-center gap-1">
                  <span>📦 Nhận gửi đồ</span>
                </span>
              )}
              {item.carType && (
                <span className="text-[#86868b] truncate">
                  · {item.carType}
                </span>
              )}
            </>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200/80 shrink-0">
              Khách tìm xe
            </span>
          )}
        </div>

        <span className="font-mono text-xs font-semibold text-[#515154] shrink-0">
          {isDriver ? `Còn ${item.availableSeats} chỗ` : `Cần ${item.seatsNeeded || 1} chỗ`}
        </span>
      </div>

      {item.safetyWarning && (
        <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-800 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          <span className="truncate">Lưu ý: {item.safetyWarning}</span>
        </div>
      )}

      {item.notes && (
        <p className="mt-2 text-xs text-[#86868b] line-clamp-1 italic">
          &ldquo;{item.notes}&rdquo;
        </p>
      )}

      {/* Tiện ích ngắn gọn */}
      {perks.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {perks.slice(0, 3).map((p) => (
            <span key={p} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-[#515154] bg-[#f5f5f7] border border-black/[0.04]">
              <Check className="w-3 h-3 text-[#107c41] shrink-0" strokeWidth={2.5} />
              <span>{p}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── 4. GIÁ & NÚT CÔNG CỤ (APPLE ACTION BUTTON) ── */}
      <footer className="mt-auto pt-3.5 border-t border-black/[0.06] flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-xl sm:text-[22px] font-bold text-[#1d1d1f] tabular-nums tracking-tight leading-none">
            {formatVND(price)}
          </span>
          <span className="text-[11px] font-mono text-[#86868b]">
            /người
          </span>
        </div>

        <button
          type="button"
          onClick={() => onBook(item)}
          className="h-9 px-4 rounded-xl text-xs font-bold tracking-tight inline-flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-[0.98] shadow-xs bg-[#0071e3] hover:bg-[#0077ed] text-white"
        >
          {isDriver ? 'Ghép chuyến' : 'Đón khách'}
        </button>
      </footer>
    </article>
  );
}
