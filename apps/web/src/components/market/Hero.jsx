import React from 'react';
import { ShieldCheck, BadgePercent, MessageCircle, Sparkles, MapPin, Navigation, ArrowLeftRight, Search, PlusCircle, Car, Zap, X, CornerDownLeft } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import Chip from '../ui/Chip.jsx';
import Button from '../ui/Button.jsx';
import { POPULAR_HIGHWAYS } from './FilterBar.jsx';

import LocationSuggestInput from '../ui/LocationSuggestInput.jsx';

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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const el = document.getElementById('market-results');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const hasSearch = Boolean(searchKeyword || searchFrom || searchTo);

  const pills = [
    { icon: BadgePercent, label: '0% phí sàn' },
    { icon: Zap, label: 'Xe gia đình & Tiện chuyến' },
    { icon: MessageCircle, label: 'Zalo 1 chạm kết nối' },
    { icon: ShieldCheck, label: 'Xác minh SĐT thật' }
  ];

  return (
    <section className="relative overflow-hidden border-b border-slate-200/80 dark:border-white/[0.08] hero-canvas">
      {/* Background ambient subtle glow (Soft, zero-glare, eye-care) */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[380px] rounded-full bg-primary-500/5 dark:bg-primary-500/10 blur-[140px] pointer-events-none" aria-hidden="true" />
      <div className="absolute top-1/2 -left-20 w-[300px] h-[300px] rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-[120px] pointer-events-none" aria-hidden="true" />

      <div className="relative max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 text-center space-y-4">
        {/* Eyebrow badge with glowing pulse */}
        <div className="inline-flex items-center gap-2 h-7 pl-2.5 pr-3.5 rounded-full bg-white/90 dark:bg-[#0f1422]/90 border border-slate-200/90 dark:border-white/[0.08] text-[12px] font-semibold text-primary-700 dark:text-primary-300 shadow-2xs backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
          </span>
          <span className="tracking-tight">{t('hero.eyebrow')}</span>
        </div>

        {/* Title */}
        <h1 className="font-display text-2xl sm:text-3xl lg:text-[42px] lg:leading-[1.16] font-extrabold text-slate-900 dark:text-white tracking-tight max-w-3xl mx-auto">
          {t('hero.title')}
        </h1>

        {/* Subtitle */}
        <p className="text-[14px] sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto font-normal">
          {t('hero.subtitle')}
        </p>

        {/* Core Value Pills */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap pt-0.5">
          {pills.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center gap-1.5 h-6.5 px-3 rounded-full bg-white/80 dark:bg-[#151c2e]/80 border border-slate-200/80 dark:border-white/[0.08] text-[11.5px] font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0 shadow-2xs backdrop-blur-sm"
            >
              <p.icon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
              <span>{p.label}</span>
            </span>
          ))}
        </div>

        {/* ── CURSOR OMNIBAR COMMAND HUB (Zero Fluff, Instant Keyboard & Visual Focus) ── */}
        <div className="pt-2 max-w-4xl mx-auto w-full">
          <div className="p-2 sm:p-2.5 rounded-2xl sm:rounded-full bg-white/95 dark:bg-[#0f1422]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-white/[0.08] shadow-md dark:shadow-2xl dark:shadow-black/60 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary-500/30 focus-within:border-primary-500/70 transition-all text-left">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-1">
              
              {/* Điểm đón / xuất phát */}
              <div className="relative flex-1 flex items-center min-w-0 px-3.5 py-2 sm:py-1.5 rounded-xl sm:rounded-full bg-slate-50/80 dark:bg-[#151c2e]/70 hover:bg-slate-100/80 dark:hover:bg-[#1b243b]/70 transition-colors">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mr-2" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="search-from-input" className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-none">
                      [ ĐI ]
                    </label>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden xl:inline">Điểm đón / xuất phát</span>
                  </div>
                  <LocationSuggestInput
                    id="search-from-input"
                    variant="omnibar"
                    value={searchFrom}
                    onChange={setSearchFrom}
                    placeholder="Tỉnh thành, bến xe đi (VD: Hà Nội, Lộc Ninh...)"
                  />
                </div>
                {searchFrom && (
                  <button
                    type="button"
                    onClick={() => setSearchFrom?.('')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-full"
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
                className="self-center w-8 h-8 rounded-full border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#151c2e] text-slate-500 dark:text-slate-300 hover:text-primary-600 hover:border-primary-300 dark:hover:text-primary-400 dark:hover:border-primary-500/50 inline-flex items-center justify-center shrink-0 cursor-pointer shadow-2xs active:scale-90 active:rotate-180 transition-all"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>

              {/* Điểm đến / trả khách */}
              <div className="relative flex-1 flex items-center min-w-0 px-3.5 py-2 sm:py-1.5 rounded-xl sm:rounded-full bg-slate-50/80 dark:bg-[#151c2e]/70 hover:bg-slate-100/80 dark:hover:bg-[#1b243b]/70 transition-colors">
                <Navigation className="w-4 h-4 text-rose-500 shrink-0 mr-2" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="search-to-input" className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-none">
                      [ ĐẾN ]
                    </label>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden xl:inline">Điểm đến / nơi trả</span>
                  </div>
                  <LocationSuggestInput
                    id="search-to-input"
                    variant="omnibar"
                    value={searchTo}
                    onChange={setSearchTo}
                    placeholder="Tỉnh thành, bến xe đến (VD: Hải Phòng, Sài Gòn...)"
                  />
                </div>
                {searchTo && (
                  <button
                    type="button"
                    onClick={() => setSearchTo?.('')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-full"
                    aria-label="Xoá điểm đến"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons: TÌM CHUYẾN (Single Illuminated Primary CTA) + Clear */}
              <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
                {hasSearch && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    title="Xoá tìm kiếm"
                    className="h-10 px-2.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-medium cursor-pointer"
                  >
                    Xoá lọc
                  </button>
                )}

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    const el = document.getElementById('market-results');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="rounded-xl sm:rounded-full font-bold shadow-md shadow-primary-600/20 whitespace-nowrap shrink-0 px-5 cursor-pointer active:scale-95 transition-all"
                >
                  <Search className="w-4 h-4 mr-1.5" />
                  <span>{t('hero.findTripCta') || 'Tìm chuyến'}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Highway Chips: Tuyến chạy phổ biến */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-3">
            <span className="text-[11.5px] font-mono font-semibold text-slate-400 dark:text-slate-500 mr-1">
              TUYẾN PHỔ BIẾN:
            </span>
            {POPULAR_HIGHWAYS.map((hw) => {
              const isSelected = hw.id === 'all'
                ? (!searchKeyword && !searchFrom && !searchTo)
                : (searchKeyword.toLowerCase().includes(hw.id.toLowerCase()) || searchFrom.toLowerCase().includes(hw.id.toLowerCase()));
              const label = hw.id === 'all' ? t('market.allRoutes') : (lang === 'en' && hw.labelEn ? hw.labelEn : hw.label);
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
                  className="h-7 px-3 text-xs font-medium cursor-pointer active:scale-95"
                >
                  {label}
                </Chip>
              );
            })}
          </div>

          {/* Dòng dẫn nhẹ nhàng dành riêng cho chủ xe (Linear style ghost trigger) */}
          <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 flex-wrap">
            <span>🚗 Bạn là chủ xe còn ghế trống?</span>
            <button
              type="button"
              onClick={onPostClick}
              className="font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
            >
              <span>Đăng chuyến chia sẻ chi phí xăng xe ngay</span>
              <span>➔</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
