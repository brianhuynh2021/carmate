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
  const [role, setRole] = useState(initialRole);
  const [originHubId, setOriginHubId] = useState(initialOriginHubId || 'hub_ql13_binh_long');
  const [destHubId, setDestHubId] = useState(initialDestHubId || 'hub_ql13_hang_xanh');
  const [seats, setSeats] = useState(initialRole === 'driver' ? 3 : 1);

  useEffect(() => {
    if (initialRole) {
      setRole(initialRole);
      setSeats(initialRole === 'driver' ? 3 : 1);
    }
  }, [initialRole, isOpen]);

  // Ngày hẹn: Hôm nay / Ngày mai / Ngày kia
  const dateOptions = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);

    const fmt = (d) => d.toISOString().split('T')[0];
    const fmtLabel = (d, label) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${label} (${dd}/${mm})`;
    };

    return [
      { value: fmt(today), label: fmtLabel(today, 'Hôm nay') },
      { value: fmt(tomorrow), label: fmtLabel(tomorrow, 'Ngày mai') },
      { value: fmt(dayAfter), label: fmtLabel(dayAfter, 'Ngày kia') }
    ];
  }, []);

  const [date, setDate] = useState(dateOptions[1].value); // Mặc định ngày mai
  const [timeSlot, setTimeSlot] = useState('05:00-07:00'); // Giờ cao điểm sáng sớm

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
      if (initialOriginHubId) setOriginHubId(initialOriginHubId);
      if (initialDestHubId) setDestHubId(initialDestHubId);
      if (currentUser?.phone) setPhone(currentUser.phone);
      if (currentUser?.name) setContactName(currentUser.name);
      setPhoneError('');
    }
  }, [isOpen, initialRole, initialOriginHubId, initialDestHubId, currentUser]);

  // Đảo chiều khứ hồi 1-chạm (⇄)
  const handleSwapDirection = () => {
    const temp = originHubId;
    setOriginHubId(destHubId);
    setDestHubId(temp);
  };

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
          ? '⚡ Đã lưu ý định chuyến xe! Hệ thống đang tự động gom khách cùng tuyến vào khung giờ hẹn.'
          : '⚡ Đã lưu ý định đi chung! Thuật toán Gale-Shapley đang tự động ghép xe tiện đường cho bạn.'
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
                  {role === 'driver' ? 'Lên Lịch Chuyến Xe (Chủ Xe)' : 'Hẹn Giờ / Đặt Chỗ Trước (Người Đi Cùng)'}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  role === 'driver'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-[#0071e3]/20 text-[#0071e3] dark:text-[#2997ff] border-[#0071e3]/30'
                }`}>
                  {role === 'driver' ? 'Chủ xe' : 'Người đi cùng'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {role === 'driver'
                  ? 'Chủ xe tiện chuyến · Tự động ghép thêm người đi cùng bù tiền xăng'
                  : 'Người đi cùng · Tự động ghép đúng xe ô tô gia đình tiện đường'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.15] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 1. VAI TRÒ CHÍNH CHỦ (LỊCH AI NGƯỜI ĐÓ - KHÔNG TRỘN LẪN) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold font-mono uppercase text-slate-500 dark:text-slate-400">
              1. Vai trò chính chủ
            </label>
            {role === 'driver' ? (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-sm">
                  <Car className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black uppercase font-mono tracking-wider text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                    <span>Lịch Lăn Bánh Dành Cho Chủ Xe</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                      Chính chủ
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Khai báo lộ trình xe chạy để hệ thống tự động đón thêm người đi cùng lấp đầy ghế trống
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#0071e3]/10 border border-[#0071e3]/30 text-[#0071e3] dark:text-[#2997ff]">
                <div className="w-10 h-10 rounded-xl bg-[#0071e3] text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black uppercase font-mono tracking-wider text-[#0071e3] dark:text-white flex items-center gap-1.5">
                    <span>Lịch Đặt Chỗ Dành Cho Người Đi Cùng</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0071e3]/20 text-[#0071e3] dark:text-[#2997ff] font-bold">
                      Chính chủ
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Khai báo trạm đón để hệ thống tự động khóa chỗ trên xe ô tô gia đình cùng lộ trình
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 2. CHỌN HÀNH TRÌNH QL13 (ĐIỂM ĐÓN & ĐIỂM ĐẾN) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-mono uppercase text-slate-500 dark:text-slate-400">
                2. Lộ trình trên Tuyến QL13
              </label>
              <button
                type="button"
                onClick={handleSwapDirection}
                className="text-xs font-mono font-bold text-[#0071e3] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Đổi chiều khứ hồi</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] space-y-1">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Điểm Đón
                </span>
                <select
                  value={originHubId}
                  onChange={(e) => setOriginHubId(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-white border-0 outline-none cursor-pointer"
                >
                  {VIRTUAL_HUBS.map((hub) => (
                    <option key={hub.id} value={hub.id} className="bg-white dark:bg-slate-900">
                      {hub.shortName || hub.name} ({hub.landmark})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] space-y-1">
                <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Điểm Đến
                </span>
                <select
                  value={destHubId}
                  onChange={(e) => setDestHubId(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-white border-0 outline-none cursor-pointer"
                >
                  {VIRTUAL_HUBS.map((hub) => (
                    <option key={hub.id} value={hub.id} className="bg-white dark:bg-slate-900">
                      {hub.shortName || hub.name} ({hub.landmark})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. CHỌN NGÀY & KHUNG GIỜ (EPOCH WINDOW) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> 3. Ngày di chuyển
              </label>
              <div className="grid grid-cols-3 gap-1">
                {dateOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDate(opt.value)}
                    className={`py-2 px-1 text-center rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                      date === opt.value
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                        : 'bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.08] hover:bg-slate-100'
                    }`}
                  >
                    {opt.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> 4. Khung giờ khởi hành
              </label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
              >
                {TIME_SLOTS.filter((s) => s.id !== 'all' && !s.isAlias).map((slot) => (
                  <option key={slot.id} value={slot.id} className="bg-white dark:bg-slate-900">
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. SỐ GHẾ & ĐỊNH MỨC TOÁN HỌC SHAPLEY */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <Fuel className="w-4 h-4 text-emerald-500" />
                <span>Định mức chi phí chia sẻ Shapley Value</span>
              </span>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[11px] font-mono px-2 text-slate-500">
                  {role === 'driver' ? 'Ghế trống:' : 'Số vé:'}
                </span>
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSeats(num)}
                    className={`w-6 h-6 rounded-lg text-xs font-bold cursor-pointer transition-all ${
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
                {role === 'driver' ? 'Hỗ trợ chi phí xăng dự kiến:' : 'Mức phụ xăng chia sẻ cố định:'}
              </span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {role === 'driver' ? `+${formatVND(driverPayout)}` : formatVND(totalPriceForRider)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> 0đ phí sàn
              </span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã gồm vé cầu đường
              </span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Không tăng giá
              </span>
            </div>
          </div>

          {/* 5. THÔNG TIN LIÊN HỆ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> Số điện thoại chính chủ <span className="text-rose-500">*</span>
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
                <User className="w-3.5 h-3.5" /> Tên xưng hô
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={role === 'driver' ? 'Chủ xe' : 'Khách đi cùng'}
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
                  {role === 'driver' ? 'LƯU LỊCH CHỦ XE (TỰ ĐỘNG NHẬN KHÁCH TIỆN ĐƯỜNG)' : 'LƯU LỊCH ĐẶT CHỖ (TỰ ĐỘNG GHÉP XE TIỆN CHUYẾN)'}
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
