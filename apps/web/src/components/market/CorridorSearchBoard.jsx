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
  PlusCircle,
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
  getChipDate,
  getVerifiedHotlines,
  DEPARTURE_WINDOWS
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import api from '../../api/client.js';
import { CarMateBadge } from '../ui/Logo.jsx';
import CorridorTripCard from './CorridorTripCard.jsx';
import TripDetailBottomSheet from './TripDetailBottomSheet.jsx';
import InstantBookingModal from '../modals/InstantBookingModal.jsx';
import {
  trackViewBusDetail,
  trackBusSheetCarMateCta,
  trackCallBus
} from '../../utils/analytics.js';

const ROLE_KEY = 'carmate_last_movement_role';
const CORRIDOR_KEY = 'carmate_last_corridor';
const WINDOW_KEY = 'carmate_last_departure_window';

/**
 * ── FEATURE FLAG: BỘ LỌC KHUNG GIỜ (COLD START CRO) ───────────────────
 * Giai đoạn Cold Start (1-2 xe/ngày): Tắt bộ lọc giờ để tránh bẫy Click-to-Empty.
 * Khách thấy ngay toàn bộ chuyến sẵn có (hôm nay & ngày mai) mà không bị lọc rớt.
 * TUYỆT ĐỐI KHÔNG XÓA code chips: Bật lại (true) khi mỗi buổi (Sáng - Trưa - Chiều)
 * đều có ít nhất 1 chuyến ổn định.
 */
export const ENABLE_DEPARTURE_CHIPS = false;

/**
 * ── FEATURE FLAG: ACCORDION LỊCH CHẠY TOÀN TUYẾN (COLD START CRO) ──────
 * Giai đoạn Cold Start (1-2 xe/ngày): Ẩn thanh accordion "Xem lịch chạy toàn tuyến"
 * để:
 * 1. Tránh số lượng ảo ("6 chuyến có sẵn") gây nghi ngờ dữ liệu mẫu (mock data).
 * 2. Triệt tiêu 1 cú click thừa (Click Friction): Show thẳng chuyến xe thật ra giữa màn hình.
 * 3. Tránh việc chưa tìm kiếm mà đã ghi "trên chặng này".
 * TUYỆT ĐỐI KHÔNG XÓA code timeline/accordion: Bật lại (true) khi hệ thống đã có mạng lưới
 * xe chạy cố định nhiều chuyến/ngày trên toàn tuyến.
 */
export const ENABLE_TIMELINE_ACCORDION = false;

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

/** Helper rút gọn tên nhà xe, loại bỏ ngoặc đơn cồng kềnh */
function getCleanOperatorName(h) {
  const raw = h.shortName || h.operator || '';
  if (/hoàng yến/i.test(raw)) return 'Hoàng Yến';
  if (/petro/i.test(raw)) return 'Petro Bình Phước';
  if (/trung kén/i.test(raw)) return 'Trung Kén';
  if (/huy hiếu/i.test(raw)) return 'Huy Hiếu';
  if (/thành công/i.test(raw)) return 'Thành Công';
  if (/chín nghĩa/i.test(raw)) return 'Chín Nghĩa';
  if (/quốc đạt/i.test(raw)) return 'Quốc Đạt';
  if (/ba đàm/i.test(raw)) return 'Ba Đàm';
  return raw.replace(/\(.*?\)/g, '').trim();
}

/** Helper phân loại dòng xe ngắn gọn, chuẩn mực */
function getBusSubtext(h) {
  const raw = `${h.operator || ''} ${h.shortName || ''}`.toLowerCase();
  if (/thành công/i.test(raw)) return 'Xe khách 29-45 chỗ';
  if (/petro/i.test(raw)) return 'Limousine VIP';
  if (/trung kén/i.test(raw) || /giường nằm/i.test(h.note || '')) return 'Xe giường nằm';
  if (/huy hiếu/i.test(raw) || /ghế ngả/i.test(h.note || '')) return 'Ghế ngả VIP';
  if (/quốc đạt/i.test(raw)) return 'Phòng nằm VIP';
  if (/chín nghĩa/i.test(raw)) return 'Giường nằm 40 chỗ';
  if (/ba đàm|minh thắng/i.test(raw)) return 'Xe khách 29 chỗ';
  return 'VIP 9 chỗ';
}

/** Helper điểm trả khách thực tế (tương phản khách quan với CarMate trả tận cổng) */
function getBusDropoff(h) {
  const id = (h.id || '').toLowerCase();
  const name = (h.shortName || h.operator || '').toLowerCase();
  if (id === 'petro-binh-phuoc' || /petro bình phước/i.test(name)) {
    return 'Trả tại VP Tân Bình / TSN';
  }
  if (id === 'huy-hieu' || /huy hiếu/i.test(name)) {
    return 'Trả tại VP 220 QL13';
  }
  return 'Trả tại Bến xe Miền Đông';
}

