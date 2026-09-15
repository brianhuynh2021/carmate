import React, { useState, useMemo, useRef } from 'react';
import {
  Edit3,
  Car,
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
  normalizeConnectionTerms,
  normalizeTravelDate,
  normalizePhotoUrl,
  VIRTUAL_HUBS,
  getVirtualHubById,
  getStationStationKm,
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

export default function EditTripModal({ trip, onClose, onSave, onDelete }) {
  const { t } = useI18n();
  // Hook phải gọi trước mọi early return (Rules of Hooks)

  const isDriver = trip?.type === 'driver_offer';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // ── TỌA ĐỘ MA TRẬN: trạm đón/trả là lựa chọn từ danh mục trạm ảo, không gõ tay ──
  // Chuyến cũ lưu điểm đi/đến bằng chữ tự do, nên phải dò ngược về mã trạm một lần
  // khi mở form. Dò không ra thì để trống và bắt Chủ xe chọn lại cho đúng trạm.
  const [originHubId, setOriginHubId] = useState(() => resolveHubId(trip?.originHubId, trip?.from));
  const [destHubId, setDestHubId] = useState(() => resolveHubId(trip?.destinationHubId, trip?.to));

  const confirmedBookings = (trip?.manifest || trip?.bookings || []).filter((booking) =>
    (booking.bothConfirmed === true || booking.seatReserved === true) && !['cancelled', 'completed', 'expired'].includes(booking.status)
  );
  const activeBookingCount = Math.max(confirmedBookings.length, Number(trip?.bookedSeatsCount || 0));
  const isMatrixLocked = activeBookingCount > 0;
  const [vehicleCapacity, setVehicleCapacity] = useState(() => trip?.capacity ?? '');
  const [acceptsParcel, setAcceptsParcel] = useState(() => Boolean(trip?.acceptsParcel || trip?.vehicleType === 'truck_light' || trip?.vehicleType === 'pickup' || trip?.hasCargoBed));
  const [cargoNotes, setCargoNotes] = useState(() => trip?.cargoNotes || '');
  const [seats, setSeats] = useState(() => trip?.availableSeats ?? trip?.seatsNeeded ?? '');
  const [date, setDate] = useState(() => normalizeTravelDate(trip?.date) || '');
  const [exactTime, setExactTime] = useState(() => trip?.time || trip?.exactTime || (/^\d{2}:\d{2}/.test(trip?.timeSlot || '') ? trip.timeSlot.slice(0, 5) : ''));
  const [pricingMode, setPricingMode] = useState(() => trip?.pricingMode || (trip?.basePricePerSeat == null ? 'contact' : 'listed'));
  const [price, setPrice] = useState(() => trip?.basePricePerSeat ?? trip?.expectedPrice ?? '');
  const [pickupMode, setPickupMode] = useState(() => trip?.pickupMode || (trip?.isDoorstep ? 'doorstep' : 'station'));
  const [maxDetourKm, setMaxDetourKm] = useState(() => trip?.maxDetourKm ?? 0);
  const [pickupNotes, setPickupNotes] = useState(() => trip?.pickupNotes || '');
  const [saveError, setSaveError] = useState('');
  const [waypointNote, setWaypointNote] = useState(trip?.waypointNote || '');
  const [notes, setNotes] = useState(trip?.notes || '');
  const [saving, setSaving] = useState(false);
  const [carType, setCarType] = useState(() => trip?.carType || '');
  const [plateMask, setPlateMask] = useState(
    () => trip?.licensePlate || trip?.plate || ''
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

  // Thực thi xoá chuyến an toàn
  const handleExecuteDelete = async () => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete(trip.id);
      onClose();
    } catch (err) {
      setSaveError(err.message || 'Chưa hủy được chuyến. Vui lòng thử lại.');
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

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    if (saving) return;
    setSaveError('');
    try {
      const terms = normalizeConnectionTerms({ ...trip, pricingMode, basePricePerSeat: price, pickupMode, maxDetourKm, pickupNotes });
      const updates = { notes: notes.trim() };
      const changed = (key, value) => {
        if (JSON.stringify(value) !== JSON.stringify(trip[key])) updates[key] = value;
      };
      if (isDriver) { changed('pricingMode', terms.pricingMode); changed('basePricePerSeat', terms.basePricePerSeat); }
      else changed('expectedPrice', pricingMode === 'contact' ? null : Number(price));
      if (!isMatrixLocked) {
        if (!originHub || !destHub || originHubId === destHubId) throw new Error('Chọn hai trạm khác nhau để xác định hành trình.');
        if (!date || !/^\d{2}:\d{2}$/.test(exactTime)) throw new Error('Chọn ngày và giờ khởi hành.');
        if (originHubId !== trip.originHubId || destHubId !== trip.destinationHubId) {
          Object.assign(updates, { originHubId, destinationHubId: destHubId, from: originHub.shortName || originHub.name, to: destHub.shortName || destHub.name });
          const fromKm = getStationStationKm(originHubId), toKm = getStationStationKm(destHubId);
          if (fromKm != null && toKm != null && fromKm !== toKm) updates.direction = toKm > fromKm ? 'binh_phuoc_to_tphcm' : 'tphcm_to_binh_phuoc';
          updates.pickupSpot = originHub.landmark || originHub.name;
          updates.dropoffSpot = destHub.landmark || destHub.name;
        }
        changed('date', date);
        const oldTime = trip.time || trip.exactTime || (/^\d{2}:\d{2}/.test(trip.timeSlot || '') ? trip.timeSlot.slice(0, 5) : '');
        if (exactTime !== oldTime) Object.assign(updates, { time: exactTime, exactTime, timeSlot: exactTime });
        changed('waypointNote', waypointNote.trim());
        if (isDriver) {
          const capacity = vehicleCapacity === 'truck_light' ? 2 : vehicleCapacity === 'pickup' ? 5 : Number(vehicleCapacity);
          if (!Number.isInteger(capacity) || capacity < 2 || capacity > 55) throw new Error('Sức chứa xe phải từ 2 đến 55, gồm người lái.');
          if (!Number.isInteger(Number(seats)) || Number(seats) < 0 || Number(seats) >= capacity) throw new Error('Số chỗ nhận khách phải nhỏ hơn sức chứa xe.');
          if (!carType.trim() || !plateMask.trim()) throw new Error('Nhập thông tin xe và biển số thực tế.');
          changed('capacity', capacity); changed('availableSeats', Number(seats));
          changed('carType', carType.trim()); changed('licensePlate', plateMask.trim());
          changed('pickupMode', terms.pickupMode); changed('maxDetourKm', terms.maxDetourKm); changed('pickupNotes', terms.pickupNotes);
          changed('acceptsParcel', acceptsParcel); changed('cargoNotes', cargoNotes.trim());
        } else {
          if (!Number.isInteger(Number(seats)) || Number(seats) < 1) throw new Error('Nhập số người cần đi.');
          changed('seatsNeeded', Number(seats));
        }
      }
      const validPhotos = carPhotos.filter(Boolean);
      if (isDriver && (photosTouchedRef.current || (!hadOriginalPhotos && validPhotos.length))) {
        updates.carPhotos = validPhotos; updates.hasCarPhotos = validPhotos.length > 0;
      }
      setSaving(true);
      await onSave(trip.id, updates);
      onClose();
    } catch (err) { setSaveError(err.message || 'Chưa lưu được thay đổi. Vui lòng thử lại.'); }
    finally { setSaving(false); }
  };

  if (!trip) return null;

  return (
    <>
      <Modal
      onClose={() => !saving && !deleting && onClose()}
      size="lg"
      icon={Edit3}
      iconTone="brand"
      title={`Sửa bài đăng${trip.maskedCode ? ` (${trip.maskedCode})` : ''}`}
      subtitle={
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="type-badge px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20">
            {isDriver ? 'Chủ xe' : 'Hành khách'}
          </span>
          <span className="text-slate-600 dark:text-slate-300">
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
              className="type-button text-rose-600 dark:text-rose-400 hover:text-rose-700 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
              title={isDriver ? 'Xoá bài đăng chuyến này' : 'Xoá bài tìm xe này'}
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDriver ? 'Xóa chuyến' : 'Xóa bài tìm xe'}</span>
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving || deleting} className="text-slate-700 dark:text-slate-200">
              {t('editTrip.s002')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={saving || deleting}
              className="px-6 shadow-md shadow-[#0071e3]/20 bg-[#0071e3] hover:bg-[#0077ed] text-white"
            >
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {saveError && <p role="alert" className="type-body rounded-xl bg-red-50 p-3 text-red-700">{saveError}</p>}
        {/* ── BANNER XÁC NHẬN XOÁ BÀI ĐĂNG (ZERO BLOCKING MODAL) ── */}
        {confirmDelete && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 space-y-2.5 shadow-2xs">
            <div className="type-caption flex items-center gap-2 text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{t('editTrip.s003')}</span>
            </div>
            <p className="type-caption text-rose-700 dark:text-rose-300">
              {t('editTrip.s004')}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="type-button px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {t('editTrip.s005')}
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={deleting}
                className="type-button px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer inline-flex items-center gap-1.5"
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
            <span className="type-caption text-slate-900 dark:text-white flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-[#0071e3]" />
              <span>{t('editTrip.s006')}</span>
            </span>
            <span className="text-slate-500 dark:text-slate-400">{t('editTrip.s007')}</span>
          </div>

          {isMatrixLocked && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300/60 dark:border-amber-400/25">
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="type-caption text-amber-800 dark:text-amber-200">
                Chuyến đã có cuộc hẹn được hai bên xác nhận. Giữ nguyên tuyến, giờ, xe và điều kiện đón đã chốt. Giá mới chỉ áp dụng cho đề nghị mới; giá cuộc hẹn hiện có được giữ nguyên.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] gap-x-3 gap-y-2 items-start">
            <div>
              <label className="type-label text-slate-900 dark:text-white flex items-center gap-1.5 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-2xs" />
                <span>Trạm đón</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={originHubId}
                  onChange={(e) => setOriginHubId(e.target.value)}
                  disabled={isMatrixLocked}
                  className="type-input w-full h-11 pl-9 pr-8 rounded-xl bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                <p className="type-caption mt-1.5 text-slate-500 dark:text-slate-400">
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
                className="type-button w-9 h-9 rounded-full border border-black/[0.1] dark:border-white/10 bg-white dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 hover:text-[#0071e3] hover:border-[#0071e3] shadow-xs flex items-center justify-center cursor-pointer active:scale-90 active:rotate-180 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-700 disabled:hover:border-black/[0.1]"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="type-label text-slate-900 dark:text-white flex items-center gap-1.5 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 shadow-2xs" />
                <span>Trạm trả</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Navigation className="w-4 h-4 text-rose-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={destHubId}
                  onChange={(e) => setDestHubId(e.target.value)}
                  disabled={isMatrixLocked}
                  className="type-input w-full h-11 pl-9 pr-8 rounded-xl bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 shadow-2xs appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                <p className="type-caption mt-1.5 text-slate-500 dark:text-slate-400">
                  {destHub.landmark}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3] shrink-0 mt-0.5" />
            <p className="type-caption text-slate-500 dark:text-slate-400">
              Trạm giúp tìm đúng hướng đi. Điểm đón cuối cùng theo cách đón của chuyến và xác nhận của hai bên.
            </p>
          </div>
        </div>

        {/* ── 2. TRỤC ĐƯỜNG ĐÓN TRẢ + GỢI Ý THÔNG MINH THEO TUYẾN ── */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#f5f5f7] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="type-label block text-slate-900 dark:text-white flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#0071e3]" />
              <span>{t('editTrip.s013')}</span>
            </label>
            <span className="text-slate-500 dark:text-slate-400">{t('editTrip.s014')}</span>
          </div>

          <input
            type="text"
            value={waypointNote}
            disabled={isMatrixLocked}
            onChange={(e) => setWaypointNote(e.target.value)}
            placeholder={t('editTrip.s038')}
            className="type-input w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 shadow-2xs"
          />

          {/* Quick Clickable Waypoint Chips */}
          <div className="pt-1 flex items-center gap-2 flex-wrap">
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1 mr-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('editTrip.s015')}</span>
            </span>
            {suggestedWaypoints.map((wp) => {
              const isAdded = waypointNote.includes(wp);
              return (
                <button
                  key={wp}
                  type="button"
                  disabled={isMatrixLocked}
                  onClick={() => handleAddWaypoint(wp)}
                  className={`type-button inline-flex items-center gap-1 px-3 py-1 rounded-full transition-all cursor-pointer shadow-2xs ${
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
          <fieldset disabled={isMatrixLocked} className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#f5f5f7] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] space-y-4 shadow-2xs">
            <div className="type-caption flex items-center justify-between">
              <span className="text-slate-900 dark:text-white flex items-center gap-1.5">
                {vehicleCapacity === 'truck_light' ? (
                  <Truck className="w-4 h-4 text-emerald-600" />
                ) : vehicleCapacity === 'pickup' ? (
                  <Truck className="w-4 h-4 text-amber-600" />
                ) : (
                  <Car className="w-4 h-4 text-[#0071e3]" />
                )}
                <span>{t('editTrip.s016')}</span>
              </span>
              <span className="text-slate-700 dark:text-slate-300">
                {vehicleCapacity === 'truck_light' ? 'Xe tải nhẹ · 2 chỗ cabin' : vehicleCapacity === 'pickup' ? 'Xe bán tải · 5 chỗ cabin' : vehicleCapacity ? `Xe ${vehicleCapacity} chỗ, gồm người lái` : 'Chưa nhập sức chứa xe'}
              </span>
            </div>

            {/* Quy mô 4-5 chỗ vs 7 chỗ vs Bán tải vs Xe tải nhẹ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-[#e5e5ea] dark:bg-slate-800/80 border border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setVehicleCapacity(5);
                  if (seats > 4) setSeats(4);
                }}
                className={`type-button py-2.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap select-none ${
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
                }}
                className={`type-button py-2.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap select-none ${
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
                }}
                className={`type-button py-2.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap select-none ${
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
                }}
                className={`type-button py-2.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap select-none ${
                  vehicleCapacity === 'truck_light'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-black/[0.04] dark:border-white/[0.08]'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{t('editTrip.s020')}</span>
              </button>
            </div>

            <label className="type-label block">Sức chứa xe, gồm người lái
              <input type="number" min="2" max="55" value={vehicleCapacity === 'truck_light' ? 2 : vehicleCapacity === 'pickup' ? 5 : vehicleCapacity} onChange={(event) => setVehicleCapacity(event.target.value)} className="type-input mt-1 w-full rounded-xl border p-3 dark:bg-slate-800" />
            </label>
            {/* Dòng xe cụ thể + Biển số */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <label className="type-label text-slate-800 dark:text-slate-200">
                  {t('editTrip.s021')}
                </label>
                <input
                  type="text"
                  value={carType}
                  onChange={(e) => setCarType(e.target.value)}
                  placeholder="VD: Mazda 3, Veloz Cross, Xpander, Kia K250..."
                  className="type-input w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="type-label text-slate-800 dark:text-slate-200">
                  {t('editTrip.s022')}
                </label>
                <input
                  type="text"
                  value={plateMask}
                  onChange={(e) => setPlateMask(e.target.value)}
                  placeholder={t('editTrip.s039')}
                  className="type-input w-full h-10 px-3.5 rounded-xl font-mono bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] shadow-2xs"
                />
              </div>
            </div>

            {/* Preset chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="type-caption text-slate-600 dark:text-slate-400">{t('editTrip.s023')}</span>
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
                  className="type-button px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-black/[0.1] dark:border-white/[0.1] transition-colors cursor-pointer shadow-2xs"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Nhận chở đồ / Thùng hàng bán tải */}
            <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 space-y-2.5">
              <label className="type-label flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptsParcel}
                  onChange={(e) => setAcceptsParcel(e.target.checked)}
                  className="type-input w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                />
                <span className="type-caption text-slate-900 dark:text-white flex items-center gap-1.5">
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
                  className="type-input w-full p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-white dark:bg-[#151c2e] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
                />
              )}
            </div>

            {/* Quản lý ảnh xe thật */}
            <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="type-caption text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Hình ảnh xe thực tế ({carPhotos.filter(Boolean).length}/5):</span>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
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
                      <span className="type-caption absolute bottom-0 inset-x-0 bg-black/75 text-white text-center truncate px-0.5 py-0.5">
                        {photo.label ? photo.label.replace('Góc ', '') : `${idx + 1}`}
                      </span>
                      {/* Action buttons */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setEditingMaskIndex(idx)}
                          className="type-button w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer shadow-xs"
                          title={t('editTrip.s040')}
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="type-button w-9 h-9 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer shadow-xs"
                          title={t('editTrip.s041')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {carPhotos.length < 5 && (
                  <label className="type-label w-22 aspect-[4/3] rounded-xl border-2 border-dashed border-black/[0.15] dark:border-white/20 hover:border-[#0071e3] bg-white/80 dark:bg-white/5 flex flex-col items-center justify-center text-slate-600 hover:text-[#0071e3] dark:text-slate-400 dark:hover:text-[#0071e3] transition-colors cursor-pointer select-none shadow-2xs">
                    <input
                      type="file"
                      accept="image/*"
                      className="type-input hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <Upload className="w-4 h-4 mb-0.5 text-slate-500" />
                    <span className="">{t('editTrip.s026')}</span>
                  </label>
                )}
              </div>
            </div>
          </fieldset>
        )}

        <section className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-3">
          <h3 className="type-heading">{isDriver ? 'Giá chủ xe niêm yết' : 'Mức giá mong muốn'}</h3>
          <div className="flex gap-2">
            <Button variant={pricingMode === 'listed' ? 'primary' : 'secondary'} onClick={() => setPricingMode('listed')}>Niêm yết giá</Button>
            <Button variant={pricingMode === 'contact' ? 'primary' : 'secondary'} onClick={() => setPricingMode('contact')}>Liên hệ</Button>
          </div>
          {pricingMode === 'listed' && <label className="type-label block">Giá mỗi ghế (đồng)<input type="number" min="0" step="1000" value={price} onChange={(event) => setPrice(event.target.value)} className="type-input mt-1 w-full rounded-xl border p-3 dark:bg-slate-800" /></label>}
          <p className="type-caption text-slate-500">CarMate không áp giá và không thu phí kết nối. Thay đổi giá bài đăng không sửa giá của cuộc hẹn đã chốt.</p>
        </section>
        <fieldset disabled={isMatrixLocked} className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-3 disabled:opacity-60">
          {isDriver && <>
            <label className="type-label block">Cách đón
              <select value={pickupMode} onChange={(event) => setPickupMode(event.target.value)} className="type-input mt-1 w-full rounded-xl border p-3 dark:bg-slate-800"><option value="station">Tại trạm</option><option value="doorstep">Có đón tận nơi</option><option value="hybrid">Trạm hoặc điểm đón phù hợp</option></select>
            </label>
            {pickupMode !== 'station' && <label className="type-label block">Có thể đi thêm tối đa (km)<input type="number" min="0" max="50" step="0.5" value={maxDetourKm} onChange={(event) => setMaxDetourKm(event.target.value)} className="type-input mt-1 w-full rounded-xl border p-3 dark:bg-slate-800" /></label>}
            <label className="type-label block">Ghi chú điểm đón<textarea value={pickupNotes} onChange={(event) => setPickupNotes(event.target.value)} maxLength={500} className="type-input mt-1 w-full rounded-xl border p-3 dark:bg-slate-800" /></label>
          </>}
          <label className="type-label block">{isDriver ? 'Số chỗ còn nhận khách' : 'Số người cần đi'}<input type="number" min={isDriver ? 0 : 1} max={isDriver ? Number(vehicleCapacity) - 1 || undefined : undefined} value={seats} onChange={(event) => setSeats(event.target.value)} className="type-input mt-1 w-full rounded-xl border p-3 dark:bg-slate-800" /></label>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3"><label className="type-label block">Ngày khởi hành<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="type-input mt-1 w-full rounded-xl border p-3 dark:bg-slate-800" /></label><label className="type-label block">Giờ khởi hành<input type="time" value={exactTime} onChange={(event) => setExactTime(event.target.value)} className="type-input mt-1 w-full rounded-xl border p-3 dark:bg-slate-800" /></label></div>
        </fieldset>

        {/* ── 5. GHI CHÚ THÊM ── */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#f5f5f7] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] space-y-2 shadow-2xs">
          <label className="type-label block text-slate-900 dark:text-white flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>{t('editTrip.s032')}</span>
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('editTrip.s044')}
            className="type-input w-full p-3.5 rounded-xl bg-white dark:bg-[#151c2e] border border-black/[0.12] dark:border-white/[0.14] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 resize-none shadow-2xs"
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
          photosTouchedRef.current = true;
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
