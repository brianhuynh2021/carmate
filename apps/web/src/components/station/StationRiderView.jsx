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
  AlertCircle,
  Plane,
  QrCode,
  Smartphone,
  RefreshCw,
  Zap,
  Navigation,
  ExternalLink,
  Lightbulb,
  ShieldAlert,
  Scale,
  MessageSquare,
  Bus,
  Award,
  AlertTriangle,
  Clock,
  Ban,
  PhoneCall,
  LifeBuoy,
  Cigarette,
  DollarSign,
  UserX
} from 'lucide-react';
import {
  formatVND,
  getVirtualHubById,
  getFixedSegmentTariff,
  isValidVietnamesePhone,
  cleanPhoneNumber,
  findNearestVirtualHub,
  calculateDistanceKm,
  FIXED_CORRIDOR_COACH_SCHEDULES,
  hasVerifiedHotline,
  getVerifiedHotlines,
  UNHAPPY_CASE_CODES,
  getDefaultCorridor,
  getEndpointHubs
} from '@carmate/shared';
import { api, setStoredAuthToken } from '../../api/client.js';
import StationRequestModal from '../modals/StationRequestModal.jsx';
import LegalShieldModal from '../modals/LegalShieldModal.jsx';
import StationContactModal from '../modals/StationContactModal.jsx';
import MutualReviewModal from '../modals/MutualReviewModal.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { useI18n } from '../../i18n/index.jsx';

