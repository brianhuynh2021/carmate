import React from 'react';
import { MapPin, Share2 } from 'lucide-react';
import {
  getRouteCorridor,
  formatVND,
  getZaloChatUrl,
  isGoogleMapsUrl,
  decodeHtmlEntities,
  formatTripDateDisplay,
  getTimeSlotLabel
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';

export default function RouteDetailModal({ trip, isOwner = false, onClose, onBook, onShare }) {
  const { lang } = useI18n();
  const corridor = trip ? getRouteCorridor(trip.routeCategory) : null;
  const isDriver = trip?.type === 'driver_offer';
  const price = trip ? trip.basePricePerSeat || trip.expectedPrice || trip.suggestedContribution || 180000 : 0;
  const tripFrom = decodeHtmlEntities(trip?.from);
  const tripTo = decodeHtmlEntities(trip?.to);
  const waypointNote = decodeHtmlEntities(trip?.waypointNote);

  // Mọi hook đã được gọi ở trên — an toàn để early return tại đây
  if (!trip) return null;

  // Tin nhắn mở đầu khi đã ghép chuyến và có số Zalo
  const zaloProposalMsg = `Chào bạn, tôi vừa ghép chuyến ${tripFrom} ➔ ${tripTo} trên CarMate. Mình trao đổi chốt điểm đón nhé!`;
  // Số điện thoại chỉ được cấp SAU khi ghép chuyến thành công (qua booking),
  // nên ở màn xem trước này thường không có. Khi đó nút Zalo phải dẫn người dùng
  // vào luồng ghép chuyến thay vì trỏ tới link chết.
  const zaloUrl = getZaloChatUrl(trip.phoneReal || trip.contactPhone, zaloProposalMsg);

  return (
    <Modal
      onClose={onClose}
      size="lg"
      icon={MapPin}
      title={`${tripFrom} → ${tripTo}`}
      subtitle={corridor ? `Hành lang ${corridor.name}` : waypointNote || 'Lộ trình di chuyển trực tiếp'}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-xl font-bold text-[#1d1d1f] dark:text-white tracking-tight leading-none">
              {formatVND(price)}
            </span>
            <span className="text-xs text-[#86868b] dark:text-slate-400">/người</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Chia sẻ chuyến đi */}
            {onShare && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onShare(trip);
                }}
                title="Chia sẻ chuyến đi qua Zalo / Facebook"
                className="h-10 px-3.5 rounded-xl font-semibold text-xs text-[#0071e3] dark:text-blue-400 bg-[#0071e3]/10 hover:bg-[#0071e3]/20 border border-[#0071e3]/25 shadow-xs inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] shrink-0"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>Chia sẻ</span>
              </button>
            )}

            {zaloUrl ? (
              <a
                href={zaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Nhắn tin trao đổi qua Zalo"
                className="h-10 px-3.5 rounded-xl font-medium text-xs text-[#0068ff] bg-[#0068ff]/10 hover:bg-[#0068ff]/15 border border-[#0068ff]/20 inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
              >
                <ZaloIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Nhắn Zalo</span>
              </a>
            ) : null}

            {isOwner ? (
              <span className="h-10 px-4 rounded-xl font-bold text-xs inline-flex items-center text-amber-800 bg-amber-50 border border-amber-200 shrink-0">
                Chuyến của bạn
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBook(trip);
                }}
                className="h-10 px-5 rounded-xl font-semibold text-xs text-white bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] shadow-sm shadow-[#0071e3]/20 transition-all cursor-pointer active:scale-[0.98] shrink-0"
              >
                {isDriver ? 'Ghép chuyến này' : 'Đón khách này'}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
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
              {(corridor?.startLandmark?.address || waypointNote) && (
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {corridor?.startLandmark?.address || waypointNote}
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
              {corridor?.endLandmark?.address && (
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {corridor.endLandmark.address}
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
          Điểm đón chính xác do hai bên tự thỏa thuận qua Zalo sau khi ghép chuyến.
        </p>
      </div>
    </Modal>
  );
}
