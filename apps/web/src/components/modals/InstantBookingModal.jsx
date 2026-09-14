import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Phone,
  CheckCircle2,
  PhoneCall,
  MessageCircle,
  Car,
  Clock,
  MapPin,
  Users,
  Shield,
  ShieldCheck,
  Star,
  X,
  Sparkles,
  ArrowRight,
  Send,
  MessageSquare,
  Loader2
} from 'lucide-react';
import {
  formatVND,
  cleanPhoneNumber,
  isValidVietnamesePhone,
  resolveDriverRealName,
  resolveFullPlate,
  maskCustomerPlate,
  getTelegramChatUrl
} from '@carmate/shared';
import { api, setStoredAuthToken } from '../../api/client.js';
import { CarMateBadge } from '../ui/Logo.jsx';

/**
 * Trả về chuỗi Thứ và Ngày/Tháng theo định dạng chuẩn CarMate (ví dụ: "Thứ 2 (14/09)")
 */
function formatTripTimeHeader(_departureLabel = '04:30', departureDate = null) {
  let targetDate = new Date();

  if (departureDate === 'Ngày mai') {
    targetDate = new Date(Date.now() + 86400000);
  } else if (departureDate === 'Hôm nay') {
    targetDate = new Date();
  } else if (departureDate) {
    const parsed = new Date(departureDate);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  const dayOfWeekNames = [
    'Chủ Nhật',
    'Thứ 2',
    'Thứ 3',
    'Thứ 4',
    'Thứ 5',
    'Thứ 6',
    'Thứ 7'
  ];
  const dayName = dayOfWeekNames[targetDate.getDay()] || 'Hôm nay';
  const day = String(targetDate.getDate()).padStart(2, '0');
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');

  return `${dayName} (${day}/${month})`;
}

export default function InstantBookingModal({
  onRequireAuth,
  isOpen,
  onClose,
  onViewBookedTab,
  trip,
  originHub,
  destinationHub,
  segmentPrice = 165000,
  currentUser = null,
  onAuthSuccess,
  onBookingSuccess,
  onShowToast
}) {
  const hasUserPhone = Boolean(currentUser?.phone && isValidVietnamesePhone(currentUser.phone));

  // Bước 1: Xác thực nhanh SĐT (chỉ khi chưa có SĐT)
  // Bước 3: Match & Reveal (Chốt thành công & mở khoá thông tin chủ xe - BỎ HẲN BƯỚC 2 DƯ THỪA)
  const [step, setStep] = useState(() => (hasUserPhone ? 3 : 1));

  // Không còn state xác thực tại chỗ: khách chưa đăng nhập được mời đăng nhập thật,
  // không tự nhập SĐT rồi nhận mã OTP mô phỏng ngay trong modal đặt chỗ.

  // Số ghế nhận trực tiếp từ lựa chọn trên TripDetailBottomSheet
  const seats = Number(trip?.initialSeats || 1);
  const pickupPoint = originHub?.landmark || originHub?.name || trip?.fromLocation || 'Cây xăng Petrolimex Tân Khai (QL13)';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const pricePerSeat = Number(trip?.pricePerSeat || segmentPrice || 165000);
  const totalFuelShare = pricePerSeat * seats;

  const hasAutoBookedRef = useRef(false);

  // ── HÀM TẠO BOOKING TRỰC TIẾP (1-CHẠM / ZERO-BLOCKING) ─────────────
  const executeBooking = async (passengerPhone, passengerName) => {
    setIsSubmitting(true);
    const activePhone = cleanPhoneNumber(passengerPhone);
    const activeName = (passengerName || 'Người đi cùng').trim();
    const bookingCode = `CX-${Math.floor(1000 + Math.random() * 9000)}`;

    const bookingPayload = {
      escrowId: bookingCode,
      tripId: trip.tripId || trip.id,
      targetTripId: trip.tripId || trip.id,
      from: originHub?.name || trip.fromLocation || 'Ngã ba Tân Khai',
      to: destinationHub?.name || trip.toLocation || 'Cụm BV Chợ Rẫy / ĐHYD',
      pickupPoint: pickupPoint.trim(),
      date: trip.departureDate || new Date().toISOString().slice(0, 10),
      time: trip.departureLabel || '',
      timeLabel: `${trip.departureLabel || ''} ${trip.departureDate || ''}`.trim(),
      seats,
      price: pricePerSeat,
      totalDeal: totalFuelShare,
      passengerPhone: activePhone,
      passengerName: activeName,
      // Không bịa SĐT / tên / dòng xe vào bản ghi booking: dữ liệu bịa được lưu
      // xuống CSDL rồi lan sang ví vé, vé PNG và thẻ pháp lý. Thiếu thì để trống,
      // máy chủ sẽ điền từ bản ghi chuyến thật nếu có.
      driverPhone: trip.phone || trip.phoneReal || '',
      driverName: resolveDriverRealName(trip, trip.driverName || ''),
      carModel: trip.vehicleModel || trip.carType || '',
      fullPlate: resolveFullPlate(trip),
      status: 'confirmed'
    };

    try {
      const res = await api.createBooking(bookingPayload);
      const created = res?.data || bookingPayload;
      if (res?.token) {
        setStoredAuthToken(res.token);
      }
      if (res?.user) {
        onAuthSuccess?.(res.user);
      }
      // Lưu tức thì vào bộ nhớ đệm thiết bị để bảo toàn dữ liệu (MIT Invariant & Zero-Blocking)
      try {
        const cached = JSON.parse(localStorage.getItem('carmate_cached_bookings') || '[]');
        const updated = [created, ...cached.filter((b) => (b.escrowId || b.id) !== (created.escrowId || created.id))];
        localStorage.setItem('carmate_cached_bookings', JSON.stringify(updated.slice(0, 50)));
      } catch {}

      setConfirmedBooking(created);
      onBookingSuccess?.(created);
      onShowToast?.('🎉 Đã giữ chỗ thành công! Đang mở thông tin Chủ xe...', 'success');
      setStep(3);
    } catch (err) {
      console.warn('[InstantBookingModal] Lỗi tạo booking:', err.message);
      // KHÔNG dựng vé cục bộ khi máy chủ chưa nhận: chỗ ngồi chưa hề được giữ,
      // mà khách lại thấy màn hình "đã giữ chỗ thành công" cùng số điện thoại Chủ xe.
      // Mở lại chốt chặn để khách có thể thử lại chuyến này.
      try {
        const tripKey = trip.tripId || trip.id;
        if (tripKey) sessionStorage.removeItem(`carmate_autobooked_${tripKey}`);
      } catch {}
      hasAutoBookedRef.current = false;

      onShowToast?.('Chưa giữ được chỗ do lỗi kết nối. Vui lòng thử lại.');
      onClose?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tự động giữ chỗ ngay lập tức khi khách đã có SĐT (1-chạm Stanford Ergonomics).
  //
  // Chốt chặn phải BỀN VỮNG theo chuyến, không dùng useRef: modal chỉ được render khi
  // `selectedBookingTrip` khác null, nên mỗi lần đóng rồi mở lại (kể cả khi bấm quay lại)
  // component unmount và ref reset về false -> mở lại N lần là tạo N vé thật khác nhau.
  useEffect(() => {
    if (!isOpen || !trip || !hasUserPhone) return;

    const tripKey = trip.tripId || trip.id;
    if (!tripKey) return;
    const guardKey = `carmate_autobooked_${tripKey}`;

    try {
      if (sessionStorage.getItem(guardKey)) return;
      sessionStorage.setItem(guardKey, String(Date.now()));
    } catch {
      // Không đọc/ghi được sessionStorage -> lùi về chốt chặn trong phiên render hiện tại
      if (hasAutoBookedRef.current) return;
    }
    hasAutoBookedRef.current = true;
    executeBooking(currentUser.phone, currentUser.name);
    // Cố ý bỏ executeBooking và currentUser.* khỏi deps: executeBooking được tạo lại
    // mỗi lần render, đưa vào deps sẽ khiến effect chạy lại và tạo thêm vé.
    // Chốt chặn thật nằm ở sessionStorage phía trên.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, trip, hasUserPhone]);

  const displayPlateNumber = maskCustomerPlate(confirmedBooking || trip);
  const driverPhoneNumber = confirmedBooking?.driverPhoneDirect || confirmedBooking?.driverPhone || trip.phone || '';
  const cleanCallPhone = String(driverPhoneNumber).replace(/\D/g, '');
  const displayDriverPhone = cleanCallPhone.length === 10
    ? `${cleanCallPhone.slice(0, 4)}.${cleanCallPhone.slice(4, 7)}.${cleanCallPhone.slice(7)}`
    : driverPhoneNumber;
  const realDriverName = resolveDriverRealName(
    confirmedBooking || trip,
    confirmedBooking?.driverName || trip.driverName || ''
  );
  const timeHeader = formatTripTimeHeader(trip?.departureLabel, trip?.departureDate);
  const dropoffPoint = destinationHub?.name || trip?.toLocation || 'Cụm BV Chợ Rẫy / BV Đại học Y Dược';

  const handleCompleteAndClose = () => {
    onClose?.();
    const finalBooking = confirmedBooking || trip;
    if (finalBooking) {
      onBookingSuccess?.(finalBooking);
    }
    if (onViewBookedTab) {
      onViewBookedTab('booked', finalBooking);
    } else {
      try {
        sessionStorage.setItem('carmate_active_tab', 'booked');
        window.history.pushState(null, '', '/my-trips');
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch {}
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[96vh] sm:max-h-[95vh] sm:max-w-lg bg-white dark:bg-[#1c1c1e] rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200/70 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thanh kéo trên mobile (Apple Pull Handle) */}
        <div className="pt-2 pb-0.5 flex justify-center sm:hidden shrink-0 bg-white dark:bg-[#1c1c1e]">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-white/20 rounded-full" />
        </div>

        {/* ── HEADER MODAL (ĐỒNG BỘ 100% VỚI IMAGE 2) ── */}
        <div className="px-5 py-3 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-white dark:bg-[#1c1c1e]">
          <div className="flex items-center gap-2 min-w-0">
            <CarMateBadge size="xs" />
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-700/40">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                {isSubmitting ? 'Đang giữ chỗ...' : step === 1 ? 'Xác thực đặt chỗ' : 'Đã giữ chỗ thành công'}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── NỘI DUNG CUỘN (SCROLLABLE BODY - CHUẨN MIT TRANSIT CANVAS #DFE5EC) ── */}
        <div className="overflow-y-auto px-4 sm:px-5 py-3.5 space-y-3 text-slate-900 dark:text-white bg-[#DFE5EC] dark:bg-[#121721] transition-colors">
          {/* ── TRẠNG THÁI SUBMITTING (SPINNER ĐANG GIỮ CHỖ) ────────────────── */}
          {isSubmitting && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center animate-fade-in bg-white dark:bg-[#1a2232] rounded-2xl border border-slate-300/70 dark:border-white/10 p-6 shadow-xs">
              <Loader2 className="w-10 h-10 text-[#0071e3] animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Đang kết nối Chủ xe và giữ chỗ ngay (0đ cọc)...
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mã hoá bảo mật thông tin & tạo phiếu giữ chỗ
                </p>
              </div>
            </div>
          )}

          {/* ── CHƯA ĐĂNG NHẬP: MỜI ĐĂNG NHẬP, KHÔNG TỰ XÁC THỰC TẠI CHỖ ──
              Trước đây khối này có luồng OTP mô phỏng: bấm "Tiếp tục" là tự điền
              mã 123456, không gọi máy chủ, không xác thực gì — ai cũng giữ chỗ được
              bằng số điện thoại của người khác. Giữ chỗ nay bắt buộc đăng nhập thật. */}
          {!isSubmitting && step === 1 && (
            <div className="bg-white dark:bg-[#1a2232] rounded-2xl border border-slate-300/70 dark:border-white/10 p-5 shadow-xs space-y-4 animate-fade-in text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-[#0071e3] flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Đăng nhập để giữ chỗ
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Vé giữ chỗ gắn với số điện thoại đã xác thực của bạn. Sau khi hai bên
                  chốt chuyến, thông tin liên hệ mới được mở khoá cho cả Chủ xe và bạn.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onRequireAuth?.();
                }}
                className="w-full h-12 rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-bold text-sm shadow-lg shadow-blue-600/25 active:scale-98 transition-all cursor-pointer"
              >
                Đăng nhập / Đăng ký
              </button>
            </div>
          )}

          {/* ── BƯỚC 3: MỞ KHOÁ THÔNG TIN 2 CHIỀU (MATCH & REVEAL - ĐỒNG BỘ 100% VỚI IMAGE 2) ── */}
          {!isSubmitting && step === 3 && (
            <>
              {/* 1. KHỐI THỜI GIAN & MÃ GIỮ CHỖ */}
              <div className="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="px-2.5 py-1 rounded-xl bg-slate-950 dark:bg-black text-white font-mono font-bold text-base sm:text-lg shrink-0 shadow-2xs border border-blue-500/20">
                    {trip.departureLabel || '—'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {timeHeader}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Mã vé: <strong className="text-emerald-600 dark:text-emerald-400">#{confirmedBooking?.escrowId || '—'}</strong>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    {seats} ghế · 0đ cọc
                  </span>
                </div>
              </div>

              {/* 2. LỘ TRÌNH THỰC TẾ (ĐÓN / TRẢ) */}
              <div className="p-3 rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs hover:shadow-md transition-all duration-200 space-y-1.5">
                <div className="flex items-start gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 text-[8px] font-bold shadow-2xs">
                    ●
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">Trạm đón</p>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {pickupPoint}
                    </p>
                  </div>
                </div>

                <div className="flex items-center pl-1 -my-1 text-slate-300 dark:text-slate-600">
                  <span className="text-xs font-mono select-none">↓</span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-[#0071e3] bg-white dark:bg-[#1c1c1e] text-[#0071e3] flex items-center justify-center shrink-0 mt-0.5 text-[7px] font-bold shadow-2xs">
                    ○
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">Trạm trả</p>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {dropoffPoint}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. THÔNG TIN CHỦ XE & PHƯƠNG TIỆN (MATCH & REVEAL) */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs hover:shadow-md transition-all duration-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Chủ xe:</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {realDriverName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>{Number(trip.rating || 5.0).toFixed(1)}</span>
                    <span className="text-slate-400 font-normal">({Number(trip.completedCount || 0) > 0 ? `${Number(trip.completedCount)} chuyến` : 'Chủ xe mới'})</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Số điện thoại:</span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {displayDriverPhone}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Dòng xe:</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {confirmedBooking?.carModel || trip.vehicleModel || trip.carType || 'Chưa cập nhật'}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300/80 dark:border-white/15 shadow-2xs">
                    {displayPlateNumber}
                  </span>
                </div>

                <div className="pt-1.5 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Chi phí chia sẻ:</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">
                      {formatVND(totalFuelShare)}
                    </span>
                    <span className="text-[11px] text-slate-400 block font-normal">
                      ({seats} ghế · Trả khi lên xe)
                    </span>
                  </div>
                </div>
              </div>

              {/* DÒNG THÔNG BÁO CHỮ VÀNG NGHIÊNG */}
              <div className="px-3 py-2 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-600/30 text-center shadow-2xs">
                <p className="text-xs sm:text-[12.5px] italic font-medium text-amber-700 dark:text-amber-300">
                  Chủ xe sẽ liên hệ với bạn ngay trong vòng 10' tới
                </p>
              </div>

              {/* 5. CÁC NÚT THAO TÁC (ACTIONS) */}
              <div className="space-y-2 pt-1 pb-1">
                <a
                  href={`tel:${cleanCallPhone}`}
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4 shrink-0" />
                  <span>Gọi trực tiếp: {displayDriverPhone}</span>
                </a>

                {/* Hàng 2 nút Nhắn tin nhanh Zalo & Telegram */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://zalo.me/${cleanCallPhone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 h-11 rounded-2xl bg-[#0068ff] hover:bg-[#0058db] active:scale-[0.98] text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>Nhắn Zalo</span>
                  </a>

                  <a
                    href={getTelegramChatUrl(cleanCallPhone)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 h-11 rounded-2xl bg-[#229ED9] hover:bg-[#1d8bc0] active:scale-[0.98] text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span>Nhắn Telegram</span>
                  </a>
                </div>

                <button
                  type="button"
                  onClick={handleCompleteAndClose}
                  className="flex items-center justify-center w-full h-10 rounded-2xl bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 border border-slate-300/70 dark:border-white/10 font-bold text-xs transition-colors cursor-pointer"
                >
                  Hoàn tất & Đóng
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
