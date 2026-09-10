import React, { useState, useEffect, useMemo } from 'react';
import {
  Car,
  Users,
  Sparkles,
  Clock,
  ArrowRight,
  Radio,
  Star,
  CheckCircle2,
  MapPin,
  Navigation,
  ShieldCheck,
  Zap
} from 'lucide-react';
import {
  ROUTE_BENCHMARKS,
  formatVND,
  isTripExpired,
  formatCleanDateLabel,
  getTimeSlotLabel,
  parseLocation,
  toPublicAlias,
  getUserOnlineStatus
} from '@carmate/shared';
import { Select } from '../ui/Field.jsx';
import Button from '../ui/Button.jsx';
import EmptyState, { SectionHeader } from '../ui/EmptyState.jsx';
import { RouteTimeline, getCarDisplay } from '../market/TripCard.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';
import PresenceDot from '../ui/PresenceDot.jsx';
import api from '../../api/client.js';

export default function MatchRadarView({
  driverOffers = [],
  passengerRequests = [],
  onBook,
  onViewTrustProfile,
  onViewRoute,
  onShowToast
}) {
  const [radarMode, setRadarMode] = useState('smart'); // 'smart' | 'manual'
  const [userRole, setUserRole] = useState('passenger'); // 'passenger' | 'driver'
  const [selectedRouteKey, setSelectedRouteKey] = useState('all');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRadarWatcherActive, setIsRadarWatcherActive] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('carmate_radar_watcher_active_v1') === 'true';
  });

  const handleToggleRadarWatcher = () => {
    const next = !isRadarWatcherActive;
    setIsRadarWatcherActive(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('carmate_radar_watcher_active_v1', String(next));
    }
    if (next) {
      onShowToast?.('📡 Radar tự động đã kích hoạt! Hệ thống đang theo dõi các chuyến cùng tuyến.');
    } else {
      onShowToast?.('Đã tạm dừng Radar Săn Xe.');
    }
  };

  const routeKeys = Object.keys(ROUTE_BENCHMARKS);

  // Tải các cặp ghép thông minh từ Backend Matching Engine
  useEffect(() => {
    let active = true;
    async function fetchSmartMatches() {
      setLoading(true);
      try {
        const res = await api.getMatches({
          routeCategory: selectedRouteKey !== 'all' ? selectedRouteKey : undefined
        });
        if (active && res?.success && res?.data?.matches) {
          setMatches(res.data.matches);
        }
      } catch (err) {
        console.warn('Lỗi tải radar matches:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchSmartMatches();
    return () => {
      active = false;
    };
  }, [selectedRouteKey]);

  // Lọc chỉ giữ các cặp ghép còn hạn chạy
  const validMatches = useMemo(() => {
    return matches.filter((m) => !isTripExpired(m.driver) && !isTripExpired(m.passenger));
  }, [matches]);

  // Cặp ghép tối ưu nhất (Autopilot High Match >= 85%)
  const topMatch = useMemo(() => {
    if (!validMatches || validMatches.length === 0) return null;
    const sorted = [...validMatches].sort((a, b) => (b.score || 0) - (a.score || 0));
    return sorted[0]?.score >= 85 ? sorted[0] : null;
  }, [validMatches]);

  // Danh sách duyệt thủ công (Fallback & Direct Browse) loại bỏ chuyến quá giờ
  const manualList = useMemo(() => {
    const source = (userRole === 'driver' ? passengerRequests : driverOffers).filter((i) => !isTripExpired(i));
    return selectedRouteKey === 'all' ? source : source.filter((i) => i.routeCategory === selectedRouteKey);
  }, [userRole, selectedRouteKey, driverOffers, passengerRequests]);

  // Đếm số lượng xe và khách còn hiệu lực
  const activeDriversCount = useMemo(() => driverOffers.filter((i) => !isTripExpired(i)).length, [driverOffers]);
  const activePassengersCount = useMemo(
    () => passengerRequests.filter((i) => !isTripExpired(i)).length,
    [passengerRequests]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* ── 1. SECTION HEADER CHUẨN APPLE ── */}
      <SectionHeader
        icon={Sparkles}
        title="Ghép Tiện Tuyến"
        description="Tự động kết nối xe trống và bạn đồng hành cùng lộ trình · Tiết kiệm chi phí lăn bánh"
      />

      {/* ── 2. APPLE AMBIENT RADAR CAPSULE (MỀM MẠI, KÍNH MỜ, KHÔNG GÂY CĂNG THẲNG) ── */}
      <div className="p-3.5 sm:p-4 rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              isRadarWatcherActive
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}
          >
            <Radio className={`w-4 h-4 ${isRadarWatcherActive ? 'animate-pulse' : ''}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white tracking-tight">
                Radar Săn Chuyến Tự Động
              </h4>
              {isRadarWatcherActive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Đang quét
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {isRadarWatcherActive
                ? `Đang theo dõi tự động: ${selectedRouteKey === 'all' ? 'Tất cả các tuyến' : ROUTE_BENCHMARKS[selectedRouteKey]?.shortName || selectedRouteKey}`
                : 'Bật để hệ thống tự động thông báo bạn đồng hành phù hợp mà không cần tải lại trang'}
            </p>
          </div>
        </div>

        {/* iOS Style Switch Button */}
        <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto shrink-0 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-black/[0.04] dark:border-white/[0.04]">
          {isRadarWatcherActive && validMatches.length > 0 && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular font-mono">
              {validMatches.length} cặp phù hợp
            </span>
          )}
          <button
            type="button"
            onClick={handleToggleRadarWatcher}
            className={`relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              isRadarWatcherActive ? 'bg-[#107c41]' : 'bg-slate-300 dark:bg-slate-700'
            }`}
            role="switch"
            aria-checked={isRadarWatcherActive}
            title={isRadarWatcherActive ? 'Tắt Radar Săn Xe' : 'Bật Radar Săn Xe'}
          >
            <span
              className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                isRadarWatcherActive ? 'translate-x-5.5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* ── 3. APPLE LIQUID ROLE SWITCHER (MƯỢT MÀ NHƯ LƯỚT SÓNG) ── */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#ebebed] dark:bg-slate-900 border border-black/[0.04] dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => setUserRole('passenger')}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${
              userRole === 'passenger'
                ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Tôi Cần Tìm Xe</span>
            <span
              className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-bold tabular transition-colors ${
                userRole === 'passenger'
                  ? 'bg-[#0071e3]/10 text-[#0071e3]'
                  : 'bg-black/[0.05] dark:bg-white/[0.06] text-slate-500'
              }`}
            >
              {activeDriversCount} xe
            </span>
          </button>

          <button
            type="button"
            onClick={() => setUserRole('driver')}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${
              userRole === 'driver'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Tôi Có Xe Trống</span>
            <span
              className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-bold tabular transition-colors ${
                userRole === 'driver'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-black/[0.05] dark:bg-white/[0.06] text-slate-500'
              }`}
            >
              {activePassengersCount} khách
            </span>
          </button>
        </div>

        {/* Thanh lọc chế độ xem & tuyến */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1 text-xs">
          <div className="inline-flex p-0.5 rounded-full bg-[#f0f0f2] dark:bg-slate-900 border border-black/[0.04] dark:border-white/[0.06] w-fit">
            <button
              type="button"
              onClick={() => setRadarMode('smart')}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                radarMode === 'smart'
                  ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Gợi ý phù hợp</span>
            </button>
            <button
              type="button"
              onClick={() => setRadarMode('manual')}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                radarMode === 'manual'
                  ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Duyệt tất cả</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Tuyến:</span>
            <div className="relative w-full sm:w-56">
              <Select
                value={selectedRouteKey}
                onChange={(e) => setSelectedRouteKey(e.target.value)}
                className="h-8 text-xs font-medium pl-3 pr-7 rounded-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] shadow-2xs w-full"
              >
                <option value="all">Tất cả các tuyến</option>
                {routeKeys.map((key) => (
                  <option key={key} value={key}>
                    {ROUTE_BENCHMARKS[key]?.shortName || key}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. DANH SÁCH THẺ "APPLE FLUID MATCH CARD" ── */}
      {radarMode === 'smart' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.08] text-center text-xs sm:text-sm text-slate-400 flex flex-col items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span>Đang phân tích các cặp hành trình tương thích...</span>
            </div>
          ) : validMatches.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Chưa có cặp ghép tự động trên tuyến này"
              description="Hãy đăng chuyến đi của bạn để hệ thống tự động kết nối bạn đồng hành khi có người phù hợp."
              action={
                <Button variant="outline" size="sm" onClick={() => setSelectedRouteKey('all')}>
                  Xem tất cả các tuyến
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {/* ── AUTONOMOUS AUTOPILOT HIGH MATCH HIGHLIGHT (ELON MUSK ZERO-SEARCH) ── */}
              {topMatch && (
                <div className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#0071e3]/10 via-emerald-500/10 to-transparent border-2 border-[#0071e3]/40 dark:border-sky-500/40 shadow-[0_8px_30px_rgba(0,113,227,0.12)] space-y-3.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0071e3] text-white text-xs font-black tracking-wide shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 fill-current animate-pulse text-amber-300" />
                      <span>AUTOPILOT MATCH {topMatch.score}%</span>
                    </div>

                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Độ lệch đón chỉ ~0.8km · Thuận chiều 100%</span>
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <span className="truncate max-w-[42%]">
                          {parseLocation((userRole === 'passenger' ? topMatch.driver : topMatch.passenger).from).main}
                        </span>
                        <ArrowRight className="w-4 h-4 text-[#0071e3] shrink-0" />
                        <span className="truncate max-w-[42%]">
                          {parseLocation((userRole === 'passenger' ? topMatch.driver : topMatch.passenger).to).main}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                        {userRole === 'passenger' ? 'Chủ xe' : 'Người đi cùng'}:{' '}
                        <strong>{toPublicAlias(userRole === 'passenger' ? topMatch.driver : topMatch.passenger)}</strong>{' '}
                        · Khung giờ:{' '}
                        <strong>
                          {getTimeSlotLabel(userRole === 'passenger' ? topMatch.driver : topMatch.passenger).replace(
                            /\s*\([^)]*\)/g,
                            ''
                          )}
                        </strong>{' '}
                        · Phụ xăng:{' '}
                        <strong className="text-[#0071e3]">
                          {formatVND(
                            (userRole === 'passenger' ? topMatch.driver : topMatch.passenger).basePricePerSeat ||
                              (userRole === 'passenger' ? topMatch.driver : topMatch.passenger).expectedPrice ||
                              150000
                          )}
                        </strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onBook?.(userRole === 'passenger' ? topMatch.driver : topMatch.passenger)}
                      className="py-2.5 px-5 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-[#0071e3] to-[#005bb5] hover:from-[#0077ed] hover:to-[#0062c4] active:scale-95 text-white shadow-lg shadow-[#0071e3]/25 flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-all"
                    >
                      <Zap className="w-4 h-4 fill-current text-amber-300" />
                      <span>{userRole === 'passenger' ? 'Ghép chuyến ngay ⚡' : 'Đón khách này ngay ⚡'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {validMatches.map((match) => {
                const driver = match.driver;
                const passenger = match.passenger;
                // Đối tác hiển thị tùy theo vai trò người đang xem
                const targetTrip = userRole === 'passenger' ? driver : passenger;
                const isTargetDriver = userRole === 'passenger';
                const isPerfect = match.score >= 90;

                const fromParsed = parseLocation(targetTrip.from);
                const toParsed = parseLocation(targetTrip.to);

                const price =
                  targetTrip.basePricePerSeat ||
                  targetTrip.expectedPrice ||
                  targetTrip.suggestedContribution ||
                  150000;
                const seats = targetTrip.availableSeats || targetTrip.seatsNeeded || 1;
                const partnerName = toPublicAlias(targetTrip);
                const carDisplay = getCarDisplay(driver.carType, driver.capacity);
                const onlineStatus = getUserOnlineStatus(targetTrip);

                // Điểm đón gợi ý thông minh
                const pickupHint =
                  targetTrip.pickupSpot ||
                  targetTrip.waypointNote ||
                  driver.pickupSpot ||
                  driver.waypointNote ||
                  'Thuận đường đón trả trên trục chính';

                return (
                  <article
                    key={match.pairId}
                    onClick={() => (onViewRoute ? onViewRoute(targetTrip) : onBook?.(targetTrip))}
                    className="flex flex-col justify-between h-full relative overflow-hidden rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.08] hover:border-[#0071e3]/40 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,113,227,0.08)] hover:-translate-y-0.5 active:scale-[0.995] transition-all duration-200 cursor-pointer p-5 sm:p-5.5 gap-3.5 select-none group"
                  >
                    {/* ── DÒNG 1: % KHỚP LỘ TRÌNH · GIỜ & NGÀY ── */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tabular shadow-2xs ${
                            isPerfect
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80'
                              : 'bg-blue-50 dark:bg-blue-950/50 text-[#0071e3] border border-blue-200/80'
                          }`}
                        >
                          {match.score}% KHỚP
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-800 dark:text-white tabular">
                          {getTimeSlotLabel(targetTrip).replace(/\s*\([^)]*\)/g, '')}
                        </span>
                        <span className="text-[11.5px] text-slate-400 font-medium truncate">
                          · {formatCleanDateLabel(targetTrip.date)}
                        </span>
                      </div>

                      <PresenceDot isOnline={onlineStatus.isOnline} showLabel detail={onlineStatus.detail} />
                    </div>

                    {/* ── DÒNG 2: TRỤC LỘ TRÌNH NGANG CHUẨN DASHBOARD (KHÔNG ĐỨT GÃY) ── */}
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white pt-0.5">
                      <span className="text-[15.5px] font-bold tracking-tight truncate max-w-[43%]">
                        {fromParsed.main}
                      </span>
                      <div className="shrink-0 flex items-center px-0.5 text-slate-400 dark:text-slate-500 group-hover:text-[#0071e3] transition-colors">
                        <svg
                          className="w-7 h-3 text-current shrink-0 group-hover:translate-x-0.5 transition-transform duration-200"
                          viewBox="0 0 28 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M2 6h22.5M18.5 2.5L24.5 6L18.5 9.5" />
                        </svg>
                      </div>
                      <span className="text-[15.5px] font-bold tracking-tight truncate max-w-[43%]">
                        {toParsed.main}
                      </span>
                    </div>

                    {/* ── DÒNG 3: GIÁ XĂNG ĐÓNG GÓP & SỐ GHẾ TRỐNG ── */}
                    <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[19px] font-extrabold tracking-tight text-[#0071e3] tabular font-mono leading-none">
                          {formatVND(price)}
                        </span>
                        <span className="text-[11.5px] text-slate-400 font-medium">/ghế</span>
                      </div>

                      <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{isTargetDriver ? `Nhận ghép ${seats} ghế` : `Cần ghép ${seats} ghế`}</span>
                      </span>
                    </div>

                    {/* ── DÒNG 4: ĐIỂM ĐÓN THUẬN TIỆN (1 DÒNG GỢI Ý DUY NHẤT) ── */}
                    <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400 bg-[#f5f5f7] dark:bg-[#252528] px-3 py-1.5 rounded-xl truncate">
                      <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="truncate">Đón: {pickupHint}</span>
                    </div>

                    {/* ── DÒNG 5: ĐỐI TÁC, XE & NÚT HÀNH ĐỘNG 1-CHẠM ── */}
                    <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-2 mt-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewTrustProfile?.(targetTrip);
                        }}
                        className="flex items-center gap-2 min-w-0 text-left cursor-pointer group/partner"
                        title="Xem hồ sơ uy tín"
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0 ring-1 ring-black/5">
                          {partnerName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover/partner:text-[#0071e3] transition-colors">
                            {partnerName}
                          </p>
                          <p className="text-[10.5px] text-slate-400 truncate">
                            {isTargetDriver ? carDisplay : 'Người đi cùng'}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        {isTargetDriver ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onBook?.(driver);
                            }}
                            className="h-8.5 px-3.5 rounded-full text-xs font-bold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-xs active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Ghép chuyến</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onBook?.(passenger);
                            }}
                            className="h-8.5 px-3.5 rounded-full text-xs font-bold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-xs active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Đón khách này</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
        </div>
      )}

      {/* ── 5. CHẾ ĐỘ 2: DUYỆT TẤT CẢ DANH SÁCH (MANUAL LIST) ── */}
      {radarMode === 'manual' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {userRole === 'driver'
                ? `Danh sách người cần tìm xe (${manualList.length})`
                : `Danh sách Chủ xe có chuyến (${manualList.length})`}
            </h3>
            <span className="text-xs text-slate-400 font-medium">Trực tiếp liên hệ · 0đ phí sàn</span>
          </div>

          {manualList.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Chưa có chuyến phù hợp"
              description="Thử đổi tuyến khác hoặc quay lại xem các gợi ý ghép chuyến tự động."
              action={
                <Button variant="outline" size="sm" onClick={() => setSelectedRouteKey('all')}>
                  Xem tất cả các tuyến
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {manualList.map((item) => {
                const isDriver = item.type === 'driver_offer';
                const fromParsed = parseLocation(item.from);
                const toParsed = parseLocation(item.to);
                const price = item.basePricePerSeat || item.expectedPrice || item.price || 150000;
                const seats = item.availableSeats || item.seatsNeeded || 1;
                const partnerName = toPublicAlias(item);
                const carDisplay = getCarDisplay(item.carType, item.capacity);
                const onlineStatus = getUserOnlineStatus(item);

                return (
                  <article
                    key={item.id}
                    onClick={() => (onViewRoute ? onViewRoute(item) : onBook?.(item))}
                    className="flex flex-col justify-between h-full relative overflow-hidden rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.08] hover:border-[#0071e3]/40 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,113,227,0.08)] hover:-translate-y-0.5 active:scale-[0.995] transition-all duration-200 cursor-pointer p-5 gap-3.5 select-none group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white tabular">
                          {getTimeSlotLabel(item).replace(/\s*\([^)]*\)/g, '')}
                        </span>
                        <span className="text-[11.5px] text-slate-400 font-medium truncate">
                          · {formatCleanDateLabel(item.date)}
                        </span>
                      </div>
                      <PresenceDot isOnline={onlineStatus.isOnline} showLabel detail={onlineStatus.detail} />
                    </div>

                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <span className="text-[15.5px] font-bold tracking-tight truncate max-w-[43%]">
                        {fromParsed.main}
                      </span>
                      <div className="shrink-0 flex items-center px-0.5 text-slate-400 group-hover:text-[#0071e3] transition-colors">
                        <svg
                          className="w-7 h-3 text-current shrink-0 group-hover:translate-x-0.5 transition-transform duration-200"
                          viewBox="0 0 28 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M2 6h22.5M18.5 2.5L24.5 6L18.5 9.5" />
                        </svg>
                      </div>
                      <span className="text-[15.5px] font-bold tracking-tight truncate max-w-[43%]">
                        {toParsed.main}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[19px] font-extrabold tracking-tight text-[#0071e3] tabular font-mono leading-none">
                          {formatVND(price)}
                        </span>
                        <span className="text-[11.5px] text-slate-400 font-medium">/ghế</span>
                      </div>
                      <span className="text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">
                        {isDriver ? `Còn ${seats} chỗ` : `Cần ${seats} ghế`}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-2 mt-auto">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{partnerName}</p>
                        <p className="text-[10.5px] text-slate-400 truncate">
                          {isDriver ? carDisplay : 'Người đi cùng'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBook?.(item);
                        }}
                        className="h-8.5 px-3.5 rounded-full text-xs font-bold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-xs active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{userRole === 'driver' ? 'Nhận đón' : 'Ghép ngay'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