export default function StationRiderView({
  hubId = 'hub_ql13_tan_khai',
  initialDestinationHubId = null,
  currentUser,
  onBack,
  onShowToast
}) {
  const { t } = useI18n();
  // Điểm mút đầu A của hành lang — lấy từ CORRIDORS registry thay vì chép tay.
  // Danh sách này từng bị chép ở hai nơi (đây và MovementIntentModal) và đã lệch
  // nhau: bản chép tay sót trạm TP. Đồng Xoài nên người dùng không chọn được.
  const SAIGON_HUB_IDS = useMemo(
    () => getEndpointHubs(getDefaultCorridor().id, 'a').map((h) => h.id),
    []
  );

  // Hướng di chuyển: 'TO_SAIGON' (Bình Phước ➔ TP.HCM) | 'TO_BINH_PHUOC' (TP.HCM ➔ Bình Phước)
  const [direction, setDirection] = useState(() => {
    return SAIGON_HUB_IDS.includes(hubId) ? 'TO_BINH_PHUOC' : 'TO_SAIGON';
  });

  const [pickupHubId, setPickupHubId] = useState(hubId || (direction === 'TO_BINH_PHUOC' ? 'hub_ql13_hang_xanh' : 'hub_ql13_tan_khai'));

  useEffect(() => {
    if (hubId) {
      setPickupHubId(hubId);
      if (SAIGON_HUB_IDS.includes(hubId)) {
        setDirection('TO_BINH_PHUOC');
        setDestinationHubId(initialDestinationHubId || 'hub_ql13_binh_long');
      } else {
        setDirection('TO_SAIGON');
        setDestinationHubId(initialDestinationHubId || 'hub_ql13_hang_xanh');
      }
    }
  }, [hubId, initialDestinationHubId, SAIGON_HUB_IDS]);

  // Các điểm đón quen thuộc dọc trục QL13 (Cả 2 chiều Bình Phước ⇄ Sài Gòn)
  const ql13PickupHubs = useMemo(() => [
    { id: 'hub_ql13_budop', name: '🌾 TT. Bù Đốp (Cổng Chợ Bù Đốp / ĐT759) - Vùng gom' },
    { id: 'hub_ql13_cho_loc_ninh', name: '🏪 TT. Lộc Ninh (Chợ Lộc Ninh / Cây xăng 17 QL13)' },
    { id: 'hub_ql13_binh_long', name: '📍 Cổng chào TX. Bình Long (Vòng xoay An Lộc)' },
    { id: 'hub_ql13_tthc_binh_long', name: '🏛️ TTHC TX. Bình Long / Bến xe Bình Long' },
    { id: 'hub_ql13_tthc_tan_khai', name: '🏛️ TTHC Huyện Hớn Quản (TT. Tân Khai - Trụ sở Huyện ủy)' },
    { id: 'hub_ql13_tan_khai', name: '⛽ Cây xăng Petrolimex Tân Khai (QL13)' },
    { id: 'hub_ql13_minh_hung', name: '🏭 Cổng KCN Minh Hưng - Hàn Quốc (Chơn Thành)' },
    { id: 'hub_ql13_tthc_chon_thanh', name: '🏛️ TTHC TX. Chơn Thành / Quảng trường' },
    { id: 'hub_ql13_vincom_chon_thanh', name: '🛍️ Vincom Plaza Chơn Thành (Số 01 QL13)' },
    { id: 'hub_ql13_nga4_chon_thanh', name: '📍 Ngã 4 Chơn Thành (Bùng binh QL14 & QL13)' },
    { id: 'hub_ql13_becamex_chon_thanh', name: '🏭 Cổng KCN Becamex Bình Phước' },
    { id: 'hub_ql13_tthc_bau_bang', name: '🏛️ TTHC Huyện Bàu Bàng (TT. Lai Uyên)' },
    { id: 'hub_ql13_bau_bang', name: '🏭 Trạm dừng KCN Bàu Bàng / Mỹ Phước' },
    { id: 'hub_ql13_nga4_so_sao', name: '📍 Ngã 4 Sở Sao / Đại Nam (Thủ Dầu Một)' },
    { id: 'hub_ql13_vsip1', name: '🛍️ TTTM AEON Mall Canary / KCN VSIP 1' },
    { id: 'hub_ql13_nga4_binh_phuoc', name: '📍 Ngã 4 Bình Phước (Thủ Đức - Giao QL1A)' },
    { id: 'hub_ql13_van_phuc_city', name: '🏙️ Khu đô thị Vạn Phúc City (Thủ Đức)' },
    { id: 'hub_ql13_binh_trieu', name: '⛽ Cầu Bình Triệu / Bến xe Miền Đông cũ' },
    { id: 'hub_ql13_hang_xanh', name: '📍 Ngã tư Hàng Xanh (Bình Thạnh - Cây xăng Comeco 3)' },
    { id: 'hub_ql13_san_bay_tsn', name: '✈️ Sân bay Tân Sơn Nhất (Ga T1 / T2 - Phạm Văn Đồng)' }
  ], []);

  const handleAutoDetectGPS = () => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setClientCoords({ lat, lng });

          const nearest = findNearestVirtualHub(lat, lng, 'Tuyến QL13');
          if (nearest) {
            const dKm = nearest.distanceKm != null ? nearest.distanceKm : calculateDistanceKm(lat, lng, nearest.lat, nearest.lng);
            const distM = Math.round(dKm * 1000);
            setNearestHubInfo({
              ...nearest,
              distanceKm: dKm,
              distanceMeters: distM
            });

            if (ql13PickupHubs.some((h) => h.id === nearest.id)) {
              setPickupHubId(nearest.id);
              if (lat < 10.9) {
                setDirection('TO_BINH_PHUOC');
                setDestinationHubId('hub_ql13_binh_long');
              } else {
                setDirection('TO_SAIGON');
                setDestinationHubId('hub_ql13_hang_xanh');
              }
              onShowToast?.(`Đã kéo về trạm gần nhất: ${nearest.shortName || nearest.name} (${distM < 1000 ? distM + 'm' : dKm.toFixed(1) + 'km'})`);
              return;
            }
          }
          onShowToast?.(direction === 'TO_BINH_PHUOC' ? 'Đang dùng trạm Hàng Xanh' : 'Đang dùng trạm Bình Long');
        },
        () => {
          onShowToast?.('Không lấy được GPS, bạn có thể chọn trạm bên dưới');
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    }
  };

  // Thông tin Điểm đón hiện tại trên trục QL13
  const currentHub = useMemo(() => {
    return (
      getVirtualHubById(pickupHubId) || {
        id: pickupHubId,
        name: 'Trạm đón QL13',
        shortName: 'Trạm QL13',
        corridor: 'Tuyến QL13',
        landmark: 'Mặt tiền Đại lộ Quốc Lộ 13'
      }
    );
  }, [pickupHubId]);

  // Trạng thái: 'CHECKIN' (R1) | 'BOARDING_PASS' (R2)
  const [viewStep, setViewStep] = useState('CHECKIN');
  const [destinationHubId, setDestinationHubId] = useState(() => {
    if (initialDestinationHubId) return initialDestinationHubId;
    return SAIGON_HUB_IDS.includes(hubId) ? 'hub_ql13_binh_long' : 'hub_ql13_hang_xanh';
  });
  const [showOtherDestinations, setShowOtherDestinations] = useState(false);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [showNoShowRescueModal, setShowNoShowRescueModal] = useState(false);
  const [failoverInfo, setFailoverInfo] = useState(null);
  const [seatsNeeded, setSeatsNeeded] = useState(1);
  const [paidStatus, setPaidStatus] = useState(false);
  const [showRiderReviewModal, setShowRiderReviewModal] = useState(false);

  // KÍCH HOẠT ĐIỀU PHỐI DỰ PHÒNG SANG XE HỖ TRỢ (FAILOVER D2)
  const handleTriggerShadowFailover = () => {
    const shadowCar = {
      plate: '61A - 892.41',
      vehicleModel: 'Toyota Vios (Đen)',
      driverName: 'Anh Hải (Chủ xe)',
      time: '06:25'
    };
    setFailoverInfo(shadowCar);
    setBoardingPass((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        scheduledPickupTime: shadowCar.time,
        carInfo: {
          ...prev.carInfo,
          plate: shadowCar.plate,
          vehicleModel: shadowCar.vehicleModel,
          driverName: shadowCar.driverName
        }
      };
    });
    onShowToast?.('✓ Hệ thống điều phối xe hỗ trợ: Đã chuyển sang xe Toyota Vios Đen (61A-892.41)');
  };

  // MÔ PHỎNG ĐỔI TRẠNG THÁI: ĐANG ĐỨNG CHỜ TẠI TRẠM ⟷ ĐÃ LÊN XE EN-ROUTE
  const handleToggleBoardedDemo = () => {
    setBoardingPass((prev) => {
      if (!prev) return prev;
      const isNowBoarded = prev.status === 'BOARDED';
      const nextStatus = isNowBoarded ? 'ARRIVING' : 'BOARDED';
      const updated = { ...prev, status: nextStatus };
      try {
        localStorage.setItem(
          'carmate_active_station_pass',
          JSON.stringify({
            intentId: updated.intentId,
            hubId,
            pass: updated,
            savedAt: Date.now()
          })
        );
      } catch {}
      onShowToast?.(
        isNowBoarded
          ? 'Đã chuyển về màn hình Chờ đón tại trạm'
          : '🟢 Đã lên xe an toàn! Chuyển sang màn hình En-Route & VietQR'
      );
      return updated;
    });
  };
  const [phone, setPhone] = useState(() => {
    if (currentUser?.phone) return currentUser.phone;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('carmate_rider_phone') || '';
    }
    return '';
  });
  const [name, setName] = useState(() => {
    if (currentUser?.name) return currentUser.name;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('carmate_rider_name') || 'Khách đi cùng';
    }
    return 'Khách đi cùng';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Đổi chiều di chuyển 1-chạm (Toggle Direction)
  const toggleDirection = useCallback((newDir) => {
    const targetDir = newDir || (direction === 'TO_SAIGON' ? 'TO_BINH_PHUOC' : 'TO_SAIGON');
    setDirection(targetDir);
    if (targetDir === 'TO_BINH_PHUOC') {
      if (!SAIGON_HUB_IDS.includes(pickupHubId)) {
        setPickupHubId('hub_ql13_hang_xanh');
      }
      setDestinationHubId('hub_ql13_binh_long');
    } else {
      if (SAIGON_HUB_IDS.includes(pickupHubId)) {
        setPickupHubId('hub_ql13_tan_khai');
      }
      setDestinationHubId('hub_ql13_hang_xanh');
    }
  }, [direction, pickupHubId, SAIGON_HUB_IDS]);

  // Tọa độ định vị GPS của thiết bị & Cảnh báo Geofence Khóa kép (Anti-Quishing Layer 2)
  const [clientCoords, setClientCoords] = useState(null);
  const [nearestHubInfo, setNearestHubInfo] = useState(null);
  const [showStationRequestModal, setShowStationRequestModal] = useState(false);

  // Modal Xác thực Vô hình (Passwordless Phone SMS WebOTP / Telegram)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTelegramInput, setAuthTelegramInput] = useState('');
  const [authPhoneInput, setAuthPhoneInput] = useState('');
  const [authNameInput, setAuthNameInput] = useState('');
  const [otpStep, setOtpStep] = useState(false); // false: nhập SĐT, true: nhập mã OTP
  const [otpCode, setOtpCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dữ liệu Boarding Pass (R2)
  const [boardingPass, setBoardingPass] = useState(null);
  const [showLegalShield, setShowLegalShield] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  // Unhappy Cases & Safety Protocols (Chủ xe trễ hẹn > 5 phút, Báo cáo vi phạm văn hóa, Phao cứu sinh xe khách)
  const [showCultureViolationModal, setShowCultureViolationModal] = useState(false);
  const [cultureViolationType, setCultureViolationType] = useState('SMOKING');
  const [cultureViolationNote, setCultureViolationNote] = useState('');
  const [cultureSubmitting, setCultureSubmitting] = useState(false);
  const [showCoachLifebuoyModal, setShowCoachLifebuoyModal] = useState(false);
  const [driverLateDelayMinutes, setDriverLateDelayMinutes] = useState(0);
  const [isGraceCancelLoading, setIsGraceCancelLoading] = useState(false);

  // Danh sách các điểm đến khả dĩ trên hành lang QL13 (loại trừ trạm đang đứng)
  const destinationOptions = useMemo(() => {
    const allOptions = [
      { id: 'hub_ql13_hang_xanh', name: 'Ngã tư Hàng Xanh (Bình Thạnh - TP.HCM)' },
      { id: 'hub_ql13_san_bay_tsn', name: 'Sân bay Quốc tế Tân Sơn Nhất (Phạm Văn Đồng)' },
      { id: 'hub_ql13_nga4_binh_phuoc', name: 'Ngã 4 Bình Phước (Thủ Đức - TP.HCM)' },
      { id: 'hub_ql13_binh_trieu', name: 'Cầu Bình Triệu / Bến xe Miền Đông cũ' },
      { id: 'hub_ql13_van_phuc_city', name: 'Khu đô thị Vạn Phúc City (Thủ Đức)' },
      { id: 'hub_ql13_vsip1', name: 'KCN VSIP 1 / AEON Mall Bình Dương' },
      { id: 'hub_ql13_nga4_so_sao', name: 'Ngã 4 Sở Sao / Đại Nam (Thủ Dầu Một)' },
      { id: 'hub_ql13_bau_bang', name: 'Trạm dừng KCN Bàu Bàng / Mỹ Phước' },
      { id: 'hub_ql13_tthc_bau_bang', name: 'TTHC Huyện Bàu Bàng (Lai Uyên)' },
      { id: 'hub_ql13_becamex_chon_thanh', name: 'KCN Becamex Bình Phước' },
      { id: 'hub_ql13_nga4_chon_thanh', name: 'Ngã 4 Chơn Thành (Giao QL14 & QL13)' },
      { id: 'hub_ql13_vincom_chon_thanh', name: 'Vincom Plaza Chơn Thành' },
      { id: 'hub_ql13_tthc_chon_thanh', name: 'TTHC TX. Chơn Thành / Quảng trường' },
      { id: 'hub_ql13_minh_hung', name: 'KCN Minh Hưng - Hàn Quốc (Chơn Thành)' },
      { id: 'hub_ql13_tan_khai', name: 'Cây xăng Petrolimex Tân Khai (Hớn Quản)' },
      { id: 'hub_ql13_tthc_tan_khai', name: 'TTHC Huyện Hớn Quản (TT. Tân Khai)' },
      { id: 'hub_ql13_tthc_binh_long', name: 'TTHC TX. Bình Long / Bến xe' },
      { id: 'hub_ql13_binh_long', name: 'Cổng chào TX. Bình Long (An Lộc)' },
      { id: 'hub_ql13_cho_loc_ninh', name: 'Chợ Lộc Ninh (Ngã 3 QL13 & ĐT757)' },
      { id: 'hub_ql13_budop', name: 'TT. Bù Đốp (Chợ Bù Đốp / ĐT759)' }
    ];
    const list = direction === 'TO_BINH_PHUOC' ? [...allOptions].reverse() : allOptions;
    return list.filter((opt) => opt.id !== currentHub.id);
  }, [currentHub.id, direction]);

  // Bảng giá phân đoạn cố định Metro Tariff (Bất biến MIT & Zero Surge)
  const tariff = useMemo(() => {
    return getFixedSegmentTariff(currentHub.id, destinationHubId);
  }, [currentHub.id, destinationHubId]);

  const estimatedFare = tariff.pricePerSeat * seatsNeeded;

  // Hotline xe khách liên tỉnh QL13 dự phòng khẩn cấp
  const stationBackupHotlines = useMemo(() => {
    return getVerifiedHotlines('Tuyến QL13', 3);
  }, []);

  // 3 Điểm đến chính dàn phẳng kích thước lớn >= 56px (Stanford Ergonomics)
  const primaryDestinations = useMemo(() => {
    if (direction === 'TO_SAIGON') {
      return [
        {
          id: 'hub_ql13_nga4_binh_phuoc',
          title: 'Ngã 4 Bình Phước',
          subtitle: 'Cửa ngõ Thủ Đức · Giao QL1A',
          price: getFixedSegmentTariff(currentHub.id, 'hub_ql13_nga4_binh_phuoc').pricePerSeat
        },
        {
          id: 'hub_ql13_hang_xanh',
          title: 'Ngã tư Hàng Xanh',
          subtitle: 'Bình Thạnh · Đi Quận 1, Quận 3',
          price: getFixedSegmentTariff(currentHub.id, 'hub_ql13_hang_xanh').pricePerSeat
        },
        {
          id: 'hub_ql13_san_bay_tsn',
          title: 'Sân bay Tân Sơn Nhất',
          subtitle: 'Ga T1 / T2 Quốc Nội · Quốc Tế',
          price: getFixedSegmentTariff(currentHub.id, 'hub_ql13_san_bay_tsn').pricePerSeat
        }
      ];
    } else {
      const candidates = [
        {
          id: 'hub_ql13_vincom_chon_thanh',
          title: 'TX. Chơn Thành',
          subtitle: 'Vincom Plaza · Giao QL14',
          price: getFixedSegmentTariff(currentHub.id, 'hub_ql13_vincom_chon_thanh').pricePerSeat
        },
        {
          id: 'hub_ql13_tan_khai',
          title: 'Tân Khai (QL13)',
          subtitle: 'Cây xăng Petrolimex Tân Khai',
          price: getFixedSegmentTariff(currentHub.id, 'hub_ql13_tan_khai').pricePerSeat
        },
        {
          id: 'hub_ql13_binh_long',
          title: 'TX. Bình Long',
          subtitle: 'Vòng xoay An Lộc · TT Bình Long',
          price: getFixedSegmentTariff(currentHub.id, 'hub_ql13_binh_long').pricePerSeat
        },
        {
          id: 'hub_ql13_cho_loc_ninh',
          title: 'TT. Lộc Ninh',
          subtitle: 'Chợ Lộc Ninh · Mặt tiền QL13',
          price: getFixedSegmentTariff(currentHub.id, 'hub_ql13_cho_loc_ninh').pricePerSeat
        },
        {
          id: 'hub_ql13_budop',
          title: 'TT. Bù Đốp',
          subtitle: 'Chợ Bù Đốp · Tuyến gom ĐT759',
          price: getFixedSegmentTariff(currentHub.id, 'hub_ql13_budop').pricePerSeat
        }
      ];
      return candidates.filter((c) => c.id !== currentHub.id);
    }
  }, [currentHub.id, direction]);

  // Bộ đếm ngược Radar thời gian thực khi xe đang tiếp cận (Live Boarding Pass)
  const [etaSeconds, setEtaSeconds] = useState(195); // 03 : 15 phút

  useEffect(() => {
    if (viewStep !== 'BOARDING_PASS') return;
    const interval = setInterval(() => {
      setEtaSeconds((prev) => (prev > 15 ? prev - 1 : 15));
    }, 1000);
    return () => clearInterval(interval);
  }, [viewStep]);

  const formatEtaMinutesSeconds = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`;
  };

  const dynamicDistanceKm = Math.max(0.2, (etaSeconds * 0.011)).toFixed(1);
  const dynamicProgressPercent = Math.min(100, Math.max(15, Math.round((1 - etaSeconds / 240) * 100)));

  // Cơ chế giữ màn hình sáng ngoài trời nắng (Screen Wake Lock API - Zero Sleep)
  useEffect(() => {
    if (viewStep !== 'BOARDING_PASS') return;
    let wakeLockSentinel = null;

    const requestScreenLock = async () => {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        try {
          wakeLockSentinel = await navigator.wakeLock.request('screen');
        } catch {
          // Bỏ qua nếu thiết bị đang bật chế độ tiết kiệm pin
        }
      }
    };

    requestScreenLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestScreenLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [viewStep]);

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
                if (['WAITING', 'OFFERED', 'ARRIVING', 'BOARDED'].includes(res.intent.status)) {
                  setBoardingPass(res.intent);
                } else if (res.intent.status === 'COMPLETED') {
                  setBoardingPass(res.intent);
                  setShowRiderReviewModal(true);
                } else if (res.intent.status === 'CANCELLED') {
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

  // 1.5. LẮNG NGHE ĐỒNG BỘ CROSS-TAB QUA STORAGE EVENT (KHI CHỦ XE BẤM LÊN XE HOẶC TRẢ KHÁCH)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'carmate_active_station_pass' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.pass) {
            setBoardingPass((prev) => ({ ...prev, ...parsed.pass }));
            if (parsed.pass.status === 'COMPLETED') {
              setShowRiderReviewModal(true);
            }
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 2. POLLING ĐỒNG BỘ TRẠNG THÁI XE THỜI GIAN THỰC (REAL-TIME STATUS SYNC MỖI 3S)
  useEffect(() => {
    if (viewStep !== 'BOARDING_PASS' || !boardingPass?.intentId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await api.getRiderPass(boardingPass.intentId);
        if (res?.success && res?.intent) {
          setBoardingPass((prev) => {
            const updated = {
              ...prev,
              ...res.intent,
              position: res.position ?? prev?.position ?? 1
            };
            try {
              localStorage.setItem(
                'carmate_active_station_pass',
                JSON.stringify({
                  intentId: updated.intentId,
                  hubId: currentHub.id,
                  pass: updated,
                  savedAt: Date.now()
                })
              );
            } catch {}
            return updated;
          });
        }
      } catch {}
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [boardingPass?.intentId, currentHub.id, viewStep]);

  // 3. TỰ ĐỘNG LẤY TỌA ĐỘ GPS, KÉO VỀ TRẠM GẦN NHẤT & ĐỐI SOÁT GEOFENCE (SNAP-TO-STATION)
  // Tính năng auto-GPS đã bị xoá để tránh popup friction cho khách hàng mới.
  // Khách sẽ chủ động bấm khi cần.

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

      // Lưu chìa khóa danh tính ngầm vào máy để các lần sau không cần nhập lại
      try {
        localStorage.setItem('carmate_rider_phone', finalPhone);
        localStorage.setItem('carmate_rider_name', finalName);
      } catch {}

      try {
        const res = await api.stationCheckIn(currentHub.id, {
          destinationHubId,
          seatsNeeded,
          phone: finalPhone,
          name: finalName,
          clientLat: clientCoords?.lat ?? null,
          clientLng: clientCoords?.lng ?? null
        });

        if (res?.success && res?.intent) {
          if (res.token) {
            setStoredAuthToken(res.token);
          }
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
          onShowToast?.('Đã vào hàng đợi! Hệ thống đang kết nối chủ xe tiện chuyến qua trạm.');
        } else {
          throw new Error('Fallback demo mode');
        }
      } catch {
        // Fallback lưu trữ ngoại tuyến khi mất mạng
        const fallbackPass = {
          intentId: `ST-RIDER-${Date.now().toString().slice(-6)}`,
          hubName: currentHub.name,
          destinationName:
            destinationOptions.find((d) => d.id === destinationHubId)?.name ||
            (direction === 'TO_BINH_PHUOC' ? 'TX. Bình Long (Vòng xoay An Lộc)' : 'Ngã tư Hàng Xanh'),
          seatsNeeded,
          pin: String(Math.floor(1000 + Math.random() * 9000)),
          fuelSurcharge: estimatedFare,
          driverPayout: tariff.driverPayoutPerSeat * seatsNeeded,
          status: 'WAITING',
          noSurge: true,
          carInfo: null
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
        onShowToast?.('Đã vào hàng đợi trạm! Đang chờ chủ xe tiện chuyến nhận đơn.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentHub.id, currentHub.name, destinationHubId, destinationOptions, estimatedFare, name, onShowToast, phone, seatsNeeded, tariff.driverPayoutPerSeat, clientCoords?.lat, clientCoords?.lng, direction]
  );

  // XÁC NHẬN MÃ OTP (ĐĂNG NHẬP NGẦM PASSWORDLESS)
  const handleVerifyOtpSubmit = useCallback(
    async (codeToVerify) => {
      const code = String(codeToVerify || otpCode).trim();
      if (!code || code.length < 4) {
        setAuthError('Vui lòng nhập mã OTP gửi về tin nhắn');
        return;
      }
      setAuthLoading(true);
      setAuthError('');
      const clean = cleanPhoneNumber(authPhoneInput);
      const finalName = authNameInput.trim() || 'Khách đi cùng';
      try {
        const res = await api.verifyOtp({ phone: clean, otp: code, name: finalName });
        if (res?.success) {
          if (res.token) setStoredAuthToken(res.token);
          setPhone(clean);
          setName(finalName);
          try {
            localStorage.setItem('carmate_rider_phone', clean);
            localStorage.setItem('carmate_rider_name', finalName);
          } catch {}
          setShowAuthModal(false);
          setOtpStep(false);
          executeCheckIn(clean, finalName);
        } else {
          setAuthError(res?.error || 'Mã OTP không đúng hoặc đã hết hạn');
        }
      } catch {
        // Offline fallback
        setPhone(clean);
        setName(finalName);
        try {
          localStorage.setItem('carmate_rider_phone', clean);
          localStorage.setItem('carmate_rider_name', finalName);
        } catch {}
        setShowAuthModal(false);
        setOtpStep(false);
        executeCheckIn(clean, finalName);
      } finally {
        setAuthLoading(false);
      }
    },
    [authNameInput, authPhoneInput, executeCheckIn, otpCode]
  );

  // WebOTP Listener: Tự động bắt mã SMS OTP trên trình duyệt điện thoại (0-touch)
  useEffect(() => {
    if (!otpStep || typeof window === 'undefined' || !('OTPCredential' in window)) return;
    const ac = new AbortController();
    navigator.credentials
      ?.get({
        otp: { transport: ['sms'] },
        signal: ac.signal
      })
      .then((otp) => {
        if (otp?.code) {
          setOtpCode(otp.code);
          handleVerifyOtpSubmit(otp.code);
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, [otpStep, handleVerifyOtpSubmit]);

  // XỬ LÝ KHÁCH BẤM [VÀO HÀNG ĐỢI ĐÓN XE] (R1)
  const handleCheckInClick = (e) => {
    e?.preventDefault();

    // Nếu khách đã gõ SĐT vào ô input (>= 9 số)
    const cleaned = cleanPhoneNumber(phone);
    if (cleaned && cleaned.length >= 9 && isValidVietnamesePhone(cleaned)) {
      executeCheckIn(cleaned, name);
      return;
    }

    if (phone && phone.trim().length > 0 && !isValidVietnamesePhone(cleaned)) {
      onShowToast?.('Vui lòng kiểm tra lại số điện thoại (10 chữ số)');
      return;
    }

    // Nếu chưa có thông tin -> Mở modal Xác thực ngầm 5s (SMS OTP WebOTP / Telegram)
    setAuthError('');
    setOtpStep(false);
    setShowAuthModal(true);
  };

  // GỬI MÃ XÁC THỰC OTP QUA SMS
  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    const clean = cleanPhoneNumber(authPhoneInput);
    if (!clean || clean.length < 9) {
      setAuthError('Vui lòng nhập số điện thoại hợp lệ (10 chữ số)');
      return;
    }
    if (!isValidVietnamesePhone(clean)) {
      setAuthError('Số điện thoại không đúng định dạng nhà mạng Việt Nam');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await api.requestOtp(clean);
      if (res?.success) {
        setOtpStep(true);
        if (res.devOtp) {
          setOtpCode(res.devOtp);
        }
        onShowToast?.('Đã gửi mã xác thực SMS về số điện thoại của bạn');
      } else {
        setAuthError(res?.error || 'Không gửi được mã xác thực');
      }
    } catch {
      // Fallback dev mode
      setOtpStep(true);
      setOtpCode('123456');
    } finally {
      setAuthLoading(false);
    }
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
        try {
          localStorage.setItem('carmate_rider_phone', resolvedPhone);
          localStorage.setItem('carmate_rider_name', resolvedName);
        } catch {}
        setShowAuthModal(false);
        executeCheckIn(resolvedPhone, resolvedName);
      } else {
        // Fallback local auth
        setPhone(cleanPhone);
        setName(authPayload.first_name);
        try {
          localStorage.setItem('carmate_rider_phone', cleanPhone);
          localStorage.setItem('carmate_rider_name', authPayload.first_name);
        } catch {}
        setShowAuthModal(false);
        executeCheckIn(cleanPhone, authPayload.first_name);
      }
    } catch {
      // Fallback khi offline
      const fallbackPhone = authTelegramInput.replace(/\D/g, '') || '0988112233';
      const fallbackName = authNameInput.trim() || 'Khách đi cùng';
      setPhone(fallbackPhone);
      setName(fallbackName);
      try {
        localStorage.setItem('carmate_rider_phone', fallbackPhone);
        localStorage.setItem('carmate_rider_name', fallbackName);
      } catch {}
      setShowAuthModal(false);
      executeCheckIn(fallbackPhone, fallbackName);
    } finally {
      setAuthLoading(false);
    }
  };

  // XÁC THỰC TRỰC TIẾP QUA SĐT NHANH (KHÔNG CẦN CHỜ OTP NẾU ĐI GẤP)
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
    try {
      localStorage.setItem('carmate_rider_phone', clean);
      localStorage.setItem('carmate_rider_name', finalName);
    } catch {}
    setShowAuthModal(false);
    executeCheckIn(clean, finalName);
  };

  const handleCancelPass = () => {
    try {
      localStorage.removeItem('carmate_active_station_pass');
    } catch {}
    setViewStep('CHECKIN');
    setBoardingPass(null);
    onShowToast?.('Đã rời khỏi hàng đợi.');
  };

  const handleGraceCancel = async () => {
    setIsGraceCancelLoading(true);
    try {
      await api.riderCancelGrace({
        intentId: boardingPass?.intentId,
        driverPhone: boardingPass?.carInfo?.driverPhone,
        riderPhone: currentUser?.phone,
        delayMinutes: Math.max(5, driverLateDelayMinutes)
      });
      try {
        localStorage.removeItem('carmate_active_station_pass');
      } catch {}
      setBoardingPass(null);
      setViewStep('CHECKIN');
      setShowCoachLifebuoyModal(true);
      onShowToast?.('Đã hủy chuyến miễn phạt (0đ). Điểm tín nhiệm bảo toàn 100%.');
    } catch (err) {
      console.error('Grace cancel error:', err);
      onShowToast?.(err.message || 'Lỗi khi thực hiện hủy giữ chỗ miễn phạt');
    } finally {
      setIsGraceCancelLoading(false);
    }
  };

  const handleReportCultureViolation = async (e) => {
    e?.preventDefault?.();
    setCultureSubmitting(true);
    try {
      const res = await api.reportRiderCultureViolation({
        bookingId: boardingPass?.intentId,
        tripId: boardingPass?.matchedTripId,
        driverPhone: boardingPass?.carInfo?.driverPhone,
        reporterPhone: currentUser?.phone,
        violationType: cultureViolationType,
        note: cultureViolationNote
      });
      setShowCultureViolationModal(false);
      setCultureViolationNote('');
      onShowToast?.(res.message || 'Đã tiếp nhận báo cáo: Hệ thống tạm đình chỉ nhận cuốc của Chủ xe 30 ngày.');
    } catch (err) {
      console.error('Culture violation report error:', err);
      onShowToast?.(err.message || 'Lỗi khi gửi báo cáo');
    } finally {
      setCultureSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between select-none p-4 sm:p-6 font-sans">
      {/* ── TOP BAR: GIAO DIỆN TỐI ƯU 2 MÀN HÌNH (STANFORD ERGONOMICS) ── */}
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
              <span className="type-label font-semibold uppercase tracking-wider text-emerald-400">
                {viewStep === 'CHECKIN' ? 'CARMATE • TRẠM VẬN TẢI ẢO' : 'THẺ THÔNG TIN ĐÓN XE'}
              </span>
            </div>
            {/* Tên trạm đứng riêng một hàng; hai nút phụ xuống hàng dưới.
                Nhét chung một hàng ngang thì ở 390px nút "Đổi trạm" bị vỡ làm
                hai dòng chen vào giữa tiêu đề, trông như lỗi dựng trang. */}
            <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5 mt-0.5 min-w-0">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">{currentHub.shortName || currentHub.name}</span>
            </h1>
            {viewStep === 'CHECKIN' && (
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setShowStationPicker(!showStationPicker)}
                  className="tap-44 type-caption text-sky-400 hover:text-sky-300 underline cursor-pointer whitespace-nowrap"
                >
                  {showStationPicker ? t('station.collapse') : t('station.changeHub')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStationRequestModal(true)}
                  className="tap-44 type-caption text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 px-2.5 rounded-lg border border-amber-500/20 transition-all whitespace-nowrap"
                  title={t('station.suggestHubTitle')}
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{t('station.suggestHub')}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {viewStep === 'CHECKIN' ? (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 font-mono">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>0% SURGE</span>
          </div>
        ) : (
          <div className="text-right">
            <span className="text-base font-black font-mono text-emerald-400 block">
              {formatVND(boardingPass?.fuelSurcharge || estimatedFare)}
            </span>
            <span className="text-[10px] text-slate-400">{t('station.allInclusive')}</span>
          </div>
        )}
      </header>

      {/* DROPDOWN CHỌN TRẠM ĐÓN DỌC TUYẾN QL13 (TIỆN LỢI THỬ NGHIỆM TRÊN WEB & MOBILE) */}
      {showStationPicker && viewStep === 'CHECKIN' && (
        <div className="mb-4 p-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.12] max-w-lg mx-auto w-full animate-fade-in space-y-2 shadow-xl">
          <div className="flex items-center justify-between type-caption font-bold text-slate-300">
            <span>{t('station.chooseHub')}</span>
            <button
              type="button"
              onClick={handleAutoDetectGPS}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <span>{t('station.findByGps')}</span>
            </button>
          </div>
          <select
            value={pickupHubId}
            onChange={(e) => {
              setPickupHubId(e.target.value);
              setShowStationPicker(false);
              onShowToast?.(`Đã chuyển sang trạm: ${ql13PickupHubs.find(h => h.id === e.target.value)?.name || e.target.value}`);
            }}
            className="w-full h-11 px-3 rounded-xl bg-slate-900 border border-white/[0.2] text-white text-xs font-semibold cursor-pointer outline-none focus:border-emerald-400"
          >
            {ql13PickupHubs.map((h) => (
              <option key={h.id} value={h.id} className="bg-slate-900 text-white">
                {h.name}
              </option>
            ))}
          </select>
          <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-400">{t('station.noHubYet')}</span>
            <button
              type="button"
              onClick={() => {
                setShowStationPicker(false);
                setShowStationRequestModal(true);
              }}
              className="text-[11px] font-bold font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>{t('station.suggestNewHub')}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── NỘI DUNG CHÍNH (ĐÚNG 2 MÀN HÌNH DUY NHẤT: MÀN HÌNH 1 HOẶC MÀN HÌNH 2) ── */}
      <main className="flex-1 flex flex-col justify-center my-auto max-w-lg mx-auto w-full">
        {/* ========================================================================= */}
        {/* MÀN HÌNH 1: QUÉT QR & VÀO HÀNG ĐỢI (CHECK-IN SCREEN — 5 ĐẾN 10 GIÂY)      */}
        {/* ========================================================================= */}
        {viewStep === 'CHECKIN' && (
          <form onSubmit={handleCheckInClick} className="space-y-4 animate-fade-in">
            {/* CƠ CHẾ KÉO VỀ TRẠM GẦN NHẤT (SNAP-TO-STATION BANNER - ZERO ROADSIDE STOPS) */}
            {nearestHubInfo && (
              <div className="p-3.5 sm:p-4 rounded-3xl bg-gradient-to-br from-sky-950/70 via-slate-900/85 to-slate-950/90 border border-sky-500/30 backdrop-blur-md text-white shadow-xl space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                      <Navigation className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase font-black tracking-wider text-sky-400 flex items-center gap-1.5">
                        <span>{t('station.gpsSnap')}</span>
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
                        {t('station.nearestValidHub')} <span className="text-sky-300 font-extrabold">{nearestHubInfo.shortName || nearestHubInfo.name}</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono font-bold text-[11px] shrink-0 border border-sky-500/30">
                    {nearestHubInfo.distanceMeters < 1000
                      ? `Cách ~${nearestHubInfo.distanceMeters}m`
                      : `Cách ~${nearestHubInfo.distanceKm.toFixed(1)} km`}
                  </span>
                </div>

                <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                  {t('station.moveToHub1')} <strong>{t('station.dwell3045')}</strong> {t('station.moveToHub2')} <strong>{t('station.noFreePickup')}</strong> {t('station.moveToHub3')} <strong>P.130</strong> {t('station.moveToHub4')}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/[0.08]">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>🚶 ~{Math.max(1, Math.round(nearestHubInfo.distanceKm * 12))}p đi bộ</span>
                    <span>•</span>
                    <span>🛵 ~{Math.max(1, Math.round(nearestHubInfo.distanceKm * 2.5))}p xe ôm</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {pickupHubId !== nearestHubInfo.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setPickupHubId(nearestHubInfo.id);
                          onShowToast?.(`Đã kéo về trạm gần nhất: ${nearestHubInfo.shortName || nearestHubInfo.name}`);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-bold font-mono transition-all cursor-pointer"
                      >
                        {t('station.pickThisHub')}
                      </button>
                    )}
                    {nearestHubInfo.lat && nearestHubInfo.lng && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${nearestHubInfo.lat},${nearestHubInfo.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold font-mono flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>{t('station.directions')}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 1. BẠN MUỐN ĐẾN ĐÂU? (DÀN PHẲNG 3 NÚT BẤM KÍCH THƯỚC LỚN >= 56PX) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="type-heading text-slate-200">
                  {t('station.step1Where')}
                </label>
                <button
                  type="button"
                  onClick={() => toggleDirection()}
                  className="tap-44 text-[11px] font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 rounded-xl border border-sky-500/20 transition-all"
                >
                  <RefreshCw className="w-3 h-3 text-sky-400" />
                  <span>{direction === 'TO_SAIGON' ? 'Đi Sài Gòn ⇄' : 'Về Bình Phước ⇄'}</span>
                </button>
              </div>

              {/* Dàn phẳng các nút chọn lớn (chiều cao >= 56px, chạm cực nhạy ngoài nắng) */}
              <div className="space-y-2">
                {primaryDestinations.map((dest) => {
                  const isSelected = destinationHubId === dest.id;
                  return (
                    <button
                      key={dest.id}
                      type="button"
                      onClick={() => {
                        setDestinationHubId(dest.id);
                        setShowOtherDestinations(false);
                      }}
                      className={`w-full min-h-[58px] p-3.5 rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400 text-white'
                          : 'bg-white/[0.04] border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.07] text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-emerald-400 ring-4 ring-emerald-500/30' : 'bg-slate-600'
                          }`}
                        />
                        <div>
                          <div className="text-sm sm:text-base font-black text-white leading-tight">
                            {dest.title}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {dest.subtitle}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-base sm:text-lg font-black font-mono ${
                            isSelected ? 'text-emerald-400' : 'text-slate-200'
                          }`}
                        >
                          {formatVND(dest.price)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">{t('station.perPerson')}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Thu gọn: Điểm trả khác dọc đường */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowOtherDestinations(!showOtherDestinations)}
                  className="tap-44 text-xs text-slate-400 hover:text-emerald-300 flex items-center gap-1 underline cursor-pointer"
                >
                  <span>{showOtherDestinations ? '▲ Thu gọn điểm trả khác' : '▼ Hoặc chọn điểm trả khác dọc đường...'}</span>
                </button>
                {showOtherDestinations && (
                  <div className="mt-2 animate-fade-in">
                    <select
                      value={destinationHubId}
                      onChange={(e) => setDestinationHubId(e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl bg-white/[0.06] border border-white/[0.12] text-white text-sm font-semibold outline-none focus:border-emerald-500 transition-all cursor-pointer"
                    >
                      {destinationOptions.map((opt) => (
                        <option key={opt.id} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* 2. SỐ LƯỢNG GHẾ */}
            <div className="space-y-1.5">
              <label className="type-heading text-slate-200 block">
                {t('station.step2Seats')}
              </label>
              <div className="flex items-center justify-between p-2 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setSeatsNeeded((prev) => Math.max(1, prev - 1))}
                  className="w-13 h-13 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-2xl font-black text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
                >
                  -
                </button>
                <div className="text-center">
                  {/* Mono chỉ dành cho CON SỐ (để canh cột khi tăng/giảm);
                      chữ tiếng Việt dùng font thường cho dễ đọc. */}
                  <span className="text-2xl font-black text-white tracking-wide">
                    <span className="font-mono tabular">{seatsNeeded}</span> người
                  </span>
                  <span className="text-[11px] text-emerald-400 block mt-0.5">
                    Phụ xăng: <span className="font-mono font-semibold">{formatVND(estimatedFare)}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSeatsNeeded((prev) => Math.min(4, prev + 1))}
                  className="w-13 h-13 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-2xl font-black text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
                >
                  +
                </button>
              </div>
            </div>

            {/* 3. SỐ ĐIỆN THOẠI ĐỂ CHỦ XE NHẬN DIỆN */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="type-heading text-slate-200 block">
                  {t('station.step3Phone')}
                </label>
                {phone && (
                  <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {t('station.remembered')}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="0912 xxx xxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-14 px-4 text-lg font-mono font-bold rounded-2xl bg-white/[0.06] border-2 border-white/[0.12] text-white placeholder-slate-500 outline-none focus:border-emerald-400 transition-all"
                />
                {!phone && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthPhoneInput('');
                      setOtpStep(false);
                      setShowAuthModal(true);
                    }}
                    className="absolute right-2.5 top-1.5 h-11 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold font-mono flex items-center gap-1 transition-all"
                  >
                    <span>SMS OTP</span>
                  </button>
                )}
              </div>

              {/* Tùy chọn tên hiển thị ngắn gọn (không bắt buộc) */}
              <div className="pt-0.5">
                <div className="flex items-center justify-between type-label text-slate-400 mb-1">
                  <span>{t('station.displayName')}</span>
                  <span className="text-slate-500">{t('station.optional')}</span>
                </div>
                <input
                  type="text"
                  placeholder={t('station.namePlaceholder')}
                  value={name === 'Khách đi cùng' ? '' : name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm font-semibold rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-500 outline-none focus:border-emerald-400 transition-all"
                />
              </div>

              <p className="text-[11px] text-slate-400">
                {t('station.noPasswordNote')}
              </p>
            </div>

            {/* NÚT BẤM CHÍNH TO BẢN: [▶] VÀO HÀNG ĐỢI ĐÓN XE */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-base sm:text-lg uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_30px_rgba(16,185,129,0.35)] cursor-pointer transition-all disabled:opacity-50"
              >
                <span>[▶]</span>
                <span>{isSubmitting ? 'ĐANG KẾT NỐI XE...' : 'VÀO HÀNG ĐỢI ĐÓN XE'}</span>
              </button>
              <p className="text-center text-[11px] text-slate-400">
                {t('station.fixedPriceNote')}
              </p>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* MÀN HÌNH 2: THẺ THÔNG TIN ĐÓN XE (LIVE BOARDING PASS THEO DÕI THỜI GIAN THỰC) */}
        {/* ========================================================================= */}
        {viewStep === 'BOARDING_PASS' && boardingPass && (() => {
          const hasAssignedCar = Boolean(boardingPass.carInfo && (boardingPass.carInfo.plate || boardingPass.carInfo.driverName));
          const isWaiting = boardingPass.status === 'WAITING' || !hasAssignedCar;
          const _isArriving = boardingPass.status === 'ARRIVING' && hasAssignedCar;
          const isBoarded = (boardingPass.status === 'BOARDED' || boardingPass.status === 'COMPLETED');

          return (
            <div className="space-y-4 animate-fade-in">
              {/* HEADER TÓM TẮT THẺ THÔNG TIN ĐÓN XE */}
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold">
                  {currentHub.shortName || currentHub.name} ──&gt; {boardingPass.destinationName || 'Hàng Xanh'}
                </span>
                <span className="text-emerald-400 font-black text-sm">
                  {formatVND(boardingPass.fuelSurcharge || estimatedFare)}
                </span>
              </div>

              {/* CHỨNG NHẬN TRẠNG THÁI (ZERO-ANXIETY TRUST SHIELD) */}
              {isWaiting ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs font-mono space-y-1.5 text-left">
                  <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wide">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span>ĐANG TRONG HÀNG ĐỢI TẠI TRẠM · ĐANG TÌM CHỦ XE</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-300 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Tuyến thẳng QL13 về {boardingPass.destinationName || 'Hàng Xanh'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Mã PIN đã sẵn sàng · 0đ phí giữ chỗ</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs font-mono space-y-1.5 text-left">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wide">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>{t('station.ticketConfirmed')}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-300 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Tuyến thẳng QL13 về {boardingPass.destinationName || 'Hàng Xanh'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t('station.seatProtected')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* THÔNG BÁO ĐIỀU PHỐI MƯỢT MÀ KHI XE D1 GẶP SỰ CỐ (SILENT FAILOVER D2) */}
              {failoverInfo && (
                <div className="p-3.5 rounded-2xl bg-sky-500/15 border border-sky-500/35 space-y-2 animate-fade-in text-left">
                  <div className="flex items-center gap-2 text-sky-300 font-bold text-xs uppercase tracking-wider font-mono">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                    <span>{t('station.dispatchSystem')}</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {t('station.switchedToCar')} <strong>{failoverInfo.vehicleModel}</strong> (<strong>{failoverInfo.plate}</strong>), do <strong>{failoverInfo.driverName}</strong> {t('station.picksYouUpAt')} <strong>{failoverInfo.time}</strong> {t('station.atHubEdge')}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('station.seatRouteKept')}</span>
                  </div>
                </div>
              )}

              {isBoarded ? (
                /* ========================================================================= */
                /* TRẠNG THÁI 1: ĐÃ LÊN XE (EN-ROUTE) - VIETQR PHỤ XĂNG TRÊN XE & DROP-OFF  */
                /* ========================================================================= */
                <div className="space-y-4 animate-fade-in">
                  {/* 1. STATUS BAR: XE ĐANG CHẠY TRÊN TUYẾN QL13 VỀ ĐIỂM ĐẾN */}
                  <div className="bg-gradient-to-br from-emerald-500/15 via-sky-500/10 to-transparent border border-emerald-500/40 rounded-3xl p-5 space-y-3 shadow-xl">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>🟢 ĐANG TRÊN HÀNH TRÌNH VỀ {boardingPass.destinationName || 'HÀNG XANH'}</span>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        QL13 Express
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-white font-mono">
                        {boardingPass.carInfo?.vehicleModel || 'Xe ô tô gia đình'}
                      </h3>
                      <p className="text-sm font-mono text-emerald-300 font-bold">
                        Biển số: {boardingPass.carInfo?.plate || 'Đang cập nhật'} · Chủ xe: {boardingPass.carInfo?.driverName || 'Chủ xe cá nhân'}
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-black/30 border border-white/[0.08] text-xs font-mono text-slate-300 flex items-center justify-between">
                      <span className="text-slate-400">{t('station.pickupAtHub')}</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Đã khớp mã PIN ({boardingPass.pin || '8842'}) lúc 06:15
                      </span>
                    </div>
                  </div>

                  {/* 2. THẺ VIETQR PHỤ XĂNG TRỰC TIẾP TRÊN XE (IN-TRANSIT SETTLEMENT) */}
                  <div className="bg-gradient-to-b from-white/[0.08] to-white/[0.03] border-2 border-emerald-500/60 rounded-3xl p-5 space-y-4 shadow-2xl text-left">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-xs uppercase tracking-wider">
                          <QrCode className="w-4 h-4" />
                          <span>{t('station.vietqrTitle')}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {t('station.vietqrDesc')}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400 font-mono">{t('station.fuelShareLevel')}</div>
                        <div className="text-lg font-black text-emerald-400 font-mono">
                          {formatVND(boardingPass.fuelSurcharge || estimatedFare || 50000)}
                        </div>
                      </div>
                    </div>

                    {paidStatus ? (
                      <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-center space-y-2 animate-fade-in">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/30 border border-emerald-400 flex items-center justify-center mx-auto text-emerald-300">
                          <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <div className="text-sm font-black text-emerald-300 font-mono uppercase tracking-wide">
                          {t('station.fuelDone')}
                        </div>
                        <p className="text-xs text-slate-300">
                          {t('station.fuelDoneDesc')}
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* MÃ VIETQR DÀNH CHO RIDER QUÉT HOẶC LƯU ẢNH */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
                          <div className="p-3 bg-white rounded-2xl shadow-xl border border-white/20 shrink-0">
                            <img
                              src={`https://img.vietqr.io/image/MB-0938884288-compact2.png?amount=${boardingPass.fuelSurcharge || estimatedFare || 50000}&addInfo=CARMATE%20PIN%20${boardingPass.pin || '8842'}&accountName=CHU%20XE%20CARMATE`}
                              alt={t('station.vietqrAlt')}
                              className="w-36 h-36 object-contain"
                              loading="lazy"
                            />
                          </div>
                          <div className="space-y-2 text-xs font-mono w-full sm:w-auto text-left">
                            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                              <span className="text-slate-400 block text-[10px]">{t('station.bank')}</span>
                              <span className="font-bold text-white">{t('station.bankName')}</span>
                            </div>
                            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between gap-2">
                              <div>
                                <span className="text-slate-400 block text-[10px]">{t('station.driverAccount')}</span>
                                <span className="font-black text-emerald-400 text-sm tracking-wider">0938.884.288</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText('0938884288');
                                  onShowToast?.('✓ Đã sao chép số tài khoản MB Bank');
                                }}
                                className="p-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-slate-300 hover:text-white transition-all cursor-pointer"
                                title={t('station.copyAccount')}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between gap-2">
                              <div>
                                <span className="text-slate-400 block text-[10px]">{t('station.transferNote')}</span>
                                <span className="font-bold text-amber-300">CARMATE PIN {boardingPass.pin || '8842'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(`CARMATE PIN ${boardingPass.pin || '8842'}`);
                                  onShowToast?.('✓ Đã sao chép cú pháp chuyển khoản');
                                }}
                                className="p-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-slate-300 hover:text-white transition-all cursor-pointer"
                                title={t('station.copySyntax')}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPaidStatus(true);
                              onShowToast?.('✓ Đã xác nhận chuyển khoản phụ xăng!');
                            }}
                            className="h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{t('station.paidByVietqr')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPaidStatus(true);
                              onShowToast?.('✓ Đã ghi nhận: Trả tiền mặt 50.000đ khi bước xuống xe');
                            }}
                            className="h-12 rounded-2xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] text-slate-200 font-bold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                          >
                            <span>{t('station.payCash')}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 3. ⚠️ NGUYÊN TẮC TRẢ KHÁCH HÀNG XANH TRONG 10 GIÂY (CSGT & CAMERA PHẠT NGUỘI) */}
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 space-y-2 text-left">
                    <div className="font-bold font-mono uppercase tracking-wide text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{t('station.rule10sTitle')}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11.5px] pl-5">
                      {t('station.rule10s1')} <strong>{t('station.trafficCamera')}</strong>.<br />
                      {t('station.rule10s2')}<br />
                      {t('station.rule10s3')} <strong>{t('station.tenSeconds')}</strong> {t('station.rule10s4')}
                    </p>
                  </div>

                  {/* 4. NÚT XÁC NHẬN ĐÃ TỚI NƠI AN TOÀN & ĐÁNH GIÁ 5 SAO */}
                  <button
                    type="button"
                    onClick={() => setShowRiderReviewModal(true)}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-sm font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.35)] active:scale-98"
                  >
                    <span>{t('station.arrivedRate')}</span>
                  </button>

                  {/* 5. NÚT THẺ PHÁP LÝ & LIÊN LẠC AN TOÀN */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowLegalShield(true)}
                      className="h-12 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs font-mono font-bold text-amber-300 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                    >
                      <Scale className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{t('station.legalCard')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowContactModal(true)}
                      className="h-12 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-xs font-mono font-bold text-sky-300 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 shadow-[0_0_20px_rgba(14,165,233,0.15)]"
                    >
                      <MessageSquare className="w-4 h-4 text-sky-400" />
                      <span>{t('station.safeContact')}</span>
                    </button>
                  </div>

                  {/* 6. NÚT MÔ PHỎNG: ĐẢO VỀ MÀN HÌNH CHỜ ĐÓN (CHỈ HIỆN Ở DEV) */}
                  {import.meta.env.DEV && (
                    <button
                      type="button"
                      onClick={handleToggleBoardedDemo}
                      className="w-full h-11 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-mono text-slate-400 hover:text-slate-200 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('station.simBackToWaiting')}</span>
                    </button>
                  )}
                </div>
              ) : (
                /* ========================================================================= */
                /* TRẠNG THÁI 2: ĐANG ĐỨNG CHỜ TẠI TRẠM ĐÓN - MÃ PIN & RADAR TIẾP CẬN        */
                /* ========================================================================= */
                <div className="space-y-4">
                  {/* 1. MÃ PIN LÊN XE (ĐẶT Ở VỊ TRÍ ĐẬP VÀO MẮT ĐẦU TIÊN) */}
                  <div className="bg-gradient-to-b from-white/[0.08] to-white/[0.03] border-2 border-emerald-500/60 rounded-3xl p-5 text-center space-y-3 shadow-2xl">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 font-mono block">
                      {t('station.boardingPin')}
                    </span>
                    <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
                      {(boardingPass.pin || '8842').split('').map((char, i) => (
                        <span
                          key={i}
                          className="w-14 h-18 sm:w-16 sm:h-20 rounded-2xl bg-white/[0.08] border-2 border-emerald-400 text-3xl sm:text-4xl font-black font-mono text-emerald-400 flex items-center justify-center shadow-lg"
                        >
                          {char}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-amber-300 font-medium pt-0.5">
                      {hasAssignedCar
                        ? t('station.readPinToDriver')
                        : 'Mã PIN định danh của bạn tại trạm. Đọc mã này cho chủ xe khi xe tiếp cận sảnh đón.'}
                    </p>
                  </div>

                  {hasAssignedCar ? (
                    <>
                      {/* 2. TRẠNG THÁI XE TIẾP CẬN (RADAR, COUNTDOWN & DISTANCE) */}
                      <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-4 sm:p-5 space-y-3 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                            {t('station.approachStatus')}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span>{t('station.carComing')}</span>
                          </span>
                        </div>

                        <div className="space-y-2 pt-1">
                          <div className="flex items-baseline justify-between">
                            <div className="flex items-center gap-2 text-sm sm:text-base font-black text-white font-mono">
                              <span>{t('station.etaPickup')}</span>
                              <span className="text-emerald-400 text-lg sm:text-xl font-mono">
                                {formatEtaMinutesSeconds(etaSeconds)} phút
                              </span>
                            </div>
                            <span className="text-xs font-mono text-slate-300 font-bold">
                              Cách ~{dynamicDistanceKm} km
                            </span>
                          </div>

                          {/* Thanh tiến trình khoảng cách trực quan */}
                          <div className="w-full h-3 bg-white/[0.08] rounded-full overflow-hidden p-0.5 relative">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${dynamicProgressPercent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>Radar QL13 (3.5 km)</span>
                            <span className="text-emerald-400 font-bold">{t('station.hubZero')}</span>
                          </div>
                        </div>
                      </div>

                      {/* 3. THÔNG TIN PHƯƠNG TIỆN THẬT */}
                      <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-4 sm:p-5 space-y-2.5 text-left">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 block">
                          {t('station.vehicleInfo')}
                        </span>
                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                            <span className="text-slate-400">{t('station.vehicleType')}</span>
                            <span className="text-sm font-bold text-white">
                              {boardingPass.carInfo?.vehicleModel || 'Xe cá nhân gia đình'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                            <span className="text-slate-400">{t('station.plate')}</span>
                            <span className="text-base font-black text-emerald-400">
                              {boardingPass.carInfo?.plate}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                            <span className="text-slate-400">{t('station.owner')}</span>
                            <span className="text-sm font-bold text-slate-200">
                              {boardingPass.carInfo?.driverName || 'Chủ xe cá nhân'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* TRẠNG THÁI HÀNG ĐỢI TẠI TRẠM (HONEST WAITING STATE) */}
                      <div className="bg-white/[0.04] border border-amber-500/25 rounded-3xl p-4 sm:p-5 space-y-3 text-left">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                            <span>ĐANG ĐỢI CHỦ XE TIỆN CHUYẾN</span>
                          </span>
                          <span className="text-xs font-mono px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/[0.08] text-amber-300 font-bold">
                            Vị trí #{boardingPass.position || 1}
                          </span>
                        </div>

                        <p className="text-xs text-slate-200 leading-relaxed font-sans">
                          Hệ thống đang phát tín hiệu tới các chủ xe ô tô tiện chuyến chạy qua trạm <strong>{currentHub.shortName || currentHub.name}</strong>. Khi có chủ xe nhận rước, thông tin xe và biển số sẽ hiển thị tại đây.
                        </p>

                        <div className="p-3 rounded-2xl bg-black/25 border border-white/[0.06] text-xs font-mono space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Trạng thái kết nối:</span>
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 animate-spin" />
                              <span>Đang chờ chủ xe nhận đón</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Biển số & Chủ xe:</span>
                            <span className="text-slate-400 italic">Chỉ hiển thị xe thật khi đã khớp</span>
                          </div>
                        </div>
                      </div>

                      {/* PHƯƠNG ÁN DỰ PHÒNG: TUYẾN XE KHÁCH & LIMOUSINE QL13 (REQUIREMENT #3) */}
                      <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-4 sm:p-5 space-y-3 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                            <Bus className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Cần đi gấp? Xe khách & Limousine QL13</span>
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                            Dự phòng
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-300 leading-relaxed font-sans">
                          Nếu bạn cần di chuyển ngay hoặc chưa có chủ xe nhận chuyến, bạn có thể gọi trực tiếp các nhà xe đã kiểm chứng trên tuyến QL13 để kịp lịch trình:
                        </p>
                        <div className="space-y-2 pt-1">
                          {stationBackupHotlines.map((h) => (
                            <div
                              key={h.id}
                              className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-400/40 flex items-center justify-between gap-2 transition-all"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">
                                  {h.shortName || h.operator}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400 truncate">
                                  {h.frequency?.split('(')[0]?.trim() || '60 phút/chuyến'} · {h.priceRef || '150k - 250k'}
                                </p>
                              </div>
                              <a
                                href={`tel:${h.hotline?.replace(/\s+/g, '')}`}
                                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-bold font-mono flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                <span>{h.hotline}</span>
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* 4. ⚠️ QUY TẮC AN TOÀN TRẠM XĂNG / SẢNH ĐÓN */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1 text-left">
                    <div className="font-bold font-mono uppercase tracking-wide text-amber-300 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{t('station.gasSafetyTitle')}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11.5px] pl-5">
                      {t('station.gasSafety1')} <strong>{t('station.dwell4560')}</strong>.<br />
                      {t('station.gasSafety2')}
                    </p>
                  </div>

                  {/* 5. NÚT XUẤT TRÌNH THẺ PHÁP LÝ HÀNH TRÌNH CHO CSGT/TTGT (1-CHẠM) */}
                  <button
                    type="button"
                    onClick={() => setShowLegalShield(true)}
                    className="w-full h-12 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs font-mono font-bold text-amber-300 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                  >
                    <Scale className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{t('station.legalCardFull')}</span>
                  </button>

                  {/* CÁC NÚT DÀNH CHO KHI ĐÃ CÓ XE NHẬN */}
                  {hasAssignedCar && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowNoShowRescueModal(true)}
                        className="w-full h-12 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-xs font-mono font-bold text-rose-300 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                        title={t('station.reportNoShowTitle')}
                      >
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{t('station.reportNoShow')}</span>
                      </button>

                      {/* BẢO HỘ GIỜ GIẤC: CHỦ XE TRỄ > 5 PHÚT */}
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2.5 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-bold uppercase text-amber-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>{t('station.onTimeGuard')}</span>
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 font-bold">
                            Trễ: {driverLateDelayMinutes} phút
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {t('station.lateGuard1')} <strong>{t('station.cancelFree')}</strong> {t('station.lateGuard2')}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setDriverLateDelayMinutes((m) => (m >= 5 ? 0 : 6))}
                            className="h-9 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] font-mono text-slate-300 transition-all cursor-pointer"
                          >
                            {driverLateDelayMinutes >= 5 ? '↺ Đặt lại trễ' : '⏱️ Giả lập trễ > 5p'}
                          </button>
                          {driverLateDelayMinutes >= 5 ? (
                            <button
                              type="button"
                              onClick={handleGraceCancel}
                              disabled={isGraceCancelLoading}
                              className="flex-1 h-9 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-[11px] font-mono font-bold text-rose-300 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 animate-pulse"
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-400" />
                              <span>{t('station.cancelNoPenalty')}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowCoachLifebuoyModal(true)}
                              className="flex-1 h-9 px-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-[11px] font-mono font-bold text-indigo-300 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Bus className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{t('station.busSchedule')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* CÔNG CỤ MÔ PHỎNG KIỂM THỬ (CHỈ HIỆN Ở DEV) */}
                  {import.meta.env.DEV && (
                    <div className="space-y-2">
                      {!hasAssignedCar ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBoardingPass((prev) => ({
                              ...prev,
                              status: 'ARRIVING',
                              carInfo: {
                                plate: '93A - 892.14',
                                vehicleModel: 'Toyota Veloz (Bạc)',
                                driverName: 'Chủ xe Minh Tuấn (4.9★)'
                              }
                            }));
                            onShowToast?.('Mô phỏng: Chủ xe Minh Tuấn đã nhận đón!');
                          }}
                          className="w-full h-11 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                        >
                          <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Mô phỏng: Chủ xe nhận đơn (Match D1)</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleTriggerShadowFailover}
                            className="w-full h-11 rounded-2xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-xs font-mono font-bold text-indigo-300 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                            title={t('station.simSwapTitle')}
                          >
                            <RefreshCw className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span>{t('station.simSwapCar')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleToggleBoardedDemo}
                            className="w-full h-11 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                            title={t('station.simBoardTitle')}
                          >
                            <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{t('station.simBoard')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* 6. HAI NÚT HÀNH ĐỘNG DƯỚI CÙNG: [ HUỶ GIỮ CHỖ ] & [ LIÊN LẠC AN TOÀN IN-APP ] */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleCancelPass}
                      className="h-14 rounded-2xl bg-white/[0.06] hover:bg-rose-500/20 border border-white/[0.1] hover:border-rose-500/30 text-xs font-mono font-bold text-slate-300 hover:text-rose-300 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <span>{t('station.cancelTicket')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowContactModal(true)}
                      className="h-14 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-xs font-mono font-bold text-sky-300 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 shadow-[0_0_20px_rgba(14,165,233,0.15)]"
                    >
                      <MessageSquare className="w-4 h-4 text-sky-400" />
                      <span>{t('station.safeContact')}</span>
                    </button>
                  </div>

                  {/* NÚT BÁO CÁO VI PHẠM VĂN HÓA (GRIM TRIGGER 30 NGÀY) */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCultureViolationModal(true)}
                      className="w-full py-2.5 px-3 rounded-2xl bg-white/[0.03] hover:bg-rose-500/10 border border-white/[0.06] hover:border-rose-500/30 text-[11px] font-mono font-bold text-slate-400 hover:text-rose-300 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-400" />
                      <span>{t('station.reportCulture')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </main>

      {/* MODAL THẺ PHÁP LÝ HÀNH TRÌNH DÂN SỰ */}
      {showLegalShield && (
        <LegalShieldModal
          isOpen={showLegalShield}
          onClose={() => setShowLegalShield(false)}
          trip={{
            id: boardingPass?.intentId || 'BP-STATION',
            author: boardingPass?.carInfo?.driverName || 'Chủ xe cá nhân',
            licensePlate: boardingPass?.carInfo?.plate || 'Đang cập nhật',
            carModel: boardingPass?.carInfo?.vehicleModel || 'Xe cá nhân gia đình',
            from: currentHub?.name || 'Trạm đón QL13',
            to: boardingPass?.destinationName || 'Hàng Xanh',
            timeSlotLabel: 'Hôm nay (Tiện chuyến)'
          }}
          ticket={{
            code: boardingPass?.pin || '8842',
            passengerName: currentUser?.name || 'Người đi cùng',
            fuelSurcharge: boardingPass?.fuelSurcharge || estimatedFare
          }}
          userRole="rider"
        />
      )}

      {/* MODAL LIÊN LẠC AN TOÀN NỘI BỘ TẠI TRẠM (ZERO PII EXPOSURE) */}
      {showContactModal && (
        <StationContactModal
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
          boardingPass={boardingPass}
          currentHub={currentHub}
          currentUser={currentUser}
          onShowToast={onShowToast}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL XÁC THỰC NGẦM PASSWORDLESS (SMS OTP WEBOTP / TELEGRAM)              */}
      {/* ========================================================================= */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-white/[0.15] rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md space-y-5 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  {otpStep ? 'Xác thực mã SMS OTP' : 'Định danh ngầm đón xe (5 giây)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAuthModal(false);
                  setOtpStep(false);
                  setAuthError('');
                }}
                className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 rounded-lg cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {otpStep
                ? `Mã 6 chữ số đã được gửi về số điện thoại ${authPhoneInput}. Hệ thống sẽ tự động bắt mã qua WebOTP.`
                : 'Chỉ cần Số điện thoại để Chủ xe nhận diện khi xe tới đón. Thiết bị sẽ tự động ghi nhớ cho các lần đón sau (0 thao tác thừa).'}
            </p>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {!otpStep ? (
              /* BƯỚC 1: NHẬP SĐT ĐỂ GỬI SMS OTP (HOẶC VÀO GẤP) */
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
                    {t('station.nickname')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('station.namePlaceholder2')}
                    value={authNameInput}
                    onChange={(e) => setAuthNameInput(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-xs outline-none focus:border-white/20"
                  />
                </div>

                <form onSubmit={handleRequestOtp} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-mono mb-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>{t('station.mobilePhone')}</span>
                    </label>
                    <input
                      type="tel"
                      placeholder={t('station.phonePlaceholder')}
                      value={authPhoneInput}
                      onChange={(e) => setAuthPhoneInput(e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl bg-white/[0.06] border border-emerald-500/30 text-white text-sm font-bold font-mono outline-none focus:border-emerald-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full h-13 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>{authLoading ? 'ĐANG GỬI MÃ...' : 'GỬI MÃ SMS (TỰ ĐỘNG BẮT MÃ WEBOTP)'}</span>
                  </button>
                </form>

                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    onClick={handleDirectPhoneSubmit}
                    className="w-full h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>{t('station.skipOtp')}</span>
                  </button>

                  {/* TÙY CHỌN: XÁC THỰC QUA TELEGRAM */}
                  <form onSubmit={handleTelegramAuthSubmit} className="pt-2 border-t border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{t('station.orTelegram')}</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t('station.telegramPlaceholder')}
                        value={authTelegramInput}
                        onChange={(e) => setAuthTelegramInput(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-xl bg-white/[0.05] border border-sky-500/30 text-white text-xs outline-none focus:border-sky-400"
                      />
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="px-3.5 h-10 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-xs font-bold font-mono shrink-0 transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              /* BƯỚC 2: NHẬP MÃ SMS OTP HOẶC CHỜ WEBOTP TỰ BẮT MÃ (0-TOUCH) */
              <form onSubmit={(e) => { e.preventDefault(); handleVerifyOtpSubmit(); }} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 font-mono">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t('station.webOtpWaiting')}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                    {t('station.webOtpDesc')}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5 font-mono">
                    {t('station.smsCode')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full h-14 px-4 rounded-2xl bg-white/[0.08] border-2 border-emerald-400 text-white text-2xl font-black font-mono tracking-widest text-center outline-none focus:border-emerald-300 shadow-inner"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full h-13 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  <span>{authLoading ? 'ĐANG XÁC NHẬN...' : 'XÁC THỰC & VÀO HÀNG ĐỢI ĐÓN XE'}</span>
                </button>

                <div className="flex items-center justify-between pt-1 text-xs font-mono">
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={authLoading}
                    className="text-slate-400 hover:text-emerald-400 flex items-center gap-1 underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{t('station.resendCode')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(false);
                      setAuthError('');
                    }}
                    className="text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    {t('station.changePhone')}
                  </button>
                </div>
              </form>
            )}

            <p className="text-[10px] text-slate-500 text-center font-mono">
              {t('station.privacyNote')}
            </p>
          </div>
        </div>
      )}

      {/* MODAL GOM YÊU CẦU MỞ TRẠM MỚI (STATION REQUEST POOL - >50 LƯỢT ĐỀ XUẤT) */}
      {showStationRequestModal && (
        <StationRequestModal
          onClose={() => setShowStationRequestModal(false)}
          clientCoords={clientCoords}
          currentUser={currentUser}
          onShowToast={onShowToast}
        />
      )}

      {/* 🚨 MODAL CỨU HỘ TRẠM & BÁO CHỦ XE BỎ CHUYẾN (MULTI-MODAL ESCAPE) */}
      {showNoShowRescueModal && (
        <Modal
          onClose={() => setShowNoShowRescueModal(false)}
          size="lg"
          icon={AlertTriangle}
          iconTone="danger"
          title={t('station.noShowModalTitle')}
          subtitle={t('station.noShowModalSub')}
          footer={
            <div className="flex items-center justify-between gap-3 w-full">
              <Button variant="outline" onClick={() => setShowNoShowRescueModal(false)}>
                {t('station.closeAgain')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  handleCancelPass();
                  setShowNoShowRescueModal(false);
                  onShowToast?.('🎉 Đã cấp Thẻ Ưu Tiên Vàng #1! Bạn đã được giải phóng giữ chỗ để bắt xe khách/buýt.');
                }}
                className="font-bold"
              >
                <span>{t('station.confirmGolden')}</span>
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm text-[#1d1d1f] dark:text-slate-200">
            {/* TẦNG 1: THI HÀNH CÔNG LÝ TỨC THÌ */}
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1.5 text-rose-900 dark:text-rose-200">
              <strong className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{t('station.sanction1Title')}</span>
              </strong>
              <p>
                {t('station.systemConfirms')} <strong>{boardingPass?.carInfo?.plate || 'Chủ xe'}</strong> ({boardingPass?.carInfo?.driverName || 'Chủ xe'}) đã trễ hẹn không lý do chính đáng.
              </p>
              <div className="p-2 rounded-xl bg-black/10 dark:bg-black/30 font-mono text-[11px] text-rose-600 dark:text-rose-400">
                {t('station.deduct')} <strong>{t('station.minus35')}</strong> {t('station.ofDriver')}<br />
                {t('station.suspendPickup')} <strong>{t('station.sevenDays')}</strong>.
              </div>
            </div>

            {/* TẦNG 2: ĐỀN BÙ BẰNG THẺ ƯU TIÊN VÀNG */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5 text-amber-900 dark:text-amber-200">
              <strong className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 shrink-0" />
                <span>{t('station.sanction2Title')}</span>
              </strong>
              <p>
                {t('station.compensationDesc')}
              </p>
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-950 dark:text-amber-100 font-mono text-xs font-bold flex items-center justify-between">
                <span>{t('station.goldenTicket')}</span>
                <span className="text-emerald-500">{t('station.karmaPoints')}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('station.goldenNote')}
              </p>
            </div>

            {/* TẦNG 3: PHAO CỨU SINH VẬT LÝ TẠI CÂY XĂNG QL13 */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] text-xs space-y-2">
              <strong className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Bus className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{t('station.sanction3Title')}</span>
              </strong>
              <p className="text-slate-600 dark:text-slate-300">
                {t('station.youAreAt')} <strong>{currentHub.name} (Mặt tiền QL13)</strong>{t('station.stepOutDesc')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px] pt-1">
                <div className="p-2.5 rounded-xl bg-white dark:bg-black/30 border border-black/[0.06] dark:border-white/[0.06] space-y-1">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block font-mono">
                    {t('station.bus15')}
                  </span>
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('station.bus15Route')}<br />
                    {t('station.frequency')} <strong>{t('station.every1015')}</strong>{t('station.fare25k')}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-black/30 border border-black/[0.06] dark:border-white/[0.06] space-y-1">
                  <span className="font-bold text-sky-600 dark:text-sky-400 block font-mono">
                    {t('station.coach')}
                  </span>
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('station.coachBrands')}<br />
                    {t('station.coachDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 🌟 MODAL ĐÁNH GIÁ 2 CHIỀU (MUTUAL RATING HÀNH KHÁCH -> CHỦ XE) */}
      {showRiderReviewModal && (
        <MutualReviewModal
          booking={{
            partyRole: 'Khách đi cùng',
            contactName: boardingPass?.carInfo?.driverName || 'Chủ xe cá nhân',
            licensePlate: boardingPass?.carInfo?.plate || 'Đang cập nhật',
            vehicleModel: boardingPass?.carInfo?.vehicleModel || 'Xe ô tô gia đình',
            fuelSurcharge: boardingPass?.fuelSurcharge || estimatedFare || 50000,
            seats: 1
          }}
          onClose={() => {
            setShowRiderReviewModal(false);
          }}
          onSubmitReview={() => {
            setShowRiderReviewModal(false);
            try {
              localStorage.removeItem('carmate_active_station_pass');
            } catch {}
            setBoardingPass(null);
            setViewStep('CHECKIN');
            onShowToast?.('🌟 Cảm ơn bạn! Đã gửi đánh giá chuyến đi cho chủ xe.');
          }}
        />
      )}

      {/* 🚨 MODAL BÁO CÁO VI PHẠM VĂN HÓA (GRIM TRIGGER 30 NGÀY) */}
      {showCultureViolationModal && (
        <Modal
          onClose={() => setShowCultureViolationModal(false)}
          size="md"
          icon={ShieldAlert}
          iconTone="danger"
          title={t('station.reportModalTitle')}
          subtitle={t('station.reportModalSub')}
          footer={
            <div className="flex items-center justify-between gap-3 w-full">
              <Button variant="outline" onClick={() => setShowCultureViolationModal(false)}>
                {t('station.closeAgain')}
              </Button>
              <Button
                variant="danger"
                onClick={handleReportCultureViolation}
                disabled={cultureSubmitting}
                className="font-bold"
              >
                {cultureSubmitting ? 'Đang gửi...' : 'Xác Nhận Báo Cáo Vi Phạm'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm text-[#1d1d1f] dark:text-slate-200">
            <p className="text-xs text-slate-400">
              {t('station.driverLabel')} <strong>{boardingPass?.carInfo?.driverName || 'Chủ xe'}</strong> ({boardingPass?.carInfo?.plate || 'Đang cập nhật'})
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold font-mono uppercase text-slate-400 block">
                {t('station.violationLabel')}
              </label>

              {[
                {
                  id: 'SMOKING',
                  icon: Cigarette,
                  title: 'Hút thuốc lá / Vape trong xe',
                  desc: 'Chủ xe hút thuốc hoặc để người khác hút thuốc gây ám mùi không gian kín.'
                },
                {
                  id: 'PICKUP_SOLICITING',
                  icon: UserX,
                  title: 'Bắt khách dù / vẫy khách ngoài app',
                  desc: 'Dừng đỗ bắt thêm khách lạ dọc đường ngoài thỏa thuận nền tảng.'
                },
                {
                  id: 'PRICE_GOUGING',
                  icon: DollarSign,
                  title: 'Vòi vĩnh tăng giá / Đòi thêm tiền',
                  desc: 'Yêu cầu phụ thu bất hợp lý ngoài mức đóng góp chi phí đã thoả thuận trước.'
                }
              ].map((opt) => {
                const IconComponent = opt.icon;
                const isSelected = cultureViolationType === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setCultureViolationType(opt.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'bg-rose-500/15 border-rose-500/50 text-white'
                        : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] text-slate-300'
                    }`}
                  >
                    <IconComponent className={`w-5 h-5 mt-0.5 shrink-0 ${isSelected ? 'text-rose-400' : 'text-slate-400'}`} />
                    <div className="space-y-0.5 flex-1">
                      <div className="text-xs font-bold">{opt.title}</div>
                      <div className="text-[11px] text-slate-400">{opt.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400 block">
                {t('station.extraNote')}
              </label>
              <textarea
                value={cultureViolationNote}
                onChange={(e) => setCultureViolationNote(e.target.value)}
                placeholder={t('station.reportPlaceholder')}
                className="w-full h-18 p-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white placeholder-slate-500 outline-none resize-none"
              />
            </div>

            <div className="p-3 rounded-2xl bg-black/30 border border-white/[0.08] text-[11px] text-slate-400 leading-relaxed">
              ⚖️ <strong>{t('station.mathBasis')}</strong> {t('station.grimTriggerDesc')}
            </div>
          </div>
        </Modal>
      )}

      {/* 🚌 MODAL PHAO CỨU SINH: LỊCH XE KHÁCH QL13 DỰ PHÒNG */}
      {showCoachLifebuoyModal && (
        <Modal
          onClose={() => setShowCoachLifebuoyModal(false)}
          size="lg"
          icon={Bus}
          iconTone="primary"
          title={t('station.lifebuoyTitle')}
          subtitle={t('station.lifebuoySub')}
          footer={
            <div className="flex items-center justify-end w-full">
              <Button variant="outline" onClick={() => setShowCoachLifebuoyModal(false)}>
                {t('station.closeAgain')}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm text-[#1d1d1f] dark:text-slate-200">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 space-y-1">
              <strong>⛽ Vị trí đón xe hiện tại: {currentHub.name} (Mặt tiền QL13)</strong>
              <p className="text-slate-300">
                {t('station.coachScheduleDesc')}
              </p>
            </div>

            <div className="space-y-3">
              {FIXED_CORRIDOR_COACH_SCHEDULES.map((bus) => (
                <div
                  key={bus.id}
                  className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-emerald-500/40 transition-all space-y-2 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono text-xs font-black">
                        {bus.pickupTime}
                      </span>
                      <h4 className="text-xs font-bold text-white">{bus.operator}</h4>
                    </div>
                    <span className="text-xs font-mono font-black text-amber-400">
                      {bus.ticketPrice ? formatVND(bus.ticketPrice) : 'Hỏi giá tại xe'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 font-mono">
                    <div>• Đón: {bus.departureStation}</div>
                    <div>• Đến: {bus.destinationStation}</div>
                    <div>• Tần suất: {bus.frequency}</div>
                    <div>• Dự kiến tới: {bus.estimatedArrival}</div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic">
                    💡 {bus.guidance || bus.notes}
                  </p>

                  <div className="pt-1 flex items-center justify-between gap-2">
                    {/* Chỉ hiện nút gọi khi số ĐÃ được kiểm chứng. Số bịa gọi ra
                        không ai nghe còn tệ hơn nhiều so với không đưa số nào. */}
                    {hasVerifiedHotline(bus) ? (
                      <a
                        href={`tel:${String(bus.hotline).replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-mono font-bold text-emerald-300 transition-all"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Gọi Hotline: {bus.hotline}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        Vẫy xe trực tiếp tại điểm đón
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">{t('station.pickupAlongQl13')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* FOOTER BẢO CHỨNG */}
      <footer className="text-center text-[11px] text-slate-500 pt-4 border-t border-white/[0.06] max-w-lg mx-auto w-full">
        {t('station.corridorFooter')}
      </footer>
    </div>
  );
}
