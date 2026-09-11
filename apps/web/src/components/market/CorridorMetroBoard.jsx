import React from 'react';
import {
  Car,
  Fuel,
  Send,
  Zap,
  Clock,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Compass,
  MapPin,
  CheckCircle2,
  Users,
  Sparkles,
  QrCode,
  Truck,
  Radio
} from 'lucide-react';
import { VIRTUAL_HUBS, CORRIDOR_FIXED_SEGMENTS, formatVND } from '@carmate/shared';

export default function CorridorMetroBoard({
  onOpenCockpit,
  onOpenStationView,
  _onOpenInbox,
  _activeBookedCount = 0
}) {

  // Lọc các trạm ảo thuộc hành lang Tuyến QL13 theo thứ tự địa lý từ Bắc xuống Nam
  const ql13Hubs = [
    { id: 'hub_ql13_budop', name: 'Chợ Bù Đốp (TT. Thanh Bình)', shortName: 'Bù Đốp', priceToHX: 160000, landmark: 'Cây xăng Petrolimex Thanh Bình' },
    { id: 'hub_ql13_cho_loc_ninh', name: 'Chợ Lộc Ninh / Cây xăng 17', shortName: 'Lộc Ninh', priceToHX: 150000, landmark: 'Cây xăng 17 QL13' },
    { id: 'hub_ql13_binh_long', name: 'TX. Bình Long (Vòng xoay An Lộc)', shortName: 'Bình Long', priceToHX: 130000, landmark: 'Cổng chào TX. Bình Long QL13', isHot: true },
    { id: 'hub_ql13_tan_khai', name: 'Cây xăng Petrolimex Tân Khai', shortName: 'Tân Khai', priceToHX: 110000, landmark: 'Cây xăng Petrolimex Tân Khai (Hớn Quản)', isHot: true },
    { id: 'hub_ql13_nga4_chon_thanh', name: 'Ngã 4 Chơn Thành (Giao Tuyến N2)', shortName: 'Chơn Thành', priceToHX: 90000, landmark: 'Bùng binh Chơn Thành - Trạm xăng Tín Nghĩa', isHot: true },
    { id: 'hub_ql13_bau_bang', name: 'Trạm dừng KCN Bàu Bàng', shortName: 'Bàu Bàng', priceToHX: 70000, landmark: 'Cổng KCN Bàu Bàng QL13' },
    { id: 'hub_ql13_nga4_so_sao', name: 'Ngã 4 Sở Sao / Đại Nam (Thủ Dầu Một)', shortName: 'Sở Sao / Đại Nam', priceToHX: 50000, landmark: 'Ngã 4 Sở Sao QL13' },
    { id: 'hub_ql13_vsip1', name: 'Cổng KCN VSIP 1 / AEON Mall', shortName: 'VSIP 1 / AEON Mall', priceToHX: 40000, landmark: 'Đại lộ Bình Dương' },
    { id: 'hub_ql13_nga4_binh_phuoc', name: 'Ngã 4 Bình Phước (Thủ Đức)', shortName: 'Ngã 4 Bình Phước', priceToHX: 25000, landmark: 'Cây xăng Petrolimex QL13 giao QL1A' },
    { id: 'hub_ql13_binh_trieu', name: 'Cầu Bình Triệu / BX Miền Đông cũ', shortName: 'Bình Triệu', priceToHX: 20000, landmark: 'Cầu Bình Triệu 1' },
    { id: 'hub_ql13_hang_xanh', name: 'Ngã tư Hàng Xanh (Bình Thạnh)', shortName: 'Hàng Xanh (Đích)', priceToHX: 0, landmark: 'Cây xăng Comeco Hàng Xanh', isTerminal: true }
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* ========================================================================= */}
      {/* 1. HERO BANNER: TUYẾN XE TIỆN CHUYẾN QUỐC LỘ 13                            */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0d1322] to-slate-950 text-white p-6 sm:p-10 border border-white/[0.08] shadow-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#0071e3]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>TUYẾN ĐI GHÉP XE TIỆN CHUYẾN QL13 · BÌNH PHƯỚC ⇄ TP.HCM</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white font-display">
            Tuyến Xe Tiện Chuyến QL13 <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-emerald-400 via-sky-400 to-[#0071e3] bg-clip-text text-transparent">
              Đi Chung Tiện Đường — Đón Trả Tại Cây Xăng
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-sans">
            Không cần đăng bài hay tìm chuyến. <strong>Chủ xe</strong> tiện đường chỉ cần bật Taplo là tự động kết nối người đi cùng phía trước. <strong>Người đi cùng</strong> chỉ cần chọn cây xăng Petrolimex gần nhất để nhận mã đón xe 4 số an toàn.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-xl border border-white/[0.08]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Giá cước cố định · 0% tăng giá cao điểm
            </span>
            <span className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-xl border border-white/[0.08]">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              Bảo mật SĐT · Lên xe đọc mã 4 số
            </span>
            <span className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-xl border border-white/[0.08]">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Đón trả an toàn tại sân cây xăng
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. HAI CỔNG HÀNH ĐỘNG LỚN (APPLE SQUIRCLE 2-CARD ACTION GATEWAY)           */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CỔNG 1: DÀNH CHO CHỦ XE */}
        <div className="relative overflow-hidden rounded-3xl bg-[#07080d] border-2 border-emerald-500/50 p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-[0_0_40px_rgba(16,185,129,0.15)] group hover:border-emerald-400 transition-all">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Car className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                DÀNH CHO CHỦ XE
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide">
                Chế Độ Taplo Tự Động (Dành Cho Chủ Xe)
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                Lên xe nổ máy, bật nhận khách và gắn điện thoại lên giá đỡ. Hệ thống tự động thông báo bằng giọng nói tiếng Việt khi có người đi cùng đang chờ ở trạm cây xăng phía trước.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-400">Hỗ trợ tiền xăng (2 ghế):</span>
                <span className="text-emerald-400 font-bold">+198.000đ — +234.000đ</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-400">Điểm hẹn đón khách:</span>
                <span className="text-white font-bold">Sân cây xăng Petrolimex dọc đường</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenCockpit}
            className="w-full h-15 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-base uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_30px_rgba(16,185,129,0.3)] cursor-pointer transition-all"
          >
            <Radio className="w-5 h-5 animate-pulse" />
            <span>BẬT TAPLO NHẬN KHÁCH TIỆN ĐƯỜNG</span>
          </button>
        </div>

        {/* CỔNG 2: DÀNH CHO NGƯỜI ĐI CÙNG */}
        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border-2 border-[#0071e3]/40 p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-[0_4px_24px_rgba(0,113,227,0.12)] group hover:border-[#0071e3] transition-all">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[#0071e3]/10 dark:bg-[#0071e3]/20 border border-[#0071e3]/20 flex items-center justify-center text-[#0071e3]">
                <Users className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full bg-[#0071e3]/15 text-[#0071e3] text-xs font-mono font-bold">
                DÀNH CHO NGƯỜI ĐI CÙNG
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wide">
                Đón Xe Tại Cây Xăng Petrolimex
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Đến cây xăng Petrolimex gần nhất hoặc chọn trạm trên bản đồ. Bấm nhận mã đón xe 4 số để xe tiện đường ghé đón an toàn sau vài phút.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500 dark:text-slate-400">Cước Tân Khai ➔ Hàng Xanh:</span>
                <span className="text-[#0071e3] font-bold">110.000đ (Cố định)</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500 dark:text-slate-400">Thanh toán an toàn:</span>
                <span className="text-slate-900 dark:text-white font-bold">Lên đúng xe, đọc mã mới gửi tiền</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenStationView?.('hub_ql13_tan_khai')}
            className="w-full h-15 rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.99] text-white font-black text-base uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(0,113,227,0.3)] cursor-pointer transition-all"
          >
            <Fuel className="w-5 h-5 text-emerald-300" />
            <span>CHỌN CÂY XĂNG ĐÓN XE GẦN NHẤT</span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. BẢNG CƯỚC METRO TARIFF CỐ ĐỊNH MINH BẠCH (FIXED SEGMENT PRICING TABLE)  */}
      {/* ========================================================================= */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0071e3]">
              BẢNG GIÁ ĐI GHÉP CỐ ĐỊNH QUỐC LỘ 13
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              Chi Phí Cố Định Từng Chặng · Không Tăng Giá Giờ Cao Điểm
            </h2>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-bold border border-emerald-200 dark:border-emerald-800">
            Cam kết 0% tăng giá cao điểm
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* PHÂN ĐOẠN 1: BÌNH LONG -> HÀNG XANH */}
          <div className="p-5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Cự ly ~115 km</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Tiết kiệm 50%</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Bình Long ➔ Hàng Xanh</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black font-mono text-[#0071e3]">130.000đ</span>
                <span className="text-xs text-slate-400">/ vé</span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
              Chủ xe nhận: <strong>234.000đ</strong> (cho 2 ghế)
            </div>
          </div>

          {/* PHÂN ĐOẠN 2: TÂN KHAI -> HÀNG XANH */}
          <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-500/40 space-y-3 relative">
            <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 font-black text-[10px] uppercase font-mono">
              HOT NHẤT
            </span>
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Cự ly ~95 km</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Cây xăng Petrolimex</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Tân Khai ➔ Hàng Xanh</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">110.000đ</span>
                <span className="text-xs text-slate-400">/ vé</span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-emerald-200 dark:border-emerald-800">
              Chủ xe nhận: <strong>198.000đ</strong> (cho 2 ghế)
            </div>
          </div>

          {/* PHÂN ĐOẠN 3: CHƠN THÀNH -> HÀNG XANH */}
          <div className="p-5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Cự ly ~75 km</span>
              <span className="text-slate-500 font-bold">Giao Tuyến N2</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Chơn Thành ➔ Hàng Xanh</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black font-mono text-[#0071e3]">90.000đ</span>
                <span className="text-xs text-slate-400">/ vé</span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
              Chủ xe nhận: <strong>162.000đ</strong> (cho 2 ghế)
            </div>
          </div>

          {/* PHÂN ĐOẠN 4: BÌNH LONG -> CHƠN THÀNH */}
          <div className="p-5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Cự ly ~40 km</span>
              <span className="text-slate-500 font-bold">Nội tỉnh tiện đường</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Bình Long ➔ Chơn Thành</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black font-mono text-[#0071e3]">45.000đ</span>
                <span className="text-xs text-slate-400">/ vé</span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
              Chủ xe nhận: <strong>81.000đ</strong> (cho 2 ghế)
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 4. SƠ ĐỒ ĐIỂM ĐÓN CÂY XĂNG DỌC TUYẾN QL13                                   */}
      {/* ========================================================================= */}
      <section className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-white/[0.08] shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold uppercase">
              <Fuel className="w-4 h-4" />
              <span>DANH SÁCH ĐIỂM ĐÓN AN TOÀN DỌC TUYẾN QL13</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              Hệ Thống Trạm Dừng Cây Xăng Petrolimex
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Chọn cây xăng bạn đang đứng để vào hàng đợi và nhận Thẻ đón xe trực tiếp
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Thời gian xe qua lại:</span>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
              ~3-5 phút / xe
            </span>
          </div>
        </div>

        {/* DANH SÁCH CÁC ĐIỂM ĐÓN CÂY XĂNG DỌC QUỐC LỘ 13 */}
        <div className="space-y-3">
          {ql13Hubs.map((hub, index) => (
            <div
              key={hub.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                hub.isHot
                  ? 'bg-gradient-to-r from-emerald-950/40 via-white/[0.03] to-white/[0.02] border-emerald-500/40 hover:border-emerald-400'
                  : 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                      hub.isTerminal
                        ? 'bg-[#0071e3] text-white'
                        : hub.isHot
                          ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                          : 'bg-white/[0.1] text-slate-300'
                    }`}
                  >
                    {index + 1}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      {hub.name}
                    </h3>
                    {hub.isHot && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/40">
                        TRỌNG ĐIỂM
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{hub.landmark}</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                {hub.priceToHX > 0 ? (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Về Hàng Xanh:</span>
                    <span className="text-sm sm:text-base font-black font-mono text-emerald-400">
                      {formatVND(hub.priceToHX)}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-mono text-sky-400 font-bold px-3 py-1 rounded-xl bg-sky-500/10 border border-sky-500/20">
                    Trạm Cuối (TP.HCM)
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onOpenStationView?.(hub.id)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <span>VÀO ĐÓN XE</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. ĐA DẠNG PHƯƠNG TIỆN THAM GIA TIỆN TUYẾN                                 */}
      {/* ========================================================================= */}
      <section className="bg-[#f5f5f7] dark:bg-slate-850 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
            KẾT NỐI ĐA DẠNG PHƯƠNG TIỆN
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            Mọi Xe Tiện Chuyến Đều Có Thể Tham Gia Đi Ghép
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Tận dụng ghế trống và khoang xe để cùng chia sẻ tiền xăng, mang lại mức chi phí tiết kiệm nhất cho bà con:
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <span className="text-2xl block">🚗</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white block">Xe 4-5 chỗ</span>
            <span className="text-[11px] text-slate-500">Chia sẻ 2-3 ghế sau</span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <span className="text-2xl block">🚙</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white block">Xe 7 chỗ</span>
            <span className="text-[11px] text-slate-500">Cả gia đình, cốp to</span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <span className="text-2xl block">🛻</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white block">Bán tải Pickup</span>
            <span className="text-[11px] text-slate-500">Chở người & thùng hàng</span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <span className="text-2xl block">🚚</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white block">Xe tải nhẹ</span>
            <span className="text-[11px] text-slate-500">Chở xe máy, dọn trọ</span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <span className="text-2xl block">🚕</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white block">Xe tiện chuyến</span>
            <span className="text-[11px] text-slate-500">Quay đầu rỗng khách</span>
          </div>
        </div>
      </section>
    </div>
  );
}
