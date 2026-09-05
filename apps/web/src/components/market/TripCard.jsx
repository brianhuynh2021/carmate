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
    <article id={`trip-${item.id}`} className="p-5 flex flex-col relative overflow-hidden rounded-2xl bg-white dark:bg-[#0f1422] border border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] transition-all duration-150 shadow-2xs hover:shadow-md">
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
              ? 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
              : 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border-primary-200/60 dark:border-primary-900/50'
          }`}>
            {isDriver ? <Car className="w-4 h-4" /> : <Users className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {item.maskedCode}
              </span>
              <BadgeCheck className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 shrink-0" title="Thành viên đã xác thực" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 font-mono font-semibold">
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
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-white/10 inline-flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 active:scale-90 transition-all cursor-pointer"
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
        className="mt-3.5 py-3 border-y border-slate-100 dark:border-white/5 cursor-pointer group/route transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02] -mx-5 px-5"
      >
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span>{getTimeSlotLabel(item, lang)}</span>
            </span>
            {distanceKm && (
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                ~{distanceKm} km
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 group-hover/route:text-primary-600 dark:group-hover/route:text-primary-400 inline-flex items-center gap-1 transition-colors">
            <span>Bản đồ lộ trình</span>
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>

        <RouteTimeline from={item.from} to={item.to} routeCategory={item.routeCategory} waypointNote={item.waypointNote} />
      </div>

      {/* ── 3. THÔNG TIN XE & SỐ GHẾ (ĐƠN NHÃN, KHÔNG LẶP BIỂN TRẮNG/VÀNG) ── */}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <div className="min-w-0 flex flex-wrap items-center gap-1.5">
          {isDriver ? (
            <>
              {isConvenient ? (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 shrink-0">
                  ⚡ Tiện chuyến
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                  🚗 Xe gia đình
                </span>
              )}
              {/* Badge Nhận Gửi Kèm Đồ / Bưu Phẩm */}
              {(item.acceptsParcel || (Array.isArray(item.perks) && item.perks.some(p => /hàng|đồ|bưu phẩm/i.test(p)))) && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shrink-0 inline-flex items-center gap-1">
                  <span>📦 Nhận gửi đồ</span>
                </span>
              )}
              {item.carType && (
                <span className="text-slate-500 dark:text-slate-400 truncate">
                  · {item.carType}
                </span>
              )}
            </>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary-500/10 text-primary-800 dark:text-primary-300 border border-primary-500/20 shrink-0">
              Khách tìm xe
            </span>
          )}
        </div>

        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
          {isDriver ? `Còn ${item.availableSeats} chỗ` : `Cần ${item.seatsNeeded || 1} chỗ`}
        </span>
      </div>

      {item.safetyWarning && (
        <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          <span className="truncate">Lưu ý: {item.safetyWarning}</span>
        </div>
      )}

      {item.notes && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic">
          &ldquo;{item.notes}&rdquo;
        </p>
      )}

      {/* Tiện ích ngắn gọn */}
      {perks.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {perks.slice(0, 3).map((p) => (
            <span key={p} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5">
              <Check className="w-3 h-3 text-emerald-500 shrink-0" strokeWidth={2.5} />
              <span>{p}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── 4. GIÁ & NÚT CÔNG CỤ (CURSOR TOOL BUTTON) ── */}
      <footer className="mt-auto pt-3.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-xl sm:text-[22px] font-black text-slate-900 dark:text-white tabular-nums tracking-tight leading-none">
            {formatVND(price)}
          </span>
          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
            /người
          </span>
        </div>

        <button
          type="button"
          onClick={() => onBook(item)}
          className="h-8 px-4 rounded-lg text-xs font-semibold tracking-tight inline-flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 shadow-2xs bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-primary-600 dark:hover:bg-primary-400 dark:hover:text-slate-950"
        >
          {isDriver ? 'Ghép chuyến' : 'Đón khách'}
        </button>
      </footer>
    </article>
  );
}
