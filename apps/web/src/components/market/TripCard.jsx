import React, { useState } from 'react';
import {
  Star,
  MapPin,
  Navigation,
  ArrowRight,
  Package,
  Camera,
  Lock,
  User,
  SlidersHorizontal,
  Car,
  CheckCircle2,
  Sparkles,
  Truck
} from 'lucide-react';
import {
  getTimeSlotLabel,
  sanitizeTimeLabel,
  isGoogleMapsUrl,
  formatCleanDateLabel,
  parseLocation,
  getCorridorDisplay,
  toPublicAlias,
  normalizePhotoUrl,
  getUserOnlineStatus
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import PresenceDot from '../ui/PresenceDot.jsx';
import { priceLabel, pickupLabel } from './tripPresentation.js';

export { parseLocation, getCorridorDisplay };

/**
 * RouteTimeline — Visual route axis used in a Modal or quick view
 */
export function RouteTimeline({ from, to, compact = false }) {
  const { t } = useI18n();
  const fromIsMap = isGoogleMapsUrl(from);
  const toIsMap = isGoogleMapsUrl(to);
  const fromParsed = parseLocation(from);
  const toParsed = parseLocation(to);

  return (
    <div className={`relative flex flex-col ${compact ? 'gap-2' : 'gap-2.5'} select-none`}>
      {/* Starting point */}
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex flex-col items-center mt-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shrink-0" />
          <span
            className={`w-[1.5px] ${compact ? 'h-3.5' : 'min-h-[20px] h-full'} bg-slate-200 dark:bg-slate-700 my-1`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-slate-900 dark:text-white truncate type-body-strong ${compact ? '' : ''}`}
          >
            {fromIsMap ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{t('tripCard.s001')}</span>
              </span>
            ) : (
              fromParsed.main
            )}
          </p>
          {fromParsed.sub && !fromIsMap && (
            <p className="text-slate-500 dark:text-slate-400 mt-0.5 truncate type-body">
              {fromParsed.sub}
            </p>
          )}
        </div>
      </div>

      {/* Destination point */}
      <div className="flex items-start gap-3 min-w-0 -mt-1">
        <div className="flex items-center justify-center mt-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/20 shrink-0" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-slate-900 dark:text-white truncate type-body-strong ${compact ? '' : ''}`}
          >
            {toIsMap ? (
              <span className="inline-flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{t('tripCard.s001')}</span>
              </span>
            ) : (
              toParsed.main
            )}
          </p>
          {toParsed.sub && !toIsMap && (
            <p className="text-slate-500 dark:text-slate-400 mt-0.5 truncate type-body">
              {toParsed.sub}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * TripCard — 1-2 second visual hierarchy: WHEN → WHERE → PRICE → SEAT → TRUST
 * - When? Time + Date prominent on line 1
 * - Where to? Route aligned with the arrow at the end of the route axis
 * - Price & Seats left: Side by side on the airy line 3
 * - Specific pickup / drop-off point: Line 4
 * - Reputation, Driver, Vehicle & Action buttons: Lines 5 & 6
 */

/**
 * Normalize the display of a vehicle model with seat count (e.g. "Mazda 2 · 5 chỗ", "Mitsubishi Xpander · 7 chỗ", "Xe 5 chỗ")
 */
export function getCarDisplay(carType, capacity, vehicleType) {
  const isTruck =
    vehicleType === 'truck_light' ||
    /xe\s*tải|tải\s*nhẹ|chành\s*xe|k200|k250|porter|h150|qkr|thaco\s*towner|carry\s*pro/i.test(carType || '');

  if (isTruck) {
    let cleanModel = (carType || 'Xe tải nhẹ').split('(')[0].trim();
    cleanModel = cleanModel.replace(/\s*(xe\s*tải\s*nhẹ|xe\s*tải|tải\s*nhẹ|chành\s*xe)\b/gi, '').trim();
    return cleanModel ? `${cleanModel} · Xe tải` : 'Xe tải nhẹ';
  }

  const isPickup =
    vehicleType === 'pickup' ||
    /bán\s*tải|pickup|ranger|hilux|triton|d-?max|navara|bt-?50/i.test(carType || '');

  if (isPickup) {
    let cleanModel = (carType || 'Xe bán tải').split('(')[0].trim();
    cleanModel = cleanModel.replace(/\s*(xe\s*bán\s*tải|bán\s*tải|pickup|\d+\s*chỗ)\b/gi, '').trim();
    return cleanModel ? `${cleanModel} · Bán tải` : 'Xe bán tải';
  }

  // Catalog of common 7-seat models in VN (avoid wrongly showing "Xpander 4 chỗ")
  const is7Seater =
    Number(capacity) === 7 ||
    /7\s*chỗ/i.test(carType || '') ||
    /xpander|veloz|innova|fortuner|carnival|santafe|everest|outlander|sorento|avanza|custin|sedona/i.test(carType || '');

  const standardCap = is7Seater ? 7 : 5;

  if (!carType || !carType.trim()) return `Xe ${standardCap} chỗ`;

  // Split out the parenthesized part if present (e.g. "(Xe 7 chỗ)" or "(Xe 5 chỗ gầm cao)")
  let raw = carType.split('(')[0].trim();
  // Remove redundant extra keywords
  raw = raw.replace(/\s*(du\s*lịch|cá nhân|gia đình|tiện chuyến|biển vàng|biển trắng)\b/gi, '').trim();

  // Check whether the string is just "Xe 7 chỗ", "7 chỗ" or "Xe 5 chỗ"
  if (!raw || /^(?:xe\s*)?\d+\s*chỗ$/i.test(raw) || raw.toLowerCase() === 'xe') {
    return `Xe ${standardCap} chỗ`;
  }

  // Strip the "... 5 chỗ" or "xe 5 chỗ" part at the end of the string if the user typed it run together (e.g. "Mazda 2 5 chỗ")
  let cleanModel = raw.replace(/\s+(?:xe\s*)?\d+\s*chỗ.*$/i, '').trim();
  if (!cleanModel || cleanModel.toLowerCase() === 'xe') {
    return `Xe ${standardCap} chỗ`;
  }

  return `${cleanModel} · ${standardCap} chỗ`;
}

export default function TripCard({
  item,
  isOwner = false,
  onBook,
  onManage,
  onViewTrustProfile,
  onViewRoute,
  onViewCarPhotos,
  onSelect = null
}) {
  const { t, lang } = useI18n();
  const [coverFailed, setCoverFailed] = useState(false);

  if (!item) return null;

  const isDriver = item.type === 'driver_offer';
  const formattedPrice = priceLabel(item);

  // Public identity: only show the role alias + standard identifier ("Chủ xe" CX-xxx (driver) / "Khách" KX-xxx (passenger))
  const driverDisplayName = toPublicAlias(item);

  // Online status (Live Presence Telemetry: green light online / red light offline)
  const onlineStatus = getUserOnlineStatus({ ...item, isOwner });

  const fromParsed = parseLocation(item.from);
  const toParsed = parseLocation(item.to);

  // Shortened specific meeting point
  const briefSpot = (sub) => {
    if (!sub) return '';
    const s = String(sub).trim();
    if (s.length <= 42) return s;
    return s.split(/\s*[/;]\s*/)[0].trim();
  };
  const rawFromSpot = briefSpot(
    item.pickupSpot || fromParsed.sub || (item.waypointNote?.toLowerCase().includes('đón') ? item.waypointNote.replace(/^đón\s*(?:tại)?\s*/i, '') : '')
  );
  const rawToSpot = briefSpot(
    item.dropoffSpot || toParsed.sub || (item.waypointNote?.toLowerCase().includes('trả') ? item.waypointNote.replace(/^trả\s*(?:tại)?\s*/i, '') : '')
  );

  // Remove the province/city name already in the route axis title, and redundant vehicle keywords
  const cleanSpot = (spot, city) => {
    if (!spot) return '';
    const VEHICLE_LEAK_REGEX =
      /(?:\s+|-|,|\/)?\s*(?:xe\s*)?(?:mazda\s*\d*|vios|xpander|innova|veloz|kia\s*\w*|hyundai\s*\w*|honda\s*\w*|toyota\s*\w*|ford\s*\w*|vinfast\s*\w*|carnival|accent|city|cerato|k3|cx-?\d+|sedan|suv|mpv|nhà|oto|ô tô|hơi|ghép|gia đình|\d+\s*chỗ|chỗ).*/gi;
    let s = spot.replace(VEHICLE_LEAK_REGEX, '').trim();
    if (!city) return s;
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleaned = s.replace(new RegExp(`,?\\s*${escaped}\\s*`, 'gi'), '').trim();
    return cleaned || s;
  };

  const fromSpot = cleanSpot(rawFromSpot, fromParsed.main);
  const toSpot = cleanSpot(rawToSpot, toParsed.main);
  const isTripFull = item.status === 'full' || Boolean(item.isFull);

  // Standard average star rating (always keep the form * 5.0 or * 4.9)
  const rawRating = Number(item.rating);
  const ratingValue = Number.isFinite(rawRating) && rawRating > 0
    ? Math.round(rawRating * 10) / 10
    : null;
  const rating = ratingValue == null ? 'Chưa có đánh giá' : ratingValue.toFixed(1);
  const completedTrips = Number(item.completedCount) || 0;

  // "5 chỗ" (capacity) is entirely different from "còn 5 chỗ" (bookable). Always show the form remaining/total.
  const seatsLeft = isDriver ? Number(item.availableSeats) || 0 : Number(item.seatsNeeded) || 1;
  const seatsTotal = isDriver ? Number(item.vehicleSeatCount || item.capacity) || null : null;

  // Date shown tidy and refined (Stanford Ergonomics & Apple HIG: eliminate the redundant dd/mm suffix)
  const dateLabel = formatCleanDateLabel(item.date);

  // Time: precise time format (morning keeps the word "Sáng" (Morning) to distinguish, afternoon/evening drops the redundant word)
  const rawTime = getTimeSlotLabel(item, lang) || '';
  const timeLabel = sanitizeTimeLabel((rawTime.match(/^([^()]+)\s*\(/)?.[1] || rawTime).trim());

  // Real vehicle photo — show an elegant thumbnail if available
  const photos = (item.carPhotos || []).filter(Boolean);
  const rawCover = photos.length > 0 ? normalizePhotoUrl(photos[0]) : null;
  const coverPhoto = coverFailed ? null : rawCover;

  // Show vehicle name & seat count consistently (e.g. "Mazda 2 · 5 chỗ", "Mitsubishi Xpander · 7 chỗ", "Xe 5 chỗ", "Ford Ranger · Bán tải")
  const carDisplay = getCarDisplay(item.carType, item.capacity, item.vehicleType);

  return (
    <article
      id={`trip-${item.id}`}
      onClick={() => onViewRoute?.(item)}
      className="flex flex-col h-full relative overflow-hidden rounded-3xl bg-white dark:bg-[#151b26] border border-slate-300 dark:border-white/15 hover:border-[#0071e3] dark:hover:border-sky-400 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_10px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.12),0_20px_48px_rgba(0,0,0,0.08)] hover:-translate-y-1 active:scale-[0.99] transition-all duration-200 ease-out group select-none cursor-pointer"
    >
      {/* ── 1. WHEN? (WHEN) + REFINED CONTEXT BADGE ── */}
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-1">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-slate-900 dark:text-white tabular shrink-0 type-body-strong">
            {timeLabel}
          </span>
          <span className="text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap type-body-strong">
            · {dateLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <PresenceDot isOnline={onlineStatus.isOnline} showLabel detail={onlineStatus.detail} />
        </div>
      </div>

      {/* ── 2. FROM WHERE → TO WHERE? (WHERE - APPLE HIG-STANDARD ROUTE, NO BREAKING/STRETCHING) ── */}
      <div className="px-5 pt-2 pb-1.5">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <span className="truncate max-w-[44%] type-body-strong">
            {fromParsed.main}
          </span>
          <div className="shrink-0 flex items-center px-0.5 text-slate-400 dark:text-slate-500 group-hover:text-[#0071e3] dark:group-hover:text-sky-400 transition-colors">
            <svg
              className="w-7 h-3 text-current shrink-0 group-hover:translate-x-0.5 transition-transform duration-200"
              viewBox="0 0 28 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 6h22.5M18.5 2.5L24.5 6L18.5 9.5" />
            </svg>
          </div>
          <span className="truncate max-w-[44%] type-body-strong">
            {toParsed.main}
          </span>
        </div>
      </div>

      {/* ── 3. HOW MUCH? (PRICE) ── AND ── ANY SEATS LEFT? (SEAT) ── */}
      <div className="flex items-center justify-between gap-3 px-5 py-2">
        <div className="flex flex-col gap-0.5 type-body">
          <div className="flex items-baseline gap-0.5 type-body">
            <span className="text-slate-900 dark:text-white tabular type-title">
              {formattedPrice}
            </span>
            <span className="text-slate-400 dark:text-slate-500 type-caption">{t('tripCard.s002')}</span>
          </div>
          <span className="text-slate-500 type-body">{pickupLabel(item.pickupMode)}</span>
        </div>

        {isTripFull ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 whitespace-nowrap type-badge">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>{isDriver ? 'Đã kín chỗ' : 'Đã có xe'}</span>
          </span>
        ) : item.isCargoOnly ? (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60 shrink-0 whitespace-nowrap shadow-2xs type-badge"
            title={t('tripCard.s016')}
          >
            <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{t('tripCard.s003')}</span>
          </span>
        ) : isDriver && (item.vehicleType === 'truck_light' || item.isCargoVehicle) ? (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 shrink-0 whitespace-nowrap shadow-2xs type-body-strong"
            title={t('tripCard.s017')}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Thùng tải tiện chuyến + {seatsLeft > 0 ? '1 ghế phụ' : 'Hết ghế phụ'}</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 shrink-0 whitespace-nowrap shadow-2xs type-body-strong"
            title={
              isDriver
                ? seatsTotal
                  ? `Xe ${seatsTotal} chỗ · Chủ xe nhận ghép ${seatsLeft} ghế`
                  : `Chủ xe nhận ghép ${seatsLeft} ghế`
                : `Người đi cùng cần ghép ${seatsLeft} ghế`
            }
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            {isDriver ? (
              <span>
                {t('tripCard.s004')} <span className="tabular type-body">{seatsLeft}</span> ghế
                {seatsTotal ? <span className="sr-only type-body">/{seatsTotal}</span> : null}
              </span>
            ) : (
              <span>
                {t('tripCard.s005')} <span className="tabular type-body">{seatsLeft}</span> {t('tripCard.s006')}
              </span>
            )}
          </span>
        )}
      </div>

      {/* ── 4. SPECIFIC PICKUP / DROP-OFF POINT (SECONDARY CONTEXT) ── */}
      <div className="px-5 pb-2 pt-0.5 space-y-1">
        <div className="flex items-center gap-2 min-w-0 text-slate-600 dark:text-slate-300 type-body-strong">
          <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-slate-400 dark:text-slate-500 shrink-0 type-body">{t('tripCard.s007')}</span>
          <span className="truncate type-body">
            {fromSpot || item.pickupSpot || fromParsed.main}
          </span>
        </div>

        <div className="flex items-center gap-2 min-w-0 text-slate-600 dark:text-slate-300 type-body-strong">
          <Navigation className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="text-slate-400 dark:text-slate-500 shrink-0 type-body">{t('tripCard.s008')}</span>
          <span className="truncate type-body">
            {toSpot || item.dropoffSpot || toParsed.main}
          </span>
        </div>
      </div>

      {/* ── 5. TRUST, VEHICLE & ACTION (TRUST & ACTION) ── */}
      <div className="mt-auto px-5 pt-2.5 pb-4 flex flex-col gap-2.5 border-t border-slate-100 dark:border-white/[0.04]">
        {/* Row: Driver & Vehicle */}
        <div className="flex items-center justify-between gap-2">
          {/* Driver & Trust */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewTrustProfile?.(item);
            }}
            className="flex items-center gap-2 min-w-0 text-left cursor-pointer group/driver type-button"
            title={t('tripCard.s018')}
          >
            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 ring-1 ring-black/5 dark:ring-white/10">
              <User className="w-3.5 h-3.5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-700 dark:text-slate-200 truncate group-hover/driver:text-[#0071e3] transition-colors type-caption">
                  {driverDisplayName}
                </span>
                {item.isDriverVerified === true && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" title="Thông tin xác thực chủ xe" />}
              </div>

              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 type-caption">
                <span className="inline-flex items-center gap-0.5 type-body">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                  <span className="tabular text-slate-700 dark:text-slate-300 type-body-strong">{rating}</span>
                </span>
                {completedTrips > 0 ? (
                  <span className="opacity-70">· {completedTrips} chuyến</span>
                ) : (
                  <span className="opacity-70">{t('tripCard.s009')}</span>
                )}
              </div>
            </div>
          </button>

          {/* Vehicle & Real photo thumbnail — Tap to view Vehicle info & Photos */}
          {isDriver ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewCarPhotos?.(item);
              }}
              className="flex items-center gap-2 shrink-0 text-right cursor-pointer group/car rounded-xl p-1 -m-1 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-colors select-none type-button"
              title={`Xem thông tin và hình ảnh xe (${carDisplay})`}
            >
              <div className="flex items-center justify-end gap-1 text-slate-600 dark:text-slate-300 group-hover/car:text-[#0071e3] transition-colors type-body-strong">
                <Car className="w-3.5 h-3.5 text-slate-400 group-hover/car:text-[#0071e3] transition-colors shrink-0" />
                <span className="truncate max-w-[140px] sm:max-w-[170px]" title={carDisplay}>
                  {carDisplay}
                </span>
              </div>

              {coverPhoto ? (
                <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/[0.04] shrink-0 ring-1 ring-black/5 dark:ring-white/10 group-hover/car:ring-[#0071e3]/40 transition-all">
                  <img
                    src={coverPhoto}
                    alt=""
                    loading="lazy"
                    onError={() => setCoverFailed(true)}
                    className="w-full h-full object-cover group-hover/car:scale-110 transition-transform duration-200"
                  />
                  {photos.length > 1 && (
                    <span className="absolute bottom-0.5 right-0.5 inline-flex items-center gap-0.5 px-1 py-0.2 rounded-full bg-black/60 text-white type-badge">
                      <Camera className="w-2 h-2" />
                      {photos.length}
                    </span>
                  )}
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.04] flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0 ring-1 ring-black/5 dark:ring-white/10 group-hover/car:text-[#0071e3] transition-colors">
                  <Car className="w-4 h-4" />
                </div>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 shrink-0 type-caption">
              <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Tìm xe {item.capacity ? `${item.capacity} chỗ` : 'đi cùng'}</span>
            </div>
          )}
        </div>

        {/* Row: Amenities & CTA Button */}
        <div className="pt-2 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between gap-2">
          {item.vehicleType === 'truck_light' || item.isCargoVehicle ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-emerald-900 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-300/90 dark:border-emerald-700/80 shadow-2xs type-badge"
              title={t('tripCard.s020')}
            >
              <Truck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>{t('tripCard.s010')}</span>
            </span>
          ) : item.vehicleType === 'pickup' || item.hasCargoBed ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300/90 dark:border-amber-700/80 shadow-2xs type-badge"
              title={t('tripCard.s021')}
            >
              <Truck className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>{t('tripCard.s011')}</span>
            </span>
          ) : item.acceptsParcel ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sky-900 dark:text-sky-200 bg-sky-100/90 dark:bg-sky-950/70 border border-sky-300/90 dark:border-sky-700/80 shadow-2xs type-badge"
              title={t('tripCard.s022')}
            >
              <Package className="w-3.5 h-3.5 text-[#0071e3] dark:text-sky-400 shrink-0" />
              <span>{t('tripCard.s012')}</span>
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2 shrink-0 ml-auto">

            {isOwner ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onManage) onManage(item);
                  else if (onBook) onBook(item);
                }}
                className="h-9 px-3.5 rounded-full inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 cursor-pointer active:scale-[0.96] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 shrink-0 type-button"
                title={t('tripCard.s025')}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                <span className="lg:hidden">{t('tripCard.s013')}</span>
                <span className="hidden lg:inline">{t('tripCard.s014')}</span>
              </button>
            ) : isTripFull ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelect) onSelect(item);
                  else if (onViewRoute) onViewRoute(item);
                  else if (onBook) onBook(item);
                }}
                className="h-9 px-3.5 rounded-full inline-flex items-center justify-center whitespace-nowrap bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 active:scale-[0.96] transition-all cursor-pointer shrink-0 type-button"
                title={t('tripCard.s026')}
              >
                <span>{t('tripCard.s015')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onBook) onBook(item);
                }}
                className="h-9 px-4.5 rounded-full inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 cursor-pointer active:scale-[0.96] bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] text-white shadow-xs hover:shadow-md hover:shadow-blue-500/25 shrink-0 type-button"
                title={isDriver ? 'Bấm để chốt chuyến & vào chat ngay' : 'Bấm để nhận chở người này'}
              >
                <span>{isDriver ? 'Chốt đi cùng' : 'Nhận chở'}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
