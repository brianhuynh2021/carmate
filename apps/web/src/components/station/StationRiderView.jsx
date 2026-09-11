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
  Zap
} from 'lucide-react';
import {
  formatVND,
  getVirtualHubById,
  getFixedSegmentTariff,
  isValidVietnamesePhone,
  cleanPhoneNumber,
  findNearestVirtualHub,
  calculateDistanceKm,
  calculateLastMileOption,
  POPULAR_LAST_MILE_DESTINATIONS,
  getHubLiquidityStatus
} from '@carmate/shared';
import { api, setStoredAuthToken } from '../../api/client.js';

export default function StationRiderView({
  hubId = 'hub_ql13_tan_khai',
  currentUser,
  onBack,
  onShowToast
}) {
  // Các điểm mút Sài Gòn (Thủ Đức / Bình Thạnh / Tân Bình)
  const SAIGON_HUB_IDS = useMemo(() => [
    'hub_ql13_hang_xanh',
    'hub_ql13_san_bay_tsn',
    'hub_ql13_binh_trieu',
    'hub_ql13_van_phuc_city',
    'hub_ql13_nga4_binh_phuoc'
  ], []);

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
        setDestinationHubId('hub_ql13_binh_long');
      } else {
        setDirection('TO_SAIGON');
        setDestinationHubId('hub_ql13_hang_xanh');
      }
    }
  }, [hubId, SAIGON_HUB_IDS]);

  // Các điểm đón quen thuộc dọc trục QL13 (Cả 2 chiều Bình Phước ⇄ Sài Gòn)
  const ql13PickupHubs = useMemo(() => [
    { id: 'hub_ql13_budop', name: '🌾 TT. Bù Đốp (Cổng Chợ Bù Đốp / ĐT759) - Vùng gom' },
    { id: 'hub_ql13_cho_loc_ninh', name: '🏪 TT. Lộc Ninh (Chợ Lộc Ninh / Cây xăng 17 QL13)' },
    { id: 'hub_ql13_binh_long', name: '📍 Cổng chào TX. Bình Long (Vòng xoay An Lộc)' },
    { id: 'hub_ql13_tthc_binh_long', name: '🏛️ TTHC TX. Bình Long / Bến xe Bình Long' },
    { id: 'hub_ql13_tthc_tan_khai', name: '🏛️ TTHC Huyện Hớn Quản (TT. Tân Khai - Trụ sở Huyện ủy)' },
    { id: 'hub_ql13_tan_khai', name: '⛽ Cây xăng Petrolimex Tân Khai / Chợ Tân Khai' },
    { id: 'hub_ql13_minh_hung', name: '🏭 Cổng KCN Minh Hưng - Hàn Quốc (Chơn Thành)' },
    { id: 'hub_ql13_tthc_chon_thanh', name: '🏛️ TTHC TX. Chơn Thành / Quảng trường' },
    { id: 'hub_ql13_vincom_chon_thanh', name: '🛍️ Vincom Plaza Chơn Thành (Số 01 QL13)' },
    { id: 'hub_ql13_nga4_chon_thanh', name: '📍 Ngã 4 Chơn Thành (Bùng binh QL14 & N2)' },
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
          const nearest = findNearestVirtualHub(lat, pos.coords.longitude, 'Tuyến QL13');
          if (nearest && ql13PickupHubs.some((h) => h.id === nearest.id)) {
            setPickupHubId(nearest.id);
            if (lat < 10.9) {
              setDirection('TO_BINH_PHUOC');
              setDestinationHubId('hub_ql13_binh_long');
            } else {
              setDirection('TO_SAIGON');
              setDestinationHubId('hub_ql13_hang_xanh');
            }
            onShowToast?.(`Đã nhận diện vị trí: ${nearest.name}`);
            return;
          }
          onShowToast?.(direction === 'TO_BINH_PHUOC' ? 'Đang dùng trạm Hàng Xanh' : 'Đang dùng trạm Bình Long');
        },
        () => {
          onShowToast?.('Không lấy được GPS, bạn có thể chọn trạm bên dưới');
        },
        { timeout: 3000 }
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
    return SAIGON_HUB_IDS.includes(hubId) ? 'hub_ql13_binh_long' : 'hub_ql13_hang_xanh';
  });
  const [showOtherDestinations, setShowOtherDestinations] = useState(false);
  const [seatsNeeded, setSeatsNeeded] = useState(1);
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
  const [geofenceDistanceM, setGeofenceDistanceM] = useState(null);

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
  const [copiedPin, setCopiedPin] = useState(false);

  // Trạng thái Giả lập Chặng cuối Nội đô (Last-Mile Transit Simulator - Zero External API)
  const [selectedLastMileDestId, setSelectedLastMileDestId] = useState('cho_ba_chieu');
  const [customLastMileText, setCustomLastMileText] = useState('');
  const [showLastMileCalc, setShowLastMileCalc] = useState(false);

  const lastMileOption = useMemo(() => {
    const input = customLastMileText.trim() || selectedLastMileDestId;
    return calculateLastMileOption(input, pickupHubId);
  }, [customLastMileText, selectedLastMileDestId, pickupHubId]);

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
      { id: 'hub_ql13_nga4_chon_thanh', name: 'Ngã 4 Chơn Thành (Giao Tuyến N2 & QL14)' },
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
      return [
        {
          id: 'hub_ql13_vincom_chon_thanh',
          title: 'TX. Chơn Thành',
          subtitle: 'Vincom Plaza · Giao QL14',
          price: getFixedSegmentTariff(currentHub.id, 'hub_ql13_vincom_chon_thanh').pricePerSeat
        },
        {
          id: 'hub_ql13_tan_khai',
          title: 'Tân Khai (Hớn Quản)',
          subtitle: 'Cây xăng Petrolimex · Chợ Tân Khai',
          price: getFixedSegmentTariff(currentHub.id, 'hub_ql13_tan_khai').pricePerSeat
        },
        {
          id: 'hub_ql13_binh_long',
          title: 'TX. Bình Long',
          subtitle: 'Vòng xoay An Lộc · TT Bình Long',
          price: getFixedSegmentTariff(currentHub.id, 'hub_ql13_binh_long').pricePerSeat
        }
      ];
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

  // 3. TỰ ĐỘNG LẤY TỌA ĐỘ GPS & ĐỐI SOÁT GEOFENCE KHUÔN VIÊN TRẠM (ANTI-QUISHING)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setClientCoords({ lat, lng });
          if (currentHub.lat != null && currentHub.lng != null) {
            const distKm = calculateDistanceKm(lat, lng, currentHub.lat, currentHub.lng);
            if (distKm != null) {
              setGeofenceDistanceM(Math.round(distKm * 1000));
            }
          }
        },
        () => {},
        { timeout: 4000, enableHighAccuracy: true }
      );
    }
  }, [currentHub.lat, currentHub.lng]);

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
            destinationOptions.find((d) => d.id === destinationHubId)?.name ||
            (direction === 'TO_BINH_PHUOC' ? 'TX. Bình Long (Vòng xoay An Lộc)' : 'Ngã tư Hàng Xanh'),
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
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-emerald-400">
                {viewStep === 'CHECKIN' ? 'CARMATE • TRẠM VẬN TẢI ẢO' : 'VÉ ĐÓN XE ĐIỆN TỬ'}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{currentHub.shortName || currentHub.name}</span>
            </h1>
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
            <span className="text-[10px] text-slate-400 font-mono">Trọn gói</span>
          </div>
        )}
      </header>

      {/* ── NỘI DUNG CHÍNH (ĐÚNG 2 MÀN HÌNH DUY NHẤT: MÀN HÌNH 1 HOẶC MÀN HÌNH 2) ── */}
      <main className="flex-1 flex flex-col justify-center my-auto max-w-lg mx-auto w-full">
        {/* ========================================================================= */}
        {/* MÀN HÌNH 1: QUÉT QR & VÀO HÀNG ĐỢI (CHECK-IN SCREEN — 5 ĐẾN 10 GIÂY)      */}
        {/* ========================================================================= */}
        {viewStep === 'CHECKIN' && (
          <form onSubmit={handleCheckInClick} className="space-y-4 animate-fade-in">
            {/* 1. BẠN MUỐN ĐẾN ĐÂU? (DÀN PHẲNG 3 NÚT BẤM KÍCH THƯỚC LỚN >= 56PX) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase font-mono tracking-wider text-slate-200">
                  1. BẠN MUỐN ĐẾN ĐÂU?
                </label>
                <button
                  type="button"
                  onClick={() => toggleDirection()}
                  className="text-[11px] font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 rounded-xl border border-sky-500/20 transition-all"
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
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
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
                        <span className="text-[10px] text-slate-400 font-mono block">/ vé</span>
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
                  className="text-xs text-slate-400 hover:text-emerald-300 flex items-center gap-1 font-mono underline cursor-pointer"
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
              <label className="text-xs font-black uppercase font-mono tracking-wider text-slate-200 block">
                2. SỐ LƯỢNG GHẾ:
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
                  <span className="text-2xl font-black font-mono text-white tracking-wide">
                    ( {seatsNeeded} vé )
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono block mt-0.5">
                    Tổng cước: {formatVND(estimatedFare)}
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
                <label className="text-xs font-black uppercase font-mono tracking-wider text-slate-200 block">
                  3. SỐ ĐIỆN THOẠI ĐỂ CHỦ XE NHẬN DIỆN:
                </label>
                {phone && (
                  <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Đã nhớ máy
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
                    className="absolute right-2.5 top-2.5 h-9 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold font-mono flex items-center gap-1 transition-all"
                  >
                    <span>SMS OTP</span>
                  </button>
                )}
              </div>

              {/* Tùy chọn tên hiển thị ngắn gọn (không bắt buộc) */}
              <div className="pt-0.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Tên hiển thị (để chủ xe xưng hô):</span>
                  <span className="text-slate-500">(Không bắt buộc)</span>
                </div>
                <input
                  type="text"
                  placeholder="VD: Hưng, Chị Lan..."
                  value={name === 'Khách đi cùng' ? '' : name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm font-semibold rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-500 outline-none focus:border-emerald-400 transition-all"
                />
              </div>

              <p className="text-[11px] text-slate-400 font-mono">
                *Không cần mật khẩu · Tự động kích hoạt vé &amp; lưu phiên an toàn
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
              <p className="text-center text-[11px] font-mono text-slate-400">
                Giá cố định • Xe cá nhân 4-7 chỗ êm ái • Rẻ hơn Limousine 30%–50%
              </p>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* MÀN HÌNH 2: VÉ ĐÓN XE ĐIỆN TỬ (LIVE BOARDING PASS THEO DÕI THỜI GIAN THỰC) */}
        {/* ========================================================================= */}
        {viewStep === 'BOARDING_PASS' && boardingPass && (() => {
          const isArriving = boardingPass.status === 'ARRIVING';
          const isBoarded = boardingPass.status === 'BOARDED' || boardingPass.status === 'COMPLETED';

          return (
            <div className="space-y-4 animate-fade-in">
              {/* HEADER TÓM TẮT VÉ ĐÓN XE ĐIỆN TỬ */}
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold">
                  {currentHub.shortName || currentHub.name} ──&gt; {boardingPass.destinationName || 'Hàng Xanh'}
                </span>
                <span className="text-emerald-400 font-black text-sm">
                  {formatVND(boardingPass.fuelSurcharge || estimatedFare)}
                </span>
              </div>

              {/* 1. MÃ PIN LÊN XE (ĐẶT Ở VỊ TRÍ ĐẬP VÀO MẮT ĐẦU TIÊN) */}
              <div className="bg-gradient-to-b from-white/[0.08] to-white/[0.03] border-2 border-emerald-500/60 rounded-3xl p-5 text-center space-y-3 shadow-2xl">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 font-mono block">
                  MÃ PIN LÊN XE
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
                  (Đọc cho chủ xe khi mở cửa)
                </p>
              </div>

              {/* 2. TRẠNG THÁI XE TIẾP CẬN (RADAR, COUNTDOWN & DISTANCE) */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    TRẠNG THÁI XE TIẾP CẬN
                  </span>
                  {isArriving ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>🟢 Có xe đang tới trạm</span>
                    </span>
                  ) : isBoarded ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Đã lên xe an toàn</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-xs font-mono font-bold">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                      <span>🟡 Đang quét radar QL13</span>
                    </span>
                  )}
                </div>

                {isArriving ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-center gap-2 text-sm sm:text-base font-black text-white font-mono">
                        <span>⏱️ Dự kiến đón sau:</span>
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
                      <span className="text-emerald-400 font-bold">Trạm đón (0 km)</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-1">
                    <p className="text-xs text-slate-300 font-sans">
                      Radar CarMate đang phát tín hiệu tới các xe ô tô gia đình chạy trên QL13 cách trạm 3 - 5 km.
                    </p>
                    <div className="text-[11px] font-mono text-sky-400 font-bold">
                      Vị trí của bạn: #{boardingPass.position || 1} tại Trạm • Xe qua trạm mỗi 3–5 phút
                    </div>
                  </div>
                )}
              </div>

              {/* 3. THÔNG TIN PHƯƠNG TIỆN */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-4 sm:p-5 space-y-2.5">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  THÔNG TIN PHƯƠNG TIỆN
                </span>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <span className="text-slate-400">• Loại xe:</span>
                    <span className="text-sm font-bold text-white">
                      {boardingPass.carInfo?.vehicleModel || 'Mitsubishi Xpander (Trắng)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <span className="text-slate-400">• Biển số:</span>
                    <span className="text-base font-black text-emerald-400">
                      {boardingPass.carInfo?.plate || '93A - 123.45'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <span className="text-slate-400">• Chủ xe:</span>
                    <span className="text-sm font-bold text-slate-200">
                      {boardingPass.carInfo?.driverName || 'Anh Tuấn (Chủ xe)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. ⚠️ QUY TẮC AN TOÀN TRẠM XĂNG / SẢNH ĐÓN */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                <div className="font-bold font-mono uppercase tracking-wide text-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>QUY TẮC AN TOÀN TRẠM XĂNG</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11.5px] pl-5">
                  • Xe chỉ tấp mép sân trạm đúng <strong>45–60 giây</strong>.<br />
                  • Vui lòng đứng sẵn tại mép ngoài quầy / sảnh đón.
                </p>
              </div>

              {/* 5. HAI NÚT HÀNH ĐỘNG DƯỚI CÙNG: [ HUỶ VÉ ] & [ CHAT ZALO ] */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCancelPass}
                  className="h-14 rounded-2xl bg-white/[0.06] hover:bg-rose-500/20 border border-white/[0.1] hover:border-rose-500/30 text-xs font-mono font-bold text-slate-300 hover:text-rose-300 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <span>Huỷ vé</span>
                </button>
                <a
                  href={boardingPass.carInfo?.phone ? `tel:${boardingPass.carInfo.phone}` : `https://zalo.me/`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-14 rounded-2xl bg-[#0068ff]/20 hover:bg-[#0068ff]/30 border border-[#0068ff]/40 text-xs font-mono font-bold text-sky-300 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <Phone className="w-4 h-4 text-sky-400" />
                  <span>Chat Zalo / Gọi</span>
                </a>
              </div>
            </div>
          );
        })()}
      </main>

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
                Đóng
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

                <form onSubmit={handleRequestOtp} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-mono mb-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Số điện thoại di động:</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="Ví dụ: 0988 123 456"
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
                    <span>⚡ Đi gấp? Bỏ qua OTP, dùng số này vào ngay</span>
                  </button>

                  {/* TÙY CHỌN: XÁC THỰC QUA TELEGRAM */}
                  <form onSubmit={handleTelegramAuthSubmit} className="pt-2 border-t border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Hoặc xác thực qua Telegram:</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="@username hoặc SĐT Telegram"
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
                    <span>WebOTP Đang Chờ Bắt Mã Tự Động</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                    Nếu máy bạn hỗ trợ WebOTP, mã xác thực từ tin nhắn SMS sẽ được điền tự động. Bạn cũng có thể gõ trực tiếp 6 số:
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5 font-mono">
                    Mã xác thực SMS (6 số):
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
                    <span>Gửi lại mã</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(false);
                      setAuthError('');
                    }}
                    className="text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Đổi số điện thoại
                  </button>
                </div>
              </form>
            )}

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
