import React, { useState } from 'react';
import {
  MapPin,
  Fuel,
  Sparkles,
  ChevronLeft,
  Copy
} from 'lucide-react';
import { formatVND, getVirtualHubById } from '@carmate/shared';
import { api } from '../../api/client.js';

export default function StationRiderView({
  hubId = 'hub_ql13_tan_khai',
  currentUser,
  onBack,
  onShowToast
}) {
  // Tìm thông tin Trạm đón ảo
  const currentHub = getVirtualHubById(hubId) || {
    id: hubId,
    name: 'Cây xăng Petrolimex Tân Khai / Chợ Tân Khai',
    shortName: 'Petrolimex Tân Khai',
    corridor: 'Tuyến QL13',
    landmark: 'Cây xăng Petrolimex Tân Khai - QL13 (Hớn Quản, Bình Phước)'
  };

  // Trạng thái: 'CHECKIN' (R1) | 'BOARDING_PASS' (R2)
  const [viewStep, setViewStep] = useState('CHECKIN');
  const [destinationHubId, setDestinationHubId] = useState('hub_ql13_hang_xanh');
  const [seatsNeeded, setSeatsNeeded] = useState(1);
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [name] = useState(currentUser?.name || 'Khách đi cùng');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dữ liệu Boarding Pass (R2)
  const [boardingPass, setBoardingPass] = useState(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // Danh sách các điểm đến khả dĩ trên hành lang
  const destinationOptions = [
    { id: 'hub_ql13_hang_xanh', name: 'Ngã tư Hàng Xanh (Bình Thạnh - TP.HCM)' },
    { id: 'hub_ql13_binh_trieu', name: 'Cầu Bình Triệu / Bến xe Miền Đông cũ' },
    { id: 'hub_ql13_nga4_binh_phuoc', name: 'Ngã 4 Bình Phước (Thủ Đức - TP.HCM)' },
    { id: 'hub_ql13_aeon_mall', name: 'Aeon Mall Canary / KCN VSIP 1 (Bình Dương)' },
    { id: 'hub_ql13_nga4_so_sao', name: 'Ngã 4 Sở Sao / Đại Nam (Thủ Dầu Một)' }
  ];

  const estimatedFare = 120000 * seatsNeeded;

  // XỬ LÝ KHÁCH BẤM [VÀO HÀNG ĐỢI ĐÓN XE] (R1 -> R2)
  const handleCheckIn = async (e) => {
    e?.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await api.fetchJson(`/station/${currentHub.id}/checkin`, {
        method: 'POST',
        body: JSON.stringify({
          destinationHubId,
          seatsNeeded,
          phone,
          name
        })
      });

      if (res?.success && res?.intent) {
        setBoardingPass(res.intent);
        setViewStep('BOARDING_PASS');
        onShowToast?.('Đã vào hàng đợi đón xe! Hệ thống đang quét xe tiện chuyến trên QL13.');
      } else {
        throw new Error('Fallback demo mode');
      }
    } catch {
      // Fallback local simulation
      const fallbackPass = {
        intentId: `ST-RIDER-${Date.now().toString().slice(-6)}`,
        hubName: currentHub.name,
        destinationName: destinationOptions.find((d) => d.id === destinationHubId)?.name || 'Ngã tư Hàng Xanh',
        seatsNeeded,
        pin: '8842',
        fuelSurcharge: estimatedFare,
        status: 'ARRIVING',
        carInfo: {
          plate: '93A - 123.45',
          vehicleModel: 'Mitsubishi Xpander (Trắng)',
          driverName: 'Chủ xe CX-102 (Đạt 4.9★)'
        }
      };
      setBoardingPass(fallbackPass);
      setViewStep('BOARDING_PASS');
      onShowToast?.('Đã vào hàng đợi! Xe tiện chuyến đang tiếp cận trạm.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPin = () => {
    if (boardingPass?.pin) {
      navigator.clipboard?.writeText(boardingPass.pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
      onShowToast?.('Đã sao chép mã PIN 4 số!');
    }
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
                TRẠM ĐÓN ẢO DỌC TUYẾN
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-[240px] sm:max-w-xs">
              {currentHub.shortName || currentHub.name}
            </h1>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-400 font-mono">
          0đ phí sàn
        </span>
      </header>

      {/* ── NỘI DUNG CHÍNH (R1 HOẶC R2) ── */}
      <main className="flex-1 flex flex-col justify-center my-auto max-w-lg mx-auto w-full">
        {/* ========================================================================= */}
        {/* MÀN HÌNH R1: CHECK-IN TRẠM ẢO (KHÁCH QUÉT QR TẠI CỘT XĂNG)                */}
        {/* ========================================================================= */}
        {viewStep === 'CHECKIN' && (
          <form onSubmit={handleCheckIn} className="space-y-5 animate-fade-in">
            {/* THẺ ĐỊNH VỊ TRẠM XĂNG */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <MapPin className="w-4 h-4" />
                <span className="text-xs font-bold uppercase font-mono tracking-wider">
                  Vị trí check-in của bạn:
                </span>
              </div>
              <h2 className="text-lg font-black text-white">
                {currentHub.name}
              </h2>
              <p className="text-xs text-slate-400">
                {currentHub.landmark || 'Sân cây xăng dọc trục Quốc Lộ 13'}
              </p>
            </div>

            {/* CHỌN ĐÍCH ĐẾN */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
                Đích đến của bạn:
              </label>
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

            {/* CHỌN SỐ VÉ & DỰ TÍNH PHỤ XĂNG */}
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
                  Phụ xăng chia sẻ:
                </label>
                <div className="h-13 px-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col justify-center">
                  <span className="text-base font-black font-mono text-emerald-400">
                    {formatVND(estimatedFare)}
                  </span>
                  <span className="text-[10px] text-slate-400">~120.000đ / người</span>
                </div>
              </div>
            </div>

            {/* SỐ ĐIỆN THOẠI ĐỂ CHỦ XE GỌI NẾU CẦN */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
                Số điện thoại của bạn:
              </label>
              <input
                type="tel"
                placeholder="Nhập số điện thoại (10 chữ số)"
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
              <span>{isSubmitting ? 'ĐANG KẾT NỐI...' : 'VÀO HÀNG ĐỢI ĐÓN XE'}</span>
            </button>

            <p className="text-[11px] text-slate-500 text-center">
              Định vị GPS tự điền vị trí trạm · Không cần cài app qua App Store · Thanh toán thẳng khi lên xe
            </p>
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
              <span className="text-xs font-mono text-slate-400">Dự kiến ~2 phút</span>
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
                Vui lòng đứng sẵn tại mép sân cây xăng, đọc mã này khi bước lên xe.
              </p>
            </div>

            {/* THÔNG TIN XE SẮP TỚI */}
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
                <span>Điểm đến: <strong>{boardingPass.destinationName}</strong></span>
                <span className="font-mono text-emerald-400 font-bold">
                  Phụ xăng: {formatVND(boardingPass.fuelSurcharge || 120000)}
                </span>
              </div>
            </div>

            {/* NÚT QUAY LẠI HOẶC HỦY */}
            <button
              type="button"
              onClick={() => {
                setViewStep('CHECKIN');
                setBoardingPass(null);
                onShowToast?.('Đã rời khỏi hàng đợi.');
              }}
              className="w-full py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-400 hover:text-white uppercase tracking-wider transition-all cursor-pointer"
            >
              Hủy hàng đợi / Đổi trạm khác
            </button>
          </div>
        )}
      </main>

      {/* FOOTER BẢO CHỨNG */}
      <footer className="text-center text-[11px] text-slate-500 pt-4 border-t border-white/[0.06] max-w-lg mx-auto w-full">
        CarMate Tuyến Hành Lang QL13 · Đón trả an toàn tại sân cây xăng Petrolimex
      </footer>
    </div>
  );
}
