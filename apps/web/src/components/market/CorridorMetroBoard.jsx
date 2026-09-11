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
  Radio,
  Building2,
  ShoppingBag,
  Factory
} from 'lucide-react';
import {
  VIRTUAL_HUBS,
  CORRIDOR_FIXED_SEGMENTS,
  formatVND,
  findNearestVirtualHub,
  getDailyFuelPrice,
  getFixedSegmentTariff
} from '@carmate/shared';

export default function CorridorMetroBoard({
  onOpenCockpit,
  onOpenStationView,
  _onOpenInbox,
  _activeBookedCount = 0
}) {
  const currentFuelPrice = getDailyFuelPrice();

  // Danh sách các trạm dọc QL13 (từ Bình Long về Sài Gòn), tính cước tự động theo DynamicMarketTariffEngine
  const ql13Hubs = [
    { id: 'hub_ql13_binh_long', name: 'TX. Bình Long (Vòng xoay An Lộc)', shortName: 'Bình Long', landmark: 'Cổng chào TX. Bình Long QL13', isHot: true, category: 'JUNCTION' },
    { id: 'hub_ql13_tthc_binh_long', name: 'Trung tâm Hành chính TX. Bình Long / Bến xe', shortName: 'TTHC Bình Long', landmark: 'Ngã 3 Nguyễn Huệ - QL13', isHot: false, category: 'ADMIN_CENTER' },
    { id: 'hub_ql13_tthc_tan_khai', name: 'Trung tâm Hành chính Huyện Hớn Quản (TT. Tân Khai)', shortName: 'TTHC Hớn Quản', landmark: 'Mặt tiền QL13 (Ấp 1, TT. Tân Khai) - Trụ sở Huyện ủy', isHot: true, category: 'ADMIN_CENTER' },
    { id: 'hub_ql13_tan_khai', name: 'Cây xăng Petrolimex Tân Khai / Chợ Tân Khai', shortName: 'Tân Khai', landmark: 'Cây xăng Petrolimex Tân Khai QL13', isHot: true, category: 'GAS_STATION' },
    { id: 'hub_ql13_minh_hung', name: 'KCN Minh Hưng - Hàn Quốc (Chơn Thành)', shortName: 'KCN Minh Hưng', landmark: 'Cổng KCN Minh Hưng Hàn Quốc - QL13', isHot: false, category: 'INDUSTRIAL' },
    { id: 'hub_ql13_tthc_chon_thanh', name: 'Trung tâm Hành chính TX. Chơn Thành / Quảng trường', shortName: 'TTHC Chơn Thành', landmark: 'Mặt tiền QL13 (P. Hưng Long, Chơn Thành)', isHot: true, category: 'ADMIN_CENTER' },
    { id: 'hub_ql13_vincom_chon_thanh', name: 'Vincom Plaza Chơn Thành', shortName: 'Vincom Chơn Thành', landmark: 'Số 01 QL13 (Trung tâm TX. Chơn Thành)', isHot: true, category: 'MALL' },
    { id: 'hub_ql13_nga4_chon_thanh', name: 'Ngã 4 Chơn Thành (Giao Tuyến N2 & QL14)', shortName: 'Chơn Thành', landmark: 'Bùng binh Chơn Thành - Trạm xăng Tín Nghĩa', isHot: true, category: 'JUNCTION' },
    { id: 'hub_ql13_becamex_chon_thanh', name: 'Cổng KCN & Đô thị Becamex Bình Phước', shortName: 'KCN Becamex', landmark: 'Cổng chính Becamex Bình Phước - QL13', isHot: false, category: 'INDUSTRIAL' },
    { id: 'hub_ql13_tthc_bau_bang', name: 'Trung tâm Hành chính Huyện Bàu Bàng', shortName: 'TTHC Bàu Bàng', landmark: 'Mặt tiền Đại lộ QL13 (TT. Lai Uyên, Bàu Bàng)', isHot: false, category: 'ADMIN_CENTER' },
    { id: 'hub_ql13_bau_bang', name: 'Trạm dừng KCN Bàu Bàng / Mỹ Phước', shortName: 'KCN Bàu Bàng', landmark: 'Cổng KCN Bàu Bàng QL13', isHot: false, category: 'INDUSTRIAL' },
    { id: 'hub_ql13_nga4_so_sao', name: 'Ngã 4 Sở Sao / Đại Nam (Thủ Dầu Một)', shortName: 'Sở Sao / Đại Nam', landmark: 'Ngã 4 Sở Sao QL13', isHot: false, category: 'JUNCTION' },
    { id: 'hub_ql13_vsip1', name: 'Cổng KCN VSIP 1 / TTTM AEON Mall Canary', shortName: 'VSIP 1 / AEON Mall', landmark: 'Đại lộ Bình Dương (Thuận An)', isHot: true, category: 'MALL' },
    { id: 'hub_ql13_van_phuc_city', name: 'Khu đô thị Vạn Phúc City / Cân Nhơn Hòa', shortName: 'Vạn Phúc City', landmark: 'Cổng chính Vạn Phúc City - QL13 Hiệp Bình Phước', isHot: false, category: 'URBAN_AREA' },
    { id: 'hub_ql13_nga4_binh_phuoc', name: 'Ngã 4 Bình Phước (Thủ Đức - QL1A)', shortName: 'Ngã 4 Bình Phước', landmark: 'Cây xăng Petrolimex QL13 giao QL1A', isHot: false, category: 'JUNCTION' },
    { id: 'hub_ql13_binh_trieu', name: 'Cầu Bình Triệu / BX Miền Đông cũ', shortName: 'Bình Triệu', landmark: 'Cầu Bình Triệu 1 - Đinh Bộ Lĩnh / QL13', isHot: false, category: 'GAS_STATION' },
    { id: 'hub_ql13_hang_xanh', name: 'Ngã tư Hàng Xanh (Bình Thạnh - TP.HCM)', shortName: 'Hàng Xanh (Đích)', landmark: 'Cây xăng Comeco Hàng Xanh', isTerminal: true, category: 'GAS_STATION' }
  ].map((hub) => {
    if (hub.isTerminal) return { ...hub, priceToHX: 0 };
    const tariff = getFixedSegmentTariff(hub.id, 'hub_ql13_hang_xanh');
    return {
      ...hub,
      priceToHX: tariff.pricePerSeat,
      driverPayout2Seats: tariff.driverPayoutFor2Seats,
      distanceKm: tariff.distanceKm
    };
  });

  // Tự động định vị GPS để vào ngay cây xăng gần nhất trên trục QL13
  const handleAutoDetectAndOpenRiderView = () => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nearest = findNearestVirtualHub(pos.coords.latitude, pos.coords.longitude, 'Tuyến QL13');
          if (nearest && ql13Hubs.some((h) => h.id === nearest.id)) {
            onOpenStationView?.(nearest.id);
            return;
          }
          onOpenStationView?.('hub_ql13_binh_long');
        },
        () => {
          onOpenStationView?.('hub_ql13_binh_long');
        },
        { timeout: 3000 }
      );
    } else {
      onOpenStationView?.('hub_ql13_binh_long');
    }
  };

  // Helper hiển thị Huy hiệu phân loại điểm dừng đỗ
  const renderCategoryBadge = (category) => {
    switch (category) {
      case 'ADMIN_CENTER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold border border-purple-500/30">
            <Building2 className="w-3 h-3 text-purple-400" />
            <span>TTHC</span>
          </span>
        );
      case 'MALL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold border border-rose-500/30">
            <ShoppingBag className="w-3 h-3 text-rose-400" />
            <span>TTTM</span>
          </span>
        );
      case 'INDUSTRIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
            <Factory className="w-3 h-3 text-amber-400" />
            <span>KCN</span>
          </span>
        );
      case 'URBAN_AREA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold border border-cyan-500/30">
            <Building2 className="w-3 h-3 text-cyan-400" />
            <span>ĐÔ THỊ</span>
          </span>
        );
      case 'GAS_STATION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30">
            <Fuel className="w-3 h-3 text-emerald-400" />
            <span>CÂY XĂNG</span>
          </span>
        );
      case 'JUNCTION':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold border border-sky-500/30">
            <MapPin className="w-3 h-3 text-sky-400" />
            <span>NÚT GIAO</span>
          </span>
        );
    }
  };

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
            Không cần đăng bài hay tìm chuyến. Tuyến Quốc lộ 13 chạy thẳng về Sài Gòn là trục đường quen thuộc bao năm nay. <strong>Chủ xe</strong> tiện đường chỉ cần bật Taplo là tự động kết nối người đi cùng phía trước. <strong>Người đi cùng</strong> chỉ cần đứng tại cây xăng Petrolimex quen thuộc dọc QL13 là xe ghé đón an toàn với mã 4 số.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5 bg-emerald-500/15 px-3 py-1.5 rounded-xl border border-emerald-500/30 text-emerald-300 font-bold">
              <Fuel className="w-3.5 h-3.5 text-emerald-400" />
              Chỉ số xăng RON 95: {formatVND(currentFuelPrice.ron95Price)}/L · Đủ xăng + 4 trạm BOT
            </span>
            <span className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-xl border border-white/[0.08]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Định giá công bằng hai bên · 0% chặt chém
            </span>
            <span className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-xl border border-white/[0.08]">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              Bảo mật SĐT · Lên xe đọc mã 4 số
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
                <span className="text-emerald-400 font-bold">+270.000đ — +324.000đ</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-400">Điểm hẹn đón khách:</span>
                <span className="text-white font-bold">TTHC, TTTM & Cây xăng dọc QL13</span>
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
                Đón Xe Dọc Quốc Lộ 13 Về Sài Gòn
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Tuyến QL13 chạy thẳng về Sài Gòn là trục đường quen thuộc bao năm nay. Hệ thống tự động nhận diện cây xăng Petrolimex bạn đang đứng (hoặc quét mã QR tại cột xăng) để nhận mã 4 số đón xe tiện đường sau vài phút.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500 dark:text-slate-400">Cước Bình Long / Tân Khai ➔ Hàng Xanh:</span>
                <span className="text-[#0071e3] font-bold">180k / 150k (Đã gồm BOT)</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500 dark:text-slate-400">Đón xe an toàn:</span>
                <span className="text-slate-900 dark:text-white font-bold">Lên đúng biển số xe, đọc mã 4 số</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAutoDetectAndOpenRiderView}
            className="w-full h-15 rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.99] text-white font-black text-base uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(0,113,227,0.3)] cursor-pointer transition-all"
          >
            <Fuel className="w-5 h-5 text-emerald-300" />
            <span>ĐÓN XE VỀ SÀI GÒN (TẠI CÂY XĂNG GẦN NHẤT)</span>
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
              BẢNG GIÁ ĐI GHÉP CÔNG BẰNG QUỐC LỘ 13
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              Định Giá Cân Bằng Thị Trường · Bù Đắp Đủ Xăng + Cầu Đường BOT
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
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rẻ hơn Limo 28%</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Bình Long ➔ Hàng Xanh</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black font-mono text-[#0071e3]">180.000đ</span>
                <span className="text-xs text-slate-400">/ vé</span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
              Chủ xe nhận: <strong>324.000đ</strong> (cho 2 ghế, bù đủ 297k xăng + BOT)
            </div>
          </div>

          {/* PHÂN ĐOẠN 2: TÂN KHAI -> HÀNG XANH */}
          <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-500/40 space-y-3 relative">
            <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 font-black text-[10px] uppercase font-mono">
              HOT NHẤT
            </span>
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Cự ly ~95 km</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rẻ hơn Limo 32%</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Tân Khai ➔ Hàng Xanh</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">150.000đ</span>
                <span className="text-xs text-slate-400">/ vé</span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-emerald-200 dark:border-emerald-800">
              Chủ xe nhận: <strong>270.000đ</strong> (cho 2 ghế, bù đủ 253k xăng + BOT)
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
                <span className="text-2xl font-black font-mono text-[#0071e3]">120.000đ</span>
                <span className="text-xs text-slate-400">/ vé</span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
              Chủ xe nhận: <strong>216.000đ</strong> (cho 2 ghế, bù đủ 198k xăng + BOT)
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
                <span className="text-2xl font-black font-mono text-[#0071e3]">75.000đ</span>
                <span className="text-xs text-slate-400">/ vé</span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
              Chủ xe nhận: <strong>135.000đ</strong> (cho 2 ghế)
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
              <span>DANH SÁCH ĐIỂM ĐÓN TRỌNG ĐIỂM & CÂY XĂNG DỌC QL13</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              Các Điểm Đón Trung Tâm Hành Chính, TTTM & Cây Xăng Dọc QL13
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Trục độc đạo từ Bình Long về Sài Gòn — TTHC Huyện, Vincom Plaza, KCN Becamex & Cây xăng Petrolimex đón xe văn minh
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      {hub.name}
                    </h3>
                    {renderCategoryBadge(hub.category)}
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
                  <span>ĐÓN XE TẠI ĐÂY</span>
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
