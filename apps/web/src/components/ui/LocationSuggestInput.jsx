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
  Navigation,
  Check,
  Clock,
  Sparkles
} from 'lucide-react';
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
    const instantList = searchLocations(query, 8);
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

  const [recentLocations, setRecentLocations] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('carmate_recent_places') || '[]');
    } catch {
      return [];
    }
  });

  const handleSelect = (item) => {
    const finalName = item.name || value;
    onChange?.(finalName);
    onSelect?.(item);

    // Lưu vào lịch sử tìm kiếm gần đây (Tối đa 4 mục gần nhất theo chuẩn Grab / Maps)
    try {
      const recents = JSON.parse(localStorage.getItem('carmate_recent_places') || '[]');
      const filtered = [item, ...recents.filter((r) => r.name !== item.name)].slice(0, 4);
      localStorage.setItem('carmate_recent_places', JSON.stringify(filtered));
      setRecentLocations(filtered);
    } catch {}

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
      setActiveIndex((prev) => (prev < displayedSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : displayedSuggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && displayedSuggestions[activeIndex]) {
        e.preventDefault();
        handleSelect(displayedSuggestions[activeIndex]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const isOmnibar = variant === 'omnibar';

  // Lọc theo tag danh mục nếu người dùng bấm chip filter
  const displayedSuggestions =
    activeCategoryFilter === 'all' ? suggestions : suggestions.filter((s) => s.category === activeCategoryFilter);

  // Vị trí dropdown: Nếu là ô điểm đến (search-to-input), căn lề phải để không tràn mép phải
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
              ? 'w-full bg-transparent border-0 p-0 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none truncate'
              : `w-full h-10 ${LeadingIcon ? 'pl-9' : 'pl-3'} pr-8 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-[#151c2e] border ${
                  isOpen
                    ? 'border-[#0071e3] ring-2 ring-[#0071e3]/20 shadow-md'
                    : 'border-black/[0.12] dark:border-white/[0.14]'
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

      {/* ── BẢNG GỢI Ý ĐỊA ĐIỂM (AUTOCOMPLETE DROPDOWN CHUẨN APPLE & CURSOR) ── */}
      {isOpen && (
        <div
          className={`absolute top-[calc(100%+10px)] z-[9999] rounded-2xl bg-white dark:bg-[#1c1c1e] border border-black/[0.10] dark:border-white/[0.12] shadow-[0_16px_48px_rgba(0,0,0,0.16)] overflow-hidden text-left anim-scale-in ${
            isOmnibar
              ? isRightAligned
                ? 'right-0 sm:right-0 sm:left-auto w-[calc(100vw-36px)] sm:w-[460px] md:w-[500px] max-w-[94vw]'
                : 'left-0 sm:-left-6 w-[calc(100vw-36px)] sm:w-[460px] md:w-[500px] max-w-[94vw]'
              : 'left-0 w-full sm:min-w-[380px] md:min-w-[420px] max-w-[94vw]'
          }`}
        >
          {/* Header Bảng Gợi Ý (Stanford HCI & MIT Media Lab Clear Framing) */}
          <div className="px-4 py-3 bg-[#f5f5f7] dark:bg-white/[0.04] border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              {value.trim() ? (
                <>
                  <Search className="w-3.5 h-3.5 text-[#0071e3]" />
                  <span>Gợi ý theo từ khoá</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Bến xe & Đầu mối phổ biến</span>
                </>
              )}
            </div>

            {loading ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0071e3]">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Đang tìm...</span>
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {value.trim() ? `${displayedSuggestions.length} kết quả` : 'Gợi ý chọn nhanh'}
              </span>
            )}
          </div>

          {/* Quick Filter Chips: Bến xe / Nút giao / Sân bay (100% Lucide vector icons) */}
          <div className="px-3.5 py-2 bg-white dark:bg-[#1c1c1e] border-b border-black/[0.05] dark:border-white/[0.05] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'station', label: 'Bến xe', icon: Bus },
              { id: 'highway', label: 'Nút giao', icon: Milestone },
              { id: 'airport', label: 'Sân bay', icon: Plane },
              { id: 'building', label: 'Địa danh', icon: Building2 }
            ].map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategoryFilter(cat.id)}
                  className={`px-3 py-1 rounded-full text-[11.5px] font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    activeCategoryFilter === cat.id
                      ? 'bg-[#0071e3] text-white shadow-2xs'
                      : 'bg-[#f5f5f7] dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-black/[0.06] dark:hover:bg-white/10'
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Danh sách địa điểm gợi ý */}
          <ul className="py-1 max-h-72 sm:max-h-80 overflow-y-auto divide-y divide-slate-100/70 dark:divide-white/[0.04]">
            {/* Lịch sử điểm đón gần đây nếu có */}
            {!value.trim() && recentLocations.length > 0 && activeCategoryFilter === 'all' && (
              <>
                <li className="bg-slate-50/70 dark:bg-white/[0.02] px-4 py-1.5 border-b border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-[#0071e3]" />
                    <span>Lịch sử tìm kiếm gần đây</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      localStorage.removeItem('carmate_recent_places');
                      setRecentLocations([]);
                    }}
                    className="text-[10.5px] text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    Xoá
                  </button>
                </li>
                {recentLocations.map((item, idx) => (
                  <li key={`recent-${item.name}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="w-full px-4 py-2 text-left flex items-center justify-between gap-3 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-colors cursor-pointer text-slate-900 dark:text-slate-200"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/40 text-[#0071e3]">
                          <Clock className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate leading-tight text-slate-900 dark:text-white">
                            {item.name}
                          </p>
                          <p className="text-[10.5px] text-slate-400 truncate">{item.detail}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                    </button>
                  </li>
                ))}
              </>
            )}
            {/* Mục 1: Lựa chọn giữ nguyên chuỗi người dùng đã nhập */}
            {value.trim() && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange?.(value);
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 hover:bg-[#0071e3]/5 dark:hover:bg-[#0071e3]/10 transition-colors cursor-pointer bg-blue-50/40 dark:bg-blue-950/20"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[#0071e3]/10 text-[#0071e3]">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0071e3] dark:text-[#2997ff] truncate">
                        Sử dụng địa chỉ: &quot;{value}&quot;
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Điểm đón / trả tuỳ chỉnh theo từ khoá bạn gõ
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-[#0071e3] dark:text-[#2997ff] font-bold shrink-0 px-2 py-0.5 rounded-md bg-[#0071e3]/10">
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
                    className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 text-[#0071e3] dark:text-[#2997ff]'
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-900 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#0071e3]/15 text-[#0071e3]' : 'bg-slate-100 dark:bg-white/5'
                        }`}
                      >
                        <CategoryIcon type={item.category} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate leading-tight text-slate-900 dark:text-white">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.detail}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected && (
                        <span className="text-[10px] font-mono text-[#0071e3] dark:text-[#2997ff] font-bold hidden sm:inline px-1.5 py-0.5 rounded bg-[#0071e3]/10">
                          ↵ Enter
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                    </div>
                  </button>
                </li>
              );
            })}

            {displayedSuggestions.length === 0 && !loading && !value.trim() && (
              <li className="px-4 py-4 text-center text-xs text-slate-400">
                Không tìm thấy bến xe hay địa danh trùng khớp. Bạn vẫn có thể nhập địa chỉ tự do và bấm Lưu.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
