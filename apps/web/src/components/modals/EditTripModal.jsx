import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Edit3,
  Clock,
  Users,
  Car,
  DollarSign,
  MapPin,
  FileText,
  CheckCircle2,
  ArrowLeftRight,
  Sparkles,
  Navigation,
  Plus,
  Check,
  CornerDownLeft,
  Lock,
  Unlock,
  Trash2,
  AlertTriangle,
  Camera,
  Upload,
  ShieldCheck,
  Crosshair,
  Truck,
  Package,
  Box
} from 'lucide-react';
import {
  TIME_SLOTS,
  formatVND,
  mapTimeToSlot,
  isTimeInSlot,
  VEHICLE_SEAT_CONFIGS,
  normalizePhotoUrl,
  VIRTUAL_HUBS,
  getVirtualHubById,
  getFixedSegmentTariff,
  getDefaultCorridor
} from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { getSuggestedWaypoints } from '../../utils/vietnamLocations.js';
import { processCarPhotoUpload } from '../../utils/plateMasker.js';
import PlateMaskModal from './PlateMaskModal.jsx';
import { useI18n } from '../../i18n/index.jsx';

const DEFAULT_CORRIDOR = getDefaultCorridor();

/**
 * Dò một chuyến cũ (lưu điểm đi/đến bằng chữ tự do) về mã trạm ảo.
 * Ưu tiên mã trạm đã lưu; không có thì so khớp tên trạm với chuỗi người dùng gõ.
 * Dò không ra trả về chuỗi rỗng để form buộc Chủ xe chọn lại đúng trạm.
 */
function resolveHubId(explicitHubId, freeText) {
  if (explicitHubId && getVirtualHubById(explicitHubId)) return explicitHubId;

  const raw = String(freeText || '').trim().toLowerCase();
  if (!raw) return '';

  // So khớp tên dài trước để "ngã 4 bình phước" không bị "bình phước" nuốt mất
  const candidates = [...VIRTUAL_HUBS]
    .map((h) => ({ hub: h, key: String(h.shortName || h.name || '').toLowerCase() }))
    .filter((c) => c.key)
    .sort((a, b) => b.key.length - a.key.length);

  const hit = candidates.find((c) => raw.includes(c.key) || c.key.includes(raw));
  return hit ? hit.hub.id : '';
}

