import React, { useState } from 'react';
import { TIME_SLOTS, getTimeSlotLabel } from '@carmate/shared';
import {
  Search,
  SlidersHorizontal,
  Users,
  Car,
  X,
  LayoutGrid,
  RotateCcw,
  MousePointerClick,
  MessageCircle,
  Banknote
} from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import Chip, { Segmented } from '../ui/Chip.jsx';
import { Field, Select } from '../ui/Field.jsx';
import Button from '../ui/Button.jsx';

export const POPULAR_HIGHWAYS = [
  { id: 'all' },
  { id: 'Bình Phước', label: 'Sài Gòn ⇄ Bình Phước (QL13)' },
  { id: 'Vũng Tàu', label: 'Vũng Tàu ⇄ Sài Gòn (QL51)' },
  { id: 'Đà Lạt', label: 'Đà Lạt ⇄ Sài Gòn (QL20)' },
  { id: 'Hà Nội', label: 'Hà Nội ⇄ Hải Phòng' },
  { id: 'Đà Nẵng', label: 'Đà Nẵng ⇄ Huế / Hội An' },
  { id: 'Phan Thiết', label: 'Phan Thiết ⇄ Sài Gòn (QL1A)' }
];

/** Thanh tìm kiếm Google Capsule + chip tuyến nhanh */
export function SearchBar({ searchKeyword, setSearchKeyword }) {
  const { t, lang } = useI18n();

  return (
    <div className="space-y-3">
      <div className="relative group">
        <Search className="w-5 h-5 text-[#0071e3] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" />
        <input
          type="search"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="Tìm tỉnh thành, bến xe, quốc lộ toàn quốc…"
          className="w-full h-13 pl-12 pr-11 rounded-full text-sm font-medium bg-white text-[#1d1d1f] placeholder:text-[#86868b] border border-black/[0.08] shadow-xs hover:border-black/[0.16] focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/15 outline-none transition-all duration-200 [&::-webkit-search-cancel-button]:hidden"
        />
        {searchKeyword && (
          <button
            type="button"
            onClick={() => setSearchKeyword('')}
            aria-label={t('common.clear')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full inline-flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.05] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Highway Chips: Tự động xuống dòng gọn gàng, bao phủ Bắc - Trung - Nam */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-0.5">
        {POPULAR_HIGHWAYS.map((hw) => {
          const isSelected =
            hw.id === 'all' ? searchKeyword === '' : searchKeyword.toLowerCase().includes(hw.id.toLowerCase());
          const label = hw.id === 'all' ? t('market.allRoutes') : lang === 'en' && hw.labelEn ? hw.labelEn : hw.label;
          return (
            <Chip
              key={hw.id}
              active={isSelected}
              onClick={() => setSearchKeyword(hw.id === 'all' ? '' : hw.id)}
              className="h-8 px-3 text-xs font-medium cursor-pointer"
            >
              {label}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

/** Bảng bộ lọc chi tiết — dùng trong sidebar (desktop) và panel gập (mobile) */
export function FilterPanel({
  selectedTimeSlot,
  setSelectedTimeSlot,
  marketViewMode,
  setMarketViewMode,
  onReset,
  showHelp = false
}) {
  const { t, lang } = useI18n();
  const hasActive = selectedTimeSlot !== 'all' || marketViewMode !== 'all';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#1d1d1f]">{t('market.sidebarTitle')}</h3>
        {hasActive && (
          <Button variant="ghost" size="xs" icon={RotateCcw} onClick={onReset}>
            {t('market.resetFilters')}
          </Button>
        )}
      </div>

      <div>
        <p className="text-[13px] font-medium text-[#515154] mb-2">{t('market.viewMode')}</p>
        <Segmented
          fullWidth
          size="sm"
          value={marketViewMode}
          onChange={setMarketViewMode}
          options={[
            { value: 'all', label: t('market.viewAll'), icon: LayoutGrid },
            { value: 'drivers', label: t('market.viewDrivers'), icon: Car },
            { value: 'passengers', label: t('market.viewPassengers'), icon: Users }
          ]}
        />
      </div>

      <Field label={t('market.timeSlot')}>
        <Select value={selectedTimeSlot} onChange={(e) => setSelectedTimeSlot(e.target.value)}>
          {TIME_SLOTS.filter((slot) => !slot.isAlias).map((slot) => (
            <option key={slot.id} value={slot.id}>
              {getTimeSlotLabel(slot.id, lang, 'full')}
            </option>
          ))}
        </Select>
      </Field>

      {showHelp && (
        <div className="pt-6 border-t border-black/[0.06]">
          <p className="text-[13px] font-semibold text-[#1d1d1f] mb-3">{t('market.howItWorks')}</p>
          <ol className="space-y-3">
            {[
              { icon: MousePointerClick, text: t('market.step1') },
              { icon: MessageCircle, text: t('market.step2') },
              { icon: Banknote, text: t('market.step3') }
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-[#f5f5f7] border border-black/[0.04] text-[#515154] inline-flex items-center justify-center shrink-0">
                  <s.icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-[13px] text-[#515154] leading-snug pt-0.5">{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Wrapper tổng hợp cho App: SearchBar với các chip quốc lộ tiện tuyến */
export default function FilterBar({ searchKeyword, setSearchKeyword }) {
  return (
    <div id="market-filter-bar" className="space-y-4 scroll-mt-24">
      <SearchBar searchKeyword={searchKeyword} setSearchKeyword={setSearchKeyword} />
    </div>
  );
}
