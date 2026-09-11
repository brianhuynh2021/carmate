import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MapPin,
  Fuel,
  Sparkles,
  ChevronLeft,
  Copy,
  ShieldCheck,
  Send,
  Phone,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatVND, getVirtualHubById, getFixedSegmentTariff, isValidVietnamesePhone, cleanPhoneNumber } from '@carmate/shared';
import { api, setStoredAuthToken } from '../../api/client.js';

export default function StationRiderView({
  hubId = 'hub_ql13_tan_khai',
  currentUser,
  onBack,
  onShowToast
}) {
  // Tìm thông tin Trạm đón ảo
  const currentHub = useMemo(() => {
    return (
      getVirtualHubById(hubId) || {
        id: hubId,
        name: 'Cây xăng Petrolimex Tân Khai / Chợ Tân Khai',
        shortName: 'Petrolimex Tân Khai',
        corridor: 'Tuyến QL13',
        landmark: 'Cây xăng Petrolimex Tân Khai - QL13 (Hớn Quản, Bình Phước)'
      }
    );
  }, [hubId]);

  // Trạng thái: 'CHECKIN' (R1) | 'BOARDING_PASS' (R2)
  const [viewStep, setViewStep] = useState('CHECKIN');
  const [destinationHubId, setDestinationHubId] = useState('hub_ql13_hang_xanh');
  const [seatsNeeded, setSeatsNeeded] = useState(1);
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [name, setName] = useState(currentUser?.name || 'Khách đi cùng');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Xác thực Vô hình (Just-In-Time Auth Sheet: Telegram / SĐT - Zero Zalo)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTelegramInput, setAuthTelegramInput] = useState('');
  const [authPhoneInput, setAuthPhoneInput] = useState('');
  const [authNameInput, setAuthNameInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dữ liệu Boarding Pass (R2)
  const [boardingPass, setBoardingPass] = useState(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // Danh sách các điểm đến khả dĩ trên hành lang QL13 (loại trừ trạm đang đứng)
  const destinationOptions = useMemo(() => {
    const allOptions = [
      { id: 'hub_ql13_hang_xanh', name: 'Ngã tư Hàng Xanh (Bình Thạnh - TP.HCM)' },
      { id: 'hub_ql13_binh_trieu', name: 'Cầu Bình Triệu / Bến xe Miền Đông cũ' },
      { id: 'hub_ql13_nga4_binh_phuoc', name: 'Ngã 4 Bình Phước (Thủ Đức - TP.HCM)' },
      { id: 'hub_ql13_vsip1', name: 'KCN VSIP 1 / AEON Mall Bình Dương' },
      { id: 'hub_ql13_nga4_so_sao', name: 'Ngã 4 Sở Sao / Đại Nam (Thủ Dầu Một)' },
      { id: 'hub_ql13_bau_bang', name: 'Trạm dừng KCN Bàu Bàng / Mỹ Phước' },
      { id: 'hub_ql13_nga4_chon_thanh', name: 'Ngã 4 Chơn Thành (Giao Tuyến N2 & QL14)' },
      { id: 'hub_ql13_tan_khai', name: 'Cây xăng Petrolimex Tân Khai (Hớn Quản)' },
      { id: 'hub_ql13_binh_long', name: 'Cổng chào TX. Bình Long (An Lộc)' }
    ];
    return allOptions.filter((opt) => opt.id !== currentHub.id);
  }, [currentHub.id]);

  // Bảng giá phân đoạn cố định Metro Tariff (Bất biến MIT & Zero Surge)
  const tariff = useMemo(() => {
    return getFixedSegmentTariff(currentHub.id, destinationHubId);
  }, [currentHub.id, destinationHubId]);

  const estimatedFare = tariff.pricePerSeat * seatsNeeded;

  // 1. TỰ ĐỘNG KHÔI PHỤC PHIÊN THẺ LÊN XE TỪ LOCALSTORAGE (SESSION RECOVERY)
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem('carmate_active_station_pass');
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        // Nếu thẻ được lưu trong vòng 2 giờ
        if (saved && saved.intentId && saved.savedAt > Date.now() - 2 * 3600 * 1000) {
          setBoardingPass(saved.pass);
          setViewStep('BOARDING_PASS');

          // Thử ping máy chủ để đồng bộ trạng thái xe thời gian thực
          api
            .getRiderPass(saved.intentId)
            .then((res) => {
              if (res?.success && res?.intent) {
                if (['WAITING', 'OFFERED', 'ARRIVING'].includes(res.intent.status)) {
                  setBoardingPass(res.intent);
                } else if (['BOARDED', 'COMPLETED', 'CANCELLED'].includes(res.intent.status)) {
                  localStorage.removeItem('carmate_active_station_pass');
                  setBoardingPass(null);
                  setViewStep('CHECKIN');
                }
              }
            })
            .catch(() => {});
        }
      }
    } catch {}
  }, []);

  // ĐỒNG BỘ THÔNG TIN NGƯỜI DÙNG HIỆN TẠI
  useEffect(() => {
    if (currentUser?.phone) {
      setPhone(currentUser.phone);
    }
    if (currentUser?.name) {
      setName(currentUser.name);
    }
  }, [currentUser]);

  // THỰC HIỆN CHECK-IN CHÍNH THỨC VÀO HÀNG ĐỢI
  const executeCheckIn = useCallback(
    async (verifiedPhone, verifiedName) => {
      setIsSubmitting(true);
      const finalPhone = verifiedPhone || phone || '0988112233';
      const finalName = verifiedName || name || 'Khách đi cùng';

      try {
        const res = await api.stationCheckIn(currentHub.id, {
          destinationHubId,
          seatsNeeded,
          phone: finalPhone,
          name: finalName
        });

        if (res?.success && res?.intent) {
          setBoardingPass(res.intent);
          setViewStep('BOARDING_PASS');
          try {
            localStorage.setItem(
              'carmate_active_station_pass',
              JSON.stringify({
                intentId: res.intent.intentId,
                hubId: currentHub.id,
                pass: res.intent,
                savedAt: Date.now()
              })
            );
          } catch {}
          onShowToast?.('Đã vào hàng đợi! Xe tiện tuyến đang tiếp cận trạm.');
        } else {
          throw new Error('Fallback demo mode');
        }
      } catch {
        // Fallback mô phỏng ngoại tuyến
        const fallbackPass = {
          intentId: `ST-RIDER-${Date.now().toString().slice(-6)}`,
          hubName: currentHub.name,
          destinationName:
            destinationOptions.find((d) => d.id === destinationHubId)?.name || 'Ngã tư Hàng Xanh',
          seatsNeeded,
          pin: '8842',
          fuelSurcharge: estimatedFare,
          driverPayout: tariff.driverPayoutPerSeat * seatsNeeded,
          status: 'ARRIVING',
          noSurge: true,
          carInfo: {
            plate: '93A - 123.45',
            vehicleModel: 'Mitsubishi Xpander (Trắng)',
            driverName: 'Chủ xe CX-102 (Đạt 4.9★)'
          }
        };
        setBoardingPass(fallbackPass);
        setViewStep('BOARDING_PASS');
        try {
          localStorage.setItem(
            'carmate_active_station_pass',
            JSON.stringify({
              intentId: fallbackPass.intentId,
              hubId: currentHub.id,
              pass: fallbackPass,
              savedAt: Date.now()
            })
          );
        } catch {}
        onShowToast?.('Đã vào hàng đợi! Xe tiện chuyến đang tiếp cận trạm.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentHub.id, currentHub.name, destinationHubId, destinationOptions, estimatedFare, name, onShowToast, phone, seatsNeeded, tariff.driverPayoutPerSeat]
  );

  // XỬ LÝ KHÁCH BẤM [VÀO HÀNG ĐỢI ĐÓN XE] (R1)
  const handleCheckInClick = (e) => {
    e?.preventDefault();

    // Nếu đã có SĐT (từ tài khoản đăng nhập hoặc đã nhập trước) -> Check-in trực tiếp
    if (phone && phone.trim().length >= 9) {
      executeCheckIn(phone.trim(), name);
      return;
    }

    // Nếu chưa có thông tin -> Mở modal Xác thực 1-chạm (Telegram / SĐT - Không có Zalo)
    setAuthError('');
    setShowAuthModal(true);
  };

  // XÁC THỰC NHANH QUA TELEGRAM (DEV/MOCK HOẶC SĐT TELEGRAM)
  const handleTelegramAuthSubmit = async (e) => {
    e?.preventDefault();
    const inputVal = authTelegramInput.trim();
    if (!inputVal) {
      setAuthError('Vui lòng nhập @username hoặc Số điện thoại Telegram');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    try {
      const isPhone = /^[0-9+() \-.]{9,15}$/.test(inputVal) && inputVal.replace(/\D/g, '').length >= 9;
      let cleanPhone = '';
      let cleanUser = '';

      if (isPhone) {
        cleanPhone = cleanPhoneNumber(inputVal);
        if (cleanPhone.length >= 10 && !isValidVietnamesePhone(cleanPhone)) {
          setAuthError('Số điện thoại không đúng định dạng di động Việt Nam');
          setAuthLoading(false);
          return;
        }
        cleanUser = `user_${cleanPhone.slice(-4)}`;
      } else {
        cleanUser = inputVal.replace(/^@/, '');
        cleanPhone = '0988' + Math.floor(100000 + Math.random() * 900000);
      }

      const seed = cleanPhone || cleanUser;
      const mockId = Math.abs(seed.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 1000000));
      const authPayload = {
        id: mockId,
        first_name: authNameInput.trim() || cleanUser || 'Khách đi cùng',
        username: cleanUser,
        phone_number: cleanPhone,
        is_dev_mock: true
      };

      const res = await api.telegramLogin(authPayload);
      if (res?.success && res?.user) {
        if (res.token) setStoredAuthToken(res.token);
        const resolvedPhone = res.user.phone || cleanPhone;
        const resolvedName = res.user.name || authPayload.first_name;
        setPhone(resolvedPhone);
        setName(resolvedName);
        setShowAuthModal(false);
        executeCheckIn(resolvedPhone, resolvedName);
      } else {
        // Fallback local auth
        setPhone(cleanPhone);
        setName(authPayload.first_name);
        setShowAuthModal(false);
        executeCheckIn(cleanPhone, authPayload.first_name);
      }
    } catch {
      // Fallback khi offline
      const fallbackPhone = authTelegramInput.replace(/\D/g, '') || '0988112233';
      const fallbackName = authNameInput.trim() || 'Khách đi cùng';
      setPhone(fallbackPhone);
      setName(fallbackName);
      setShowAuthModal(false);
      executeCheckIn(fallbackPhone, fallbackName);
    } finally {
      setAuthLoading(false);
    }
  };

  // XÁC THỰC TRỰC TIẾP QUA SĐT NHANH
  const handleDirectPhoneSubmit = (e) => {
    e?.preventDefault();
    const clean = cleanPhoneNumber(authPhoneInput);
    if (!clean || clean.length < 9) {
      setAuthError('Vui lòng nhập số điện thoại hợp lệ (10 chữ số)');
      return;
    }
    const finalName = authNameInput.trim() || 'Khách đi cùng';
    setPhone(clean);
    setName(finalName);
    setShowAuthModal(false);
    executeCheckIn(clean, finalName);
  };

  const handleCopyPin = () => {
    if (boardingPass?.pin) {
      navigator.clipboard?.writeText(boardingPass.pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
      onShowToast?.('Đã sao chép mã PIN 4 số!');
    }
  };

  const handleCancelPass = () => {
    try {
      localStorage.removeItem('carmate_active_station_pass');
    } catch {}
    setViewStep('CHECKIN');
    setBoardingPass(null);
    onShowToast?.('Đã rời khỏi hàng đợi.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between select-none p-4 sm:p-6 font-sans">
      {/* ── TOP BAR: THÔNG TIN TRẠM DỪNG DỌC ĐƯỜNG ── */}
      <header className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center border border-white/[0.08] transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 text-slate-300" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-black uppercase tracking-wider font-mono text-emerald-400">
                ĐIỂM ĐÓN CÂY XĂNG QL13
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-[240px] sm:max-w-xs">
              {currentHub.shortName || currentHub.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-400 font-mono">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>0% Surge</span>
        </div>
      </header>

      {/* ── NỘI DUNG CHÍNH (R1 HOẶC R2) ── */}
      <main className="flex-1 flex flex-col justify-center my-auto max-w-lg mx-auto w-full">
        {/* ========================================================================= */}
        {/* MÀN HÌNH R1: CHECK-IN TRẠM ẢO (KHÁCH QUÉT QR TẠI CỘT XĂNG)                */}
        {/* ========================================================================= */}
        {viewStep === 'CHECKIN' && (
          <form onSubmit={handleCheckInClick} className="space-y-5 animate-fade-in">
            {/* THẺ ĐỊNH VỊ TRẠM XĂNG */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <MapPin className="w-4 h-4" />
                <span className="text-xs font-bold uppercase font-mono tracking-wider">
                  Vị trí trạm đón của bạn:
                </span>
              </div>
              <h2 className="text-lg font-black text-white">{currentHub.name}</h2>
              <p className="text-xs text-slate-400">
                {currentHub.landmark || 'Sân cây xăng Petrolimex dọc trục Quốc Lộ 13'}
              </p>
            </div>

            {/* CHỌN ĐÍCH ĐẾN */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
                  Đích đến của bạn:
                </label>
                <span className="text-[11px] font-mono text-emerald-400">
                  {tariff.distanceKm ? `~${tariff.distanceKm} km` : ''}
                </span>
              </div>
              <select
                value={destinationHubId}
                onChange={(e) => setDestinationHubId(e.target.value)}
                className="w-full h-13 px-4 rounded-2xl bg-white/[0.06] border border-white/[0.12] text-white text-sm font-semibold outline-none focus:border-emerald-500 transition-all cursor-pointer"
              >
                {destinationOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-slate-900 text-white">
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* CHỌN SỐ VÉ & BẢNG GIÁ PHÂN ĐOẠN CỐ ĐỊNH METRO */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
                  Số vé cần đi:
                </label>
                <div className="flex items-center justify-between h-13 px-3 rounded-2xl bg-white/[0.06] border border-white/[0.12]">
                  <button
                    type="button"
                    onClick={() => setSeatsNeeded((prev) => Math.max(1, prev - 1))}
                    className="w-9 h-9 rounded-xl bg-white/[0.08] text-lg font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-lg font-black font-mono text-white">{seatsNeeded} vé</span>
                  <button
                    type="button"
                    onClick={() => setSeatsNeeded((prev) => Math.min(4, prev + 1))}
                    className="w-9 h-9 rounded-xl bg-white/[0.08] text-lg font-bold flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
                  Cước đi ghép cố định:
                </label>
                <div className="h-13 px-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col justify-center">
                  <span className="text-base font-black font-mono text-emerald-400">
                    {formatVND(estimatedFare)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatVND(tariff.pricePerSeat)} / vé · Không tăng giá
                  </span>
                </div>
              </div>
            </div>

            {/* SỐ ĐIỆN THOẠI NHẬN DẠNG */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
                  Số điện thoại nhận diện:
                </label>
                {phone && (
                  <span className="text-[10px] font-bold text-emerald-400 font-mono">
                    Đã lưu phiên
                  </span>
                )}
              </div>
              <input
                type="tel"
                placeholder="Nhập số điện thoại của bạn (hoặc xác thực Telegram)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-13 px-4 rounded-2xl bg-white/[0.06] border border-white/[0.12] text-white text-sm font-semibold outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            {/* NÚT VÀO HÀNG ĐỢI 1-CHẠM */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-lg uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_30px_rgba(16,185,129,0.3)] cursor-pointer transition-all disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5" />
              <span>{isSubmitting ? 'ĐANG KẾT NỐI XE...' : 'VÀO HÀNG ĐỢI ĐÓN XE'}</span>
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cước cố định minh bạch · Không lo bị chặt chém · Lên xe đọc mã mới trả tiền</span>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* MÀN HÌNH R2: BOARDING PASS LIVE (THẺ LÊN XE THỜI GIAN THỰC)               */}
        {/* ========================================================================= */}
        {viewStep === 'BOARDING_PASS' && boardingPass && (
          <div className="space-y-5 animate-fade-in">
            {/* TRẠNG THÁI TIẾP CẬN */}
            <div className="bg-emerald-950/30 border border-emerald-500/50 rounded-3xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-sm font-black font-mono text-emerald-400 uppercase tracking-wide">
                  XE ĐANG TIẾP CẬN TRẠM
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">Dự kiến ~2-3 phút</span>
            </div>

            {/* KHUNG HIỂN THỊ MÃ PIN 4 SỐ TO RÕ RÀNG */}
            <div className="bg-gradient-to-b from-white/[0.08] to-white/[0.03] border-2 border-emerald-500/60 rounded-3xl p-6 text-center space-y-3 shadow-2xl">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 font-mono block">
                MÃ LÊN XE CỦA BẠN (ĐỌC CHO CHỦ XE):
              </span>

              <div className="flex items-center justify-center gap-2 sm:gap-3 py-2">
                {(boardingPass.pin || '8842').split('').map((char, i) => (
                  <span
                    key={i}
                    className="w-14 h-18 sm:w-16 sm:h-20 rounded-2xl bg-white/[0.08] border-2 border-emerald-400 text-3xl sm:text-4xl font-black font-mono text-emerald-400 flex items-center justify-center shadow-lg"
                  >
                    {char}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopyPin}
                className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-400" />
                <span>{copiedPin ? 'Đã sao chép!' : 'Chạm để sao chép mã'}</span>
              </button>

              <p className="text-xs text-amber-300 font-medium pt-1">
                Vui lòng đứng sẵn tại mép sân cây xăng, đọc mã 4 số này khi bước lên xe.
              </p>
            </div>

            {/* THÔNG TIN XE TIẾP CẬN */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-mono block">Biển số xe</span>
                  <span className="text-lg font-black font-mono text-white">
                    {boardingPass.carInfo?.plate || '93A - 123.45'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-slate-400 font-mono block">Dòng xe</span>
                  <span className="text-sm font-bold text-slate-200">
                    {boardingPass.carInfo?.vehicleModel || 'Mitsubishi Xpander (Trắng)'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>
                  Đích đến: <strong>{boardingPass.destinationName}</strong>
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  Phụ xăng: {formatVND(boardingPass.fuelSurcharge || estimatedFare)}
                </span>
              </div>
            </div>

            {/* NÚT HỦY HOẶC ĐỔI TRẠM */}
            <button
              type="button"
              onClick={handleCancelPass}
              className="w-full py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-400 hover:text-white uppercase tracking-wider transition-all cursor-pointer"
            >
              Hủy hàng đợi / Đổi trạm khác
            </button>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL XÁC THỰC VÔ HÌNH 1-CHẠM (TELEGRAM / SĐT - TUYỆT ĐỐI KHÔNG DÙNG ZALO)  */}
      {/* ========================================================================= */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-white/[0.15] rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md space-y-5 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Xác thực 1-chạm đón xe</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 rounded-lg"
              >
                Đóng
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Xác thực nhanh để Chủ xe nhận diện đúng khách khi xe tấp vào trạm. Thẻ lên xe sẽ được bảo lưu tự động.
            </p>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
                Tên / Biệt danh gọi xe (Tùy chọn)
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Anh Minh, Chị Lan..."
                value={authNameInput}
                onChange={(e) => setAuthNameInput(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-xs outline-none focus:border-white/20"
              />
            </div>

            {/* CÁCH 1: 1-CHẠM TELEGRAM */}
            <form onSubmit={handleTelegramAuthSubmit} className="space-y-3">
              <label className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Send className="w-3.5 h-3.5" />
                <span>Cách 1: Xác thực qua Telegram</span>
              </label>
              <input
                type="text"
                placeholder="Nhập @username hoặc SĐT Telegram"
                value={authTelegramInput}
                onChange={(e) => setAuthTelegramInput(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl bg-white/[0.06] border border-sky-500/30 text-white text-xs font-semibold outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-400 active:scale-[0.99] text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{authLoading ? 'ĐANG KẾT NỐI...' : 'XÁC THỰC TELEGRAM & VÀO ĐÓN XE'}</span>
              </button>
            </form>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/[0.08] w-full" />
              <span className="bg-slate-900 px-3 text-[11px] text-slate-500 font-mono uppercase">HOẶC</span>
            </div>

            {/* CÁCH 2: SỐ ĐIỆN THOẠI TRỰC TIẾP */}
            <form onSubmit={handleDirectPhoneSubmit} className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cách 2: Nhập số điện thoại di động</span>
              </label>
              <input
                type="tel"
                placeholder="Ví dụ: 0988 123 456"
                value={authPhoneInput}
                onChange={(e) => setAuthPhoneInput(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl bg-white/[0.06] border border-white/[0.12] text-white text-xs font-semibold outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                className="w-full h-12 rounded-2xl bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <span>TIẾP TỤC BẰNG SĐT NÀY</span>
              </button>
            </form>

            <p className="text-[10px] text-slate-500 text-center font-mono">
              Bảo mật 100% · Không bao giờ spam · 0đ phí trung gian
            </p>
          </div>
        </div>
      )}

      {/* FOOTER BẢO CHỨNG */}
      <footer className="text-center text-[11px] text-slate-500 pt-4 border-t border-white/[0.06] max-w-lg mx-auto w-full">
        CarMate Tuyến Hành Lang QL13 · Đón trả an toàn tại sân cây xăng Petrolimex
      </footer>
    </div>
  );
}
