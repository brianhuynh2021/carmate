import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Car,
  Users,
  Compass,
  MapPin,
  Clock,
  Calendar,
  Sparkles,
  ShieldCheck,
  Zap,
  RotateCcw,
  CheckCircle2,
  Phone,
  User,
  ArrowRight,
  Radio,
  Fuel
} from 'lucide-react';
import {
  VIRTUAL_HUBS,
  TIME_SLOTS,
  formatVND,
  getFixedSegmentTariff,
  cleanPhoneNumber,
  isValidVietnamesePhone
} from '@carmate/shared';
import api from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { getDefaultCorridor, getEndpointHubs } from '@carmate/shared';

const DEFAULT_CORRIDOR = getDefaultCorridor();

/**
 * Hai đầu hành lang nay lấy từ CORRIDORS registry (packages/shared) thay vì
 * liệt kê tay trong component. Trước đây cùng một danh sách hub bị chép ở hai
 * nơi (modal này và StationRiderView), thêm trạm mới là phải nhớ sửa cả hai.
 * Giữ nguyên tên export cũ để không phá vỡ nơi đang import.
 */
export const SAIGON_HUB_IDS = getEndpointHubs(DEFAULT_CORRIDOR.id, 'a').map((h) => h.id);
export const BINH_PHUOC_HUB_IDS = getEndpointHubs(DEFAULT_CORRIDOR.id, 'b').map((h) => h.id);

