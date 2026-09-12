import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MapPin,
  Building2,
  Bus,
  Plane,
  Milestone,
  X,
  ChevronRight,
  Search,
  Loader2,
  Hospital,
  Navigation
} from 'lucide-react';
import { searchLocations, fetchLocationSuggestions } from '../../utils/vietnamLocations.js';
import { useI18n } from '../../i18n/index.jsx';

function CategoryIcon({ type, className = 'w-3.5 h-3.5' }) {
  switch (type) {
    case 'station':
      return <Bus className={`${className} text-blue-500`} />;
    case 'airport':
      return <Plane className={`${className} text-sky-500`} />;
    case 'highway':
      return <Milestone className={`${className} text-amber-500`} />;
    case 'hospital':
      return <Hospital className={`${className} text-rose-500`} />;
    case 'street':
      return <Navigation className={`${className} text-indigo-500`} />;
    case 'city':
    case 'building':
    default:
      return <Building2 className={`${className} text-emerald-500`} />;
  }
}

export default function LocationSuggestInput({
  id,
  value = '',
  onChange,
  onSelect,
  placeholder = 'Nhập bến xe, địa chỉ, quận huyện, ngã tư...',
  icon: LeadingIcon = MapPin,
  iconColor = 'text-emerald-500',
  className = '',
  variant = 'default', // 'default' | 'omnibar'
  required = false
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Cập nhật gợi ý địa điểm theo giá trị nhập (0ms local + 200ms debounce async geocoding)
  const updateSuggestions = useCallback((query) => {
    if (!query || query.trim().length === 0) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    // 1. Phản hồi tức thì trong 0ms từ cơ sở dữ liệu địa phương
    const instantList = searchLocations(query, 6);
    setSuggestions(instantList);

    if (query.trim().length < 2) {
      setLoading(false);
      return;
    }

    // 2. Gọi geocoding toàn quốc với debounce 200ms
    setLoading(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const remoteResults = await fetchLocationSuggestions(query, 6);
        if (remoteResults && remoteResults.length > 0) {
          setSuggestions(remoteResults);
        }
      } catch (e) {
        console.warn('Geocoding suggest error:', e);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, []);

  // Click ra ngoài để đóng menu
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleSelect = (item) => {
    const finalName = item.name || value;
    onChange?.(finalName);
    onSelect?.(item);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && value && value.trim().length >= 1) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const isOmnibar = variant === 'omnibar';
  const isRightAligned = id === 'search-to-input';

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-[9999]' : 'z-10'} ${className}`}>
      <div className="relative flex items-center">
        {LeadingIcon && !isOmnibar && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <LeadingIcon className={`w-4 h-4 ${iconColor}`} />
          </div>
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          required={required}
          value={value}
          onChange={(e) => {
            const val = e.target.value;
            onChange?.(val);
            if (val && val.trim().length >= 1) {
              setIsOpen(true);
              updateSuggestions(val);
              setActiveIndex(-1);
            } else {
              setIsOpen(false);
              setSuggestions([]);
            }
          }}
          onFocus={() => {
            if (value && value.trim().length >= 1) {
              setIsOpen(true);
              updateSuggestions(value);
            } else {
              setIsOpen(false);
            }
          }}
          onClick={() => {
            if (value && value.trim().length >= 1 && !isOpen) {
              setIsOpen(true);
              updateSuggestions(value);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={
            isOmnibar
              ? 'w-full bg-transparent border-0 p-0 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none truncate'
              : `w-full h-10 ${LeadingIcon ? 'pl-9' : 'pl-3'} pr-8 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-[#151c2e] border ${
                  isOpen
                    ? 'border-[#0071e3] ring-2 ring-[#0071e3]/20 shadow-md'
                    : 'border-black/[0.12] dark:border-white/[0.14]'
                } text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all shadow-2xs`
          }
        />

        {/* Nút xoá nhanh (X) cho biến thể chuẩn */}
        {value && !isOmnibar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange?.('');
              inputRef.current?.focus();
              setIsOpen(false);
              setSuggestions([]);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            title={t('locSuggest.s004')}
            aria-label={t('locSuggest.s005')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── BẢNG GỢI Ý ĐỊA ĐIỂM TINH GỌN (CHỈ HIỂN THỊ KHI ĐANG GÕ - APPLE HIG) ── */}
      {isOpen && value && value.trim().length >= 1 && (
        <div
          className={`absolute top-[calc(100%+8px)] z-[9999] rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_12px_36px_rgba(0,0,0,0.14)] overflow-hidden text-left anim-scale-in ${
            isOmnibar
              ? isRightAligned
                ? 'right-0 w-[calc(100vw-36px)] sm:w-[380px] max-w-[92vw]'
                : 'left-0 w-[calc(100vw-36px)] sm:w-[380px] max-w-[92vw]'
              : 'left-0 w-full sm:min-w-[340px] max-w-[92vw]'
          }`}
        >
          {/* Header nhỏ gọn */}
          <div className="px-3.5 py-1.5 bg-[#f5f5f7] dark:bg-white/[0.04] border-b border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Search className="w-3 h-3 text-[#0071e3]" />
              <span>{t('locSuggest.s001')}</span>
            </span>
            {loading && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#0071e3]">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{t('locSuggest.s002')}</span>
              </span>
            )}
          </div>

          <ul className="py-1 max-h-60 overflow-y-auto divide-y divide-slate-100/70 dark:divide-white/[0.04]">
            {/* Lựa chọn 1: Sử dụng đúng chuỗi người dùng đang gõ */}
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange?.(value);
                  setIsOpen(false);
                }}
                className="w-full px-3.5 py-2 text-left flex items-center justify-between gap-2.5 hover:bg-[#0071e3]/5 dark:hover:bg-[#0071e3]/10 transition-colors cursor-pointer bg-blue-50/40 dark:bg-blue-950/20"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-[#0071e3]/10 text-[#0071e3]">
                    <MapPin className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0071e3] dark:text-[#2997ff] truncate">
                      Tìm theo từ khoá: &quot;{value}&quot;
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#0071e3] font-bold px-1.5 py-0.5 rounded bg-[#0071e3]/10">
                  {t('locSuggest.s003')}
                </span>
              </button>
            </li>

            {/* Các địa điểm gợi ý khớp */}
            {suggestions.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <li key={`${item.name}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full px-3.5 py-2 text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 text-[#0071e3] dark:text-[#2997ff]'
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-900 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#0071e3]/15 text-[#0071e3]' : 'bg-slate-100 dark:bg-white/5'
                        }`}
                      >
                        <CategoryIcon type={item.category} className="w-3 h-3" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate leading-tight text-slate-900 dark:text-white">
                          {item.name}
                        </p>
                        {item.detail && (
                          <p className="text-[10.5px] text-slate-400 truncate mt-0.5">{item.detail}</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
