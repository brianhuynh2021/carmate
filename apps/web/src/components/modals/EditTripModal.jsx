import React, { useState, useMemo, useEffect } from 'react';
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
  CornerDownLeft
} from 'lucide-react';
import { TIME_SLOTS, formatVND, mapTimeToSlot, isTimeInSlot, VEHICLE_SEAT_CONFIGS } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import LocationSuggestInput from '../ui/LocationSuggestInput.jsx';
import { getSuggestedWaypoints } from '../../utils/vietnamLocations.js';

export default function EditTripModal({ trip, onClose, onSave }) {
  // Hook phải gọi trước mọi early return (Rules of Hooks)

  const isDriver = trip?.type === 'driver_offer';
  const [fromLocation, setFromLocation] = useState(trip?.from || '');
  const [toLocation, setToLocation] = useState(trip?.to || '');
  const [price, setPrice] = useState(trip?.basePricePerSeat || trip?.expectedPrice || 150000);
  const [vehicleCapacity, setVehicleCapacity] = useState(() => {
    if (trip?.capacity === 7 || (trip?.availableSeats && trip.availableSeats > 4)) return 7;
    return 5;
  });
  const [seats, setSeats] = useState(() => {
    const raw = trip?.availableSeats || trip?.seatsNeeded || 3;
    const max = trip?.capacity === 7 || (trip?.availableSeats && trip.availableSeats > 4) ? 6 : 4;
    return Math.min(raw, isDriver ? max : 6);
  });
  const [date, setDate] = useState(trip?.date || 'Hôm nay');
  const [timeSlot, setTimeSlot] = useState(trip?.timeSlot || '07:00-09:00');
  const [exactTime, setExactTime] = useState(trip?.exactTime || '');
  const [waypointNote, setWaypointNote] = useState(trip?.waypointNote || '');
  const [notes, setNotes] = useState(trip?.notes || '');
  const [saving, setSaving] = useState(false);

  // Đảo chiều điểm đi / điểm đến ⇄
  const handleSwapRoute = () => {
    const temp = fromLocation;
    setFromLocation(toLocation);
    setToLocation(temp);
  };

  // Tính toán gợi ý mốc đón trả thông minh theo tuyến hiện tại
  const suggestedWaypoints = useMemo(() => {
    return getSuggestedWaypoints(fromLocation, toLocation);
  }, [fromLocation, toLocation]);

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
    if (!fromLocation.trim() || !toLocation.trim()) return;
    setSaving(true);

    const slot = TIME_SLOTS.find((s) => s.id === timeSlot) || TIME_SLOTS[2];
    const cleanFrom = fromLocation.trim();
    const cleanTo = toLocation.trim();
    const fromCity = cleanFrom.split(/[,-]/)[0].trim() || cleanFrom;
    const toCity = cleanTo.split(/[,-]/)[0].trim() || cleanTo;
    const derivedRoute = `${fromCity} ⇄ ${toCity}`;

    const isExactTimeValid = exactTime && isTimeInSlot(exactTime.trim(), timeSlot);
    const validExactTime = isExactTimeValid ? exactTime.trim() : undefined;
    const timeSlotLabel = validExactTime ? `${validExactTime} (${slot.short})` : slot.short;

    const updates = {
      from: cleanFrom,
      to: cleanTo,
      route: derivedRoute,
      routeCategory: derivedRoute,
      capacity: isDriver ? vehicleCapacity : undefined,
      basePricePerSeat: isDriver ? Number(price) : undefined,
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
  }, [fromLocation, toLocation, price, seats, vehicleCapacity, date, timeSlot, waypointNote, notes, saving]);

  const quickDates = ['Hôm nay', 'Ngày mai', 'Thứ 7', 'Chủ nhật'];
  const currentSeatConfig = VEHICLE_SEAT_CONFIGS[vehicleCapacity] || VEHICLE_SEAT_CONFIGS[5];
  const seatOptions = isDriver ? currentSeatConfig.allowedSeats : [1, 2, 3, 4, 5, 6];

  if (!trip) return null;

  return (
    <Modal
      onClose={onClose}
      size="lg"
      icon={Edit3}
      iconTone="brand"
      title={`Chỉnh Sửa Bài Đăng (${trip.maskedCode})`}
      subtitle={
        <div className="flex items-center gap-2 mt-1">
          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
            {isDriver ? 'Chủ xe' : 'Hành khách'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Cập nhật lộ trình, mốc đón trả & giá vé</span>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Đóng
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 font-bold shadow-md shadow-primary-600/20"
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {/* ── 1. LỘ TRÌNH ĐIỀU CHỈNH ĐƯỢC + GỢI Ý ĐỊA ĐIỂM ── */}
        <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-[#151c2e]/60 border border-slate-200/80 dark:border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              <span>Lộ trình di chuyển</span>
            </span>
            <span className="text-[11px] text-slate-400">Gõ để gợi ý bến xe & tỉnh thành</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] gap-2 items-center">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                [ ĐIỂM ĐÓN ]
              </label>
              <LocationSuggestInput
                value={fromLocation}
                onChange={setFromLocation}
                placeholder="VD: Hà Nội (Mỹ Đình), Lộc Ninh..."
                icon={MapPin}
                iconColor="text-emerald-500"
              />
            </div>

            <div className="flex justify-center pt-2 sm:pt-4">
              <button
                type="button"
                onClick={handleSwapRoute}
                title="Đảo chiều lộ trình"
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1e293b] text-slate-500 hover:text-primary-600 shadow-2xs flex items-center justify-center cursor-pointer active:scale-90 active:rotate-180 transition-all"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">
                [ ĐIỂM ĐẾN ]
              </label>
              <LocationSuggestInput
                value={toLocation}
                onChange={setToLocation}
                placeholder="VD: Hải Phòng (Cầu Rào), Sài Gòn..."
                icon={Navigation}
                iconColor="text-rose-500"
              />
            </div>
          </div>
        </div>

        {/* ── 2. TRỤC ĐƯỜNG ĐÓN TRẢ + GỢI Ý THÔNG MINH THEO TUYẾN ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary-600" />
              <span>Trục đường tiện đón trả dọc tuyến:</span>
            </label>
            <span className="text-[11px] text-slate-400 font-mono">Tự động gợi ý mốc</span>
          </div>

          <input
            type="text"
            value={waypointNote}
            onChange={(e) => setWaypointNote(e.target.value)}
            placeholder="VD: Dọc Cao tốc 5B, nút giao Yên Mỹ, đón các ngã 3 cây xăng..."
            className="w-full h-10 px-3 rounded-xl text-xs bg-white dark:bg-[#151c2e] border border-slate-200/90 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 shadow-2xs"
          />

          {/* Quick Clickable Waypoint Chips */}
          <div className="pt-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Gợi ý theo tuyến:</span>
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

        {/* ── 2.5. QUY MÔ DÒNG XE (CHO CHỦ XE: 4-5 CHỖ VS 7 CHỖ) ── */}
        {isDriver && (
          <div className="space-y-2 p-3 rounded-2xl bg-[#f5f5f7] dark:bg-slate-900 border border-black/[0.04] dark:border-white/[0.06]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-[#0071e3]" />
                <span>Quy mô dòng xe:</span>
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {vehicleCapacity === 5 ? '🚗 Xe 4–5 chỗ (Tối đa 4 khách)' : '🚙 Xe 7 chỗ (Tối đa 6 khách)'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#e8e8ed] dark:bg-slate-800 border border-black/[0.04] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setVehicleCapacity(5);
                  if (seats > 4) setSeats(4);
                }}
                className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap select-none ${
                  vehicleCapacity === 5
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🚗 Xe 4–5 chỗ</span>
                <span className="text-[10px] font-normal opacity-70 hidden sm:inline">(Sedan/CUV)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVehicleCapacity(7);
                }}
                className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap select-none ${
                  vehicleCapacity === 7
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🚙 Xe 7 chỗ</span>
                <span className="text-[10px] font-normal opacity-70 hidden sm:inline">(MPV/SUV)</span>
              </button>
            </div>
          </div>
        )}

        {/* ── 3. GIÁ VÉ & SỐ CHỖ (TACTILE PILLS & STEPPERS) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Giá chia sẻ */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-primary-600" />
              <span>Giá vé ({isDriver ? 'thu khách' : 'dự kiến'}):</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="10000"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full h-10 px-3 rounded-xl text-sm font-bold tabular bg-white dark:bg-[#151c2e] border border-slate-200/90 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 shadow-2xs"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold font-mono">đ</span>
            </div>
            <p className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">
              {formatVND(Number(price) || 0)} /người (trọn gói)
            </p>
          </div>

          {/* Số ghế trống */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary-600" />
                <span>{isDriver ? 'Số ghế trống nhận khách:' : 'Số người cần đi:'}</span>
              </span>
              {isDriver && <span className="text-[10.5px] font-normal text-slate-400">(Đã trừ 1 ghế lái)</span>}
            </label>
            <div className="flex items-center gap-1.5">
              {seatOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeats(n)}
                  className={`flex-1 h-10 rounded-xl text-xs font-bold tabular transition-all cursor-pointer shadow-2xs ${
                    seats === n
                      ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-500/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#151c2e] dark:hover:bg-white/10 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>
                {isDriver
                  ? seats === 3 && vehicleCapacity === 5
                    ? '✨ Khuyên chọn: Hàng sau ngồi 3 người rất êm ái'
                    : seats === 4 && vehicleCapacity === 5
                      ? 'Đầy 4 ghế khách (ghế phụ + 3 ghế sau)'
                      : `Còn trống ${seats} ghế nhận khách`
                  : `Cần ${seats} vé ghép`}
              </span>
              {isDriver && (
                <span className="text-slate-400 font-mono text-[10.5px]">
                  {vehicleCapacity === 5 ? 'Tối đa 4' : 'Tối đa 6'}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* ── 4. NGÀY ĐI & KHUNG GIỜ (QUICK CHIPS) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Ngày xuất phát:</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {quickDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    date === d
                      ? 'bg-primary-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/5'
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
              placeholder="Hoặc gõ ngày khác..."
              className="w-full h-8 px-2.5 rounded-lg text-xs bg-white dark:bg-[#151c2e] border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 outline-none focus:border-primary-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary-600" />
              <span>Khung giờ chạy:</span>
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
              className="w-full h-10 px-3 rounded-xl text-xs font-semibold bg-white dark:bg-[#151c2e] border border-slate-200/90 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-primary-500 cursor-pointer shadow-2xs"
            >
              {TIME_SLOTS.filter((s) => s.id !== 'all' && !s.isAlias).map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Giờ hẹn cụ thể (tùy chọn):</span>
              <input
                type="time"
                value={exactTime || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setExactTime(val);
                  if (val) setTimeSlot(mapTimeToSlot(val));
                }}
                className="px-2 py-0.5 text-xs font-mono font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
              {exactTime && (
                <button
                  type="button"
                  onClick={() => setExactTime('')}
                  className="text-xs text-slate-400 hover:text-rose-500 font-bold px-1"
                  title="Xóa giờ cụ thể"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">Hai bên trao đổi hẹn giờ chính xác qua Zalo</p>
          </div>
        </div>

        {/* ── 5. GHI CHÚ THÊM ── */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary-600" />
            <span>Lời nhắn gửi bạn đồng hành:</span>
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="VD: Xe gia đình sạch sẽ, không khói thuốc, đón trả đúng hẹn..."
            className="w-full p-3 rounded-xl text-xs bg-white dark:bg-[#151c2e] border border-slate-200/90 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 resize-none shadow-2xs leading-relaxed"
          />
        </div>
      </form>
    </Modal>
  );
}
