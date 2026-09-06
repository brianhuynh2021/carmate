import React, { useState, useEffect, useMemo } from 'react';
import {
  Car, Users, Sparkles, CheckCircle2,
  MapPin, Clock, ArrowRight, ShieldCheck, Phone, Zap
} from 'lucide-react';
import { ROUTE_BENCHMARKS, formatVND, getZaloChatUrl, cleanPhoneNumber, isTripExpired } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import { Segmented } from '../ui/Chip.jsx';
import { Field, Select } from '../ui/Field.jsx';
import Button from '../ui/Button.jsx';
import Badge, { Avatar } from '../ui/Badge.jsx';
import EmptyState, { SectionHeader } from '../ui/EmptyState.jsx';
import { RouteTimeline } from '../market/TripCard.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';
import api from '../../api/client.js';

export default function MatchRadarView({ driverOffers = [], passengerRequests = [], onBook, onViewTrustProfile }) {
  const { t, lang } = useI18n();
  const [radarMode, setRadarMode] = useState('smart'); // 'smart' | 'manual'
  const [userRole, setUserRole] = useState('passenger'); // 'driver' | 'passenger'
  const [selectedRouteKey, setSelectedRouteKey] = useState('all');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

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
    return () => { active = false; };
  }, [selectedRouteKey]);

  // Lọc chỉ giữ các cặp ghép còn hạn chạy
  const validMatches = useMemo(() => {
    return matches.filter((m) => !isTripExpired(m.driver) && !isTripExpired(m.passenger));
  }, [matches]);

  // Danh sách duyệt thủ công (Fallback & Direct Browse) loại bỏ chuyến quá giờ
  const manualList = useMemo(() => {
    const source = (userRole === 'driver' ? passengerRequests : driverOffers).filter((i) => !isTripExpired(i));
    return selectedRouteKey === 'all'
      ? source
      : source.filter((i) => i.routeCategory === selectedRouteKey);
  }, [userRole, selectedRouteKey, driverOffers, passengerRequests]);

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

      {/* Điều khiển Radar */}
      <div className="surface p-4 sm:p-5 rounded-3xl border border-black/[0.08] space-y-4 shadow-[0_2px_16px_rgba(0,0,0,0.03)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">
              Chế độ tìm kiếm
            </p>
            <Segmented
              fullWidth
              value={radarMode}
              onChange={setRadarMode}
              options={[
                { value: 'smart', label: 'Ghép Tiện Tuyến', icon: Sparkles },
                { value: 'manual', label: 'Duyệt Theo Nhu Cầu', icon: Users }
              ]}
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">
              Tuyến hành lang quốc lộ
            </p>
            <Select value={selectedRouteKey} onChange={(e) => setSelectedRouteKey(e.target.value)}>
              <option value="all">Tất cả các tuyến quốc lộ</option>
              {routeKeys.map((key) => (
                <option key={key} value={key}>{ROUTE_BENCHMARKS[key].shortName}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Nút chuyển ngữ cảnh chỉ hiện khi duyệt thủ công */}
        {radarMode === 'manual' && (
          <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-[#86868b] font-medium">Bạn đang tìm kiếm với tư cách:</span>
            <div className="inline-flex gap-1.5 p-1 rounded-full bg-[#e8e8ed]/90 border border-black/[0.04]">
              <button
                type="button"
                onClick={() => setUserRole('passenger')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  userRole === 'passenger'
                    ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-bold'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                Tôi là Khách (tìm Chủ xe)
              </button>
              <button
                type="button"
                onClick={() => setUserRole('driver')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  userRole === 'driver'
                    ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-bold'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                Tôi là Chủ xe (tìm Khách ghép)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── CHẾ ĐỘ 1: RADAR KHỚP TỰ ĐỘNG (SMART PAIR MATCHING) ── */}
      {radarMode === 'smart' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-[#1d1d1f] flex items-center gap-2">
              <span>Các Cặp Ghép Tối Ưu Nhất</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20 font-bold tabular">
                {validMatches.length}
              </span>
            </h3>
            <span className="text-xs text-[#86868b]">Khớp lệnh tiện tuyến & cùng giờ</span>
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
                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold tabular shadow-xs ${
                          isPerfect
                            ? 'bg-[#107c41] text-white'
                            : 'bg-[#0071e3] text-white'
                        }`}>
                          {match.score}% PHÙ HỢP
                        </span>
                        <span className="text-xs font-semibold text-[#1d1d1f]">
                          {match.routeCategory}
                        </span>
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

                    {/* Khung 2 Bên: Chủ Xe <-> Hành Khách */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Cột Chủ Xe */}
                      <div className="p-4 rounded-2xl bg-[#0071e3]/[0.03] border border-[#0071e3]/15 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#0071e3] uppercase tracking-wider flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5" />
                            <span>Chủ Xe Gia Đình</span>
                          </span>
                          <span className="text-xs font-semibold text-[#515154] tabular">
                            {driver.availableSeats} chỗ trống
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-[#1d1d1f] text-sm">
                            {driver.publicName}
                          </p>
                          {onViewTrustProfile && (
                            <button
                              type="button"
                              onClick={() => onViewTrustProfile(driver)}
                              className="text-[11px] font-semibold text-[#0071e3] hover:underline cursor-pointer"
                            >
                              Xem tín nhiệm
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-[#515154]">
                          {driver.from} ➔ {driver.to}
                        </p>
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="text-[#86868b] tabular">
                            Khung giờ: {driver.timeSlot || driver.timeSlotLabel || 'Thoả thuận'}
                          </span>
                          <span className="font-extrabold text-[#0071e3] tabular">
                            ~{formatVND(driver.basePricePerSeat)}/ghế
                          </span>
                        </div>
                      </div>

                      {/* Cột Hành Khách */}
                      <div className="p-4 rounded-2xl bg-[#ff9500]/[0.04] border border-[#ff9500]/20 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#b25e00] uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            <span>Hành Khách Tiện Đường</span>
                          </span>
                          <span className="text-xs font-semibold text-[#515154] tabular">
                            Cần {passenger.seatsNeeded || 1} ghế
                          </span>
                        </div>
                        <p className="font-bold text-[#1d1d1f] text-sm">
                          {passenger.publicName}
                        </p>
                        <p className="text-xs text-[#515154]">
                          {passenger.from} ➔ {passenger.to}
                        </p>
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="text-[#86868b] tabular">
                            Khung giờ: {passenger.timeSlot || passenger.timeSlotLabel || 'Thoả thuận'}
                          </span>
                          <span className="font-semibold text-[#515154] tabular">
                            {passenger.notes?.slice(0, 32) || 'Cần xe tiện chuyến'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Nút Thao Tác Chốt Kèo Văn Minh */}
                    <div className="pt-2 flex items-center justify-end gap-3">
                      <a
                        href={getZaloChatUrl(
                          driver.phoneReal,
                          `Chào anh ${driver.publicName}, hệ thống CarMate vừa gợi ý kết nối chuyến xe tiện đường của anh và bạn ${passenger.publicName} trên tuyến ${match.routeCategory}. Mình trao đổi nhé!`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0068ff]/10 text-[#0068ff] hover:bg-[#0068ff]/20 transition-colors cursor-pointer"
                      >
                        <ZaloIcon className="w-4 h-4" />
                        <span>Nhắn Zalo Chủ Xe</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => onBook(driver)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0071e3] text-white hover:bg-[#0077ed] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <span>Ghép Chuyến Ngay</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
                <article key={item.id} className="surface p-5 rounded-3xl border border-black/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.03)] space-y-3.5 hover:border-[#0071e3]/30 transition-all">
                  {/* Hàng Tiêu Đề Thẻ Vé */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-slate-800 text-[#1d1d1f] dark:text-slate-200 border border-black/[0.04]">
                      {item.routeCategory || 'Tuyến liên tỉnh'}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0071e3] tabular">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{item.date || 'Hôm nay'} · {item.timeSlot || item.timeSlotLabel || '07:00 – 08:00'}</span>
                    </div>
                  </div>

                  {/* Thông tin đối tác */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-bold text-xs flex items-center justify-center border border-[#0071e3]/20 shrink-0">
                        {(item.publicName || 'T')[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-900 dark:text-white text-sm truncate">
                            {item.publicName}
                          </p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 shrink-0">
                            98đ
                          </span>
                        </div>
                        <p className="text-[11px] text-[#86868b] truncate">
                          {item.hometown || 'Đồng hương'} · {item.carType || 'Xe 7 chỗ'} (Còn {item.availableSeats || 1} ghế)
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
