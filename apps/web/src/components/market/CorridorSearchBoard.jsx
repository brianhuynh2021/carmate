import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  buildDepartureChips,
  buildCustomChip,
  toLocalIsoDate,
  getChipDate,
  DEPARTURE_WINDOWS
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import api from '../../api/client.js';
import { CarMateBadge } from '../ui/Logo.jsx';
import CorridorTripCard from './CorridorTripCard.jsx';
import { departureChipTimeRange } from './tripPresentation.js';
import TripDetailBottomSheet from './TripDetailBottomSheet.jsx';
import InstantBookingModal from '../modals/InstantBookingModal.jsx';
import OperatorDirectory from '../operators/OperatorDirectory.jsx';

const CORRIDOR_KEY = 'carmate_last_corridor';
const WINDOW_KEY = 'carmate_last_departure_window';

/**
 * ── FEATURE FLAG: TIME-SLOT FILTER (COLD START CRO) ───────────────────
 * Cold Start phase (1-2 vehicles/day): Turn off the time filter to avoid the Click-to-Empty trap.
 * Passengers immediately see all available trips (today & tomorrow) without any being filtered out.
 * ABSOLUTELY DO NOT DELETE the chips code: Turn it back on (true) once each period (Morning - Noon - Afternoon)
 * has at least 1 stable trip.
 */
export const ENABLE_DEPARTURE_CHIPS = true;

/**
 * ── FEATURE FLAG: FULL-ROUTE SCHEDULE ACCORDION (COLD START CRO) ──────
 * Cold Start phase (1-2 vehicles/day): Hide the accordion bar "Xem lịch chạy toàn tuyến" (View full-route schedule)
 * in order to:
 * 1. Avoid inflated counts ("6 chuyến có sẵn" (6 trips available)) that raise suspicion of mock data.
 * 2. Eliminate one redundant click (Click Friction): Show the real trip right in the middle of the screen.
 * 3. Avoid saying "trên chặng này" (on this leg) before any search has been made.
 * ABSOLUTELY DO NOT DELETE the timeline/accordion code: Turn it back on (true) once the system has a network of
 * fixed-schedule vehicles with many trips/day along the whole route.
 */
export const ENABLE_TIMELINE_ACCORDION = false;

/** Safely read localStorage (private mode / blocked storage must never throw). */
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
    /* ignore: saving a convenience, not mandatory data */
  }
}

/**
 * MAIN SCREEN: A SINGLE SEARCH BOX
 *
 * Principles:
 * - Elon: delete first, optimize later. No advertising Hero, no 2 role cards,
 *   no separate scheduling strip. The user arrives and sees exactly one thing to do.
 * - MIT: no hard-coded per-route if branches. Everything is read from the CORRIDORS registry,
 *   adding a new route means adding one data object.
 * - Cursor: price and route are computed silently on-device (<1ms), no notification, no waiting.
 * - Apple: one column, squircle, clear layering, reachable with a thumb on mobile.
 */