/** Helper định dạng giá vé dạng text mỏng (200k – 260k) */
function formatShortPriceRef(raw = '') {
  if (!raw) return '140k – 260k';
  return raw
    .replace(/\.000đ/g, 'k')
    .replace(/\.000\s*đ/g, 'k')
    .replace(/\s*-\s*/g, ' – ')
    .trim();
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
  currentUser,
  onOpenStationView,
  onOpenIntentModal,
  onAuthSuccess,
  onShowToast
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

  // ── Chiều đi: Đọc thông minh từ URL hoặc mặc định từ tỉnh lên thành phố ───
  const [heading, setHeading] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const urlFrom = p.get('from');
      const urlTo = p.get('to');
      const targetCorridorId = corridors.some((c) => c.id === readStore(CORRIDOR_KEY))
        ? readStore(CORRIDOR_KEY)
        : getDefaultCorridor().id;
      if (urlFrom) {
        const ep = getHubEndpoint(targetCorridorId, urlFrom);
        if (ep === 'a') return 'a_to_b';
        if (ep === 'b') return 'b_to_a';
      }
      if (urlTo) {
        const ep = getHubEndpoint(targetCorridorId, urlTo);
        if (ep === 'a') return 'b_to_a';
        if (ep === 'b') return 'a_to_b';
      }
    }
    return 'b_to_a'; // mặc định: từ tỉnh lên thành phố
  });

  // ── Vai trò: TỰ ĐOÁN, vẫn đổi được ────────────────────────────────────
  const detectedRole = useMemo(() => {
    if (currentUser?.vehicle?.plate || currentUser?.role === 'driver') return 'driver';
    const saved = readStore(ROLE_KEY);
    if (saved === 'driver' || saved === 'passenger') return saved;
    return 'passenger';
  }, [currentUser]);

  const role = detectedRole;

  // ── Điểm đi / điểm đến ─────────────────────────────────────────────────
  const fromKey = heading === 'b_to_a' ? 'b' : 'a';
  const toKey = heading === 'b_to_a' ? 'a' : 'b';
  const fromHubs = useMemo(() => getEndpointHubs(corridor.id, fromKey, heading), [corridor.id, fromKey, heading]);
  const toHubs = useMemo(() => getEndpointHubs(corridor.id, toKey, heading), [corridor.id, toKey, heading]);

  const [fromHubId, setFromHubId] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const urlFrom = p.get('from');
      if (urlFrom && fromHubs.some((h) => h.id === urlFrom)) return urlFrom;
    }
    const hasTanKhai = fromHubs.find((h) => h.id === 'hub_ql13_tan_khai');
    return hasTanKhai ? hasTanKhai.id : (fromHubs[0]?.id || '');
  });
  const [toHubId, setToHubId] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const urlTo = p.get('to');
      if (urlTo && toHubs.some((h) => h.id === urlTo)) return urlTo;
    }
    const hasChoRay = toHubs.find((h) => h.id === 'hub_ql13_cho_ray');
    return hasChoRay ? hasChoRay.id : (toHubs[0]?.id || '');
  });

  // Giữ lựa chọn luôn hợp lệ khi đổi tuyến hoặc đảo chiều
  useEffect(() => {
    if (!fromHubs.some((h) => h.id === fromHubId)) {
      const hasTanKhai = fromHubs.find((h) => h.id === 'hub_ql13_tan_khai');
      setFromHubId(hasTanKhai ? hasTanKhai.id : (fromHubs[0]?.id || ''));
    }
  }, [fromHubs, fromHubId]);
  useEffect(() => {
    if (!toHubs.some((h) => h.id === toHubId)) {
      const hasChoRay = toHubs.find((h) => h.id === 'hub_ql13_cho_ray');
      setToHubId(hasChoRay ? hasChoRay.id : (toHubs[0]?.id || ''));
    }
  }, [toHubs, toHubId]);

  const fromHub = useMemo(() => fromHubs.find((h) => h.id === fromHubId), [fromHubs, fromHubId]);
  const toHub = useMemo(() => toHubs.find((h) => h.id === toHubId), [toHubs, toHubId]);
  const [isEditingRoute, setIsEditingRoute] = useState(false);

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
      return getFixedSegmentTariff(fromHubId, toHubId, { corridor: corridor.dataKey });
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

  // Phân đoạn ngữ cảnh thời gian (Hôm nay vs Ngày mai/Tương lai):
  // Ngày mai / tương lai có biên độ thời gian lớn -> Ưu tiên 100% gom nhu cầu cho chủ xe,
  // ẩn bảng hotline xe khách để không rò rỉ khách vàng vào tay nhà xe truyền thống.
  const isFutureSearch = useMemo(() => {
    if (!ENABLE_DEPARTURE_CHIPS) return false;
    if (selectedChip?.dayOffset != null) {
      return selectedChip.dayOffset >= 1;
    }
    if (selectedChip?.date && todayIso) {
      return selectedChip.date > todayIso;
    }
    return false;
  }, [selectedChip, todayIso]);

  const targetDepartureDate = useMemo(() => {
    if (selectedChip?.date) return selectedChip.date;
    return getChipDate(selectedChip, new Date());
  }, [selectedChip]);

  const targetDepartureTimeSlot = useMemo(() => {
    return selectedChip?.timeSlot || '06:00';
  }, [selectedChip]);

  // ── Tìm chuyến: MA TRẬN KHE THỜI GIAN ─────────────────────────────────
  // Khách liên tỉnh cần thấy NGAY cả khung lân cận ±30 phút, không chỉ đúng
  // giờ mình gõ. Màn hình trống là mất khách, nên backend luôn bù khe dự phòng.
  const [isSearching, setIsSearching] = useState(false);
  const [matrix, setMatrix] = useState(null);
  const resultsRef = useRef(null);

  const handleSearchNow = useCallback(async (shouldScroll = true) => {
    if (!fromHubId || !toHubId) return;
    setIsSearching(true);
    try {
      const res = await api.getTimeSlotMatrix({
        from: fromHubId,
        to: toHubId,
        timeSlot: ENABLE_DEPARTURE_CHIPS ? (selectedChip?.timeSlot || 'all') : 'all',
        seats: 1,
        corridor: corridor.dataKey
      });
      setMatrix(res?.success ? res : null);
      if (shouldScroll) {
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    } catch {
      setMatrix(null);
    } finally {
      setIsSearching(false);
    }
  }, [fromHubId, toHubId, selectedChip, corridor.dataKey]);

  // CHUYẾN KHỚP TỐT NHẤT: ưu tiên độ an tâm cao nhất, hoà thì chọn chuyến tới
  // sớm hơn.
  const { _bestMatch, _otherSlots } = useMemo(() => {
    const slots = matrix?.slots || [];
    const real = slots.filter((s) => s.tier !== 'SHADOW');
    if (real.length === 0) return { _bestMatch: null, _otherSlots: slots };

    const ranked = [...real].sort((a, b) => {
      const sa = a.assurance?.score ?? 0;
      const sb = b.assurance?.score ?? 0;
      if (Math.abs(sa - sb) > 0.05) return sb - sa;
      return (a.departureMinutes ?? 9999) - (b.departureMinutes ?? 9999);
    });
    const best = ranked[0];
    return { _bestMatch: best, _otherSlots: slots.filter((s) => s !== best) };
  }, [matrix]);

  const verifiedHotlines = useMemo(
    () => getVerifiedHotlines(corridor.dataKey),
    [corridor.dataKey]
  );

  // ── State xem chi tiết chuyến xe (Progressive Disclosure) ─────────────────
  const [selectedDetailTrip, setSelectedDetailTrip] = useState(null);
  const [selectedDetailHotline, setSelectedDetailHotline] = useState(null);
  const [showAllBuses, setShowAllBuses] = useState(false);
  const [selectedBookingTrip, setSelectedBookingTrip] = useState(null);

  // Quản lý tải kết quả tìm kiếm:
  // - Ở chế độ Cold Start (!ENABLE_DEPARTURE_CHIPS): Tự động tải chuyến sẵn có ngay khi mở trang
  //   hoặc khi khách đổi trạm đón/trả, không bắt bấm thêm nút (Zero-Click discovery).
  // - Khi bật chips (ENABLE_DEPARTURE_CHIPS): Xóa kết quả cũ khi đổi trạm/khung giờ để người dùng bấm tìm.
  useEffect(() => {
    if (!ENABLE_DEPARTURE_CHIPS) {
      if (fromHubId && toHubId) {
        handleSearchNow(false);
      }
    } else {
      setMatrix(null);
    }
  }, [fromHubId, toHubId, chipId, corridorId, handleSearchNow]);

  // Giá chặng chia sẻ chuẩn CarMate (tính toán động theo cự ly thực tế giữa 2 trạm)
  const carmateSegmentPrice = useMemo(() => {
    return tariff?.pricePerSeat || 165000;
  }, [tariff]);

  // Danh sách chuyến xe thật hoặc chuyến khớp theo hành lang (ORDER BY date ASC, time ASC)
  const carmateDisplayTrips = useMemo(() => {
    const slots = matrix?.slots || [];
    const real = slots.filter((s) => s.tier !== 'SHADOW');
    if (real.length > 0) {
      const getTripSortWeight = (t) => {
        let dayOffset = 0;
        if (t.departureDate === 'Ngày mai') dayOffset = 1;
        else if (t.departureDate && t.departureDate !== 'Hôm nay') {
          const parsed = new Date(t.departureDate);
          if (!isNaN(parsed.getTime())) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(parsed);
            target.setHours(0, 0, 0, 0);
            dayOffset = Math.max(0, Math.round((target - today) / 86400000));
          }
        }
        let minutes = t.departureMinutes;
        if (minutes == null && t.departureLabel) {
          const [h, m] = t.departureLabel.split(':').map((num) => parseInt(num, 10));
          if (!isNaN(h) && !isNaN(m)) minutes = h * 60 + m;
        }
        return dayOffset * 1440 + (minutes ?? 9999);
      };

      return [...real]
        .sort((a, b) => getTripSortWeight(a) - getTripSortWeight(b))
        .map((t) => ({
          ...t,
          // Giá phân đoạn tính chính xác theo điểm đón/trả của khách trên hành lang
          pricePerSeat: carmateSegmentPrice || t.pricePerSeat || 170000
        }));
    }
    // Tuyệt đối KHÔNG hiển thị xe ảo khi chưa có chuyến thật
    return [];
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

  // Bảng định danh vĩ mô cấp tỉnh / huyện (Macro-level Landmarks - Airbnb / Google Maps style)
  const macroFromLabel = useMemo(() => {
    if (!fromHub) return 'Tân Khai';
    const MACRO_HUB_LABELS = {
      hub_ql13_tan_khai: 'Tân Khai',
      hub_ql13_tthc_tan_khai: 'Tân Khai',
      hub_ql13_cho_ray: 'BV Chợ Rẫy (TP.HCM)',
      hub_ql13_hang_xanh: 'Hàng Xanh (TP.HCM)',
      hub_ql13_san_bay_tsn: 'Sân bay TSN (TP.HCM)',
      hub_ql13_binh_trieu: 'Bình Triệu (TP.HCM)',
      hub_ql13_van_phuc_city: 'Vạn Phúc City (TP.HCM)',
      hub_ql13_nga4_binh_phuoc: 'Ngã 4 Bình Phước (TP.HCM)',
      hub_ql13_binh_long: 'Bình Long',
      hub_ql13_tthc_binh_long: 'Bình Long',
      hub_ql13_nga4_chon_thanh: 'Chơn Thành',
      hub_ql13_bau_bang: 'Bàu Bàng',
      hub_ql13_ben_cat: 'Bến Cát',
      hub_ql13_thu_dau_mot: 'Thủ Dầu Một',
      hub_ql13_cho_loc_ninh: 'Lộc Ninh',
      hub_ql13_budop: 'Bù Đốp',
      hub_ql13_dong_xoai: 'Đồng Xoài'
    };
    if (MACRO_HUB_LABELS[fromHub.id]) return MACRO_HUB_LABELS[fromHub.id];
    const name = fromHub.shortName || fromHub.name || 'Tân Khai';
    return name
      .replace(/^Cây xăng Petrolimex\s+/i, '')
      .replace(/^Cụm BV Chợ Rẫy\s*\/\s*BV Đại học Y Dược/i, 'BV Chợ Rẫy (TP.HCM)')
      .replace(/^Cụm BV\s+/i, 'BV ')
      .replace(/^Cụm\s+/i, '')
      .replace(/\s*\(QL13\)/i, '')
      .replace(/\s*\/\s*BV Đại học Y Dược/i, '')
      .replace(/^Trung tâm Hành chính\s+/i, 'TTHC ')
      .trim() || 'Tân Khai';
  }, [fromHub]);

  const macroToLabel = useMemo(() => {
    if (!toHub) return 'BV Chợ Rẫy (TP.HCM)';
    const MACRO_HUB_LABELS = {
      hub_ql13_tan_khai: 'Tân Khai',
      hub_ql13_tthc_tan_khai: 'Tân Khai',
      hub_ql13_cho_ray: 'BV Chợ Rẫy (TP.HCM)',
      hub_ql13_hang_xanh: 'Hàng Xanh (TP.HCM)',
      hub_ql13_san_bay_tsn: 'Sân bay TSN (TP.HCM)',
      hub_ql13_binh_trieu: 'Bình Triệu (TP.HCM)',
      hub_ql13_van_phuc_city: 'Vạn Phúc City (TP.HCM)',
      hub_ql13_nga4_binh_phuoc: 'Ngã 4 Bình Phước (TP.HCM)',
      hub_ql13_binh_long: 'Bình Long',
      hub_ql13_tthc_binh_long: 'Bình Long',
      hub_ql13_nga4_chon_thanh: 'Chơn Thành',
      hub_ql13_bau_bang: 'Bàu Bàng',
      hub_ql13_ben_cat: 'Bến Cát',
      hub_ql13_thu_dau_mot: 'Thủ Dầu Một',
      hub_ql13_cho_loc_ninh: 'Lộc Ninh',
      hub_ql13_budop: 'Bù Đốp',
      hub_ql13_dong_xoai: 'Đồng Xoài'
    };
    if (MACRO_HUB_LABELS[toHub.id]) return MACRO_HUB_LABELS[toHub.id];
    const name = toHub.shortName || toHub.name || 'BV Chợ Rẫy (TP.HCM)';
    return name
      .replace(/^Cây xăng Petrolimex\s+/i, '')
      .replace(/^Cụm BV Chợ Rẫy\s*\/\s*BV Đại học Y Dược/i, 'BV Chợ Rẫy (TP.HCM)')
      .replace(/^Cụm BV\s+/i, 'BV ')
      .replace(/^Cụm\s+/i, '')
      .replace(/\s*\(QL13\)/i, '')
      .replace(/\s*\/\s*BV Đại học Y Dược/i, '')
      .replace(/^Trung tâm Hành chính\s+/i, 'TTHC ')
      .trim() || 'BV Chợ Rẫy (TP.HCM)';
  }, [toHub]);

  return (
    <div className="w-full max-w-2xl mx-auto min-w-0 space-y-3 animate-fade-in pb-28 sm:pb-32">
      {/* ── CHỌN TUYẾN (chỉ hiện khi có từ 2 tuyến trở lên để tối ưu không gian) ── */}
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

      {/* ── THANH CHẶNG TINH GỌN (CLICKABLE PILL - AIRBNB / GOOGLE MAPS STYLE) ── */}
      {!ENABLE_DEPARTURE_CHIPS && !isEditingRoute ? (
        <div
          onClick={() => setIsEditingRoute(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsEditingRoute(true);
            }
          }}
          title="Chạm vào để đổi tuyến đón / trả"
          className="group flex items-center justify-between max-w-xl mx-auto px-4 py-2.5 bg-white dark:bg-[#1c1c1e] border border-slate-200 dark:border-white/15 rounded-full shadow-xs cursor-pointer transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-500/60 hover:shadow-md hover:bg-slate-50/60 dark:hover:bg-white/5 active:scale-[0.99] select-none"
        >
          {/* Khu vực text (Chạm vào đâu cũng mở chọn tuyến) */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />

            <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
              <span className="truncate">{macroFromLabel}</span>
              <span className="text-slate-400 dark:text-slate-500 mx-1.5 shrink-0 font-normal">➔</span>
              <span className="truncate">{macroToLabel}</span>
            </div>
          </div>

          {/* Nút đảo chiều duy nhất bên phải */}
          <button
            type="button"
            title="Đảo chiều tuyến"
            aria-label={t('search.swap')}
            onClick={(e) => {
              e.stopPropagation();
              swap();
            }}
            className="p-1.5 ml-1 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-full transition-colors shrink-0 active:scale-90 cursor-pointer"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <section className="surface rounded-3xl overflow-hidden border border-slate-300/90 dark:border-white/15 bg-white dark:bg-[#1c1c1e] shadow-sm hover:shadow-md hover:border-slate-400/80 dark:hover:border-white/25 transition-all duration-200">
          <div className="flex items-center justify-between px-4 sm:px-5 pt-3 pb-2 border-b border-slate-100 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              Chọn trạm đón & trả trên QL13
            </span>
            <button
              type="button"
              onClick={() => setIsEditingRoute(false)}
              className="p-1 -mr-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Đóng / Thu gọn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
                style={{ backgroundImage: 'none' }}
                className="tap-44 w-full appearance-none !bg-none bg-transparent pr-7 text-base font-bold text-slate-900 dark:text-white group-hover/from:text-emerald-800 dark:group-hover/from:text-emerald-300 outline-none cursor-pointer truncate transition-colors"
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
                style={{ backgroundImage: 'none' }}
                className="tap-44 w-full appearance-none !bg-none bg-transparent pr-7 text-base font-bold text-slate-900 dark:text-white group-hover/to:text-[#0071e3] outline-none cursor-pointer truncate transition-colors"
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
            chỉ xoay quanh "chiều nay về", "tối nay đi", "sáng mai đi sớm".
            [FEATURE FLAG COLD START - CRO]: Chỉ ẨN giao diện, TUYỆT ĐỐI KHÔNG XÓA.
            Tránh bẫy "Click-to-Empty" khi ít nguồn cung (1-2 xe/ngày).
            Bật lại (ENABLE_DEPARTURE_CHIPS = true) khi mỗi buổi (Sáng-Trưa-Chiều) có ít nhất 1 chuyến ổn định. */}
        {ENABLE_DEPARTURE_CHIPS && (
          <>
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
          </>
        )}

        {/* ── THANH HÀNH ĐỘNG ── */}
        {ENABLE_DEPARTURE_CHIPS ? (
          <>
            <div className="h-px bg-slate-200 dark:bg-white/10" />
            <div className="py-3.5 px-4 sm:py-4 sm:px-5">
              <button
                type="button"
                onClick={() => handleSearchNow(true)}
                disabled={isSearching || !fromHubId || !toHubId}
                className="group relative overflow-hidden w-full h-13 min-h-[52px] rounded-2xl bg-[#0071e3] hover:bg-[#0062c4] border border-blue-400/40 hover:shadow-xl hover:shadow-[#0071e3]/45 hover:-translate-y-0.5 hover:scale-[1.008] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#0071e3] disabled:hover:shadow-md disabled:hover:translate-y-0 disabled:hover:scale-100 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#0071e3]/25 active:scale-[0.98] transition-all duration-200 cursor-pointer"
              >
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

              {tariff && (
                <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span>~{tariff.distanceKm}km</span>
                  {' · '}
                  <span>Hành lang Quốc Lộ 13</span>
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="p-3 sm:px-5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              ~{tariff?.distanceKm || 105}km · Tuyến Quốc Lộ 13
            </span>
            <button
              type="button"
              onClick={() => setIsEditingRoute(false)}
              className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all cursor-pointer active:scale-95"
            >
              Xong / Thu gọn
            </button>
          </div>
        )}
      </section>
    )}

      {/* ── ACCORDION LỊCH CHẠY TOÀN TUYẾN (BẢO LƯU CODE - ẨN Ở GIAI ĐOẠN COLD START CRO) ── */}
      {ENABLE_TIMELINE_ACCORDION && !matrix && (
        <button
          type="button"
          onClick={() => {
            if (isDense) setShowTimeline((v) => !v);
            else onOpenIntentModal?.(role, fromHubId, toHubId, targetDepartureDate, targetDepartureTimeSlot);
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
      {ENABLE_TIMELINE_ACCORDION && !matrix && isDense && showTimeline && timeline && (
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
                  onClick={() => onOpenIntentModal?.(role, fromHubId, toHubId, targetDepartureDate, targetDepartureTimeSlot)}
                  className="mt-1 w-full min-h-[44px] rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:border-[#0071e3] hover:bg-blue-50/50 dark:hover:bg-blue-500/10 hover:text-[#0071e3] hover:shadow-xs hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {t('search.emptyPeriodCta')}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── SKELETON TRẠNG THÁI TẢI CHUYẾN XE (Zero Layout Shift & Mượt mà) ── */}
      {isSearching && !matrix && (
        <div className="p-4 rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-md border border-slate-200 dark:border-white/10 animate-pulse space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="h-4 w-36 bg-slate-200 dark:bg-white/10 rounded-full" />
            <div className="h-5 w-24 bg-slate-200 dark:bg-white/10 rounded-full" />
          </div>
          <div className="h-24 bg-slate-100 dark:bg-white/5 rounded-2xl" />
          <div className="flex gap-2">
            <div className="h-10 flex-1 bg-slate-200 dark:bg-white/10 rounded-xl" />
            <div className="h-10 flex-1 bg-slate-200 dark:bg-white/10 rounded-xl" />
          </div>
        </div>
      )}

      {/* ── BẢNG SO SÁNH 3 TẦNG VẬN TẢI (DẠNG LINE LIẾC NGANG) ── */}
      {matrix && (
        <section ref={resultsRef} className="space-y-3 pt-1 animate-fade-in">
          {/* Header tóm tắt: Tiêu đề gọn gàng & Badge Xe nhà xác thực */}
          <div className="flex items-center justify-between gap-1.5 px-1 pb-0.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
              {carmateDisplayTrips.length > 0 ? `${carmateDisplayTrips.length} chuyến sẵn sàng đi` : 'Chuyến xe hôm nay'}
            </p>
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 shrink-0 whitespace-nowrap bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-300/80 dark:border-emerald-500/30 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Xe nhà xác thực
            </span>
          </div>

          {/* NHÓM 1: XE GHÉP TIỆN CHUYẾN CARMATE (DANH SÁCH RÚT GỌN SCANNABLE) */}
          {carmateDisplayTrips.length > 0 ? (
            <div className="space-y-2 sm:space-y-2.5">
              {carmateDisplayTrips.map((trip, idx) => (
                <CorridorTripCard
                  key={trip.tripId || trip.id || trip.departureLabel}
                  trip={trip}
                  isEarliest={idx === 0}
                  tripIndex={idx}
                  originName={fromHub?.name || matrix?.origin?.landmark || matrix?.origin?.name || 'Cây xăng Petrolimex Tân Khai (QL13)'}
                  destName={toHub?.name || matrix?.destination?.landmark || matrix?.destination?.name || 'Cụm BV Chợ Rẫy / BV Đại học Y Dược'}
                  segmentPrice={carmateSegmentPrice}
                  onSelectTrip={(selectedTrip) => {
                    setSelectedDetailTrip(selectedTrip);
                  }}
                  onBookNow={(selectedTrip) => {
                    setSelectedDetailTrip(selectedTrip);
                  }}
                />
              ))}

              {/* ⭐️ ƯU TIÊN #1: GOM NHU CẦU LỆCH GIỜ (ĐẶT LỊCH TRƯỚC - BẢO TOÀN PHỄU CHUYỂN ĐỔI) */}
              <div className="p-3 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-dashed border-slate-300 dark:border-white/15 text-center space-y-1.5 shadow-2xs">
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                  Chưa tìm thấy giờ phù hợp lịch trình?
                </p>
                <button
                  type="button"
                  onClick={() => onOpenIntentModal?.(role, fromHubId, toHubId, targetDepartureDate, targetDepartureTimeSlot)}
                  className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-transform cursor-pointer inline-flex items-center justify-center gap-1.5 active:scale-[0.99]"
                >
                  <span>⚡ Báo giờ bạn muốn đi · {formatVND(carmateSegmentPrice)}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-amber-50/40 via-white to-slate-50/40 dark:from-amber-950/20 dark:via-[#1c1c1e] dark:to-[#1c1c1e] border border-amber-300/60 dark:border-amber-500/30 ring-1 ring-black/[0.04] dark:ring-white/[0.06] shadow-[0_12px_36px_rgba(245,158,11,0.08),0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.4)] text-center space-y-4">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 bg-amber-500/10 dark:bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

              {/* Badge trên cùng theo State 2: ⚡ Ghép xe theo giờ của bạn (Màu cam) */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 dark:bg-amber-400/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold select-none shadow-2xs">
                <span className="text-amber-600 dark:text-amber-400">⚡</span>
                <span>{heading === 'a_to_b' ? 'Báo giờ bạn cần về Bình Phước' : 'Ghép xe theo giờ của bạn'}</span>
              </div>

              <div className="relative space-y-1.5">
                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {heading === 'a_to_b'
                    ? 'Chiều về hiện chưa có xe nổ máy đúng phút này'
                    : `Chưa có xe nổ máy đúng phút này${ENABLE_DEPARTURE_CHIPS && isFutureSearch ? ` cho ${selectedChip?.dayLabel?.toLowerCase() || 'ngày mai'}` : ''}`}
                </p>
                <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  {heading === 'a_to_b'
                    ? 'Đặt lịch trước điểm đón & khung giờ bạn cần về, CarMate sẽ kết nối chủ xe tiện chuyến đón bạn về lại Bình Phước.'
                    : 'Đặt lịch trước điểm đón & khung giờ bạn muốn đi dọc QL13, CarMate sẽ kết nối chủ xe tiện chuyến qua đón.'}
                </p>
              </div>
              <div className="relative pt-0.5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => onOpenIntentModal?.(role, fromHubId, toHubId, targetDepartureDate, targetDepartureTimeSlot)}
                  className="h-11 sm:h-12 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-md shadow-amber-500/25 hover:shadow-lg hover:shadow-amber-500/35 hover:-translate-y-0.5 active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>
                    {heading === 'a_to_b'
                      ? `BÁO GIỜ BẠN CẦN VỀ · CHỈ TỪ ${formatVND(carmateSegmentPrice)}`
                      : `ĐẶT LỊCH TRƯỚC · CHỈ TỪ ${formatVND(carmateSegmentPrice)}`}
                  </span>
                </button>

                {/* Huy hiệu uy tín thực tế & Social Proof */}
                <div className="pt-1 space-y-1">
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Chuyến xe nhà tiện đường · Đón tận nơi dọc QL13 · 0đ cọc</span>
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>
                      {isFutureSearch
                        ? 'Chủ xe quen hoặc điều phối viên sẽ gọi/Zalo xác nhận trong 15 phút'
                        : 'Sáng nay đã có 3 chuyến xe ghép kết nối thành công trên trục QL13'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 🛡️ ƯU TIÊN #2 (DƯỚI CÙNG - SAFETY NET): THAM KHẢO XE KHÁCH LIÊN TỈNH KHI CẦN GẤP
              CHỈ HIỆN KHI TÌM CHUYẾN HÔM NAY / ĐI LIỀN. Nếu tìm cho ngày mai/tương lai, ẩn toàn bộ
              bảng hotline xe khách để ưu tiên 100% gom khách cho chủ xe CarMate. */}
          {!isFutureSearch && verifiedHotlines.length > 0 && (
            <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between text-[11px] pb-0.5 px-1">
                <span className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Lịch trình & số điện thoại các nhà xe
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {verifiedHotlines.length} nhà xe QL13
                </span>
              </div>

              <div className="space-y-1.5">
                {(showAllBuses ? verifiedHotlines : verifiedHotlines.slice(0, 5)).map((h) => {
                  const cleanBusName = getCleanOperatorName(h);
                  const busSubtext = getBusSubtext(h);
                  const busDropoff = getBusDropoff(h);
                  const shortPrice = formatShortPriceRef(h.priceRef);

                  return (
                    <div
                      key={h.id}
                      onClick={() => {
                        trackViewBusDetail(h.operator, {
                          hotline: h.hotline,
                          corridor: corridor.id,
                          fromHubId,
                          toHubId,
                          timeSlot: selectedChip?.timeSlot,
                          dayOffset: selectedChip?.dayOffset
                        });
                        setSelectedDetailHotline(h);
                      }}
                      className="p-3 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-slate-200/90 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-2xs group"
                    >
                      {/* Hàng 1: Tên nhà xe (Chữ đen text-slate-800 đồng bộ, không dính màu xanh) + Giá xám mờ + Icon > */}
                      <div className="flex items-center justify-between min-w-0">
                        <p className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">
                          {cleanBusName}
                        </p>
                        <div className="shrink-0 flex items-center gap-1.5 ml-2">
                          <span className="text-xs font-mono font-medium text-slate-400 dark:text-slate-500">
                            {shortPrice}
                          </span>
                          <span className="text-slate-400 text-xs font-bold transition-transform group-hover:translate-x-0.5">
                            ›
                          </span>
                        </div>
                      </div>

                      {/* Hàng 2: Loại xe & Điểm trả thực tế (Màu xám trung tính text-slate-500) */}
                      <div className="flex items-center justify-between text-[11px] mt-1 text-slate-500 dark:text-slate-400">
                        <span className="truncate">{busSubtext}</span>
                        <span className="font-medium shrink-0 ml-1.5 text-slate-500 dark:text-slate-400">
                          {busDropoff}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Nút bấm nhẹ Xem thêm / Thu gọn (Mặc định 5 xe, nút mở thêm 3 xe, viền xám trung tính border-slate-200) */}
                {verifiedHotlines.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllBuses(!showAllBuses)}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/5 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-[0.99] outline-none"
                  >
                    <span>
                      {showAllBuses
                        ? 'Thu gọn'
                        : `Xem thêm ${verifiedHotlines.length - 5} nhà xe khác`}
                    </span>
                    <span className="text-xs">{showAllBuses ? '▴' : '▾'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── BOTTOM SHEET CHI TIẾT CHUYẾN XE (PROGRESSIVE DISCLOSURE) ── */}
      {selectedDetailTrip && (
        <TripDetailBottomSheet
          isOpen={Boolean(selectedDetailTrip)}
          onClose={() => setSelectedDetailTrip(null)}
          trip={selectedDetailTrip}
          originName={fromHub?.name || matrix?.origin?.landmark || matrix?.origin?.name || 'Cây xăng Petrolimex Tân Khai (QL13)'}
          destName={toHub?.name || matrix?.destination?.landmark || matrix?.destination?.name || 'Cụm BV Chợ Rẫy / BV Đại học Y Dược'}
          destNote={toHub?.landmark || matrix?.destination?.landmark || 'Cụm BV: Chợ Rẫy, Ung Bướu, ĐHYD / Hàng Xanh'}
          segmentPrice={carmateSegmentPrice}
          onConfirmBook={(tripToBook) => {
            setSelectedDetailTrip(null);
            setSelectedBookingTrip(tripToBook);
          }}
        />
      )}

      {/* ── BOTTOM SHEET CHI TIẾT LỘ TRÌNH NHÀ XE & ĐỐI CHIẾU CARMATE (REACT PORTAL z-[9999]) ── */}
      {selectedDetailHotline && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in"
          onClick={() => setSelectedDetailHotline(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#1c1c1e] rounded-t-[32px] sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200/80 dark:border-white/15 space-y-4 max-h-[92vh] sm:max-h-[85vh] overflow-y-auto anim-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Thanh gạt trang trí chuẩn Bottom Sheet */}
            <div className="w-12 h-1 rounded-full bg-slate-300 dark:bg-white/20 mx-auto -mt-1 mb-2.5" />

            {/* ── KHỐI TIÊU ĐỀ POPUP: NHÀ XE & ĐÓNG ── */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#0B3B7A] dark:bg-blue-800 text-white flex items-center justify-center shrink-0">
                  <Bus className="w-5 h-5 text-white" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {selectedDetailHotline.operator}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-normal">
                    {selectedDetailHotline.corridor || 'Tuyến cố định QL13'} · {selectedDetailHotline.frequency || 'Xuất bến mỗi 60 phút'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailHotline(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold shrink-0 active:scale-90"
                title="Đóng"
              >
                ✕
              </button>
            </div>

            {/* ── KHỐI 1: BẢNG THÔNG TIN CHUYẾN XE (HOVER VIỀN & ĐỔ BÓNG NHẸ) ── */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0B3B7A] dark:text-blue-300">
                  Thông tin chuyến xe
                </span>
              </div>
              <div className="p-3.5 sm:p-4 bg-white dark:bg-white/[0.03] border border-blue-200/80 hover:border-blue-400 dark:border-white/10 dark:hover:border-white/25 hover:shadow-md rounded-2xl transition-all duration-200 cursor-default group/bus shadow-2xs">
                <div className="space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-[#0B3B7A] dark:text-blue-300 shrink-0">Điểm trả:</span>
                    <span className="font-semibold text-slate-900 dark:text-white text-right">
                      {getBusDropoff(selectedDetailHotline)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
                    <span className="font-semibold text-[#0B3B7A] dark:text-blue-300 shrink-0">Giá vé:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-right">
                      {selectedDetailHotline.priceRef || '200.000đ – 260.000đ'} / vé
                    </span>
                  </div>
                  {selectedDetailHotline.hotline && (
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
                      <span className="font-semibold text-[#0B3B7A] dark:text-blue-300 shrink-0">Liên hệ:</span>
                      <a
                        href={`tel:${selectedDetailHotline.hotline.replace(/\s+/g, '')}`}
                        onClick={() => {
                          trackCallBus(selectedDetailHotline.operator, selectedDetailHotline.hotline, {
                            corridor: corridor?.id,
                            fromHubId,
                            toHubId,
                            frequency: selectedDetailHotline.frequency || ''
                          });
                          onShowToast?.('Chúc bạn chuyến đi thuận lợi! Lần tới cần xe đón tận nhà, nhớ mở CarMate nhé.');
                        }}
                        className="inline-flex items-center gap-1.5 font-mono font-bold text-[#0B5CBA] dark:text-blue-400 hover:underline tracking-wide transition-colors"
                        title={`Bấm gọi ngay: ${selectedDetailHotline.hotline}`}
                      >
                        <Phone className="w-3.5 h-3.5 text-[#0B5CBA] dark:text-blue-400 shrink-0" />
                        <span>{selectedDetailHotline.hotline}</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── KHỐI 2: GỢI Ý CÙNG HÀNH LANG (CARMATE SMART DISCOVERY BANNER) ── */}
            {(() => {
              const hasRealTrips = carmateDisplayTrips.length > 0;
              const firstRealTrip = hasRealTrips ? carmateDisplayTrips[0] : null;

              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0B3B7A] dark:text-blue-300">
                      Gợi ý cùng hành lang
                    </span>
                    <span className="text-[10.5px] font-semibold text-white bg-[#18532c] px-2.5 py-0.5 rounded-full shadow-2xs">
                      Tiết kiệm thời gian
                    </span>
                  </div>
                  <div className="p-3.5 sm:p-4 bg-[#f0f6ff]/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-2xl space-y-3 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <span className="text-base shrink-0 mt-0.5">💡</span>
                      <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                        {hasRealTrips ? (
                          <>
                            Hôm nay có <strong className="text-slate-900 dark:text-white font-bold">{carmateDisplayTrips.length} chuyến xe ghép tiện chuyến</strong> cùng tuyến này (đón trả tận nơi, ghé các BV lớn) · <span className="font-mono font-bold text-[#18532c] dark:text-emerald-400">{formatVND(firstRealTrip?.pricePerSeat || carmateSegmentPrice)}</span>
                          </>
                        ) : (
                          <>
                            Tuyến này có <strong className="text-slate-900 dark:text-white font-bold">xe ghép tiện chuyến</strong> kết nối theo yêu cầu (đón trả tận nơi, ghé các BV lớn) · từ <span className="font-mono font-bold text-[#18532c] dark:text-emerald-400">{formatVND(carmateSegmentPrice)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        trackBusSheetCarMateCta(selectedDetailHotline.operator, {
                          corridor: corridor?.id,
                          fromHubId,
                          toHubId,
                          carmatePrice: carmateSegmentPrice
                        });
                        setSelectedDetailHotline(null);
                        if (hasRealTrips && firstRealTrip) {
                          setSelectedBookingTrip(firstRealTrip);
                        } else {
                          onOpenIntentModal?.(role, fromHubId, toHubId, targetDepartureDate, targetDepartureTimeSlot);
                        }
                      }}
                      className="w-full py-2.5 px-4 bg-[#0B5CBA] hover:bg-[#094b98] active:scale-[0.99] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Khám phá các chuyến xe ghép hôm nay</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL GIỮ CHỖ TỨC THÌ (MATCH & REVEAL 3 BƯỚC) ── */}
      {selectedBookingTrip && (
        <InstantBookingModal
          isOpen={Boolean(selectedBookingTrip)}
          onClose={() => setSelectedBookingTrip(null)}
          trip={selectedBookingTrip}
          originHub={matrix?.origin}
          destinationHub={matrix?.destination}
          segmentPrice={carmateSegmentPrice}
          currentUser={currentUser}
          onAuthSuccess={onAuthSuccess}
          onBookingSuccess={(booking) => {
            // Cập nhật ngay số ghế còn lại trên giao diện trang chủ
            setMatrix((prev) => {
              if (!prev || !prev.slots) return prev;
              return {
                ...prev,
                slots: prev.slots.map((s) => {
                  if (s.tripId === selectedBookingTrip.tripId || s.id === selectedBookingTrip.id) {
                    const newAvailable = Math.max(0, (s.seatsAvailable || 1) - (booking.seats || 1));
                    return {
                      ...s,
                      seatsAvailable: newAvailable
                    };
                  }
                  return s;
                })
              };
            });
          }}
          onShowToast={onShowToast}
        />
      )}

    </div>
  );
}
