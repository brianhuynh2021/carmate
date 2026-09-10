import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
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
  CheckCircle2,
  Pencil
} from 'lucide-react';
import {
  computeHotRoutes,
  DEFAULT_FALLBACK_ROUTES,
  VIRTUAL_HUBS,
  DOORSTEP_CONFIG,
  calculateDistanceKm
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Chip from '../ui/Chip.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
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
  currentUser,
  onShowToast,
  onOpenBooking,
  activeCorridor = 'Tuyến QL13',
  onCorridorChange
}) {
  const { t, lang } = useI18n();

  // Chế độ hiển thị trung tâm: 'auto' (Ghép nhanh 1-chạm - Mặc định) | 'manual' (Tìm kiếm thủ công)
  const [heroMode, setHeroMode] = useState('auto');

  // --- State cho Chế độ Ghép Nhanh 1-Chạm ---
  const [role, setRole] = useState('passenger'); // 'passenger' | 'driver'
  const [corridor, setCorridor] = useState(activeCorridor || 'Tuyến QL13');
  const [originHubId, setOriginHubId] = useState('hub_ql13_cho_loc_ninh');
  const [destHubId, setDestHubId] = useState('hub_ql13_hang_xanh');
  const [timeSlot, setTimeSlot] = useState('Sáng sớm (05:00 - 08:00)');
  const [seats, setSeats] = useState(1);
  const [isDoorstep, setIsDoorstep] = useState(false);
  const [doorstepAddress, setDoorstepAddress] = useState('');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [isSearching, setIsSearching] = useState(false);
  const [matchResult, setMatchResult] = useState(null);

  // Khối giá 2 chiều (Double Auction: Người dùng và Chủ xe đều tự do đặt giá)
  const [userSelectedPrice, setUserSelectedPrice] = useState(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [customPriceInput, setCustomPriceInput] = useState('');

  // Lọc danh sách trạm đón theo hành lang
  const corridorHubs = useMemo(() => {
    return VIRTUAL_HUBS.filter((h) => h.corridor === corridor);
  }, [corridor]);

  const originHub = useMemo(() => {
    return corridorHubs.find((h) => h.id === originHubId) || corridorHubs[0];
  }, [corridorHubs, originHubId]);

  const destHub = useMemo(() => {
    return corridorHubs.find((h) => h.id === destHubId) || corridorHubs[corridorHubs.length - 1];
  }, [corridorHubs, destHubId]);

  // Đảo chiều trạm đón / trạm trả
  const handleSwapHubs = () => {
    const temp = originHubId;
    setOriginHubId(destHubId);
    setDestHubId(temp);
  };

  // Tính cự ly và giá xăng chia sẻ dự kiến tức thì (< 1ms client-side)
  const pricingEstimate = useMemo(() => {
    if (!originHub || !destHub) return { finalPrice: 140000, distanceKm: 110 };
    const directKm = calculateDistanceKm(originHub.lat, originHub.lng, destHub.lat, destHub.lng) || 100;
    const distKm = Math.max(15, Math.round(directKm * 1.28));
    const fuel = Math.round(distKm * 1500);
    const bot = 70000;
    const baseShare = Math.round((fuel + bot) / 3 / 1000) * 1000;
    const clampedBase = Math.max(80000, Math.min(220000, baseShare));
    const surcharge = isDoorstep ? (DOORSTEP_CONFIG.DEFAULT_SURCHARGE || 40000) : 0;

    return {
      distanceKm: distKm,
      basePrice: clampedBase,
      doorstepSurcharge: surcharge,
      finalPrice: (clampedBase + surcharge) * seats
    };
  }, [originHub, destHub, isDoorstep, seats]);

  // Mức giá thực tế (người dùng tự đặt hoặc theo gợi ý chuẩn Shapley)
  const effectivePrice = userSelectedPrice !== null ? userSelectedPrice : pricingEstimate.finalPrice;

  // Đồng bộ ngữ cảnh hành lang lên App để tự động cập nhật Dòng thời gian chuyến sau
  useEffect(() => {
    onCorridorChange?.({
      corridor,
      originHub,
      destHub,
      timeSlot,
      role,
      effectivePrice
    });
  }, [corridor, originHub, destHub, timeSlot, role, effectivePrice, onCorridorChange]);

  // Gửi yêu cầu ghép tự động 1-chạm
  const handleStartAutoMatch = async () => {
    const contactPhone = phone || currentUser?.phone;
    if (!contactPhone) {
      onShowToast?.('Vui lòng nhập số điện thoại để hệ thống gửi thông báo ghép chuyến', 'warning');
      return;
    }

    if (originHubId === destHubId) {
      onShowToast?.('Điểm xuất phát và điểm đến không được trùng nhau', 'warning');
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
          originHubId: originHub.id,
          originName: originHub.shortName,
          destinationHubId: destHub.id,
          destinationName: destHub.shortName,
          corridor,
          timeSlot,
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
          onShowToast?.('✓ Tìm thấy chuyến ghép ổn định tối ưu toàn cục!', 'success');
        } else {
          onShowToast?.('Ý định đã được lưu vào phiên gom tự động (sẽ ghép trong 3 phút).', 'info');
        }
      } else {
        onShowToast?.('Ý định đã được lưu vào phiên gom tự động (sẽ ghép trong 3 phút).', 'info');
      }
    } catch (err) {
      onShowToast?.(err.message || 'Lỗi điều phối tự động', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // --- Logic cho Chế độ Tìm Kiếm Thủ Công (Manual) ---
  const handleSwapManual = () => {
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

  const isParcelActive =
    searchKeyword.toLowerCase().includes('gửi hàng') || searchKeyword.toLowerCase().includes('bán tải');

  const handleToggleParcel = () => {
    if (isParcelActive) {
      setSearchKeyword?.('');
    } else {
      setSearchKeyword?.('gửi hàng');
    }
  };

  const hasSearch = Boolean(searchKeyword || searchFrom || searchTo);

  const rotatingRoutes = useMemo(() => {
    return computeHotRoutes(trips);
  }, [trips]);

  const [routeCycleIndex, setRouteCycleIndex] = useState(0);

  useEffect(() => {
    if (rotatingRoutes.length <= 1) return;
    const timer = setInterval(() => {
      setRouteCycleIndex((prev) => (prev + 1) % rotatingRoutes.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [rotatingRoutes.length]);

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
      {/* Ambient backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 w-full h-full opacity-[0.07] sm:opacity-[0.09] lg:opacity-[0.12] dark:opacity-[0.04] transition-opacity">
          <img
            src="/images/hero_family_ride.jpg"
            alt=""
            className="w-full h-full object-cover object-[center_35%] filter blur-[1.5px]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#ffffff_45%,_rgba(255,255,255,0.85)_75%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_at_center,_#0b0f19_45%,_rgba(11,15,25,0.85)_75%,_transparent_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/80 to-[#f8fafc] dark:from-[#0b0f19] dark:via-[#0b0f19]/80 dark:to-[#0b0f19]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#f8fafc]/95 via-transparent to-[#f8fafc] dark:from-[#0b0f19]/95 dark:via-transparent dark:to-[#0b0f19]" />
        </div>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[380px] rounded-full bg-primary-500/10 blur-[140px]" />
        <div className="absolute top-1/2 -left-20 w-[300px] h-[300px] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative max-w-[1120px] mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-7 text-center space-y-3">
        {/* Title */}
        <h1 className="font-display text-xl sm:text-3xl lg:text-[40px] lg:leading-[1.15] font-black text-[#1d1d1f] dark:text-white tracking-tight max-w-3xl mx-auto leading-tight">
          {t('hero.title') || 'Cộng đồng chia sẻ chi phí lăn bánh văn minh'}
        </h1>

        <p className="text-[13.5px] sm:text-[15px] text-[#515154] dark:text-slate-400 font-medium max-w-xl mx-auto tracking-tight">
          Tự động kết nối Chủ xe & Người đi cùng trên cùng hành lang · Không trung gian · Tiết kiệm chi phí
        </p>

        {/* ── BỘ CHUYỂN ĐỔI CHẾ ĐỘ: GHÉP NHANH (MẶC ĐỊNH) VS TÌM KIẾM THỦ CÔNG ── */}
        <div className="pt-1 flex justify-center">
          <div className="inline-flex p-1 rounded-2xl bg-slate-200/70 dark:bg-zinc-800/90 border border-black/[0.06] dark:border-white/10 shadow-xs">
            <button
              type="button"
              onClick={() => setHeroMode('auto')}
              className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                heroMode === 'auto'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              Ghép Xe Nhanh 1-Chạm
            </button>
            <button
              type="button"
              onClick={() => setHeroMode('manual')}
              className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                heroMode === 'manual'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              Tìm Kiếm Thủ Công
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* CHẾ ĐỘ 1: GHÉP XE NHANH 1-CHẠM (LEVEL 3 AUTONOMOUS ENGINE) */}
        {/* ══════════════════════════════════════════════════════════ */}
        {heroMode === 'auto' && (
          <div className="pt-2 max-w-3xl mx-auto w-full relative z-40 text-left">
            <div className="p-4 sm:p-5 rounded-3xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-zinc-800 shadow-[0_8px_32px_rgba(0,113,227,0.12)] space-y-3.5">
              {/* Vai trò & Tuyến hành lang */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1 border-b border-slate-100 dark:border-zinc-800/80">
                <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setRole('passenger')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      role === 'passenger'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Người đi cùng (Tìm xe)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('driver')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      role === 'driver'
                        ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5" />
                    Chủ xe (Có chỗ trống)
                  </button>
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 font-medium">
                  <span>Hành lang:</span>
                  <select
                    value={corridor}
                    onChange={(e) => {
                      setCorridor(e.target.value);
                      const newHubs = VIRTUAL_HUBS.filter((h) => h.corridor === e.target.value);
                      if (newHubs.length > 0) {
                        setOriginHubId(newHubs[0].id);
                        setDestHubId(newHubs[newHubs.length - 1].id);
                      }
                    }}
                    className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-slate-900 dark:text-white font-semibold outline-none cursor-pointer text-xs"
                  >
                    <option value="Tuyến QL13">Tuyến QL13 (TP.HCM ⇄ Bình Phước)</option>
                    <option value="Tuyến N2 - Kiên Giang">Tuyến N2 (Đông Nam Bộ ⇄ Miền Tây)</option>
                  </select>
                </div>
              </div>

              {/* Bộ chọn Điểm đón & Điểm đến với nút Hoán đổi ⇄ */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
                {/* Điểm xuất phát */}
                <div className="p-3 rounded-2xl bg-[#f5f5f7] dark:bg-zinc-900/90 border border-black/[0.04] dark:border-zinc-800 space-y-1">
                  <label className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Trạm đón cố định (Xuất phát)
                  </label>
                  <select
                    value={originHubId}
                    onChange={(e) => setOriginHubId(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white font-bold outline-none cursor-pointer"
                  >
                    {corridorHubs.map((hub) => (
                      <option key={hub.id} value={hub.id}>
                        {hub.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 line-clamp-1">
                    📍 {originHub?.landmark} (Dừng tối đa 5p)
                  </p>
                </div>

                {/* Nút đảo chiều ⇄ */}
                <button
                  type="button"
                  onClick={handleSwapHubs}
                  title="Đổi chiều xuất phát / điểm đến"
                  className="self-center w-8 h-8 rounded-full border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-blue-600 inline-flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-90 active:rotate-180 transition-all mx-auto sm:mx-0"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>

                {/* Điểm đến */}
                <div className="p-3 rounded-2xl bg-[#f5f5f7] dark:bg-zinc-900/90 border border-black/[0.04] dark:border-zinc-800 space-y-1">
                  <label className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
                    <Navigation className="w-3 h-3" />
                    Trạm trả (Điểm đến)
                  </label>
                  <select
                    value={destHubId}
                    onChange={(e) => setDestHubId(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white font-bold outline-none cursor-pointer"
                  >
                    {corridorHubs.map((hub) => (
                      <option key={hub.id} value={hub.id}>
                        {hub.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 line-clamp-1">
                    📍 {destHub?.landmark} (Trả dọc trục chính)
                  </p>
                </div>
              </div>

              {/* Tùy chọn đón tận nhà */}
              <div className="p-2.5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDoorstep}
                    onChange={(e) => setIsDoorstep(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-zinc-600 cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Cần đón tận nhà (+40k phụ phí xăng ngõ ngách)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 hidden sm:inline">
                    · Ghép bán kính láng giềng ≤ 1km
                  </span>
                </label>
                {isDoorstep && (
                  <input
                    type="text"
                    placeholder="Nhập địa chỉ ngõ / hẻm cụ thể (VD: Hẻm 12, Ấp 3, Lộc Ninh)..."
                    value={doorstepAddress}
                    onChange={(e) => setDoorstepAddress(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/30 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                )}
              </div>

              {/* Hàng điều khiển: Khung giờ, Ghế & Báo giá xăng */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={timeSlot}
                      onChange={(e) => setTimeSlot(e.target.value)}
                      className="bg-transparent outline-none font-medium text-slate-900 dark:text-white text-xs cursor-pointer"
                    >
                      <option value="Sáng sớm (05:00 - 08:00)">Sáng sớm (05:00 - 08:00)</option>
                      <option value="Buổi sáng (08:00 - 11:30)">Buổi sáng (08:00 - 11:30)</option>
                      <option value="Buổi trưa (11:30 - 13:30)">Buổi trưa (11:30 - 13:30)</option>
                      <option value="Buổi chiều (13:30 - 17:30)">Buổi chiều (13:30 - 17:30)</option>
                      <option value="Chiều tối (17:30 - 20:30)">Chiều tối (17:30 - 20:30)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    <span>{role === 'driver' ? 'Ghế:' : 'Khách:'}</span>
                    <select
                      value={seats}
                      onChange={(e) => setSeats(Number(e.target.value))}
                      className="bg-transparent outline-none font-bold text-slate-900 dark:text-white text-xs cursor-pointer"
                    >
                      <option value={1}>1 chỗ</option>
                      <option value={2}>2 chỗ</option>
                      <option value={3}>3 chỗ</option>
                      <option value={4}>4 chỗ</option>
                    </select>
                  </div>
                </div>

                {/* Khối định giá 2 chiều (Double Auction: Cả Chủ xe và Người đi cùng đều tự do đặt giá) */}
                <div className="flex flex-col sm:items-end gap-1 text-left sm:text-right">
                  <div className="flex items-center sm:justify-end gap-1.5 flex-wrap">
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      {role === 'passenger' ? 'Giá bạn sẵn sàng trả:' : 'Phí xăng mong muốn nhận:'}
                    </span>
                    {isEditingPrice ? (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          step={5000}
                          min={30000}
                          max={600000}
                          value={customPriceInput}
                          onChange={(e) => setCustomPriceInput(e.target.value)}
                          onBlur={() => {
                            const val = Number(customPriceInput);
                            if (val >= 30000 && val <= 600000) {
                              setUserSelectedPrice(val);
                            }
                            setIsEditingPrice(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = Number(customPriceInput);
                              if (val >= 30000 && val <= 600000) {
                                setUserSelectedPrice(val);
                              }
                              setIsEditingPrice(false);
                            }
                          }}
                          autoFocus
                          className="w-24 px-2 py-0.5 text-sm font-mono font-bold bg-white dark:bg-zinc-800 border border-blue-500 rounded-lg text-blue-600 outline-none"
                        />
                        <span className="text-xs font-bold text-blue-600">đ</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomPriceInput(String(effectivePrice));
                          setIsEditingPrice(true);
                        }}
                        title="Bấm để tự chỉnh giá theo ý muốn"
                        className="inline-flex items-center gap-1 group cursor-pointer"
                      >
                        <span className="text-base sm:text-xl font-mono font-extrabold text-blue-600 dark:text-blue-400 group-hover:underline">
                          {effectivePrice.toLocaleString('vi-VN')}đ
                        </span>
                        <Pencil className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                      </button>
                    )}
                  </div>

                  {/* 3 Chip điều chỉnh giá nhanh 1-chạm */}
                  <div className="flex items-center sm:justify-end gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setUserSelectedPrice(Math.max(40000, pricingEstimate.finalPrice - 20000))}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-all ${
                        userSelectedPrice === pricingEstimate.finalPrice - 20000
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                      }`}
                    >
                      {role === 'passenger' ? '-20k Tiết kiệm' : '-20k Hỗ trợ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserSelectedPrice(null)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-all ${
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
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-all ${
                        userSelectedPrice === pricingEstimate.finalPrice + 20000
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                      }`}
                    >
                      {role === 'passenger' ? '+20k Đi gấp' : '+20k Xe mới'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Ô số điện thoại nếu chưa đăng nhập */}
              {!currentUser?.phone && (
                <input
                  type="tel"
                  placeholder="Nhập số điện thoại Zalo của bạn để nhận thông báo ghép xe..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#f5f5f7] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              )}

              {/* Nút hành động chính: BẮT TAY GHÉP CHUYẾN */}
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm sm:text-base py-3 rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                onClick={handleStartAutoMatch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <>
                    <Radio className="w-5 h-5 animate-spin" />
                    Đang tìm chuyến tiện đường phù hợp...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Bắt Tay Ghép Chuyến Nhanh (1-Chạm)
                  </>
                )}
              </Button>

              {/* Kết quả ghép thành công */}
              {matchResult && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Đã tìm thấy chuyến xe tiện đường phù hợp nhất!
                    </span>
                    <Badge variant="success" size="sm" className="font-mono">
                      Khớp lộ trình: 100%
                    </Badge>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Car className="w-4 h-4 text-emerald-600" />
                        Chủ xe: {matchResult.cluster.driver.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {originHub?.shortName} ➔ {destHub?.shortName}
                      </p>
                    </div>
                    <span className="text-sm font-mono font-bold text-emerald-600">
                      {matchResult.finalPrice.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="success"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-4 py-2"
                      onClick={() => {
                        onShowToast?.('Đã chốt ghép chuyến thành công! Vui lòng trao đổi Zalo văn minh.', 'success');
                        if (matchResult.cluster.driver.raw && onOpenBooking) {
                          onOpenBooking(matchResult.cluster.driver.raw);
                        }
                        setMatchResult(null);
                      }}
                    >
                      ✓ Xác nhận bắt tay 1-chạm
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* CHẾ ĐỘ 2: TÌM KIẾM THỦ CÔNG & BỘ LỌC HÀNH LANG TRUYỀN THỐNG */}
        {/* ══════════════════════════════════════════════════════════ */}
        {heroMode === 'manual' && (
          <div className="pt-1 max-w-4xl mx-auto w-full relative z-40 animate-in fade-in">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-zinc-800 shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all text-left">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                {/* Điểm xuất phát */}
                <div className="relative flex-1 flex items-center min-w-0 px-3 sm:px-3.5 py-1.5 rounded-xl bg-[#f5f5f7] dark:bg-zinc-800/80 border border-black/[0.04] dark:border-zinc-700">
                  <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 flex items-center justify-center shrink-0 mr-2">
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

                {/* Nút đảo chiều */}
                <button
                  type="button"
                  onClick={handleSwapManual}
                  title="Đổi chiều điểm đi / điểm đến"
                  aria-label="Đổi chiều điểm đi / điểm đến"
                  className="self-center w-7 h-7 sm:w-8 sm:h-8 -my-1 sm:my-0 rounded-full border border-black/[0.08] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[#515154] hover:text-[#0071e3] inline-flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-90 active:rotate-180 transition-all z-10"
                >
                  <ArrowLeftRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>

                {/* Điểm đến */}
                <div className="relative flex-1 flex items-center min-w-0 px-3 sm:px-3.5 py-1.5 rounded-xl bg-[#f5f5f7] dark:bg-zinc-800/80 border border-black/[0.04] dark:border-zinc-700">
                  <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 flex items-center justify-center shrink-0 mr-2">
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

                {/* Nút Tìm kiếm */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5 sm:pt-0">
                  {hasSearch && (
                    <button
                      type="button"
                      onClick={handleClearAll}
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
                    className="h-10 sm:h-11 w-full sm:w-auto px-5 sm:px-6 rounded-xl font-bold text-sm bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Search className="w-4 h-4" />
                    <span>Lọc Danh Sách</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Chip các tuyến phổ biến */}
            <div className="pt-2 flex items-center justify-start md:justify-center gap-1.5 overflow-x-auto no-scrollbar py-1">
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
                      className="h-7 px-3 text-xs font-medium cursor-pointer shrink-0"
                    >
                      {label}
                    </Chip>
                  );
                })}
              </div>

              <span className="h-4 w-px bg-black/[0.1] dark:bg-white/[0.1] shrink-0 mx-1" />

              <button
                type="button"
                onClick={handleToggleParcel}
                className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium cursor-pointer transition-all shrink-0 ${
                  isParcelActive
                    ? 'bg-amber-500/15 text-amber-900 border border-amber-400/60 font-semibold'
                    : 'bg-white dark:bg-zinc-800 text-[#515154] border border-black/[0.08] dark:border-zinc-700'
                }`}
              >
                <Truck className="w-3.5 h-3.5 text-amber-600" />
                <span>🛻 Gửi đồ / Bán tải</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