export default function MovementIntentModal({
  isOpen,
  onClose,
  initialRole = 'passenger',
  initialOriginHubId = null,
  initialDestHubId = null,
  currentUser = null,
  onSuccess,
  onShowToast
}) {
  const { t } = useI18n();
  const [role, setRole] = useState(initialRole);

  // Danh sách trạm theo khu vực địa lý để không bị rối (Stanford Ergonomics)
  const saigonHubs = useMemo(() => {
    return VIRTUAL_HUBS.filter((h) => SAIGON_HUB_IDS.includes(h.id));
  }, []);

  const binhPhuocHubs = useMemo(() => {
    return VIRTUAL_HUBS.filter((h) => h.corridor === 'Tuyến QL13' && !SAIGON_HUB_IDS.includes(h.id));
  }, []);

  // Hướng di chuyển: 'TO_SAIGON' (Bình Phước ➔ Sài Gòn) | 'TO_BINH_PHUOC' (Sài Gòn ➔ Bình Phước)
  const [direction, setDirection] = useState(() => {
    if (initialOriginHubId && SAIGON_HUB_IDS.includes(initialOriginHubId)) {
      return 'TO_BINH_PHUOC';
    }
    return 'TO_SAIGON';
  });

  const [originHubId, setOriginHubId] = useState(() => {
    if (initialOriginHubId) return initialOriginHubId;
    return 'hub_ql13_binh_long';
  });

  const [destHubId, setDestHubId] = useState(() => {
    if (initialDestHubId) return initialDestHubId;
    return 'hub_ql13_hang_xanh';
  });

  const [seats, setSeats] = useState(initialRole === 'driver' ? 3 : 1);

  useEffect(() => {
    if (initialRole) {
      setRole(initialRole);
      setSeats(initialRole === 'driver' ? 3 : 1);
    }
  }, [initialRole, isOpen]);

  // Ngày hẹn: Hôm nay / Ngày mai / Ngày mốt (Hiển thị 2 dòng trực quan theo iOS Calendar)
  const dateOptions = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);

    const fmt = (d) => d.toISOString().split('T')[0];
    const fmtSub = (d) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}`;
    };

    return [
      { value: fmt(today), title: 'Hôm nay', subDate: fmtSub(today) },
      { value: fmt(tomorrow), title: 'Ngày mai', subDate: fmtSub(tomorrow) },
      { value: fmt(dayAfter), title: 'Ngày mốt', subDate: fmtSub(dayAfter) }
    ];
  }, []);

  const [date, setDate] = useState(() => dateOptions[1].value); // Mặc định ngày mai
  const [timeSlot, setTimeSlot] = useState('05:00-07:00'); // Giờ cao điểm sáng sớm
  const [isRecurring, setIsRecurring] = useState(false); // Lên lịch lặp lại hàng tuần (T2-T6)
  const [recurringDays, setRecurringDays] = useState(['T2', 'T3', 'T4', 'T5', 'T6']);

  const toggleRecurringDay = (dayKey) => {
    setRecurringDays((prev) => {
      if (prev.includes(dayKey)) {
        if (prev.length === 1) return prev; // Giữ tối thiểu 1 ngày
        return prev.filter((d) => d !== dayKey);
      }
      return [...prev, dayKey];
    });
  };

  // Thông tin liên hệ
  const [phone, setPhone] = useState(() => {
    if (currentUser?.phone) return currentUser.phone;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('carmate_rider_phone') || '';
    }
    return '';
  });

  const [contactName, setContactName] = useState(() => {
    if (currentUser?.name) return currentUser.name;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('carmate_rider_name') || '';
    }
    return '';
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // Đồng bộ props khi mở modal
  useEffect(() => {
    if (isOpen) {
      setRole(initialRole === 'driver' ? 'driver' : 'passenger');
      const isOriginSaigon = initialOriginHubId && SAIGON_HUB_IDS.includes(initialOriginHubId);
      const targetDirection = isOriginSaigon ? 'TO_BINH_PHUOC' : 'TO_SAIGON';
      setDirection(targetDirection);

      if (targetDirection === 'TO_SAIGON') {
        const validOrigin = initialOriginHubId && !SAIGON_HUB_IDS.includes(initialOriginHubId)
          ? initialOriginHubId
          : 'hub_ql13_binh_long';
        const validDest = initialDestHubId && SAIGON_HUB_IDS.includes(initialDestHubId)
          ? initialDestHubId
          : 'hub_ql13_hang_xanh';
        setOriginHubId(validOrigin);
        setDestHubId(validDest);
      } else {
        const validOrigin = initialOriginHubId && SAIGON_HUB_IDS.includes(initialOriginHubId)
          ? initialOriginHubId
          : 'hub_ql13_hang_xanh';
        const validDest = initialDestHubId && !SAIGON_HUB_IDS.includes(initialDestHubId)
          ? initialDestHubId
          : 'hub_ql13_binh_long';
        setOriginHubId(validOrigin);
        setDestHubId(validDest);
      }

      if (currentUser?.phone) setPhone(currentUser.phone);
      if (currentUser?.name) setContactName(currentUser.name);
      setPhoneError('');
    }
  }, [isOpen, initialRole, initialOriginHubId, initialDestHubId, currentUser]);

  // Đổi chiều di chuyển rạch ròi 2 chiều
  const handleSetDirection = (newDir) => {
    if (newDir === direction) return;
    setDirection(newDir);

    if (newDir === 'TO_SAIGON') {
      // Chiều đi: Đón tại Bình Phước ➔ Đến tại Sài Gòn
      const nextOrigin = !SAIGON_HUB_IDS.includes(destHubId) ? destHubId : 'hub_ql13_binh_long';
      const nextDest = SAIGON_HUB_IDS.includes(originHubId) ? originHubId : 'hub_ql13_hang_xanh';
      setOriginHubId(nextOrigin);
      setDestHubId(nextDest);
    } else {
      // Chiều về: Đón tại Sài Gòn ➔ Đến tại Bình Phước
      const nextOrigin = SAIGON_HUB_IDS.includes(destHubId) ? destHubId : 'hub_ql13_hang_xanh';
      const nextDest = !SAIGON_HUB_IDS.includes(originHubId) ? originHubId : 'hub_ql13_binh_long';
      setOriginHubId(nextOrigin);
      setDestHubId(nextDest);
    }
  };

  const pickupHubs = direction === 'TO_SAIGON' ? binhPhuocHubs : saigonHubs;
  const dropoffHubs = direction === 'TO_SAIGON' ? saigonHubs : binhPhuocHubs;

  // Lấy thông tin trạm quy chuẩn dọc QL13
  const originHub = useMemo(() => {
    return VIRTUAL_HUBS.find((h) => h.id === originHubId) || VIRTUAL_HUBS[0];
  }, [originHubId]);

  const destHub = useMemo(() => {
    return VIRTUAL_HUBS.find((h) => h.id === destHubId) || VIRTUAL_HUBS[VIRTUAL_HUBS.length - 2];
  }, [destHubId]);

  // Tính định mức Shapley Value (Bất biến MIT & Zero Surge)
  const tariff = useMemo(() => {
    try {
      return getFixedSegmentTariff(originHubId, destHubId);
    } catch {
      return { pricePerSeat: 150000, driverPayoutFor2Seats: 270000, distanceKm: 95 };
    }
  }, [originHubId, destHubId]);

  const pricePerSeat = tariff.pricePerSeat || 150000;
  const totalPriceForRider = pricePerSeat * seats;
  const driverPayout = pricePerSeat * seats;

  // Xử lý gửi Ý định
  const handleSubmit = async (e) => {
    e.preventDefault();
    setPhoneError('');

    const clean = cleanPhoneNumber(phone);
    if (!clean || !isValidVietnamesePhone(clean)) {
      setPhoneError('Vui lòng nhập số điện thoại di động Việt Nam hợp lệ (10 số)');
      return;
    }

    if (originHubId === destHubId) {
      setPhoneError('Điểm đón và Điểm đến không được trùng nhau');
      return;
    }

    setIsSubmitting(true);
    try {
      // Lưu lại thông tin vào localStorage để tái sử dụng
      try {
        localStorage.setItem('carmate_rider_phone', clean);
        if (contactName) localStorage.setItem('carmate_rider_name', contactName);
      } catch {}

      const payload = {
        role,
        originHubId,
        originName: originHub.shortName || originHub.name,
        destinationHubId: destHubId,
        destinationName: destHub.shortName || destHub.name,
        corridor: 'Tuyến QL13',
        date,
        timeSlot,
        seats: Number(seats),
        isRecurring,
        recurringDays: isRecurring ? recurringDays : [],
        phone: clean,
        contactName: contactName.trim() || (role === 'driver' ? 'Chủ xe' : 'Khách đi cùng')
      };

      // 1. Tạo Intent trong cơ sở dữ liệu
      const res = await api.createMovementIntent(payload);

      // Lưu vai trò gần nhất vào LocalStorage để trang chủ tự động nhận diện
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('carmate_last_movement_role', role);
        } catch {}
      }

      // 2. Tự động kích hoạt phiên gom khớp lệnh WATTER tức thời
      try {
        await api.runBatchMatch({
          epochType: 'micro_batch',
          corridor: 'Tuyến QL13',
          date
        });
      } catch (matchErr) {
        console.warn('[MovementIntent] Auto batch match trigger:', matchErr);
      }

      onShowToast?.(
        role === 'driver'
          ? (isRecurring
              ? `⚡ Đã lưu lịch xe cố định hàng tuần (${recurringDays.join(', ')})! Hệ thống tự động gom khách cùng giờ mỗi tuần.`
              : '⚡ Đã lưu ý định chuyến xe! Hệ thống đang tự động gom khách cùng tuyến vào khung giờ hẹn.')
          : (isRecurring
              ? `⚡ Đã lưu lịch đi lại hàng tuần (${recurringDays.join(', ')})! Hệ thống tự động ghép xe tiện đường mỗi tuần.`
              : '⚡ Đã lưu nhu cầu đi chung! Hệ thống CarMate đang tự động kết nối xe tiện đường cho bạn.')
      );

      onSuccess?.(res?.data || payload);
      onClose();
    } catch (err) {
      console.error('[MovementIntent] Submit error:', err);
      setPhoneError(err?.message || 'Có lỗi xảy ra khi lưu ý định. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/75 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-[#121624] border border-slate-200 dark:border-white/[0.1] shadow-[0_25px_60px_rgba(0,0,0,0.35)] overflow-hidden text-slate-900 dark:text-slate-100 my-auto">
        {/* Header Modal */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                role === 'driver'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#0071e3]/15 text-[#0071e3] border border-[#0071e3]/30'
              }`}
            >
              {role === 'driver' ? <Car className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  {role === 'driver' ? t('intent.titleDriver') : t('intent.titlePassenger')}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  role === 'driver'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-[#0071e3]/20 text-[#0071e3] dark:text-[#2997ff] border-[#0071e3]/30'
                }`}>
                  {role === 'driver' ? t('intent.roleDriver') : t('intent.rolePassenger')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {role === 'driver'
                  ? t('intent.subtitleDriver')
                  : t('intent.subtitlePassenger')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.15] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 1. CHỌN HÀNH TRÌNH QL13 (PHÂN ĐỊNH RẠCH RÒI 2 CHIỀU ĐI - VỀ) */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold font-mono uppercase text-slate-500 dark:text-slate-400">
                {t('intent.step1Route')}
              </label>

              {/* Phân định rạch ròi 2 chiều di chuyển */}
              <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handleSetDirection('TO_SAIGON')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    direction === 'TO_SAIGON'
                      ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{t('intent.dirToSaigon')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDirection('TO_BINH_PHUOC')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    direction === 'TO_BINH_PHUOC'
                      ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{t('intent.dirToProvince')}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Ô 1: ĐIỂM ĐÓN (CHỈ CHỨA TRẠM ĐÚNG VÙNG ĐÓN) */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {direction === 'TO_SAIGON' ? 'Điểm Đón (Bình Phước)' : 'Điểm Đón (Sài Gòn / TP.HCM)'}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {direction === 'TO_SAIGON' ? 'Bình Phước' : 'TP.HCM'}
                  </span>
                </div>
                <select
                  value={originHubId}
                  onChange={(e) => setOriginHubId(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-white border-0 outline-none cursor-pointer truncate"
                >
                  {pickupHubs.map((hub) => (
                    <option key={hub.id} value={hub.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {hub.shortName || hub.name} — {hub.landmark}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                  📍 {originHub?.landmark}
                </div>
              </div>

              {/* Ô 2: ĐIỂM ĐẾN (CHỈ CHỨA TRẠM ĐÚNG VÙNG ĐẾN) */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {direction === 'TO_SAIGON' ? 'Điểm Đến (Sài Gòn / TP.HCM)' : 'Điểm Đến (Bình Phước)'}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {direction === 'TO_SAIGON' ? 'TP.HCM' : 'Bình Phước'}
                  </span>
                </div>
                <select
                  value={destHubId}
                  onChange={(e) => setDestHubId(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-white border-0 outline-none cursor-pointer truncate"
                >
                  {dropoffHubs.map((hub) => (
                    <option key={hub.id} value={hub.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {hub.shortName || hub.name} — {hub.landmark}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                  🎯 {destHub?.landmark}
                </div>
              </div>
            </div>
          </div>

          {/* 2. THỜI GIAN KHỞI HÀNH & LỊCH LẶP LẠI HÀNG TUẦN (ELON MUSK / APPLE ZERO-OVERHEAD) */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Cột 1: Chọn ngày hoặc lặp hàng tuần */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {t('intent.step2Date')}
                </label>
                <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                  {dateOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setDate(opt.value);
                        setIsRecurring(false);
                      }}
                      className={`py-2 px-1 text-center rounded-xl transition-all cursor-pointer border ${
                        !isRecurring && date === opt.value
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm'
                          : 'bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="block text-[11px] sm:text-xs font-bold leading-tight">{opt.title}</span>
                      <span className="block text-[9px] sm:text-[10px] opacity-75 font-mono mt-0.5">{opt.subDate}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsRecurring(true)}
                    className={`py-2 px-1 text-center rounded-xl transition-all cursor-pointer border ${
                      isRecurring
                        ? (role === 'driver'
                            ? 'bg-emerald-600 text-white border-transparent shadow-sm'
                            : 'bg-[#0071e3] text-white border-transparent shadow-sm')
                        : 'bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="block text-[11px] sm:text-xs font-bold leading-tight flex items-center justify-center gap-0.5">
                      <RotateCcw className="w-2.5 h-2.5" /> {t('intent.weekly')}
                    </span>
                    <span className="block text-[9px] sm:text-[10px] opacity-75 font-mono mt-0.5">{t('intent.fixed')}</span>
                  </button>
                </div>
              </div>

              {/* Cột 2: Khung giờ khởi hành */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {t('intent.departureSlot')}
                </label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer truncate"
                >
                  {TIME_SLOTS.filter((s) => s.id !== 'all' && !s.isAlias).map((slot) => (
                    <option key={slot.id} value={slot.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* BỘ CHỌN LỊCH LẶP LẠI HÀNG TUẦN (STANFORD ERGONOMICS & APPLE HIG) */}
            {isRecurring && (
              <div className="p-3 sm:p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-500/30 space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900 dark:text-sky-300">
                    <RotateCcw className="w-3.5 h-3.5 text-sky-500" />
                    <span>{t('intent.repeatWeekdays')}</span>
                  </div>
                  <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-bold">
                    {t('intent.daysPerWeek', { count: recurringDays.length })}
                  </span>
                </div>

                {/* Preset 1-chạm */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRecurringDays(['T2', 'T3', 'T4', 'T5', 'T6'])}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                      JSON.stringify(recurringDays.slice().sort()) === JSON.stringify(['T2', 'T3', 'T4', 'T5', 'T6'].sort())
                        ? 'bg-sky-600 text-white border-transparent'
                        : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {t('intent.presetWorkweek')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurringDays(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'])}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                      recurringDays.length === 7
                        ? 'bg-sky-600 text-white border-transparent'
                        : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {t('intent.presetAllWeek')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurringDays(['T6', 'CN'])}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                      JSON.stringify(recurringDays.slice().sort()) === JSON.stringify(['CN', 'T6'].sort())
                        ? 'bg-sky-600 text-white border-transparent'
                        : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {t('intent.presetWeekend')}
                  </button>
                </div>

                {/* Day Chips T2..CN */}
                <div className="grid grid-cols-7 gap-1 pt-1">
                  {[
                    { key: 'T2', label: 'T2' },
                    { key: 'T3', label: 'T3' },
                    { key: 'T4', label: 'T4' },
                    { key: 'T5', label: 'T5' },
                    { key: 'T6', label: 'T6' },
                    { key: 'T7', label: 'T7' },
                    { key: 'CN', label: 'CN' }
                  ].map((day) => {
                    const isSelected = recurringDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleRecurringDay(day.key)}
                        className={`h-9 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border ${
                          isSelected
                            ? (role === 'driver'
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-xs'
                                : 'bg-[#0071e3] text-white border-blue-400 font-black shadow-xs')
                            : 'bg-white/60 dark:bg-white/[0.04] text-slate-400 border-slate-200 dark:border-white/[0.08] hover:text-slate-600'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>

                <div className="text-[10px] text-sky-700 dark:text-sky-300/80 font-mono flex items-center gap-1 pt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-sky-500 shrink-0" />
                  <span>{t('intent.recurringNote')}</span>
                </div>
              </div>
            )}
          </div>

          {/* 3. SỐ GHẾ & ĐỊNH MỨC CHIA SẺ CHI PHÍ XĂNG XE */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <Fuel className="w-4 h-4 text-emerald-500" />
                <span>{t('intent.fairCostTitle')}</span>
              </span>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[11px] font-mono px-2 text-slate-500">
                  {role === 'driver' ? t('intent.seatsAvailable') : t('intent.ticketCount')}
                </span>
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSeats(num)}
                    className={`w-9 h-9 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      seats === num
                        ? 'bg-emerald-500 text-slate-950 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40 text-xs font-mono">
              <span className="text-slate-600 dark:text-slate-400">
                {role === 'driver' ? t('intent.driverFuelEstimate') : t('intent.riderFuelShare')}
              </span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {role === 'driver' ? `+${formatVND(driverPayout)}` : formatVND(totalPriceForRider)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t('intent.zeroPlatformFee')}
              </span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t('intent.tollIncluded')}
              </span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t('intent.noSurgeFixed')}
              </span>
            </div>
          </div>

          {/* 4. THÔNG TIN LIÊN HỆ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {t('intent.phoneLabel')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912345678"
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-[#0071e3]"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> {t('intent.nameLabel')}
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={role === 'driver' ? t('intent.roleDriver') : t('intent.rolePassenger')}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[#0071e3]"
              />
            </div>
          </div>

          {phoneError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium">
              {phoneError}
            </div>
          )}

          {/* NÚT SUBMIT GỬI Ý ĐỊNH */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full h-14 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-md ${
              role === 'driver'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                : 'bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-[#0071e3]/25'
            }`}
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>
                  {role === 'driver' ? t('intent.submitDriver') : t('intent.submitPassenger')}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(content, document.body) : null;
}
