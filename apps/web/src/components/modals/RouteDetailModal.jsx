import React from 'react';
import { MapPin, Share2, SlidersHorizontal, ArrowRight, User } from 'lucide-react';
import {
  getRouteCorridor,
  formatVND,
  isGoogleMapsUrl,
  decodeHtmlEntities,
  formatTripDateDisplay,
  getTimeSlotLabel,
  toPublicAlias,
  getUserOnlineStatus
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import PresenceDot from '../ui/PresenceDot.jsx';

export default function RouteDetailModal({ trip, isOwner = false, onClose, onManage, onBook, onShare }) {
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
              <span className="text-xl font-bold text-[#1d1d1f] dark:text-white tracking-tight leading-none">
                {formatVND(price)}
              </span>
              <span className="text-xs text-[#86868b] dark:text-slate-400">/người</span>
            </div>

            {/* Nút chia sẻ vé trên Mobile */}
            {onShare && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onShare(trip);
                }}
                title="Tạo vé điện tử & chia sẻ chuyến đi"
                className="sm:hidden h-9 px-3 rounded-xl font-semibold text-xs text-[#0071e3] dark:text-blue-400 bg-[#0071e3]/10 hover:bg-[#0071e3]/20 border border-[#0071e3]/25 shadow-xs inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>Chia sẻ vé</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Nút chia sẻ vé trên Desktop */}
            {onShare && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onShare(trip);
                }}
                title="Tạo vé điện tử & chia sẻ chuyến đi"
                className="hidden sm:inline-flex h-10 px-3.5 rounded-xl font-semibold text-xs text-[#0071e3] dark:text-blue-400 bg-[#0071e3]/10 hover:bg-[#0071e3]/20 border border-[#0071e3]/25 shadow-xs items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] shrink-0"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>Chia sẻ vé</span>
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
                onClick={() => {
                  onClose();
                  onBook(trip);
                }}
                className="h-10 px-5 rounded-xl font-semibold text-xs text-white bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] shadow-sm shadow-[#0071e3]/20 transition-all cursor-pointer active:scale-[0.98] w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5"
              >
                <span>{isDriver ? 'Ghép chuyến này' : 'Đón khách này'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* ── THÔNG TIN ĐỐI TÁC & TRẠNG THÁI HIỆN DIỆN (LIVE PRESENCE TELEMETRY: ĐÈN XANH / ĐÈN ĐỎ) ── */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 ring-1 ring-black/5 dark:ring-white/10 relative shadow-2xs">
              <User className="w-4 h-4" />
              <PresenceDot isOnline={onlineStatus.isOnline} size="xs" className="absolute -bottom-0.5 -right-0.5" detail={onlineStatus.detail} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs sm:text-sm text-[#1d1d1f] dark:text-white truncate">
                  {toPublicAlias(trip)}
                </span>
                <span className="text-[11px] text-[#86868b] font-mono">#{trip.maskedCode || trip.id?.slice(-4)}</span>
              </div>
              <p className="text-[11px] text-[#86868b] dark:text-slate-400 truncate mt-0.5">
                {isDriver ? 'Chủ xe gia đình · Tuyến tiện chuyến' : 'Người cần tìm xe đi cùng'}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <PresenceDot isOnline={onlineStatus.isOnline} showLabel detail={onlineStatus.detail} />
          </div>
        </div>

        {/* ── ĐÓN & TRẢ: thông tin quyết định ghép được hay không ── */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          <div className="flex items-start gap-3 p-3.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mt-[7px] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Điểm đón
              </p>
              <p className="text-[15px] font-semibold text-slate-900 dark:text-white mt-0.5">
                {isGoogleMapsUrl(tripFrom) ? 'Vị trí ghim trên Google Maps' : tripFrom || corridor?.startLandmark?.name}
              </p>
              {(trip?.pickupSpot || corridor?.startLandmark?.address || waypointNote) && (
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {trip?.pickupSpot ? `Đón tại: ${trip.pickupSpot}` : (corridor?.startLandmark?.address || waypointNote)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 mt-[7px] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Điểm trả
              </p>
              <p className="text-[15px] font-semibold text-slate-900 dark:text-white mt-0.5">
                {isGoogleMapsUrl(tripTo) ? 'Vị trí ghim trên Google Maps' : tripTo || corridor?.endLandmark?.name}
              </p>
              {(trip?.dropoffSpot || corridor?.endLandmark?.address) && (
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {trip?.dropoffSpot ? `Trả tại: ${trip.dropoffSpot}` : corridor?.endLandmark?.address}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── XE & CHỖ: người ghép cần biết ngay ── */}
        <div className="flex flex-wrap gap-1.5">
          {trip.date && (
            <span className="px-2.5 py-1 rounded-lg text-[12px] font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300">
              {formatTripDateDisplay(trip.date)}
              {getTimeSlotLabel(trip, lang) ? ` · ${getTimeSlotLabel(trip, lang)}` : ''}
            </span>
          )}
          {isDriver && trip.availableSeats > 0 && (
            <span className="px-2.5 py-1 rounded-lg text-[12px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
              Còn {trip.availableSeats} chỗ
            </span>
          )}
          {trip.carType && (
            <span className="px-2.5 py-1 rounded-lg text-[12px] font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300">
              {trip.carType}
            </span>
          )}
          {trip.acceptsParcel && (
            <span className="px-2.5 py-1 rounded-lg text-[12px] font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300">
              Nhận gửi đồ
            </span>
          )}
        </div>

        {/* ── TRẠM DỌC TUYẾN: xe đi ngang đâu thì khách tự biết có tiện không ── */}
        {corridor?.waypoints && corridor.waypoints.length > 2 && (
          <div>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Xe đi ngang qua
            </p>
            <div className="flex flex-wrap gap-1.5">
              {corridor.waypoints.slice(1, -1).map((wp) => (
                <span
                  key={wp.name}
                  className="px-2.5 py-1 rounded-lg text-[12px] bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                >
                  {wp.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── GHI CHÚ CHỦ XE: thường là điều kiện ghép thật sự ── */}
        {trip.notes && (
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
              Ghi chú từ {isDriver ? 'chủ xe' : 'khách'}
            </p>
            <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {decodeHtmlEntities(trip.notes)}
            </p>
          </div>
        )}

        <p className="text-[12px] text-slate-400 dark:text-slate-500 text-center pt-1">
          {isOwner
            ? 'Chuyến đi do bạn đăng. Bạn có thể chỉnh sửa thông tin hoặc xuất vé điện tử bất kỳ lúc nào.'
            : 'Chủ xe và Người đi cùng kết nối trực tiếp trên CarMate để thuận tiện hẹn điểm đón.'}
        </p>
      </div>
    </Modal>
  );
}
