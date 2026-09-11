import React, { useState, useEffect, useMemo } from 'react';
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
  Factory,
  Plane,
  RotateCcw,
  X,
  Printer,
  Smartphone
} from 'lucide-react';
import QRCodeLib from 'qrcode';
import {
  VIRTUAL_HUBS,
  CORRIDOR_FIXED_SEGMENTS,
  formatVND,
  findNearestVirtualHub,
  getDailyFuelPrice,
  getFixedSegmentTariff
} from '@carmate/shared';

export default function CorridorMetroBoard({
  currentUser = null,
  onOpenCockpit,
  onOpenStationView,
  onOpenIntentModal,
  _onOpenInbox,
  _activeBookedCount = 0
}) {
  const currentFuelPrice = getDailyFuelPrice();

  // Tự động nhận diện vai trò người dùng (Chủ xe vs Người đi cùng) theo Stanford Ergonomics (Tải nhận thức = 0)
  const detectedRoleInfo = useMemo(() => {
    // 1. Kiểm tra xe trong hồ sơ currentUser
    if (currentUser?.vehicle?.plate || currentUser?.vehicle?.brand || currentUser?.vehicle?.model) {
      const detail = currentUser.vehicle.plate || `${currentUser.vehicle.brand || ''} ${currentUser.vehicle.model || ''}`.trim();
      return { role: 'driver', label: 'Chủ xe', detail };
    }
    if (currentUser?.role === 'driver') {
      return { role: 'driver', label: 'Chủ xe', detail: 'Chủ xe chính chủ' };
    }
    if (currentUser?.role === 'passenger' || currentUser?.role === 'rider') {
      return { role: 'passenger', label: 'Người đi cùng', detail: 'Hành khách' };
    }

    // 2. Kiểm tra bộ nhớ cục bộ (LocalStorage)
    if (typeof localStorage !== 'undefined') {
      try {
        // Đã từng cấu hình xe trên Cockpit Taplo
        const cockpitVehRaw = localStorage.getItem('carmate_cockpit_vehicle');
        if (cockpitVehRaw) {
          const v = JSON.parse(cockpitVehRaw);
          if (v?.plate || v?.model) {
            return { role: 'driver', label: 'Chủ xe', detail: v.plate || v.model };
          }
        }

        // Persona Memory của CarMate
        const personaRaw = localStorage.getItem('carmate_persona_memory_v1');
        if (personaRaw) {
          const mem = JSON.parse(personaRaw);
          if (mem?.driver?.carProfile?.carPlate || mem?.driver?.carProfile?.carType) {
            return {
              role: 'driver',
              label: 'Chủ xe',
              detail: mem.driver.carProfile.carPlate || mem.driver.carProfile.carType
            };
          }
        }

        // Vai trò đã dùng gần nhất
        const lastRole = localStorage.getItem('carmate_last_movement_role');
        if (lastRole === 'driver') {
          return { role: 'driver', label: 'Chủ xe', detail: 'Lịch lái gần nhất' };
        }
        if (lastRole === 'passenger') {
          return { role: 'passenger', label: 'Người đi cùng', detail: 'Lịch đặt gần nhất' };
        }

        if (localStorage.getItem('carmate_driver_registered_phone')) {
          return { role: 'driver', label: 'Chủ xe', detail: 'Đã có xe' };
        }
      } catch {}
    }

    return { role: 'passenger', label: 'Người đi cùng', detail: '' };
  }, [currentUser]);

  const [roleOverride, setRoleOverride] = useState(null);
  const activeRole = roleOverride || detectedRoleInfo.role;

  const toggleRole = (e) => {
    e.stopPropagation();
    const nextRole = activeRole === 'driver' ? 'passenger' : 'driver';
    setRoleOverride(nextRole);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('carmate_last_movement_role', nextRole);
      } catch {}
    }
  };

  // Hướng di chuyển: 'TO_SAIGON' (Bình Phước ➔ TP.HCM) | 'TO_BINH_PHUOC' (TP.HCM ➔ Bình Phước)
  const [direction, setDirection] = useState('TO_SAIGON');

  // Trí tuệ bản địa: Tự động phát hiện vị trí GPS để chọn sẵn Chiều Về nếu đang ở TP.HCM
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Vĩ độ < 10.9 nằm ở khu vực TP.HCM / Thủ Đức / Bình Thạnh
          if (pos.coords.latitude < 10.9) {
            setDirection('TO_BINH_PHUOC');
          }
        },
        () => {},
        { timeout: 3000 }
      );
    }
  }, []);

  // Quản lý Modal hiển thị mã QR trạm để in dán hoặc quét thử bằng điện thoại
  const [selectedQrHub, setSelectedQrHub] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  useEffect(() => {
    if (!selectedQrHub) {
      setQrCodeDataUrl('');
      return;
    }
    const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://carmate.vn';
    const targetUrl = `${originUrl}/tram?hub=${selectedQrHub.id}`;
    QRCodeLib.toDataURL(targetUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#020617',
        light: '#ffffff'
      }
    }).then(setQrCodeDataUrl).catch(() => {});
  }, [selectedQrHub]);

  // Danh sách các trạm dọc QL13 (tính cước và xếp thứ tự động theo hướng di chuyển 2 chiều)
  const ql13Hubs = useMemo(() => {
    const rawHubs = [
      { id: 'hub_ql13_budop', name: 'TT. Bù Đốp (Cổng Chợ Bù Đốp / ĐT759)', shortName: 'Bù Đốp', landmark: 'Chợ Bù Đốp - ĐT759 (Vùng gom nối chuyến ra Lộc Ninh)', isHot: false, category: 'FEEDER_THIN' },
      { id: 'hub_ql13_cho_loc_ninh', name: 'TT. Lộc Ninh (Chợ Lộc Ninh / Cây xăng 17)', shortName: 'Lộc Ninh', landmark: 'Mặt tiền QL13 (Khu phố Ninh Thịnh / Cây xăng 17)', isHot: true, category: 'JUNCTION' },
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
      { id: 'hub_ql13_hang_xanh', name: 'Ngã tư Hàng Xanh (Bình Thạnh - TP.HCM)', shortName: 'Hàng Xanh', landmark: 'Cây xăng Comeco Hàng Xanh / Vòng xoay Điện Biên Phủ', category: 'JUNCTION' },
      { id: 'hub_ql13_san_bay_tsn', name: 'Sân bay Tân Sơn Nhất (Ga T1 / T2 - Tân Bình)', shortName: 'Sân bay TSN', landmark: 'Cột 12 Ga Quốc Nội / Quốc Tế - Phạm Văn Đồng', category: 'AIRPORT' }
    ];

    if (direction === 'TO_SAIGON') {
      // ⬇️ CHIỀU ĐI: BÌNH PHƯỚC ➔ TP.HCM (Hàng Xanh & Sân bay TSN là ga cuối)
      return rawHubs.map((hub) => {
        const isTerm = hub.id === 'hub_ql13_hang_xanh' || hub.id === 'hub_ql13_san_bay_tsn';
        if (isTerm) {
          return { ...hub, isTerminal: true, priceToTarget: 0, targetLabel: 'Đích đến TP.HCM' };
        }
        const tariff = getFixedSegmentTariff(hub.id, 'hub_ql13_hang_xanh');
        return {
          ...hub,
          isTerminal: false,
          priceToTarget: tariff.pricePerSeat,
          targetLabel: 'Về Hàng Xanh',
          driverPayout2Seats: tariff.driverPayoutFor2Seats,
          distanceKm: tariff.distanceKm
        };
      });
    } else {
      // ⬆️ CHIỀU VỀ: TP.HCM ➔ BÌNH PHƯỚC (Đảo chiều Nam ra Bắc; Bình Long là ga cuối)
      const reversed = [...rawHubs].reverse();
      return reversed.map((hub) => {
        const isTerm = hub.id === 'hub_ql13_binh_long';
        if (isTerm) {
          return { ...hub, isTerminal: true, priceToTarget: 0, targetLabel: 'Đích đến Bình Phước' };
        }
        if (hub.id === 'hub_ql13_budop' || hub.id === 'hub_ql13_cho_loc_ninh') {
          const tariffFromSG = getFixedSegmentTariff('hub_ql13_hang_xanh', hub.id);
          return {
            ...hub,
            isTerminal: false,
            priceToTarget: tariffFromSG.pricePerSeat,
            targetLabel: 'Từ Hàng Xanh',
            driverPayout2Seats: tariffFromSG.driverPayoutFor2Seats,
            distanceKm: tariffFromSG.distanceKm
          };
        }
        const tariff = getFixedSegmentTariff(hub.id, 'hub_ql13_binh_long');
        return {
          ...hub,
          isTerminal: false,
          priceToTarget: tariff.pricePerSeat,
          targetLabel: 'Về Bình Long',
          driverPayout2Seats: tariff.driverPayoutFor2Seats,
          distanceKm: tariff.distanceKm
        };
      });
    }
  }, [direction]);

  // Tự động định vị GPS để vào ngay điểm đón gần nhất theo hướng đã chọn
  const handleAutoDetectAndOpenRiderView = () => {
    const defaultHub = direction === 'TO_SAIGON' ? 'hub_ql13_binh_long' : 'hub_ql13_hang_xanh';
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nearest = findNearestVirtualHub(pos.coords.latitude, pos.coords.longitude, 'Tuyến QL13');
          if (nearest && !nearest.isTerminal && ql13Hubs.some((h) => h.id === nearest.id && !h.isTerminal)) {
            onOpenStationView?.(nearest.id);
            return;
          }
          onOpenStationView?.(defaultHub);
        },
        () => {
          onOpenStationView?.(defaultHub);
        },
        { timeout: 3000 }
      );
    } else {
      onOpenStationView?.(defaultHub);
    }
  };

  // Helper hiển thị Huy hiệu phân loại điểm dừng đỗ
  const renderCategoryBadge = (category) => {
    switch (category) {
      case 'FEEDER_THIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
            <Radio className="w-3 h-3 text-amber-400" />
            <span>VÙNG GOM</span>
          </span>
        );
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
      case 'AIRPORT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/30">
            <Plane className="w-3 h-3 text-indigo-400" />
            <span>SÂN BAY</span>
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
      {/* ── BỘ CHỌN CHIỀU TUYẾN 1-CHẠM (STANFORD ERGONOMICS: TWO-WAY COMMUTING) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-200/70 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-300/60 dark:border-white/[0.08]">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/80 dark:bg-black/40 rounded-2xl border border-black/[0.05] dark:border-white/[0.06] flex-1">
          <button
            type="button"
            onClick={() => setDirection('TO_SAIGON')}
            className={`py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              direction === 'TO_SAIGON'
                ? 'bg-[#0071e3] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>🚗 ⬇️ Bình Phước ➔ Sài Gòn</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 font-mono hidden sm:inline">Chiều Đi</span>
          </button>
          <button
            type="button"
            onClick={() => setDirection('TO_BINH_PHUOC')}
            className={`py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              direction === 'TO_BINH_PHUOC'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>🚗 ⬆️ Sài Gòn ➔ Bình Phước</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 font-mono hidden sm:inline">Chiều Về</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDirection((prev) => (prev === 'TO_SAIGON' ? 'TO_BINH_PHUOC' : 'TO_SAIGON'))}
          className="px-4 py-2.5 rounded-2xl bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.12] text-xs font-bold font-mono text-slate-700 dark:text-slate-200 border border-black/[0.05] dark:border-white/[0.08] flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
          <span>⇄ Đổi chiều tuyến</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. HERO BANNER: TUYẾN XE TIỆN CHUYẾN QUỐC LỘ 13                            */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0d1322] to-slate-950 text-white p-6 sm:p-10 border border-white/[0.08] shadow-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#0071e3]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>
              {direction === 'TO_SAIGON'
                ? 'TUYẾN XE TIỆN CHUYẾN QL13 · BÌNH PHƯỚC ➔ TP.HCM (CHIỀU ĐI)'
                : 'TUYẾN XE TIỆN CHUYẾN QL13 · TP.HCM ➔ BÌNH PHƯỚC (CHIỀU VỀ)'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white font-display">
            Tuyến Xe Tiện Chuyến QL13 <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-emerald-400 via-sky-400 to-[#0071e3] bg-clip-text text-transparent">
              {direction === 'TO_SAIGON'
                ? 'Đi Chung Tiện Tuyến — Đón Trả Tại Các Điểm Trọng Điểm QL13'
                : 'Chiều Về Thuận Đường — Đón Tại Sân Bay, Hàng Xanh Về Bình Phước'}
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-sans">
            {direction === 'TO_SAIGON'
              ? 'Không cần đăng bài hay tìm chuyến. Tuyến Quốc lộ 13 chạy thẳng về Sài Gòn là trục đường quen thuộc bao năm nay. Chủ xe tiện đường chỉ cần bật Taplo là tự động kết nối người đi cùng phía trước. Người đi cùng chỉ cần chọn điểm đón gần mình nhất (Trung tâm hành chính, Vincom Plaza, KCN hoặc Cây xăng Petrolimex mặt tiền đường lớn) là xe ghé đón an toàn với mã 4 số.'
              : 'Chiều về tan sở, công tác hoặc vừa đáp chuyến bay xuống Tân Sơn Nhất. Đón xe tiện chuyến của các Chủ xe gia đình đang trên đường về lại Bình Dương, Bình Phước. Điểm hẹn đón rõ ràng tại Sân bay, Hàng Xanh, Bình Triệu, Vạn Phúc, Ngã 4 Bình Phước, không lo đón hụt.'}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5 bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/40 text-emerald-300 font-bold shadow-xs">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              Rẻ hơn Limousine 30% – 50% · Nhanh hơn 45 – 60 phút
            </span>
            <span className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-xl border border-white/[0.08]">
              <Fuel className="w-3.5 h-3.5 text-emerald-400" />
              Xăng RON 95: {formatVND(currentFuelPrice.ron95Price)}/L
            </span>
            <span className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-xl border border-white/[0.08]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Không chạy rùa gom khách · Đi thẳng QL13
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
                Chế Độ Taplo Tự Động (Dành Cho Chủ XE)
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                Lên xe nổ máy, bật nhận khách và gắn điện thoại lên giá đỡ. Hệ thống tự động thông báo bằng giọng nói tiếng Việt khi có người đi cùng đang chờ ở các điểm đón phía trước (TTHC, Vincom, Cây xăng...).
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

          <div>
            <button
              type="button"
              onClick={onOpenCockpit}
              className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_30px_rgba(16,185,129,0.3)] cursor-pointer transition-all"
            >
              <Radio className="w-5 h-5 animate-pulse" />
              <span>BẬT TAPLO NHẬN KHÁCH TIỆN ĐƯỜNG</span>
            </button>
          </div>
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
                {direction === 'TO_SAIGON'
                  ? 'Đón Xe Dọc Quốc Lộ 13 Về Sài Gòn'
                  : 'Đón Xe Từ TP.HCM Về Bình Dương & Bình Phước'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                {direction === 'TO_SAIGON'
                  ? 'Tuyến QL13 chạy thẳng về Sài Gòn là trục đường quen thuộc bao năm nay. Hệ thống tự động nhận diện trạm gần bạn nhất (TTHC Huyện, Vincom, KCN hoặc Cây xăng mặt tiền QL13) để nhận mã 4 số đón xe tiện đường sau vài phút.'
                  : 'Chiều về tan sở, công tác hoặc vừa đáp chuyến bay xuống Tân Sơn Nhất. Đón xe tiện chuyến tại Sân bay, Cây xăng Hàng Xanh, Cầu Bình Triệu, Vạn Phúc City, Ngã 4 Bình Phước đi Bàu Bàng, Chơn Thành, Tân Khai, Bình Long.'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500 dark:text-slate-400">
                  {direction === 'TO_SAIGON' ? 'Phụ xăng Bình Long / Tân Khai ➔ TP.HCM:' : 'Phụ xăng TP.HCM ➔ Tân Khai / Bình Long:'}
                </span>
                <span className="text-[#0071e3] font-bold">150k — 190k / người (Tiết kiệm hơn Limo 30–50%)</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500 dark:text-slate-400">Thời gian di chuyển:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Nhanh hơn 45–60p · Đi thẳng QL13</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500 dark:text-slate-400">Đón xe an toàn:</span>
                <span className="text-slate-900 dark:text-white font-bold">Lên đúng biển số xe, đọc mã 4 số</span>
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={handleAutoDetectAndOpenRiderView}
              className="w-full h-14 rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.99] text-white font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(0,113,227,0.3)] cursor-pointer transition-all"
            >
              <MapPin className="w-5 h-5 text-emerald-300" />
              <span>
                {direction === 'TO_SAIGON'
                  ? 'ĐÓN XE VỀ SÀI GÒN (CHỌN TRẠM GẦN BẠN NHẤT)'
                  : 'ĐÓN XE VỀ BÌNH PHƯỚC (CHỌN TRẠM GẦN BẠN NHẤT)'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2.1 BĂNG ĐIỀU HÀNH LÊN LỊCH CHUYẾN MAI (UNIFIED AUTO-DETECT ADVANCE BAR)   */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-700/70 p-5 sm:p-7 shadow-xl backdrop-blur-xl transition-all">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-[#0071e3]/15 via-emerald-500/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Vùng Thông Tin & Tự Động Nhận Diện Danh Xưng */}
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 text-xs font-mono font-bold uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                LÊN LỊCH CHUYẾN MAI (0 GÕ FORM)
              </span>

              {/* Chip Tự Động Nhận Diện Vai Trò & Nút 1-Chạm Đổi */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] border border-white/15 text-xs font-medium text-slate-300">
                {activeRole === 'driver' ? (
                  <>
                    <Car className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      Tự nhận diện: <strong className="text-emerald-400 font-bold">Chủ xe</strong>
                      {detectedRoleInfo.detail ? ` (${detectedRoleInfo.detail})` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5 text-[#2997ff]" />
                    <span>
                      Tự nhận diện: <strong className="text-[#2997ff] font-bold">Người đi cùng</strong>
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={toggleRole}
                  title="Bấm để đổi vai trò sang Chủ xe hoặc Người đi cùng"
                  className="ml-1 text-slate-400 hover:text-white underline decoration-dotted text-[11px] cursor-pointer transition-colors"
                >
                  (Đổi ⇄)
                </button>
              </div>
            </div>

            <h3 className="text-lg sm:text-xl font-black text-white tracking-wide">
              {activeRole === 'driver'
                ? 'Lên Lịch Xe Đi Sáng / Chiều Mai — Tự Động Gom Khách Cùng Tuyến QL13'
                : 'Hẹn Giờ Đón Xe Sáng Mai — Thuật Toán Ghép Xe Cố Định & Giữ Chỗ Sớm'}
            </h3>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {activeRole === 'driver'
                ? 'Định sẵn khung giờ xuất bến sáng mai. Hệ thống tự động ghép người đi cùng đang chờ tại các trạm đón dọc QL13 vào lộ trình xe của bạn.'
                : 'Chọn trạm và khung giờ cần đón xe ngày mai. Hệ thống tự động ghép vào xe trống tiện đường đi ngang qua trạm của bạn, có mã PIN và vé điện tử xuất sớm.'}
            </p>
          </div>

          {/* NÚT DUY NHẤT TOÀN MÀN HÌNH CHO LÊN LỊCH CHUYẾN MAI */}
          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end justify-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => onOpenIntentModal?.(activeRole)}
              className={`h-13 sm:h-14 px-6 sm:px-8 rounded-2xl font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl active:scale-[0.99] cursor-pointer transition-all ${
                activeRole === 'driver'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/25'
                  : 'bg-gradient-to-r from-[#0071e3] to-blue-600 hover:from-[#0077ed] hover:to-blue-500 text-white shadow-[#0071e3]/30'
              }`}
            >
              <Clock className="w-5 h-5 animate-pulse" />
              <span>
                {activeRole === 'driver'
                  ? 'LÊN LỊCH CHỦ XE (CHUYẾN MAI)'
                  : 'HẸN GIỜ ĐẶT CHỖ (CHUYẾN MAI)'}
              </span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>
            <span className="text-[11px] text-slate-400 text-center md:text-right font-mono">
              Khớp lệnh 2 chiều · 0 gõ form rườm rà
            </span>
          </div>
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
              {direction === 'TO_SAIGON'
                ? 'Giá Cố Định Tuyến Đi (Về Sài Gòn) · Rẻ Hơn Limousine 30% – 50% · Nhanh Hơn 45–60 Phút'
                : 'Giá Cố Định Tuyến Về (Về Bình Phước) · Rẻ Hơn Limousine 30% – 50% · Nhanh Hơn 45–60 Phút'}
            </h2>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-bold border border-emerald-200 dark:border-emerald-800">
            Cam kết 0% tăng giá cao điểm
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {direction === 'TO_SAIGON' ? (
            <>
              {/* PHÂN ĐOẠN 1: BÌNH LONG -> HÀNG XANH */}
              <div className="p-5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~115 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rẻ hơn Limo 35%</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Bình Long ➔ Hàng Xanh</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-[#0071e3]">180.000đ</span>
                    <span className="text-xs text-slate-400">/ người</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span>Đã gồm vé cầu đường</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">0đ phụ phí</span>
                </div>
              </div>

              {/* PHÂN ĐOẠN 2: TÂN KHAI -> HÀNG XANH */}
              <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-500/40 space-y-3 relative">
                <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 font-black text-[10px] uppercase font-mono">
                  HOT NHẤT
                </span>
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~95 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rẻ hơn Limo 40%</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Tân Khai ➔ Hàng Xanh</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">150.000đ</span>
                    <span className="text-xs text-slate-400">/ người</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <span>Đã gồm vé cầu đường</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">0đ phụ phí</span>
                </div>
              </div>

              {/* PHÂN ĐOẠN 3: CHƠN THÀNH -> HÀNG XANH */}
              <div className="p-5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~75 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rẻ hơn Limo 45%</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Chơn Thành ➔ Hàng Xanh</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-[#0071e3]">120.000đ</span>
                    <span className="text-xs text-slate-400">/ người</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span>Đã gồm vé cầu đường</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">0đ phụ phí</span>
                </div>
              </div>

              {/* PHÂN ĐOẠN 4: BÌNH LONG -> CHƠN THÀNH */}
              <div className="p-5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~40 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rẻ hơn Taxi 50%</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Bình Long ➔ Chơn Thành</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-[#0071e3]">75.000đ</span>
                    <span className="text-xs text-slate-400">/ người</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span>Chặng ngắn nội tỉnh</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">0đ phụ phí</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* CHIỀU VỀ 1: HÀNG XANH -> BÌNH LONG */}
              <div className="p-5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~115 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rẻ hơn Limo 35%</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Hàng Xanh ➔ Bình Long</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-[#0071e3]">180.000đ</span>
                    <span className="text-xs text-slate-400">/ người</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span>Đã gồm vé cầu đường</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">0đ phụ phí</span>
                </div>
              </div>

              {/* CHIỀU VỀ 2: HÀNG XANH -> TÂN KHAI */}
              <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-500/40 space-y-3 relative">
                <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 font-black text-[10px] uppercase font-mono">
                  HOT NHẤT
                </span>
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~95 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rẻ hơn Limo 40%</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Hàng Xanh ➔ Tân Khai</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">150.000đ</span>
                    <span className="text-xs text-slate-400">/ người</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <span>Đã gồm vé cầu đường</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">0đ phụ phí</span>
                </div>
              </div>

              {/* CHIỀU VỀ 3: HÀNG XANH -> CHƠN THÀNH */}
              <div className="p-5 rounded-2xl bg-[#f5f5f7] dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~75 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rẻ hơn Limo 45%</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Hàng Xanh ➔ Chơn Thành</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-[#0071e3]">120.000đ</span>
                    <span className="text-xs text-slate-400">/ người</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span>Đã gồm vé cầu đường</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">0đ phụ phí</span>
                </div>
              </div>

              {/* CHIỀU VỀ 4: SÂN BAY TSN -> BÌNH LONG */}
              <div className="p-5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border-2 border-purple-500/40 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~120 km</span>
                  <span className="text-purple-600 dark:text-purple-400 font-bold">Rẻ hơn Limo 35%</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Sân bay TSN ➔ Bình Long</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">190.000đ</span>
                    <span className="text-xs text-slate-400">/ người</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-purple-200 dark:border-purple-800 flex items-center justify-between">
                  <span>Đã gồm vé cổng sân bay</span>
                  <span className="text-purple-600 dark:text-purple-400 font-bold">0đ phụ phí</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* GIẢI THÍCH GIÁ TRỊ CỐT LÕI: VÌ SAO VỪA RẺ HƠN 30-50%, VỪA NHANH HƠN 45-60 PHÚT */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-emerald-50/80 dark:from-slate-800/80 dark:via-slate-850 dark:to-emerald-950/30 border border-blue-200/70 dark:border-slate-700/80 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#0071e3] dark:text-blue-400">
            <Zap className="w-4 h-4 text-emerald-500" />
            <span>HIỆU QUẢ VƯỢT TRỘI: TẠI SAO CARMATE VỪA RẺ HƠN 30%–50%, VỪA NHANH HƠN 45–60 PHÚT?</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-4 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-800 space-y-1.5 shadow-xs">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="text-base">💰</span> Rẻ hơn Limousine 30% – 50%
              </div>
              <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Mô hình chia sẻ chi phí lăn bánh thực tế (xăng + BOT) giữa chủ xe và người đi cùng, triệt tiêu 100% chi phí nuôi bến bãi, tổng đài và hoa hồng trung gian taxi truyền thống.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-800 space-y-1.5 shadow-xs">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="text-base">⚡</span> Nhanh hơn 45 – 60 phút
              </div>
              <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Không chạy rùa lòng vòng đón khách trong ngõ hẻm như xe khách / limousine. Xe đi thẳng trục Quốc lộ 13 tốc độ tối ưu, chỉ tấp lề 60 giây tại điểm đón quy chuẩn để đón khách.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-800 space-y-1.5 shadow-xs">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="text-base">🚗</span> 100% Xe gia đình sạch sẽ
              </div>
              <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
                100% ô tô gia đình 4-7 chỗ sạch sẽ, mát mẻ, không nhồi nhét hành khách. Chủ xe tiện đường đúng giờ hẹn, văn minh lịch sự và cam kết không huỷ chuyến giờ chót.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SƠ ĐỒ ĐIỂM ĐÓN CÂY XĂNG DỌC TUYẾN QL13                                   */}
      {/* ========================================================================= */}
      <section className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-white/[0.08] shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold uppercase">
              <Fuel className="w-4 h-4" />
              <span>
                {direction === 'TO_SAIGON'
                  ? 'DANH SÁCH ĐIỂM ĐÓN TRỌNG ĐIỂM & CÂY XĂNG DỌC QL13 (VỀ SÀI GÒN)'
                  : 'DANH SÁCH ĐIỂM ĐÓN TRỌNG ĐIỂM & CÂY XĂNG DỌC QL13 (VỀ BÌNH PHƯỚC)'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              {direction === 'TO_SAIGON'
                ? 'Các Điểm Đón Trung Tâm Hành Chính, TTTM & Cây Xăng Dọc QL13'
                : 'Đón Xe Chiều Về Từ Sân Bay, Hàng Xanh & Cửa Ngõ TP.HCM'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {direction === 'TO_SAIGON'
                ? 'Trục độc đạo từ Bình Long về Sài Gòn — TTHC Huyện, Vincom Plaza, KCN Becamex & Cây xăng Petrolimex đón xe văn minh'
                : 'Đón xe tiện chuyến chiều về từ TP.HCM đi Bàu Bàng, Chơn Thành, Hớn Quản (Tân Khai), Bình Long'}
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
                hub.isTerminal
                  ? 'bg-gradient-to-r from-sky-950/30 via-white/[0.03] to-white/[0.02] border-sky-500/30'
                  : hub.isHot
                    ? 'bg-gradient-to-r from-emerald-950/40 via-white/[0.03] to-white/[0.02] border-emerald-500/40 hover:border-emerald-400'
                    : 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                      hub.isTerminal
                        ? 'bg-[#0071e3] text-white shadow-[0_0_15px_rgba(0,113,227,0.4)]'
                        : hub.isHot
                          ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                          : 'bg-white/[0.1] text-slate-300'
                    }`}
                  >
                    {hub.isTerminal ? '🏁' : index + 1}
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
                    {hub.isTerminal && (
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold border border-sky-500/40">
                        {direction === 'TO_SAIGON' ? 'ĐÍCH ĐẾN TP.HCM (GA CUỐI)' : 'ĐÍCH ĐẾN BÌNH PHƯỚC (GA CUỐI)'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{hub.landmark}</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                {hub.isTerminal ? (
                  <div className="flex items-center gap-2">
                    <span className="px-3.5 py-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono text-xs font-bold flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-sky-400" />
                      <span>{direction === 'TO_SAIGON' ? 'ĐIỂM TRẢ KHÁCH (GA CUỐI)' : 'ĐIỂM TRẢ BÌNH LONG (GA CUỐI)'}</span>
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono text-slate-400 block">
                        {hub.targetLabel ? `${hub.targetLabel}:` : 'Phụ xăng:'}
                      </span>
                      <span className="text-sm sm:text-base font-black font-mono text-emerald-400">
                        {formatVND(hub.priceToTarget)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedQrHub(hub)}
                      title="Xem mã QR để quét trên điện thoại hoặc in dán tại trạm"
                      className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-slate-300 hover:text-white transition-all cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-mono"
                    >
                      <QrCode className="w-4 h-4 text-emerald-400" />
                      <span className="hidden sm:inline">Mã QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenIntentModal?.('passenger', hub.id)}
                      title="Hẹn giờ đón xe trước cho ngày mai"
                      className="px-3 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-[#2997ff] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Hẹn trước</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenStationView?.(hub.id)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                    >
                      <span>ĐÓN XE</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
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

      {/* ========================================================================= */}
      {/* MODAL MÃ QR TRẠM ẢO (MÔ PHỎNG TEM DÁN CỘT XĂNG ĐỂ QUÉT BẰNG ĐIỆN THOẠI)     */}
      {/* ========================================================================= */}
      {selectedQrHub && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-white/[0.15] rounded-3xl p-6 w-full max-w-sm space-y-4 text-white shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedQrHub(null)}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                CARMATE • TEM STICKER TRẠM ẢO
              </span>
              <h3 className="text-base font-bold text-white leading-tight">
                {selectedQrHub.name}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {selectedQrHub.landmark}
              </p>
            </div>

            {/* Khung mã QR mica mô phỏng thực địa ngoài cây xăng */}
            <div className="p-4 bg-white rounded-2xl shadow-inner flex flex-col items-center justify-center space-y-2">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt={`Mã QR ${selectedQrHub.name}`}
                  className="w-52 h-52 object-contain"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-slate-400 font-mono text-xs">
                  Đang tạo mã QR...
                </div>
              )}
              <div className="text-center pt-1 border-t border-slate-200 w-full">
                <span className="text-[11px] font-black tracking-wider text-slate-900 uppercase block font-sans">
                  QUÉT ĐÓN XE TIỆN CHUYẾN QL13
                </span>
                <span className="text-[10px] text-slate-600 font-mono">
                  10s vào hàng đợi · 0đ tải ứng dụng
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const hubToOpen = selectedQrHub.id;
                  setSelectedQrHub(null);
                  onOpenStationView?.(hubToOpen);
                }}
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                <Smartphone className="w-4 h-4" />
                <span>Trải nghiệm Kiosk Đón Xe Ngay ➔</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="w-full h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-xs font-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In tem dán cột xăng / quầy thu ngân</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
