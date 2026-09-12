import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowUpDown, MapPin, Search, Clock, Loader2, ChevronDown, Zap, Navigation, Calendar, Phone, Users } from 'lucide-react';
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

  // ── Thời gian khởi hành: DỮ LIỆU CẤP 1 ────────────────────────────────
  // Ngang hàng Nơi đi / Nơi đến, không phải một dòng phụ. Mặc định chọn sẵn
  // khung gần nhất còn kịp đặt, để khách không phải nghĩ mà vẫn ra kết quả đúng.
  // 3 chip tự sinh + ô thứ 4 luôn là "Chọn ngày khác" (lưới 2x2 vừa đúng 4 ô)
  const departureChips = useMemo(() => buildDepartureChips({ limit: 3 }), []);

  // TRÍ TUỆ BẢN ĐỊA (<1ms, không gọi máy chủ): người đi tuyến này gần như luôn
  // lặp lại một khung giờ — ai quen chuyến 4h sáng thì lần sau vẫn 4h sáng. Nhớ
  // khung họ chọn lần trước và tự bật sẵn, để họ không phải chọn lại mỗi lần.
  const [chipId, setChipId] = useState(() => {
    // Ưu tiên khung khách hay đi (ai quen chuyến 4h sáng thì vẫn 4h sáng), NHƯNG
    // chỉ khi khung đó còn nằm trong 3 chip khả thi lúc này. Khung đã trôi qua
    // thì rơi về chip 1 — khách luôn bấm được TÌM CHUYẾN XE ngay một chạm,
    // không bao giờ rơi vào cảnh chip đang chọn lại là khung không đặt được.
    const remembered = readStore(WINDOW_KEY);
    const stillFeasible = remembered && departureChips.find((c) => c.windowId === remembered);
    return (stillFeasible || departureChips[0])?.id || null;
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

  const swap = () => setHeading((h) => flipHeading(h));

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
              className={`relative tap-area-44 shrink-0 px-3.5 h-9 rounded-full text-xs font-bold transition-all cursor-pointer border ${
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
      <section className="surface rounded-3xl overflow-hidden">
        {/* Điểm đi — chừa lề phải để tên trạm dài không chui xuống dưới nút đảo chiều */}
        <div className="py-3 px-4 pr-16 sm:py-3.5 sm:px-5 sm:pr-16 flex items-center gap-3">
          <MapPin className="w-5 h-5 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <label className="block type-label text-slate-400 mb-0.5">
              {t('search.from')}
            </label>
            <div>
              <select
                value={fromHubId}
                onChange={(e) => setFromHubId(e.target.value)}
                className="tap-44 w-full appearance-none bg-transparent text-base font-bold text-slate-900 dark:text-white outline-none cursor-pointer truncate"
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
            className="group absolute right-1 -top-[22px] w-11 h-11 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 ring-4 ring-white dark:ring-slate-900 shadow-sm flex items-center justify-center text-slate-500 hover:bg-[#0071e3] hover:border-[#0071e3] hover:text-white hover:shadow-md focus-visible:bg-[#0071e3] focus-visible:text-white active:scale-90 transition-all duration-150 cursor-pointer"
          >
            <ArrowUpDown className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" />
          </button>
        </div>

        {/* Điểm đến */}
        <div className="py-3 px-4 pr-16 sm:py-3.5 sm:px-5 sm:pr-16 flex items-center gap-3">
          <MapPin className="w-5 h-5 text-[#0071e3] shrink-0" />
          <div className="flex-1 min-w-0">
            <label className="block type-label text-slate-400 mb-0.5">
              {t('search.to')}
            </label>
            <div>
              <select
                value={toHubId}
                onChange={(e) => setToHubId(e.target.value)}
                className="tap-44 w-full appearance-none bg-transparent text-base font-bold text-slate-900 dark:text-white outline-none cursor-pointer truncate"
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

        {/* ── THỜI GIAN KHỞI HÀNH: dữ liệu cấp 1, ngang hàng Nơi đi / Nơi đến ──
            Chip chạm một phát thay cho lịch picker: người đi liên tỉnh thực tế
            chỉ xoay quanh "chiều nay về", "tối nay đi", "sáng mai đi sớm". */}
        <div className="h-px bg-slate-100 dark:bg-white/[0.06] mx-4 sm:mx-5" />
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
                  className={`h-[52px] px-2 rounded-2xl border flex flex-col items-center justify-center leading-tight transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                    active
                      ? 'bg-[#0071e3] border-[#0071e3] text-white shadow-sm shadow-[#0071e3]/25'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-[#0071e3]/50 hover:shadow-xs'
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
              className={`h-[52px] px-2 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                showDatePanel
                  ? 'bg-slate-900 dark:bg-white/15 border-slate-900 dark:border-white/25 text-white'
                  : 'bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:border-[#0071e3]/50 hover:text-[#0071e3]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t('search.pickAnotherDay')}</span>
            </button>
          </div>

          {/* BẢNG CHỌN NGÀY TẠI CHỖ — mở xuống mượt, không chặn luồng */}
          {showDatePanel && (
            <div className="mt-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 space-y-2.5 animate-fade-in">
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
                  className="w-full h-11 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-[#0071e3] transition-colors cursor-pointer"
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
                      className={`h-12 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center leading-tight transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                        w.id === pickWindow
                          ? 'bg-[#0071e3] border-[#0071e3] text-white'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-[#0071e3]/50'
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
                className="w-full h-11 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer active:scale-[0.99] transition-all duration-150"
              >
                {t('search.applyDate')}
              </button>
            </div>
          )}
        </div>

        {/* ── THANH HÀNH ĐỘNG: tách hẳn khỏi vùng nhập bằng một đường kẻ, đúng
            như khung tìm kiếm của xe liên tỉnh. Ba câu hỏi ở trên, một hành
            động ở dưới — mắt đi thẳng một mạch, không phải tìm nút ở đâu. ── */}
        <div className="h-px bg-slate-100 dark:bg-white/[0.06]" />
        <div className="py-3.5 px-4 sm:py-4 sm:px-5">
          <button
            type="button"
            onClick={handleSearchNow}
            disabled={isSearching || !fromHubId || !toHubId}
            className="relative overflow-hidden w-full h-13 min-h-[52px] rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] hover:shadow-lg hover:shadow-[#0071e3]/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#0071e3] disabled:hover:shadow-md text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#0071e3]/25 active:scale-[0.99] transition-all duration-150 cursor-pointer"
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
              <Search className="w-4 h-4 relative" />
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

      {/* ── MA TRẬN KHE THỜI GIAN ── */}
      {matrix && (
        <section className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white">{t('search.matrixTitle')}</p>
            <p className="text-[10px] font-mono text-slate-400">
              {t('search.matrixWindow', { n: matrix.windowMinutes })}
            </p>
          </div>

          {matrix.station?.waitingCount > 0 && (
            <p className="px-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              {t('search.waitingAtHub', { n: matrix.station.waitingCount })}
            </p>
          )}

          {/* TRẠM ĐÓN NHÂN BẢN HOÁ: mốc nhận diện + tiện ích + lời dặn an toàn.
              Khách phải biết mình sẽ đứng ở chỗ như thế nào TRƯỚC khi quyết định,
              nhất là với chuyến 4 giờ sáng. */}
          {matrix.origin?.landmark && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] space-y-1.5">
              <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">{matrix.origin.shortName}</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {matrix.origin.landmark}
              </p>
              {matrix.origin.amenities?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {matrix.origin.amenities.map((a) => (
                    <span
                      key={a.id}
                      className="px-2 py-0.5 rounded-full bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-[10px] text-slate-600 dark:text-slate-300"
                    >
                      {a.icon} {a.label}
                    </span>
                  ))}
                </div>
              )}
              {matrix.origin.safetyNote && (
                <p className="text-[10px] text-slate-400 italic pt-0.5">{matrix.origin.safetyNote}</p>
              )}
            </div>
          )}

          {/* KHUNG GIỜ CHƯA CÓ AI MỞ CHUYẾN — nói thẳng, kèm lối đi tiếp.
              Không bao giờ để màn hình trống hay báo cụt "không có xe": nhu cầu
              đăng ký ở đây chính là thứ kéo chủ xe vào mở chuyến. */}
          {matrix.counts.confirmed === 0 && matrix.counts.forming === 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-dashed border-slate-300 dark:border-white/15 space-y-2.5">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('search.noDriverInWindow')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {selectedChip
                  ? `${selectedChip.dayLabel} · ${selectedChip.label} (${selectedChip.hint})`
                  : ''}
                {' — '}
                Đăng ký nhu cầu để chủ xe trên tuyến nhìn thấy và mở chuyến cho khung giờ này.
              </p>
              <button
                type="button"
                onClick={() => onOpenIntentModal?.(role, fromHubId)}
                className="w-full h-11 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold cursor-pointer active:scale-[0.99] transition-all duration-150"
              >
                {t('search.registerWindow')}
              </button>
            </div>
          )}

          {/* CHUYẾN KHỚP TỐT NHẤT — tách hẳn ra, to hơn, đủ thông tin để quyết
              định ngay mà không phải mở thêm màn nào. Khách liên tỉnh chỉ cần
              MỘT phương án tốt, không phải một danh sách để so sánh. */}
          {bestMatch && (
            <div className="space-y-2">
              <p className="px-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                {t('search.bestMatch')}
              </p>
              <SlotCard
                slot={bestMatch}
                t={t}
                featured
                origin={matrix.origin}
                onAct={() => {
                  if (bestMatch.tier === 'SHADOW') onOpenIntentModal?.(role, fromHubId);
                  else onOpenStationView?.(fromHubId, toHubId);
                }}
              />
            </div>
          )}

          {otherSlots.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('search.otherTrips')}
              </p>
              {otherSlots.map((slot, idx) => (
                <SlotCard
                  key={`${slot.tier}-${slot.tripId || slot.departureLabel}-${idx}`}
                  slot={slot}
                  t={t}
                  onAct={() => {
                    if (slot.tier === 'SHADOW') onOpenIntentModal?.(role, fromHubId);
                    else onOpenStationView?.(fromHubId, toHubId);
                  }}
                />
              ))}
            </div>
          )}

          {/* LỐI THOÁT AN TOÀN — luôn ở cuối, không bao giờ để khách cụt đường */}
          <div className="pt-2 space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {t('search.or')}
              </span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => onOpenIntentModal?.(role, fromHubId)}
              className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-dashed border-slate-300 dark:border-white/15 text-left hover:border-[#0071e3]/50 active:scale-[0.99] transition-all duration-150 cursor-pointer"
            >
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {t('search.placeStandingOrder')}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('search.standingOrderDesc')}
              </p>
            </button>

            {/* Cần đi gấp: chỉ hiện SỐ khi đã kiểm chứng; chưa có thì hiện chỉ
                dẫn thực địa để khách vẫn tự bắt được xe. */}
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/[0.07] border border-amber-200 dark:border-amber-500/20">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {t('search.urgentTitle')}
              </p>
              {verifiedHotlines.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {verifiedHotlines.map((h) => (
                    <a
                      key={h.id}
                      href={`tel:${String(h.hotline).replace(/\s/g, '')}`}
                      className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {h.operator}: {h.hotline}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-amber-800/90 dark:text-amber-200/80 leading-relaxed">
                  {matrix.origin?.landmark
                    ? t('search.urgentGuide', { place: matrix.origin.landmark })
                    : t('search.urgentGuideFallback')}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

/**
 * Một khe giờ trong ma trận. Ba tầng dùng chung một khung nhưng khác hẳn về
 * trọng lượng thị giác: khe chắc chắn phải nổi bật nhất, khe dự phòng mờ nhất —
 * mắt khách phải rơi vào thứ đáng tin nhất trước tiên.
 */
function SlotCard({ slot, t, onAct, featured = false, origin = null }) {
  // Màu sắc bám theo CHỈ SỐ AN TÂM, không bám theo tầng kỹ thuật: khách quan tâm
  // "tôi có chắc đi được không", chứ không quan tâm dữ liệu đến từ nguồn nào.
  const level = slot.assurance?.level;
  const tone =
    level === 'GUARANTEED'
      ? {
          ring: 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-500/[0.07]',
          chip: 'bg-emerald-500 text-white',
          label: slot.assurance?.label || t('search.tierConfirmed'),
          Icon: Zap,
          btn: 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }
      : level === 'COMMUNITY'
        ? {
            ring: 'border-[#0071e3]/40 bg-[#0071e3]/[0.05]',
            chip: 'bg-[#0071e3] text-white',
            label: slot.assurance?.label || t('search.tierForming'),
            Icon: Navigation,
            btn: 'bg-[#0071e3] hover:bg-[#0077ed] text-white'
          }
        : {
            ring: 'border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02]',
            chip: 'bg-slate-300 dark:bg-white/15 text-slate-700 dark:text-slate-200',
            label: slot.assurance?.label || t('search.tierShadow'),
            Icon: Clock,
            btn: 'bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white'
          };

  const { Icon } = tone;

  return (
    <div
      className={`p-4 rounded-2xl border ${featured ? 'border-2 shadow-sm' : ''} ${tone.ring} transition-all duration-150`}
    >
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {slot.departureLabel}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tone.chip}`}>
              {tone.label}
            </span>
            {slot.etaSigmaMinutes ? (
              <span className="text-[10px] font-mono text-slate-400">
                {t('search.etaSigma', { n: slot.etaSigmaMinutes })}
              </span>
            ) : null}
          </div>

          {/* Thẻ nổi bật đã liệt kê xe và số ghế thành từng dòng riêng bên dưới,
              nên ở đây chỉ nêu chủ xe — nếu không sẽ lặp lại y hệt hai lần. */}
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 truncate">
            {slot.driverName || ''}
            {!featured && slot.vehicleModel ? ` · ${slot.vehicleModel}` : ''}
            {!featured && slot.seatsAvailable != null
              ? ` · ${t('search.seatsLeft', { n: slot.seatsAvailable })}`
              : ''}
          </p>

          <p className="mt-0.5 text-[11px] text-slate-400 flex items-center gap-1 min-w-0">
            <Icon className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {slot.distanceKm != null
                ? t('search.distanceAway', { n: slot.distanceKm })
                : featured
                  ? ''
                  : slot.note}
            </span>
          </p>

          {/* Lịch sử THẬT của chủ xe — khách tự nhìn số liệu mà quyết định,
              thay vì phải tin một nhãn dán do hệ thống tự phong. */}
          {slot.assurance?.reasons?.[0] && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {slot.assurance.reasons[0]}
            </p>
          )}
        </div>

        {slot.pricePerSeat ? (
          <span className="text-sm font-bold font-mono text-slate-900 dark:text-white shrink-0">
            {formatVND(slot.pricePerSeat)}
          </span>
        ) : null}
      </div>

      {/* THẺ NỔI BẬT: đủ thông tin để quyết định ngay tại đây — điểm đón, xe,
          số ghế — thay vì bắt khách mở thêm một màn nữa rồi mới biết. */}
      {featured && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10 space-y-1.5">
          {origin?.shortName && (
            <p className="text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" />
              <span className="min-w-0">
                {origin.shortName}
                {origin.landmark ? (
                  <span className="block text-slate-400">{origin.landmark}</span>
                ) : null}
              </span>
            </p>
          )}
          {slot.plateMasked && (
            <p className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {slot.vehicleModel ? `${slot.vehicleModel} · ` : ''}
                <span className="font-mono font-semibold">{slot.plateMasked}</span>
              </span>
            </p>
          )}
          {slot.seatsAvailable != null && (
            <p className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {t('search.seatsFree', { n: slot.seatsAvailable })}
            </p>
          )}
        </div>
      )}

      {slot.promise && (
        <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
          {slot.promise}
        </p>
      )}

      <button
        type="button"
        onClick={onAct}
        className={`mt-3 w-full ${featured ? 'h-12 text-sm' : 'h-11 text-xs'} rounded-xl font-bold cursor-pointer active:scale-[0.99] transition-all duration-150 ${tone.btn}`}
      >
        {slot.tier === 'SHADOW'
          ? t('search.actionIntent')
          : featured
            ? t('search.holdSeat')
            : t('search.viewDetail')}
      </button>
    </div>
  );
}
