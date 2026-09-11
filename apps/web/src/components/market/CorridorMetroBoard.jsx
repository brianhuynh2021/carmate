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
  Smartphone,
  Navigation
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

  // 4 Cửa ngõ xuất phát đón xe tại TP.HCM (Chiều về Sài Gòn ➔ Bình Phước)
  const saigonGateways = useMemo(() => [
    { id: 'hub_ql13_hang_xanh', shortName: 'Hàng Xanh', name: 'Ngã tư Hàng Xanh', landmark: 'Bình Thạnh · Gần Q1, Q3', icon: '🏢' },
    { id: 'hub_ql13_san_bay_tsn', shortName: 'Sân bay TSN', name: 'Sân bay Tân Sơn Nhất', landmark: 'Ga T1/T2 · Phạm Văn Đồng', icon: '✈️' },
    { id: 'hub_ql13_binh_trieu', shortName: 'Bình Triệu', name: 'Cầu Bình Triệu', landmark: 'BX Miền Đông cũ · QL13', icon: '⛽' },
    { id: 'hub_ql13_nga4_binh_phuoc', shortName: 'Ngã 4 Bình Phước', name: 'Ngã 4 Bình Phước', landmark: 'Thủ Đức · Giao QL1A', icon: '📍' }
  ], []);

  const [saigonOriginHubId, setSaigonOriginHubId] = useState('hub_ql13_hang_xanh');

  const selectedSaigonGateway = useMemo(() => {
    return saigonGateways.find((g) => g.id === saigonOriginHubId) || saigonGateways[0];
  }, [saigonGateways, saigonOriginHubId]);

  // 6 Điểm đến chính tại Bình Phước (Thứ tự Nam lên Bắc dọc Quốc lộ 13)
  const binhPhuocDestinations = useMemo(() => [
    {
      id: 'hub_ql13_bau_bang',
      shortName: 'Bàu Bàng',
      name: 'Trạm dừng KCN Bàu Bàng / TT. Lai Uyên',
      landmark: 'Cổng KCN Bàu Bàng - QL13 (Cửa ngõ Bình Phước)',
      category: 'INDUSTRIAL',
      distanceFromSG: '~55 km',
      isHot: false
    },
    {
      id: 'hub_ql13_vincom_chon_thanh',
      shortName: 'Chơn Thành',
      name: 'TX. Chơn Thành (Vincom / Ngã 4 Chơn Thành)',
      landmark: 'Số 01 QL13 - Bùng binh QL14 & Tuyến N2',
      category: 'JUNCTION',
      distanceFromSG: '~75 km',
      isHot: true
    },
    {
      id: 'hub_ql13_tan_khai',
      shortName: 'Tân Khai',
      name: 'TT. Tân Khai (Cây xăng Petrolimex Tân Khai)',
      landmark: 'Cây xăng Petrolimex Tân Khai QL13 (Hớn Quản)',
      category: 'GAS_STATION',
      distanceFromSG: '~95 km',
      isHot: true
    },
    {
      id: 'hub_ql13_binh_long',
      shortName: 'Bình Long',
      name: 'TX. Bình Long (Vòng xoay An Lộc)',
      landmark: 'Cổng chào TX. Bình Long - Tuyến QL13',
      category: 'JUNCTION',
      distanceFromSG: '~115 km',
      isHot: true
    },
    {
      id: 'hub_ql13_cho_loc_ninh',
      shortName: 'Lộc Ninh',
      name: 'TT. Lộc Ninh (Chợ Lộc Ninh / Cây xăng 17)',
      landmark: 'Mặt tiền QL13 (Khu phố Ninh Thịnh / Cây xăng 17)',
      category: 'JUNCTION',
      distanceFromSG: '~135 km',
      isHot: true
    },
    {
      id: 'hub_ql13_budop',
      shortName: 'Bù Đốp',
      name: 'TT. Bù Đốp (Cổng Chợ Bù Đốp / ĐT759)',
      landmark: 'Chợ Bù Đốp - Tuyến gom ĐT759 nối QL13',
      category: 'FEEDER_THIN',
      distanceFromSG: '~155 km',
      isHot: false
    }
  ], []);

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
    if (direction === 'TO_BINH_PHUOC') {
      onOpenStationView?.(saigonOriginHubId, 'hub_ql13_binh_long');
      return;
    }
    const defaultHub = 'hub_ql13_binh_long';
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nearest = findNearestVirtualHub(pos.coords.latitude, pos.coords.longitude, 'Tuyến QL13');
          if (nearest && !nearest.isTerminal && ql13Hubs.some((h) => h.id === nearest.id && !h.isTerminal)) {
            onOpenStationView?.(nearest.id, 'hub_ql13_hang_xanh');
            return;
          }
          onOpenStationView?.(defaultHub, 'hub_ql13_hang_xanh');
        },
        () => {
          onOpenStationView?.(defaultHub, 'hub_ql13_hang_xanh');
        },
        { timeout: 3000 }
      );
    } else {
      onOpenStationView?.(defaultHub, 'hub_ql13_hang_xanh');
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
      {/* 2.1 BĂNG LÊN LỊCH CHUYẾN MAI (SLEEK 1-ROW ACTION BAR)                      */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-4 sm:p-5 shadow-lg backdrop-blur-xl transition-all">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {activeRole === 'driver' ? 'Lên lịch xe sáng mai' : 'Hẹn giờ đón xe sáng mai'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.08] text-slate-300 text-[11px] font-mono border border-white/10">
                  {activeRole === 'driver' ? 'Chủ xe' : 'Người đi cùng'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Tự động ghép bạn đồng hành cùng tuyến QL13</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenIntentModal?.(activeRole)}
            className={`h-10 sm:h-11 px-5 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] cursor-pointer transition-all shrink-0 ${
              activeRole === 'driver'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                : 'bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-[#0071e3]/25'
            }`}
          >
            <span>{activeRole === 'driver' ? 'Lên lịch ngay' : 'Đặt chỗ ngay'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. BIỂU PHÍ CỐ ĐỊNH QL13 (MINIMAL APPLE CARDS)                              */}
      {/* ========================================================================= */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {direction === 'TO_SAIGON' ? 'Biểu phí tuyến về Sài Gòn' : 'Biểu phí tuyến về Bình Phước'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Trọn gói xăng xe & vé BOT · 0đ phụ thu cao điểm</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-medium border border-emerald-200 dark:border-emerald-800">
            0đ phụ phí
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {direction === 'TO_SAIGON' ? (
            <>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block truncate">
                  Bình Long ➔ Hàng Xanh
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-[#0071e3]">180.000đ</span>
                  <span className="text-[11px] text-slate-400">/ ghế</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 block">~115 km · Vé BOT</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block truncate">
                  Tân Khai ➔ Hàng Xanh
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">150.000đ</span>
                  <span className="text-[11px] text-slate-400">/ ghế</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 block">~95 km · Vé BOT</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block truncate">
                  Chơn Thành ➔ Hàng Xanh
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-[#0071e3]">120.000đ</span>
                  <span className="text-[11px] text-slate-400">/ ghế</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 block">~75 km · Vé BOT</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block truncate">
                  Bình Long ➔ Chơn Thành
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-[#0071e3]">75.000đ</span>
                  <span className="text-[11px] text-slate-400">/ ghế</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 block">~40 km · Nội tỉnh</span>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block truncate">
                  Hàng Xanh ➔ Bù Đốp
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">240.000đ</span>
                  <span className="text-[11px] text-slate-400">/ ghế</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 block">~155 km · Tuyến gom ĐT759</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block truncate">
                  Hàng Xanh ➔ Lộc Ninh
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-[#0071e3]">205.000đ</span>
                  <span className="text-[11px] text-slate-400">/ ghế</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 block">~135 km · Mặt tiền QL13</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block truncate">
                  Hàng Xanh ➔ Bình Long
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-[#0071e3]">180.000đ</span>
                  <span className="text-[11px] text-slate-400">/ ghế</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 block">~115 km · Vé BOT</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-500/30 space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block truncate">
                  Sân bay TSN ➔ Bù Đốp
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">255.000đ</span>
                  <span className="text-[11px] text-slate-400">/ ghế</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 block">~160 km · Vé sân bay</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. ĐIỂM ĐÓN DỌC TUYẾN QL13                                                 */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 4. ĐIỂM ĐÓN DỌC TUYẾN QL13                                                 */}
      {/* ========================================================================= */}
      <section className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 border border-white/[0.08] shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              {direction === 'TO_SAIGON' ? 'Điểm đón về Sài Gòn' : 'Điểm trả tại Bình Phước (Chiều về từ TP.HCM)'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {direction === 'TO_SAIGON'
                ? 'Cây xăng Petrolimex & TTHC · Đón nhanh 60 giây'
                : `Xuất phát từ ${selectedSaigonGateway.name} · Trả tận nơi dọc QL13`}
            </p>
          </div>

          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-semibold">
            {direction === 'TO_SAIGON' ? '~3–5 phút / xe' : '4 Cửa ngõ · 6 Điểm trả'}
          </span>
        </div>

        {direction === 'TO_BINH_PHUOC' ? (
          <div className="space-y-5">
            {/* 1. CHỌN CỬA NGÕ XUẤT PHÁT TẠI TP.HCM */}
            <div className="space-y-2">
              <label className="text-xs font-bold font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                <span>1. Cửa ngõ bạn đón xe tại Sài Gòn:</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {saigonGateways.map((gw) => {
                  const isSelected = saigonOriginHubId === gw.id;
                  return (
                    <button
                      key={gw.id}
                      type="button"
                      onClick={() => setSaigonOriginHubId(gw.id)}
                      className={`p-3 rounded-2xl text-left transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#0071e3] text-white border-blue-400 shadow-md ring-1 ring-blue-300'
                          : 'bg-white/[0.04] text-slate-300 border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-sm font-bold">
                        <span>{gw.icon}</span>
                        <span className="truncate">{gw.shortName}</span>
                      </div>
                      <div className={`text-[10px] truncate mt-0.5 font-mono ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                        {gw.landmark}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. CHỌN ĐIỂM TRẢ TẠI BÌNH PHƯỚC (NAM LÊN BẮC DỌC QL13) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold font-mono uppercase text-slate-400 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Chọn điểm trả tại Bình Phước (Cước cố định từ {selectedSaigonGateway.shortName}):</span>
                </label>
                <span className="text-[11px] font-mono text-emerald-400 font-bold hidden sm:inline">
                  Đón thẳng QL13
                </span>
              </div>

              <div className="space-y-2.5">
                {binhPhuocDestinations.map((dest, index) => {
                  const tariff = getFixedSegmentTariff(saigonOriginHubId, dest.id);
                  return (
                    <div
                      key={dest.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        dest.isHot
                          ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-400'
                          : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                            dest.isHot
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-white/[0.08] text-slate-300'
                          }`}
                        >
                          {index + 1}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-white">
                              {dest.shortName} — {dest.name}
                            </h3>
                            {renderCategoryBadge(dest.category)}
                            <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300 text-[10px] font-mono">
                              {dest.distanceFromSG}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{dest.landmark}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                        <span className="text-sm sm:text-base font-bold font-mono text-emerald-400">
                          {formatVND(tariff.pricePerSeat)}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedQrHub(dest)}
                          title="Xem mã QR trạm đón"
                          className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
                        >
                          <QrCode className="w-4 h-4 text-emerald-400" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenIntentModal?.('passenger', saigonOriginHubId, dest.id)}
                          title="Hẹn giờ xe trước cho ngày mai"
                          className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-[#2997ff] hover:text-blue-300 transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                          <Clock className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenStationView?.(saigonOriginHubId, dest.id)}
                          className="h-9 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                        >
                          <span>Đón xe về {dest.shortName}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {ql13Hubs.map((hub, index) => (
              <div
                key={hub.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  hub.isTerminal
                    ? 'bg-sky-950/20 border-sky-500/30'
                    : hub.isHot
                      ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-400'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                      hub.isTerminal
                        ? 'bg-[#0071e3] text-white'
                        : hub.isHot
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-white/[0.08] text-slate-300'
                    }`}
                  >
                    {hub.isTerminal ? '🏁' : index + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">
                        {hub.shortName || hub.name}
                      </h3>
                      {renderCategoryBadge(hub.category)}
                      {hub.isTerminal && (
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[10px] font-mono font-semibold">
                          Ga cuối TP.HCM
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{hub.landmark}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                  {hub.isTerminal ? (
                    <span className="px-3 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono text-xs font-semibold flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-sky-400" />
                      <span>Ga cuối Hàng Xanh / TSN</span>
                    </span>
                  ) : (
                    <>
                      <span className="text-sm sm:text-base font-bold font-mono text-emerald-400">
                        {formatVND(hub.priceToTarget)}
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedQrHub(hub)}
                        title="Xem mã QR trạm đón"
                        className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
                      >
                        <QrCode className="w-4 h-4 text-emerald-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenIntentModal?.('passenger', hub.id, 'hub_ql13_hang_xanh')}
                        title="Hẹn giờ đón xe trước cho ngày mai"
                        className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-[#2997ff] hover:text-blue-300 transition-all cursor-pointer shrink-0 active:scale-95"
                      >
                        <Clock className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenStationView?.(hub.id, 'hub_ql13_hang_xanh')}
                        className="h-9 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                      >
                        <span>Đón xe</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
