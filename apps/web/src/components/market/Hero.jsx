import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MapPin,
  Navigation,
  ArrowLeftRight,
  Search,
  X,
  Truck,
  Zap,
  Car,
  Users,
  Home,
  Clock,
  Radio,
  ChevronDown,
  SlidersHorizontal
} from 'lucide-react';
import {
  computeHotRoutes,
  DEFAULT_FALLBACK_ROUTES,
  DOORSTEP_CONFIG
} from '@carmate/shared';
import LocationSuggestInput from '../ui/LocationSuggestInput.jsx';
import { getContextualGhostRoute } from '../../utils/personaMemory.js';

const QUICK_CORRIDORS = [
  { id: 'all', label: 'Tất cả các tuyến' },
  { id: 'ql13', label: 'Tuyến QL13 (Bình Phước ⇄ TP.HCM)', from: 'Bình Phước', to: 'TP.HCM', corridor: 'Tuyến QL13' },
  { id: 'n2', label: 'Tuyến N2 (Kiên Giang ⇄ TP.HCM)', from: 'Kiên Giang', to: 'TP.HCM', corridor: 'Tuyến N2' },
  { id: 'vung_tau', label: 'TP.HCM ⇄ Vũng Tàu', from: 'TP.HCM', to: 'Vũng Tàu' },
  { id: 'da_lat', label: 'TP.HCM ⇄ Đà Lạt', from: 'TP.HCM', to: 'Đà Lạt' },
  { id: 'phan_thiet', label: 'TP.HCM ⇄ Phan Thiết', from: 'TP.HCM', to: 'Phan Thiết' }
];

