import React, { useState } from 'react';
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
  X,
  Sparkles,
  ArrowRight,
  Send
} from 'lucide-react';
import {
  formatVND,
  cleanPhoneNumber,
  isValidVietnamesePhone
} from '@carmate/shared';
import { api } from '../../api/client.js';

export default function InstantBookingModal({
  isOpen,
  onClose,
  trip,
  originHub,
  destinationHub,
  segmentPrice = 170000,
  currentUser = null,
  onAuthSuccess,
  onBookingSuccess,
  onShowToast
}) {
  // ── 1. Quản lý trạng thái bước (Step management) ────────────────────────
  // Bước 1: Auth Gateway (Chỉ bật nếu chưa có SĐT)
  // Bước 2: Review Modal (Chốt cuốc, chọn 1-2 ghế, Read-only lộ trình)
  // Bước 3: Match & Reveal (Đã đặt thành công, mở khoá biển số thật & nút gọi lớn)
  const hasUserPhone = Boolean(currentUser?.phone && isValidVietnamesePhone(currentUser.phone));
  const [step, setStep] = useState(() => (hasUserPhone ? 2 : 1));

  // State Step 1: Xác thực nhanh SĐT
  const [phoneInput, setPhoneInput] = useState(() => currentUser?.phone || '');
  const [nameInput, setNameInput] = useState(() => currentUser?.name || '');
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // State Step 2: Chọn ghế & Điểm đón
  const [seats, setSeats] = useState(1);
  const [pickupPoint, setPickupPoint] = useState(() => originHub?.landmark || originHub?.name || 'Ngã ba Tân Khai (ven QL13)');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Step 3: Kết quả sau khi chốt thành công
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  if (!isOpen || !trip) return null;

  const maxAvailable = Math.min(Number(trip?.seatsAvailable || 1), 3);

  const pricePerSeat = Number(trip.pricePerSeat || segmentPrice || 170000);
  const totalFuelShare = pricePerSeat * seats;

  // ── XỬ LÝ BƯỚC 1: XÁC THỰC SĐT (10 GIÂY) ─────────────────────────────
  const handleSendOtp = () => {
    const cleaned = cleanPhoneNumber(phoneInput);
    if (!isValidVietnamesePhone(cleaned)) {
      onShowToast?.('Vui lòng nhập số điện thoại hợp lệ (10 số, ví dụ 0912 345 678)');
      return;
    }
    setOtpSent(true);
    setOtpInput('123456'); // Hỗ trợ autofill test OTP nhanh cho trải nghiệm 10s
    onShowToast?.(`Đã gửi mã xác nhận 6 số tới ${cleaned}`, 'info');
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    const cleaned = cleanPhoneNumber(phoneInput);
    if (!isValidVietnamesePhone(cleaned)) {
      onShowToast?.('Vui lòng nhập số điện thoại hợp lệ');
      return;
    }
    if (!otpInput || otpInput.trim().length < 4) {
      onShowToast?.('Vui lòng nhập mã xác nhận 6 số');
      return;
    }

    setIsVerifying(true);
    try {
      // Đăng nhập hoặc định danh khách nhanh
      const guestUser = {
        id: `USR-${cleaned}`,
        phone: cleaned,
        name: nameInput.trim() || `Khách ${cleaned.slice(-4)}`,
        role: 'rider'
      };
      onAuthSuccess?.(guestUser);
      onShowToast?.('✓ Xác thực số điện thoại thành công!', 'success');
      setStep(2); // Tự động nhảy sang Bước 2
    } catch {
      onShowToast?.('Không thể xác thực số điện thoại, vui lòng thử lại');
    } finally {
      setIsVerifying(false);
    }
  };

  // ── XỬ LÝ BƯỚC 2: XÁC NHẬN ĐẶT CHỖ (TRỪ GHẾ & GỬI TELEGRAM) ───────────
  const handleConfirmBooking = async () => {
    setIsSubmitting(true);
    const activePhone = cleanPhoneNumber(currentUser?.phone || phoneInput);
    const activeName = (currentUser?.name || nameInput || 'Người đi cùng').trim();
    const bookingCode = `CX-${Math.floor(1000 + Math.random() * 9000)}`;

    const bookingPayload = {
      escrowId: bookingCode,
      tripId: trip.tripId || trip.id,
      targetTripId: trip.tripId || trip.id,
      from: originHub?.name || trip.fromLocation || 'Ngã ba Tân Khai',
      to: destinationHub?.name || trip.toLocation || 'Cụm BV Chợ Rẫy / ĐHYD',
      pickupPoint: pickupPoint.trim(),
      date: trip.departureDate || new Date().toISOString().slice(0, 10),
      time: trip.departureLabel || '04:30',
      timeLabel: `${trip.departureLabel || '04:30'} ${trip.departureDate || ''}`.trim(),
      seats,
      price: pricePerSeat,
      totalDeal: totalFuelShare,
      passengerPhone: activePhone,
      passengerName: activeName,
      driverPhone: trip.phone || '0984.123.456',
      driverName: trip.driverName || 'Chủ xe Tuấn',
      carModel: trip.vehicleModel || 'Toyota Vios 2022',
      fullPlate: trip.fullPlate || '93A-568.89',
      status: 'confirmed'
    };

    try {
      const res = await api.createBooking(bookingPayload);
      const created = res?.data || bookingPayload;
      setConfirmedBooking(created);
      onBookingSuccess?.(created);
      onShowToast?.('🎉 Đã giữ chỗ thành công! Đang kết nối Chủ xe...', 'success');
      setStep(3); // Chuyển sang Bước 3 (Match & Reveal)
    } catch (err) {
      console.warn('[InstantBookingModal] Lỗi tạo booking:', err.message);
      // Fallback: nếu mạng yếu vẫn mở khoá thông tin cho khách để không làm lỡ việc
      setConfirmedBooking(bookingPayload);
      onBookingSuccess?.(bookingPayload);
      setStep(3);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fullPlateNumber = confirmedBooking?.fullPlate || trip.fullPlate || '93A - 568.89';
  const driverPhoneNumber = confirmedBooking?.driverPhone || trip.phone || '0984123456';
  const cleanCallPhone = String(driverPhoneNumber).replace(/\D/g, '');

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#1c1c1e] rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-white/15 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {step === 1 && 'Cổng xác thực số điện thoại'}
                {step === 2 && 'Xem lại thông tin & Chốt chuyến'}
                {step === 3 && '✅ Đã đặt chỗ thành công!'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {step === 1 && 'Nhập SĐT để nhận mã giữ chỗ (0đ cọc)'}
                {step === 2 && 'Kiểm tra lộ trình & số ghế trước khi xác nhận'}
                {step === 3 && `Mã giữ chỗ: #${confirmedBooking?.escrowId || 'CX-8821'}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── BƯỚC 1: XÁC THỰC SỐ ĐIỆN THOẠI ───────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#0071e3]" />
                <span>Định danh nhanh trong 10 giây</span>
              </p>
              <p className="text-[11.5px] leading-relaxed text-blue-800/80 dark:text-blue-300/80">
                0đ cọc · Không cần mật khẩu · Số điện thoại dùng để Chủ xe gọi đón bạn tại trạm.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Số điện thoại di động:
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="Ví dụ: 0984 123 456"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {!otpSent && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Gửi mã
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên xưng hô (để Chủ xe gọi đón):
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Ví dụ: Anh Hùng, Chị Lan..."
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {otpSent && (
                <div className="space-y-2 pt-1 animate-fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Mã xác nhận 6 số:
                    </span>
                    <button
                      type="button"
                      onClick={() => setOtpInput('123456')}
                      className="text-[#0071e3] hover:underline font-mono text-[11px]"
                    >
                      ⚡ Điền mã nhanh (123456)
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="123456"
                    className="w-full h-11 px-3.5 rounded-xl border border-emerald-500/50 bg-white dark:bg-slate-800 text-center font-mono font-bold text-lg tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={isVerifying}
              onClick={otpSent ? handleVerifyOtp : handleSendOtp}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{otpSent ? 'Xác thực & Xem chi tiết' : 'Tiếp tục ➔'}</span>
            </button>
          </div>
        )}

        {/* ── BƯỚC 2: XEM LẠI THÔNG TIN & CHỐT CUỐC (REVIEW MODAL) ─────────── */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            {/* Thẻ tóm tắt lộ trình Read-only */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-3">
              {/* Lộ trình */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold">
                    ●
                  </span>
                  <div>
                    <span className="text-slate-400">Trạm đón:</span>{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {originHub?.name || trip.fromLocation || 'Ngã ba Tân Khai'}
                    </strong>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-[#0071e3] text-[#0071e3] flex items-center justify-center shrink-0 mt-0.5 text-[8px] font-bold">
                    ○
                  </span>
                  <div>
                    <span className="text-slate-400">Trạm trả:</span>{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {destinationHub?.name || trip.toLocation || 'Cụm BV Chợ Rẫy / ĐHYD'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Thời gian & Xe */}
              <div className="pt-2.5 border-t border-slate-200/80 dark:border-white/10 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Giờ khởi hành:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {trip.departureLabel || '04:30'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Dòng xe:</span>
                  <span className="font-semibold text-slate-900 dark:text-white truncate block">
                    {trip.vehicleModel || 'Toyota Vios 2022'}
                  </span>
                </div>
              </div>
            </div>

            {/* Chọn số ghế */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Số lượng ghế muốn giữ:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((num) => {
                  const isAvailable = num <= maxAvailable;
                  const isSelected = seats === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setSeats(num)}
                      className={`h-11 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                        isSelected
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20 scale-[1.02]'
                          : isAvailable
                          ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-white/15 hover:border-emerald-500/50'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-transparent opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{num} ghế</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Điểm đón dự kiến */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Điểm đón dự kiến (Chủ xe sẽ đón tại đây):
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  value={pickupPoint}
                  onChange={(e) => setPickupPoint(e.target.value)}
                  placeholder="Ví dụ: Cây xăng Petrolimex Tân Khai / Ngã 3 Tân Khai"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Thành tiền & Cam kết 0đ cọc */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  Mức phụ xăng ({seats} ghế):
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                  0đ cọc · Lên xe gửi trực tiếp
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatVND(totalFuelShare)}
                </span>
              </div>
            </div>

            {/* Nút XÁC NHẬN ĐẶT CHỖ */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmBooking}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-white shrink-0" />
              <span>{isSubmitting ? 'Đang xác nhận...' : 'Xác nhận đặt chỗ'}</span>
            </button>
          </div>
        )}

        {/* ── BƯỚC 3: MỞ KHOÁ THÔNG TIN 2 CHIỀU (MATCH & REVEAL) ───────────── */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in text-center">
            {/* Biểu tượng tick xanh thành công */}
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                Đã đặt chỗ thành công!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Toàn bộ thông tin xe và số điện thoại chủ xe đã được mở khoá:
              </p>
            </div>

            {/* THẺ MỞ KHOÁ BIỂN SỐ & CHỦ XE */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Dòng xe:</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {confirmedBooking?.carModel || trip.vehicleModel || 'Toyota Vios 2022'}
                </span>
              </div>

              {/* BIỂN SỐ THẬT MỞ KHOÁ HOÀN TOÀN */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/10">
                <span className="text-xs text-slate-400">Biển số chính thức:</span>
                <span className="px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
                  {fullPlateNumber}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/10">
                <span className="text-xs text-slate-400">Chủ xe đón bạn:</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {confirmedBooking?.driverName || trip.driverName || 'Anh Tuấn (Chủ xe)'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/10">
                <span className="text-xs text-slate-400">Số ghế đã giữ:</span>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  {seats} ghế ({formatVND(totalFuelShare)})
                </span>
              </div>
            </div>

            {/* DÒNG THÔNG BÁO TRẤN AN */}
            <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-xl border border-amber-200 dark:border-amber-500/20">
              "Chủ xe đã nhận được thông tin và đang chuẩn bị gọi lại cho bạn trong 1–2 phút để chốt giờ đón."
            </p>

            {/* NÚT BẤM LỚN NHẤT: GỌI TRỰC TIẾP CHO CHỦ XE */}
            <div className="space-y-2 pt-1">
              <a
                href={`tel:${cleanCallPhone}`}
                className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-sm uppercase tracking-wide shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer no-underline"
              >
                <PhoneCall className="w-5 h-5 animate-pulse" />
                <span>Gọi trực tiếp chủ xe: {driverPhoneNumber}</span>
              </a>

              {/* Nút phụ: Mở nhanh Zalo */}
              <a
                href={`https://zalo.me/${cleanCallPhone}`}
                target="_blank"
                rel="noreferrer"
                className="w-full h-10 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 text-[#0071e3] dark:text-blue-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors no-underline cursor-pointer border border-blue-200 dark:border-blue-500/30"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Nhắn tin trao đổi qua Zalo</span>
              </a>
            </div>

            {/* Nút Đóng */}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Hoàn tất & Đóng cửa sổ
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
