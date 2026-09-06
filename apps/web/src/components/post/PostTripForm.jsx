import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Car, Users, PlusCircle, MapPin, Navigation, CalendarDays, Receipt, ExternalLink, ArrowLeftRight, Sparkles, Plus, Check, Clock, ChevronDown } from 'lucide-react';
import { ROUTE_BENCHMARKS, TIME_SLOTS, formatVND, getTimeSlotLabel, isGoogleMapsUrl, getGoogleMapsUrl, mapTimeToSlot } from '@carmate/shared';
import { useI18n, useDataLabel } from '../../i18n/index.jsx';
import { Field, Input, Select, Textarea, Checkbox, OptionCard } from '../ui/Field.jsx';
import Chip from '../ui/Chip.jsx';
import Button from '../ui/Button.jsx';
import { SectionHeader } from '../ui/EmptyState.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';
import LocationSuggestInput from '../ui/LocationSuggestInput.jsx';
import { getSuggestedWaypoints } from '../../utils/vietnamLocations.js';

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
              {exactTime ? `(Khung ${selectedSlot.short})` : `(${selectedSlot.label.split('(')[1]?.replace(')', '') || ''})`}
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
                onExactTimeChange?.('');
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
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function PostTripForm({ onSubmit, currentUser }) {
  const { t, lang } = useI18n();
  const data = useDataLabel();

  const [role, setRole] = useState('driver');
  // Lộ trình hoàn toàn tự do toàn quốc (Hà Nội, Hải Phòng, Đà Nẵng, Bình Phước, Sài Gòn...)
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [waypointNote, setWaypointNote] = useState('');
  const [timeSlot, setTimeSlot] = useState('07:00-09:00');
  const [exactTime, setExactTime] = useState('');
  const [carType, setCarType] = useState('Mitsubishi Xpander (Xe 7 chỗ)');
  const [carCategory, setCarCategory] = useState('family_car'); // 'family_car' | 'convenient_trip'
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState(150000);
  const [phoneReal, setPhoneReal] = useState(() => currentUser?.phone || '0984883750');
  const [zaloConfirmed, setZaloConfirmed] = useState(true);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (currentUser?.phone) {
      setPhoneReal(currentUser.phone);
    }
  }, [currentUser]);
  const [scheduleDay, setScheduleDay] = useState('Hôm nay');
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
  const [customPerk, setCustomPerk] = useState('');

  const isDriver = role === 'driver';
  const days = t('post.days');

  // Gợi ý mốc đón trả thông minh dọc tuyến theo điểm đi & đến
  const suggestedWaypoints = useMemo(() => {
    return getSuggestedWaypoints(fromLocation, toLocation);
  }, [fromLocation, toLocation]);

  const handleAddWaypoint = (wp) => {
    if (!waypointNote.trim()) {
      setWaypointNote(wp);
    } else if (!waypointNote.includes(wp)) {
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
    if (parsed.price) setPrice(parsed.price);
    if (parsed.phoneReal) setPhoneReal(parsed.phoneReal);
    if (parsed.carCategory) setCarCategory(parsed.carCategory);
    if (parsed.carType) setCarType(parsed.carType);
    if (parsed.acceptsParcel) setAcceptsParcel(true);
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
      setFormError('Bắt buộc: Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số) đã kích hoạt Zalo.');
      return;
    }
    if (!zaloConfirmed) {
      setFormError('Bắt buộc: Bạn phải cam kết số điện thoại này đang sử dụng Zalo để chốt điểm đón.');
      return;
    }

    if (!fromLocation.trim()) {
      setFormError('Vui lòng nhập điểm đón cụ thể (số nhà, ngõ xóm, cây xăng hoặc dán link Google Maps).');
      return;
    }
    if (!toLocation.trim()) {
      setFormError('Vui lòng nhập điểm đến / trả khách cụ thể (quận, bến xe hoặc dán link Google Maps).');
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
    }
    if (customPerk.trim()) {
      perks.push(customPerk.trim());
    }

    const cleanFrom = fromLocation.trim();
    const cleanTo = toLocation.trim();
    const fromCity = cleanFrom.split(/[,-]/)[0].trim() || cleanFrom;
    const toCity = cleanTo.split(/[,-]/)[0].trim() || cleanTo;
    const derivedRoute = `${fromCity} ⇄ ${toCity}`;

    onSubmit({
      id: `${isDriver ? 'DRV' : 'REQ'}-${Date.now().toString().slice(-4)}`,
      type: isDriver ? 'driver_offer' : 'passenger_request',
      carCategory: isDriver ? carCategory : undefined,
      maskedCode: `${isDriver ? 'CX' : 'KH'}-${Math.floor(100 + Math.random() * 900)}`,
      publicName: `${isDriver ? (carCategory === 'convenient_trip' ? 'Xe tiện chuyến' : 'Chủ xe') : 'Khách'} #${Math.floor(100 + Math.random() * 900)}`,
      phoneReal: phoneReal.trim() || '0984883750',
      direction: 'both',
      from: cleanFrom,
      to: cleanTo,
      route: derivedRoute,
      routeCategory: derivedRoute,
      hometown: fromCity,
      waypointNote: waypointNote.trim(),
      date: isRecurringWeekly ? `${scheduleDay} (Lặp lại hàng tuần)` : scheduleDay,
      timeSlot,
      exactTime: exactTime ? exactTime.trim() : undefined,
      timeSlotLabel: exactTime ? `${exactTime.trim()} (${slot.short})` : slot.short,
      carType: isDriver ? carType : undefined,
      capacity: isDriver ? Number(seats) + 1 : undefined,
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
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <SectionHeader icon={PlusCircle} title={t('post.title')} description={t('post.subtitle')} />

      {/* ── ĐĂNG CHUYẾN NHANH: DÁN BÀI ĐĂNG HOẶC GÕ TỰ NHIÊN ĐĂNG TRONG 3 GIÂY ── */}
      <div className="mt-6">
        <SmartTripComposer
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

      <form id="post-trip-form" onSubmit={handleSubmit} className="surface p-5 sm:p-7 space-y-6">
        {/* Role */}
        <div>
          <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-2">{t('post.whoAreYou')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OptionCard active={isDriver} onClick={() => setRole('driver')} icon={Car} title={t('post.driverRole')} />
            <OptionCard active={!isDriver} onClick={() => setRole('passenger')} icon={Users} title={t('post.passengerRole')} />
          </div>
        </div>

        {/* LỘ TRÌNH TỰ DO TOÀN QUỐC — KHÔNG ÉP CỨNG SÀI GÒN / VỀ TỈNH */}
        <FormSection icon={MapPin} title="Lộ trình di chuyển">
          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
            Linh hoạt điểm đi và điểm đến bất kỳ tỉnh thành nào trên toàn quốc (Hà Nội, Hải Phòng, Đà Nẵng, Bình Phước, Sài Gòn...).
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

          {/* TIỆN ĐÓN TRẢ DỌC ĐƯỜNG (TÙY CHỌN - TỰ DO CHO BÁC TÀI) */}
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
                    onClick={() => handleAddWaypoint(wp)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer shadow-2xs ${
                      isAdded
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 border border-slate-200/70 dark:border-white/5'
                    }`}
                  >
                    {isAdded ? <Check className="w-3 h-3 text-emerald-600" /> : <Plus className="w-3 h-3 text-slate-400" />}
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
              {days.map((day) => (
                <Chip key={day} active={scheduleDay === day} onClick={() => setScheduleDay(day)}>
                  {data.date(day)}
                </Chip>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span className="shrink-0">Hoặc ngày cụ thể khác:</span>
              <input
                type="text"
                value={days.includes(scheduleDay) ? '' : scheduleDay}
                onChange={(e) => setScheduleDay(e.target.value)}
                placeholder="VD: 25/12, Thứ 6 tuần sau..."
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#151c2e] text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 w-full max-w-xs transition-all"
              />
            </div>
            <Checkbox className="mt-3" checked={isRecurringWeekly} onChange={(e) => setIsRecurringWeekly(e.target.checked)} label={t('post.recurring')} />
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                {t('post.timeSlot')} <span className="text-rose-500">*</span>
              </label>
              <TimeSlotPicker value={timeSlot} onChange={setTimeSlot} exactTime={exactTime} onExactTimeChange={setExactTime} />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>{isDriver ? t('post.seatsDriver') : t('post.seatsPassenger')} <span className="text-rose-500">*</span></span>
                <span className="text-xs text-slate-400 font-normal">tối đa 7 chỗ</span>
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((num) => (
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
                ))}
              </div>
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
                    Xe dịch vụ chiều về rỗng khách, nhận ghép trợ giá chi phí cầu đường, không phí sàn.
                  </p>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {/* GIÁ TIỀN GỢI Ý / MỨC ĐÓNG GÓP */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 tracking-tight flex items-baseline justify-between">
                <span>{isDriver ? t('post.priceDriver') : t('post.pricePassenger')} <span className="text-rose-500">*</span></span>
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

              {/* Quick Price Preset Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 mr-0.5">Gợi ý nhanh:</span>
                {[100000, 150000, 200000, 250000].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrice(p)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                      Number(price) === p
                        ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 border border-slate-200/70 dark:border-white/5'
                    }`}
                  >
                    {(p / 1000).toLocaleString('vi-VN')}k
                  </button>
                ))}
              </div>
            </div>

            {isDriver ? (
              <Field label={t('post.carType')}>
                <Input value={carType} onChange={(e) => setCarType(e.target.value)} placeholder={t('post.carTypePh')} />
              </Field>
            ) : (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-200 block">💡 Mẹo tiết kiệm cho hành khách:</span>
                <p className="leading-relaxed">
                  Mức giá gợi ý khoảng 100k – 200k/ghế trên các trục QL13, QL14, QL1A giúp bạn kết nối với các chủ xe đi cùng lộ trình nhanh nhất.
                </p>
              </div>
            )}
          </div>

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
                className="w-full h-12 px-4 rounded-xl border text-base font-mono font-bold tracking-wider text-slate-900 dark:text-white bg-white dark:bg-[#161a28] border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 outline-none transition-all shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span>Được bảo mật danh tính tự động bằng mã viết tắt ({isDriver ? 'CX-xxx' : 'HK-xxx'}) trước khi kết nối</span>
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
                  <Checkbox checked={noSmoking} onChange={(e) => setNoSmoking(e.target.checked)} label="Không khói thuốc trên xe" />
                  <Checkbox checked={botIncluded} onChange={(e) => setBotIncluded(e.target.checked)} label="Trọn gói xăng xe & vé cầu đường" />
                  <Checkbox checked={familyCar} onChange={(e) => setFamilyCar(e.target.checked)} label="Xe gia đình êm ái, sạch sẽ" />
                  <Checkbox checked={largeTrunk} onChange={(e) => setLargeTrunk(e.target.checked)} label="Cốp rộng để nhiều hành lý" />
                  <Checkbox checked={acOn} onChange={(e) => setAcOn(e.target.checked)} label="Bật máy lạnh suốt tuyến" />
                  <Checkbox checked={acceptsParcel} onChange={(e) => setAcceptsParcel(e.target.checked)} label="📦 Nhận gửi đồ / bưu phẩm tiện chuyến" />
                  <Checkbox checked={noPet} onChange={(e) => setNoPet(e.target.checked)} label="Không nhận chở thú cưng" />
                </>
              ) : (
                <>
                  <Checkbox checked={noSmoking} onChange={(e) => setNoSmoking(e.target.checked)} label="Không hút thuốc lá" />
                  <Checkbox checked={compactLuggage} onChange={(e) => setCompactLuggage(e.target.checked)} label="Hành lý gọn gàng (balo/vali nhỏ)" />
                  <Checkbox checked={onTime} onChange={(e) => setOnTime(e.target.checked)} label="Đúng giờ hẹn, không trễ" />
                  <Checkbox checked={pickupHighway} onChange={(e) => setPickupHighway(e.target.checked)} label="Đón dọc Quốc Lộ tiện đường" />
                  <Checkbox checked={noPet} onChange={(e) => setNoPet(e.target.checked)} label="Không mang theo thú cưng" />
                  <Checkbox checked={hasChild} onChange={(e) => setHasChild(e.target.checked)} label="Có trẻ nhỏ đi cùng" />
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
                placeholder={isDriver ? "VD: Đón tận nơi tại Lộc Ninh, Không đón khách say xe..." : "VD: Cần 2 ghế cạnh nhau, Xin ngồi ghế trước chống say..."}
                className="text-xs bg-white dark:bg-slate-900"
              />
            </div>
          </div>


          <Field label={t('post.notes')} optional={t('common.optional')}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('post.notesPh')} />
          </Field>
        </FormSection>

        {formError && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300">
            ⚠️ {formError}
          </div>
        )}

        <Button type="submit" size="lg" fullWidth icon={PlusCircle}>{t('post.submit')}</Button>
      </form>
    </div>
  );
}
