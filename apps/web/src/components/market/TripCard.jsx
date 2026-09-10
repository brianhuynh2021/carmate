import React, { useState, useMemo } from 'react';
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
  Share2
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
  getUserOnlineStatus,
  getPriceGuardrail
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import PresenceDot from '../ui/PresenceDot.jsx';

export { parseLocation, getCorridorDisplay };

/**
 * RouteTimeline — Trục lộ trình trực quan dùng trong Modal hoặc xem nhanh
 */
export function RouteTimeline({ from, to, compact = false }) {
  const fromIsMap = isGoogleMapsUrl(from);
  const toIsMap = isGoogleMapsUrl(to);
  const fromParsed = parseLocation(from);
  const toParsed = parseLocation(to);

  return (
    <div className={`relative flex flex-col ${compact ? 'gap-2' : 'gap-2.5'} select-none`}>
      {/* Điểm xuất phát */}
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex flex-col items-center mt-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shrink-0" />
          <span
            className={`w-[1.5px] ${compact ? 'h-3.5' : 'min-h-[20px] h-full'} bg-slate-200 dark:bg-slate-700 my-1`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`font-bold text-slate-900 dark:text-white leading-snug truncate ${compact ? 'text-xs' : 'text-[14px]'}`}
          >
            {fromIsMap ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Vị trí ghim trên Google Maps</span>
              </span>
            ) : (
              fromParsed.main
            )}
          </p>
          {fromParsed.sub && !fromIsMap && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-medium leading-snug">
              {fromParsed.sub}
            </p>
          )}
        </div>
      </div>

      {/* Điểm đích đến */}
      <div className="flex items-start gap-3 min-w-0 -mt-1">
        <div className="flex items-center justify-center mt-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/20 shrink-0" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`font-bold text-slate-900 dark:text-white leading-snug truncate ${compact ? 'text-xs' : 'text-[14px]'}`}
          >
            {toIsMap ? (
              <span className="inline-flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Vị trí ghim trên Google Maps</span>
              </span>
            ) : (
              toParsed.main
            )}
          </p>
          {toParsed.sub && !toIsMap && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-medium leading-snug">
              {toParsed.sub}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * TripCard — Phân cấp thị giác 1-2 giây: WHEN → WHERE → PRICE → SEAT → TRUST
 * - Khi nào? Giờ + Ngày nổi bật dòng 1
 * - Đi đâu? Tuyến đường ngang với mũi tên ở cuối thanh lộ trình
 * - Giá & Chỗ còn lại: Song hành ở dòng 3 thoáng đạt
 * - Điểm đón / trả cụ thể: Dòng 4
 * - Uy tín, Chủ xe, Phương tiện & Nút hành động: Dòng 5 & 6
 */

/**
 * Chuẩn hoá hiển thị dòng xe kèm số chỗ ngồi (VD: "Mazda 2 · 5 chỗ", "Mitsubishi Xpander · 7 chỗ", "Xe 5 chỗ")
 */
export function getCarDisplay(carType, capacity) {
  const cap = Number(capacity) || Number(carType?.match(/(\d+)\s*chỗ/i)?.[1]) || 5;
  if (!carType || !carType.trim()) return `Xe ${cap} chỗ`;

  // Tách phần trong ngoặc đơn nếu có (vd "(Xe 7 chỗ)" hoặc "(Xe 5 chỗ gầm cao)")
  let raw = carType.split('(')[0].trim();
  // Bỏ các từ khoá phụ thừa
  raw = raw.replace(/\s*(du\s*lịch|cá nhân|gia đình|tiện chuyến|biển vàng|biển trắng)\b/gi, '').trim();

  // Kiểm tra nếu chuỗi chỉ là "Xe 7 chỗ", "7 chỗ", "Xe 5 chỗ"
  if (!raw || /^(?:xe\s*)?\d+\s*chỗ$/i.test(raw) || raw.toLowerCase() === 'xe') {
    return `Xe ${cap} chỗ`;
  }

  // Khử phần "... 5 chỗ" hoặc "xe 5 chỗ" ở cuối chuỗi nếu người dùng gõ liền (vd "Mazda 2 5 chỗ")
  let cleanModel = raw.replace(/\s+(?:xe\s*)?\d+\s*chỗ.*$/i, '').trim();
  if (!cleanModel || cleanModel.toLowerCase() === 'xe') {
    return `Xe ${cap} chỗ`;
  }

  return `${cleanModel} · ${cap} chỗ`;
}

export default function TripCard({
  item,
  isOwner = false,
  onBook,
  onManage,
  onViewTrustProfile,
  onViewRoute,
  onViewCarPhotos,
  onShare,
  onSelect = null
}) {
  const { lang } = useI18n();
  const [coverFailed, setCoverFailed] = useState(false);

  const price = item?.basePricePerSeat || item?.expectedPrice || item?.suggestedContribution || item?.price || 180000;

  // Dải biên độ giá thông minh (Price Guardrail Benchmark)
  const priceGuardrail = useMemo(() => {
    if (!item) return null;
    return getPriceGuardrail(item?.from, item?.to, price);
  }, [item, price]);

  if (!item) return null;

  const isDriver = item.type === 'driver_offer';
  const formattedPrice = `${Number(price || 0).toLocaleString('vi-VN')}đ`;

  // Danh tính công khai: chỉ hiển thị bí danh vai trò + mã định danh chuẩn (Chủ xe CX-xxx / Khách KX-xxx)
  const driverDisplayName = toPublicAlias(item);

  // Trạng thái trực tuyến (Live Presence Telemetry: Đèn xanh online / Đèn đỏ offline)
  const onlineStatus = getUserOnlineStatus({ ...item, isOwner });

  const fromParsed = parseLocation(item.from);
  const toParsed = parseLocation(item.to);

  // Điểm hẹn cụ thể rút gọn
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

  // Khử lặp tên tỉnh/thành đã có ở tiêu đề trục lộ trình và từ khoá xe thừa
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

  // Sao trung bình đánh giá chuẩn (luôn giữ dạng * 5.0 hoặc * 4.9)
  const rawRating = Number(item.rating);
  const ratingValue = Number.isFinite(rawRating) && rawRating > 0
    ? Math.round(rawRating * 10) / 10
    : 5.0;
  const rating = ratingValue % 1 === 0 ? `${ratingValue}.0` : String(ratingValue);
  const completedTrips = Number(item.completedCount) || 0;

  // "5 chỗ" (sức chứa) khác hẳn "còn 5 chỗ" (đặt được). Luôn hiện dạng còn/tổng.
  const seatsLeft = isDriver ? Number(item.availableSeats) || 0 : Number(item.seatsNeeded) || 1;
  const seatsTotal = isDriver ? Number(item.capacity) || Math.max(seatsLeft, 4) : null;

  // Ngày hiển thị gọn gàng, tinh tế (Stanford Ergonomics & Apple HIG: triệt tiêu hậu tố dd/mm dư thừa)
  const dateLabel = formatCleanDateLabel(item.date);

  // Giờ: định dạng giờ chính xác (buổi sáng giữ chữ Sáng để phân biệt, buổi chiều/tối lược bỏ chữ thừa)
  const rawTime = getTimeSlotLabel(item, lang) || '';
  const timeLabel = sanitizeTimeLabel((rawTime.match(/^([^()]+)\s*\(/)?.[1] || rawTime).trim());

  // Ảnh xe thật — hiển thị thumbnail thanh lịch nếu có
  const photos = (item.carPhotos || []).filter(Boolean);
  const rawCover = photos.length > 0 ? normalizePhotoUrl(photos[0]) : null;
  const coverPhoto = coverFailed ? null : rawCover;

  // Hiển thị tên xe & số chỗ ngồi đồng nhất (VD: "Mazda 2 · 5 chỗ", "Mitsubishi Xpander · 7 chỗ", "Xe 5 chỗ")
  const carDisplay = getCarDisplay(item.carType, item.capacity);

  return (
    <article
      id={`trip-${item.id}`}
      onClick={() => onViewRoute?.(item)}
      className="flex flex-col h-full relative overflow-hidden rounded-3xl bg-white dark:bg-[#151b26] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#0071e3]/40 dark:hover:border-sky-400/40 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.10),0_20px_48px_rgba(0,0,0,0.06)] hover:-translate-y-1 active:scale-[0.995] transition-all duration-200 ease-out group select-none cursor-pointer"
    >
      {/* ── 1. KHI NÀO? (WHEN) + BADGE NGỮ CẢNH TINH TẾ ── */}
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-1">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[15.5px] sm:text-[17px] font-bold text-slate-900 dark:text-white tabular font-mono tracking-tight shrink-0">
            {timeLabel}
          </span>
          <span className="text-[12px] sm:text-[12.5px] text-slate-500 dark:text-slate-400 font-medium shrink-0 whitespace-nowrap">
            · {dateLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <PresenceDot isOnline={onlineStatus.isOnline} showLabel detail={onlineStatus.detail} />
        </div>
      </div>

      {/* ── 2. ĐI ĐÂU → ĐÂU? (WHERE - LỘ TRÌNH CHUẨN APPLE HIG & KHÔNG GÃY/DÃN) ── */}
      <div className="px-5 pt-2 pb-1.5">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <span className="text-[16.5px] font-bold tracking-tight truncate max-w-[44%]">
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
          <span className="text-[16.5px] font-bold tracking-tight truncate max-w-[44%]">
            {toParsed.main}
          </span>
        </div>
      </div>

      {/* ── 3. GIÁ BAO NHIÊU? (PRICE) ── VÀ ── CÒN CHỖ KHÔNG? (SEAT) ── */}
      <div className="flex items-center justify-between gap-3 px-5 py-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[21px] font-extrabold tracking-tight text-slate-900 dark:text-white tabular font-mono leading-none">
              {formattedPrice}
            </span>
            <span className="text-[12px] text-slate-400 dark:text-slate-500 font-medium">/người</span>
          </div>
          {priceGuardrail?.comparisonBadge && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold w-fit px-1.5 py-0.5 rounded-md ${
                priceGuardrail.statusTone === 'emerald'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/50'
                  : priceGuardrail.statusTone === 'amber'
                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/50'
                    : priceGuardrail.statusTone === 'rose'
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/50'
                      : 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200/50'
              }`}
            >
              {priceGuardrail.comparisonBadge}
            </span>
          )}
        </div>

        {isTripFull ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 whitespace-nowrap">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>{isDriver ? 'Đã kín chỗ' : 'Đã có xe'}</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 shrink-0 whitespace-nowrap shadow-2xs"
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
                Nhận ghép <span className="tabular">{seatsLeft}</span> ghế
                {seatsTotal ? <span className="sr-only">/{seatsTotal}</span> : null}
              </span>
            ) : (
              <span>
                Cần ghép <span className="tabular">{seatsLeft}</span> ghế
              </span>
            )}
          </span>
        )}
      </div>

      {/* ── 4. ĐIỂM ĐÓN / TRẢ CỤ THỂ (SECONDARY CONTEXT) ── */}
      <div className="px-5 pb-2 pt-0.5 space-y-1">
        <div className="flex items-center gap-2 min-w-0 text-[12px] text-slate-600 dark:text-slate-300">
          <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-slate-400 dark:text-slate-500 font-medium shrink-0">Đón:</span>
          <span className="truncate font-medium">
            {fromSpot || item.pickupSpot || fromParsed.main}
          </span>
        </div>

        <div className="flex items-center gap-2 min-w-0 text-[12px] text-slate-600 dark:text-slate-300">
          <Navigation className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="text-slate-400 dark:text-slate-500 font-medium shrink-0">Trả:</span>
          <span className="truncate font-medium">
            {toSpot || item.dropoffSpot || toParsed.main}
          </span>
        </div>
      </div>

      {/* ── 5. NIỀM TIN, PHƯƠNG TIỆN & HÀNH ĐỘNG (TRUST & ACTION) ── */}
      <div className="mt-auto px-5 pt-2.5 pb-4 flex flex-col gap-2.5 border-t border-slate-100 dark:border-white/[0.04]">
        {/* Hàng: Người lái & Phương tiện */}
        <div className="flex items-center justify-between gap-2">
          {/* Người lái & Tín nhiệm */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewTrustProfile?.(item);
            }}
            className="flex items-center gap-2 min-w-0 text-left cursor-pointer group/driver"
            title="Xem hồ sơ uy tín"
          >
            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 ring-1 ring-black/5 dark:ring-white/10">
              <User className="w-3.5 h-3.5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate group-hover/driver:text-[#0071e3] transition-colors">
                  {driverDisplayName}
                </span>
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" title="Đã xác minh" />
              </div>

              <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-0.5 font-medium">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                  <span className="tabular font-semibold text-slate-700 dark:text-slate-300">{rating}</span>
                </span>
                {completedTrips > 0 ? (
                  <span className="opacity-70">· {completedTrips} chuyến</span>
                ) : (
                  <span className="opacity-70">· Chuyến đầu</span>
                )}
              </div>
            </div>
          </button>

          {/* Xe & Thumbnail ảnh thật — Bấm vào xem Thông tin & Hình ảnh xe */}
          {isDriver ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewCarPhotos?.(item);
              }}
              className="flex items-center gap-2 shrink-0 text-right cursor-pointer group/car rounded-xl p-1 -m-1 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-colors select-none"
              title={`Xem thông tin và hình ảnh xe (${carDisplay})`}
            >
              <div className="flex items-center justify-end gap-1 text-[11.5px] font-medium text-slate-600 dark:text-slate-300 group-hover/car:text-[#0071e3] transition-colors">
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
                    <span className="absolute bottom-0.5 right-0.5 inline-flex items-center gap-0.5 px-1 py-0.2 rounded-full bg-black/60 text-white text-[8px] font-bold">
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
            <div className="flex items-center gap-1 text-[11.5px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
              <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Tìm xe {item.capacity ? `${item.capacity} chỗ` : 'đi cùng'}</span>
            </div>
          )}
        </div>

        {/* Hàng: Tiện ích & Nút CTA */}
        <div className="pt-2 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between gap-2">
          {item.acceptsParcel ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.05]">
              <Package className="w-3 h-3 shrink-0" />
              <span>Nhận gửi đồ</span>
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {onShare && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(item);
                }}
                className="h-9 w-9 rounded-full inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-[#0071e3] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                title="Tạo ảnh lịch trình & chia sẻ nhanh lên Zalo"
                aria-label="Chia sẻ thông tin chuyến đi"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}

            {isOwner ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onManage) onManage(item);
                  else if (onBook) onBook(item);
                }}
                className="h-9 px-3.5 rounded-full text-[12px] font-semibold tracking-tight inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 cursor-pointer active:scale-[0.96] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 shrink-0"
                title="Chuyến đi do bạn đăng. Bấm để xem và quản lý"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                <span className="lg:hidden">Quản lý</span>
                <span className="hidden lg:inline">Quản lý chuyến của bạn</span>
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
                className="h-9 px-3.5 rounded-full text-[12px] font-semibold tracking-tight inline-flex items-center justify-center whitespace-nowrap bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 active:scale-[0.96] transition-all cursor-pointer shrink-0"
                title="Chuyến đã đủ người. Bấm để xem thông tin chi tiết"
              >
                <span>Xem chi tiết</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onBook) onBook(item);
                }}
                className="h-9 px-4.5 rounded-full text-[12.5px] font-semibold tracking-tight inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 cursor-pointer active:scale-[0.96] bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] text-white shadow-xs hover:shadow-md hover:shadow-blue-500/25 shrink-0"
                title={isDriver ? 'Bấm để liên hệ & ghép chuyến ngay' : 'Bấm để nhận chở người này'}
              >
                <span>{isDriver ? 'Ghép chuyến' : 'Nhận chở'}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
