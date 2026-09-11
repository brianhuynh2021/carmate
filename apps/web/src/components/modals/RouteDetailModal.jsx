import React from 'react';
import {
  MapPin,
  Share2,
  SlidersHorizontal,
  ArrowRight,
  User,
  CheckCircle2,
  Star,
  Calendar,
  Users,
  Car,
  Camera,
  ShieldCheck,
  Package
} from 'lucide-react';
import {
  getRouteCorridor,
  formatVND,
  isGoogleMapsUrl,
  decodeHtmlEntities,
  formatCleanDateLabel,
  getTimeSlotLabel,
  toPublicAlias,
  getUserOnlineStatus,
  normalizePhotoUrl
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import PresenceDot from '../ui/PresenceDot.jsx';

export default function RouteDetailModal({
  trip,
  isOwner = false,
  onClose,
  onManage,
  onBook,
  onShare,
  onViewCarPhotos
}) {
  const { lang } = useI18n();
  const corridor = trip ? getRouteCorridor(trip.routeCategory) : null;
  const isDriver = trip?.type === 'driver_offer';
  const price = trip ? trip.basePricePerSeat || trip.expectedPrice || trip.suggestedContribution || 180000 : 0;
  const tripFrom = decodeHtmlEntities(trip?.from);
  const tripTo = decodeHtmlEntities(trip?.to);
  const waypointNote = decodeHtmlEntities(trip?.waypointNote);

  // Mọi hook đã được gọi ở trên — an toàn để early return tại đây
  if (!trip) return null;

  // Trạng thái trực tuyến của người đăng bài (Live Presence Telemetry: Đèn xanh / Đèn đỏ)
  const onlineStatus = getUserOnlineStatus({ ...trip, isOwner });

  // Nhận diện chiều di chuyển thực tế (Sài Gòn ➔ Tỉnh vs Tỉnh ➔ Sài Gòn)
  // để đảo chiều mốc địa danh và trạm dừng chính xác 100%
  const isReverse =
    trip.direction === 'sg_to_province' ||
    (/sài gòn|tp\.?\s*hcm|hồ chí minh/i.test(tripFrom) && !/sài gòn|tp\.?\s*hcm|hồ chí minh/i.test(tripTo));

  const defaultStart = isReverse ? corridor?.endLandmark : corridor?.startLandmark;
  const defaultEnd = isReverse ? corridor?.startLandmark : corridor?.endLandmark;

  // Điểm đón & Điểm trả chuẩn hóa
  const pickupTitle = isGoogleMapsUrl(tripFrom) ? 'Vị trí ghim trên Google Maps' : tripFrom || defaultStart?.name;
  const pickupAddress = trip?.pickupSpot || defaultStart?.address || (isReverse ? '' : waypointNote);

  const dropoffTitle = isGoogleMapsUrl(tripTo) ? 'Vị trí ghim trên Google Maps' : tripTo || defaultEnd?.name;
  const dropoffAddress = trip?.dropoffSpot || defaultEnd?.address || (isReverse ? waypointNote : '');

  // Trạm dừng dọc tuyến theo chiều di chuyển thực tế
  const rawWaypoints = corridor?.waypoints || [];
  const orderedWaypoints = isReverse ? rawWaypoints.slice().reverse() : rawWaypoints;
  const transitWaypoints = orderedWaypoints.length > 2 ? orderedWaypoints.slice(1, -1) : orderedWaypoints;

  // Lịch trình gọn gàng, chuẩn công thái học
  const dateLabel = formatCleanDateLabel(trip.date);
  const rawTime = getTimeSlotLabel(trip, lang) || '';
  const timeLabel = (rawTime.match(/^([^()]+)\s*\(/)?.[1] || rawTime).trim() || 'Linh hoạt';

  // Nhu cầu ghế (Stanford Ergonomics: "Nhận ghép X ghế" / "Cần ghép X ghế")
  const seatsCount = isDriver ? Number(trip.availableSeats) || 0 : Number(trip.seatsNeeded) || 1;
  const isTripFull = trip.status === 'full' || Boolean(trip.isFull) || (isDriver && seatsCount === 0);
  const seatsLabel = isTripFull
    ? (isDriver ? 'Đã kín chỗ' : 'Đã có xe')
    : isDriver
      ? `Nhận ghép ${seatsCount} ghế`
      : `Cần ghép ${seatsCount} ghế`;

  // Phương tiện: Chuẩn hóa hiển thị dòng xe và số chỗ ngồi
  const rawCar = trip.carType || '';
  const cap = Number(trip.capacity) || Number(rawCar.match(/(\d+)\s*chỗ/i)?.[1]) || 5;
  const isGenericCar =
    !rawCar ||
    /^(?:xe\s*)?\d+\s*chỗ$/i.test(rawCar.trim()) ||
    rawCar.toLowerCase() === 'xe' ||
    /^(?:xe\s*)?(?:du\s*lịch|ô\s*tô|gia\s*đình)?(?:\s*[4-7]\s*chỗ|\s*5-7\s*chỗ)?$/i.test(rawCar.trim());

  let carDisplay = `Xe ${cap} chỗ`;
  let carSub = `${cap} chỗ`;

  if (!isGenericCar) {
    const cleanBrand = rawCar
      .split('(')[0]
      .trim()
      .replace(/\s*(du\s*lịch|cá nhân|gia đình|tiện chuyến|biển vàng|biển trắng)\b/gi, '')
      .replace(/\s+(?:xe\s*)?\d+\s*chỗ.*$/i, '')
      .trim();
    if (cleanBrand && cleanBrand.toLowerCase() !== 'xe') {
      carDisplay = cleanBrand;
      carSub = `${cap} chỗ`;
    }
  }

  // Đánh giá & uy tín
  const rawRating = Number(trip.rating);
  const ratingValue = Number.isFinite(rawRating) && rawRating > 0 ? Math.round(rawRating * 10) / 10 : 5.0;
  const rating = ratingValue % 1 === 0 ? `${ratingValue}.0` : String(ratingValue);
  const completedTrips = Number(trip.completedCount) || 0;

  // Ảnh xe thật
  const photos = (trip.carPhotos || []).filter(Boolean);

  return (
    <Modal
      onClose={onClose}
      size="lg"
      icon={MapPin}
      title={`${tripFrom} → ${tripTo}`}
      subtitle={corridor ? `Hành lang ${corridor.name}` : waypointNote || 'Lộ trình di chuyển trực tiếp'}
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 w-full">
          <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-[#1d1d1f] dark:text-white tracking-tight leading-none font-mono">
                {formatVND(price)}
              </span>
              <span className="text-xs text-[#86868b] dark:text-slate-400">/người</span>
            </div>

            {/* Nút chia sẻ trên Mobile */}
            {onShare && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onShare(trip);
                }}
                title="Chia sẻ thông tin chuyến đi"
                className="sm:hidden h-9 px-3 rounded-xl font-semibold text-xs text-[#0071e3] dark:text-blue-400 bg-[#0071e3]/10 hover:bg-[#0071e3]/20 border border-[#0071e3]/25 shadow-xs inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>Chia sẻ</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Nút chia sẻ trên Desktop */}
            {onShare && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onShare(trip);
                }}
                title="Chia sẻ thông tin chuyến đi"
                className="hidden sm:inline-flex h-10 px-3.5 rounded-xl font-semibold text-xs text-[#0071e3] dark:text-blue-400 bg-[#0071e3]/10 hover:bg-[#0071e3]/20 border border-[#0071e3]/25 shadow-xs items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] shrink-0"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>Chia sẻ</span>
              </button>
            )}

            {isOwner ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onManage) onManage(trip);
                  else if (onBook) onBook(trip);
                }}
                className="h-10 px-4.5 rounded-xl font-semibold text-xs text-amber-900 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 border border-amber-300 shadow-xs inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] w-full sm:w-auto shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-800" />
                <span>Quản lý / Chỉnh sửa chuyến</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isTripFull}
                onClick={() => {
                  if (isTripFull) return;
                  onClose();
                  onBook(trip);
                }}
                className={`h-10 px-5 rounded-xl font-semibold text-xs transition-all cursor-pointer active:scale-[0.98] w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 ${
                  isTripFull
                    ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-400 cursor-not-allowed'
                    : 'text-white bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] shadow-sm shadow-[#0071e3]/20'
                }`}
              >
                <span>{isTripFull ? (isDriver ? 'Đã kín chỗ' : 'Đã có xe') : isDriver ? 'Giữ chỗ trước (0đ cọc)' : 'Đón khách này'}</span>
                {!isTripFull && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3.5">
        {/* ── 1. THÔNG TIN ĐỐI TÁC (APPLE LIQUID CARD + LIVE PRESENCE + RATING) ── */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-white/80 dark:bg-white/[0.04] backdrop-blur-md border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 ring-1 ring-black/5 dark:ring-white/10 shadow-2xs">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs sm:text-sm text-[#1d1d1f] dark:text-white truncate">
                  {toPublicAlias(trip)}
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" title="Đã xác minh" />
                <span className="text-[11px] text-[#86868b] font-mono">#{trip.maskedCode || trip.id?.slice(-4)}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#86868b] dark:text-slate-400 truncate mt-0.5">
                <span className="inline-flex items-center gap-0.5 font-semibold text-slate-700 dark:text-slate-300">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                  <span>{rating}</span>
                </span>
                <span>·</span>
                <span>{completedTrips > 0 ? `${completedTrips} chuyến` : 'Chuyến đầu'}</span>
                {trip.hometown && (
                  <>
                    <span>·</span>
                    <span className="truncate">{trip.hometown}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <PresenceDot isOnline={onlineStatus.isOnline} showLabel detail={onlineStatus.detail} />
          </div>
        </div>

        {/* ── 2. BENTO GLANCE BAR: LỊCH TRÌNH · NHU CẦU · PHƯƠNG TIỆN ── */}
        <div className="grid grid-cols-3 gap-2">
          {/* Lịch khởi hành */}
          <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06] flex flex-col items-center text-center justify-center min-w-0">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <Calendar className="w-3 h-3 text-[#0071e3]" />
              <span>Khởi hành</span>
            </div>
            <span className="text-[12px] sm:text-[13px] font-bold text-slate-900 dark:text-white mt-1 truncate max-w-full font-mono">
              {timeLabel}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-full">
              {dateLabel}
            </span>
          </div>

          {/* Nhu cầu ghế */}
          <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06] flex flex-col items-center text-center justify-center min-w-0">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <Users className="w-3 h-3 text-emerald-500" />
              <span>Nhu cầu</span>
            </div>
            <span className={`text-[12px] sm:text-[13px] font-bold mt-1 truncate max-w-full ${isTripFull ? 'text-slate-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {seatsLabel}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-full">
              {isDriver ? 'Chỗ trống trên xe' : 'Số ghế cần đi'}
            </span>
          </div>

          {/* Phương tiện */}
          <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06] flex flex-col items-center text-center justify-center min-w-0">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <Car className="w-3 h-3 text-indigo-500" />
              <span>{isDriver ? 'Phương tiện' : 'Nhu cầu xe'}</span>
            </div>
            <span className="text-[12px] sm:text-[13px] font-bold text-slate-900 dark:text-white mt-1 truncate max-w-full" title={carDisplay}>
              {isDriver ? carDisplay : `${cap} chỗ`}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-full">
              {isDriver ? carSub : 'Tìm xe đi cùng'}
            </span>
          </div>
        </div>

        {/* ── 3. TRỤC LỘ TRÌNH APPLE TRANSIT METRO: ĐÓN ➔ TRẠM DỌC TUYẾN ➔ TRẢ ── */}
        <div className="rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] p-4 relative overflow-hidden">
          {/* Điểm đón */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center mt-1 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              <span className="w-0.5 h-10 sm:h-12 bg-gradient-to-b from-emerald-500 via-sky-400 to-rose-500 my-1" />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Điểm đón
              </p>
              <p className="text-[14.5px] sm:text-[15px] font-bold text-slate-900 dark:text-white mt-0.5">
                {pickupTitle}
              </p>
              {pickupAddress && (
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {pickupAddress}
                </p>
              )}
            </div>
          </div>

          {/* Điểm trả */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center mt-1 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/20" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold text-rose-500 uppercase tracking-wider">
                Điểm trả
              </p>
              <p className="text-[14.5px] sm:text-[15px] font-bold text-slate-900 dark:text-white mt-0.5">
                {dropoffTitle}
              </p>
              {dropoffAddress && (
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {dropoffAddress}
                </p>
              )}
            </div>
          </div>

          {/* Trạm đón/trả dọc tuyến */}
          {transitWaypoints.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {isDriver
                    ? `Xe đi ngang qua (${transitWaypoints.length} trạm đón trả dọc tuyến)`
                    : `Lộ trình mong muốn (${transitWaypoints.length} trạm đón trả dọc tuyến)`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {transitWaypoints.map((wp, idx) => (
                  <React.Fragment key={wp.name || idx}>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11.5px] font-medium bg-white dark:bg-white/[0.06] border border-slate-200/70 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 shadow-2xs whitespace-nowrap shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                      <span>{wp.name}</span>
                    </span>
                    {idx < transitWaypoints.length - 1 && (
                      <span className="text-slate-300 dark:text-slate-600 text-xs shrink-0 select-none">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 4. XEM TRƯỚC ẢNH XE THỰC TẾ (NẾU CHỦ XE ĐÃ TẢI ẢNH LÊN) ── */}
        {photos.length > 0 && (
          <div className="p-3 rounded-2xl bg-white/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <Camera className="w-3.5 h-3.5 text-[#0071e3]" />
                <span>Hình ảnh xe thực tế ({photos.length} góc ảnh)</span>
              </div>
              {onViewCarPhotos && (
                <button
                  type="button"
                  onClick={() => onViewCarPhotos(trip)}
                  className="text-[11px] font-semibold text-[#0071e3] hover:underline cursor-pointer"
                >
                  Xem toàn màn hình →
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photos.slice(0, 3).map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onViewCarPhotos?.(trip)}
                  className="aspect-4/3 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 relative group cursor-pointer ring-1 ring-black/5 dark:ring-white/10"
                >
                  <img
                    src={normalizePhotoUrl(p)}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  {idx === 2 && photos.length > 3 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold">
                      +{photos.length - 3}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 5. TIỆN ÍCH GỬI ĐỒ & GHI CHÚ ── */}
        {trip.acceptsParcel && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/[0.06]">
            <Package className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>Có nhận gửi đồ, bưu kiện tiện chuyến dọc tuyến</span>
          </div>
        )}

        {trip.notes && (
          <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
              💡 Ghi chú từ {isDriver ? 'chủ xe' : 'khách'}
            </p>
            <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {decodeHtmlEntities(trip.notes)}
            </p>
          </div>
        )}

        {/* ── 6. DÒNG CAM KẾT VĂN MINH CHÂN TRANG ── */}
        <p className="text-[11.5px] text-slate-400 dark:text-slate-500 text-center flex items-center justify-center gap-1 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>
            {isOwner
              ? 'Chuyến đi do bạn đăng. Bạn có thể chỉnh sửa thông tin hoặc chia sẻ bất kỳ lúc nào.'
              : 'Chủ xe và Người đi cùng kết nối trực tiếp trên CarMate để thuận tiện hẹn điểm đón.'}
          </span>
        </p>
      </div>
    </Modal>
  );
}
