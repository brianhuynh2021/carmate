import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowUpDown, MapPin, Search, Clock, Car, Users, Loader2, ChevronDown } from 'lucide-react';
import {
  getActiveCorridors,
  getDefaultCorridor,
  getEndpointHubs,
  flipHeading,
  detectCorridorByCoords,
  getHubEndpoint,
  getFixedSegmentTariff,
  formatVND
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import api from '../../api/client.js';

const ROLE_KEY = 'carmate_last_movement_role';
const CORRIDOR_KEY = 'carmate_last_corridor';

/** Đọc localStorage an toàn (chế độ riêng tư / bị chặn đều không được ném lỗi). */
function readStore(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* bỏ qua: lưu tiện ích, không phải dữ liệu bắt buộc */
  }
}

/**
 * MÀN HÌNH CHÍNH: MỘT Ô TÌM KIẾM DUY NHẤT
 *
 * Nguyên tắc:
 * - Elon: xoá trước, tối ưu sau. Không còn Hero quảng cáo, không 2 thẻ vai trò,
 *   không băng lên lịch riêng. Người dùng vào là thấy đúng một việc cần làm.
 * - MIT: không nhánh if theo tuyến cứng. Mọi thứ đọc từ CORRIDORS registry,
 *   thêm tuyến mới là thêm một object dữ liệu.
 * - Cursor: giá và tuyến tính ngầm tại máy (<1ms), không thông báo, không chờ.
 * - Apple: một cột, squircle, phân tầng rõ, chạm được bằng ngón cái trên mobile.
 */
