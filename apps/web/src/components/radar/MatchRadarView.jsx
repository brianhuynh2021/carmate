import React, { useState, useEffect, useMemo } from 'react';
import {
  Car, Users, Sparkles, CheckCircle2,
  MapPin, Clock, ArrowRight, ShieldCheck, Phone, Zap
} from 'lucide-react';
import { ROUTE_BENCHMARKS, formatVND, getZaloChatUrl, cleanPhoneNumber } from '@carmate/shared';
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

  // Danh sách duyệt thủ công (Fallback & Direct Browse)
  const manualList = useMemo(() => {
    const source = userRole === 'driver' ? passengerRequests : driverOffers;
    return selectedRouteKey === 'all'
      ? source
      : source.filter((i) => i.routeCategory === selectedRouteKey);
  }, [userRole, selectedRouteKey, driverOffers, passengerRequests]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <SectionHeader
        icon={Sparkles}
        title="Ghép Tiện Tuyến Thông Minh"
        description="Tự động tìm kiếm chủ xe và hành khách cùng lộ trình, tối ưu chi phí & thời gian"
        action={
          <Badge tone="primary" icon={Zap} className="h-7 px-2.5 font-semibold">
            Tự Động Kết Nối
          </Badge>
        }
      />

      {/* Điều khiển Radar */}
      <div className="surface p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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

          <Field label="Tuyến hành lang quốc lộ">
            <Select value={selectedRouteKey} onChange={(e) => setSelectedRouteKey(e.target.value)}>
              <option value="all">Tất cả các tuyến quốc lộ</option>
              {routeKeys.map((key) => (
                <option key={key} value={key}>{ROUTE_BENCHMARKS[key].shortName}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Nút chuyển ngữ cảnh chỉ hiện khi duyệt thủ công */}
        {radarMode === 'manual' && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bạn đang tìm kiếm với tư cách:</span>
            <div className="inline-flex gap-2">
              <button
                type="button"
                onClick={() => setUserRole('passenger')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  userRole === 'passenger'
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Tôi là Khách (tìm Chủ xe)
              </button>
              <button
                type="button"
                onClick={() => setUserRole('driver')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  userRole === 'driver'
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
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
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Các Cặp Ghép Tối Ưu Nhất</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold tabular">
                {matches.length}
              </span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Phù hợp theo tuyến, giờ & số ghế</span>
          </div>

          {loading ? (
            <div className="surface p-12 rounded-3xl text-center text-sm text-slate-500 animate-pulse">
              Đang tìm các cặp chuyến cùng lộ trình...
            </div>
          ) : matches.length === 0 ? (
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
              {matches.map((match) => {
                const isPerfect = match.score >= 90;
                const driver = match.driver;
                const passenger = match.passenger;

                return (
                  <article
                    key={match.pairId}
                    className="surface p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-primary-300 dark:hover:border-primary-700 transition-all space-y-4"
                  >
                    {/* Header Điểm Tương Thích */}
                    <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 dark:border-slate-800 pb-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold tabular shadow-xs ${
                          isPerfect
                            ? 'bg-emerald-500 text-white'
                            : 'bg-primary-600 text-white'
                        }`}>
                          {match.score}% PHÙ HỢP
                        </span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {match.routeCategory}
                        </span>
                      </div>

                      {/* Lý do ghép */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {match.reasons?.map((reason, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>{reason}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Khung 2 Bên: Chủ Xe <-> Hành Khách */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Cột Chủ Xe */}
                      <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/80 dark:border-blue-900/40 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5" />
                            <span>Chủ Xe Gia Đình</span>
                          </span>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular">
                            {driver.availableSeats} chỗ trống
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-900 dark:text-white text-sm">
                            {driver.publicName}
                          </p>
                          {onViewTrustProfile && (
                            <button
                              type="button"
                              onClick={() => onViewTrustProfile(driver)}
                              className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                            >
                              Xem tín nhiệm
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {driver.from} ➔ {driver.to}
                        </p>
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="text-slate-500 tabular">Khung giờ: {driver.timeSlotLabel}</span>
                          <span className="font-extrabold text-primary-700 dark:text-primary-300 tabular">
                            ~{formatVND(driver.basePricePerSeat)}/ghế
                          </span>
                        </div>
                      </div>

                      {/* Cột Hành Khách */}
                      <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/80 dark:border-amber-900/40 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            <span>Hành Khách Tiện Đường</span>
                          </span>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular">
                            Cần {passenger.seatsNeeded} ghế
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">
                          {passenger.publicName}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {passenger.from} ➔ {passenger.to}
                        </p>
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="text-slate-500 tabular">Khung giờ: {passenger.timeSlotLabel}</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 tabular">
                            {passenger.notes?.slice(0, 32)}...
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

                      <Button
                        size="sm"
                        onClick={() => onBook(driver)}
                        className="font-semibold"
                      >
                        Ghép Chuyến Ngay
                      </Button>
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
                <article key={item.id} className="surface p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {item.routeCategory}
                    </span>
                    <span className="text-xs font-bold text-primary-700 dark:text-primary-300 tabular">
                      {item.timeSlotLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {item.publicName} ({item.hometown || 'Đồng hương'})
                    </p>
                    {onViewTrustProfile && (
                      <button
                        type="button"
                        onClick={() => onViewTrustProfile(item)}
                        className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                      >
                        Xem tín nhiệm
                      </button>
                    )}
                  </div>

                  <RouteTimeline from={item.from} to={item.to} compact />

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular">
                      {formatVND(item.basePricePerSeat || item.expectedPrice)}
                      <span className="text-xs font-normal text-slate-500">/ghế</span>
                    </span>

                    <Button size="sm" onClick={() => onBook(item)}>
                      {userRole === 'driver' ? 'Nhận Đón Khách' : 'Ghép Xe'}
                    </Button>
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
