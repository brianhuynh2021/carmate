import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpDown,
  MapPin,
  Search,
  Clock,
  Loader2,
  ChevronDown,
  Zap,
  Navigation,
  Calendar,
  Phone,
  Users,
  Bus,
  Car,
  Sparkles,
  ShieldCheck,
  X,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import {
  getActiveCorridors,
  getDefaultCorridor,
  getEndpointHubs,
  flipHeading,
  detectCorridorByCoords,
  getHubEndpoint,
  getFixedSegmentTariff,
  formatVND,
  buildDepartureChips,
  buildCustomChip,
  toLocalIsoDate,
  getVerifiedHotlines,
  DEPARTURE_WINDOWS
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import api from '../../api/client.js';
import { CarMateBadge } from '../ui/Logo.jsx';

const ROLE_KEY = 'carmate_last_movement_role';
const CORRIDOR_KEY = 'carmate_last_corridor';
const WINDOW_KEY = 'carmate_last_departure_window';

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

  // Vai trò được SUY RA, không bắt người dùng tự khai.
  //
  // Trước đây có thanh pill "Bạn là: [Người đi cùng | Chủ xe]" ở cuối trang.
  // Bỏ đi vì hai lý do đo được:
  //   1. Xung đột với nút "Nhận khách" ở thanh điều hướng dưới — người đang
  //      chọn vai "Người đi cùng" vẫn thấy nút nhận khách, gây bối rối.
  //   2. Ở iPhone SE (667px) nó nằm ở mốc 719px, tức NGOÀI tầm nhìn hoàn toàn
  //      (thanh nav đã che từ 585px) — không ai thấy để mà bấm.
  //
  // Vai trò giờ suy từ hồ sơ (có xe = chủ xe) hoặc thói quen đã lưu; chủ xe
  // muốn mở chuyến thì dùng nút "Nhận khách" ở thanh dưới, rõ ràng hơn hẳn.
  const role = detectedRole;

  // ── Điểm đi / điểm đến ─────────────────────────────────────────────────
  const fromKey = heading === 'b_to_a' ? 'b' : 'a';
  const toKey = heading === 'b_to_a' ? 'a' : 'b';
  const fromHubs = useMemo(() => getEndpointHubs(corridor.id, fromKey, heading), [corridor.id, fromKey, heading]);
  const toHubs = useMemo(() => getEndpointHubs(corridor.id, toKey, heading), [corridor.id, toKey, heading]);

  const [fromHubId, setFromHubId] = useState(() => fromHubs[0]?.id || '');
  const [toHubId, setToHubId] = useState(() => toHubs[0]?.id || '');

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

  // ── Thời gian khởi hành: DỮ LIỆU CẤP 1 ────────────────────────────────
  // Ngang hàng Nơi đi / Nơi đến, không phải một dòng phụ. Mặc định chọn sẵn
  // khung gần nhất còn kịp đặt, để khách không phải nghĩ mà vẫn ra kết quả đúng.
  // 3 chip tự sinh + ô thứ 4 luôn là "Chọn ngày khác" (lưới 2x2 vừa đúng 4 ô)
  const departureChips = useMemo(() => buildDepartureChips({ limit: 3 }), []);

  // TRÍ TUỆ BẢN ĐỊA (<1ms, không gọi máy chủ): người đi tuyến này gần như luôn
  // lặp lại một khung giờ — ai quen chuyến 4h sáng thì lần sau vẫn 4h sáng. Nhớ
  // khung họ chọn lần trước và tự bật sẵn, để họ không phải chọn lại mỗi lần.
  const [chipId, setChipId] = useState(() => {
    // LUÔN chọn sẵn khung GẦN NHẤT (chip 1), không để thói quen nhảy cóc.
    //
    // Trước đây ưu tiên khung khách hay đi, nhưng đo ra một kịch bản hỏng thật:
    // lúc 14h49, khách từng chọn "Đêm nay" hôm trước thì chip active lại là
    // "Đêm nay (22h-4h)" — trong khi "Chiều nay (14h49-18h)" đang nằm ngay đó.
    // Khách bấm TÌM CHUYẾN XE liền sẽ ra kết quả lúc nửa đêm, phải bấm lại chip
    // mới đúng ý. Mục tiêu một-chạm bị phá.
    //
    // Thói quen chỉ được áp dụng khi nó TRÙNG chip 1 hoặc chip 2 — tức vẫn là
    // khung sắp tới gần. Xa hơn thì rơi về chip 1.
    const remembered = readStore(WINDOW_KEY);
    const idx = remembered ? departureChips.findIndex((c) => c.windowId === remembered) : -1;
    const pick = idx >= 0 && idx <= 1 ? departureChips[idx] : departureChips[0];
    return pick?.id || null;
  });
  const [customChip, setCustomChip] = useState(null);
  const [showDatePanel, setShowDatePanel] = useState(false);

  const allChips = useMemo(
    () => (customChip ? [...departureChips, customChip] : departureChips),
    [departureChips, customChip]
  );
  const selectedChip = useMemo(
    () => allChips.find((c) => c.id === chipId) || allChips[0] || null,
    [allChips, chipId]
  );

  // Ngày tối thiểu = hôm nay; không cho chọn ngày đã qua
  // toISOString() quy về UTC nên buổi tối giờ Việt Nam sẽ trả về NGÀY HÔM QUA,
  // khiến ô chọn ngày cho phép đặt lùi về quá khứ. Phải lấy theo lịch địa phương.
  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);
  const [pickDate, setPickDate] = useState(todayIso);
  const [pickWindow, setPickWindow] = useState(
    () => readStore(WINDOW_KEY) || 'morning'
  );

  const applyCustomDate = useCallback(() => {
    const chip = buildCustomChip({ date: pickDate, windowId: pickWindow });
    if (!chip) return;
    setCustomChip(chip);
    setChipId(chip.id);
    setShowDatePanel(false);
    writeStore(WINDOW_KEY, chip.windowId);
  }, [pickDate, pickWindow]);

  // ── Tìm chuyến: MA TRẬN KHE THỜI GIAN ─────────────────────────────────
  // Khách liên tỉnh cần thấy NGAY cả khung lân cận ±30 phút, không chỉ đúng
  // giờ mình gõ. Màn hình trống là mất khách, nên backend luôn bù khe dự phòng.
  const [isSearching, setIsSearching] = useState(false);
  const [matrix, setMatrix] = useState(null);
  const resultsRef = useRef(null);

  const handleSearchNow = useCallback(async () => {
    if (!fromHubId || !toHubId) return;
    setIsSearching(true);
    setMatrix(null);
    try {
      const res = await api.getTimeSlotMatrix({
        from: fromHubId,
        to: toHubId,
        timeSlot: selectedChip?.timeSlot || 'all',
        seats: 1,
        corridor: corridor.dataKey
      });
      setMatrix(res?.success ? res : null);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch {
      setMatrix(null);
    } finally {
      setIsSearching(false);
    }
  }, [fromHubId, toHubId, selectedChip, corridor.dataKey]);

  // CHUYẾN KHỚP TỐT NHẤT: ưu tiên độ an tâm cao nhất, hoà thì chọn chuyến tới
  // sớm hơn. Khách liên tỉnh cần MỘT phương án đáng tin, không phải một danh
  // sách để tự so sánh — việc so sánh là việc của hệ thống.
  const { bestMatch, otherSlots } = useMemo(() => {
    const slots = matrix?.slots || [];
    const real = slots.filter((s) => s.tier !== 'SHADOW');
    if (real.length === 0) return { bestMatch: null, otherSlots: slots };

    const ranked = [...real].sort((a, b) => {
      const sa = a.assurance?.score ?? 0;
      const sb = b.assurance?.score ?? 0;
      if (Math.abs(sa - sb) > 0.05) return sb - sa;
      return (a.departureMinutes ?? 9999) - (b.departureMinutes ?? 9999);
    });
    const best = ranked[0];
    return { bestMatch: best, otherSlots: slots.filter((s) => s !== best) };
  }, [matrix]);

  const verifiedHotlines = useMemo(
    () => getVerifiedHotlines(corridor.dataKey),
    [corridor.dataKey]
  );

  // ── State xem chi tiết chuyến xe (Progressive Disclosure) ─────────────────
  const [selectedDetailTrip, setSelectedDetailTrip] = useState(null);
  const [selectedDetailHotline, setSelectedDetailHotline] = useState(null);

  // Giá chặng chia sẻ chuẩn CarMate (mặc định 55.000 đ với Lái Thiêu - Sân bay TSN)
  const carmateSegmentPrice = useMemo(() => {
    return tariff?.pricePerSeat || 55000;
  }, [tariff]);

  // Danh sách chuyến xe thật (chỉ lấy chuyến CONFIRMED / FORMING thật, KHÔNG tạo xe ảo)
  const carmateDisplayTrips = useMemo(() => {
    const slots = matrix?.slots || [];
    const real = slots.filter((s) => s.tier !== 'SHADOW');
    return real.map((t) => ({
      ...t,
      pricePerSeat: t.pricePerSeat || carmateSegmentPrice
    }));
  }, [matrix, carmateSegmentPrice]);

  // ── MẬT ĐỘ CUNG QUYẾT ĐỊNH NÚT NÀY ĐỔI MẶT ────────────────────────────
  // Tuyến ít xe: hiện ô gom nhu cầu (một trang "lịch chạy toàn tuyến" chỉ có
  // 2-3 dòng thì phơi bày sự trống trải, phản tác dụng).
  // Tuyến đủ xe: hiện lịch chạy toàn tuyến — đúng thứ khách liên tỉnh cần khi
  // chọn một khung hẹp mà không thấy xe, thay vì bấm back đổi từng giờ để dò.
  // Ngưỡng đọc từ chính dữ liệu nên khi tuyến đông lên, app TỰ chuyển.
  const [timeline, setTimeline] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    if (!fromHubId || !toHubId) return;
    let alive = true;
    api
      .getCorridorTimeline({ from: fromHubId, to: toHubId, corridor: corridor.dataKey })
      .then((res) => {
        if (alive && res?.success) setTimeline(res);
      })
      .catch(() => {
        /* mất mạng: giữ mặc định ô gom nhu cầu, không chặn luồng tìm chuyến */
      });
    return () => {
      alive = false;
    };
  }, [fromHubId, toHubId, corridor.dataKey]);

  const isDense = timeline?.isDense === true;

  const swap = () => {
    const prevFrom = fromHubId;
    const prevTo = toHubId;
    setFromHubId(prevTo);
    setToHubId(prevFrom);
    setHeading((h) => flipHeading(h));
  };

  const hubLabel = (h) => h.shortName || h.name;

  return (
    <div className="w-full max-w-2xl mx-auto min-w-0 space-y-3 animate-fade-in pb-10">
      {/* ── CHỌN TUYẾN (chỉ hiện khi có nhiều hơn 1 tuyến) ── */}
      {corridors.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {corridors.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCorridorId(c.id);
                writeStore(CORRIDOR_KEY, c.id);
              }}
              className={`relative tap-area-44 shrink-0 px-3.5 h-9 rounded-full text-xs font-bold transition-all cursor-pointer border active:scale-95 ${
                c.id === corridor.id
                  ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-sm shadow-[#0071e3]/30'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-white/20 hover:border-[#0071e3] hover:bg-blue-50/50 dark:hover:bg-blue-500/10 hover:text-[#0071e3] hover:shadow-sm'
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
      <section className="surface rounded-3xl overflow-hidden border border-slate-300/90 dark:border-white/15 bg-white dark:bg-[#1c1c1e] shadow-sm hover:shadow-md hover:border-slate-400/80 dark:hover:border-white/25 transition-all duration-200">
        {/* Điểm đi — chừa lề phải để tên trạm dài không chui xuống dưới nút đảo chiều */}
        <div className="group/from py-3 px-4 pr-16 sm:py-3.5 sm:px-5 sm:pr-16 flex items-center gap-3 hover:bg-emerald-50/60 dark:hover:bg-emerald-500/10 cursor-pointer transition-all rounded-2xl">
          <MapPin className="w-5 h-5 text-emerald-500 shrink-0 group-hover/from:scale-115 transition-transform" />
          <div className="flex-1 min-w-0">
            <label className="block type-label text-slate-400 group-hover/from:text-emerald-700 dark:group-hover/from:text-emerald-400 mb-0.5 cursor-pointer transition-colors">
              {t('search.from')}
            </label>
            <div className="relative flex items-center">
              <select
                value={fromHubId}
                onChange={(e) => setFromHubId(e.target.value)}
                className="tap-44 w-full appearance-none bg-transparent pr-7 text-base font-bold text-slate-900 dark:text-white group-hover/from:text-emerald-800 dark:group-hover/from:text-emerald-300 outline-none cursor-pointer truncate transition-colors"
              >
                {fromHubs.map((h) => (
                  <option key={h.id} value={h.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {hubLabel(h)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover/from:text-emerald-600 dark:group-hover/from:text-emerald-400 transition-all pointer-events-none absolute right-1 group-hover/from:translate-y-0.5 shrink-0" />
            </div>
          </div>
        </div>

        {/* Đảo chiều.
            Nút nổi trên đường kẻ nên phải tự tách mình khỏi nền: vòng viền trắng
            (ring) cắt đường kẻ chạy qua phía sau, tránh cảm giác bị dính vào vạch.
            Vùng chạm 44px theo Apple HIG (icon vẫn 14px), và hover phải đổi CẢ nền
            lẫn viền — chỉ đổi màu icon thì gần như không thấy gì. */}
        <div className="relative h-px bg-slate-200 dark:bg-white/10 mx-4 sm:mx-5">
          <button
            type="button"
            onClick={swap}
            aria-label={t('search.swap')}
            title={t('search.swap')}
            className="group absolute right-1 -top-[22px] w-11 h-11 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-white/20 ring-4 ring-white dark:ring-[#1c1c1e] shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-[#0071e3] hover:border-[#0071e3] hover:text-white hover:shadow-lg hover:scale-110 focus-visible:bg-[#0071e3] focus-visible:text-white active:scale-90 transition-all duration-200 cursor-pointer"
          >
            <ArrowUpDown className="w-4 h-4 transition-transform duration-300 group-hover:rotate-180" />
          </button>
        </div>

        {/* Điểm đến */}
        <div className="group/to py-3 px-4 pr-16 sm:py-3.5 sm:px-5 sm:pr-16 flex items-center gap-3 hover:bg-blue-50/60 dark:hover:bg-blue-500/10 cursor-pointer transition-all rounded-2xl">
          <MapPin className="w-5 h-5 text-[#0071e3] shrink-0 group-hover/to:scale-115 transition-transform" />
          <div className="flex-1 min-w-0">
            <label className="block type-label text-slate-400 group-hover/to:text-[#0071e3] mb-0.5 cursor-pointer transition-colors">
              {t('search.to')}
            </label>
            <div className="relative flex items-center">
              <select
                value={toHubId}
                onChange={(e) => setToHubId(e.target.value)}
                className="tap-44 w-full appearance-none bg-transparent pr-7 text-base font-bold text-slate-900 dark:text-white group-hover/to:text-[#0071e3] outline-none cursor-pointer truncate transition-colors"
              >
                {toHubs.map((h) => (
                  <option key={h.id} value={h.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {hubLabel(h)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover/to:text-[#0071e3] transition-all pointer-events-none absolute right-1 group-hover/to:translate-y-0.5 shrink-0" />
            </div>
          </div>
        </div>

        {/* ── THỜI GIAN KHỞI HÀNH: dữ liệu cấp 1, ngang hàng Nơi đi / Nơi đến ──
            Chip chạm một phát thay cho lịch picker: người đi liên tỉnh thực tế
            chỉ xoay quanh "chiều nay về", "tối nay đi", "sáng mai đi sớm". */}
        <div className="h-px bg-slate-200 dark:bg-white/10 mx-4 sm:mx-5" />
        <div className="py-3.5 px-4 sm:py-4 sm:px-5">
          <label className="flex items-center gap-2 type-label text-slate-400 mb-2.5">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            {t('search.departureLabel')}
          </label>

          <div className="grid grid-cols-2 gap-2">
            {allChips.map((chip) => {
              const active = chip.id === selectedChip?.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    setChipId(chip.id);
                    setShowDatePanel(false);
                    // Học im lặng, không hỏi, không thông báo
                    if (chip.windowId) writeStore(WINDOW_KEY, chip.windowId);
                  }}
                  aria-pressed={active}
                  className={`h-[52px] px-2 rounded-2xl border flex flex-col items-center justify-center leading-tight transition-all duration-150 cursor-pointer active:scale-95 ${
                    active
                      ? 'bg-[#0071e3] border-2 border-[#0071e3] text-white shadow-md shadow-[#0071e3]/30 scale-[1.01] hover:bg-[#0062c4] hover:border-[#0062c4] hover:shadow-lg'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:border-[#0071e3] hover:bg-blue-50/70 dark:hover:bg-blue-500/15 hover:text-[#0071e3] hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01]'
                  }`}
                >
                  {/* Tách nhãn và giờ thành hai dòng: gộp một dòng thì ở máy 360px
                      (Android phổ thông) chuỗi "Chiều nay (16h30-18h)" bị cắt cụt
                      đúng phần giờ — mất chính thông tin quan trọng nhất. */}
                  <span className="text-xs font-bold truncate max-w-full">{chip.label}</span>
                  <span
                    className={`text-[10px] font-mono truncate max-w-full ${
                      active ? 'text-white/80' : 'text-slate-400'
                    }`}
                  >
                    {chip.hint}
                  </span>
                </button>
              );
            })}

            {/* Ô thứ 4 luôn là lối mở lịch. Bảng chọn hiện NGAY TẠI CHỖ bên dưới,
                tuyệt đối không dùng popup hệ thống — tinh thần Cursor: zero blocking. */}
            <button
              type="button"
              onClick={() => setShowDatePanel((v) => !v)}
              aria-expanded={showDatePanel}
              className={`h-[52px] px-2 rounded-2xl border-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-95 ${
                showDatePanel
                  ? 'bg-slate-900 dark:bg-white/15 border-slate-900 dark:border-white/25 text-white shadow-sm hover:bg-slate-800'
                  : 'bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-300 hover:border-[#0071e3] hover:bg-blue-50/70 dark:hover:bg-blue-500/15 hover:text-[#0071e3] hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t('search.pickAnotherDay')}</span>
            </button>
          </div>

          {/* BẢNG CHỌN NGÀY TẠI CHỖ — mở xuống mượt, không chặn luồng */}
          {showDatePanel && (
            <div className="mt-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-300 dark:border-white/20 space-y-2.5 animate-fade-in shadow-2xs">
              <div>
                <label
                  htmlFor="carmate-pick-date"
                  className="block type-label text-slate-400 mb-1"
                >
                  {t('search.pickDate')}
                </label>
                <input
                  id="carmate-pick-date"
                  type="date"
                  value={pickDate}
                  min={todayIso}
                  onChange={(e) => setPickDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/20 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all cursor-pointer"
                />
              </div>

              <div>
                <span className="block type-label text-slate-400 mb-1">
                  {t('search.pickWindow')}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {DEPARTURE_WINDOWS.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setPickWindow(w.id)}
                      aria-pressed={w.id === pickWindow}
                      className={`h-12 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center leading-tight transition-all duration-150 cursor-pointer active:scale-95 ${
                        w.id === pickWindow
                          ? 'bg-[#0071e3] border-[#0071e3] text-white shadow-sm shadow-[#0071e3]/25'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-300 hover:border-[#0071e3] hover:bg-blue-50/50 dark:hover:bg-blue-500/10'
                      }`}
                    >
                      <span>{w.label}</span>
                      {/* Kèm giờ ngay dưới nhãn: "Sáng" một mình là mơ hồ, mà
                          các chip phía trên đều có giờ nên thiếu ở đây thành lệch. */}
                      <span
                        className={`text-[9px] font-mono ${
                          w.id === pickWindow ? 'text-white/75' : 'text-slate-400'
                        }`}
                      >
                        {w.fromHour % 24}h-{w.toHour % 24}h
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={applyCustomDate}
                className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold cursor-pointer active:scale-[0.98] transition-all duration-150 shadow-sm"
              >
                {t('search.applyDate')}
              </button>
            </div>
          )}
        </div>

        {/* ── THANH HÀNH ĐỘNG: tách hẳn khỏi vùng nhập bằng một đường kẻ, đúng
            như khung tìm kiếm của xe liên tỉnh. Ba câu hỏi ở trên, một hành
            động ở dưới — mắt đi thẳng một mạch, không phải tìm nút ở đâu. ── */}
        <div className="h-px bg-slate-200 dark:bg-white/10" />
        <div className="py-3.5 px-4 sm:py-4 sm:px-5">
          <button
            type="button"
            onClick={handleSearchNow}
            disabled={isSearching || !fromHubId || !toHubId}
            className="group relative overflow-hidden w-full h-13 min-h-[52px] rounded-2xl bg-[#0071e3] hover:bg-[#0062c4] border border-blue-400/40 hover:shadow-xl hover:shadow-[#0071e3]/45 hover:-translate-y-0.5 hover:scale-[1.008] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#0071e3] disabled:hover:shadow-md disabled:hover:translate-y-0 disabled:hover:scale-100 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#0071e3]/25 active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            {/* Vệt sáng quét ngang thu hút mắt về hành động chính của cả trang.
                Dùng lại keyframes shimmer-sweep sẵn có trong index.css thay vì
                viết animation mới. Tắt khi đang tìm hoặc nút bị vô hiệu hoá —
                nhấp nháy lúc không bấm được chỉ gây bực bội. */}
            {!isSearching && fromHubId && toHubId && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-sweep motion-reduce:hidden"
              />
            )}
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin relative" />
            ) : (
              <Search className="w-4 h-4 relative group-hover:scale-115 transition-transform duration-200" />
            )}
            <span className="relative">{isSearching ? t('search.searching') : t('search.findTrips')}</span>
          </button>


          {/* Giá hiện lặng lẽ dưới nút — kết quả, không phải thông báo */}
          {tariff && (
            <p className="mt-2.5 text-center text-xs text-slate-500 dark:text-slate-400 break-words">
              <span className="font-mono font-semibold">{formatVND(tariff.pricePerSeat)}</span>
              {' · '}
              <span className="font-mono">{tariff.distanceKm}km</span>
              {' · '}
              {t('search.allInclusive')}
            </p>
          )}
        </div>
      </section>

      {/* ── ĐĂNG NHU CẦU TÌM XE (Chỉ hiện khi chưa bấm tìm chuyến để không choán chỗ kết quả) ── */}
      {!matrix && (
        <button
          type="button"
          onClick={() => {
            if (isDense) setShowTimeline((v) => !v);
            else onOpenIntentModal?.(role, fromHubId);
          }}
          aria-expanded={isDense ? showTimeline : undefined}
          className="group w-full p-4 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-slate-300 dark:border-white/20 flex items-center justify-between gap-3 hover:border-[#0071e3] hover:bg-blue-50/40 dark:hover:bg-blue-500/10 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-150 cursor-pointer text-left shadow-2xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            {isDense ? (
              <Clock className="w-4 h-4 text-[#0071e3] shrink-0" />
            ) : (
              <MapPin className="w-4 h-4 text-[#0071e3] shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-[#0071e3] transition-colors">
                {isDense ? t('search.viewTimeline') : t('search.scheduleTitle')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {isDense
                  ? t('search.viewTimelineDesc', { n: timeline.totalTrips })
                  : t('search.scheduleDesc')}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 group-hover:text-[#0071e3] ${
              isDense ? (showTimeline ? 'rotate-0' : '-rotate-90') : '-rotate-90 group-hover:translate-x-0.5'
            }`}
          />
        </button>
      )}

      {/* BẢNG LỊCH CHẠY TOÀN TUYẾN — mở tại chỗ khi chưa tìm kiếm */}
      {!matrix && isDense && showTimeline && timeline && (
        <section className="space-y-2.5 animate-fade-in">
          {timeline.periods.map((p) => (
            <div
              key={p.id}
              className="p-3.5 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-slate-300 dark:border-white/20 shadow-2xs space-y-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {p.label}
                  <span className="ml-1.5 font-mono font-normal text-slate-400">{p.hint}</span>
                </p>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {t('search.tripCount', { n: p.count })}
                </span>
              </div>

              {p.count > 0 ? (
                <div className="space-y-1.5">
                  {p.trips.map((trip) => (
                    <button
                      key={trip.tripId || trip.departureLabel}
                      type="button"
                      onClick={() => onOpenStationView?.(fromHubId, toHubId)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/10 hover:border-[#0071e3] hover:bg-blue-50/60 dark:hover:bg-blue-500/10 hover:shadow-xs hover:-translate-y-0.5 flex items-center justify-between gap-2 text-left transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold font-mono text-slate-900 dark:text-white shrink-0">
                          {trip.departureLabel}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {trip.assurance?.badge} {trip.vehicleModel || trip.driverName}
                        </span>
                      </span>
                      {trip.seatsAvailable != null && (
                        <span className="text-[11px] font-mono text-slate-500 shrink-0">
                          {t('search.seatsLeft', { n: trip.seatsAvailable })}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenIntentModal?.(role, fromHubId)}
                  className="mt-1 w-full min-h-[44px] rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:border-[#0071e3] hover:bg-blue-50/50 dark:hover:bg-blue-500/10 hover:text-[#0071e3] hover:shadow-xs hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {t('search.emptyPeriodCta')}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── BẢNG SO SÁNH 3 TẦNG VẬN TẢI (DẠNG LINE LIẾC NGANG) ── */}
      {matrix && (
        <section ref={resultsRef} className="space-y-3 pt-1 animate-fade-in">
          {/* Header tóm tắt với 2 đòn bẩy: Thời gian & Tiền bạc */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 px-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Phương án di chuyển phù hợp
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold font-mono text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-400/40 dark:border-amber-500/30 flex items-center gap-1 shadow-2xs">
                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> Nhanh hơn 35p
              </span>
              <span className="text-[10px] font-bold font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-400/40 dark:border-emerald-500/30 shadow-2xs">
                Tiết kiệm 65%
              </span>
            </div>
          </div>

          {/* NHÓM 1: XE GHÉP TIỆN CHUYẾN CARMATE */}
          {carmateDisplayTrips.length > 0 ? (
            <div className="space-y-2">
              {carmateDisplayTrips.map((trip) => (
                <div
                  key={trip.tripId || trip.id || trip.departureLabel}
                  onClick={() => setSelectedDetailTrip(trip)}
                  className="group/hero w-full rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1c1c1e] border-2 border-emerald-500/80 dark:border-emerald-500 shadow-md shadow-emerald-500/10 hover:shadow-2xl hover:shadow-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-50/[0.2] dark:hover:bg-emerald-500/[0.05] hover:-translate-y-1 hover:scale-[1.008] p-4 space-y-3 transition-all duration-200 cursor-pointer"
                >
                  {/* Hàng 1: Giờ + Logo CarMate + Xe gì ➔ Giá tiền */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-mono font-bold text-sm shrink-0">
                        {trip.departureLabel}
                      </span>
                      <CarMateBadge size="xs" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {trip.vehicleModel || 'Xe tiện chuyến'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-base sm:text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatVND(trip.pricePerSeat || carmateSegmentPrice)}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-0.5">/ghế</span>
                    </div>
                  </div>

                  {/* Hàng 2: Trạng thái & Lợi ích: Đón trạm + Còn X chỗ + Không bắt khách dọc QL */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                    <p className="truncate text-[11px]">
                      Đón trạm {matrix.origin?.shortLabel || 'trạm đón'} · Còn <strong className="font-mono text-emerald-600 dark:text-emerald-400">{trip.seatsAvailable ?? 1}</strong> chỗ · Không bắt khách dọc QL
                    </p>
                  </div>

                  {/* Hàng 3: Nút CTA [GIỮ CHỖ NGAY] đậm chất Stanford Visual Dominance */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-white/10">
                    <span className="text-[10px] text-slate-400 truncate pr-2">
                      {trip.note || 'Xe cá nhân gia đình · Đi thẳng êm ái'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDetailTrip(trip);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white text-xs font-bold uppercase tracking-wide border border-emerald-400/40 shadow-md shadow-emerald-600/30 hover:shadow-lg hover:shadow-emerald-500/40 hover:scale-[1.02] flex items-center gap-1.5 transition-all duration-150 cursor-pointer select-none shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5 fill-white" />
                      <span>Giữ chỗ ngay</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1c1c1e] border border-slate-200 dark:border-white/10 text-center space-y-3 shadow-xs">
              <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 dark:bg-blue-500/10 text-[#0071e3] flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Khung giờ này chưa có chuyến xe ghép trực tiếp
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Bạn có thể gửi yêu cầu đặt chỗ để các chủ xe tiện chuyến liên hệ đón, hoặc tham khảo các tuyến xe khách liên tỉnh bên dưới.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenIntentModal?.(role, fromHubId)}
                className="px-4 py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-blue-500/25 active:scale-95"
              >
                <span>Đăng nhu cầu đón tại trạm</span>
              </button>
            </div>
          )}

          {/* NHÓM 2: TUYẾN XE KHÁCH LIÊN TỈNH QL13 (THAM KHẢO & MỎ NEO GIÁ) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Bus className="w-3.5 h-3.5 text-slate-400" /> Tuyến xe khách liên tỉnh QL13 (Tham khảo)
              </span>
            </div>

            {verifiedHotlines.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setSelectedDetailHotline(h)}
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-slate-300 dark:border-white/20 hover:border-amber-400 dark:hover:border-amber-400/70 hover:bg-amber-50/40 dark:hover:bg-amber-500/10 hover:shadow-md hover:shadow-amber-500/10 hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-between gap-2 text-left transition-all duration-200 cursor-pointer group shadow-2xs"
              >
                {/* Trái: Tên nhà xe • Tần suất */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
                    {h.shortName || h.operator}
                  </p>
                  <span className="text-slate-300 dark:text-white/20">•</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {h.frequency?.split('(')[0]?.trim() || 'Nhiều chuyến/ngày'}
                  </p>
                </div>

                {/* Phải: Giá vé + Nút [ 📞 Gọi ] */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 group-hover:border-amber-300 dark:group-hover:border-amber-500/30 text-xs font-bold font-mono text-slate-700 dark:text-slate-200 transition-colors block leading-tight">
                    {h.priceRef || '100.000đ - 160.000đ'}
                  </span>
                  <span
                    className="px-3 py-1.5 rounded-xl border border-amber-400/60 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 group-hover:shadow-sm group-hover:shadow-amber-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all duration-150 shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Gọi</span>
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Nút đăng lệnh chờ */}
          <button
            type="button"
            onClick={() => onOpenIntentModal?.(role, fromHubId)}
            className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/20 bg-slate-50/60 dark:bg-white/[0.02] text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#0071e3] dark:hover:text-[#3898ec] hover:border-[#0071e3] dark:hover:border-[#3898ec] hover:bg-blue-50/60 dark:hover:bg-blue-500/10 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer group"
          >
            <span className="text-base group-hover:scale-110 transition-transform">📌</span>
            <span>Chưa tìm thấy giờ ưng ý? Đăng lệnh chờ (1-chạm)</span>
          </button>
        </section>
      )}

      {/* MODAL XEM KỸ CHI TIẾT CHUYẾN XE (REACT PORTAL z-[9999]) */}
      {selectedDetailTrip && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedDetailTrip(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#1c1c1e] rounded-3xl p-5 shadow-2xl border border-slate-300 dark:border-white/20 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-600">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CarMateBadge size="xs" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Đi ghép tiện chuyến
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Khởi hành: {selectedDetailTrip.departureLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailTrip(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Chi tiết xe & chủ xe */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Chủ xe:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedDetailTrip.driverName || 'Chủ xe'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Dòng xe:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedDetailTrip.vehicleModel || 'Xe tiện chuyến'}
                </span>
              </div>

              {selectedDetailTrip.plateMasked && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Biển kiểm soát:</span>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white border border-slate-200 dark:border-white/10">
                    {selectedDetailTrip.plateMasked}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Số ghế trống:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Còn {selectedDetailTrip.seatsAvailable ?? 1} ghế trống
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-white/10">
                <span className="text-slate-500 shrink-0">Điểm đón:</span>
                <span className="font-medium text-slate-900 dark:text-white text-right">
                  {matrix?.origin?.landmark || matrix?.origin?.name || 'Trạm đón quy chuẩn'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/10">
                <span className="text-slate-500">Giá chia sẻ:</span>
                <div className="text-right">
                  <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatVND(selectedDetailTrip.pricePerSeat || carmateSegmentPrice)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">trọn gói xăng & cầu đường</span>
                </div>
              </div>
            </div>

            {/* Nút hành động chính */}
            <button
              type="button"
              onClick={() => {
                setSelectedDetailTrip(null);
                onOpenStationView?.(fromHubId, toHubId);
              }}
              className="w-full h-12 rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] text-white text-sm font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              Xác nhận giữ chỗ chuyến này ({formatVND(selectedDetailTrip.pricePerSeat || carmateSegmentPrice)})
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL XEM KỸ CHI TIẾT NHÀ XE (REACT PORTAL z-[9999]) */}
      {selectedDetailHotline && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedDetailHotline(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#1c1c1e] rounded-3xl p-5 shadow-2xl border border-slate-300 dark:border-white/20 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-2xl bg-slate-500/15 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <Bus className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {selectedDetailHotline.operator}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {selectedDetailHotline.corridor || 'Tuyến QL13'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailHotline(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer active:scale-90"
              >
                ✕
              </button>
            </div>

            {/* Chi tiết tuyến xe */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/90 dark:border-white/15 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Loại phương tiện:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedDetailHotline.type === 'limousine' ? 'Xe Limousine VIP' : selectedDetailHotline.type === 'airport_limousine' ? 'Limousine Đưa Đón Sân Bay TSN' : 'Xe Khách Tuyến Cố Định'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tần suất xuất bến:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedDetailHotline.frequency}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-white/10">
                <span className="text-slate-500 shrink-0">Lộ trình trục đường:</span>
                <span className="font-medium text-slate-900 dark:text-white text-right">
                  {selectedDetailHotline.coverage}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-white/10">
                <span className="text-slate-500 shrink-0">Điểm đón khách QL13:</span>
                <span className="font-medium text-amber-700 dark:text-amber-300 text-right">
                  {selectedDetailHotline.note}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/10">
                <span className="text-slate-500">Giá vé tham khảo:</span>
                <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                  {selectedDetailHotline.priceRef}
                </span>
              </div>

              {/* Bảng giá niêm yết chi tiết từng chặng */}
              {selectedDetailHotline.fareTable && selectedDetailHotline.fareTable.length > 0 && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Biểu phí niêm yết theo chặng:
                  </span>
                  <div className="space-y-1 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] p-2.5 border border-slate-200/50 dark:border-white/5">
                    {selectedDetailHotline.fareTable.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] py-0.5">
                        <span className="text-slate-600 dark:text-slate-300 font-medium truncate pr-2">
                          {f.route}
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                          {f.price}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Nút gọi tổng đài */}
            <a
              href={`tel:${String(selectedDetailHotline.hotline).replace(/\s/g, '')}`}
              className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white text-sm font-bold shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/35 hover:-translate-y-0.5 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              <span>Gọi đặt chỗ tổng đài ({selectedDetailHotline.hotline})</span>
            </a>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
