import React, { useState, useEffect, useMemo } from 'react';
import { Car, Users, Sparkles, CheckCircle2, MapPin, Clock, ArrowRight, ShieldCheck, Phone, Zap, User, Radio, BellRing, Star } from 'lucide-react';
import { ROUTE_BENCHMARKS, formatVND, getZaloChatUrl, isTripExpired } from '@carmate/shared';
import { Segmented } from '../ui/Chip.jsx';
import { Field, Select } from '../ui/Field.jsx';
import Button from '../ui/Button.jsx';
import Badge, { Avatar } from '../ui/Badge.jsx';
import EmptyState, { SectionHeader } from '../ui/EmptyState.jsx';
import { RouteTimeline } from '../market/TripCard.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';
import api from '../../api/client.js';

export default function MatchRadarView({ driverOffers = [], passengerRequests = [], onBook, onViewTrustProfile, onShowToast }) {
  const [radarMode, setRadarMode] = useState('smart'); // 'smart' | 'manual'
  const [userRole, setUserRole] = useState('passenger'); // 'driver' | 'passenger'
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
      onShowToast?.('📡 Đã kích hoạt Radar AI Săn Xe 24/7! Hệ thống đang tự động giám sát các chuyến mới.');
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

  // Danh sách duyệt thủ công (Fallback & Direct Browse) loại bỏ chuyến quá giờ
  const manualList = useMemo(() => {
    const source = (userRole === 'driver' ? passengerRequests : driverOffers).filter((i) => !isTripExpired(i));
    return selectedRouteKey === 'all' ? source : source.filter((i) => i.routeCategory === selectedRouteKey);
  }, [userRole, selectedRouteKey, driverOffers, passengerRequests]);

  // Đếm số lượng xe và khách còn hiệu lực
  const activeDriversCount = driverOffers.filter((i) => !isTripExpired(i)).length;
  const activePassengersCount = passengerRequests.filter((i) => !isTripExpired(i)).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <SectionHeader
        icon={Sparkles}
        title="Ghép Chuyến Cùng Đường"
        description="Tự động tìm kiếm bạn đồng hành cùng lộ trình — chia sẻ chi phí xăng cộ và trò chuyện vui vẻ"
        action={
          <Badge tone="primary" icon={Zap} className="h-7 px-2.5 font-semibold">
            Tự Động Ghép
          </Badge>
        }
      />

      {/* ── AUTONOMOUS BACKGROUND RADAR: SĂN XE 24/7 (CURSOR AI AMBIENT AGENT) ── */}
      <div
        className={`p-4 sm:p-5 rounded-3xl border transition-all duration-300 relative overflow-hidden ${
          isRadarWatcherActive
            ? 'bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border-emerald-500/40 shadow-xl shadow-emerald-500/10'
            : 'bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white border-black/[0.08] dark:border-white/[0.08] shadow-xs'
        }`}
      >
        {isRadarWatcherActive && (
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            {/* Vòng quét sóng Radar phát xung (Apple Liquid Radar Wave) */}
            <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 shrink-0">
              {isRadarWatcherActive ? (
                <>
                  <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-60 pointer-events-none" />
                  <Radio className="w-6 h-6 text-emerald-400 relative z-10 animate-pulse" />
                </>
              ) : (
                <Radio className="w-6 h-6 text-slate-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm sm:text-base tracking-tight flex items-center gap-1.5">
                  <span>Radar AI Săn Xe 24/7</span>
                  {isRadarWatcherActive && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold tracking-wider uppercase border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Đang giám sát
                    </span>
                  )}
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-0.5 max-w-lg">
                {isRadarWatcherActive
                  ? `AI chạy ngầm giám sát tuyến "${selectedRouteKey === 'all' ? 'Tất cả các tuyến' : ROUTE_BENCHMARKS[selectedRouteKey]?.shortName}". Tự động rung chuông khi có chuyến mới phù hợp.`
                  : 'Kích hoạt để AI tự động quét chuyến mới liên tục, giải phóng bạn khỏi việc phải F5 trang liên tục.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end shrink-0">
            {isRadarWatcherActive && (
              <span className="text-xs font-bold text-emerald-400 tabular px-3 py-1 rounded-xl bg-white/5 border border-white/10 shrink-0">
                {validMatches.length} chuyến khớp
              </span>
            )}
            <button
              type="button"
              onClick={handleToggleRadarWatcher}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer inline-flex items-center justify-center gap-2 active:scale-95 shadow-md ${
                !isRadarWatcherActive ? 'w-full sm:w-auto' : 'flex-1 sm:flex-initial'
              } ${
                isRadarWatcherActive
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                  : 'bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-blue-500/25'
              }`}
            >
              {isRadarWatcherActive ? (
                <>
                  <BellRing className="w-3.5 h-3.5" />
                  <span>Tắt Radar</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Bật Radar Săn Xe</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── HERO MASTER ROLE SWITCH: VỊ TRÍ SỐ 1 CHO NGƯỜI DÙNG (APPLE HIG & STANFORD HCI) ── */}
      <div className="surface p-3 sm:p-4 rounded-3xl border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.04)] space-y-3.5 bg-gradient-to-b from-white to-[#fafafc]">
        {/* Label dẫn hướng tinh tế */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3]"></span>
            <span>Mục đích tìm kiếm của bạn</span>
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Chọn để hệ thống quét đúng đối tác</span>
        </div>

        {/* Cụm 2 Tab Hero chuẩn Apple Liquid Segmented */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-1.5 rounded-2xl bg-[#ebebed] border border-black/[0.04]">
          {/* TAB 1: TÔI CẦN ĐI XE (HÀNH KHÁCH) */}
          <button
            type="button"
            onClick={() => setUserRole('passenger')}
            className={`group relative p-3 sm:p-3.5 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-3.5 text-left ${
              userRole === 'passenger'
                ? 'bg-white text-slate-900 shadow-[0_3px_12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.05]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                userRole === 'passenger'
                  ? 'bg-[#0071e3] text-white shadow-sm scale-105'
                  : 'bg-white/80 text-slate-500 group-hover:bg-white group-hover:text-slate-700'
              }`}
            >
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className={`text-sm sm:text-base font-extrabold transition-colors ${
                    userRole === 'passenger' ? 'text-[#0071e3]' : 'text-slate-800'
                  }`}
                >
                  Tôi Cần Đi Xe
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold tabular transition-colors ${
                    userRole === 'passenger'
                      ? 'bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20'
                      : 'bg-black/[0.04] text-slate-500'
                  }`}
                >
                  {activeDriversCount} xe sẵn sàng
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate pt-0.5">
                Tìm Chủ xe có ghế trống cùng lộ trình
              </p>
            </div>
          </button>

          {/* TAB 2: TÔI CÓ XE TRỐNG (CHỦ XE) */}
          <button
            type="button"
            onClick={() => setUserRole('driver')}
            className={`group relative p-3 sm:p-3.5 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-3.5 text-left ${
              userRole === 'driver'
                ? 'bg-white text-slate-900 shadow-[0_3px_12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.05]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                userRole === 'driver'
                  ? 'bg-[#107c41] text-white shadow-sm scale-105'
                  : 'bg-white/80 text-slate-500 group-hover:bg-white group-hover:text-slate-700'
              }`}
            >
              <Car className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className={`text-sm sm:text-base font-extrabold transition-colors ${
                    userRole === 'driver' ? 'text-[#107c41]' : 'text-slate-800'
                  }`}
                >
                  Tôi Có Xe Trống
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold tabular transition-colors ${
                    userRole === 'driver'
                      ? 'bg-[#107c41]/10 text-[#107c41] border border-[#107c41]/20'
                      : 'bg-black/[0.04] text-slate-500'
                  }`}
                >
                  {activePassengersCount} khách tìm xe
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate pt-0.5">
                Đón khách ghép để chia sẻ chi phí xăng
              </p>
            </div>
          </button>
        </div>

        {/* Thanh Tùy Chọn Lọc Phụ (Apple Filter Pills Bar) */}
        <div className="pt-2 px-1 border-t border-black/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#86868b] font-semibold shrink-0">Chế độ xem:</span>
            <div className="inline-flex p-0.5 rounded-full bg-[#ebebed] border border-black/[0.04] max-w-full overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setRadarMode('smart')}
                className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                  radarMode === 'smart'
                    ? 'bg-white text-[#0071e3] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Ghép Tiện Tuyến (AI Radar)</span>
              </button>
              <button
                type="button"
                onClick={() => setRadarMode('manual')}
                className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                  radarMode === 'manual'
                    ? 'bg-white text-[#0071e3] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Tất Cả Danh Sách</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <span className="text-[#86868b] font-semibold whitespace-nowrap shrink-0">Hành lang:</span>
            <div className="relative flex-1 sm:w-60 min-w-0">
              <Select
                value={selectedRouteKey}
                onChange={(e) => setSelectedRouteKey(e.target.value)}
                className="h-8.5 text-xs font-medium pl-3 pr-8 rounded-full bg-white border border-slate-200 shadow-2xs w-full"
              >
                <option value="all">Tất cả các tuyến quốc lộ</option>
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

      {/* ── CHẾ ĐỘ 1: RADAR KHỚP TỰ ĐỘNG (SMART PAIR MATCHING) ── */}
      {radarMode === 'smart' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3">
            <h3 className="text-base font-bold text-[#1d1d1f] flex items-center gap-2">
              <span>
                {userRole === 'passenger' ? 'Các Chuyến Xe Chủ Xe Phù Hợp Nhất' : 'Các Hành Khách Cần Đi Cùng Tuyến'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20 font-bold tabular">
                {validMatches.length}
              </span>
            </h3>
            <span className="text-xs text-[#86868b]">
              {userRole === 'passenger' ? 'Ghép chuyến tiết kiệm chi phí' : 'Lấp đầy ghế trống tiện đường'}
            </span>
          </div>

          {loading ? (
            <div className="surface p-12 rounded-3xl text-center text-sm text-[#86868b] animate-pulse">
              Đang phân tích các cặp chuyến cùng lộ trình...
            </div>
          ) : validMatches.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Chưa có cặp ghép hoàn hảo trên tuyến này"
              description="Hãy đăng chuyến đi của bạn để hệ thống tự động kết nối bạn đồng hành khi có người phù hợp."
              action={
                <Button variant="outline" onClick={() => setSelectedRouteKey('all')}>
                  Xem tất cả các tuyến
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {validMatches.map((match) => {
                const isPerfect = match.score >= 90;
                const driver = match.driver;
                const passenger = match.passenger;

                return (
                  <article
                    key={match.pairId}
                    className="surface p-5 sm:p-6 rounded-3xl border border-black/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:border-[#0071e3]/40 transition-all space-y-4"
                  >
                    {/* Header Điểm Tương Thích */}
                    <div className="flex items-center justify-between gap-3 flex-wrap border-b border-black/[0.06] pb-3.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-extrabold tabular shadow-xs ${
                            isPerfect ? 'bg-[#107c41] text-white' : 'bg-[#0071e3] text-white'
                          }`}
                        >
                          {match.score}% PHÙ HỢP
                        </span>
                        <span className="text-xs font-semibold text-[#1d1d1f]">{match.routeCategory}</span>
                      </div>

                      {/* Lý do ghép */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {match.reasons?.map((reason, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-[#f5f5f7] border border-black/[0.04] text-[#515154]"
                          >
                            <CheckCircle2 className="w-3 h-3 text-[#107c41]" />
                            <span>{reason}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* NỘI DUNG THẺ THEO VAI TRÒ NGƯỜI XEM (FIRST-PERSON VIEW) */}
                    {userRole === 'passenger' ? (
                      /* KHI BẠN LÀ HÀNH KHÁCH -> HIỂN THỊ NỔI BẬT CHUYẾN CỦA CHỦ XE */
                      <div className="space-y-3">
                        <div className="p-4 sm:p-5 rounded-2xl bg-[#0071e3]/[0.03] border border-[#0071e3]/15 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#0071e3] uppercase tracking-wider flex items-center gap-1.5">
                              <Car className="w-4 h-4" />
                              <span>Chủ Xe Gia Đình</span>
                            </span>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 tabular">
                              {driver.availableSeats} chỗ trống
                            </span>
                          </div>

                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <p className="font-extrabold text-[#1d1d1f] text-base">{driver.publicName}</p>
                              <p className="text-xs text-[#515154] font-medium pt-0.5">
                                {driver.from} ➔ {driver.to}
                              </p>
                            </div>

                            {onViewTrustProfile && (
                              <button
                                type="button"
                                onClick={() => onViewTrustProfile(driver)}
                                className="text-xs font-semibold text-[#0071e3] hover:underline cursor-pointer flex items-center gap-1"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Xem tín nhiệm</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-[#0071e3]/10 text-xs">
                            <span className="text-[#86868b] tabular">
                              Khung giờ:{' '}
                              <strong className="text-slate-800 font-semibold">
                                {driver.timeSlot || driver.timeSlotLabel || 'Thoả thuận'}
                              </strong>
                            </span>
                            <span className="font-extrabold text-[#0071e3] text-sm tabular">
                              ~{formatVND(driver.basePricePerSeat)}/ghế
                            </span>
                          </div>
                        </div>

                        {/* Gợi ý ngữ cảnh đồng hành tinh tế */}
                        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-black/[0.04] text-[11.5px] text-[#86868b] flex items-center justify-between flex-wrap gap-1">
                          <span>
                            Nhu cầu của bạn:{' '}
                            <strong>
                              {passenger.from} ➔ {passenger.to}
                            </strong>{' '}
                            ({passenger.seatsNeeded || 1} ghế)
                          </span>
                          <span className="text-[#107c41] font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Cùng giờ xuất phát</span>
                          </span>
                        </div>

                        {/* DUY NHẤT 1 NÚT HÀNH ĐỘNG RÕ RÀNG */}
                        <div className="pt-2 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => onBook(driver)}
                            className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#0071e3] hover:bg-[#0055d4] text-white shadow-md active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <span>Ghép Chuyến Với Chủ Xe</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* KHI BẠN LÀ CHỦ XE -> HIỂN THỊ NỔI BẬT HÀNH KHÁCH CẦN ĐI */
                      <div className="space-y-3">
                        <div className="p-4 sm:p-5 rounded-2xl bg-[#ff9500]/[0.04] border border-[#ff9500]/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#b25e00] uppercase tracking-wider flex items-center gap-1.5">
                              <Users className="w-4 h-4" />
                              <span>Hành Khách Tiện Đường</span>
                            </span>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 tabular">
                              Cần {passenger.seatsNeeded || 1} ghế
                            </span>
                          </div>

                          <div>
                            <p className="font-extrabold text-[#1d1d1f] text-base">{passenger.publicName}</p>
                            <p className="text-xs text-[#515154] font-medium pt-0.5">
                              {passenger.from} ➔ {passenger.to}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-[#ff9500]/15 text-xs">
                            <span className="text-[#86868b] tabular">
                              Giờ đón:{' '}
                              <strong className="text-slate-800 font-semibold">
                                {passenger.timeSlot || passenger.timeSlotLabel || 'Thoả thuận'}
                              </strong>
                            </span>
                            <span className="text-xs text-[#515154] font-medium italic">
                              "{passenger.notes?.slice(0, 45) || 'Cần xe tiện chuyến đi cùng tuyến'}"
                            </span>
                          </div>
                        </div>

                        {/* Gợi ý ngữ cảnh đồng hành */}
                        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-black/[0.04] text-[11.5px] text-[#86868b] flex items-center justify-between flex-wrap gap-1">
                          <span>
                            Chuyến xe của bạn: <strong>{driver.publicName}</strong> ({driver.availableSeats} chỗ trống)
                          </span>
                          <span className="text-[#107c41] font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Thuận đường đón trả</span>
                          </span>
                        </div>

                        {/* DUY NHẤT 1 NÚT HÀNH ĐỘNG RÕ RÀNG CHO CHỦ XE */}
                        <div className="pt-2 flex items-center justify-end">
                          {getZaloChatUrl(
                            passenger.phoneReal || passenger.contactPhone,
                            `Chào bạn ${passenger.publicName}, mình là chủ xe CarMate có chuyến tiện đường qua ${passenger.from} đi ${passenger.to} lúc ${passenger.timeSlot || 'sáng mai'}. Mình còn ghế trống, bạn có muốn đi cùng xe không?`
                          ) ? (
                            <a
                              href={getZaloChatUrl(
                                passenger.phoneReal || passenger.contactPhone,
                                `Chào bạn ${passenger.publicName}, mình là chủ xe CarMate có chuyến tiện đường qua ${passenger.from} đi ${passenger.to} lúc ${passenger.timeSlot || 'sáng mai'}. Mình còn ghế trống, bạn có muốn đi cùng xe không?`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#0068ff] hover:bg-[#0055d4] text-white shadow-md active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <ZaloIcon className="w-4 h-4" />
                              <span>Nhận Đón Khách Này (Nhắn Zalo)</span>
                              <ArrowRight className="w-4 h-4" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onBook?.(passenger)}
                              title="Nhận chở khách này để mở khoá Zalo liên hệ"
                              className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#0068ff] hover:bg-[#0055d4] text-white shadow-md active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <ZaloIcon className="w-4 h-4" />
                              <span>Nhận Đón Khách Này</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CHẾ ĐỘ 2: DUYỆT THỦ CÔNG THEO VAI TRÒ ── */}
      {radarMode === 'manual' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {userRole === 'driver'
                ? `Danh sách Hành khách đang cần đi (${manualList.length})`
                : `Danh sách Chủ xe gia đình đang có chuyến (${manualList.length})`}
            </h3>
            <span className="text-xs text-[#86868b]">Minh bạch danh tính · Trực tiếp thoả thuận</span>
          </div>

          {manualList.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Chưa có chuyến phù hợp"
              description="Thử đổi tuyến quốc lộ hoặc xem các gợi ý tiện tuyến tự động."
              action={
                <Button variant="outline" onClick={() => setSelectedRouteKey('all')}>
                  Xem tất cả các tuyến
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {manualList.map((item) => (
                <article
                  key={item.id}
                  className="surface p-5 rounded-3xl border border-black/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.03)] space-y-3.5 hover:border-[#0071e3]/30 transition-all"
                >
                  {/* Hàng Tiêu Đề Thẻ Vé */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-slate-800 text-[#1d1d1f] dark:text-slate-200 border border-black/[0.04]">
                      {item.routeCategory || 'Tuyến liên tỉnh'}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0071e3] tabular">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {item.date || 'Hôm nay'} · {item.timeSlot || item.timeSlotLabel || '07:00 – 08:00'}
                      </span>
                    </div>
                  </div>

                  {/* Thông tin đối tác */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0071e3] to-[#5ac8fa] text-white flex items-center justify-center shadow-2xs ring-1 ring-[#0071e3]/20 shrink-0">
                        <User className="w-4 h-4 text-white" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{item.publicName}</p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 shrink-0 inline-flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            <span>5.0</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-[#86868b] truncate">
                          {item.hometown || 'Đồng hương'} · {item.carType || 'Xe du lịch 5-7 chỗ'} (Cần {item.availableSeats || 1}{' '}
                          người)
                        </p>
                      </div>
                    </div>

                    {onViewTrustProfile && (
                      <button
                        type="button"
                        onClick={() => onViewTrustProfile(item)}
                        className="text-[11px] font-semibold text-[#0071e3] hover:underline cursor-pointer shrink-0"
                      >
                        Xem tín nhiệm
                      </button>
                    )}
                  </div>

                  {/* Lộ trình đón trả */}
                  <div className="p-3 rounded-2xl bg-[#f5f5f7]/80 dark:bg-slate-800/40 border border-black/[0.04]">
                    <RouteTimeline from={item.from} to={item.to} compact />
                  </div>

                  {/* Footer Thẻ */}
                  <div className="pt-2 flex items-center justify-between border-t border-black/[0.05] dark:border-white/[0.06]">
                    <div>
                      <p className="text-[11px] text-[#86868b]">Chi phí phụ xăng</p>
                      <p className="text-base font-extrabold text-[#1d1d1f] dark:text-white tabular">
                        {formatVND(item.basePricePerSeat || item.expectedPrice || item.price || 150000)}
                        <span className="text-xs font-normal text-[#86868b]">/ghế</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onBook(item)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0071e3] text-white hover:bg-[#0077ed] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <span>{userRole === 'driver' ? 'Nhận Đón Khách' : 'Ghép Chuyến Ngay'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
