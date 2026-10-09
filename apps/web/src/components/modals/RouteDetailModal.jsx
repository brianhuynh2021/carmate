import React from 'react';
import {
  MapPin,
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
  onViewCarPhotos
}) {
  const { t } = useI18n();
  const { lang } = useI18n();
  const corridor = trip ? getRouteCorridor(trip.routeCategory) : null;
  const isDriver = trip?.type === 'driver_offer';
  const price = trip ? trip.basePricePerSeat || trip.expectedPrice || trip.suggestedContribution || 180000 : 0;
  const tripFrom = decodeHtmlEntities(trip?.from);
  const tripTo = decodeHtmlEntities(trip?.to);
  const waypointNote = decodeHtmlEntities(trip?.waypointNote);

  // All hooks have been called above — safe to early return here
  if (!trip) return null;

  // Online status of the poster (Live Presence Telemetry: green light / red light)
  const onlineStatus = getUserOnlineStatus({ ...trip, isOwner });

  // Detect the actual direction of travel (Sài Gòn ➔ Province vs Province ➔ Sài Gòn)
  // to reverse the landmark and stop order with 100% accuracy
  const isReverse =
    trip.direction === 'sg_to_province' ||
    (/sài gòn|tp\.?\s*hcm|hồ chí minh/i.test(tripFrom) && !/sài gòn|tp\.?\s*hcm|hồ chí minh/i.test(tripTo));

  const defaultStart = isReverse ? corridor?.endLandmark : corridor?.startLandmark;
  const defaultEnd = isReverse ? corridor?.startLandmark : corridor?.endLandmark;

  // Normalized pickup point & drop-off point
  const pickupTitle = isGoogleMapsUrl(tripFrom) ? 'Vị trí ghim trên Google Maps' : tripFrom || defaultStart?.name;
  const pickupAddress = trip?.pickupSpot || defaultStart?.address || (isReverse ? '' : waypointNote);

  const dropoffTitle = isGoogleMapsUrl(tripTo) ? 'Vị trí ghim trên Google Maps' : tripTo || defaultEnd?.name;
  const dropoffAddress = trip?.dropoffSpot || defaultEnd?.address || (isReverse ? waypointNote : '');

  // Stops along the route in the actual direction of travel
  const rawWaypoints = corridor?.waypoints || [];
  const orderedWaypoints = isReverse ? rawWaypoints.slice().reverse() : rawWaypoints;
  const transitWaypoints = orderedWaypoints.length > 2 ? orderedWaypoints.slice(1, -1) : orderedWaypoints;

  // Tidy, ergonomically sound schedule
  const dateLabel = formatCleanDateLabel(trip.date);
  const rawTime = getTimeSlotLabel(trip, lang) || '';
  const timeLabel = (rawTime.match(/^([^()]+)\s*\(/)?.[1] || rawTime).trim() || 'Linh hoạt';

  // Seat demand (Stanford Ergonomics: "Nhận ghép X ghế" (accepts X seats) / "Cần ghép X ghế" (needs X seats))
  const seatsCount = isDriver ? Number(trip.availableSeats) || 0 : Number(trip.seatsNeeded) || 1;
  const isTripFull = trip.status === 'full' || Boolean(trip.isFull) || (isDriver && seatsCount === 0);
  const seatsLabel = isTripFull
    ? (isDriver ? 'Đã kín chỗ' : 'Đã có xe')
    : isDriver
      ? `Nhận ghép ${seatsCount} ghế`
      : `Cần ghép ${seatsCount} ghế`;

  // Vehicle: normalize the display of the vehicle model and seat count
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

  // Ratings & reputation
  const rawRating = Number(trip.rating);
  const ratingValue = Number.isFinite(rawRating) && rawRating > 0 ? Math.round(rawRating * 10) / 10 : 5.0;
  const rating = ratingValue % 1 === 0 ? `${ratingValue}.0` : String(ratingValue);
  const completedTrips = Number(trip.completedCount) || 0;

  // Real vehicle photos
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
              <span className="type-title text-[#1d1d1f] dark:text-white">
                {formatVND(price)}
              </span>
              <span className="text-[#86868b] dark:text-slate-400">{t('routeDetail.s001')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">

            {isOwner ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onManage) onManage(trip);
                  else if (onBook) onBook(trip);
                }}
                className="type-button h-10 px-4.5 rounded-xl text-amber-900 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 border border-amber-300 shadow-xs inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] w-full sm:w-auto shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-800" />
                <span>{t('routeDetail.s003')}</span>
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
                className={`type-button h-10 px-5 rounded-xl transition-all cursor-pointer active:scale-[0.98] w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 ${
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
        {/* ── 1. PARTNER INFO (APPLE LIQUID CARD + LIVE PRESENCE + RATING) ── */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-white/80 dark:bg-white/[0.04] backdrop-blur-md border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 ring-1 ring-black/5 dark:ring-white/10 shadow-2xs">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="type-caption text-[#1d1d1f] dark:text-white truncate">
                  {toPublicAlias(trip)}
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" title={t('routeDetail.s011')} />
                <span className="type-caption text-[#86868b] font-mono">#{trip.maskedCode || trip.id?.slice(-4)}</span>
              </div>
              <div className="type-caption flex items-center gap-2 text-[#86868b] dark:text-slate-400 truncate mt-0.5">
                <span className="type-body-strong inline-flex items-center gap-0.5 text-slate-700 dark:text-slate-300">
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

        {/* ── 2. BENTO GLANCE BAR: SCHEDULE · RIDE REQUEST · VEHICLE ── */}
        <div className="grid grid-cols-3 gap-2">
          {/* Departure schedule */}
          <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06] flex flex-col items-center text-center justify-center min-w-0">
            <div className="type-caption flex items-center gap-1 text-slate-400 dark:text-slate-500 uppercase">
              <Calendar className="w-3 h-3 text-[#0071e3]" />
              <span>{t('routeDetail.s004')}</span>
            </div>
            <span className="type-caption text-slate-900 dark:text-white mt-1 truncate max-w-full">
              {timeLabel}
            </span>
            <span className="type-caption text-slate-500 dark:text-slate-400 truncate max-w-full">
              {dateLabel}
            </span>
          </div>

          {/* Seat demand */}
          <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06] flex flex-col items-center text-center justify-center min-w-0">
            <div className="type-caption flex items-center gap-1 text-slate-400 dark:text-slate-500 uppercase">
              <Users className="w-3 h-3 text-emerald-500" />
              <span>{t('routeDetail.s005')}</span>
            </div>
            <span className={`type-caption  mt-1 truncate max-w-full ${isTripFull ? 'text-slate-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {seatsLabel}
            </span>
            <span className="type-caption text-slate-500 dark:text-slate-400 truncate max-w-full">
              {isDriver ? 'Chỗ trống trên xe' : 'Số ghế cần đi'}
            </span>
          </div>

          {/* Vehicle */}
          <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06] flex flex-col items-center text-center justify-center min-w-0">
            <div className="type-caption flex items-center gap-1 text-slate-400 dark:text-slate-500 uppercase">
              <Car className="w-3 h-3 text-indigo-500" />
              <span>{isDriver ? 'Phương tiện' : 'Nhu cầu xe'}</span>
            </div>
            <span className="type-caption text-slate-900 dark:text-white mt-1 truncate max-w-full" title={carDisplay}>
              {isDriver ? carDisplay : `${cap} chỗ`}
            </span>
            <span className="type-caption text-slate-500 dark:text-slate-400 truncate max-w-full">
              {isDriver ? carSub : 'Tìm xe đi cùng'}
            </span>
          </div>
        </div>

        {/* ── 3. APPLE TRANSIT METRO ROUTE AXIS: PICKUP ➔ STOPS ALONG THE ROUTE ➔ DROP-OFF ── */}
        <div className="rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] p-4 relative overflow-hidden">
          {/* Pickup point */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center mt-1 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              <span className="w-0.5 h-10 sm:h-12 bg-gradient-to-b from-emerald-500 via-sky-400 to-rose-500 my-1" />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className="type-caption text-emerald-600 dark:text-emerald-400 uppercase">
                {t('routeDetail.s006')}
              </p>
              <p className="type-body-strong text-slate-900 dark:text-white mt-0.5">
                {pickupTitle}
              </p>
              {pickupAddress && (
                <p className="type-caption text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {pickupAddress}
                </p>
              )}
            </div>
          </div>

          {/* Drop-off point */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center mt-1 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/20" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="type-caption text-rose-500 uppercase">
                {t('routeDetail.s007')}
              </p>
              <p className="type-body-strong text-slate-900 dark:text-white mt-0.5">
                {dropoffTitle}
              </p>
              {dropoffAddress && (
                <p className="type-caption text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {dropoffAddress}
                </p>
              )}
            </div>
          </div>

          {/* Pickup/drop-off stations along the route */}
          {transitWaypoints.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="type-caption text-slate-400 dark:text-slate-500 uppercase">
                  {isDriver
                    ? `Xe đi ngang qua (${transitWaypoints.length} trạm đón trả dọc tuyến)`
                    : `Lộ trình mong muốn (${transitWaypoints.length} trạm đón trả dọc tuyến)`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {transitWaypoints.map((wp, idx) => (
                  <React.Fragment key={wp.name || idx}>
                    <span className="type-caption inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200/70 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 shadow-2xs whitespace-nowrap shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                      <span>{wp.name}</span>
                    </span>
                    {idx < transitWaypoints.length - 1 && (
                      <span className="type-caption text-slate-300 dark:text-slate-600 shrink-0 select-none">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 4. PREVIEW OF ACTUAL VEHICLE PHOTOS (IF THE DRIVER HAS UPLOADED PHOTOS) ── */}
        {photos.length > 0 && (
          <div className="p-3 rounded-2xl bg-white/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="type-caption flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                <Camera className="w-3.5 h-3.5 text-[#0071e3]" />
                <span>Hình ảnh xe thực tế ({photos.length} góc ảnh)</span>
              </div>
              {onViewCarPhotos && (
                <button
                  type="button"
                  onClick={() => onViewCarPhotos(trip)}
                  className="type-button text-[#0071e3] hover:underline cursor-pointer"
                >
                  {t('routeDetail.s008')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photos.slice(0, 3).map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onViewCarPhotos?.(trip)}
                  className="type-button aspect-4/3 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 relative group cursor-pointer ring-1 ring-black/5 dark:ring-white/10"
                >
                  <img
                    src={normalizePhotoUrl(p)}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  {idx === 2 && photos.length > 3 && (
                    <div className="type-caption absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                      +{photos.length - 3}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 5. CARGO AMENITIES & NOTES ── */}
        {trip.acceptsParcel && (
          <div className="type-caption inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/[0.06]">
            <Package className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>{t('routeDetail.s009')}</span>
          </div>
        )}

        {trip.notes && (
          <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30">
            <p className="type-caption text-amber-700 dark:text-amber-400 uppercase mb-1">
              💡 Ghi chú từ {isDriver ? 'chủ xe' : 'khách'}
            </p>
            <p className="type-caption text-slate-700 dark:text-slate-300 whitespace-pre-line">
              {decodeHtmlEntities(trip.notes)}
            </p>
          </div>
        )}

        {/* ── 6. FOOTER COURTEOUS-CONDUCT PLEDGE LINE ── */}
        <p className="type-caption text-slate-400 dark:text-slate-500 text-center flex items-center justify-center gap-1 pt-1">
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
