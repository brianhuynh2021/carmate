import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Car,
  Users,
  PlusCircle,
  MapPin,
  Navigation,
  CalendarDays,
  Receipt,
  ExternalLink,
  ArrowLeftRight,
  Sparkles,
  Plus,
  Check,
  Clock,
  ChevronDown,
  Camera,
  Upload,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Eye,
  Crosshair,
  Image as ImageIcon,
  Calculator
} from 'lucide-react';
import { processCarPhotoUpload } from '../../utils/plateMasker.js';
import PlateMaskModal from '../modals/PlateMaskModal.jsx';
import FairSplitModal from '../modals/FairSplitModal.jsx';
import {
  ROUTE_BENCHMARKS,
  TIME_SLOTS,
  isGoogleMapsUrl,
  getGoogleMapsUrl,
  mapTimeToSlot,
  isTimeInSlot,
  getUpcomingDays,
  formatTripDateDisplay,
  VEHICLE_SEAT_CONFIGS,
  formatVND,
  getCorridorWaypoints,
  isValidVietnamesePhone,
  isLikelyFakePhone
} from '@carmate/shared';
import { useI18n, useDataLabel } from '../../i18n/index.jsx';
import { Field, Input, Select, Textarea, Checkbox, OptionCard } from '../ui/Field.jsx';
import Chip from '../ui/Chip.jsx';
import Button from '../ui/Button.jsx';
import { SectionHeader } from '../ui/EmptyState.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';
import LocationSuggestInput from '../ui/LocationSuggestInput.jsx';
import { getSuggestedWaypoints } from '../../utils/vietnamLocations.js';
import {
  recordTripPattern,
  getTopPredictedTrip,
  getLastUsedCarProfile,
  getDynamicRoutePriceBenchmark,
  computePredictedReturnTrip
} from '../../utils/personaMemory.js';

import SmartTripComposer from './SmartTripComposer.jsx';

