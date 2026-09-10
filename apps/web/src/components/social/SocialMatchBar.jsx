import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  Zap,
  MapPin,
  Navigation,
  Clock,
  Car,
  Users,
  ShieldCheck,
  TrendingDown
} from 'lucide-react';
import { getTimeSlotLabel } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';

const DISMISSED_MATCHES_KEY = 'carmate_dismissed_matches';

export default function SocialMatchBar({
  suggestions = [],
  onSelectTrip,
  onConnectMatch,
  className = ''
}) {
  const { lang } = useI18n();
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Lưu danh sách ID đã bỏ qua (Zero-friction dismissal)
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(DISMISSED_MATCHES_KEY) || '[]');
    } catch {
      return [];
    }
  });

  // Lọc các gợi ý chưa bị người dùng bấm bỏ qua
  const activeSuggestions = useMemo(() => {
    return (suggestions || []).filter(
      (item) => item?.trip?.id && !dismissedIds.includes(item.trip.id)
    );
  }, [suggestions, dismissedIds]);

  const updateScrollButtons = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    updateScrollButtons();
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollButtons, { passive: true });
      window.addEventListener('resize', updateScrollButtons);
    }
    return () => {
      if (el) el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [activeSuggestions]);

  const handleScroll = (direction) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = direction === 'left' ? -320 : 320;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const handleDismiss = (e, tripId) => {
    e.stopPropagation();
    const updated = [...dismissedIds, tripId];
    setDismissedIds(updated);
    try {
      localStorage.setItem(DISMISSED_MATCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  // Không hiển thị thanh này nếu không có gợi ý phù hợp hoặc người dùng đã bỏ qua hết
  if (!activeSuggestions || activeSuggestions.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Gợi ý ghép xe tức thì"
      className={`relative rounded-3xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-sky-50/60 dark:from-slate-900/90 dark:via-indigo-950/20 dark:to-slate-900/90 border border-blue-200/60 dark:border-blue-500/20 p-4 sm:p-5 backdrop-blur-md shadow-sm transition-all ${className}`}
    >
      {/* Header thanh gợi ý */}
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-[#0071e3] to-sky-400 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Gợi ý ghép xe phù hợp nhất
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-[#0071e3]/10 text-[#0071e3] dark:text-sky-400 border border-[#0071e3]/20">
                {activeSuggestions.length} kết quả
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Hệ thống tự động tìm kiếm đối tác cùng lộ trình &amp; tiết kiệm chi phí xăng dầu
            </p>
          </div>
        </div>

        {/* Nút lướt sang trái / phải trên desktop */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            disabled={!canScrollLeft}
            aria-label="Xem gợi ý trước"
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
              canScrollLeft
                ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 shadow-xs'
                : 'opacity-30 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40 text-slate-400 border-transparent'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll('right')}
            disabled={!canScrollRight}
            aria-label="Xem gợi ý tiếp theo"
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
              canScrollRight
                ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 shadow-xs'
                : 'opacity-30 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40 text-slate-400 border-transparent'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Danh sách thẻ gợi ý ghép xe tiện chuyến CarMate Smart Match */}
      <div
        ref={scrollContainerRef}
        className="flex gap-3.5 overflow-x-auto pb-1 pt-0.5 scroll-smooth no-scrollbar snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {activeSuggestions.map((item) => {
          const { trip, score, reason, fuelSavings, tags } = item;
          const isDriver = trip.type === 'driver_offer';
          const partnerAlias = trip.partnerAlias || (isDriver ? `Chủ xe #${trip.id?.slice(0, 4)}` : `Người đi cùng #${trip.id?.slice(0, 4)}`);
          const trustScore = trip.trustScore || 95;

          return (
            <div
              key={trip.id}
              onClick={() => (onConnectMatch ? onConnectMatch(trip) : onSelectTrip?.(trip))}
              className="snap-start shrink-0 w-[290px] sm:w-[310px] rounded-2xl bg-white/95 dark:bg-slate-850/95 border border-slate-200/90 dark:border-slate-800/90 p-4 shadow-sm hover:shadow-md hover:border-blue-400/60 dark:hover:border-blue-500/50 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Nút bỏ qua nhanh (Stanford Ergonomics) */}
              <button
                type="button"
                onClick={(e) => handleDismiss(e, trip.id)}
                title="Bỏ qua gợi ý này"
                aria-label="Bỏ qua gợi ý"
                className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors z-10 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Hàng trên: Điểm khớp & Danh xưng chuẩn mực */}
              <div>
                <div className="flex items-center gap-1.5 flex-wrap pr-7 mb-2.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-2xs">
                    🔥 Khớp {score}%
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      isDriver
                        ? 'bg-blue-50 text-[#0071e3] dark:bg-blue-950/40 dark:text-sky-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                    }`}
                  >
                    {isDriver ? <Car className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    <span>{partnerAlias}</span>
                  </span>

                  {trustScore && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="w-3 h-3" />
                      <span>{trustScore}%</span>
                    </span>
                  )}
                </div>

                {/* Lộ trình Điểm đón -> Điểm đến */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
                      {trip.from}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
                      {trip.to}
                    </span>
                  </div>
                </div>

                {/* Thời gian & Số ghế */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{getTimeSlotLabel(trip, lang)}</span>
                  </div>
                  <div>
                    {isDriver ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        Còn {trip.availableSeats || 3} chỗ trống
                      </span>
                    ) : (
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        Cần {trip.seatsNeeded || 1} chỗ
                      </span>
                    )}
                  </div>
                </div>

                {/* Tag tiết kiệm xăng & lý do khớp */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  {fuelSavings?.savingsVndFormatted && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                      <TrendingDown className="w-3 h-3" />
                      <span>{fuelSavings.savingsVndFormatted}</span>
                    </span>
                  )}
                  {reason && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
                      {reason}
                    </span>
                  )}
                </div>
              </div>

              {/* Nút hành động 1-chạm kết nối */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {trip.price ? `${Number(trip.price).toLocaleString('vi-VN')} ₫` : 'Thoả thuận xăng'}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onConnectMatch) onConnectMatch(trip);
                    else onSelectTrip?.(trip);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-xs group-hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                >
                  <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                  <span>1-Chạm Ghép xe</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