export default function EditTripModal({ trip, onClose, onSave, onToggleStatus, onDelete }) {
  const { t } = useI18n();
  // Hook phải gọi trước mọi early return (Rules of Hooks)

  const isDriver = trip?.type === 'driver_offer';
  const [currentStatus, setCurrentStatus] = useState(trip?.status || 'active');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // ── TỌA ĐỘ MA TRẬN: trạm đón/trả là lựa chọn từ danh mục trạm ảo, không gõ tay ──
  // Chuyến cũ lưu điểm đi/đến bằng chữ tự do, nên phải dò ngược về mã trạm một lần
  // khi mở form. Dò không ra thì để trống và bắt Chủ xe chọn lại cho đúng trạm.
  const [originHubId, setOriginHubId] = useState(() => resolveHubId(trip?.originHubId, trip?.from));
  const [destHubId, setDestHubId] = useState(() => resolveHubId(trip?.destinationHubId, trip?.to));

  // Chuyến đã có khách đặt thì tọa độ bị khoá cứng (xem BẤT BIẾN TỌA ĐỘ ở API).
  // Máy chủ trả về `bookedSeatsCount` (tripController) và kèm mảng `bookings`;
  // đọc sai tên trường thì khoá không bao giờ hiện, Chủ xe sửa xong mới ăn 409.
  const activeBookingCount = Number(
    trip?.bookedSeatsCount ??
      (Array.isArray(trip?.bookings) ? trip.bookings.length : 0) ??
      0
  );
  const isMatrixLocked = activeBookingCount > 0;
  const [vehicleCapacity, setVehicleCapacity] = useState(() => {
    if (trip?.vehicleType === 'truck_light' || trip?.isCargoVehicle || (trip?.carType && /xe tải|tải nhẹ|k200|k250|porter|h150|qkr/i.test(trip?.carType))) {
      return 'truck_light';
    }
    if (trip?.vehicleType === 'pickup' || trip?.hasCargoBed || (trip?.carType && /bán tải|ranger|hilux|triton|d-max/i.test(trip?.carType))) {
      return 'pickup';
    }
    if (trip?.capacity === 7 || (trip?.availableSeats && trip.availableSeats > 4)) return 7;
    return 5;
  });
  const [acceptsParcel, setAcceptsParcel] = useState(() => Boolean(trip?.acceptsParcel || trip?.vehicleType === 'truck_light' || trip?.vehicleType === 'pickup' || trip?.hasCargoBed));
  const [cargoNotes, setCargoNotes] = useState(() => trip?.cargoNotes || '');
  const [seats, setSeats] = useState(() => {
    const raw = trip?.availableSeats || trip?.seatsNeeded || 3;
    const isTruck = trip?.vehicleType === 'truck_light' || trip?.isCargoVehicle;
    if (isTruck) return 1;
    const max = trip?.capacity === 7 || (trip?.availableSeats && trip.availableSeats > 4) ? 6 : 4;
    return Math.min(raw, isDriver ? max : 6);
  });
  const [date, setDate] = useState(trip?.date || 'Hôm nay');
  const [timeSlot, setTimeSlot] = useState(trip?.timeSlot || '07:00-09:00');
  const [exactTime, setExactTime] = useState(trip?.exactTime || '');
  const [waypointNote, setWaypointNote] = useState(trip?.waypointNote || '');
  const [notes, setNotes] = useState(trip?.notes || '');
  const [saving, setSaving] = useState(false);
  const [carType, setCarType] = useState(() => {
    if (trip?.carType) return trip.carType;
    if (trip?.vehicleType === 'truck_light' || trip?.isCargoVehicle) return 'Kia K250 (Xe tải 2.4T)';
    if (trip?.vehicleType === 'pickup' || trip?.hasCargoBed) return 'Ford Ranger (Xe bán tải)';
    if (trip?.capacity === 7) return 'Mitsubishi Xpander (Xe 7 chỗ)';
    return 'Toyota Vios (Xe 5 chỗ)';
  });
  const [plateMask, setPlateMask] = useState(
    () => trip?.plateMask || trip?.plate || trip?.licensePlate || ''
  );
  const [carPhotos, setCarPhotos] = useState(() => {
    if (!Array.isArray(trip?.carPhotos)) return [];
    return trip.carPhotos.map((photo, idx) => {
      if (!photo) return null;
      if (typeof photo === 'string') {
        const norm = normalizePhotoUrl(photo);
        return {
          angle: idx === 0 ? 'front' : idx === 1 ? 'back' : 'side',
          label: idx === 0 ? 'Góc Trước' : idx === 1 ? 'Góc Sau' : `Góc ${idx + 1}`,
          url: norm,
          originalUrl: norm,
          isMasked: false,
          caption: `Ảnh ${idx === 0 ? 'Góc Trước' : idx === 1 ? 'Góc Sau' : `Góc ${idx + 1}`}`
        };
      }
      const normUrl = normalizePhotoUrl(photo?.url);
      const normOrig = normalizePhotoUrl(photo?.originalUrl || photo?.url);
      return {
        ...photo,
        url: normUrl,
        originalUrl: normOrig || normUrl
      };
    }).filter(Boolean);
  });
  const [editingMaskIndex, setEditingMaskIndex] = useState(null);

  // Bài đăng gốc vốn có ảnh hay không, và người dùng có chủ động thêm/bớt ảnh trong phiên này không.
  // Dùng để không gửi carPhotos rỗng (xóa sạch ảnh trên máy chủ) khi form chỉ đơn giản là không đọc được ảnh cũ.
  const hadOriginalPhotos = useRef(Array.isArray(trip?.carPhotos) && trip.carPhotos.length > 0).current;
  const photosTouchedRef = useRef(false);

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    if (carPhotos.length >= 5) return;
    try {
      const nextIndex = carPhotos.length;
      const slotId = nextIndex === 0 ? 'front' : nextIndex === 1 ? 'back' : 'side';
      const slotLabel = nextIndex === 0 ? 'Góc Trước' : nextIndex === 1 ? 'Góc Sau' : `Góc ${nextIndex + 1}`;
      const result = await processCarPhotoUpload(file, slotId);
      photosTouchedRef.current = true;
      setCarPhotos((prev) => [
        ...prev,
        {
          angle: slotId,
          label: slotLabel,
          url: result.maskedUrl,
          originalUrl: result.originalUrl,
          isMasked: result.isMasked,
          maskPos: result.maskPos,
          caption: `Ảnh ${slotLabel}`
        }
      ]);
    } catch (err) {
      console.warn('[EditTripModal] Lỗi tải ảnh:', err);
    }
  };

  const handleRemovePhoto = (slotIndex) => {
    photosTouchedRef.current = true;
    setCarPhotos((prev) => prev.filter((_, idx) => idx !== slotIndex));
  };

  // Chuyển đổi nhanh trạng thái nhận khách / đóng chỗ
  const handleToggleCurrentStatus = async () => {
    const newStatus = currentStatus === 'full' ? 'active' : 'full';
    setCurrentStatus(newStatus);
    if (onToggleStatus) {
      await onToggleStatus(trip.id, newStatus);
    }
  };

  // Thực thi xoá chuyến an toàn
  const handleExecuteDelete = async () => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete(trip.id);
      onClose();
    } catch (err) {
      console.error('Lỗi xoá chuyến đi:', err);
    } finally {
      setDeleting(false);
    }
  };

  const originHub = useMemo(() => getVirtualHubById(originHubId) || null, [originHubId]);
  const destHub = useMemo(() => getVirtualHubById(destHubId) || null, [destHubId]);

  // Danh mục trạm ảo của hành lang, dùng cho cả hai ô chọn trạm
  const corridorHubs = useMemo(() => {
    return VIRTUAL_HUBS.filter((h) => h.corridor === DEFAULT_CORRIDOR.dataKey);
  }, []);

  // ── GIÁ LÀ ĐẦU RA CỦA CÔNG THỨC ──
  // Chủ xe không gõ giá. Chọn xong cặp trạm là giá hiện ra, đúng bằng con số
  // máy chủ sẽ tính lại khi lưu (cùng một hàm getFixedSegmentTariff).
  const tariff = useMemo(() => {
    if (!originHubId || !destHubId || originHubId === destHubId) return null;
    return getFixedSegmentTariff(originHubId, destHubId);
  }, [originHubId, destHubId]);

  const price = tariff?.pricePerSeat ?? Number(trip?.basePricePerSeat || trip?.expectedPrice || 0);

  // Đảo chiều trạm đón ⇄ trạm trả
  const handleSwapRoute = () => {
    if (isMatrixLocked) return;
    setOriginHubId(destHubId);
    setDestHubId(originHubId);
  };

  // Tính toán gợi ý mốc đón trả thông minh theo tuyến hiện tại
  const suggestedWaypoints = useMemo(() => {
    return getSuggestedWaypoints(originHub?.shortName || '', destHub?.shortName || '');
  }, [originHub, destHub]);

  // Thêm nhanh mốc đón trả vào ô ghi chú
  const handleAddWaypoint = (wp) => {
    if (!waypointNote.trim()) {
      setWaypointNote(wp);
    } else if (!waypointNote.includes(wp)) {
      setWaypointNote(`${waypointNote.trim()}, ${wp}`);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    if (!originHub || !destHub || originHubId === destHubId) return;
    setSaving(true);

    const slot = TIME_SLOTS.find((s) => s.id === timeSlot) || TIME_SLOTS[2];

    // Tên hiển thị lấy thẳng từ danh mục trạm ảo, nên không còn khả năng rò rỉ
    // từ khoá xe / số ghế vào tên địa danh như hồi còn cho gõ chữ tự do.
    const cleanFrom = originHub.shortName || originHub.name;
    const cleanTo = destHub.shortName || destHub.name;
    const derivedRoute = `${cleanFrom} ⇄ ${cleanTo}`;

    const isExactTimeValid = exactTime && isTimeInSlot(exactTime.trim(), timeSlot);
    const validExactTime = isExactTimeValid ? exactTime.trim() : undefined;
    const timeSlotLabel = validExactTime ? `${validExactTime} (${slot.short})` : slot.short;

    const validPhotos = (carPhotos || []).filter(Boolean);
    // Chỉ gửi carPhotos khi có ảnh thật, khi bài đăng vốn không có ảnh, hoặc khi người dùng
    // chủ động thêm/bớt ảnh. Nếu bài đăng gốc CÓ ảnh mà form đọc ra rỗng (dữ liệu ảnh cũ
    // không phân giải được), gửi mảng rỗng sẽ xóa sạch ảnh thật trên máy chủ.
    const shouldSendPhotos =
      isDriver && (validPhotos.length > 0 || !hadOriginalPhotos || photosTouchedRef.current);
    const updates = {
      from: cleanFrom,
      to: cleanTo,
      originHubId,
      destinationHubId: destHubId,
      pickupSpot: originHub.landmark || cleanFrom,
      dropoffSpot: destHub.landmark || cleanTo,
      route: derivedRoute,
      capacity: isDriver ? (vehicleCapacity === 'truck_light' ? 2 : vehicleCapacity === 'pickup' ? 5 : Number(vehicleCapacity)) : undefined,
      vehicleCapacity: isDriver ? vehicleCapacity : undefined,
      vehicleType: isDriver ? (vehicleCapacity === 'truck_light' ? 'truck_light' : vehicleCapacity === 'pickup' ? 'pickup' : (vehicleCapacity === 7 ? 'mpv_suv' : 'sedan_cuv')) : undefined,
      hasCargoBed: isDriver ? (vehicleCapacity === 'truck_light' || vehicleCapacity === 'pickup' || Boolean(trip?.hasCargoBed)) : undefined,
      isCargoVehicle: isDriver ? Boolean(vehicleCapacity === 'truck_light') : undefined,
      cargoBedCapacityKg: isDriver ? (vehicleCapacity === 'truck_light' ? 2500 : vehicleCapacity === 'pickup' ? 800 : undefined) : undefined,
      acceptsParcel: isDriver ? Boolean(acceptsParcel || vehicleCapacity === 'truck_light' || vehicleCapacity === 'pickup') : undefined,
      cargoNotes: isDriver && cargoNotes.trim() ? cargoNotes.trim() : undefined,
      carType: isDriver ? carType.trim() : undefined,
      carPhotos: shouldSendPhotos ? validPhotos : undefined,
      hasCarPhotos: shouldSendPhotos ? validPhotos.length > 0 : undefined,
      plateMask: isDriver && plateMask.trim() ? plateMask.trim() : undefined,
      // Không gửi giá lên máy chủ: giá là đầu ra của công thức nền tảng,
      // máy chủ tự tính lại từ cặp trạm (xem BẤT BIẾN GIÁ ở tripController).
      expectedPrice: !isDriver ? Number(price) : undefined,
      availableSeats: isDriver ? Number(seats) : undefined,
      seatsNeeded: !isDriver ? Number(seats) : undefined,
      date,
      timeSlot,
      exactTime: validExactTime,
      timeSlotLabel,
      waypointNote: waypointNote.trim(),
      notes: notes.trim()
    };

    try {
      await onSave(trip.id, updates);
      onClose();
    } catch (err) {
      console.error('Lỗi lưu cập nhật chuyến đi:', err);
    } finally {
      setSaving(false);
    }
  };

  // Bắt phím tắt ⌘+Enter (Mac) hoặc Ctrl+Enter (Win) để lưu nhanh chuẩn Cursor
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
    // Deps đã liệt kê đủ mọi trường mà handleSubmit đọc, nên phím tắt luôn gửi
    // dữ liệu mới nhất. ESLint chỉ đòi thêm vì theo dõi danh tính hàm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originHubId, destHubId, seats, vehicleCapacity, date, timeSlot, waypointNote, notes, saving]);

  const quickDates = ['Hôm nay', 'Ngày mai', 'Thứ 7', 'Chủ nhật'];
  const currentSeatConfig = VEHICLE_SEAT_CONFIGS[vehicleCapacity] || VEHICLE_SEAT_CONFIGS[5];
  const seatOptions = isDriver ? currentSeatConfig.allowedSeats : [1, 2, 3, 4, 5, 6];

  if (!trip) return null;

  return (
    <>
      <Modal
      onClose={onClose}
      size="lg"
      icon={Edit3}
      iconTone="brand"
      title={`Chỉnh Sửa Bài Đăng (${trip.maskedCode})`}
      subtitle={
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20">
            {isDriver ? 'Chủ xe' : 'Hành khách'}
          </span>
          {onToggleStatus && (
            <button
              type="button"
              onClick={handleToggleCurrentStatus}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all inline-flex items-center gap-1.5 ${
                currentStatus === 'full'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800/80 hover:bg-slate-100 hover:text-slate-700'
              }`}
              title={
                currentStatus === 'full'
                  ? isDriver
                    ? 'Bấm để mở lại nhận khách'
                    : 'Bấm để tiếp tục tìm xe'
                  : isDriver
                    ? 'Bấm để tạm khóa (đã đủ người)'
                    : 'Bấm để tạm khóa (đã có xe)'
              }
            >
              {currentStatus === 'full' ? (
                <>
                  <Lock className="w-3 h-3 text-slate-600" />
                  <span>{isDriver ? 'Đã đủ người (Mở lại)' : 'Đã có xe (Mở lại)'}</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{isDriver ? 'Đang nhận khách (Khóa lại)' : 'Đang tìm xe (Khóa lại)'}</span>
                </>
              )}
            </button>
          )}
          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            {t('editTrip.s001')}
          </span>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          {onDelete && !confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || deleting}
              className="text-xs sm:text-[13px] text-rose-600 dark:text-rose-400 hover:text-rose-700 font-bold px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
              title={isDriver ? 'Xoá bài đăng chuyến này' : 'Xoá bài tìm xe này'}
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDriver ? 'Xóa chuyến' : 'Xóa bài tìm xe'}</span>
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving || deleting} className="font-semibold text-slate-700 dark:text-slate-200">
              {t('editTrip.s002')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={saving || deleting}
              className="px-6 font-bold shadow-md shadow-[#0071e3]/20 bg-[#0071e3] hover:bg-[#0077ed] text-white"
            >
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {/* ── BANNER XÁC NHẬN XOÁ BÀI ĐĂNG (ZERO BLOCKING MODAL) ── */}
        {confirmDelete && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 space-y-2.5 shadow-2xs">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-xs sm:text-[13px]">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{t('editTrip.s003')}</span>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
              {t('editTrip.s004')}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {t('editTrip.s005')}
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={deleting}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Đang xoá...' : 'Xác nhận xoá vĩnh viễn'}</span>
              </button>
            </div>
          </div>
        )}
        {/* ── 1. LỘ TRÌNH ĐIỀU CHỈNH ĐƯỢC + GỢI Ý ĐỊA ĐIỂM ── */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#f5f5f7] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-[#0071e3]" />
              <span>{t('editTrip.s006')}</span>
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('editTrip.s007')}</span>
          </div>

          {isMatrixLocked && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300/60 dark:border-amber-400/25">
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] sm:text-xs font-medium text-amber-800 dark:text-amber-200 leading-relaxed">
                Chuyến đã có <strong>{activeBookingCount} khách</strong> giữ chỗ theo đúng lộ trình và khung giờ này,
                nên trạm đón/trả đã được khoá. Muốn đổi lộ trình, vui lòng huỷ chuyến rồi đăng chuyến mới.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] gap-x-3 gap-y-2 items-start">
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-2xs" />
                <span>Trạm đón</span>
                <span className="text-rose-500 text-xs">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={originHubId}
                  onChange={(e) => setOriginHubId(e.target.value)}
                  disabled={isMatrixLocked}
                  className="w-full h-11 pl-9 pr-8 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">— Chọn trạm đón —</option>
                  {corridorHubs.map((h) => (
                    <option key={h.id} value={h.id} disabled={h.id === destHubId}>
                      {h.shortName || h.name}
                    </option>
                  ))}
                </select>
              </div>
              {originHub?.landmark && (
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-snug">
                  {originHub.landmark}
                </p>
              )}
            </div>

            <div className="flex justify-center sm:pt-7">
              <button
                type="button"
                onClick={handleSwapRoute}
                disabled={isMatrixLocked}
                title="Đảo chiều trạm đón / trạm trả"
                className="w-9 h-9 rounded-full border border-black/[0.1] dark:border-white/10 bg-white dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 hover:text-[#0071e3] hover:border-[#0071e3] shadow-xs flex items-center justify-center cursor-pointer active:scale-90 active:rotate-180 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-700 disabled:hover:border-black/[0.1]"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 shadow-2xs" />
                <span>Trạm trả</span>
                <span className="text-rose-500 text-xs">*</span>
              </label>
              <div className="relative">
                <Navigation className="w-4 h-4 text-rose-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={destHubId}
                  onChange={(e) => setDestHubId(e.target.value)}
                  disabled={isMatrixLocked}
                  className="w-full h-11 pl-9 pr-8 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 shadow-2xs appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">— Chọn trạm trả —</option>
                  {corridorHubs.map((h) => (
                    <option key={h.id} value={h.id} disabled={h.id === originHubId}>
                      {h.shortName || h.name}
                    </option>
                  ))}
                </select>
              </div>
              {destHub?.landmark && (
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-snug">
                  {destHub.landmark}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3] shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Đón và trả 100% tại trạm cố định mặt tiền quốc lộ — khách không phải chỉ đường, chủ xe không phải vào hẻm.
            </p>
          </div>
        </div>

        {/* ── 2. TRỤC ĐƯỜNG ĐÓN TRẢ + GỢI Ý THÔNG MINH THEO TUYẾN ── */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#f5f5f7] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="block text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#0071e3]" />
              <span>{t('editTrip.s013')}</span>
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('editTrip.s014')}</span>
          </div>

          <input
            type="text"
            value={waypointNote}
            onChange={(e) => setWaypointNote(e.target.value)}
            placeholder={t('editTrip.s038')}
            className="w-full h-10 px-3.5 rounded-xl text-xs sm:text-sm font-medium bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 shadow-2xs"
          />

          {/* Quick Clickable Waypoint Chips */}
          <div className="pt-1 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1 mr-1 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('editTrip.s015')}</span>
            </span>
            {suggestedWaypoints.map((wp) => {
              const isAdded = waypointNote.includes(wp);
              return (
                <button
                  key={wp}
                  type="button"
                  onClick={() => handleAddWaypoint(wp)}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                    isAdded
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                      : 'bg-white hover:bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-black/[0.08] dark:border-white/[0.1] hover:border-[#0071e3] hover:text-[#0071e3]'
                  }`}
                >
                  {isAdded ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                  <span>{wp}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 2.5. QUY MÔ, DÒNG XE & HÌNH ẢNH XE THỰC TẾ ── */}
        {isDriver && (
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#f5f5f7] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] space-y-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs sm:text-[13px]">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                {vehicleCapacity === 'truck_light' ? (
                  <Truck className="w-4 h-4 text-emerald-600" />
                ) : vehicleCapacity === 'pickup' ? (
                  <Truck className="w-4 h-4 text-amber-600" />
                ) : (
                  <Car className="w-4 h-4 text-[#0071e3]" />
                )}
                <span>{t('editTrip.s016')}</span>
              </span>
              <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                {vehicleCapacity === 'truck_light'
                  ? '🚛 Xe tải nhẹ (Cabin 1 khách + Thùng 1T–3.5T)'
                  : vehicleCapacity === 'pickup'
                    ? '🛻 Xe bán tải (Cabin 4 khách + Thùng ~800kg)'
                    : vehicleCapacity === 7
                      ? '🚙 Xe 7 chỗ (Tối đa 6 khách)'
                      : '🚗 Xe 4–5 chỗ (Tối đa 4 khách)'}
              </span>
            </div>

            {/* Quy mô 4-5 chỗ vs 7 chỗ vs Bán tải vs Xe tải nhẹ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-[#e5e5ea] dark:bg-slate-800/80 border border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setVehicleCapacity(5);
                  if (seats > 4) setSeats(4);
                  if (carType.includes('Xpander') || carType.includes('7 chỗ') || carType.includes('Ranger') || carType.includes('bán tải') || carType.includes('K250') || carType.includes('tải')) {
                    setCarType('Toyota Vios (Xe 5 chỗ)');
                  }
                }}
                className={`py-2.5 px-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap select-none ${
                  vehicleCapacity === 5
                    ? 'bg-white dark:bg-slate-900 text-[#0071e3] dark:text-sky-400 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-black/[0.04] dark:border-white/[0.08]'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{t('editTrip.s017')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVehicleCapacity(7);
                  if (carType.includes('Vios') || carType.includes('5 chỗ') || carType.includes('Ranger') || carType.includes('bán tải') || carType.includes('K250') || carType.includes('tải')) {
                    setCarType('Mitsubishi Xpander (Xe 7 chỗ)');
                  }
                }}
                className={`py-2.5 px-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap select-none ${
                  vehicleCapacity === 7
                    ? 'bg-white dark:bg-slate-900 text-[#0071e3] dark:text-sky-400 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-black/[0.04] dark:border-white/[0.08]'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{t('editTrip.s018')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVehicleCapacity('pickup');
                  setAcceptsParcel(true);
                  if (seats > 4) setSeats(4);
                  if (!carType.includes('Ranger') && !carType.includes('bán tải') && !carType.includes('Hilux')) {
                    setCarType('Ford Ranger (Xe bán tải)');
                  }
                }}
                className={`py-2.5 px-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap select-none ${
                  vehicleCapacity === 'pickup'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-black/[0.04] dark:border-white/[0.08]'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{t('editTrip.s019')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVehicleCapacity('truck_light');
                  setAcceptsParcel(true);
                  setSeats(1);
                  if (!carType.includes('K250') && !carType.includes('Porter') && !carType.includes('tải')) {
                    setCarType('Kia K250 (Xe tải 2.4T)');
                  }
                }}
                className={`py-2.5 px-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap select-none ${
                  vehicleCapacity === 'truck_light'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-black/[0.04] dark:border-white/[0.08]'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{t('editTrip.s020')}</span>
              </button>
            </div>

            {/* Dòng xe cụ thể + Biển số */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('editTrip.s021')}
                </label>
                <input
                  type="text"
                  value={carType}
                  onChange={(e) => setCarType(e.target.value)}
                  placeholder="VD: Mazda 3, Veloz Cross, Xpander, Kia K250..."
                  className="w-full h-10 px-3.5 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('editTrip.s022')}
                </label>
                <input
                  type="text"
                  value={plateMask}
                  onChange={(e) => setPlateMask(e.target.value)}
                  placeholder={t('editTrip.s039')}
                  className="w-full h-10 px-3.5 rounded-xl text-xs sm:text-sm font-mono font-bold bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] shadow-2xs"
                />
              </div>
            </div>

            {/* Preset chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('editTrip.s023')}</span>
              {(vehicleCapacity === 'truck_light'
                ? ['Kia K200/K250', 'Hyundai Porter H150', 'Isuzu QKR', 'Suzuki Carry Pro', 'Thaco Towner']
                : vehicleCapacity === 'pickup'
                  ? ['Ford Ranger', 'Toyota Hilux', 'Mitsubishi Triton', 'Isuzu D-Max', 'Nissan Navara']
                  : vehicleCapacity === 7
                    ? ['Mitsubishi Xpander', 'Toyota Veloz Cross', 'Toyota Innova', 'Kia Carnival', 'VinFast VF8']
                    : ['Toyota Vios', 'Mazda 3', 'Hyundai Accent', 'Honda City', 'Kia K3', 'VinFast VF5']
              ).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    setCarType(
                      `${preset} (${vehicleCapacity === 'truck_light' ? 'Xe tải nhẹ' : vehicleCapacity === 'pickup' ? 'Xe bán tải' : `Xe ${vehicleCapacity} chỗ`})`
                    )
                  }
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-black/[0.1] dark:border-white/[0.1] transition-colors cursor-pointer shadow-2xs"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Nhận chở đồ / Thùng hàng bán tải */}
            <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptsParcel}
                  onChange={(e) => setAcceptsParcel(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                />
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t('editTrip.s024')}</span>
                </span>
              </label>

              {acceptsParcel && (
                <input
                  type="text"
                  value={cargoNotes}
                  onChange={(e) => setCargoNotes(e.target.value)}
                  placeholder={
                    vehicleCapacity === 'pickup'
                      ? 'VD: Thùng bán tải có nắp cuộn chống nước, nhận chuyển trọ sinh viên, nông sản quê...'
                      : 'VD: Cốp rộng rãi nhận thùng xốp hoa quả, hải sản dán kín, bưu kiện gia đình...'
                  }
                  className="w-full text-xs p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-white dark:bg-[#151c2e] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
                />
              )}
            </div>

            {/* Quản lý ảnh xe thật */}
            <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Hình ảnh xe thực tế ({carPhotos.filter(Boolean).length}/5):</span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {t('editTrip.s025')}
                </span>
              </div>

              {/* Danh sách ảnh hiện tại & Nút tải thêm */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {carPhotos.map((photo, idx) => {
                  if (!photo) return null;
                  const photoUrl = normalizePhotoUrl(photo);
                  return (
                    <div
                      key={idx}
                      className="relative w-22 aspect-[4/3] rounded-xl overflow-hidden border border-black/[0.1] dark:border-white/10 bg-slate-100 dark:bg-slate-800 group shadow-xs"
                    >
                      <img
                        src={photoUrl}
                        alt={`Ảnh xe ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {/* Badge che biển */}
                      <span className="absolute bottom-0 inset-x-0 bg-black/75 text-white text-[9px] text-center font-bold truncate px-0.5 py-0.5">
                        {photo.label ? photo.label.replace('Góc ', '') : `${idx + 1}`}
                      </span>
                      {/* Action buttons */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setEditingMaskIndex(idx)}
                          className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer shadow-xs"
                          title={t('editTrip.s040')}
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="w-9 h-9 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer shadow-xs"
                          title={t('editTrip.s041')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {carPhotos.length < 5 && (
                  <label className="w-22 aspect-[4/3] rounded-xl border-2 border-dashed border-black/[0.15] dark:border-white/20 hover:border-[#0071e3] bg-white/80 dark:bg-white/5 flex flex-col items-center justify-center text-slate-600 hover:text-[#0071e3] dark:text-slate-400 dark:hover:text-[#0071e3] transition-colors cursor-pointer select-none shadow-2xs">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <Upload className="w-4 h-4 mb-0.5 text-slate-500" />
                    <span className="text-[10px] font-bold">{t('editTrip.s026')}</span>
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 3. CHI PHÍ & SỐ CHỖ (TACTILE PILLS & STEPPERS) ── */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#f5f5f7] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-2xs">
          {/* ── GIÁ DO NỀN TẢNG TÍNH: hiển thị, không cho sửa ── */}
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 shrink-0 text-[#0071e3]" />
                <span>Phụ xăng mỗi ghế:</span>
              </span>
              <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <Lock className="w-3 h-3" />
                <span>Nền tảng tính</span>
              </span>
            </label>

            <div className="h-11 px-3.5 rounded-xl bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] flex items-center justify-between shadow-2xs">
              <span className="text-base font-mono font-extrabold text-slate-900 dark:text-white tabular-nums">
                {tariff ? formatVND(price) : '—'}
              </span>
              {tariff && (
                <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                  {tariff.distanceKm} km
                </span>
              )}
            </div>

            {tariff ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Tính theo cự ly {tariff.distanceKm} km, giá xăng {formatVND(tariff.fuelPricePerLiter)}/lít và phí BOT{' '}
                {formatVND(tariff.botFee)} — rẻ hơn xe dịch vụ khoảng {tariff.savingVsLimoPercent}%.
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Chọn trạm đón và trạm trả để nền tảng tính mức phụ xăng cho chặng này.
              </p>
            )}
          </div>

          {/* Số ghế trống */}
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#0071e3]" />
                <span>{isDriver ? 'Số ghế trống nhận khách:' : 'Số người cần đi:'}</span>
              </span>
              {isDriver && <span className="text-[11px] font-medium text-slate-500">{t('editTrip.s027')}</span>}
            </label>
            <div className="flex items-center gap-1.5">
              {seatOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeats(n)}
                  className={`flex-1 h-11 rounded-xl text-xs sm:text-sm font-bold tabular transition-all cursor-pointer shadow-2xs ${
                    seats === n
                      ? 'bg-[#0071e3] text-white shadow-sm ring-2 ring-[#0071e3]/25 font-extrabold'
                      : 'bg-white hover:bg-slate-100 text-slate-800 dark:bg-[#151c2e] dark:hover:bg-white/10 dark:text-slate-200 border border-black/[0.1] dark:border-white/[0.1]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center justify-between">
              <span>
                {isDriver
                  ? seats === 3 && vehicleCapacity === 5
                    ? '✨ Khuyên chọn: Hàng sau ngồi 3 người rất êm ái'
                    : seats === 4 && vehicleCapacity === 5
                      ? 'Đầy 4 ghế khách (ghế phụ + 3 ghế sau)'
                      : `Còn trống ${seats} ghế nhận khách`
                  : `Cần ghép ${seats} ghế`}
              </span>
              {isDriver && (
                <span className="text-slate-500 font-mono text-xs font-semibold">
                  {vehicleCapacity === 5 ? 'Tối đa 4' : 'Tối đa 6'}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* ── 4. NGÀY ĐI & KHUNG GIỜ (QUICK CHIPS) ── */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#f5f5f7] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-2xs">
          <div className="space-y-2">
            <label className="block text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white">{t('editTrip.s028')}</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {quickDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-2xs ${
                    date === d
                      ? 'bg-[#0071e3] text-white font-bold'
                      : 'bg-white text-slate-800 dark:bg-white/5 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 border border-black/[0.08] dark:border-white/[0.1]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder={t('editTrip.s042')}
              className="w-full h-9 px-3 rounded-xl text-xs sm:text-sm font-medium bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white outline-none focus:border-[#0071e3] shadow-2xs"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#0071e3]" />
              <span>{t('editTrip.s029')}</span>
            </label>
            <select
              value={timeSlot}
              onChange={(e) => {
                const newSlot = e.target.value;
                setTimeSlot(newSlot);
                if (exactTime && !isTimeInSlot(exactTime, newSlot)) {
                  setExactTime('');
                }
              }}
              className="w-full h-10 px-3.5 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white outline-none focus:border-[#0071e3] cursor-pointer shadow-2xs"
            >
              {TIME_SLOTS.filter((s) => s.id !== 'all' && !s.isAlias).map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{t('editTrip.s030')}</span>
              <input
                type="time"
                value={exactTime || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setExactTime(val);
                  if (val) setTimeSlot(mapTimeToSlot(val));
                }}
                className="px-2.5 py-1 text-xs font-mono font-bold rounded-xl border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
              />
              {exactTime && (
                <button
                  type="button"
                  onClick={() => setExactTime('')}
                  className="text-xs text-slate-500 hover:text-rose-600 font-bold px-1.5 py-0.5 rounded cursor-pointer"
                  title={t('editTrip.s043')}
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('editTrip.s031')}</p>
          </div>
        </div>

        {/* ── 5. GHI CHÚ THÊM ── */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#f5f5f7] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] space-y-2 shadow-2xs">
          <label className="block text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>{t('editTrip.s032')}</span>
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('editTrip.s044')}
            className="w-full p-3.5 rounded-xl text-xs sm:text-sm font-medium bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 resize-none shadow-2xs leading-relaxed"
          />
        </div>
      </form>
    </Modal>

    {/* Modal chỉnh sửa vị trí che biển số xe tương tác */}
    {editingMaskIndex !== null && carPhotos[editingMaskIndex] && (
      <PlateMaskModal
        isOpen={true}
        photo={carPhotos[editingMaskIndex]}
        onSave={(updatedPhoto) => {
          setCarPhotos((prev) => {
            const next = [...prev];
            next[editingMaskIndex] = updatedPhoto;
            return next;
          });
          setEditingMaskIndex(null);
        }}
        onClose={() => setEditingMaskIndex(null)}
      />
    )}
  </>
);
}