function formatPhoneDisplay(val) {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

// Custom TimeSlot Dropdown (Obsidian Dark Mode Native & Zero OS Glitch)
function TimeSlotPicker({ value, onChange, exactTime, onExactTimeChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedSlot = TIME_SLOTS.find((s) => s.id === value) || TIME_SLOTS[2];

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const quickPresets = [
    { id: '03:00-05:00', label: '03:00 Đi viện / Sân bay' },
    { id: '05:00-07:00', label: '05:00 Sáng sớm' },
    { id: '07:00-09:00', label: '07:00 Cao điểm' },
    { id: '11:00-13:00', label: '11:30 Trưa' },
    { id: '17:00-19:00', label: '17:00 Tan tầm' },
    { id: '21:00-23:00', label: '21:00 Đêm' },
    { id: '23:00-03:00', label: '23:00 Khuya xuyên đêm' }
  ];

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full h-12 px-4 rounded-2xl border text-sm font-semibold flex items-center justify-between transition-all cursor-pointer select-none ${
            isOpen
              ? 'border-primary-500 bg-white dark:bg-[#181924] ring-4 ring-primary-500/15 shadow-sm'
              : 'border-slate-200/90 hover:border-slate-300 bg-white dark:bg-[#151c2e] dark:border-white/[0.08] dark:hover:border-white/[0.16]'
          } text-slate-900 dark:text-white`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock className="w-4 h-4 text-primary-500 shrink-0" />
            <span className="font-mono font-bold tracking-tight text-slate-900 dark:text-white">
              {exactTime ? exactTime : selectedSlot.short}
            </span>
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 truncate hidden xs:inline">
              {exactTime
                ? `(Khung ${selectedSlot.short})`
                : `(${selectedSlot.label.split('(')[1]?.replace(')', '') || ''})`}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary-500' : ''}`}
          />
        </button>

        {/* Obsidian Dark Popover Menu - Không bị pop trắng hệ điều hành */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 p-1.5 rounded-2xl bg-white/95 dark:bg-[#161722]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 max-h-72 overflow-y-auto space-y-1 custom-scrollbar">
            {TIME_SLOTS.filter((s) => s.id !== 'all' && !s.isAlias).map((slot) => {
              const isSelected = slot.id === value;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    onChange(slot.id);
                    if (exactTime && !isTimeInSlot(exactTime, slot.id)) {
                      onExactTimeChange?.('');
                    }
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-bold border border-primary-200/60 dark:border-primary-800/60 shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{slot.short}</span>
                    <span className="text-slate-400 dark:text-slate-500">
                      ({slot.label.split('(')[1]?.replace(')', '') || ''})
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Time Preset Pills (1 chạm tiện dụng) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {quickPresets.map((p) => {
          const isActive = value === p.id && !exactTime;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p.id);
                if (exactTime && !isTimeInSlot(exactTime, p.id)) {
                  onExactTimeChange?.('');
                } else if (!exactTime) {
                  onExactTimeChange?.('');
                }
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary-600 text-white dark:bg-primary-500 shadow-2xs font-bold'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-400 border border-slate-200/70 dark:border-white/5'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Tùy chọn nhập giờ chính xác (Cho ai có giờ lẻ: 04:15, 06:30, 11:45...) */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Hoặc giờ đón cụ thể:</span>
        <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-white/10">
          <input
            type="time"
            value={exactTime || ''}
            onChange={(e) => {
              const val = e.target.value;
              onExactTimeChange?.(val);
              if (val) {
                onChange(mapTimeToSlot(val));
              }
            }}
            className="text-xs font-mono font-bold bg-transparent text-slate-900 dark:text-white outline-none cursor-pointer"
          />
          {exactTime && (
            <button
              type="button"
              onClick={() => onExactTimeChange?.('')}
              className="text-xs text-slate-400 hover:text-rose-500 font-bold px-1 transition-colors cursor-pointer"
              title="Xóa giờ đón cụ thể"
            >
              ✕
            </button>
          )}
        </div>
        {exactTime && (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            ✓ Đã khớp khung {selectedSlot.short}
          </span>
        )}
      </div>
    </div>
  );
}

function FormSection({ icon: Icon, title, children }) {
  return (
    <section className="pt-6 first:pt-0 border-t first:border-t-0 border-slate-100 dark:border-slate-800">
      <h3 className="text-sm font-semibold text-slate-900 dark:white flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

const CAR_PHOTO_SLOTS = [
  { id: 'front', label: 'Góc Trước (Đầu xe)', required: false, desc: 'Mặt trước, đèn pha & kính lái' },
  { id: 'back', label: 'Góc Sau (Đuôi xe & Cốp)', required: false, desc: 'Đuôi xe & khoang cốp để đồ' },
  { id: 'side', label: 'Góc Thân xe (Trái/Phải)', required: false, desc: 'Thân xe bên hông sáng đẹp' },
  { id: 'interior', label: 'Nội thất & Ghế ngồi', required: false, desc: 'Ghế da sạch sẽ, máy lạnh' },
  { id: 'trunk', label: 'Khoang hành lý', required: false, desc: 'Cốp rộng để đồ thoải mái' }
];

export default function PostTripForm({ onSubmit, currentUser, onOpenAuth, initialRole = 'driver', onShowToast }) {
  const { t, lang } = useI18n();
  const data = useDataLabel();

  const upcomingDays = useMemo(() => getUpcomingDays(7), []);

  const [role, setRole] = useState(initialRole);

  useEffect(() => {
    if (initialRole) {
      setRole(initialRole);
    }
  }, [initialRole]);
  // Lộ trình hoàn toàn tự do toàn quốc (Hà Nội, Hải Phòng, Đà Nẵng, Bình Phước, Sài Gòn...)
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [waypointNote, setWaypointNote] = useState('');
  const [date, setDate] = useState(() => upcomingDays[0]?.iso || '');
  const [timeSlot, setTimeSlot] = useState('07:00-09:00');
  const [exactTime, setExactTime] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState(5); // 5 | 7 (Mặc định xe 4-5 chỗ)
  const [carType, setCarType] = useState('Toyota Vios (Xe 5 chỗ)');
  const [carCategory, setCarCategory] = useState('family_car'); // 'family_car' | 'convenient_trip'
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState(150000);
  const [phoneReal, setPhoneReal] = useState(() => currentUser?.phone || '');
  const [zaloConfirmed, setZaloConfirmed] = useState(true);
  const [formError, setFormError] = useState(null);
  const errorBannerRef = useRef(null);

  const triggerError = (msg) => {
    setFormError(msg);
    onShowToast?.(`⚠️ ${msg}`);
    setTimeout(() => {
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [showLivePreview, setShowLivePreview] = useState(true);

  // Ảnh thực tế xe (Tùy chọn - Tối thiểu 3 hình, tối đa 5 hình)
  const [carPhotos, setCarPhotos] = useState([]);
  const [editingMaskIndex, setEditingMaskIndex] = useState(null);

  // Trí nhớ thói quen cá nhân hóa (Local Persona Memory - Zero LLM)
  const savedCarProfile = useMemo(() => getLastUsedCarProfile(), []);
  const [predictedTrip, setPredictedTrip] = useState(() => getTopPredictedTrip('driver'));

  useEffect(() => {
    setPredictedTrip(getTopPredictedTrip(role));
  }, [role]);

  // Tự động nạp cấu hình xe & ảnh xe thật đã xác thực của Chủ xe nếu có (từ Garage hoặc Bộ nhớ thói quen)
  useEffect(() => {
    if (role === 'driver') {
      const userVehicle = currentUser?.vehicle;
      if (userVehicle) {
        if (userVehicle.capacity) setVehicleCapacity(Number(userVehicle.capacity));
        const vehicleTypeName = `${userVehicle.brand || ''} ${userVehicle.model || ''}`.trim();
        if (vehicleTypeName) setCarType(vehicleTypeName);
        if (userVehicle.carCategory) setCarCategory(userVehicle.carCategory);
        const validPics = (userVehicle.photos || []).filter(Boolean);
        if (validPics.length > 0 && carPhotos.length === 0) {
          setCarPhotos(validPics);
        }
        if (Array.isArray(userVehicle.perks)) {
          if (userVehicle.perks.includes('Không hút thuốc')) setNoSmoking(true);
          if (userVehicle.perks.includes('Cốp rộng chứa hành lý')) setLargeTrunk(true);
          if (userVehicle.perks.includes('Máy lạnh mát mẻ')) setAcOn(true);
        }
      } else if (savedCarProfile) {
        if (savedCarProfile.vehicleCapacity) setVehicleCapacity(savedCarProfile.vehicleCapacity);
        if (savedCarProfile.carType) setCarType(savedCarProfile.carType);
        if (savedCarProfile.carCategory) setCarCategory(savedCarProfile.carCategory);
        if (savedCarProfile.hasVerifiedPhotos && carPhotos.length === 0) {
          setCarPhotos(savedCarProfile.carPhotos);
        }
      }
    }
  }, [role, currentUser, savedCarProfile]);

  // Định giá phụ xăng thông minh dựa trên cự ly km thực tế
  const routePriceBenchmark = useMemo(() => {
    return getDynamicRoutePriceBenchmark(fromLocation, toLocation);
  }, [fromLocation, toLocation]);

  const [hasManuallyEditedPrice, setHasManuallyEditedPrice] = useState(false);
  const [showFairSplitModal, setShowFairSplitModal] = useState(false);
  useEffect(() => {
    if (!hasManuallyEditedPrice && routePriceBenchmark?.suggestedPrice && fromLocation && toLocation) {
      setPrice(routePriceBenchmark.suggestedPrice);
    }
  }, [fromLocation, toLocation, routePriceBenchmark, hasManuallyEditedPrice]);

  const handleApplyPredictedTrip = (pred) => {
    if (!pred) return;
    if (pred.from) setFromLocation(pred.from);
    if (pred.to) setToLocation(pred.to);
    if (pred.timeSlot) setTimeSlot(pred.timeSlot);
    if (pred.exactTime) setExactTime(pred.exactTime);
    if (pred.price) {
      setPrice(pred.price);
      setHasManuallyEditedPrice(true);
    }
    if (pred.seats) setSeats(pred.seats);
    if (pred.waypointNote) setWaypointNote(pred.waypointNote);
    if (pred.vehicleCapacity) setVehicleCapacity(pred.vehicleCapacity);
    if (pred.carType) setCarType(pred.carType);
    if (pred.carCategory) setCarCategory(pred.carCategory);
  };

  useEffect(() => {
    if (currentUser?.phone) {
      setPhoneReal(currentUser.phone);
    }
  }, [currentUser]);
  const [scheduleDay, setScheduleDay] = useState(() => upcomingDays[0]?.label || 'Hôm nay');
  const [isRecurringWeekly, setIsRecurringWeekly] = useState(false);
  const [notes, setNotes] = useState('');
  // Tiện ích & Yêu cầu do chủ xe / hành khách tự tích và tự nêu
  const [noSmoking, setNoSmoking] = useState(true);
  const [botIncluded, setBotIncluded] = useState(true);
  const [familyCar, setFamilyCar] = useState(true);
  const [largeTrunk, setLargeTrunk] = useState(false);
  const [acOn, setAcOn] = useState(false);
  const [noPet, setNoPet] = useState(false);
  const [acceptsParcel, setAcceptsParcel] = useState(false);
  const [compactLuggage, setCompactLuggage] = useState(true);
  const [onTime, setOnTime] = useState(true);
  const [pickupHighway, setPickupHighway] = useState(false);
  const [hasChild, setHasChild] = useState(false);
  const [frontSeatPreference, setFrontSeatPreference] = useState(false);
  const [customPerk, setCustomPerk] = useState('');

  const isDriver = role === 'driver';
  const days = t('post.days');

  // Gợi ý mốc đón trả thông minh dọc tuyến theo điểm đi & đến kết hợp Corridor Waypoints
  const suggestedWaypoints = useMemo(() => {
    const locWaypoints = getSuggestedWaypoints(fromLocation, toLocation) || [];
    const corridorFrom = getCorridorWaypoints(fromLocation) || [];
    const corridorTo = getCorridorWaypoints(toLocation) || [];
    const combined = Array.from(new Set([...corridorFrom, ...corridorTo, ...locWaypoints]));
    return combined.slice(0, 12);
  }, [fromLocation, toLocation]);

  const handleToggleWaypoint = (wp) => {
    if (!waypointNote.trim()) {
      setWaypointNote(wp);
      return;
    }
    if (waypointNote.includes(wp)) {
      const parts = waypointNote.split(/[,;\n]/).map(s => s.trim()).filter(s => s && s !== wp);
      setWaypointNote(parts.join(', '));
    } else {
      setWaypointNote(`${waypointNote.trim()}, ${wp}`);
    }
  };

  const handleApplySmart = (parsed) => {
    if (!parsed) return;
    if (parsed.role) setRole(parsed.role);
    if (parsed.fromLocation) setFromLocation(parsed.fromLocation);
    if (parsed.toLocation) setToLocation(parsed.toLocation);
    if (parsed.waypointNote) setWaypointNote(parsed.waypointNote);
    if (parsed.scheduleDay) setScheduleDay(parsed.scheduleDay);
    if (parsed.timeSlot) setTimeSlot(parsed.timeSlot);
    if (parsed.exactTime) setExactTime(parsed.exactTime);
    if (parsed.seats) setSeats(parsed.seats);
    if (parsed.price) {
      setPrice(parsed.price);
      setHasManuallyEditedPrice(true);
    }
    if (parsed.phoneReal) setPhoneReal(parsed.phoneReal);
    if (parsed.role === 'driver') {
      if (parsed.capacity) {
        const cap = Number(parsed.capacity);
        setVehicleCapacity(cap);
        if (cap === 5 && (parsed.seats > 4 || seats > 4)) {
          setSeats(Math.min(parsed.seats || seats, 4));
        }
      }
      if (parsed.carCategory) setCarCategory(parsed.carCategory);
      if (parsed.carType) setCarType(parsed.carType);
    }
    if (parsed.detectedPerks) {
      const dp = parsed.detectedPerks;
      if (dp.noSmoking) setNoSmoking(true);
      if (dp.acOn) setAcOn(true);
      if (dp.largeTrunk) setLargeTrunk(true);
      if (dp.botIncluded) setBotIncluded(true);
      if (dp.pickupHighway) setPickupHighway(true);
      if (dp.hasChild) setHasChild(true);
      if (dp.frontSeatPreference) setFrontSeatPreference(true);
      if (dp.compactLuggage) setCompactLuggage(true);
      if (dp.acceptsParcel) setAcceptsParcel(true);
    } else if (parsed.acceptsParcel) {
      setAcceptsParcel(true);
    }
  };

  const handlePhotoUpload = async (slotIndex, file, slotDef) => {
    if (!file) return;
    try {
      const result = await processCarPhotoUpload(file, slotDef.id);
      setCarPhotos((prev) => {
        const next = [...prev];
        next[slotIndex] = {
          angle: slotDef.id,
          label: slotDef.label,
          url: result.maskedUrl,
          originalUrl: result.originalUrl,
          isMasked: result.isMasked,
          maskPos: result.maskPos,
          caption: slotDef.desc
        };
        return next;
      });
      if (result.isMasked) {
        onShowToast?.('🔒 Đã tự động che biển số bảo mật trên ảnh xe!');
      } else {
        onShowToast?.('Đã tải ảnh xe thành công!');
      }
    } catch (err) {
      console.warn('[PostTripForm] Lỗi tải/che ảnh xe:', err);
      onShowToast?.('⚠️ Không thể tải ảnh, vui lòng thử lại');
    }
  };

  const handleRemovePhoto = (slotIndex) => {
    setCarPhotos((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  };

  const handleSwapRoute = () => {
    const temp = fromLocation;
    setFromLocation(toLocation);
    setToLocation(temp);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(null);

    const cleanPhone = phoneReal.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10 || !cleanPhone.startsWith('0')) {
      triggerError('Bắt buộc: Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số) để liên hệ đón nhau.');
      return;
    }
    if (!isValidVietnamesePhone(cleanPhone) || isLikelyFakePhone(cleanPhone)) {
      triggerError('Số điện thoại không hợp lệ hoặc có dấu hiệu số ảo (dãy số trùng lặp / liên tiếp). Vui lòng nhập số điện thoại thật.');
      return;
    }
    if (!zaloConfirmed) {
      triggerError('Bắt buộc: Bạn phải cam kết số điện thoại này đang sử dụng Zalo để chốt điểm đón.');
      return;
    }

    if (!fromLocation.trim()) {
      triggerError('Vui lòng nhập điểm đón cụ thể (số nhà, ngõ xóm, cây xăng hoặc dán link Google Maps).');
      return;
    }
    if (!toLocation.trim()) {
      triggerError('Vui lòng nhập điểm đến / trả khách cụ thể (quận, bến xe hoặc dán link Google Maps).');
      return;
    }

    // Kiểm tra số lượng ảnh xe thực tế (Tùy chọn: 1 hình cũng được, 2 hình cũng được, tối đa 5 hình)
    const validPhotos = (carPhotos || []).filter(Boolean);
    if (isDriver && validPhotos.length > 5) {
      triggerError('Chỉ được tải tối đa 5 hình ảnh xe.');
      return;
    }

    const slot = TIME_SLOTS.find((s) => s.id === timeSlot) || TIME_SLOTS[2];
    const perks = [];
    if (isDriver) {
      if (noSmoking) perks.push('Không khói thuốc');
      if (botIncluded) perks.push('Trọn gói vé cầu đường & xăng xe');
      if (familyCar) perks.push('Xe gia đình sạch sẽ');
      if (largeTrunk) perks.push('Cốp rộng để đồ');
      if (acOn) perks.push('Bật máy lạnh');
      if (acceptsParcel) perks.push('Nhận gửi đồ/hàng tiện chuyến');
      if (noPet) perks.push('Không thú cưng');
    } else {
      if (noSmoking) perks.push('Không hút thuốc');
      if (compactLuggage) perks.push('Hành lý gọn gàng');
      if (onTime) perks.push('Đúng giờ hẹn');
      if (pickupHighway) perks.push('Đón dọc Quốc Lộ / Cao tốc');
      if (noPet) perks.push('Không mang thú cưng');
      if (hasChild) perks.push('Có trẻ nhỏ');
      if (frontSeatPreference) perks.push('Ngồi ghế trước (chống say xe)');
    }
    if (customPerk.trim()) {
      perks.push(customPerk.trim());
    }

    const cleanFrom = fromLocation.trim();
    const cleanTo = toLocation.trim();
    const fromCity = cleanFrom.split(/[,-]/)[0].trim() || cleanFrom;
    const toCity = cleanTo.split(/[,-]/)[0].trim() || cleanTo;
    const derivedRoute = `${fromCity} ⇄ ${toCity}`;

    const isExactTimeValid = exactTime && isTimeInSlot(exactTime.trim(), timeSlot);
    const validExactTime = isExactTimeValid ? exactTime.trim() : undefined;
    const timeSlotLabel = validExactTime ? `${validExactTime} (${slot.short})` : slot.short;

    const payload = {
      id: `${isDriver ? 'DRV' : 'REQ'}-${Date.now().toString().slice(-4)}`,
      type: isDriver ? 'driver_offer' : 'passenger_request',
      carCategory: isDriver ? carCategory : undefined,
      maskedCode: `${isDriver ? 'CX' : 'KH'}-${Math.floor(100 + Math.random() * 900)}`,
      publicName: `${isDriver ? (carCategory === 'convenient_trip' ? 'Xe tiện chuyến' : 'Chủ xe') : 'Khách'} #${Math.floor(100 + Math.random() * 900)}`,
      avatar: currentUser?.avatar || undefined,
      phoneReal: phoneReal.trim() || currentUser?.phone || '',
      direction: 'both',
      from: cleanFrom,
      to: cleanTo,
      route: derivedRoute,
      routeCategory: derivedRoute,
      hometown: fromCity,
      waypointNote: waypointNote.trim(),
      date: isRecurringWeekly ? `${scheduleDay} (Lặp lại hàng tuần)` : scheduleDay,
      timeSlot,
      exactTime: validExactTime,
      timeSlotLabel,
      carType: isDriver ? carType : undefined,
      carPhotos: isDriver && validPhotos.length >= 3 ? validPhotos : undefined,
      hasCarPhotos: isDriver && validPhotos.length >= 3,
      capacity: isDriver ? Number(vehicleCapacity) : undefined,
      availableSeats: isDriver ? Number(seats) : undefined,
      seatsNeeded: !isDriver ? Number(seats) : undefined,
      basePricePerSeat: isDriver ? Number(price) : undefined,
      depositPerSeat: 0,
      commitmentType: 'zalo_direct',
      isVip: false,
      rating: 5.0,
      completedCount: 1,
      perks,
      notes: notes.trim(),
      createdAt: Date.now()
    };

    setPendingPayload(payload);
    setShowConfirmModal(true);
  };

  const handleConfirmPublish = () => {
    if (!pendingPayload) return;
    const finalData = pendingPayload;
    // Ghi nhận thói quen vào Local Persona Memory (Càng dùng càng hiểu - Zero LLM)
    recordTripPattern(finalData);
    setShowConfirmModal(false);
    setPendingPayload(null);
    onSubmit(finalData);
  };

  const handleCreateRoundtrip = () => {
    if (!pendingPayload) return;
    const finalData = pendingPayload;
    recordTripPattern(finalData);
    onSubmit(finalData);

    const roundtrip = computePredictedReturnTrip(finalData);
    if (roundtrip) {
      setFromLocation(roundtrip.from);
      setToLocation(roundtrip.to);
      setTimeSlot(roundtrip.timeSlot);
      setExactTime(roundtrip.exactTime);
      setPrice(roundtrip.price);
      setSeats(roundtrip.seats);
      setHasManuallyEditedPrice(true);
    }
    setShowConfirmModal(false);
    setPendingPayload(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <SectionHeader icon={PlusCircle} title={t('post.title')} description={t('post.subtitle')} />

      {/* ── ĐĂNG CHUYẾN NHANH: DÁN BÀI ĐĂNG HOẶC GÕ TỰ NHIÊN ĐĂNG TRONG 3 GIÂY ── */}
      <div className="mt-6">
        <SmartTripComposer
          currentRole={role}
          currentUser={currentUser}
          onRoleChange={(newRole) => setRole(newRole)}
          onApply={handleApplySmart}
          onInstantSubmit={(parsed) => {
            handleApplySmart(parsed);
            setTimeout(() => {
              const form = document.getElementById('post-trip-form');
              if (form) form.requestSubmit();
            }, 50);
          }}
        />
      </div>

      {/* ── BANNER DỰ ĐOÁN THÓI QUEN (CURSOR PREDICTIVE AMBIENT UX) ── */}
      {predictedTrip && (
        <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-primary-500/10 via-emerald-500/10 to-transparent border border-primary-300/40 dark:border-primary-700/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div>
              <p className="text-xs text-slate-800 dark:text-slate-200">
                <span className="font-bold text-primary-600 dark:text-primary-400">
                  {isDriver ? 'Chuyến quen thuộc của Chủ xe:' : 'Nhu cầu quen thuộc của bạn:'}
                </span>{' '}
                <span className="font-semibold">
                  {predictedTrip.from} ➔ {predictedTrip.to}
                </span>{' '}
                <span className="text-slate-500 dark:text-slate-400">({predictedTrip.timeSlot})</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatVND(predictedTrip.price)}/ghế · {predictedTrip.seats} ghế · Đã đi {predictedTrip.count} lần
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleApplyPredictedTrip(predictedTrip)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Áp dụng</span>
          </button>
        </div>
      )}

      <form id="post-trip-form" onSubmit={handleSubmit} className="surface p-5 sm:p-7 space-y-6">
        {/* Role */}
        <div>
          <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-2">{t('post.whoAreYou')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OptionCard active={isDriver} onClick={() => setRole('driver')} icon={Car} title={t('post.driverRole')} />
            <OptionCard
              active={!isDriver}
              onClick={() => setRole('passenger')}
              icon={Users}
              title={t('post.passengerRole')}
            />
          </div>
        </div>

        {/* LỘ TRÌNH TỰ DO TOÀN QUỐC — KHÔNG ÉP CỨNG SÀI GÒN / VỀ TỈNH */}
        <FormSection icon={MapPin} title="Lộ trình di chuyển">
          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
            Linh hoạt điểm đi và điểm đến bất kỳ tỉnh thành nào trên toàn quốc (Hà Nội, Hải Phòng, Đà Nẵng, Bình Phước,
            Sài Gòn...).
          </p>

          <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-1">
            {/* ĐIỂM ĐÓN / XUẤT PHÁT */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  <span>Điểm xuất phát / đón khách</span>
                  <span className="text-rose-500">*</span>
                </label>
                <a
                  href={getGoogleMapsUrl(fromLocation || 'Hà Nội')}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-0.5 shrink-0"
                  title="Tra cứu vị trí trên Google Maps"
                >
                  <span>Maps ↗</span>
                </a>
              </div>

              <LocationSuggestInput
                required
                value={fromLocation}
                onChange={setFromLocation}
                placeholder="VD: Hà Nội (BX Giáp Bát), Lộc Ninh, Vũng Tàu..."
                icon={MapPin}
                iconColor="text-emerald-500"
              />

              {isGoogleMapsUrl(fromLocation) && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <span>📍 Đã nhận diện link vị trí Google Maps</span>
                  <a
                    href={getGoogleMapsUrl(fromLocation)}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto underline font-semibold inline-flex items-center gap-0.5"
                  >
                    Xem <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Nút Đổi Chiều Nhanh ⇄ Desktop */}
            <div className="hidden sm:flex absolute left-1/2 top-7 -translate-x-1/2 z-10">
              <button
                type="button"
                onClick={handleSwapRoute}
                title="Đổi chiều điểm đi và điểm đến"
                aria-label="Đổi chiều điểm đi và điểm đến"
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#151c2e] text-slate-500 hover:text-primary-600 shadow-sm flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ĐIỂM ĐẾN / TRẢ KHÁCH */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                  <span>Điểm đến / trả khách</span>
                  <span className="text-rose-500">*</span>
                </label>
                <a
                  href={getGoogleMapsUrl(toLocation || 'Hải Phòng')}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-0.5 shrink-0"
                  title="Tra cứu vị trí trên Google Maps"
                >
                  <span>Maps ↗</span>
                </a>
              </div>

              <LocationSuggestInput
                required
                value={toLocation}
                onChange={setToLocation}
                placeholder="VD: Hải Phòng, Ninh Bình, Sài Gòn (Hàng Xanh)..."
                icon={Navigation}
                iconColor="text-rose-500"
              />

              {isGoogleMapsUrl(toLocation) && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <span>📍 Đã nhận diện link vị trí Google Maps</span>
                  <a
                    href={getGoogleMapsUrl(toLocation)}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto underline font-semibold inline-flex items-center gap-0.5"
                  >
                    Xem <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Đổi chiều trên Mobile */}
          <div className="flex sm:hidden justify-center pt-0.5">
            <button
              type="button"
              onClick={handleSwapRoute}
              className="px-3 py-1 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>Đổi chiều đi / về</span>
            </button>
          </div>

          {/* TIỆN ĐÓN TRẢ DỌC ĐƯỜNG (TÙY CHỌN - TỰ DO CHO CHỦ XE) */}
          <div className="pt-2 space-y-2">
            <Field
              label="Trục đường tiện đón trả dọc tuyến"
              optional="Không bắt buộc"
              hint="Ghi rõ các mốc hoặc cao tốc xe chạy qua để khách tiện đường dễ thấy (VD: Dọc QL1A, Cao tốc Hà Nội - Hải Phòng, Ngã 4 Chơn Thành...)"
            >
              <Input
                value={waypointNote}
                onChange={(e) => setWaypointNote(e.target.value)}
                placeholder="VD: Dọc QL1A, cao tốc, đón trả các ngã 3 / cây xăng tiện đường..."
              />
            </Field>

            {/* Quick Waypoint Suggestion Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Gợi ý mốc theo tuyến:</span>
              </span>
              {suggestedWaypoints.map((wp) => {
                const isAdded = waypointNote.includes(wp);
                return (
                  <button
                    key={wp}
                    type="button"
                    onClick={() => handleToggleWaypoint(wp)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer shadow-2xs ${
                      isAdded
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 border border-slate-200/70 dark:border-white/5'
                    }`}
                  >
                    {isAdded ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Plus className="w-3 h-3 text-slate-400" />
                    )}
                    <span>{wp}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </FormSection>

        <FormSection icon={CalendarDays} title={t('post.sectionSchedule')}>
          <div>
            <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-2">{t('post.date')}</p>
            <div className="flex flex-wrap gap-2 mb-2.5">
              {upcomingDays.map((d) => {
                const isActive = scheduleDay === d.label || scheduleDay === d.iso || scheduleDay === d.fullDisplay;
                return (
                  <Chip key={d.iso} active={isActive} onClick={() => setScheduleDay(d.label)}>
                    {d.label}
                  </Chip>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span className="shrink-0">Hoặc chọn ngày lịch cụ thể:</span>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    setScheduleDay(formatTripDateDisplay(e.target.value));
                  }
                }}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#151c2e] text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-primary-500 cursor-pointer transition-all font-mono"
              />
            </div>
            <Checkbox
              className="mt-3"
              checked={isRecurringWeekly}
              onChange={(e) => setIsRecurringWeekly(e.target.checked)}
              label={t('post.recurring')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                {t('post.timeSlot')} <span className="text-rose-500">*</span>
              </label>
              <TimeSlotPicker
                value={timeSlot}
                onChange={setTimeSlot}
                exactTime={exactTime}
                onExactTimeChange={setExactTime}
              />
            </div>

            {/* QUY MÔ DÒNG XE (CHO CHỦ XE: 4-5 CHỖ VS 7 CHỖ) */}
            {isDriver && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-[#0071e3]" />
                    <span>Dòng xe & Quy mô chỗ ngồi:</span>
                  </span>
                  {currentUser?.vehicle?.brand ? (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Garage: {currentUser.vehicle.brand} {currentUser.vehicle.model} ({currentUser.vehicle.plate || `${currentUser.vehicle.capacity} chỗ`})
                    </span>
                  ) : (
                    <span className="text-xs font-normal text-slate-400">
                      {vehicleCapacity === 5 ? 'Tối đa 4 khách' : 'Tối đa 6 khách'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#e8e8ed] dark:bg-slate-800 border border-black/[0.04] dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      setVehicleCapacity(5);
                      if (seats > 4) setSeats(4);
                      if (carType.includes('Xpander') || !carType) {
                        setCarType('Toyota Vios (Xe 5 chỗ)');
                      }
                    }}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer select-none whitespace-nowrap ${
                      vehicleCapacity === 5
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>🚗 Xe 4–5 chỗ</span>
                    <span className="text-[10.5px] font-normal opacity-70 hidden sm:inline">(Sedan/CUV)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVehicleCapacity(7);
                      if (carType.includes('Vios') || !carType) {
                        setCarType('Mitsubishi Xpander (Xe 7 chỗ)');
                      }
                    }}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer select-none whitespace-nowrap ${
                      vehicleCapacity === 7
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>🚙 Xe 7 chỗ</span>
                    <span className="text-[10.5px] font-normal opacity-70 hidden sm:inline">(MPV/SUV)</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>
                  {isDriver ? 'Số ghế trống nhận khách' : t('post.seatsPassenger')}{' '}
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  {isDriver
                    ? vehicleCapacity === 5
                      ? 'Xe 5 chỗ nhận tối đa 4 khách'
                      : 'Xe 7 chỗ nhận tối đa 6 khách'
                    : 'tối đa 6 vé'}
                </span>
              </label>
              <div className={`grid ${isDriver && vehicleCapacity === 5 ? 'grid-cols-4' : 'grid-cols-6'} gap-1.5`}>
                {(isDriver ? (vehicleCapacity === 5 ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6]) : [1, 2, 3, 4, 5, 6]).map(
                  (num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSeats(num)}
                      className={`h-12 rounded-xl border font-mono text-sm font-bold transition-all cursor-pointer flex items-center justify-center ${
                        Number(seats) === num
                          ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:border-primary-500 dark:text-primary-300 ring-2 ring-primary-500/20 shadow-2xs'
                          : 'border-slate-200/90 hover:border-slate-300 bg-white text-slate-700 dark:bg-[#151c2e] dark:border-white/[0.08] dark:hover:border-white/[0.16] dark:text-slate-300'
                      }`}
                    >
                      {num}
                    </button>
                  )
                )}
              </div>
              {isDriver && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5">
                  <span>
                    {seats === 3 && vehicleCapacity === 5
                      ? '✨ Khuyên chọn: Hàng ghế sau ngồi 3 người rất rộng rãi'
                      : seats === 4 && vehicleCapacity === 5
                        ? 'Đầy 4 ghế khách (1 ghế phụ + 3 ghế sau)'
                        : `Còn trống ${seats} ghế nhận khách (trừ 1 ghế lái)`}
                  </span>
                  <span className="text-slate-400 text-[10.5px]">Đã trừ 1 ghế lái của Chủ xe</span>
                </p>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection icon={Receipt} title={t('post.sectionDetails')}>
          {isDriver && (
            <div className="space-y-1.5 pb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Phân loại xe & Chuyến đi <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCarCategory('family_car')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    carCategory === 'family_car'
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#151c2e] text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                    <span>🚗 Xe gia đình (Biển trắng)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    Xe nhà cá nhân đi làm, về quê còn ghế trống, chia sẻ chi phí xăng & cầu đường.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCarCategory('convenient_trip')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    carCategory === 'convenient_trip'
                      ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20'
                      : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#151c2e] text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <span>⚡ Xe tiện chuyến (Biển vàng)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    Xe dịch vụ chiều về rỗng khách, nhận ghép trợ giá chi phí cầu đường, 0 phí sàn.
                  </p>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {/* GIÁ TIỀN GỢI Ý / MỨC ĐÓNG GÓP */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 tracking-tight flex items-baseline justify-between">
                <span>
                  {isDriver ? t('post.priceDriver') : t('post.pricePassenger')} <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">đã gồm cầu đường</span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={Number(price || 0).toLocaleString('vi-VN')}
                  onChange={(e) => {
                    const cleanNum = Number(e.target.value.replace(/\D/g, '')) || 0;
                    setPrice(cleanNum);
                  }}
                  className="w-full h-12 pl-4 pr-18 rounded-2xl border text-base font-mono font-black tracking-tight text-slate-900 dark:text-white bg-white dark:bg-[#151c2e] border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] focus:border-primary-600 focus:ring-4 focus:ring-primary-600/15 outline-none shadow-sm transition-all"
                  placeholder="150.000"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 pointer-events-none">
                  đ / ghế
                </span>
              </div>

              {/* Quick Price Preset Chips - Được tính toán thông minh bởi AI Cục Bộ (Route Price Intelligence) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 mr-0.5">Gợi ý cự ly:</span>
                {(routePriceBenchmark?.quickPresets || [100000, 140000, 150000, 180000]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPrice(p);
                      setHasManuallyEditedPrice(true);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                      Number(price) === p
                        ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 border border-slate-200/70 dark:border-white/5'
                    }`}
                  >
                    {(p / 1000).toLocaleString('vi-VN')}k
                  </button>
                ))}
                {routePriceBenchmark?.note && (
                  <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium">
                    · {routePriceBenchmark.note}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowFairSplitModal(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0071e3] hover:underline cursor-pointer sm:ml-auto w-full sm:w-auto pt-1 sm:pt-0"
                >
                  <Calculator className="w-3 h-3 text-[#0071e3]" />
                  <span>Bảng tính chi phí xăng & cầu đường</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight pt-1">
                * Định giá tham khảo theo hao phí lăn bánh. Mức chia sẻ thực tế do Chủ xe và Người đi cùng tự do thoả
                thuận.
              </p>
            </div>

            {isDriver ? (
              <Field label={t('post.carType')}>
                <Input value={carType} onChange={(e) => setCarType(e.target.value)} placeholder={t('post.carTypePh')} />
              </Field>
            ) : (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-200 block">
                  💡 Mẹo tiết kiệm cho hành khách:
                </span>
                <p className="leading-relaxed">
                  Mức giá gợi ý khoảng 100k – 200k/ghế trên các trục QL13, QL14, QL1A giúp bạn kết nối với các chủ xe đi
                  cùng lộ trình nhanh nhất.
                </p>
              </div>
            )}
          </div>

          {/* HÌNH ẢNH XE THỰC TẾ (TÙY CHỌN TĂNG TÍN NHIỆM: CHÍNH CHỦ TỰ CHỤP HOẶC TẢI LÊN 3-5 HÌNH) */}
          {isDriver && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">Hình ảnh thực tế của xe</span>
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        Chính chủ tự chụp / tải lên
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Chủ xe tự chụp hoặc tải ảnh xe thật để tạo uy tín.{' '}
                      <strong className="text-slate-700 dark:text-slate-300">Tùy chọn tải từ 1 đến 5 hình</strong>{' '}
                      (Góc Trước, Góc Sau, Thân xe...). Biển số tự động che bảo mật.
                    </p>
                  </div>
                </div>

                {/* Huy hiệu cam kết ảnh thật hoặc nút dùng lại ảnh thật đã lưu */}
                {((currentUser?.vehicle?.photos?.filter(Boolean).length || 0) > 0 || savedCarProfile?.hasVerifiedPhotos) &&
                carPhotos.filter(Boolean).length === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const garagePics = currentUser?.vehicle?.photos?.filter(Boolean) || [];
                      if (garagePics.length > 0) {
                        setCarPhotos(garagePics);
                      } else if (savedCarProfile?.carPhotos) {
                        setCarPhotos(savedCarProfile.carPhotos);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
                    title="Tái sử dụng ảnh xe thật chính chủ của bạn"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Dùng lại ảnh từ Garage ({currentUser?.vehicle?.photos?.filter(Boolean).length || savedCarProfile?.carPhotos?.length || 0} ảnh)
                    </span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shrink-0 self-start sm:self-auto">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Xác thực xe chính chủ</span>
                  </div>
                )}
              </div>

              {/* 5 Slot Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {CAR_PHOTO_SLOTS.map((slot, index) => {
                  const currentPhoto = carPhotos[index];
                  return (
                    <div
                      key={slot.id}
                      className={`relative rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                        index === 4 ? 'col-span-2 sm:col-span-1' : ''
                      } ${
                        currentPhoto
                          ? 'border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10 ring-1 ring-emerald-500/30'
                          : slot.required
                            ? 'border-dashed border-slate-300 dark:border-white/20 bg-white dark:bg-[#121827] hover:border-primary-500 hover:bg-primary-50/30 dark:hover:bg-primary-950/20'
                            : 'border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#0e1320] hover:border-slate-300 opacity-90'
                      }`}
                    >
                      {currentPhoto ? (
                        <div className="relative aspect-[4/3] w-full group overflow-hidden bg-black/40">
                          <img
                            src={currentPhoto.url || currentPhoto}
                            alt={slot.label}
                            onClick={() => setEditingMaskIndex(index)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 cursor-pointer"
                            title="Chạm để xem hoặc đổi vị trí che biển số"
                          />
                          {/* Masked plate badge */}
                          <div
                            onClick={() => setEditingMaskIndex(index)}
                            className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md backdrop-blur-xs text-[9px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-transform hover:scale-105 ${
                              currentPhoto.isMasked !== false
                                ? 'bg-black/75 text-white'
                                : 'bg-slate-700/80 text-slate-300'
                            }`}
                            title="Chạm để chỉnh vị trí che"
                          >
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{currentPhoto.isMasked !== false ? 'Đã che biển' : 'Gốc'}</span>
                          </div>

                          {/* Quick tap-to-mask action button */}
                          <button
                            type="button"
                            onClick={() => setEditingMaskIndex(index)}
                            className="absolute bottom-6 right-1.5 px-1.5 py-0.5 rounded-md bg-black/75 hover:bg-black text-white text-[9px] font-semibold flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-all cursor-pointer shadow-xs"
                            title="Chỉnh vị trí che biển số"
                          >
                            <Crosshair className="w-2.5 h-2.5 text-blue-400" />
                            <span>Chỉnh</span>
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Xóa hình này"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          {/* Slot badge bottom */}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 text-[10px] text-white text-center font-semibold truncate">
                            {slot.label}
                          </div>
                        </div>
                      ) : (
                        <label className="relative aspect-[4/3] w-full flex flex-col items-center justify-center p-2 text-center cursor-pointer select-none group">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handlePhotoUpload(index, file, slot);
                            }}
                          />
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center mb-1 group-hover:bg-primary-50 dark:group-hover:bg-primary-950/50 group-hover:text-primary-600 transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                            {index + 1}. {slot.label.split(' ')[0]} {slot.label.split(' ')[1] || ''}
                          </span>
                          <span className="text-[9.5px] mt-0.5 text-slate-400 dark:text-slate-500 leading-none">
                            {slot.required ? '(Bắt buộc nếu tải)' : '(Tùy chọn)'}
                          </span>
                          <span className="text-[9px] mt-1 text-primary-600 dark:text-primary-400 font-medium opacity-80 group-hover:opacity-100">
                            Chạm để chụp / tải
                          </span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Status & Privacy bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    Bảo mật biển số: Tự động che biển số bằng công nghệ Canvas trên máy client, bảo vệ 100% riêng tư.
                  </span>
                </div>
                <div className="font-mono text-[11.5px] font-semibold text-right">
                  {carPhotos.filter(Boolean).length === 0 ? (
                    <span className="text-slate-400 dark:text-slate-500">Chưa tải ảnh xe (Không bắt buộc)</span>
                  ) : carPhotos.filter(Boolean).length >= 3 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 sm:justify-end">
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã có {carPhotos.filter(Boolean).length}/5 ảnh xe thật (Đủ điều kiện nhận huy hiệu)</span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 sm:justify-end">
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã có {carPhotos.filter(Boolean).length}/5 ảnh xe thật</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SỐ ĐIỆN THOẠI ZALO - THIẾT KẾ TINH TẾ CHUẨN CURSOR (ZERO-FRICTION) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-50/40 to-slate-50 dark:from-[#131a2e] dark:to-[#0f1424] border border-blue-200/60 dark:border-blue-500/20 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center shrink-0">
                  <ZaloIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                    <span>Số điện thoại Zalo kết nối</span>
                    <span className="text-rose-500">*</span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Dùng để hai bên gửi vị trí GPS đón và gọi thoại trực tiếp qua Zalo
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-blue-100/70 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
                0% phí sàn
              </span>
            </div>

            <div className="relative">
              <input
                type="tel"
                required
                value={formatPhoneDisplay(phoneReal)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setPhoneReal(raw);
                  setFormError(null);
                }}
                placeholder="0984 883 750"
                className={`w-full h-12 px-4 rounded-xl border text-base font-mono font-bold tracking-wider text-slate-900 dark:text-white bg-white dark:bg-[#161a28] ${
                  phoneReal.length === 10 && isLikelyFakePhone(phoneReal)
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15'
                    : 'border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] focus:border-blue-500 focus:ring-blue-500/15'
                } outline-none transition-all shadow-2xs`}
              />
            </div>

            {phoneReal.length === 10 && isLikelyFakePhone(phoneReal) && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Số điện thoại có dấu hiệu số ảo hoặc thử nghiệm. Vui lòng nhập số thật để đối tác liên hệ đón bạn.</span>
              </div>
            )}

            <div className="space-y-1 pt-0.5">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span>
                  Được bảo mật danh tính tự động bằng mã viết tắt ({isDriver ? 'CX-xxx' : 'HK-xxx'}) trước khi kết nối
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400/90 leading-tight">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <b>Cảnh báo răn đe:</b> SĐT chỉ hiển thị sau khi 2 bên cùng chốt chuyến. Cố tình nhập số ảo sẽ bị trừ 30 điểm tín nhiệm và khóa tài khoản vĩnh viễn.
                </span>
              </div>
            </div>
          </div>

          {/* Yêu cầu & Tiện ích thực tế (Chủ xe / Khách tự tích & tự nêu) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {isDriver ? 'Yêu cầu & Cam kết của chủ xe' : 'Yêu cầu & Ghi chú của hành khách'}
              </p>
              <span className="text-[11px] font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/60 px-2 py-0.5 rounded-md">
                Tự tích & tự nêu
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isDriver
                ? 'Tích chọn các cam kết thực tế của bạn hoặc tự ghi thêm. Thẻ chuyến chỉ hiển thị đúng những gì bạn chọn:'
                : 'Tích chọn lưu ý để chủ xe nắm rõ trước khi liên hệ:'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {isDriver ? (
                <>
                  <Checkbox
                    checked={noSmoking}
                    onChange={(e) => setNoSmoking(e.target.checked)}
                    label="Không khói thuốc trên xe"
                  />
                  <Checkbox
                    checked={botIncluded}
                    onChange={(e) => setBotIncluded(e.target.checked)}
                    label="Trọn gói xăng xe & vé cầu đường"
                  />
                  <Checkbox
                    checked={familyCar}
                    onChange={(e) => setFamilyCar(e.target.checked)}
                    label="Xe gia đình êm ái, sạch sẽ"
                  />
                  <Checkbox
                    checked={largeTrunk}
                    onChange={(e) => setLargeTrunk(e.target.checked)}
                    label="Cốp rộng để nhiều hành lý"
                  />
                  <Checkbox
                    checked={acOn}
                    onChange={(e) => setAcOn(e.target.checked)}
                    label="Bật máy lạnh suốt tuyến"
                  />
                  <Checkbox
                    checked={acceptsParcel}
                    onChange={(e) => setAcceptsParcel(e.target.checked)}
                    label="📦 Nhận gửi đồ / bưu phẩm tiện chuyến"
                  />
                  <Checkbox
                    checked={noPet}
                    onChange={(e) => setNoPet(e.target.checked)}
                    label="Không nhận chở thú cưng"
                  />
                </>
              ) : (
                <>
                  <Checkbox
                    checked={noSmoking}
                    onChange={(e) => setNoSmoking(e.target.checked)}
                    label="Không hút thuốc lá"
                  />
                  <Checkbox
                    checked={compactLuggage}
                    onChange={(e) => setCompactLuggage(e.target.checked)}
                    label="Hành lý gọn gàng (balo/vali nhỏ)"
                  />
                  <Checkbox
                    checked={onTime}
                    onChange={(e) => setOnTime(e.target.checked)}
                    label="Đúng giờ hẹn, không trễ"
                  />
                  <Checkbox
                    checked={pickupHighway}
                    onChange={(e) => setPickupHighway(e.target.checked)}
                    label="Đón dọc Quốc Lộ tiện đường"
                  />
                  <Checkbox
                    checked={noPet}
                    onChange={(e) => setNoPet(e.target.checked)}
                    label="Không mang theo thú cưng"
                  />
                  <Checkbox
                    checked={hasChild}
                    onChange={(e) => setHasChild(e.target.checked)}
                    label="Có trẻ nhỏ đi cùng"
                  />
                  <Checkbox
                    checked={frontSeatPreference}
                    onChange={(e) => setFrontSeatPreference(e.target.checked)}
                    label="Xin ngồi ghế trước (chống say xe)"
                  />
                </>
              )}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isDriver ? 'Chủ xe tự nêu yêu cầu khác (nếu có):' : 'Khách tự nêu yêu cầu khác (nếu có):'}
              </label>
              <Input
                value={customPerk}
                onChange={(e) => setCustomPerk(e.target.value)}
                placeholder={
                  isDriver
                    ? 'VD: Đón tận nơi tại Lộc Ninh, Không đón khách say xe...'
                    : 'VD: Cần 2 ghế cạnh nhau, Xin ngồi ghế trước chống say...'
                }
                className="text-xs bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <Field label={t('post.notes')} optional={t('common.optional')}>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('post.notesPh')}
            />
          </Field>
        </FormSection>


        {!currentUser && (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2.5">
              <span className="text-base">🔒</span>
              <span>
                Bạn chưa đăng nhập. Khi bấm Đăng chuyến, CarMate sẽ mở xác thực SĐT/Zalo nhanh để gắn bài đăng chính chủ
                vào tài khoản của bạn.
              </span>
            </div>
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="shrink-0 font-bold text-amber-800 dark:text-amber-300 underline hover:opacity-80 cursor-pointer"
              >
                Đăng nhập ngay
              </button>
            )}
          </div>
        )}

        {/* ── THẺ XEM TRƯỚC BÀI ĐĂNG THỜI GIAN THỰC (APPLE HIG LIVE PREVIEW) ── */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-primary-500" />
              <span>Xem trước bài đăng trên sàn (Live Preview)</span>
            </span>
            <button
              type="button"
              onClick={() => setShowLivePreview((prev) => !prev)}
              className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
            >
              {showLivePreview ? 'Thu gọn' : 'Mở rộng'}
            </button>
          </div>

          {showLivePreview && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-[#111726] dark:to-[#0d121f] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
              {/* Header của thẻ xem trước */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      isDriver
                        ? 'bg-blue-100/80 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60'
                        : 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                    }`}
                  >
                    {isDriver ? <Car className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                    <span>
                      {isDriver
                        ? `Chủ xe · ${Number(vehicleCapacity) === 5 ? 'Xe 4–5 chỗ' : 'Xe 7 chỗ'}`
                        : `Khách cần tìm xe · ${seats} người`}
                    </span>
                  </span>

                  {isDriver && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                      {carCategory === 'convenient_trip' ? 'Biển vàng / Tiện chuyến' : 'Xe gia đình'}
                    </span>
                  )}
                </div>

                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-800/60">
                  {formatVND(price)}/{isDriver ? 'ghế' : 'người'}
                </span>
              </div>

              {/* Lộ trình & Mũi tên */}
              <div className="p-3 rounded-xl bg-white dark:bg-[#151c2e] border border-slate-200/60 dark:border-white/5 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <span className="text-emerald-600 dark:text-emerald-400 truncate max-w-[45%]">
                    {fromLocation.trim() || 'Điểm đón'}
                  </span>
                  <ArrowLeftRight className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-rose-600 dark:text-rose-400 truncate max-w-[45%]">
                    {toLocation.trim() || 'Điểm đến'}
                  </span>
                </div>
                {waypointNote.trim() && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-teal-500 shrink-0" />
                    <span>{waypointNote.trim()}</span>
                  </p>
                )}
              </div>

              {/* Lịch trình & Ghế */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                  <span className="text-slate-400 text-[10.5px] block">Khởi hành:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                    {exactTime ? `${exactTime} · ` : ''}
                    {scheduleDay}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                  <span className="text-slate-400 text-[10.5px] block">
                    {isDriver ? 'Ghế trống nhận khách:' : 'Số vé cần ghép:'}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                    {seats} {isDriver ? 'ghế' : 'người'}
                    {isDriver && (
                      <span className="font-normal text-slate-400 text-[10px] ml-1">
                        ({Number(vehicleCapacity) === 5 ? 'Xe 5 chỗ' : 'Xe 7 chỗ'})
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Liên hệ Zalo */}
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-1">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <ZaloIcon className="w-3.5 h-3.5 text-blue-500" />
                  <span>Zalo: {phoneReal ? formatPhoneDisplay(phoneReal) : 'Chưa nhập SĐT'}</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {isDriver ? 'Cam kết không bắt khách dọc đường' : 'Cam kết có mặt đúng giờ'}
                </span>
              </div>
            </div>
          )}
        </div>

        {formError && (
          <div
            ref={errorBannerRef}
            className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 shadow-xs"
          >
            <span className="text-base shrink-0">⚠️</span>
            <span>{formError}</span>
          </div>
        )}

        <Button type="submit" size="lg" fullWidth icon={PlusCircle}>
          {t('post.submit')}
        </Button>
      </form>

      {/* ── MODAL XÁC NHẬN & XEM TRƯỚC TRƯỚC KHI ĐĂNG BÀI (PRE-FLIGHT CONFIRMATION) ── */}
      {showConfirmModal && pendingPayload && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="surface max-w-lg w-full rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-white/10 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                    {pendingPayload.type === 'driver_offer'
                      ? 'Xác nhận thông tin chuyến đi'
                      : 'Xác nhận nhu cầu tìm xe'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Vui lòng kiểm tra kỹ trước khi đưa bài lên sàn CarMate
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Chi tiết vé xem trước */}
            <div className="space-y-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-[#131929] border border-slate-200/80 dark:border-white/5">
              {/* Huy hiệu vai trò & Loại xe */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                  {pendingPayload.type === 'driver_offer' ? (
                    <Car className="w-3.5 h-3.5" />
                  ) : (
                    <Users className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {pendingPayload.type === 'driver_offer'
                      ? `Chủ xe · ${pendingPayload.capacity === 5 ? 'Xe 4–5 chỗ' : 'Xe 7 chỗ'}`
                      : `Người đi cùng · Cần ${pendingPayload.seatsNeeded} ghế`}
                  </span>
                </span>
                <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatVND(pendingPayload.basePricePerSeat || price)}/ghế
                </span>
              </div>

              {/* Lộ trình */}
              <div className="p-3 rounded-xl bg-white dark:bg-[#1a2238] border border-slate-200/60 dark:border-white/5">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <span className="text-emerald-600 dark:text-emerald-400">{pendingPayload.from}</span>
                  <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-rose-600 dark:text-rose-400">{pendingPayload.to}</span>
                </div>
                {pendingPayload.waypointNote && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-teal-500 shrink-0" />
                    <span>{pendingPayload.waypointNote}</span>
                  </p>
                )}
              </div>

              {/* Thời gian & Số ghế */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#1a2238] border border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-400 text-[10px] block">Khung giờ:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {pendingPayload.timeSlotLabel || pendingPayload.timeSlot}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#1a2238] border border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-400 text-[10px] block">Ngày khởi hành:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{pendingPayload.date}</span>
                </div>
              </div>

              {/* Zalo */}
              <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 flex items-center justify-between text-xs">
                <span className="text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1.5">
                  <ZaloIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>SĐT Zalo kết nối:</span>
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatPhoneDisplay(pendingPayload.phoneReal)}
                </span>
              </div>
            </div>

            {/* Hành động */}
            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="py-3 px-4 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 font-bold text-xs text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  ✏️ Chỉnh sửa lại
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPublish}
                  className="py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/25 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác nhận đăng bài</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            onShowToast?.('✅ Đã cập nhật vị trí che biển số!');
          }}
          onClose={() => setEditingMaskIndex(null)}
        />
      )}

      {/* Modal Định mức xăng & Cầu đường minh bạch */}
      {showFairSplitModal && (
        <FairSplitModal
          isOpen={showFairSplitModal}
          onClose={() => setShowFairSplitModal(false)}
          initialRouteKey="Tuyến CT Hà Nội - Hải Phòng"
          onSelectSuggestedPrice={(rate) => {
            setPrice(rate);
            setHasManuallyEditedPrice(true);
            onShowToast?.(`Đã áp dụng định mức phụ xăng ${formatVND(rate)}/ghế!`);
          }}
        />
      )}
    </div>
  );
}