export default function Hero({
  trips = [],
  searchKeyword = '',
  setSearchKeyword,
  searchFrom = '',
  setSearchFrom,
  searchTo = '',
  setSearchTo,
  currentUser,
  onShowToast,
  activeCorridor = 'Tuyến QL13',
  onCorridorChange
}) {
  // Chế độ hiển thị trung tâm: 'auto' (Ghép nhanh 1-chạm - Mặc định) | 'manual' (Tìm kiếm thủ công)
  // Vai trò: 'passenger' (Người đi cùng tìm xe) | 'driver' (Chủ xe có chỗ trống) | 'cargo' (Ghép hàng)
  const [role, setRole] = useState('passenger');
  const [corridor, setCorridor] = useState(activeCorridor || 'Tuyến QL13');
  const [timeSlot, setTimeSlot] = useState('all');
  const [seats, setSeats] = useState(1);

  // Tuỳ chọn nâng cao (Progressive Disclosure)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDoorstep, setIsDoorstep] = useState(false);
  const [doorstepAddress, setDoorstepAddress] = useState('');
  const [userSelectedPrice, setUserSelectedPrice] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [_matchResult, setMatchResult] = useState(null);

  // Đảo chiều điểm đi / điểm đến
  const handleSwap = () => {
    if (setSearchFrom && setSearchTo) {
      const temp = searchFrom;
      setSearchFrom(searchTo);
      setSearchTo(temp);
    }
  };

  // Tính định mức chi phí xăng xe lăn bánh ước tính (< 1ms client-side)
  const pricingEstimate = useMemo(() => {
    const isN2 = corridor?.includes('N2') || corridor?.includes('Kiên Giang');
    const distKm = isN2 ? 280 : 140;
    const ratePerKm = isN2 ? 750 : 850;
    const botProportion = Math.min(30000, Math.round((distKm / 140) * 25000));
    const calculatedPerSeat = 35000 + Math.round(distKm * ratePerKm) + botProportion;
    const roundedBase = Math.round(calculatedPerSeat / 5000) * 5000;
    const clampedBase = Math.max(50000, Math.min(300000, roundedBase));
    const surcharge = isDoorstep ? (DOORSTEP_CONFIG?.DEFAULT_SURCHARGE || 40000) : 0;

    return {
      distanceKm: distKm,
      basePrice: clampedBase,
      doorstepSurcharge: surcharge,
      finalPrice: (clampedBase + surcharge) * seats
    };
  }, [isDoorstep, seats, corridor]);

  const effectivePrice = userSelectedPrice !== null ? userSelectedPrice : pricingEstimate.finalPrice;

  // Đồng bộ ngữ cảnh hành lang lên App
  useEffect(() => {
    onCorridorChange?.({
      corridor,
      timeSlot: timeSlot === 'all' ? '' : timeSlot,
      role,
      effectivePrice
    });
  }, [corridor, timeSlot, role, effectivePrice, onCorridorChange]);

  // Hành động Tìm chuyến: Cuộn mượt tới danh sách chuyến xe
  const handleSearchClick = () => {
    const el = document.getElementById('market-results') || document.getElementById('trips-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Gửi ý định ghép tự động 1-chạm (Level 3 Autonomous Engine)
  const handleStartAutoMatch = async () => {
    const contactPhone = currentUser?.phone;
    if (!contactPhone) {
      onShowToast?.('Vui lòng đăng nhập để hệ thống tự động kết nối và gửi thông báo ghép chuyến', 'warning');
      return;
    }

    setIsSearching(true);
    setMatchResult(null);

    try {
      const intentRes = await fetch('/api/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          originName: searchFrom || 'Điểm xuất phát',
          destinationName: searchTo || 'Điểm đến',
          corridor,
          timeSlot: timeSlot === 'all' ? 'Mọi khung giờ' : timeSlot,
          seats: Number(seats),
          isDoorstep: isDoorstep ? 1 : 0,
          doorstepAddress: isDoorstep ? doorstepAddress : '',
          customPrice: effectivePrice,
          phone: contactPhone,
          contactName: currentUser?.name || (role === 'driver' ? 'Chủ xe' : 'Người đi cùng')
        })
      });

      const intentData = await intentRes.json();
      if (!intentData.success) {
        throw new Error(intentData.error || 'Không thể tạo ý định ghép');
      }

      const matchRes = await fetch('/api/intents/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corridor })
      });

      const matchData = await matchRes.json();

      if (matchData.success && matchData.matchedClusters?.length > 0) {
        const myCluster = matchData.matchedClusters.find((c) =>
          c.driver.id === intentData.data.id ||
          c.passengers.some((p) => p.id === intentData.data.id || p.phone === contactPhone)
        );

        if (myCluster) {
          setMatchResult({
            cluster: myCluster,
            role,
            isDoorstep,
            finalPrice: pricingEstimate.finalPrice
          });
          onShowToast?.('✓ Đã tìm thấy chuyến xe tiện đường phù hợp nhất!', 'success');
        } else {
          onShowToast?.('Đã lưu yêu cầu của bạn, hệ thống đang tự động tìm xe phù hợp (trong 3 phút)!', 'info');
        }
      } else {
        onShowToast?.('Đã lưu yêu cầu của bạn, hệ thống đang tự động tìm xe phù hợp (trong 3 phút)!', 'info');
      }
    } catch (err) {
      onShowToast?.(err.message || 'Lỗi điều phối tự động', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Áp dụng chip tuyến nhanh
  const handleSelectQuickCorridor = (corridorItem) => {
    if (corridorItem.id === 'all') {
      setSearchKeyword?.('');
      setSearchFrom?.('');
      setSearchTo?.('');
      return;
    }

    if (corridorItem.from && corridorItem.to) {
      setSearchFrom?.(corridorItem.from);
      setSearchTo?.(corridorItem.to);
    }
    if (corridorItem.corridor) {
      setCorridor(corridorItem.corridor);
    }
    onShowToast?.(`Đã lọc tuyến: ${corridorItem.label}`);
    handleSearchClick();
  };

  const isParcelActive = searchKeyword.toLowerCase().includes('gửi hàng') || searchKeyword.toLowerCase().includes('bán tải');
  const handleToggleParcel = () => {
    if (isParcelActive) {
      setSearchKeyword?.('');
      setRole('passenger');
    } else {
      setSearchKeyword?.('gửi hàng');
      setRole('cargo');
    }
  };

  const rotatingRoutes = useMemo(() => computeHotRoutes(trips), [trips]);
  const [routeCycleIndex, setRouteCycleIndex] = useState(0);

  useEffect(() => {
    if (rotatingRoutes.length <= 1) return;
    const timer = setInterval(() => {
      setRouteCycleIndex((prev) => (prev + 1) % rotatingRoutes.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [rotatingRoutes.length]);

  const activeRouteHint = rotatingRoutes[routeCycleIndex % rotatingRoutes.length] || DEFAULT_FALLBACK_ROUTES[0];

  const ghostRoute = useMemo(() => {
    return getContextualGhostRoute('passenger');
  }, []);

  const handleApplyGhostRoute = useCallback((route) => {
    if (!route) return;
    setSearchFrom?.(route.from);
    setSearchTo?.(route.to);
    onShowToast?.(`⚡ Đã điền nhanh lộ trình: ${route.from} ➔ ${route.to}`);
    handleSearchClick();
  }, [setSearchFrom, setSearchTo, onShowToast]);

  useEffect(() => {
    const handleKeyDown = (e) => {
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
      {/* Ambient background blur */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 w-full h-full opacity-[0.05] dark:opacity-[0.03]">
          <div className="absolute inset-0 bg-gradient-to-b from-[#f8fafc] via-transparent to-[#f8fafc] dark:from-[#0b0f19] dark:to-[#0b0f19]" />
        </div>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-blue-500/10 blur-[130px]" />
        <div className="absolute top-1/2 -left-20 w-[240px] h-[240px] rounded-full bg-emerald-500/10 blur-[100px]" />
      </div>

      <div className="relative max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-9 text-center space-y-4">
        {/* Slogan & Title */}
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-4xl lg:text-[42px] font-black text-[#1d1d1f] dark:text-white tracking-tight leading-tight">
            Đi chung xe tiện chuyến
          </h1>
          <p className="text-xs sm:text-sm text-[#515154] dark:text-slate-400 font-medium max-w-lg mx-auto">
            Chia sẻ chi phí xăng xe văn minh · 0đ phí sàn · An toàn & Tiết kiệm
          </p>
        </div>

        {/* Chuyển đổi vai trò thanh lịch (Minimalist Segmented Tabs) */}
        <div className="flex justify-center">
          <div className="inline-flex p-1 rounded-full bg-slate-200/60 dark:bg-zinc-800/80 border border-black/[0.04] dark:border-white/[0.08] shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setRole('passenger');
                if (isParcelActive) setSearchKeyword?.('');
              }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                role === 'passenger' && !isParcelActive
                  ? 'bg-white dark:bg-zinc-900 text-[#0071e3] shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Người đi cùng (Tìm xe)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRole('driver');
                if (isParcelActive) setSearchKeyword?.('');
              }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                role === 'driver' && !isParcelActive
                  ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Chủ xe (Có chỗ trống)</span>
            </button>

            <button
              type="button"
              onClick={handleToggleParcel}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isParcelActive
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Ghép hàng / Bán tải</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* THANH TÌM KIẾM & GHÉP XE HỢP NHẤT (ALL-IN-ONE OMNIBAR)     */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="pt-1 max-w-4xl mx-auto w-full relative z-40 text-left animate-in fade-in duration-200">
          <div className="p-2 sm:p-2.5 rounded-2xl sm:rounded-3xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.1] shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
            {/* 1. Nơi đi */}
            <div className="flex-1 flex items-center min-w-0 px-3.5 py-2 rounded-xl bg-[#f5f5f7] dark:bg-zinc-800/80 border border-black/[0.04] dark:border-zinc-700">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mr-2" />
              <div className="min-w-0 flex-1">
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
                  aria-label="Xoá điểm đi"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Nút Đảo chiều */}
            <button
              type="button"
              onClick={handleSwap}
              title="Đổi chiều điểm đi / điểm đến"
              aria-label="Đổi chiều"
              className="self-center w-8 h-8 -my-1 lg:my-0 rounded-full border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[#515154] hover:text-[#0071e3] inline-flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-90 active:rotate-180 transition-all z-10"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            {/* 2. Nơi đến */}
            <div className="flex-1 flex items-center min-w-0 px-3.5 py-2 rounded-xl bg-[#f5f5f7] dark:bg-zinc-800/80 border border-black/[0.04] dark:border-zinc-700">
              <Navigation className="w-4 h-4 text-rose-500 shrink-0 mr-2" />
              <div className="min-w-0 flex-1">
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

            {/* 3. Khung giờ */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f5f5f7] dark:bg-zinc-800/80 border border-black/[0.04] dark:border-zinc-700 shrink-0">
              <Clock className="w-4 h-4 text-blue-500 shrink-0" />
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="bg-transparent outline-none font-bold text-slate-800 dark:text-zinc-200 text-xs cursor-pointer"
              >
                <option value="all">Mọi giờ</option>
                <option value="Sáng sớm (05:00 - 08:00)">Sáng sớm (05-08h)</option>
                <option value="Buổi sáng (08:00 - 11:30)">Sáng (08-11h30)</option>
                <option value="Buổi trưa (11:30 - 13:30)">Trưa (11h30-13h30)</option>
                <option value="Buổi chiều (13:30 - 17:30)">Chiều (13h30-17h30)</option>
                <option value="Chiều tối (17:30 - 20:30)">Tối (17h30-20h30)</option>
              </select>
            </div>

            {/* 4. Số chỗ */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f5f5f7] dark:bg-zinc-800/80 border border-black/[0.04] dark:border-zinc-700 shrink-0">
              <Users className="w-4 h-4 text-indigo-500 shrink-0" />
              <select
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="bg-transparent outline-none font-bold text-slate-800 dark:text-zinc-200 text-xs cursor-pointer"
              >
                <option value={1}>1 chỗ</option>
                <option value={2}>2 chỗ</option>
                <option value={3}>3 chỗ</option>
                <option value={4}>4 chỗ</option>
              </select>
            </div>

            {/* 5. Nút Hành Động Tìm & Ghép */}
            <button
              type="button"
              onClick={handleSearchClick}
              className="h-10 sm:h-11 px-5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] text-white shadow-md shadow-blue-500/20 inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-all"
            >
              <Search className="w-4 h-4" />
              <span>{role === 'driver' ? 'Tìm khách' : 'Tìm xe'}</span>
            </button>
          </div>

          {/* Tuỳ chọn mở rộng (Progressive Disclosure) */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors py-1 px-2.5 rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            >
              <SlidersHorizontal className="w-3 h-3 text-[#0071e3]" />
              <span>{showAdvanced ? 'Thu gọn tuỳ chọn đón tận nơi & giá' : '+ Tuỳ chọn đón tận nơi & Ước lượng chi phí'}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>

            {showAdvanced && (
              <div className="mt-2.5 p-4 rounded-2xl bg-white/95 dark:bg-zinc-900/95 border border-black/[0.06] dark:border-zinc-800 shadow-sm max-w-2xl mx-auto space-y-3 animate-in fade-in duration-200 text-left">
                {/* Đón tận nhà */}
                <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDoorstep}
                      onChange={(e) => setIsDoorstep(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-zinc-600 cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Cần đón tận nhà (+40.000đ phụ phí ngõ ngách)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 hidden sm:inline">
                      · Bán kính láng giềng ≤ 2km
                    </span>
                  </label>
                  {isDoorstep && (
                    <input
                      type="text"
                      placeholder="Nhập ngõ, hẻm, số nhà cụ thể..."
                      value={doorstepAddress}
                      onChange={(e) => setDoorstepAddress(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  )}
                </div>

                {/* Ước lượng chi phí & Điều chỉnh giá */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-zinc-400">Ước tính chia sẻ xăng xe: </span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                      ~{effectivePrice.toLocaleString('vi-VN')}đ
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold ml-1.5">
                      (0đ phí sàn)
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setUserSelectedPrice(Math.max(40000, pricingEstimate.finalPrice - 20000))}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all ${
                        userSelectedPrice === pricingEstimate.finalPrice - 20000
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                      }`}
                    >
                      -20k Tiết kiệm
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserSelectedPrice(null)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all ${
                        userSelectedPrice === null
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                      }`}
                    >
                      Chuẩn {Math.round(pricingEstimate.finalPrice / 1000)}k
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserSelectedPrice(pricingEstimate.finalPrice + 20000)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all ${
                        userSelectedPrice === pricingEstimate.finalPrice + 20000
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                      }`}
                    >
                      +20k Đi gấp
                    </button>
                  </div>
                </div>

                {/* Kích hoạt ghép tự động Level 3 */}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                  <button
                    type="button"
                    onClick={handleStartAutoMatch}
                    disabled={isSearching}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-50"
                  >
                    {isSearching ? <Radio className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>Kích hoạt điều phối ghép tự động (3 phút)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* DẢI CHIP HÀNH LANG PHỔ BIẾN (QUICK CORRIDORS)              */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="pt-1 flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-1.5 shrink-0">
            {QUICK_CORRIDORS.map((c) => {
              const isSelected =
                c.id === 'all'
                  ? !searchKeyword && !searchFrom && !searchTo
                  : (searchFrom && c.from && searchFrom.toLowerCase().includes(c.from.toLowerCase())) ||
                    (searchTo && c.to && searchTo.toLowerCase().includes(c.to.toLowerCase())) ||
                    (c.corridor && corridor === c.corridor);

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectQuickCorridor(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all border shrink-0 ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                      : 'bg-white/80 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
