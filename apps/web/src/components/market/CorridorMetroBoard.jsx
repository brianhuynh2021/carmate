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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0d1322] to-slate-950 text-white p-6 sm:p-8 border border-white/[0.08] shadow-xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#0071e3]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {direction === 'TO_SAIGON'
                ? 'Hành lang QL13 · Bình Phước ➔ Sài Gòn'
                : 'Hành lang QL13 · Sài Gòn ➔ Bình Phước'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white font-display">
            Tuyến xe tiện chuyến QL13
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
            {direction === 'TO_SAIGON'
              ? 'Kết nối trực tiếp Chủ xe và Người đi cùng dọc Quốc lộ 13. Đón trả tại cây xăng Petrolimex và điểm trung tâm.'
              : 'Đón xe chiều về thuận đường từ Tân Sơn Nhất, Hàng Xanh, Ngã 4 Bình Phước về Bàu Bàng, Chơn Thành, Tân Khai, Bình Long.'}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-300 font-mono">
            <span className="flex items-center gap-1.5 bg-white/[0.08] px-2.5 py-1 rounded-lg border border-white/[0.1]">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              Đi thẳng QL13
            </span>
            <span className="flex items-center gap-1.5 bg-white/[0.08] px-2.5 py-1 rounded-lg border border-white/[0.1]">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              Lên xe đọc mã 4 số
            </span>
            <span className="flex items-center gap-1.5 bg-white/[0.08] px-2.5 py-1 rounded-lg border border-white/[0.1] text-slate-400">
              <Fuel className="w-3.5 h-3.5 text-emerald-400" />
              RON 95: {formatVND(currentFuelPrice.ron95Price)}/L
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. HAI CỔNG HÀNH ĐỘNG LỚN (APPLE SQUIRCLE 2-CARD ACTION GATEWAY)           */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CỔNG 1: DÀNH CHO CHỦ XE */}
        <div className="relative overflow-hidden rounded-3xl bg-[#07080d] border border-emerald-500/40 p-5 sm:p-7 flex flex-col justify-between space-y-5 shadow-lg group hover:border-emerald-400 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Car className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                Dành cho Chủ xe
              </span>
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Chế độ Taplo nhận khách
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                Tự động cảnh báo giọng nói khi có người đi cùng đang chờ tại các trạm đón phía trước.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between text-xs text-slate-300">
              <span className="text-slate-400 font-mono">Bù xăng (2 ghế):</span>
              <span className="text-emerald-400 font-bold font-mono text-sm">+270k — +324k</span>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={onOpenCockpit}
              className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Bật Taplo nhận khách</span>
            </button>
          </div>
        </div>

        {/* CỔNG 2: DÀNH CHO NGƯỜI ĐI CÙNG */}
        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] p-5 sm:p-7 flex flex-col justify-between space-y-5 shadow-sm group hover:border-[#0071e3] transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-[#0071e3]/10 dark:bg-[#0071e3]/20 border border-[#0071e3]/20 flex items-center justify-center text-[#0071e3]">
                <Users className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-xs font-semibold">
                Dành cho Người đi cùng
              </span>
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {direction === 'TO_SAIGON' ? 'Đón xe về Sài Gòn' : 'Đón xe về Bình Phước'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Tự động định vị trạm đón gần bạn nhất dọc hành lang Quốc lộ 13.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span className="text-slate-500 dark:text-slate-400 font-mono">Phụ xăng tham khảo:</span>
              <span className="text-[#0071e3] font-bold font-mono text-sm">120k — 180k / ghế</span>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={handleAutoDetectAndOpenRiderView}
              className="w-full h-12 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
            >
              <MapPin className="w-4 h-4 text-emerald-300" />
              <span>Chọn trạm đón xe</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2.1 BĂNG ĐIỀU HÀNH LÊN LỊCH CHUYẾN MAI (UNIFIED AUTO-DETECT ADVANCE BAR)   */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-lg backdrop-blur-xl transition-all">
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-[#0071e3]/10 via-emerald-500/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Vùng Thông Tin & Tự Động Nhận Diện Danh Xưng */}
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 text-xs font-mono font-medium">
                <Clock className="w-3.5 h-3.5" />
                Lên lịch chuyến mai
              </span>

              {/* Chip Tự Động Nhận Diện Vai Trò & Nút 1-Chạm Đổi */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs text-slate-300">
                {activeRole === 'driver' ? (
                  <>
                    <Car className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      Vai trò: <strong className="text-emerald-400 font-semibold">Chủ xe</strong>
                      {detectedRoleInfo.detail ? ` (${detectedRoleInfo.detail})` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5 text-[#2997ff]" />
                    <span>
                      Vai trò: <strong className="text-[#2997ff] font-semibold">Người đi cùng</strong>
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={toggleRole}
                  title="Bấm để đổi vai trò sang Chủ xe hoặc Người đi cùng"
                  className="ml-1 text-slate-400 hover:text-white text-[11px] cursor-pointer transition-colors"
                >
                  (Đổi ⇄)
                </button>
              </div>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {activeRole === 'driver'
                ? 'Lên lịch xuất bến ngày mai — Tự động ghép người đi cùng'
                : 'Hẹn giờ đón xe ngày mai — Tự động giữ chỗ tiện đường'}
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              {activeRole === 'driver'
                ? 'Định sẵn khung giờ khởi hành sáng hoặc chiều mai. Hệ thống tự động ghép người đi cùng tại các trạm đón dọc QL13.'
                : 'Chọn trạm và khung giờ cần đón xe ngày mai. Hệ thống tự động ghép với xe trống tiện chuyến đi qua trạm của bạn.'}
            </p>
          </div>

          {/* Nút thao tác lên lịch */}
          <div className="flex flex-col items-stretch sm:items-end justify-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => onOpenIntentModal?.(activeRole)}
              className={`h-11 sm:h-12 px-6 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] cursor-pointer transition-all ${
                activeRole === 'driver'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                  : 'bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-[#0071e3]/25'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>
                {activeRole === 'driver' ? 'Lên lịch chuyến mai' : 'Hẹn giờ đón xe'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-slate-400 text-center sm:text-right font-mono">
              Ghép đôi tự động · Không mất phí
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. BẢNG CƯỚC METRO TARIFF CỐ ĐỊNH MINH BẠCH (FIXED SEGMENT PRICING TABLE)  */}
      {/* ========================================================================= */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0071e3]">
              BIỂU PHÍ CỐ ĐỊNH QL13
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {direction === 'TO_SAIGON'
                ? 'Biểu phí tuyến về Sài Gòn'
                : 'Biểu phí tuyến về Bình Phước'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Đã trọn gói xăng xe và vé trạm BOT · Tiết kiệm 30%–50% so với limousine
            </p>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-semibold border border-emerald-200 dark:border-emerald-800">
            0đ phụ phí cao điểm
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {direction === 'TO_SAIGON' ? (
            <>
              {/* PHÂN ĐOẠN 1: BÌNH LONG -> HÀNG XANH */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~115 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">-35% vs Limo</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bình Long ➔ Hàng Xanh</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-[#0071e3]">180.000đ</span>
                    <span className="text-xs text-slate-400">/ ghế</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                  <span>Đã gồm vé BOT</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">0đ phụ phí</span>
                </div>
              </div>

              {/* PHÂN ĐOẠN 2: TÂN KHAI -> HÀNG XANH */}
              <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-500/30 space-y-2 relative">
                <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] font-mono">
                  PHỔ BIẾN
                </span>
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~95 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">-40% vs Limo</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Tân Khai ➔ Hàng Xanh</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">150.000đ</span>
                    <span className="text-xs text-slate-400">/ ghế</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
                  <span>Đã gồm vé BOT</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">0đ phụ phí</span>
                </div>
              </div>

              {/* PHÂN ĐOẠN 3: CHƠN THÀNH -> HÀNG XANH */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~75 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">-45% vs Limo</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Chơn Thành ➔ Hàng Xanh</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-[#0071e3]">120.000đ</span>
                    <span className="text-xs text-slate-400">/ ghế</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                  <span>Đã gồm vé BOT</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">0đ phụ phí</span>
                </div>
              </div>

              {/* PHÂN ĐOẠN 4: BÌNH LONG -> CHƠN THÀNH */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~40 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">-50% vs Taxi</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bình Long ➔ Chơn Thành</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-[#0071e3]">75.000đ</span>
                    <span className="text-xs text-slate-400">/ ghế</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                  <span>Chặng nội tỉnh</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">0đ phụ phí</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* CHIỀU VỀ 1: HÀNG XANH -> BÌNH LONG */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~115 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">-35% vs Limo</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Hàng Xanh ➔ Bình Long</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-[#0071e3]">180.000đ</span>
                    <span className="text-xs text-slate-400">/ ghế</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                  <span>Đã gồm vé BOT</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">0đ phụ phí</span>
                </div>
              </div>

              {/* CHIỀU VỀ 2: HÀNG XANH -> TÂN KHAI */}
              <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-500/30 space-y-2 relative">
                <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] font-mono">
                  PHỔ BIẾN
                </span>
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~95 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">-40% vs Limo</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Hàng Xanh ➔ Tân Khai</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">150.000đ</span>
                    <span className="text-xs text-slate-400">/ ghế</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
                  <span>Đã gồm vé BOT</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">0đ phụ phí</span>
                </div>
              </div>

              {/* CHIỀU VỀ 3: HÀNG XANH -> CHƠN THÀNH */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~75 km</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">-45% vs Limo</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Hàng Xanh ➔ Chơn Thành</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-[#0071e3]">120.000đ</span>
                    <span className="text-xs text-slate-400">/ ghế</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                  <span>Đã gồm vé BOT</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">0đ phụ phí</span>
                </div>
              </div>

              {/* CHIỀU VỀ 4: SÂN BAY TSN -> BÌNH LONG */}
              <div className="p-4 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Cự ly ~120 km</span>
                  <span className="text-purple-600 dark:text-purple-400 font-medium">-35% vs Limo</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Sân bay TSN ➔ Bình Long</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">190.000đ</span>
                    <span className="text-xs text-slate-400">/ ghế</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-purple-200 dark:border-purple-800/50 flex items-center justify-between">
                  <span>Đã gồm vé sân bay</span>
                  <span className="text-purple-600 dark:text-purple-400 font-medium">0đ phụ phí</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 3 GIÁ TRỊ CỐT LÕI: APPLE TRUST STRIP (TẢI NHẬN THỨC = 0) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#0071e3] dark:text-blue-400 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Đi thẳng QL13</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                Không chạy lòng vòng ngõ hẻm, nhanh hơn 45–60 phút so với xe khách.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Xe gia đình văn minh</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                Ô tô 4–7 chỗ sạch sẽ, tối đa 3–4 khách, đúng giờ hẹn, không nhồi nhét.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Chia sẻ chi phí gốc</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                Gồm tiền xăng và vé BOT thực tế, tiết kiệm 30%–50% so với limousine.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SƠ ĐỒ ĐIỂM ĐÓN CÂY XĂNG DỌC TUYẾN QL13                                   */}
      {/* ========================================================================= */}
      <section className="bg-slate-900 text-white rounded-3xl p-5 sm:p-7 border border-white/[0.08] shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono font-medium">
              <Fuel className="w-3.5 h-3.5" />
              <span>ĐIỂM ĐÓN CỐ ĐỊNH QL13</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
              {direction === 'TO_SAIGON'
                ? 'Điểm đón dọc QL13 về Sài Gòn'
                : 'Điểm đón chiều về Bình Phước'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {direction === 'TO_SAIGON'
                ? 'Cây xăng Petrolimex & Trung tâm hành chính · Xe ghé đón nhanh 60 giây'
                : 'Đón xe tiện chuyến từ TP.HCM về Bàu Bàng, Chơn Thành, Hớn Quản, Bình Long'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Tần suất xe qua:</span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-semibold">
              ~3–5 phút / xe
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
      <section className="bg-[#f5f5f7] dark:bg-slate-850 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="space-y-0.5">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
            PHƯƠNG TIỆN THAM GIA
          </span>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Mọi phương tiện tiện chuyến đều có thể đi ghép
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Chia sẻ ghế trống và khoang xe để cùng tối ưu chi phí nhiên liệu.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-0.5">
            <span className="text-2xl block">🚗</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white block">Xe 4–5 chỗ</span>
            <span className="text-[11px] text-slate-500">2–3 ghế sau</span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-0.5">
            <span className="text-2xl block">🚙</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white block">Xe 7 chỗ</span>
            <span className="text-[11px] text-slate-500">Gia đình, cốp rộng</span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-0.5">
            <span className="text-2xl block">🛻</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white block">Bán tải Pickup</span>
            <span className="text-[11px] text-slate-500">Người & hàng cồng kềnh</span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-0.5">
            <span className="text-2xl block">🚚</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white block">Xe tải nhẹ</span>
            <span className="text-[11px] text-slate-500">Chở xe máy, dọn đồ</span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-0.5">
            <span className="text-2xl block">🚕</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white block">Xe tiện chuyến</span>
            <span className="text-[11px] text-slate-500">Chiều về trống xe</span>
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
