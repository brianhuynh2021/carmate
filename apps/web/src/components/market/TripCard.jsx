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
  UserCheck,
  SlidersHorizontal,
  Car,
  CheckCircle2
} from 'lucide-react';
import {
  getTimeSlotLabel,
  isGoogleMapsUrl,
  formatTripDateDisplay,
  parseLocation,
  getCorridorDisplay
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';

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
export default function TripCard({
  item,
  isOwner = false,
  onBook,
  onManage,
  onViewTrustProfile,
  onViewRoute,
  onViewCarPhotos
}) {
  const { lang } = useI18n();
  const isDriver = item.type === 'driver_offer';
  const isConvenient =
    isDriver &&
    (item.carCategory === 'convenient_trip' ||
      item.notes?.toLowerCase().includes('tiện chuyến') ||
      item.notes?.toLowerCase().includes('biển vàng') ||
      item.carType?.toLowerCase().includes('tiện chuyến'));

  const price = item.basePricePerSeat || item.expectedPrice || item.suggestedContribution || item.price || 180000;
  const formattedPrice = `${Number(price || 0).toLocaleString('vi-VN')}đ`;

  // Danh tính công khai: chỉ hiển thị bí danh vai trò + mã định danh
  const driverDisplayName = (() => {
    const role = isDriver ? (isConvenient ? 'Xe tiện chuyến' : 'Chủ xe') : 'Khách tìm xe';
    const candidate = String(item.publicName || '').trim();
    const isAlias = /^(Chủ xe|Khách|Xe tiện chuyến|Người)\b/i.test(candidate);
    if (candidate && isAlias && !candidate.includes('Test E2E')) return candidate;
    if (item.maskedCode) return `${role} ${item.maskedCode}`;
    const seed = String(item.id || '');
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 900;
    return `${role} #${100 + hash}`;
  })();

  const fromParsed = parseLocation(item.from);
  const toParsed = parseLocation(item.to);

  // Điểm hẹn cụ thể rút gọn
  const briefSpot = (sub) => {
    if (!sub) return '';
    const s = String(sub).trim();
    if (s.length <= 42) return s;
    return s.split(/\s*[/;]\s*/)[0].trim();
  };
  const rawFromSpot = briefSpot(fromParsed.sub);
  const rawToSpot = briefSpot(toParsed.sub);

  // Khử lặp tên tỉnh/thành đã có ở tiêu đề trục lộ trình
  const cleanSpot = (spot, city) => {
    if (!spot) return '';
    if (!city) return spot;
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleaned = spot.replace(new RegExp(`,?\\s*${escaped}\\s*`, 'gi'), '').trim();
    return cleaned || spot;
  };

  const fromSpot = cleanSpot(rawFromSpot, fromParsed.main);
  const toSpot = cleanSpot(rawToSpot, toParsed.main);
  const isTripFull = item.status === 'full' || Boolean(item.isFull);

  // Sao trung bình thật từ đánh giá sau chuyến
  const rating = Number.isFinite(Number(item.rating)) ? Number(item.rating) : null;
  const ratingCount = Number(item.ratingCount) || 0;

  // Điểm tín nhiệm tính từ hồ sơ thật
  const trustScore = Number.isFinite(Number(item.trustScore)) ? Number(item.trustScore) : null;
  const trustTone =
    trustScore == null
      ? ''
      : trustScore >= 90
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
        : trustScore >= 65
          ? 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'
          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';

  // "5 chỗ" (sức chứa) khác hẳn "còn 5 chỗ" (đặt được). Luôn hiện dạng còn/tổng.
  const seatsLeft = isDriver ? Number(item.availableSeats) || 0 : Number(item.seatsNeeded) || 1;
  const seatsTotal = isDriver ? Number(item.capacity) || Math.max(seatsLeft, 4) : null;

  // Ngày rút gọn: "Ngày mai (09/09)" → "09/09" hoặc "Hôm nay · 09/09"
  const rawDate = item.date ? formatTripDateDisplay(item.date) : 'Hôm nay';
  const dateLabel = rawDate.replace(/\s*\((\d{1,2}\/\d{1,2})\)\s*/, ' · $1').trim();

  // Giờ: định dạng giờ chính xác
  const rawTime = getTimeSlotLabel(item, lang) || '';
  const timeLabel = (rawTime.match(/^(\d{1,2}:\d{2})\s*\(/)?.[1] || rawTime).trim();

  // Ảnh xe thật — hiển thị thumbnail thanh lịch nếu có
  const [coverFailed, setCoverFailed] = useState(false);
  const photos = (item.carPhotos || []).filter(Boolean);
  const rawCover = photos.length > 0 ? photos[0].url || photos[0] : null;
  const coverPhoto = coverFailed ? null : rawCover;

  return (
    <article
      id={`trip-${item.id}`}
      onClick={() => onViewRoute?.(item)}
      className="flex flex-col h-full relative overflow-hidden rounded-3xl bg-white dark:bg-[#151b26] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#0071e3]/40 dark:hover:border-sky-400/40 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.10),0_20px_48px_rgba(0,0,0,0.06)] hover:-translate-y-1 active:scale-[0.995] transition-all duration-200 ease-out group select-none cursor-pointer"
    >
      {/* ── 1. KHI NÀO? (WHEN) + BADGE NGỮ CẢNH TINH TẾ ── */}
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-1">
        <div className="flex items-baseline gap-1.5 whitespace-nowrap min-w-0">
          <span className="text-[17px] font-bold text-slate-900 dark:text-white tabular font-mono tracking-tight">
            {timeLabel}
          </span>
          <span className="text-[12.5px] text-slate-500 dark:text-slate-400 font-medium truncate">
            · {dateLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isOwner ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 shrink-0 whitespace-nowrap">
              <UserCheck className="w-3 h-3" />
              <span>Chuyến của bạn</span>
            </span>
          ) : isTripFull ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap">
              <Lock className="w-3 h-3" />
              <span>Đã kín chỗ</span>
            </span>
          ) : !isDriver ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60 shrink-0 whitespace-nowrap">
              <span>Khách tìm xe</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* ── 2. ĐI ĐÂU → ĐÂU? (WHERE - MŨI TÊN Ở CUỐI ĐƯỜNG KẺ) ── */}
      <div className="px-5 pt-2 pb-1.5">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <span className="text-[16.5px] font-bold tracking-tight truncate max-w-[44%]">
            {fromParsed.main}
          </span>
          <div className="flex-1 flex items-center min-w-[32px] px-1">
            <div className="h-[1.5px] flex-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 -ml-0.5" />
          </div>
          <span className="text-[16.5px] font-bold tracking-tight truncate max-w-[44%] text-right">
            {toParsed.main}
          </span>
        </div>
      </div>

      {/* ── 3. GIÁ BAO NHIÊU? (PRICE) ── VÀ ── CÒN CHỖ KHÔNG? (SEAT) ── */}
      <div className="flex items-center justify-between gap-3 px-5 py-2">
        <div className="flex items-baseline gap-0.5">
          <span className="text-[21px] font-extrabold tracking-tight text-slate-900 dark:text-white tabular font-mono leading-none">
            {formattedPrice}
          </span>
          <span className="text-[12px] text-slate-400 dark:text-slate-500 font-medium">/người</span>
        </div>

        {isTripFull ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 whitespace-nowrap">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Đã kín chỗ</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 shrink-0 whitespace-nowrap shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            {isDriver ? (
              <span>
                Còn <span className="tabular">{seatsLeft}</span>
                {seatsTotal ? <span className="tabular opacity-75">/{seatsTotal}</span> : null} chỗ
              </span>
            ) : (
              <span>
                Cần <span className="tabular">{seatsLeft}</span> chỗ
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
            {fromSpot || fromParsed.main}
          </span>
        </div>

        <div className="flex items-center gap-2 min-w-0 text-[12px] text-slate-600 dark:text-slate-300">
          <Navigation className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="text-slate-400 dark:text-slate-500 font-medium shrink-0">Trả:</span>
          <span className="truncate font-medium">
            {toSpot || toParsed.main}
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
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate group-hover/driver:text-[#0071e3] transition-colors">
                  {driverDisplayName}
                </span>
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" title="Đã xác minh" />
              </div>

              <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                {rating != null ? (
                  <span className="inline-flex items-center gap-0.5 font-medium">
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    <span className="tabular font-semibold text-slate-700 dark:text-slate-300">{rating}</span>
                    {ratingCount > 0 && <span className="opacity-70">({ratingCount})</span>}
                  </span>
                ) : trustScore != null ? (
                  <span className={`px-1 rounded font-semibold tabular ${trustTone}`}>
                    {trustScore}đ
                  </span>
                ) : (
                  <span>Đã xác minh</span>
                )}
                {item.completedCount > 0 && (
                  <span className="opacity-70">· {item.completedCount} chuyến</span>
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
              title="Xem thông tin và hình ảnh xe"
            >
              <div>
                <div className="flex items-center justify-end gap-1 text-[11.5px] font-medium text-slate-600 dark:text-slate-300 group-hover/car:text-[#0071e3] transition-colors">
                  <Car className="w-3 h-3 text-slate-400 group-hover/car:text-[#0071e3] transition-colors shrink-0" />
                  <span className="truncate max-w-[120px]">
                    {item.carType
                      ? item.carType.split('(')[0].trim().replace(/\s*(cá nhân|gia đình)\b/gi, '')
                      : `Xe ${item.capacity || 5} chỗ`}
                  </span>
                </div>
                {item.carType && !item.carType.toLowerCase().includes('chỗ') && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {item.capacity || 5} chỗ
                  </p>
                )}
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
              <Car className="w-3 h-3 text-slate-400" />
              <span>Khách tìm xe</span>
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
              disabled
              className="h-9 px-3.5 rounded-full text-[12px] font-semibold tracking-tight inline-flex items-center justify-center whitespace-nowrap bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 cursor-not-allowed shrink-0"
            >
              <Lock className="w-3 h-3 mr-1.5" />
              <span>Đã kín chỗ</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onBook) onBook(item);
              }}
              className="h-9 px-4.5 rounded-full text-[12.5px] font-semibold tracking-tight inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 cursor-pointer active:scale-[0.96] bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] text-white shadow-xs hover:shadow-md hover:shadow-blue-500/25 shrink-0 ml-auto"
              title={isDriver ? 'Bấm để liên hệ & ghép chuyến ngay' : 'Bấm để nhận chở người này'}
            >
              <span>{isDriver ? 'Ghép chuyến' : 'Nhận chở'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
