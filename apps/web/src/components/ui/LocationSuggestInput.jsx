import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Building2, Bus, Plane, Milestone, X, ChevronRight, Search, Loader2, Hospital, Navigation } from 'lucide-react';
import { searchLocations, fetchLocationSuggestions, POPULAR_LOCATIONS } from '../../utils/vietnamLocations.js';

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
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Cập nhật gợi ý địa điểm theo giá trị nhập (0ms local + 200ms debounce async geocoding)
  const updateSuggestions = useCallback((query) => {
    // 1. Phản hồi tức thì trong 0ms từ cơ sở dữ liệu địa phương
    const instantList = searchLocations(query, 7);
    setSuggestions(instantList);

    if (!query || query.trim().length < 2) {
      setLoading(false);
      return;
    }

    // 2. Gọi geocoding toàn quốc với debounce 200ms
    setLoading(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const remoteResults = await fetchLocationSuggestions(query, 8);
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

  // Lắng nghe thay đổi value khi mở menu
  useEffect(() => {
    if (isOpen) {
      updateSuggestions(value);
      setActiveIndex(-1);
    }
  }, [value, isOpen, updateSuggestions]);

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
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
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

  // Lọc theo tag danh mục nếu người dùng bấm chip filter
  const displayedSuggestions = activeCategoryFilter === 'all'
    ? suggestions
    : suggestions.filter(s => s.category === activeCategoryFilter);

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
            onChange?.(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            updateSuggestions(value);
          }}
          onClick={() => {
            if (!isOpen) {
              setIsOpen(true);
              updateSuggestions(value);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={
            isOmnibar
              ? "w-full bg-transparent border-0 p-0 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none truncate"
              : `w-full h-10 ${LeadingIcon ? 'pl-9' : 'pl-3'} pr-8 rounded-xl text-xs font-semibold bg-white dark:bg-[#151c2e] border ${
                  isOpen ? 'border-primary-500 ring-2 ring-primary-500/20 shadow-md' : 'border-slate-200/90 dark:border-white/[0.08]'
                } text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all shadow-2xs`
          }
        />

        {/* Nút xoá nhanh (X) để bấm 1 chạm xoá trắng và mở gợi ý */}
        {value && !isOmnibar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange?.('');
              inputRef.current?.focus();
              setIsOpen(true);
              updateSuggestions('');
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            title="Xoá để chọn địa điểm khác"
            aria-label="Xoá địa điểm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── BẢNG GỢI Ý ĐỊA ĐIỂM (AUTOCOMPLETE DROPDOWN) ── */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[9999] rounded-2xl bg-white dark:bg-[#1c1c1e] border border-black/[0.12] dark:border-white/[0.14] shadow-2xl shadow-black/10 overflow-hidden text-left anim-scale-in">
          {/* Header Bảng Gợi Ý */}
          <div className="px-3.5 py-2.5 bg-[#f5f5f7] dark:bg-white/[0.04] border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1d1d1f] dark:text-white">
              <Search className="w-3.5 h-3.5 text-[#0071e3]" />
              <span>Điểm đón & trả gợi ý</span>
            </div>

            {loading ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0071e3]">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Đang tìm...</span>
              </span>
            ) : (
              <span className="text-[11px] text-[#86868b] dark:text-slate-400 hidden sm:inline">
                {displayedSuggestions.length} điểm phổ biến
              </span>
            )}
          </div>

          {/* Quick Filter Chips: Bến xe / Sân bay / Cao tốc */}
          <div className="px-3 py-1.5 bg-white dark:bg-[#1c1c1e] border-b border-black/[0.05] dark:border-white/[0.05] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'station', label: '🚌 Bến xe' },
              { id: 'highway', label: '🛣️ Nút giao' },
              { id: 'airport', label: '✈️ Sân bay' },
              { id: 'building', label: '🏢 Cơ quan' }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeCategoryFilter === cat.id
                    ? 'bg-[#0071e3] text-white shadow-2xs'
                    : 'bg-[#f5f5f7] dark:bg-white/[0.06] text-[#515154] dark:text-slate-300 hover:bg-black/[0.06] dark:hover:bg-white/10'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Danh sách địa điểm gợi ý */}
          <ul className="py-1 max-h-60 overflow-y-auto divide-y divide-slate-100/60 dark:divide-white/[0.03]">
            {/* Mục 1: Lựa chọn giữ nguyên chuỗi người dùng đã nhập */}
            {value.trim() && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange?.(value);
                    setIsOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left flex items-center justify-between gap-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer bg-primary-50/30 dark:bg-primary-950/20"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-primary-100 dark:bg-primary-900/60 text-primary-600 dark:text-primary-400">
                      <MapPin className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-primary-900 dark:text-primary-200 truncate">
                        Sử dụng địa chỉ đã nhập: &quot;{value}&quot;
                      </p>
                      <p className="text-[10.5px] text-slate-400 truncate">
                        Điểm đón / trả tuỳ chỉnh
                      </p>
                    </div>
                  </div>
                  <span className="text-[10.5px] font-mono text-primary-600 font-bold shrink-0">
                    Chọn ↵
                  </span>
                </button>
              </li>
            )}

            {/* Các địa điểm tìm kiếm được */}
            {displayedSuggestions.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <li key={`${item.name}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full px-3.5 py-2 text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-900 dark:text-primary-100'
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.03] text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-primary-100 dark:bg-primary-900/60'
                          : 'bg-slate-100 dark:bg-white/5'
                      }`}>
                        <CategoryIcon type={item.category} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate leading-tight text-slate-900 dark:text-white">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {item.detail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected && (
                        <span className="text-[10px] font-mono text-primary-600 dark:text-primary-400 font-bold hidden sm:inline">
                          ↵ Enter
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                    </div>
                  </button>
                </li>
              );
            })}

            {displayedSuggestions.length === 0 && !loading && (
              <li className="px-4 py-3 text-center text-xs text-slate-400">
                Không tìm thấy bến xe hay địa danh trùng khớp. Bạn vẫn có thể nhập địa chỉ tự do và bấm Lưu.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
