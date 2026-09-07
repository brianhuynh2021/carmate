import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  BadgePercent,
  MessageCircle,
  Sparkles,
  MapPin,
  Navigation,
  ArrowLeftRight,
  Search,
  Car,
  Zap,
  X,
  Package,
  ArrowRight
} from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import Chip from '../ui/Chip.jsx';
import Button from '../ui/Button.jsx';
import { POPULAR_HIGHWAYS } from './FilterBar.jsx';
import LocationSuggestInput from '../ui/LocationSuggestInput.jsx';

const POPULAR_ROTATING_ROUTES = [
  { from: 'Lộc Ninh (Bình Phước)', to: 'Sài Gòn (BX Miền Đông)' },
  { from: 'Sài Gòn', to: 'Phan Thiết (Mũi Né)' },
  { from: 'Sài Gòn', to: 'Vũng Tàu' },
  { from: 'Hà Nội', to: 'Hải Phòng' },
  { from: 'Sài Gòn', to: 'Đà Lạt' },
  { from: 'Bù Đốp', to: 'TP. Hồ Chí Minh' }
];

export default function Hero({
  searchKeyword = '',
  setSearchKeyword,
  searchFrom = '',
  setSearchFrom,
  searchTo = '',
  setSearchTo,
  onPostClick
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

  // Hiệu ứng gợi ý cặp tuyến HOT xoay vòng tự động mỗi 3.2s
  const [routeCycleIndex, setRouteCycleIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setRouteCycleIndex((prev) => (prev + 1) % POPULAR_ROTATING_ROUTES.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const activeRouteHint = POPULAR_ROTATING_ROUTES[routeCycleIndex];

  const pills = [
    { icon: BadgePercent, label: '100% không thu phí sàn' },
    { icon: Zap, label: 'Xe gia đình & Tiện chuyến' },
    { icon: MessageCircle, label: 'Zalo 1 chạm kết nối' },
    { icon: ShieldCheck, label: 'Xác minh SĐT thật' }
  ];

  return (
    <section className="relative z-20 border-b border-slate-200/80 hero-canvas">
      {/* Background ambient subtle glow (Soft, zero-glare, eye-care) - clip blurs safely */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[380px] rounded-full bg-primary-500/10 blur-[140px]" />
        <div className="absolute top-1/2 -left-20 w-[300px] h-[300px] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 text-center space-y-4">
        {/* Eyebrow badge with live pulse Apple status dot */}
        <div className="inline-flex items-center gap-2 h-7 pl-3 pr-3.5 rounded-full bg-white border border-black/[0.08] text-[12px] font-semibold text-[#1d1d1f] shadow-xs backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-[#107c41] shrink-0 animate-pulse" />
          <span className="tracking-tight">{t('hero.eyebrow')}</span>
        </div>

        {/* Title */}
        <h1 className="font-display text-2xl sm:text-4xl lg:text-[46px] lg:leading-[1.14] font-black text-[#1d1d1f] tracking-tight max-w-3xl mx-auto">
          {t('hero.title')}
        </h1>

        {/* Subtitle */}
        <p className="text-[14.5px] sm:text-[15.5px] text-[#515154] leading-relaxed max-w-2xl mx-auto font-normal">
          {t('hero.subtitle')}
        </p>

        {/* Core Value Pillars - Single definitive statement on fee */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap pt-0.5">
          {pills.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white border border-black/[0.08] text-[12px] font-medium text-[#515154] whitespace-nowrap shrink-0 shadow-xs backdrop-blur-sm"
            >
              <p.icon className="w-3.5 h-3.5 text-[#107c41]" strokeWidth={2.2} />
              <span>{p.label}</span>
            </span>
          ))}
        </div>

        {/* Dynamic Route Suggester Capsule (Hiệu ứng 1: Gợi ý cặp tuyến HOT tự động) */}
        <div className="pt-2 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 border border-black/[0.08] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-md transition-all">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#1d1d1f] dark:text-white">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>Gợi ý tuyến HOT:</span>
            </span>
            <div
              key={routeCycleIndex}
              className="anim-fade-in flex items-center gap-1.5 text-[12px] font-bold text-[#0071e3] dark:text-[#2997ff]"
            >
              <span>{activeRouteHint.from}</span>
              <ArrowLeftRight className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{activeRouteHint.to}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchFrom?.(activeRouteHint.from);
                setSearchTo?.(activeRouteHint.to);
              }}
              title="Điền nhanh cặp tuyến này"
              className="ml-1 text-[11px] font-bold text-[#0071e3] hover:text-[#0077ed] dark:text-[#2997ff] bg-[#0071e3]/10 hover:bg-[#0071e3]/20 px-2.5 py-0.5 rounded-full cursor-pointer transition-all active:scale-95 flex items-center gap-0.5"
            >
              <span>Áp dụng ⚡</span>
            </button>
          </div>
        </div>

        {/* ── APPLE / CURSOR COMMAND OMNIBAR ── */}
        <div className="pt-2 max-w-4xl mx-auto w-full relative z-40">
          <div className="p-2 sm:p-2.5 rounded-2xl bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_32px_rgba(0,113,227,0.14)] focus-within:ring-2 focus-within:ring-[#0071e3]/30 focus-within:border-[#0071e3] transition-all text-left relative z-40">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-1.5">
              {/* Điểm xuất phát */}
              <div className="relative flex-1 flex items-center min-w-0 px-3.5 py-2 sm:py-1.5 rounded-xl bg-[#f5f5f7] border border-black/[0.04] hover:bg-[#ebebee] focus-within:bg-white focus-within:border-[#0071e3]/60 transition-colors focus-within:z-50">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shrink-0 mr-2.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 leading-none mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Xuất phát</span>
                    <span className="text-[10.5px] text-[#86868b] hidden xl:inline">· Tỉnh / Bến xe</span>
                  </div>
                  <LocationSuggestInput
                    id="search-from-input"
                    variant="omnibar"
                    value={searchFrom}
                    onChange={setSearchFrom}
                    placeholder={`Tỉnh thành, bến xe đi (VD: ${activeRouteHint.from}...)`}
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
                className="self-center w-8 h-8 rounded-full border border-black/[0.08] bg-white text-[#515154] hover:text-[#0071e3] hover:border-[#0071e3]/40 inline-flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-90 active:rotate-180 transition-all"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>

              {/* Điểm đến */}
              <div className="relative flex-1 flex items-center min-w-0 px-3.5 py-2 sm:py-1.5 rounded-xl bg-[#f5f5f7] border border-black/[0.04] hover:bg-[#ebebee] focus-within:bg-white focus-within:border-[#0071e3]/60 transition-colors focus-within:z-50">
                <div className="w-6 h-6 rounded-lg bg-rose-50 border border-rose-200/60 flex items-center justify-center shrink-0 mr-2.5">
                  <Navigation className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 leading-none mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Điểm đến</span>
                    <span className="text-[10.5px] text-[#86868b] hidden xl:inline">· Tỉnh / Bến xe</span>
                  </div>
                  <LocationSuggestInput
                    id="search-to-input"
                    variant="omnibar"
                    value={searchTo}
                    onChange={setSearchTo}
                    placeholder={`Tỉnh thành, bến xe đến (VD: ${activeRouteHint.to}...)`}
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
              <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
                {hasSearch && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    title="Xoá tìm kiếm"
                    className="h-10 px-2.5 text-xs text-[#515154] hover:text-[#1d1d1f] font-medium cursor-pointer"
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
                  className="relative overflow-hidden h-11 px-6 rounded-xl font-bold text-sm bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] text-white shadow-[0_4px_16px_rgba(0,113,227,0.35)] hover:shadow-[0_8px_24px_rgba(0,113,227,0.5)] whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group"
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

          {/* Mẹo Đi Chung Xe & Ghép Tuyến (Giáo dục mô hình tinh thần chuẩn Stanford HCI & BlaBlaCar) */}
          <div className="pt-2 px-2 flex items-center justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.06] text-[11px] text-[#515154] dark:text-slate-400 max-w-2xl text-center leading-snug">
              <span className="text-amber-500 font-bold shrink-0">💡 Mẹo ghép xe:</span>
              <span>
                Nên chọn <strong>Tỉnh thành, Bến xe hoặc Quận/Huyện</strong> để tìm thấy nhiều xe nhất. Chi tiết ngõ
                ngách sẽ chốt linh hoạt cùng Chủ xe qua Zalo!
              </span>
            </div>
          </div>

          {/* ── SINGLE-LINE HIGHWAY RAIL & SEPARATE PARCEL AMENITY FILTER ── */}
          <div className="pt-2 max-w-4xl mx-auto w-full relative z-20">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1">
              {/* Micro label */}
              <div className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#86868b] uppercase tracking-wider pr-1">
                <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="hidden sm:inline">Tuyến:</span>
              </div>

              {/* Route Pills (Non-wrapping single horizontal rail) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {POPULAR_HIGHWAYS.map((hw) => {
                  const isSelected =
                    hw.id === 'all'
                      ? !searchKeyword && !searchFrom && !searchTo
                      : searchKeyword.toLowerCase().includes(hw.id.toLowerCase()) ||
                        searchFrom.toLowerCase().includes(hw.id.toLowerCase());
                  const label =
                    hw.id === 'all' ? t('market.allRoutes') : lang === 'en' && hw.labelEn ? hw.labelEn : hw.label;
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
                <span>Nhận gửi đồ kèm xe</span>
                {isParcelActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Dòng dẫn nhẹ nhàng dành riêng cho chủ xe - Apple Micro Pill Banner */}
          <div className="pt-2.5 flex items-center justify-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-black/[0.06] text-xs text-[#515154] shadow-xs backdrop-blur-sm">
              <Car className="w-3.5 h-3.5 text-[#0071e3] shrink-0" strokeWidth={2.2} />
              <span>Bạn là chủ xe còn ghế trống?</span>
              <button
                type="button"
                onClick={onPostClick}
                className="font-semibold text-[#0071e3] hover:text-[#0077ed] inline-flex items-center gap-1 cursor-pointer group transition-colors"
              >
                <span>Đăng chuyến chia sẻ chi phí ngay</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Visual Showcase Card: Ảnh chuyến xe gia đình ấm cúng thực tế */}
          <div className="pt-3 max-w-4xl mx-auto w-full">
            <div className="relative rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-black/[0.08] dark:border-white/[0.08] group">
              <img
                src="/images/hero_family_ride.jpg"
                alt="Chuyến xe gia đình tiện chuyến CarMate trên cao tốc"
                className="w-full h-48 sm:h-64 md:h-72 object-cover object-center group-hover:scale-[1.02] transition-transform duration-700"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-between p-4 sm:p-6 text-white">
                {/* Top Badges */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Không nhồi nhét · Không khói thuốc · Không say xe</span>
                  </div>
                  <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/80 backdrop-blur-md text-xs font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>100% Không thu phí sàn</span>
                  </div>
                </div>

                {/* Bottom Story Link */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-left">
                  <div className="space-y-1">
                    <p className="text-base sm:text-lg font-bold tracking-tight">
                      Mỗi chuyến xe là một hành trình văn minh & ấm áp
                    </p>
                    <p className="text-xs sm:text-sm text-white/80 max-w-lg leading-relaxed">
                      Chủ xe chia sẻ bớt tiền xăng lăn bánh, Bạn đồng hành có chuyến đi êm ái như xe nhà.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('founder-story-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="self-start sm:self-auto px-4 py-2 rounded-full bg-white/95 hover:bg-white text-[#1d1d1f] text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
                  >
                    <span>Xem tâm thư Founder</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
