import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  MapPin,
  Navigation,
  ArrowLeftRight,
  Search,
  X,
  Package,
  Zap
} from 'lucide-react';
import { computeHotRoutes, DEFAULT_FALLBACK_ROUTES, formatVND } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Chip from '../ui/Chip.jsx';
import { POPULAR_HIGHWAYS } from './FilterBar.jsx';
import LocationSuggestInput from '../ui/LocationSuggestInput.jsx';
import { getContextualGhostRoute } from '../../utils/personaMemory.js';

export default function Hero({
  trips = [],
  searchKeyword = '',
  setSearchKeyword,
  searchFrom = '',
  setSearchFrom,
  searchTo = '',
  setSearchTo,
  onPostClick,
  currentUser,
  onShowToast
}) {
  const { t, lang } = useI18n();

  const handleSwap = () => {
    if (setSearchFrom && setSearchTo) {
      const temp = searchFrom;
      setSearchFrom(searchTo);
      setSearchTo(temp);
    }
  };

  const handleClearAll = () => {
    setSearchKeyword?.('');
    setSearchFrom?.('');
    setSearchTo?.('');
  };

  const isParcelActive = searchKeyword.toLowerCase().includes('gửi hàng');

  const handleToggleParcel = () => {
    if (isParcelActive) {
      setSearchKeyword?.('');
    } else {
      setSearchKeyword?.('gửi hàng');
    }
  };

  const hasSearch = Boolean(searchKeyword || searchFrom || searchTo);

  // Tuyến xoay vòng động theo dữ liệu chuyến xe thực tế đang mở
  const rotatingRoutes = useMemo(() => {
    return computeHotRoutes(trips);
  }, [trips]);

  // Hiệu ứng gợi ý cặp tuyến HOT xoay vòng tự động mỗi 3.2s
  const [routeCycleIndex, setRouteCycleIndex] = useState(0);

  useEffect(() => {
    if (rotatingRoutes.length <= 1) return;
    const timer = setInterval(() => {
      setRouteCycleIndex((prev) => (prev + 1) % rotatingRoutes.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [rotatingRoutes.length]);

  // Lộ trình ma (Ghost Route) tính toán cục bộ theo thói quen & thời gian thực
  const ghostRoute = useMemo(() => {
    return getContextualGhostRoute('passenger');
  }, []);

  const activeRouteHint = rotatingRoutes[routeCycleIndex % rotatingRoutes.length] || DEFAULT_FALLBACK_ROUTES[0];

  const handleApplyGhostRoute = useCallback((route) => {
    if (!route) return;
    setSearchFrom?.(route.from);
    setSearchTo?.(route.to);
    onShowToast?.(`⚡ Đã điền nhanh lộ trình: ${route.from} ➔ ${route.to}`);
    const el = document.getElementById('market-results');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, [setSearchFrom, setSearchTo, onShowToast]);

  // Phím tắt bàn phím: Tab (Điền lộ trình gợi ý khi không nhập liệu)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Phím Tab vật lý áp dụng lộ trình gợi ý khi không focus vào ô nhập liệu
      if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        const isInput =
          activeTag === 'input' ||
          activeTag === 'textarea' ||
          activeTag === 'select' ||
          document.activeElement?.isContentEditable;
        const target = ghostRoute?.isPersonalHistory ? ghostRoute : activeRouteHint;
        if (!isInput && target?.from && target?.to) {
          e.preventDefault();
          handleApplyGhostRoute(target);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ghostRoute, activeRouteHint, handleApplyGhostRoute]);

  return (
    <section className="relative z-20 border-b border-slate-200/80 dark:border-slate-800 hero-canvas overflow-hidden">
      {/* ── BẢN NỀN CHUYẾN ĐI GIA ĐÌNH ẨN RA PHÍA SAU (AMBIENT BACKDROP) ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {/* Hình chuyến xe gia đình ấm áp ẩn nhẹ nhàng, sâu phía sau, triệt tiêu mọi chi tiết gây rối mắt */}
        <div className="absolute inset-0 w-full h-full opacity-[0.07] sm:opacity-[0.09] lg:opacity-[0.12] dark:opacity-[0.04] transition-opacity">
          <img
            src="/images/hero_family_ride.jpg"
            alt=""
            className="w-full h-full object-cover object-[center_35%] filter blur-[1.5px]"
          />
          {/* Lớp gradient che phủ trung tâm Apple HIG: Đảm bảo vùng chữ và ô tìm kiếm luôn có nền trắng tinh khiết, tương phản tuyệt đối */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#ffffff_45%,_rgba(255,255,255,0.85)_75%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_at_center,_#0b0f19_45%,_rgba(11,15,25,0.85)_75%,_transparent_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/80 to-[#f8fafc] dark:from-[#0b0f19] dark:via-[#0b0f19]/80 dark:to-[#0b0f19]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#f8fafc]/95 via-transparent to-[#f8fafc] dark:from-[#0b0f19]/95 dark:via-transparent dark:to-[#0b0f19]" />
        </div>

        {/* Ambient subtle glow (Soft, zero-glare, eye-care) */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[380px] rounded-full bg-primary-500/10 blur-[140px]" />
        <div className="absolute top-1/2 -left-20 w-[300px] h-[300px] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative max-w-[1120px] mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-10 text-center space-y-2.5 sm:space-y-3.5">
        {/* Title */}
        <h1 className="font-display text-xl sm:text-3xl lg:text-[42px] lg:leading-[1.15] font-black text-[#1d1d1f] tracking-tight max-w-3xl mx-auto leading-tight">
          {t('hero.title')}
        </h1>

        {t('hero.subtitle') ? (
          <p className="text-[13.5px] sm:text-[15px] text-[#515154] dark:text-slate-400 font-medium max-w-xl mx-auto tracking-tight">
            {t('hero.subtitle')}
          </p>
        ) : null}

        {/* Dynamic Route Suggester Capsule (DUY NHẤT 1 Capsule thông minh, đồng bộ màu sắc Apple Liquid, triệt tiêu màu đen) */}
        <div className="pt-0.5 sm:pt-1 flex items-center justify-center px-2 max-w-full">
          {ghostRoute?.isPersonalHistory ? (
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 border border-black/[0.08] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-md transition-all text-xs max-w-full overflow-hidden">
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                <Zap className="w-3 h-3 fill-current text-amber-500 animate-pulse" />
                <span className="hidden xs:inline">Tuyến quen:</span>
                <span className="xs:hidden">Quen:</span>
              </span>
              <div className="flex items-center gap-1 sm:gap-1.5 text-[11.5px] sm:text-[12px] font-bold text-[#0071e3] dark:text-[#2997ff] min-w-0 shrink">
                <span className="max-w-[110px] sm:max-w-none truncate">{ghostRoute.from}</span>
                <ArrowLeftRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 shrink-0" />
                <span className="max-w-[110px] sm:max-w-none truncate">{ghostRoute.to}</span>
              </div>
              <button
                type="button"
                onClick={() => handleApplyGhostRoute(ghostRoute)}
                title="Nhấn phím Tab trên bàn phím hoặc bấm vào đây để điền ngay"
                className="ml-0.5 sm:ml-1 text-[10.5px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2 sm:px-2.5 py-0.5 rounded-full cursor-pointer transition-all active:scale-95 flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <kbd className="hidden sm:inline-block px-1 py-0.1 rounded bg-black/5 dark:bg-white/10 text-[9px] font-mono text-emerald-800 dark:text-emerald-200">Tab</kbd>
                <span>Tự điền ⚡</span>
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 border border-black/[0.08] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-md transition-all text-xs max-w-full overflow-hidden">
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#1d1d1f] dark:text-white shrink-0">
                <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                <span className="hidden xs:inline">Tuyến HOT:</span>
                <span className="xs:hidden">HOT:</span>
              </span>
              <div
                key={`${routeCycleIndex}-${activeRouteHint.from}-${activeRouteHint.to}`}
                className="anim-fade-in flex items-center gap-1 sm:gap-1.5 text-[11.5px] sm:text-[12px] font-bold text-[#0071e3] dark:text-[#2997ff] min-w-0 shrink"
              >
                <span className="max-w-[110px] sm:max-w-none truncate">{activeRouteHint.from}</span>
                <ArrowLeftRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 shrink-0" />
                <span className="max-w-[110px] sm:max-w-none truncate">{activeRouteHint.to}</span>
                {activeRouteHint.count > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                    {activeRouteHint.count} xe
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchFrom?.(activeRouteHint.from);
                  setSearchTo?.(activeRouteHint.to);
                  const el = document.getElementById('market-results');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                title="Điền nhanh cặp tuyến này"
                className="ml-0.5 sm:ml-1 text-[10.5px] sm:text-[11px] font-bold text-[#0071e3] hover:text-[#0077ed] dark:text-[#2997ff] bg-[#0071e3]/10 hover:bg-[#0071e3]/20 px-2 sm:px-2.5 py-0.5 rounded-full cursor-pointer transition-all active:scale-95 flex items-center gap-0.5 shrink-0 whitespace-nowrap"
              >
                <span>Áp dụng ⚡</span>
              </button>
            </div>
          )}
        </div>

        {/* ── APPLE / CURSOR COMMAND OMNIBAR ── */}
        <div className="pt-1 max-w-4xl mx-auto w-full relative z-40">
          <div className="p-2 sm:p-2.5 rounded-2xl bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_32px_rgba(0,113,227,0.14)] focus-within:ring-2 focus-within:ring-[#0071e3]/30 focus-within:border-[#0071e3] transition-all text-left relative z-40">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-1.5">
              {/* Điểm xuất phát */}
              <div className="relative flex-1 flex items-center min-w-0 px-3 sm:px-3.5 py-1.5 sm:py-1.5 rounded-xl bg-[#f5f5f7] border border-black/[0.04] hover:bg-[#ebebee] focus-within:bg-white focus-within:border-[#0071e3]/60 transition-colors focus-within:z-50">
                <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shrink-0 mr-2 sm:mr-2.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 leading-none mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Nơi đi</span>
                  </div>
                  <LocationSuggestInput
                    id="search-from-input"
                    variant="omnibar"
                    value={searchFrom}
                    onChange={setSearchFrom}
                    placeholder={`Đi từ đâu? (VD: ${activeRouteHint.from})`}
                  />
                </div>
                {searchFrom && (
                  <button
                    type="button"
                    onClick={() => setSearchFrom?.('')}
                    className="p-1 text-[#86868b] hover:text-[#1d1d1f] cursor-pointer rounded-full"
                    aria-label="Xoá điểm đón"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Nút đảo chiều ⇄ với tactile micro-scale */}
              <button
                type="button"
                onClick={handleSwap}
                title="Đổi chiều điểm đi / điểm đến"
                aria-label="Đổi chiều điểm đi / điểm đến"
                className="self-center w-7 h-7 sm:w-8 sm:h-8 -my-1 sm:my-0 rounded-full border border-black/[0.08] bg-white text-[#515154] hover:text-[#0071e3] hover:border-[#0071e3]/40 inline-flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-90 active:rotate-180 transition-all z-10"
              >
                <ArrowLeftRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>

              {/* Điểm đến */}
              <div className="relative flex-1 flex items-center min-w-0 px-3 sm:px-3.5 py-1.5 sm:py-1.5 rounded-xl bg-[#f5f5f7] border border-black/[0.04] hover:bg-[#ebebee] focus-within:bg-white focus-within:border-[#0071e3]/60 transition-colors focus-within:z-50">
                <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-lg bg-rose-50 border border-rose-200/60 flex items-center justify-center shrink-0 mr-2 sm:mr-2.5">
                  <Navigation className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 leading-none mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Nơi đến</span>
                  </div>
                  <LocationSuggestInput
                    id="search-to-input"
                    variant="omnibar"
                    value={searchTo}
                    onChange={setSearchTo}
                    placeholder={`Đến đâu? (VD: ${activeRouteHint.to})`}
                  />
                </div>
                {searchTo && (
                  <button
                    type="button"
                    onClick={() => setSearchTo?.('')}
                    className="p-1 text-[#86868b] hover:text-[#1d1d1f] cursor-pointer rounded-full"
                    aria-label="Xoá điểm đến"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons: TÌM CHUYẾN (Apple Blue Primary CTA với Shimmer Animation) */}
              <div className="flex items-center gap-1.5 shrink-0 pt-0.5 sm:pt-0">
                {hasSearch && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    title="Xoá tìm kiếm"
                    className="h-9 sm:h-10 px-2.5 text-xs text-[#515154] hover:text-[#1d1d1f] font-medium cursor-pointer"
                  >
                    Xoá lọc
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('market-results');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="relative overflow-hidden h-10 sm:h-11 w-full sm:w-auto px-5 sm:px-6 rounded-xl font-bold text-sm bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] text-white shadow-[0_4px_16px_rgba(0,113,227,0.35)] hover:shadow-[0_8px_24px_rgba(0,113,227,0.5)] whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group"
                >
                  {/* Tia sáng ngọc trai quét qua mặt nút định kỳ (Hiệu ứng 2: Shimmer Sweep) */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full bg-[linear-gradient(110deg,transparent_20%,rgba(255,255,255,0.45)_50%,transparent_80%)] animate-shimmer-sweep pointer-events-none"
                  />
                  <Search
                    className="w-4 h-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12 relative z-10"
                    strokeWidth={2.4}
                  />
                  <span className="relative z-10 tracking-tight">{t('hero.findTripCta') || 'Tìm chuyến ngay'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── HIGHWAY ROUTE PILLS & SEPARATE PARCEL AMENITY FILTER ── */}
          <div className="pt-2 max-w-4xl mx-auto w-full relative z-20">
            <div className="flex items-center justify-start md:justify-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 px-3 sm:px-1">
              {/* Route Pills (Non-wrapping single horizontal rail, tinh giản chuẩn Apple) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {POPULAR_HIGHWAYS.map((hw) => {
                  const isSelected =
                    hw.id === 'all'
                      ? !searchKeyword && !searchFrom && !searchTo
                      : searchKeyword.toLowerCase().includes(hw.id.toLowerCase()) ||
                        searchFrom.toLowerCase().includes(hw.id.toLowerCase());
                  const label =
                    hw.id === 'all' ? (t('market.allRoutes') || 'Tất cả') : lang === 'en' && hw.labelEn ? hw.labelEn : hw.label;
                  return (
                    <Chip
                      key={hw.id}
                      active={isSelected}
                      onClick={() => {
                        if (hw.id === 'all') {
                          handleClearAll();
                        } else {
                          setSearchKeyword?.(hw.id);
                        }
                      }}
                      className="h-7.5 px-3 text-xs font-medium cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      {label}
                    </Chip>
                  );
                })}
              </div>

              {/* Subtle divider */}
              <span className="h-4 w-px bg-black/[0.1] dark:bg-white/[0.1] shrink-0 mx-1" aria-hidden="true" />

              {/* Tách riêng nút "Gửi đồ kèm xe" thành bộ lọc tinh tế, không tranh chấp màu với nút Tìm chuyến */}
              <button
                type="button"
                onClick={handleToggleParcel}
                title="Lọc các chuyến có nhận gửi hàng hoá, bưu phẩm kèm xe"
                aria-pressed={isParcelActive}
                className={`inline-flex items-center gap-1.5 h-7.5 px-3 rounded-full text-xs font-medium whitespace-nowrap select-none cursor-pointer transition-all duration-150 shrink-0 shadow-xs touch-manipulation active:scale-[0.98] outline-none ${
                  isParcelActive
                    ? 'bg-amber-500/12 text-amber-900 border border-amber-400/50 font-semibold ring-1 ring-amber-400/20'
                    : 'bg-white text-[#515154] border border-black/[0.08] hover:bg-[#f5f5f7] hover:border-black/[0.16] hover:text-[#1d1d1f]'
                }`}
              >
                <Package
                  className={`w-3.5 h-3.5 ${isParcelActive ? 'text-amber-600' : 'text-[#86868b]'}`}
                  strokeWidth={2}
                />
                <span>Gửi đồ kèm xe</span>
                {isParcelActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