export default function CorridorSearchBoard({
  currentUser,
  checkIsMyTrip,
  onManageTrip,
  onOpenCockpit,
  onOpenStationView,
  onOpenIntentModal,
  onViewBookedTab,
  onAuthSuccess,
  onShowToast,
  onBookingCreated,
  onRequireAuth
}) {
  const { t } = useI18n();
  const corridors = useMemo(() => getActiveCorridors(), []);

  // ── Corridor being viewed ──────────────────────────────────────────────
  const [corridorId, setCorridorId] = useState(() => {
    const saved = readStore(CORRIDOR_KEY);
    return corridors.some((c) => c.id === saved) ? saved : getDefaultCorridor().id;
  });
  const corridor = useMemo(
    () => corridors.find((c) => c.id === corridorId) || corridors[0],
    [corridors, corridorId]
  );

  // ── Direction of travel: Smartly read from the URL, or default to province → city ───
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
    return 'b_to_a'; // default: from the province up to the city
  });

  // ── Origin / destination ───────────────────────────────────────────────
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

  // Keep the selection valid when switching routes or reversing direction
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

  // ── Local intelligence: auto-pick route + direction by GPS, silently ───
  const [isDetectingGPS, setIsDetectingGPS] = useState(false);

  const handleAutoDetectGPS = useCallback((e) => {
    if (e) e.stopPropagation();
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onShowToast?.('Trình duyệt không hỗ trợ định vị');
      return;
    }
    setIsDetectingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGPS(false);
        const { latitude, longitude } = pos.coords;
        const guessed = detectCorridorByCoords(latitude, longitude);
        if (!guessed) {
          onShowToast?.('Bạn đang ở ngoài tuyến đường phục vụ (QL13)');
          return;
        }
        setCorridorId(guessed.id);
        writeStore(CORRIDOR_KEY, guessed.id);

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
          if (ep) {
            setHeading(ep === 'a' ? 'a_to_b' : 'b_to_a');
            setFromHubId(nearest.id);
            onShowToast?.(`Đã tìm thấy trạm gần nhất: ${nearest.shortName || nearest.name}`);
          }
        }
      },
      (err) => {
        setIsDetectingGPS(false);
        if (err.code === 1) {
          onShowToast?.('Vui lòng cấp quyền truy cập vị trí trong cài đặt trình duyệt');
        } else {
          onShowToast?.('Không thể lấy vị trí hiện tại');
        }
      },
      { timeout: 8000, maximumAge: 600000, enableHighAccuracy: true }
    );
  }, [onShowToast]);

  // ── Departure time: TIER-1 DATA ───────────────────────────────────────
  // On par with Origin / Destination, not a secondary line. By default the
  // nearest slot that can still be booked is preselected, so the passenger does not have to think and still gets the right result.
  // 3 auto-generated chips + a 4th cell that is always "Chọn ngày khác" (Pick another date) (a 2x2 grid fits exactly 4 cells)
  const departureChips = useMemo(() => buildDepartureChips({ limit: 3 }), []);

  // LOCAL INTELLIGENCE (<1ms, no server call): people on this route almost always
  // repeat one time slot — someone used to the 4 AM trip will still take 4 AM next time. Remember
  // the slot they picked last time and preselect it, so they do not have to choose again each time.
  const [chipId, setChipId] = useState(() => {
    // ALWAYS preselect the NEAREST slot (chip 1), do not let habit jump ahead.
    //
    // Previously the slot the passenger usually takes was prioritized, but a real broken scenario was measured:
    // at 14:49, a passenger who had picked "Đêm nay" (Tonight) the day before gets the active chip as
    // "Đêm nay (22h-4h)" (Tonight (22:00-04:00)) — while "Chiều nay (14h49-18h)" (This afternoon (14:49-18:00)) is sitting right there.
    // A passenger who immediately taps FIND A TRIP gets results for midnight and has to tap the
    // right chip again. The one-tap goal is broken.
    //
    // The habit is only applied when it MATCHES chip 1 or chip 2 — i.e. it is still
    // an upcoming near slot. Anything further away falls back to chip 1.
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

  // Minimum date = today; past dates cannot be selected
  // toISOString() converts to UTC so a Vietnam-time evening will return YESTERDAY'S DATE,
  // letting the date picker allow booking back into the past. Must use the local calendar.
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

  // Keep the date and time slot the passenger picked when submitting the trip search request.
  const targetDepartureDate = useMemo(() => {
    if (selectedChip?.date) return selectedChip.date;
    return getChipDate(selectedChip, new Date());
  }, [selectedChip]);

  const targetDepartureTimeSlot = useMemo(() => {
    return departureChipTimeRange(selectedChip);
  }, [selectedChip]);

  // ── Trip search: TIME-SLOT MATRIX ─────────────────────────────────────
  // Intercity passengers need to see neighboring slots of ±30 minutes IMMEDIATELY, not only exactly
  // the time they typed. An empty screen loses the customer, so the backend always pads with fallback slots.
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [seatsNeeded, setSeatsNeeded] = useState(1);
  const requestSequence = useRef(0);
  const [matrix, setMatrix] = useState(null);
  const resultsRef = useRef(null);

  const handleSearchNow = useCallback(async (shouldScroll = true) => {
    if (!fromHubId || !toHubId) return;
    const sequence = ++requestSequence.current;
    setIsSearching(true);
    setSearchError('');
    try {
      const res = await api.getTimeSlotMatrix({
        from: fromHubId,
        to: toHubId,
        timeSlot: ENABLE_DEPARTURE_CHIPS ? targetDepartureTimeSlot : 'all',
        seats: seatsNeeded,
        date: targetDepartureDate,
        corridor: corridor.dataKey
      });
      if (sequence !== requestSequence.current) return;
      if (!res?.success) throw new Error('Chưa tải được kết quả');
      setMatrix(res);
      if (shouldScroll) {
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    } catch {
      if (sequence === requestSequence.current) {
        setMatrix(null);
        setSearchError('Chưa tải được kết quả. Vui lòng thử lại.');
      }
    } finally {
      if (sequence === requestSequence.current) setIsSearching(false);
    }
  }, [fromHubId, toHubId, targetDepartureTimeSlot, corridor.dataKey, targetDepartureDate, seatsNeeded]);

  // ── State for viewing trip details (Progressive Disclosure) ───────────────
  const [selectedDetailTrip, setSelectedDetailTrip] = useState(null);
  const [selectedBookingTrip, setSelectedBookingTrip] = useState(null);

  // Manage search result loading:
  // - In Cold Start mode (!ENABLE_DEPARTURE_CHIPS): Automatically load available trips as soon as the page opens
  //   or when the passenger changes pickup/drop-off station, no extra button press needed (Zero-Click discovery).
  // - When chips are enabled (ENABLE_DEPARTURE_CHIPS): Clear old results when the station/time slot changes so the user taps search.
  useEffect(() => {
    if (!ENABLE_DEPARTURE_CHIPS) {
      if (fromHubId && toHubId) {
        handleSearchNow(false);
      }
    } else {
      requestSequence.current += 1;
      setIsSearching(false);
      setMatrix(null);
    }
  }, [fromHubId, toHubId, chipId, corridorId, handleSearchNow]);

  // List of real trips or trips matched by corridor (ORDER BY date ASC, time ASC)
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
        ;
    }
    // ABSOLUTELY DO NOT show virtual vehicles when there are no real trips
    return [];
  }, [matrix]);

  // ── SUPPLY DENSITY DECIDES WHAT THIS BUTTON LOOKS LIKE ────────────────
  // Route with few vehicles: show the demand-collection box (a "lịch chạy toàn tuyến" (full-route schedule) page with only
  // 2-3 rows exposes the emptiness, which is counterproductive).
  // Route with enough vehicles: show the full-route schedule — exactly what an intercity passenger needs when
  // picking a narrow slot and seeing no vehicle, instead of pressing back to change hours one by one to probe.
  // The threshold is read from the data itself so when the route gets busier, the app switches BY ITSELF.
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
        /* network lost: keep the default demand-collection box, do not block the trip search flow */
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

  // Province / district-level macro identification table (Macro-level Landmarks - Airbnb / Google Maps style)
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
      {/* ── ROUTE PICKER (only shown when there are 2 or more routes, to optimize space) ── */}
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
              className={`relative tap-area-44 shrink-0 px-3.5 h-9 rounded-full transition-all cursor-pointer border active:scale-95 type-button ${
                c.id === corridor.id
                  ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-sm shadow-[#0071e3]/30'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-white/20 hover:border-[#0071e3] hover:bg-blue-50/50 dark:hover:bg-blue-500/10 hover:text-[#0071e3] hover:shadow-sm'
              }`}
            >
              {c.shortName}
              {c.status === 'beta' && (
                <span className="ml-1.5 opacity-70 tabular type-caption">beta</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── COMPACT LEG BAR (CLICKABLE PILL - AIRBNB / GOOGLE MAPS STYLE) ── */}
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
          {/* Text area (tapping anywhere opens the route picker) */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />

            <div className="text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5 type-caption">
              <span className="truncate">{macroFromLabel}</span>
              <span className="text-slate-400 dark:text-slate-500 mx-1.5 shrink-0 type-body">➔</span>
              <span className="truncate">{macroToLabel}</span>
            </div>
          </div>

          {/* The single reverse-direction button on the right */}
          <button
            type="button"
            title="Đảo chiều tuyến"
            aria-label={t('search.swap')}
            onClick={(e) => {
              e.stopPropagation();
              swap();
            }}
            className="p-1.5 ml-1 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-full transition-colors shrink-0 active:scale-90 cursor-pointer type-button"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <section className="surface rounded-3xl overflow-hidden border border-slate-300/90 dark:border-white/15 bg-white dark:bg-[#1c1c1e] shadow-sm hover:shadow-md hover:border-slate-400/80 dark:hover:border-white/25 transition-all duration-200">
          <div className="flex items-center justify-between px-4 sm:px-5 pt-3 pb-2 border-b border-slate-100 dark:border-white/10 text-slate-600 dark:text-slate-300 type-caption">
            <span className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              Chọn trạm đón & trả trên QL13
            </span>
            <button
              type="button"
              onClick={() => setIsEditingRoute(false)}
              className="p-1 -mr-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer type-button"
              title="Đóng / Thu gọn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        {/* Origin — leave a right margin so long station names do not slide under the reverse-direction button */}
        <div className="group/from py-3 px-4 pr-16 sm:py-3.5 sm:px-5 sm:pr-16 flex items-start gap-3 hover:bg-emerald-50/60 dark:hover:bg-emerald-500/10 cursor-pointer transition-all rounded-2xl type-body">
          <MapPin className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5 group-hover/from:scale-115 transition-transform" />
          <div className="flex-1 min-w-0 type-body">
            <label className="block text-slate-400 group-hover/from:text-emerald-700 dark:group-hover/from:text-emerald-400 mb-0.5 cursor-pointer transition-colors type-label">
              {t('search.from')}
            </label>
            <div className="relative flex items-center">
              <select
                value={fromHubId}
                onChange={(e) => setFromHubId(e.target.value)}
                style={{ backgroundImage: 'none' }}
                className="tap-44 w-full appearance-none !bg-none bg-transparent pr-7 text-slate-900 dark:text-white group-hover/from:text-emerald-800 dark:group-hover/from:text-emerald-300 outline-none cursor-pointer truncate transition-colors type-input"
              >
                {fromHubs.map((h) => (
                  <option key={h.id} value={h.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {hubLabel(h)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover/from:text-emerald-600 dark:group-hover/from:text-emerald-400 transition-all pointer-events-none absolute right-1 group-hover/from:translate-y-0.5 shrink-0" />
            </div>
            
            {/* Manual GPS location fetch */}
            <button
              type="button"
              onClick={handleAutoDetectGPS}
              disabled={isDetectingGPS}
              className="mt-2 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-2 py-1.5 rounded-lg transition-colors border border-emerald-200/50 dark:border-emerald-500/20 active:scale-95 type-button"
            >
              {isDetectingGPS ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              Lấy vị trí đón của tôi
            </button>
          </div>
        </div>

        {/* Reverse direction.
            The button floats over the divider line so it has to separate itself from the background: a white
            ring cuts the line running behind it, avoiding the feeling of being stuck to the stroke.
            44px touch target per Apple HIG (the icon stays 14px), and hover must change BOTH the background
            and the border — changing only the icon color is barely noticeable. */}
        <div className="relative h-px bg-slate-200 dark:bg-white/10 mx-4 sm:mx-5">
          <button
            type="button"
            onClick={swap}
            aria-label={t('search.swap')}
            title={t('search.swap')}
            className="group absolute right-1 -top-[22px] w-11 h-11 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-white/20 ring-4 ring-white dark:ring-[#1c1c1e] shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-[#0071e3] hover:border-[#0071e3] hover:text-white hover:shadow-lg hover:scale-110 focus-visible:bg-[#0071e3] focus-visible:text-white active:scale-90 transition-all duration-200 cursor-pointer type-button"
          >
            <ArrowUpDown className="w-4 h-4 transition-transform duration-300 group-hover:rotate-180" />
          </button>
        </div>

        {/* Destination */}
        <div className="group/to py-3 px-4 pr-16 sm:py-3.5 sm:px-5 sm:pr-16 flex items-center gap-3 hover:bg-blue-50/60 dark:hover:bg-blue-500/10 cursor-pointer transition-all rounded-2xl type-body">
          <MapPin className="w-5 h-5 text-[#0071e3] shrink-0 group-hover/to:scale-115 transition-transform" />
          <div className="flex-1 min-w-0 type-body">
            <label className="block text-slate-400 group-hover/to:text-[#0071e3] mb-0.5 cursor-pointer transition-colors type-label">
              {t('search.to')}
            </label>
            <div className="relative flex items-center">
              <select
                value={toHubId}
                onChange={(e) => setToHubId(e.target.value)}
                style={{ backgroundImage: 'none' }}
                className="tap-44 w-full appearance-none !bg-none bg-transparent pr-7 text-slate-900 dark:text-white group-hover/to:text-[#0071e3] outline-none cursor-pointer truncate transition-colors type-input"
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

        {/* ── DEPARTURE TIME: tier-1 data, on par with Origin / Destination ──
            One-tap chips replace the date picker: intercity travelers in practice
            only revolve around "chiều nay về" (back this afternoon), "tối nay đi" (leaving tonight), "sáng mai đi sớm" (leaving early tomorrow morning).
            [FEATURE FLAG COLD START - CRO]: Only HIDE the UI, ABSOLUTELY DO NOT DELETE.
            Avoids the "Click-to-Empty" trap when supply is low (1-2 vehicles/day).
            Re-enable (ENABLE_DEPARTURE_CHIPS = true) when each period (Morning-Noon-Afternoon) has at least 1 stable trip. */}
        {ENABLE_DEPARTURE_CHIPS && (
          <>
            <div className="h-px bg-slate-200 dark:bg-white/10 mx-4 sm:mx-5" />
            <div className="py-3.5 px-4 sm:py-4 sm:px-5 type-body">
              <label className="flex items-center gap-2 text-slate-400 mb-2.5 type-label">
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
                        // Learn silently, no asking, no notification
                        if (chip.windowId) writeStore(WINDOW_KEY, chip.windowId);
                      }}
                      aria-pressed={active}
                      className={`h-[52px] px-2 rounded-2xl border flex flex-col items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 type-button-sm ${
                        active
                          ? 'bg-[#0071e3] border-2 border-[#0071e3] text-white shadow-md shadow-[#0071e3]/30 scale-[1.01] hover:bg-[#0062c4] hover:border-[#0062c4] hover:shadow-lg'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:border-[#0071e3] hover:bg-blue-50/70 dark:hover:bg-blue-500/15 hover:text-[#0071e3] hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01]'
                      }`}
                    >
                      {/* Split label and time into two lines: on one line, on a 360px device
                          (common Android) the string "Chiều nay (16h30-18h)" (This afternoon (16:30-18:00)) gets truncated
                          exactly at the time part — losing the most important information itself. */}
                      <span className="truncate max-w-full type-button-sm">{chip.label}</span>
                      <span
                        className={`truncate max-w-full tabular type-caption ${
                          active ? 'text-white/80' : 'text-slate-400'
                        }`}
                      >
                        {chip.hint}
                      </span>
                    </button>
                  );
                })}

                {/* The 4th cell is always the way into the calendar. The picker appears RIGHT IN PLACE below,
                    absolutely no system popup — the Cursor spirit: zero blocking. */}
                <button
                  type="button"
                  onClick={() => setShowDatePanel((v) => !v)}
                  aria-expanded={showDatePanel}
                  className={`h-[52px] px-2 rounded-2xl border-2 flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-95 type-button-sm ${
                    showDatePanel
                      ? 'bg-slate-900 dark:bg-white/15 border-slate-900 dark:border-white/25 text-white shadow-sm hover:bg-slate-800'
                      : 'bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-300 hover:border-[#0071e3] hover:bg-blue-50/70 dark:hover:bg-blue-500/15 hover:text-[#0071e3] hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('search.pickAnotherDay')}</span>
                </button>
              </div>

              {/* IN-PLACE DATE PICKER — opens downward smoothly, does not block the flow */}
              {showDatePanel && (
                <div className="mt-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-300 dark:border-white/20 space-y-2.5 animate-fade-in shadow-2xs">
                  <div>
                    <label
                      htmlFor="carmate-pick-date"
                      className="block text-slate-400 mb-1 type-label"
                    >
                      {t('search.pickDate')}
                    </label>
                    <input
                      id="carmate-pick-date"
                      type="date"
                      value={pickDate}
                      min={todayIso}
                      onChange={(e) => setPickDate(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all cursor-pointer type-input"
                    />
                  </div>

                  <div>
                    <span className="block text-slate-400 mb-1 type-body">
                      {t('search.pickWindow')}
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DEPARTURE_WINDOWS.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setPickWindow(w.id)}
                          aria-pressed={w.id === pickWindow}
                          className={`h-12 rounded-xl border flex flex-col items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 type-button ${
                            w.id === pickWindow
                              ? 'bg-[#0071e3] border-[#0071e3] text-white shadow-sm shadow-[#0071e3]/25'
                              : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-300 hover:border-[#0071e3] hover:bg-blue-50/50 dark:hover:bg-blue-500/10'
                          }`}
                        >
                          <span>{w.label}</span>
                          {/* Time right below the label: "Sáng" (Morning) alone is ambiguous, and
                              the chips above all have times, so missing it here makes it inconsistent. */}
                          <span
                            className={`tabular type-caption ${
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
                    className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 cursor-pointer active:scale-[0.98] transition-all duration-150 shadow-sm type-button"
                  >
                    {t('search.applyDate')}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <div className="px-4 pb-3 flex items-center justify-between gap-3 type-body">
          <label htmlFor="carmate-search-seats" className="text-slate-600 dark:text-slate-300 type-label">Số người đi</label>
          <select id="carmate-search-seats" value={seatsNeeded} onChange={(e) => setSeatsNeeded(Number(e.target.value))} className="h-11 rounded-xl border border-slate-300 bg-white dark:bg-slate-900 px-3 type-input">
            {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n} người</option>)}
          </select>
        </div>
        <p className="px-4 pb-3 text-slate-500 type-caption">Trạm là mốc tìm chuyến. Hai bên có thể hẹn điểm đón khác. Tìm kiếm không tự đăng nhu cầu.</p>
        {/* ── ACTION BAR ── */}
        {ENABLE_DEPARTURE_CHIPS ? (
          <>
            <div className="h-px bg-slate-200 dark:bg-white/10" />
            <div className="py-3.5 px-4 sm:py-4 sm:px-5">
              <button
                type="button"
                onClick={() => handleSearchNow(true)}
                disabled={isSearching || !fromHubId || !toHubId}
                className="group relative overflow-hidden w-full h-13 min-h-[52px] rounded-2xl bg-[#0071e3] hover:bg-[#0062c4] border border-blue-400/40 hover:shadow-xl hover:shadow-[#0071e3]/45 hover:-translate-y-0.5 hover:scale-[1.008] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#0071e3] disabled:hover:shadow-md disabled:hover:translate-y-0 disabled:hover:scale-100 text-white flex items-center justify-center gap-2 shadow-md shadow-[#0071e3]/25 active:scale-[0.98] transition-all duration-200 cursor-pointer type-button"
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


            </div>
          </>
        ) : (
          <div className="p-3 sm:px-5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
            <span className="text-slate-500 dark:text-slate-400 tabular type-caption">
              ~{matrix?.distanceKm || '—'}km · Tuyến Quốc Lộ 13
            </span>
            <button
              type="button"
              onClick={() => setIsEditingRoute(false)}
              className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 transition-all cursor-pointer active:scale-95 type-button"
            >
              Xong / Thu gọn
            </button>
          </div>
        )}
      </section>
    )}

      {searchError && <p role="alert" className="p-3 text-rose-700 dark:text-rose-300 type-body">{searchError}</p>}
      {/* ── FULL-ROUTE SCHEDULE ACCORDION (CODE KEPT - HIDDEN DURING THE COLD START CRO PHASE) ── */}
      {ENABLE_TIMELINE_ACCORDION && !matrix && (
        <button
          type="button"
          onClick={() => {
            if (isDense) setShowTimeline((v) => !v);
            else onOpenIntentModal?.('passenger', fromHubId, toHubId, targetDepartureDate, targetDepartureTimeSlot, seatsNeeded);
          }}
          aria-expanded={isDense ? showTimeline : undefined}
          className="group w-full p-4 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-slate-300 dark:border-white/20 flex items-center justify-between gap-3 hover:border-[#0071e3] hover:bg-blue-50/40 dark:hover:bg-blue-500/10 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-150 cursor-pointer text-left shadow-2xs type-button"
        >
          <div className="flex items-center gap-3 min-w-0">
            {isDense ? (
              <Clock className="w-4 h-4 text-[#0071e3] shrink-0" />
            ) : (
              <MapPin className="w-4 h-4 text-[#0071e3] shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-slate-900 dark:text-white truncate group-hover:text-[#0071e3] transition-colors type-body-strong">
                {isDense ? t('search.viewTimeline') : t('search.scheduleTitle')}
              </p>
              <p className="text-slate-500 dark:text-slate-400 truncate type-caption">
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

      {/* FULL-ROUTE SCHEDULE TABLE — opens in place before any search */}
      {ENABLE_TIMELINE_ACCORDION && !matrix && isDense && showTimeline && timeline && (
        <section className="space-y-2.5 animate-fade-in">
          {timeline.periods.map((p) => (
            <div
              key={p.id}
              className="p-3.5 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-slate-300 dark:border-white/20 shadow-2xs space-y-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-slate-900 dark:text-white type-caption">
                  {p.label}
                  <span className="ml-1.5 text-slate-400 tabular type-body">{p.hint}</span>
                </p>
                <span className="text-slate-400 shrink-0 tabular type-caption">
                  {t('search.tripCount', { n: p.count })}
                </span>
              </div>

              {p.count > 0 ? (
                <div className="space-y-1.5 type-body">
                  {p.trips.map((trip) => (
                    <button
                      key={trip.tripId || trip.departureLabel}
                      type="button"
                      onClick={() => onOpenStationView?.(fromHubId, toHubId)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/10 hover:border-[#0071e3] hover:bg-blue-50/60 dark:hover:bg-blue-500/10 hover:shadow-xs hover:-translate-y-0.5 flex items-center justify-between gap-2 text-left transition-all cursor-pointer active:scale-[0.98] type-button"
                    >
                      <span className="flex items-center gap-2 min-w-0 type-body">
                        <span className="text-slate-900 dark:text-white shrink-0 tabular type-body-strong">
                          {trip.departureLabel}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 truncate type-body-strong">
                          {trip.assurance?.badge} {trip.vehicleModel || trip.driverName}
                        </span>
                      </span>
                      {trip.seatsAvailable != null && (
                        <span className="text-slate-500 shrink-0 tabular type-body">
                          {t('search.seatsLeft', { n: trip.seatsAvailable })}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenIntentModal?.('passenger', fromHubId, toHubId, targetDepartureDate, targetDepartureTimeSlot, seatsNeeded)}
                  className="mt-1 w-full min-h-[44px] rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-400 hover:border-[#0071e3] hover:bg-blue-50/50 dark:hover:bg-blue-500/10 hover:text-[#0071e3] hover:shadow-xs hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer type-button"
                >
                  {t('search.emptyPeriodCta')}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── TRIP LOADING-STATE SKELETON (Zero Layout Shift & Smooth) ── */}
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

      {/* ── 3-TIER TRANSPORT COMPARISON TABLE (HORIZONTAL GLANCEABLE-LINE STYLE) ── */}
      {matrix && (
        <section ref={resultsRef} className="space-y-3 pt-1 animate-fade-in">
          {/* Summary header: Tidy title & Badge with the posting driver's info */}
          <div className="flex items-center justify-between gap-1.5 px-1 pb-0.5">
            <p className="text-slate-800 dark:text-slate-200 truncate type-caption">
              {carmateDisplayTrips.length > 0 ? `${carmateDisplayTrips.length} chuyến phù hợp` : 'Chưa có chuyến phù hợp'}
            </p>
            <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shrink-0 whitespace-nowrap bg-white dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-white/10 shadow-xs type-badge">

              Thông tin chủ xe đăng
            </span>
          </div>

          {/* GROUP 1: CARMATE PASSING-VEHICLE MATCHES (CONDENSED SCANNABLE LIST) */}
          {carmateDisplayTrips.length > 0 ? (
            <div className="space-y-2 sm:space-y-2.5">
              {carmateDisplayTrips.map((trip, idx) => {
                const isMyTrip = checkIsMyTrip ? checkIsMyTrip(trip) : false;
                return (
                  <CorridorTripCard
                    key={trip.tripId || trip.id || trip.departureLabel}
                    trip={trip}
                    isEarliest={idx === 0}
                    isMyTrip={isMyTrip}
                    onSelectTrip={(selectedTrip) => {
                      setSelectedDetailTrip(selectedTrip);
                    }}
                    onBookNow={(selectedTrip) => {
                      setSelectedDetailTrip(selectedTrip);
                    }}
                    onManageTrip={(tripToManage) => {
                      if (onManageTrip) onManageTrip(tripToManage);
                      else if (onOpenCockpit) onOpenCockpit();
                    }}
                  />
                );
              })}

              {/* ⭐️ PRIORITY #1: COLLECT OFF-TIME DEMAND (PRE-BOOKING - PRESERVES THE CONVERSION FUNNEL) */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-slate-200 dark:border-white/10 text-center space-y-2 shadow-sm">
                <p className="text-slate-700 dark:text-slate-300 type-caption">
                  Chưa tìm thấy giờ phù hợp lịch trình?
                </p>
                <button
                  type="button"
                  onClick={() => onOpenIntentModal?.('passenger', fromHubId, toHubId, targetDepartureDate, targetDepartureTimeSlot, seatsNeeded)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0071e3] hover:bg-[#0062c4] active:scale-[0.99] text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 type-button"
                >
                  <span>⚡ Đăng nhu cầu theo giờ của bạn</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-amber-50/40 via-white to-slate-50/40 dark:from-amber-950/20 dark:via-[#1c1c1e] dark:to-[#1c1c1e] border border-amber-300/60 dark:border-amber-500/30 ring-1 ring-black/[0.04] dark:ring-white/[0.06] shadow-[0_12px_36px_rgba(245,158,11,0.08),0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.4)] text-center space-y-4">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 bg-amber-500/10 dark:bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

              {/* Top badge per State 2: ⚡ "Ghép xe theo giờ của bạn" (Match a ride by your time) (Orange) */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 dark:bg-amber-400/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 select-none shadow-2xs type-caption">
                <span className="text-amber-600 dark:text-amber-400">⚡</span>
                <span>{heading === 'a_to_b' ? 'Báo giờ bạn cần về Bình Phước' : 'Ghép xe theo giờ của bạn'}</span>
              </div>

              <div className="relative space-y-1.5">
                <p className="text-slate-900 dark:text-white type-body-strong">
                  Chưa có chuyến phù hợp với ngày, giờ và số người bạn chọn
                </p>
                <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto type-caption">
                  Bạn có thể đổi khung giờ, liên hệ nhà xe hoặc chủ động đăng nhu cầu để chủ xe phù hợp tìm thấy. Đăng nhu cầu chưa phải có xe nhận đón.
                </p>
              </div>
              <div className="relative pt-0.5 space-y-2.5 type-body">
                <button
                  type="button"
                  onClick={() => onOpenIntentModal?.('passenger', fromHubId, toHubId, targetDepartureDate, targetDepartureTimeSlot, seatsNeeded)}
                  className="h-11 sm:h-12 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-md shadow-amber-500/25 hover:shadow-lg hover:shadow-amber-500/35 hover:-translate-y-0.5 active:scale-95 type-button"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>
                    ĐĂNG NHU CẦU TÌM XE
                  </span>
                </button>

                {/* Real reputation badges & Social Proof */}
                <div className="pt-1 space-y-1">
                  <p className="text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5 type-body">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Kết nối miễn phí · Điểm đón do hai bên xác nhận</span>
                  </p>
                  <p className="text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1 type-caption">
                    <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>
                      Chưa có chủ xe nhận đón. Bạn không cần ra trạm lúc này.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}


        </section>
      )}

      <OperatorDirectory
        corridor={corridor.dataKey}
        currentUser={currentUser}
        onRequireAuth={onRequireAuth}
      />

      {/* ── TRIP DETAIL BOTTOM SHEET (PROGRESSIVE DISCLOSURE) ── */}
      {selectedDetailTrip && (
        <TripDetailBottomSheet
          isOpen={Boolean(selectedDetailTrip)}
          onClose={() => setSelectedDetailTrip(null)}
          trip={selectedDetailTrip}
          initialSeats={seatsNeeded}
          isMyTrip={checkIsMyTrip ? checkIsMyTrip(selectedDetailTrip) : false}
          onManageTrip={(tripToManage) => {
            setSelectedDetailTrip(null);
            if (onManageTrip) onManageTrip(tripToManage);
            else if (onOpenCockpit) onOpenCockpit();
          }}
          originName={fromHub?.name || matrix?.origin?.landmark || matrix?.origin?.name || 'Cây xăng Petrolimex Tân Khai (QL13)'}
          destName={toHub?.name || matrix?.destination?.landmark || matrix?.destination?.name || 'Cụm BV Chợ Rẫy / BV Đại học Y Dược'}
          onConfirmBook={(tripToBook, bookedSeats = 1) => {
            setSelectedDetailTrip(null);
            setSelectedBookingTrip({ ...tripToBook, initialSeats: bookedSeats });
          }}
        />
      )}

      {/* ── INSTANT RESERVATION MODAL (3-STEP MATCH & REVEAL) ── */}
      {selectedBookingTrip && (
        <InstantBookingModal
          onRequireAuth={onRequireAuth}
          isOpen={Boolean(selectedBookingTrip)}
          onClose={() => setSelectedBookingTrip(null)}
          onViewBookedTab={(tab, booking) => {
            if (booking) {
              onBookingCreated?.(booking);
            }
            setSelectedBookingTrip(null);
            onViewBookedTab?.(tab, booking);
          }}
          trip={selectedBookingTrip}
          originHub={matrix?.origin}
          destinationHub={matrix?.destination}
          currentUser={currentUser}
          onAuthSuccess={onAuthSuccess}
          onBookingSuccess={(booking) => {
            onBookingCreated?.(booking);
          }}
          onShowToast={onShowToast}
        />
      )}

    </div>
  );
}
