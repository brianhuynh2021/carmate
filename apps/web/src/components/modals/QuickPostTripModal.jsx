import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Car,
  Clock,
  Calendar,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Edit2,
  Plus,
  Minus,
  RotateCcw,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import {
  VIRTUAL_HUBS,
  formatVND,
  getFixedSegmentTariff,
  cleanPhoneNumber,
  isValidVietnamesePhone,
  getDefaultCorridor,
  getEndpointHubs
} from '@carmate/shared';
import api from '../../api/client.js';

const DEFAULT_CORRIDOR = getDefaultCorridor();
const SAIGON_HUB_IDS = getEndpointHubs(DEFAULT_CORRIDOR.id, 'a').map((h) => h.id);

export default function QuickPostTripModal({
  isOpen,
  onClose,
  currentUser = null,
  onSuccess,
  onShowToast
}) {

  // 1. HỒ SƠ XE: Tự động load từ profile / garage / local storage
  const [vehicle, setVehicle] = useState(() => {
    try {
      const saved = localStorage.getItem('carmate_cockpit_vehicle');
      if (saved) return JSON.parse(saved);
    } catch {}
    if (currentUser?.vehicle?.plate) {
      return {
        plate: currentUser.vehicle.plate,
        model: `${currentUser.vehicle.brand || ''} ${currentUser.vehicle.model || ''}`.trim() || 'Mitsubishi Xpander',
        seats: currentUser.vehicle.capacity ? Math.min(4, currentUser.vehicle.capacity - 1) : 2
      };
    }
    return {
      plate: '93A - 568.42',
      model: 'Mitsubishi Xpander (Màu Trắng)',
      seats: 2
    };
  });

  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [tempPlate, setTempPlate] = useState(vehicle?.plate || '93A - 568.42');
  const [tempModel, setTempModel] = useState(vehicle?.model || 'Mitsubishi Xpander');

  // 2. KHỐI 1: HƯỚNG DI CHUYỂN
  const [direction, setDirection] = useState('TO_SAIGON'); // 'TO_SAIGON' | 'TO_BINH_PHUOC'

  const saigonHubs = useMemo(() => {
    return VIRTUAL_HUBS.filter((h) => SAIGON_HUB_IDS.includes(h.id));
  }, []);

  const binhPhuocHubs = useMemo(() => {
    const heading = direction === 'TO_SAIGON' ? 'b_to_a' : 'a_to_b';
    return getEndpointHubs(DEFAULT_CORRIDOR.id, 'b', heading);
  }, [direction]);

  const [originHubId, setOriginHubId] = useState('hub_ql13_tan_khai');
  const [destHubId, setDestHubId] = useState('hub_ql13_cho_ray');

  // Cập nhật trạm đón trả khi đổi hướng
  const handleToggleDirection = (newDir) => {
    if (newDir === direction) return;
    setDirection(newDir);
    if (newDir === 'TO_SAIGON') {
      setOriginHubId('hub_ql13_tan_khai');
      setDestHubId('hub_ql13_cho_ray');
    } else {
      setOriginHubId('hub_ql13_cho_ray');
      setDestHubId('hub_ql13_tan_khai');
    }
  };

  const pickupHubs = direction === 'TO_SAIGON' ? binhPhuocHubs : saigonHubs;
  const dropoffHubs = direction === 'TO_SAIGON' ? saigonHubs : binhPhuocHubs;

  const originHub = useMemo(() => {
    return VIRTUAL_HUBS.find((h) => h.id === originHubId) || VIRTUAL_HUBS[0];
  }, [originHubId]);

  const destHub = useMemo(() => {
    return VIRTUAL_HUBS.find((h) => h.id === destHubId) || VIRTUAL_HUBS[VIRTUAL_HUBS.length - 2];
  }, [destHubId]);

  // 3. KHỐI 2: THỜI GIAN KHỞI HÀNH
  const dateOptions = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const fmt = (d) => d.toISOString().split('T')[0];
    const fmtLabel = (d) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}`;
    };

    return [
      { id: 'today', value: fmt(today), label: `Hôm nay (${fmtLabel(today)})` },
      { id: 'tomorrow', value: fmt(tomorrow), label: `Sáng mai (${fmtLabel(tomorrow)})` }
    ];
  }, []);

  const [selectedDate, setSelectedDate] = useState(() => dateOptions[1].value); // Mặc định sáng mai
  const [isCustomDate, setIsCustomDate] = useState(false);
  const [customDateValue, setCustomDateValue] = useState('');

  const TIME_CHIPS = ['05:00', '07:00', '13:00', '16:00'];
  const [selectedTime, setSelectedTime] = useState('07:00');
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [customTimeValue, setCustomTimeValue] = useState('08:30');

  const finalTime = isCustomTime ? customTimeValue : selectedTime;
  const finalDate = isCustomDate ? customDateValue : selectedDate;

  // 4. KHỐI 3: SỐ GHẾ TRỐNG & CHI PHÍ CHIA SẺ
  const [availableSeats, setAvailableSeats] = useState(2);
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  const [customPriceInput, setCustomPriceInput] = useState('');

  // Định mức Geodesic Haversine Segment Tariff tự động
  const baseTariff = useMemo(() => {
    try {
      const t = getFixedSegmentTariff(originHubId, destHubId);
      return t.pricePerSeat || 165000;
    } catch {
      return 165000;
    }
  }, [originHubId, destHubId]);

  const displayPricePerSeat = isCustomPrice && Number(customPriceInput) > 0
    ? Number(customPriceInput)
    : baseTariff;

  // 5. TRẠNG THÁI GỬI DỮ LIỆU & BÁO LỖI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Lưu tạm thông tin xe nếu đổi xe
  const handleSaveTempVehicle = () => {
    if (!tempPlate.trim() || !tempModel.trim()) return;
    const v = {
      plate: tempPlate.trim().toUpperCase(),
      model: tempModel.trim(),
      seats: vehicle?.seats || 2
    };
    setVehicle(v);
    setIsEditingVehicle(false);
    try {
      localStorage.setItem('carmate_cockpit_vehicle', JSON.stringify(v));
    } catch {}
  };

  // 6. XỬ LÝ ĐĂNG CHUYẾN
  const handlePostTripSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const phone = currentUser?.phone || localStorage.getItem('carmate_rider_phone') || '';
    const clean = cleanPhoneNumber(phone);

    if (!clean || !isValidVietnamesePhone(clean)) {
      setErrorMessage('Vui lòng cập nhật số điện thoại hợp lệ để khách liên hệ đón rước');
      return;
    }

    // Validate thời gian khởi hành ít nhất 30 phút nếu đi hôm nay
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    if (finalDate === todayStr) {
      const timeMatch = String(finalTime).match(/^(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const tripMins = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
        const now = new Date();
        const curMins = now.getHours() * 60 + now.getMinutes();
        if (tripMins < curMins + 30) {
          setErrorMessage(`Giờ khởi hành (${finalTime}) phải cách hiện tại ít nhất 30 phút để kịp chuẩn bị đón khách.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const originName = originHub?.shortName || originHub?.name || 'Cây xăng Petrolimex Tân Khai';
      const destName = destHub?.shortName || destHub?.name || 'Cụm BV Chợ Rẫy / ĐHYD';

      const tripPayload = {
        type: 'driver_offer',
        from: originName,
        to: destName,
        originHubId,
        destinationHubId: destHubId,
        date: finalDate === todayStr ? 'Hôm nay' : finalDate,
        time: finalTime,
        timeSlot: `${finalTime}-${parseInt(finalTime.split(':')[0], 10) + 2}:00`,
        availableSeats: Number(availableSeats),
        // capacity là SỨC CHỨA THẬT của xe (5 hoặc 7 chỗ), không phải số ghế đăng nhận khách.
        // Lấy từ hồ sơ xe; nếu chưa có thì để server tự suy, tuyệt đối không tự chế từ availableSeats.
        capacity: currentUser?.vehicle?.capacity ? Number(currentUser.vehicle.capacity) : undefined,
        basePricePerSeat: Number(displayPricePerSeat),
        phoneReal: clean,
        userId: currentUser?.id || `DRV-${clean}`,
        // Không gắn biển số / dòng xe bịa vào chuyến đăng lên sàn: khách đặt xong
        // ra bến tìm một chiếc xe không tồn tại. Thiếu thì để trống.
        carType: vehicle?.model || '',
        licensePlate: vehicle?.plate || '',
        plateMask: vehicle?.plate ? vehicle.plate.replace(/\d{2}$/, 'xx') : '',
        direction: direction === 'TO_SAIGON' ? 'binh_phuoc_to_tphcm' : 'tphcm_to_binh_phuoc',
        routeCategory: 'Tuyến QL13',
        notes: `Đón tại ${originName} · Trả tại ${destName}`,
        status: 'active'
      };

      // 1. Tạo Trip thật lên Sàn Tuyến Tiện Chuyến
      const res = await api.createTrip(tripPayload);
      const createdTrip = res?.data || tripPayload;

      // 2. Đồng bộ Intent ngầm để kích hoạt cỗ máy gom theo đợt
      try {
        await api.createMovementIntent({
          role: 'driver',
          originHubId,
          originName,
          destinationHubId: destHubId,
          destinationName: destName,
          corridor: 'Tuyến QL13',
          date: finalDate,
          timeSlot: finalTime,
          seats: Number(availableSeats),
          phone: clean,
          contactName: currentUser?.name || 'Chủ xe'
        });
      } catch (intentErr) {
        console.warn('[QuickPostTripModal] Intent sync warning:', intentErr);
      }

      onShowToast?.('🎉 Đăng chuyến thành công! Chuyến xe đã xuất hiện trên Sàn đón khách.');
      onSuccess?.(createdTrip);
      onClose();
    } catch (err) {
      console.error('[QuickPostTripModal] Post error:', err);
      setErrorMessage(err?.message || 'Không thể đăng chuyến. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-md animate-fade-in font-sans">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#FFFFFF] dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 my-auto">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-[#DFE5EC]/50 dark:bg-black/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white uppercase font-mono">
                Đăng chuyến mới
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Thao tác 1-chạm trong 15 giây · 0đ phí nền tảng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-200/80 dark:bg-white/10 hover:bg-slate-300 text-slate-600 dark:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nội dung form 4 khối */}
        <form onSubmit={handlePostTripSubmit} className="p-4 sm:p-5 space-y-4 bg-[#DFE5EC]/30 dark:bg-[#0b0f19]/40">
          {/* ================================================================= */}
          {/* KHỐI 1: HƯỚNG DI CHUYỂN                                          */}
          {/* ================================================================= */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase font-mono text-slate-600 dark:text-slate-300">
                1. Hướng di chuyển
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                QL13 Tiện Chuyến
              </span>
            </div>

            {/* 2 Nút đảo chiều to bản 1-chạm */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleToggleDirection('TO_SAIGON')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                  direction === 'TO_SAIGON'
                    ? 'bg-[#0071e3] text-white border-blue-600 shadow-sm'
                    : 'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-200'
                }`}
              >
                <span>Bình Phước ➔ Sài Gòn</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleDirection('TO_BINH_PHUOC')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                  direction === 'TO_BINH_PHUOC'
                    ? 'bg-[#0071e3] text-white border-blue-600 shadow-sm'
                    : 'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-200'
                }`}
              >
                <span>Sài Gòn ➔ Bình Phước</span>
              </button>
            </div>

            {/* Dropdown trạm đón và trạm trả */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 w-16 shrink-0 font-medium">Trạm đón:</span>
                <select
                  value={originHubId}
                  onChange={(e) => setOriginHubId(e.target.value)}
                  className="flex-1 h-9 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer truncate"
                >
                  {pickupHubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.shortName || h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 w-16 shrink-0 font-medium">Trạm trả:</span>
                <select
                  value={destHubId}
                  onChange={(e) => setDestHubId(e.target.value)}
                  className="flex-1 h-9 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer truncate"
                >
                  {dropoffHubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.shortName || h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* KHỐI 2: THỜI GIAN KHỞI HÀNH                                       */}
          {/* ================================================================= */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs space-y-2.5">
            <span className="text-xs font-bold uppercase font-mono text-slate-600 dark:text-slate-300 block">
              2. Thời gian khởi hành
            </span>

            {/* Chip Ngày */}
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {dateOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSelectedDate(opt.value);
                    setIsCustomDate(false);
                  }}
                  className={`py-2 px-1.5 rounded-xl text-center font-bold transition-all cursor-pointer border ${
                    !isCustomDate && selectedDate === opt.value
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-transparent shadow-xs'
                      : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-200'
                  }`}
                >
                  <span className="block text-[11px] leading-tight">{opt.label}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsCustomDate(true)}
                className={`py-2 px-1.5 rounded-xl text-center font-bold transition-all cursor-pointer border ${
                  isCustomDate
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-transparent shadow-xs'
                    : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-200'
                }`}
              >
                <span className="block text-[11px] leading-tight">Ngày khác...</span>
              </button>
            </div>

            {isCustomDate && (
              <div className="pt-1">
                <input
                  type="date"
                  value={customDateValue}
                  onChange={(e) => setCustomDateValue(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-white/15 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                  required={isCustomDate}
                />
              </div>
            )}

            {/* Chip Khung Giờ 1-chạm */}
            <div className="pt-1">
              <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">
                Khung giờ khởi hành:
              </span>
              <div className="grid grid-cols-5 gap-1.5 text-xs font-mono">
                {TIME_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setSelectedTime(chip);
                      setIsCustomTime(false);
                    }}
                    className={`py-2 rounded-xl text-center font-bold transition-all cursor-pointer border ${
                      !isCustomTime && selectedTime === chip
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-xs'
                        : 'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-200'
                    }`}
                  >
                    {chip}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setIsCustomTime(true)}
                  className={`py-2 rounded-xl text-center font-bold transition-all cursor-pointer border ${
                    isCustomTime
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-xs'
                      : 'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-200'
                  }`}
                >
                  Khác
                </button>
              </div>

              {isCustomTime && (
                <div className="pt-2">
                  <input
                    type="time"
                    value={customTimeValue}
                    onChange={(e) => setCustomTimeValue(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-white/15 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                    required={isCustomTime}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ================================================================= */}
          {/* KHỐI 3: SỐ GHẾ TRỐNG & CHI PHÍ CHIA SẺ                            */}
          {/* ================================================================= */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs space-y-2.5">
            <span className="text-xs font-bold uppercase font-mono text-slate-600 dark:text-slate-300 block">
              3. Số ghế trống & Phụ xăng chia sẻ
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Bộ chọn số ghế */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
                <span className="text-xs text-slate-500 dark:text-slate-400">Số ghế nhận:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAvailableSeats((prev) => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white flex items-center justify-center active:scale-95 cursor-pointer font-bold"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-black font-mono text-slate-900 dark:text-white min-w-12 text-center">
                    {availableSeats} ghế
                  </span>
                  <button
                    type="button"
                    onClick={() => setAvailableSeats((prev) => Math.min(5, prev + 1))}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white flex items-center justify-center active:scale-95 cursor-pointer font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Mức phụ xăng */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
                <span className="text-xs text-slate-500 dark:text-slate-400">Chi phí đề xuất:</span>
                {isCustomPrice ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={customPriceInput}
                      onChange={(e) => setCustomPriceInput(e.target.value)}
                      placeholder={String(baseTariff)}
                      step={5000}
                      className="w-24 h-8 px-2 rounded-lg bg-white dark:bg-slate-800 border border-emerald-500 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomPrice(false)}
                      className="text-[11px] text-slate-400 hover:text-white px-1"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {formatVND(displayPricePerSeat)} / ghế
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPriceInput(String(baseTariff));
                        setIsCustomPrice(true);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                      title="Chỉnh sửa chi phí phụ xăng"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* KHỐI 4: XE CỦA BẠN (TỰ ĐỘNG LOAD TỪ HỒ SƠ)                        */}
          {/* ================================================================= */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs space-y-2">
            <span className="text-xs font-bold uppercase font-mono text-slate-600 dark:text-slate-300 block">
              4. Xe của bạn (Tự động nạp từ hồ sơ)
            </span>

            {isEditingVehicle ? (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={tempPlate}
                    onChange={(e) => setTempPlate(e.target.value.toUpperCase())}
                    placeholder="Biển số: 93A-568.xx"
                    className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                  />
                  <input
                    type="text"
                    value={tempModel}
                    onChange={(e) => setTempModel(e.target.value)}
                    placeholder="Hiệu xe: Xpander..."
                    className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingVehicle(false)}
                    className="px-3 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-700"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTempVehicle}
                    className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold"
                  >
                    Lưu xe
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🚗</span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      {vehicle?.model || 'Mitsubishi Xpander'}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {vehicle?.plate || '93A - 568.42'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingVehicle(true)}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                >
                  Đổi xe
                </button>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Nút hành động chính */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-13 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>🚀 ĐĂNG CHUYẾN NGAY (0đ PHÍ)</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 mt-2">
              Chuyến xe xuất hiện tức thì trên sàn & tự động kích hoạt ghép khách chờ
            </p>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(content, document.body) : null;
}