export default function CorridorSearchBoard({
  currentUser = null,
  onOpenCockpit,
  onOpenStationView,
  onOpenIntentModal
}) {
  const { t } = useI18n();
  const corridors = useMemo(() => getActiveCorridors(), []);

  // ── Hành lang đang xem ─────────────────────────────────────────────────
  const [corridorId, setCorridorId] = useState(() => {
    const saved = readStore(CORRIDOR_KEY);
    return corridors.some((c) => c.id === saved) ? saved : getDefaultCorridor().id;
  });
  const corridor = useMemo(
    () => corridors.find((c) => c.id === corridorId) || corridors[0],
    [corridors, corridorId]
  );

  // ── Chiều đi ───────────────────────────────────────────────────────────
  const [heading, setHeading] = useState('b_to_a'); // mặc định: từ tỉnh lên thành phố

  // ── Vai trò: TỰ ĐOÁN, vẫn đổi được ────────────────────────────────────
  const detectedRole = useMemo(() => {
    if (currentUser?.vehicle?.plate || currentUser?.role === 'driver') return 'driver';
    const saved = readStore(ROLE_KEY);
    if (saved === 'driver' || saved === 'passenger') return saved;
    return 'passenger';
  }, [currentUser]);

  const [role, setRole] = useState(detectedRole);
  useEffect(() => setRole(detectedRole), [detectedRole]);

  const switchRole = (next) => {
    setRole(next);
    writeStore(ROLE_KEY, next);
  };

  // ── Điểm đi / điểm đến ─────────────────────────────────────────────────
  const fromKey = heading === 'b_to_a' ? 'b' : 'a';
  const toKey = heading === 'b_to_a' ? 'a' : 'b';
  const fromHubs = useMemo(() => getEndpointHubs(corridor.id, fromKey), [corridor.id, fromKey]);
  const toHubs = useMemo(() => getEndpointHubs(corridor.id, toKey), [corridor.id, toKey]);

  const [fromHubId, setFromHubId] = useState('');
  const [toHubId, setToHubId] = useState('');

  // Giữ lựa chọn luôn hợp lệ khi đổi tuyến hoặc đảo chiều
  useEffect(() => {
    if (!fromHubs.some((h) => h.id === fromHubId)) setFromHubId(fromHubs[0]?.id || '');
  }, [fromHubs, fromHubId]);
  useEffect(() => {
    if (!toHubs.some((h) => h.id === toHubId)) setToHubId(toHubs[0]?.id || '');
  }, [toHubs, toHubId]);

  // ── Trí tuệ bản địa: tự chọn tuyến + chiều theo GPS, im lặng ──────────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const guessed = detectCorridorByCoords(latitude, longitude);
        if (!guessed) return;
        setCorridorId(guessed.id);
        writeStore(CORRIDOR_KEY, guessed.id);

        // Đứng ở đầu nào thì mặc định đi từ đầu đó
        let nearest = null;
        let best = Infinity;
        for (const h of getEndpointHubs(guessed.id, 'a').concat(getEndpointHubs(guessed.id, 'b'))) {
          const d = (h.lat - latitude) ** 2 + (h.lng - longitude) ** 2;
          if (d < best) {
            best = d;
            nearest = h;
          }
        }
        if (nearest) {
          const ep = getHubEndpoint(guessed.id, nearest.id);
          if (ep) setHeading(ep === 'a' ? 'a_to_b' : 'b_to_a');
        }
      },
      () => {
        /* từ chối GPS: giữ nguyên mặc định, không làm phiền */
      },
      { timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  // ── Giá tính NGẦM tại máy, không thông báo ────────────────────────────
  const tariff = useMemo(() => {
    if (!fromHubId || !toHubId) return null;
    try {
      return getFixedSegmentTariff(fromHubId, toHubId, corridor.dataKey);
    } catch {
      return null;
    }
  }, [fromHubId, toHubId, corridor.dataKey]);

  // ── Tìm chuyến ─────────────────────────────────────────────────────────
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);

  const handleSearchNow = useCallback(async () => {
    if (!fromHubId || !toHubId) return;
    setIsSearching(true);
    setResults(null);
    try {
      const res = await api.getTrips({
        corridor: corridor.dataKey,
        limit: 20,
        type: role === 'driver' ? 'passenger' : 'driver'
      });
      setResults(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [fromHubId, toHubId, corridor.dataKey, role]);

  const swap = () => setHeading((h) => flipHeading(h));

  const hubLabel = (h) => h.shortName || h.name;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in pb-10">
      {/* ── CHỌN TUYẾN (chỉ hiện khi có nhiều hơn 1 tuyến) ── */}
      {corridors.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {corridors.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCorridorId(c.id);
                writeStore(CORRIDOR_KEY, c.id);
              }}
              className={`shrink-0 px-3.5 h-9 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                c.id === corridor.id
                  ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-[#0071e3]/50 hover:text-[#0071e3] hover:shadow-xs'
              }`}
            >
              {c.shortName}
              {c.status === 'beta' && (
                <span className="ml-1.5 text-[9px] font-mono opacity-70 uppercase">beta</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Ô TÌM KIẾM DUY NHẤT ── */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] shadow-sm overflow-hidden">
        {/* Điểm đi */}
        <div className="p-4 sm:p-5 flex items-center gap-3">
          <MapPin className="w-5 h-5 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-0.5">
              {t('search.from')}
            </label>
            <div>
              <select
                value={fromHubId}
                onChange={(e) => setFromHubId(e.target.value)}
                className="w-full appearance-none bg-transparent text-base font-bold text-slate-900 dark:text-white outline-none cursor-pointer truncate"
              >
                {fromHubs.map((h) => (
                  <option key={h.id} value={h.id} className="bg-white dark:bg-slate-900">
                    {hubLabel(h)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Đảo chiều.
            Nút nổi trên đường kẻ nên phải tự tách mình khỏi nền: vòng viền trắng
            (ring) cắt đường kẻ chạy qua phía sau, tránh cảm giác bị dính vào vạch.
            Vùng chạm 44px theo Apple HIG (icon vẫn 14px), và hover phải đổi CẢ nền
            lẫn viền — chỉ đổi màu icon thì gần như không thấy gì. */}
        <div className="relative h-px bg-slate-100 dark:bg-white/[0.06] mx-4 sm:mx-5">
          <button
            type="button"
            onClick={swap}
            aria-label={t('search.swap')}
            title={t('search.swap')}
            className="group absolute right-0 -top-[22px] w-11 h-11 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 ring-4 ring-white dark:ring-slate-900 shadow-sm flex items-center justify-center text-slate-500 hover:bg-[#0071e3] hover:border-[#0071e3] hover:text-white hover:shadow-md focus-visible:bg-[#0071e3] focus-visible:text-white active:scale-90 transition-all duration-150 cursor-pointer"
          >
            <ArrowUpDown className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" />
          </button>
        </div>

        {/* Điểm đến */}
        <div className="p-4 sm:p-5 flex items-center gap-3">
          <MapPin className="w-5 h-5 text-[#0071e3] shrink-0" />
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-0.5">
              {t('search.to')}
            </label>
            <div>
              <select
                value={toHubId}
                onChange={(e) => setToHubId(e.target.value)}
                className="w-full appearance-none bg-transparent text-base font-bold text-slate-900 dark:text-white outline-none cursor-pointer truncate"
              >
                {toHubs.map((h) => (
                  <option key={h.id} value={h.id} className="bg-white dark:bg-slate-900">
                    {hubLabel(h)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Nút chính */}
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <button
            type="button"
            onClick={handleSearchNow}
            disabled={isSearching || !fromHubId || !toHubId}
            className="w-full h-13 min-h-[52px] rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] hover:shadow-lg hover:shadow-[#0071e3]/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#0071e3] disabled:hover:shadow-md text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#0071e3]/25 active:scale-[0.99] transition-all duration-150 cursor-pointer"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>{isSearching ? t('search.searching') : t('search.findNow')}</span>
          </button>

          {/* Giá hiện lặng lẽ dưới nút — kết quả, không phải thông báo */}
          {tariff && (
            <p className="mt-2.5 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
              {formatVND(tariff.pricePerSeat)} · {tariff.distanceKm}km · {t('search.allInclusive')}
            </p>
          )}
        </div>
      </section>

      {/* ── LỐI RẼ: ĐẶT CHO LÚC KHÁC (khớp lệnh) ── */}
      <button
        type="button"
        onClick={() => onOpenIntentModal?.(role, fromHubId)}
        className="group w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-3 hover:bg-white dark:hover:bg-white/[0.07] hover:border-[#0071e3]/50 hover:shadow-sm active:scale-[0.99] transition-all duration-150 cursor-pointer text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {t('search.scheduleTitle')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {t('search.scheduleDesc')}
            </p>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 -rotate-90 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#0071e3]" />
      </button>

      {/* ── KẾT QUẢ ── */}
      {results !== null && (
        <section className="space-y-2.5">
          {results.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] text-center space-y-2.5">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('search.emptyTitle')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('search.emptyDesc')}</p>
              <button
                type="button"
                onClick={() => onOpenIntentModal?.(role, fromHubId)}
                className="mt-1 h-11 px-5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] hover:shadow-md text-white text-xs font-bold cursor-pointer active:scale-[0.98] transition-all duration-150"
              >
                {t('search.emptyCta')}
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs font-mono text-slate-400 px-1">
                {t('search.resultCount', { count: results.length })}
              </p>
              {results.map((trip) => (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => onOpenStationView?.(fromHubId, toHubId)}
                  className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3 hover:border-[#0071e3]/50 hover:bg-[#0071e3]/[0.03] dark:hover:bg-white/[0.04] hover:shadow-sm active:scale-[0.99] transition-all duration-150 cursor-pointer text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {trip.from} ➔ {trip.to}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                      {trip.time || trip.timeSlot} · {trip.seats} {t('common.seats')}
                    </p>
                  </div>
                  {trip.pricePerSeat ? (
                    <span className="text-sm font-bold font-mono text-[#0071e3] shrink-0">
                      {formatVND(trip.pricePerSeat)}
                    </span>
                  ) : null}
                </button>
              ))}
            </>
          )}
        </section>
      )}

      {/* ── ĐỔI VAI TRÒ: nhỏ, ở cuối, không chắn đường ── */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <span className="text-xs text-slate-400">{t('search.youAre')}</span>
        <div className="inline-flex p-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => switchRole('passenger')}
            className={`px-3.5 h-9 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
              role === 'passenger'
                ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.06]'
            }`}
          >
            <Users className="w-3 h-3" />
            {t('search.rolePassenger')}
          </button>
          <button
            type="button"
            onClick={() => switchRole('driver')}
            className={`px-3.5 h-9 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
              role === 'driver'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.06]'
            }`}
          >
            <Car className="w-3 h-3" />
            {t('search.roleDriver')}
          </button>
        </div>
      </div>

      {/* Chủ xe: lối vào Taplo, chỉ hiện đúng vai trò */}
      {role === 'driver' && (
        <button
          type="button"
          onClick={onOpenCockpit}
          className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all duration-150 cursor-pointer"
        >
          <Car className="w-4 h-4" />
          {t('search.cockpitCta')}
        </button>
      )}
    </div>
  );
}
