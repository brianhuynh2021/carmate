import React, { useState, useMemo, useEffect } from 'react';
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

  // Định mức Geodesic Haversine Segment Tariff tự động.
  // Giá là ĐẦU RA của công thức nền tảng cho cặp trạm này — Chủ xe không tự đặt giá.
  const segmentTariff = useMemo(() => {
    return getFixedSegmentTariff(originHubId, destHubId);
  }, [originHubId, destHubId]);

  const displayPricePerSeat = segmentTariff.pricePerSeat;

  // ── CỔNG SỐ ĐIỆN THOẠI ──
  // Telegram Login Widget và Google đều KHÔNG cấp số điện thoại, nên tài khoản
  // vào bằng hai kênh này có phone rỗng. Trước đây Chủ xe điền hết form rồi mới
  // gặp "vui lòng cập nhật số điện thoại" mà không có chỗ nào nhập — ngõ cụt.
  // Nay chặn ngay đầu form và cho xác thực OTP tại chỗ.
  const existingPhone = currentUser?.phone || (() => {
    try {
      return localStorage.getItem('carmate_rider_phone') || '';
    } catch {
      return '';
    }
  })();
  const hasVerifiedPhone = Boolean(
    cleanPhoneNumber(existingPhone) && isValidVietnamesePhone(cleanPhoneNumber(existingPhone))
  );

  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isPhoneBusy, setIsPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(hasVerifiedPhone);
  const [devOtpHint, setDevOtpHint] = useState('');

  // Đếm ngược trước khi được gửi lại mã
  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = setInterval(() => setOtpCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const handleSendOtp = async () => {
    const clean = cleanPhoneNumber(phoneInput);
    if (!clean || !isValidVietnamesePhone(clean)) {
      setPhoneError('Số điện thoại không đúng định dạng nhà mạng Việt Nam.');
      return;
    }
    setPhoneError('');
    setIsPhoneBusy(true);
    try {
      const res = await api.requestOtp(clean);
      if (!res?.success) throw new Error(res?.error || 'Không gửi được mã xác thực');
      setOtpSent(true);
      setOtpCooldown(60);
      if (res.devOtp) setDevOtpHint(res.devOtp);
      onShowToast?.('📩 Đã gửi mã xác thực 6 số tới điện thoại của bạn.');
    } catch (err) {
      setPhoneError(err.message || 'Không gửi được mã xác thực. Thử lại sau.');
    } finally {
      setIsPhoneBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    const clean = cleanPhoneNumber(phoneInput);
    if (!otpInput || otpInput.trim().length < 4) {
      setPhoneError('Vui lòng nhập mã xác thực 6 số.');
      return;
    }
    setPhoneError('');
    setIsPhoneBusy(true);
    try {
      const res = await api.verifyPhoneForAccount(clean, otpInput.trim());
      if (!res?.success) throw new Error(res?.error || 'Mã xác thực không đúng');
      try {
        localStorage.setItem('carmate_rider_phone', clean);
      } catch {
        /* chế độ riêng tư chặn localStorage — không sao, máy chủ đã lưu */
      }
      setPhoneVerified(true);
      onShowToast?.('✅ Đã xác thực số điện thoại. Bạn có thể đăng chuyến ngay!');
    } catch (err) {
      setPhoneError(err.message || 'Mã xác thực không đúng hoặc đã hết hạn.');
    } finally {
      setIsPhoneBusy(false);
    }
  };

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

    const phone = existingPhone || phoneInput;
    const clean = cleanPhoneNumber(phone);

    if (!phoneVerified || !clean || !isValidVietnamesePhone(clean)) {
      setErrorMessage('Vui lòng xác thực số điện thoại ở đầu biểu mẫu trước khi đăng chuyến.');
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
          {/* CỔNG XÁC THỰC SỐ ĐIỆN THOẠI (chặn trước khi điền bất cứ thứ gì)    */}
          {/* ================================================================= */}
          {!phoneVerified && (
            <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-500/[0.07] border border-amber-300/50 dark:border-amber-400/25 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-amber-500/80 dark:text-amber-400/70 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="block text-[13px] font-bold text-slate-900 dark:text-white">
                    Xác thực số điện thoại
                  </span>
                  <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
                    Khách cần gọi được cho bạn để lên xe, nên cần xác thực số trước khi đăng chuyến.
                  </p>
                </div>
              </div>

              {!otpSent ? (
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="Số điện thoại (VD: 0984 883 750)"
                    className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-white dark:bg-[#0f1117] border border-slate-300 dark:border-white/15 text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isPhoneBusy}
                    className="h-11 px-4 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-60 text-white text-xs font-bold shrink-0 cursor-pointer active:scale-95 transition-all"
                  >
                    {isPhoneBusy ? '...' : 'Gửi mã'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Mã 6 số"
                      className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-white dark:bg-[#0f1117] border border-slate-300 dark:border-white/15 text-base font-mono font-black tracking-[0.3em] text-center text-slate-900 dark:text-white outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={isPhoneBusy}
                      className="h-11 px-4 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-60 text-white text-xs font-bold shrink-0 cursor-pointer active:scale-95 transition-all"
                    >
                      {isPhoneBusy ? '...' : 'Xác thực'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpInput('');
                        setDevOtpHint('');
                      }}
                      className="text-slate-500 dark:text-slate-400 underline cursor-pointer"
                    >
                      Đổi số khác
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpCooldown > 0 || isPhoneBusy}
                      className="text-[#0071e3] dark:text-sky-400 underline disabled:no-underline disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {otpCooldown > 0 ? `Gửi lại sau ${otpCooldown}s` : 'Gửi lại mã'}
                    </button>
                  </div>
                  {devOtpHint && (
                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      Môi trường thử nghiệm — mã: <strong>{devOtpHint}</strong>
                    </p>
                  )}
                </div>
              )}

              {phoneError && (
                <p className="text-[11.5px] font-medium text-rose-600 dark:text-rose-400">{phoneError}</p>
              )}
            </div>
          )}

          {/* Toàn bộ form bên dưới bị khoá cho tới khi số điện thoại được xác thực */}
          {/* min-w-0: fieldset mặc định có `min-width: min-content` nên không co lại
              được theo khung modal, làm nội dung tràn ngang ở khổ điện thoại. */}
          <fieldset
            disabled={!phoneVerified}
            className={`space-y-4 border-0 p-0 m-0 min-w-0 w-full ${
              !phoneVerified ? 'opacity-40 pointer-events-none select-none' : ''
            }`}
          >
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
                  className="flex-1 min-w-0 h-9 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer truncate"
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
                  className="flex-1 min-w-0 h-9 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer truncate"
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
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Phụ xăng ({segmentTariff.distanceKm} km):
                </span>
                <span className="flex items-center gap-1.5 text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {formatVND(displayPricePerSeat)} / ghế
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                </span>
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

          </fieldset>

          {/* Nút hành động chính */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !phoneVerified}
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
