import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Volume2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Zap,
  Radio,
  ChevronLeft,
  ShieldCheck,
  Scale,
  Car,
  Clock,
  Sparkles,
  Calendar,
  MapPin,
  Users,
  QrCode,
  AlertCircle
} from 'lucide-react';
import { formatVND } from '@carmate/shared';
import { api } from '../../api/client.js';
import LegalShieldModal from '../modals/LegalShieldModal.jsx';
import DriverScheduleCardView from './DriverScheduleCardView.jsx';
import MutualReviewModal from '../modals/MutualReviewModal.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

const QUICK_CAR_MODELS = [
  'Xpander Trắng',
  'Vios Đen',
  'Accent Bạc',
  'Veloz Đỏ',
  'Innova Bạc',
  'Carnival Trắng'
];

export default function CockpitMode({
  tripId = 'TRIP-MY-COCKPIT',
  initialCorridor = 'Tuyến QL13',
  currentUser = null,
  onBack,
  onShowToast
}) {
  // Cấu hình xe chia sẻ (Lấy từ Garage hoặc bộ nhớ máy, không bắt chính chủ)
  const [vehicle, setVehicle] = useState(() => {
    try {
      const saved = localStorage.getItem('carmate_cockpit_vehicle');
      if (saved) return JSON.parse(saved);
    } catch {}
    if (currentUser?.vehicle?.plate) {
      return {
        plate: currentUser.vehicle.plate,
        model: `${currentUser.vehicle.brand || ''} ${currentUser.vehicle.model || ''} - Màu ${currentUser.vehicle.color || 'Trắng'}`.trim(),
        seats: currentUser.vehicle.capacity ? Math.min(4, currentUser.vehicle.capacity - 1) : 2,
        status: currentUser.vehicle.status || (currentUser.isDriverVerified ? 'VERIFIED' : 'PENDING'),
        photos: currentUser.vehicle.photos || [],
        amenities: currentUser.vehicle.amenities || ['ac', 'no_smoking']
      };
    }
    return null;
  });

  // State form nhập liệu nhanh 10 giây nếu chưa có xe hoặc khi bấm [Đổi xe]
  const [inputPlate, setInputPlate] = useState(() => vehicle?.plate || currentUser?.vehicle?.plate || '');
  const [inputModel, setInputModel] = useState(() => {
    if (vehicle?.model) return vehicle.model;
    if (currentUser?.vehicle?.brand || currentUser?.vehicle?.model) {
      return `${currentUser.vehicle.brand || ''} ${currentUser.vehicle.model || ''} - Màu ${currentUser.vehicle.color || 'Trắng'}`.trim();
    }
    return '';
  });
  const [inputSeats, setInputSeats] = useState(() => vehicle?.seats || 2);
  const [inputAmenities, setInputAmenities] = useState(() => vehicle?.amenities || ['ac', 'no_smoking']);
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);

  // Cảm biến gia tốc phần cứng chống giả lập GPS (Anti-Spoofing Hardware Sensor)
  const [hasHardwareMotion, setHasHardwareMotion] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      const handleMotion = (event) => {
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (acc && (Math.abs(acc.x || 0) > 0.05 || Math.abs(acc.y || 0) > 0.05 || Math.abs(acc.z || 0) > 0.05)) {
          setHasHardwareMotion(true);
        }
      };
      window.addEventListener('devicemotion', handleMotion, { once: true });
      return () => window.removeEventListener('devicemotion', handleMotion);
    }
  }, []);

  // Trạng thái chung của Cockpit Taplo
  const [isReceivingGuests, setIsReceivingGuests] = useState(true);
  const [seatsAvailable, setSeatsAvailable] = useState(2);
  const [speed] = useState(78);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [boardedCount, setBoardedCount] = useState(0);
  const [showLegalShield, setShowLegalShield] = useState(false);

  // Chuyển đổi giữa [ 📅 LỊCH TRÌNH CỦA BẠN ] và [ ⚡ BUỒNG LÁI RADAR QL13 ]
  const [activeCockpitTab, setActiveCockpitTab] = useState('SCHEDULE');

  // Trạng thái chu trình: 'STANDBY' (D1) | 'OFFERING' (D2) | 'DWELLING' (D3) | 'CRUISING' (D3.5 Hành trình) | 'DROPOFF' (D4 Trả khách)
  const [cockpitState, setCockpitState] = useState('STANDBY');
  const [activeOffer, setActiveOffer] = useState(null);
  const [offerCountdown, setOfferCountdown] = useState(30);

  // Màn hình D3: Docking Sân Trạm
  const [dockingCountdown, setDockingCountdown] = useState(60);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [currentRider, setCurrentRider] = useState(null);
  const [showMutualRating, setShowMutualRating] = useState(false);

  // Cơ chế xác thực Khách vắng mặt (Dual Geofence & Dwell Time Invariant)
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [absentSimGpsStatus, setAbsentSimGpsStatus] = useState('FAR'); // 'FAR' (ở xa) | 'NEAR' (ở trạm)

  // Giả lập khoảng cách tiếp cận trạm (km)
  const [simDistanceKm, setSimDistanceKm] = useState(6.2);

  // 1. SCREEN WAKE LOCK API (Giữ màn hình luôn sáng trên giá đỡ Taplo)
  useEffect(() => {
    let wakeLock = null;
    const requestLock = async () => {
      if ('wakeLock' in navigator && isReceivingGuests) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
          console.warn('[Cockpit] WakeLock error:', err);
        }
      }
    };
    requestLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isReceivingGuests) {
        requestLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [isReceivingGuests]);

  // 2. PHÁT ÂM CHUÔNG & GIỌNG ĐỌC TTS TIẾNG VIỆT QUA LOA Ô TÔ
  const playAudioChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      console.warn('[AudioContext] chime error:', e);
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('[SpeechSynthesis] error:', e);
      }
    }
  };

  // CHỦ XE BẤM [BỎ QUA] (D2 REJECT)
  const handleRejectOffer = useCallback(async () => {
    if (activeOffer) {
      try {
        await api.fetchJson('/cockpit/reject-offer', {
          method: 'POST',
          body: JSON.stringify({ tripId, intentId: activeOffer.intentId })
        });
      } catch {}
    }
    setActiveOffer(null);
    setCockpitState('STANDBY');
    setSimDistanceKm(6.2);
    onShowToast?.('Đã bỏ qua yêu cầu.');
  }, [activeOffer, onShowToast, tripId]);

  // 3. ĐẾM LÙI MÀN HÌNH D2: 30 GIÂY CHẤP NHẬN CUỐC
  useEffect(() => {
    let timer = null;
    if (cockpitState === 'OFFERING' && offerCountdown > 0) {
      timer = setInterval(() => {
        setOfferCountdown((prev) => {
          if (prev <= 1) {
            handleRejectOffer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cockpitState, offerCountdown, handleRejectOffer]);

  // 4. ĐẾM LÙI MÀN HÌNH D3: 60 GIÂY HẠN DỪNG TẠI SÂN TRẠM
  useEffect(() => {
    let timer = null;
    if (cockpitState === 'DWELLING' && dockingCountdown > 0) {
      timer = setInterval(() => {
        setDockingCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cockpitState, dockingCountdown]);

  // 5. KÍCH HOẠT RADAR TIẾP CẬN 3.5KM
  const triggerApproachRadar = (offerData) => {
    const offer = offerData || {
      intentId: 'ST-RIDER-DEMO-1',
      stationId: 'hub_ql13_tan_khai',
      stationName: 'Cây xăng Petrolimex Tân Khai',
      stationShortName: 'Petrolimex Tân Khai',
      distanceKm: 3.4,
      ttaSeconds: 150,
      riderCount: 2,
      destinationName: 'Ngã tư Hàng Xanh',
      fuelSurcharge: 300000,
      driverPayout: 270000,
      pin: '8842'
    };

    setActiveOffer(offer);
    setOfferCountdown(30);
    setCockpitState('OFFERING');
    setSimDistanceKm(3.4);

    // Bật chuông và giọng đọc
    playAudioChime();
    const payoutText = `${Math.round((offer.driverPayout || 270000) / 1000)} ngàn`;
    speakText(`Trạm Tân Khai có ${offer.riderCount} khách đi Hàng Xanh, bù xăng ${payoutText}`);
  };

  // 6. QUÉT TỰ ĐỘNG KHÁCH ĐANG CHỜ TẠI TRẠM (AUTO-SCANNING SENTINEL)
  useEffect(() => {
    if (cockpitState !== 'STANDBY' || !isReceivingGuests) return;
    const interval = setInterval(() => {
      try {
        const savedPassRaw = localStorage.getItem('carmate_active_station_pass');
        if (savedPassRaw) {
          const parsed = JSON.parse(savedPassRaw);
          if (parsed?.pass && parsed?.pass?.status === 'ARRIVING' && !activeOffer) {
            triggerApproachRadar({
              intentId: parsed.pass.intentId,
              stationId: parsed.hubId || 'hub_ql13_tan_khai',
              stationName: parsed.pass.hubName || 'Cây xăng Petrolimex Tân Khai',
              stationShortName: parsed.pass.hubName || 'Petrolimex Tân Khai',
              distanceKm: 3.2,
              ttaSeconds: 140,
              riderCount: parsed.pass.seatsNeeded || 1,
              destinationName: parsed.pass.destinationName || 'Hàng Xanh',
              fuelSurcharge: parsed.pass.fuelSurcharge || 250000,
              driverPayout: parsed.pass.driverPayout || 225000,
              pin: parsed.pass.pin || '8842'
            });
          }
        }
      } catch {}
    }, 2500);
    return () => clearInterval(interval);
  }, [cockpitState, isReceivingGuests, activeOffer]);

  // CHỦ XE BẤM [ĐỒNG Ý ĐÓN] (D2 ACCEPT)
  const handleAcceptOffer = async () => {
    if (!activeOffer) return;
    try {
      await api.fetchJson('/cockpit/accept-offer', {
        method: 'POST',
        body: JSON.stringify({ tripId, intentId: activeOffer.intentId })
      });
    } catch {}

    setCurrentRider({
      intentId: activeOffer.intentId,
      name: 'Khách đi cùng',
      seatsNeeded: activeOffer.riderCount,
      destinationName: activeOffer.destinationName,
      fuelSurcharge: activeOffer.fuelSurcharge,
      pin: activeOffer.pin || '8842'
    });

    setCockpitState('DWELLING');
    setDockingCountdown(60);
    setPinDigits(['', '', '', '']);
    setPinError('');
    onShowToast?.('Đã đồng ý đón. Vui lòng rà phanh tấp vào sân cây xăng.');
    speakText('Đã nhận khách, vui lòng tấp vào sân cây xăng và hỏi mã 4 số');
  };

  // XÁC THỰC MÃ PIN 4 SỐ (D3 PIN VERIFY)
  const handleVerifyPin = async () => {
    const fullPin = pinDigits.join('').trim();
    if (fullPin.length < 4) {
      setPinError('Vui lòng nhập đủ 4 chữ số khách đọc');
      return;
    }

    try {
      const res = await api.fetchJson('/cockpit/verify-pin', {
        method: 'POST',
        body: JSON.stringify({
          tripId,
          intentId: currentRider?.intentId,
          pin: fullPin
        })
      });

      if (res?.success) {
        playAudioChime();
        setTotalEarnings((prev) => prev + (currentRider?.fuelSurcharge || 240000));
        setBoardedCount((prev) => prev + (currentRider?.seatsNeeded || 2));
        setSeatsAvailable((prev) => Math.max(0, prev - (currentRider?.seatsNeeded || 2)));
        setCockpitState('CRUISING');
        setSimDistanceKm(42.5);
        setActiveOffer(null);

        // Đồng bộ trạng thái khách lên xe (BOARDED) qua localStorage
        try {
          const savedPassRaw = localStorage.getItem('carmate_active_station_pass');
          if (savedPassRaw) {
            const parsed = JSON.parse(savedPassRaw);
            if (parsed && parsed.pass) {
              parsed.pass.status = 'BOARDED';
              localStorage.setItem('carmate_active_station_pass', JSON.stringify(parsed));
            }
          }
        } catch {}

        onShowToast?.('✓ Khớp mã PIN thành công! Đang chuyển bánh trên Quốc lộ 13.');
        speakText('Xác thực thành công. Mời khách thắt dây an toàn. Tiếp tục hành trình theo Quốc lộ 13.');
      } else {
        setPinError(res?.error || 'Mã PIN không khớp. Vui lòng hỏi lại khách.');
      }
    } catch {
      // Fallback local verification
      if (currentRider?.pin && fullPin !== currentRider.pin) {
        setPinError(`Mã PIN không đúng (bạn nhập ${fullPin}). Vui lòng hỏi lại khách.`);
        return;
      }
      playAudioChime();
      setTotalEarnings((prev) => prev + (currentRider?.fuelSurcharge || 240000));
      setBoardedCount((prev) => prev + (currentRider?.seatsNeeded || 2));
      setSeatsAvailable((prev) => Math.max(0, prev - (currentRider?.seatsNeeded || 2)));
      setCockpitState('CRUISING');
      setSimDistanceKm(42.5);
      setActiveOffer(null);

      // Đồng bộ trạng thái khách lên xe (BOARDED) qua localStorage
      try {
        const savedPassRaw = localStorage.getItem('carmate_active_station_pass');
        if (savedPassRaw) {
          const parsed = JSON.parse(savedPassRaw);
          if (parsed && parsed.pass) {
            parsed.pass.status = 'BOARDED';
            localStorage.setItem('carmate_active_station_pass', JSON.stringify(parsed));
          }
        }
      } catch {}

      onShowToast?.('✓ Khớp mã thành công! Mời khách lên xe.');
      speakText('Xác thực thành công. Mời khách thắt dây an toàn. Tiếp tục hành trình theo Quốc lộ 13.');
    }
  };

  const handleToggleAmenity = (amenityKey) => {
    setInputAmenities((prev) =>
      prev.includes(amenityKey) ? prev.filter((a) => a !== amenityKey) : [...prev, amenityKey]
    );
  };

  // LƯU CẤU HÌNH XE NHANH 10S -> GỬI DUYỆT PENDING VÀ BẮN WEBHOOK TELEGRAM
  const handleSaveQuickVehicle = async (e) => {
    e?.preventDefault();
    const cleanPlate = inputPlate.trim().toUpperCase();
    const cleanModel = inputModel.trim();
    if (!cleanPlate || !cleanModel) {
      onShowToast?.('Vui lòng nhập biển số xe và hiệu xe');
      return;
    }

    setIsSubmittingVehicle(true);
    const newVehicle = {
      plate: cleanPlate,
      model: cleanModel,
      seats: inputSeats,
      amenities: inputAmenities,
      status: 'PENDING',
      registeredAt: new Date().toISOString()
    };

    try {
      localStorage.setItem('carmate_cockpit_vehicle', JSON.stringify(newVehicle));
    } catch {}

    setVehicle(newVehicle);
    setIsEditingVehicle(false);

    try {
      await api.cockpitRegisterVehicle({
        plate: cleanPlate,
        model: cleanModel,
        seats: inputSeats,
        amenities: inputAmenities,
        phone: currentUser?.phone,
        name: currentUser?.name,
        userId: currentUser?.id
      });
      onShowToast?.('Đã gửi hồ sơ! Chờ hệ thống kích hoạt dưới 5 phút.');
      playAudioChime();
    } catch (err) {
      console.warn('[CockpitMode] Lỗi gửi đăng ký xe:', err);
      onShowToast?.('Đã lưu hồ sơ cục bộ, đang chờ duyệt kích hoạt...');
    } finally {
      setIsSubmittingVehicle(false);
    }
  };

  // NÚT MÔ PHỎNG SOLO FOUNDER DUYỆT NGAY (DEV DEMO 1-CHẠM)
  const handleSimulateFounderApprove = async () => {
    try {
      await api.cockpitApproveVehicle({
        userId: currentUser?.id,
        phone: currentUser?.phone,
        plate: vehicle?.plate || inputPlate
      });
    } catch (err) {
      console.warn('[handleSimulateFounderApprove] error:', err);
    }

    const verified = {
      ...(vehicle || {
        plate: inputPlate || '93A-541.86',
        model: inputModel || 'Mitsubishi Xpander - Trắng',
        seats: inputSeats || 3,
        amenities: inputAmenities
      }),
      status: 'VERIFIED'
    };

    try {
      localStorage.setItem('carmate_cockpit_vehicle', JSON.stringify(verified));
    } catch {}

    setVehicle(verified);
    setSeatsAvailable(verified.seats || inputSeats || 2);
    playAudioChime();
    speakText('Hồ sơ xe đã được kích hoạt thành công! Chào mừng chủ xe vào buồng lái Taplo CarMate.');
    onShowToast?.('🎉 Hồ sơ đã được kích hoạt! Sẵn sàng đón khách dọc QL13.');
  };

  // AUTO-POLLING LẮNG NGHE TRẠNG THÁI DUYỆT TỪ SERVER (MỖI 3 GIÂY)
  useEffect(() => {
    if (!vehicle || vehicle.status === 'VERIFIED') return;

    let pollInterval = null;
    const checkStatus = async () => {
      try {
        const queryId = currentUser?.id || currentUser?.phone || vehicle.plate;
        const res = await api.cockpitVehicleStatus({ userId: queryId });
        if (res?.vehicleStatus === 'VERIFIED' || res?.isDriverVerified) {
          const updated = { ...vehicle, status: 'VERIFIED' };
          setVehicle(updated);
          setSeatsAvailable(updated.seats || inputSeats || 2);
          try {
            localStorage.setItem('carmate_cockpit_vehicle', JSON.stringify(updated));
          } catch {}
          playAudioChime();
          speakText('Hồ sơ xe đã được kích hoạt! Sẵn sàng đón khách.');
          onShowToast?.('🎉 Hồ sơ xe đã được phê duyệt! Chúc chuyến đi thượng lộ bình an.');
        }
      } catch (err) {
        // bỏ qua lỗi polling mạng tạm thời
      }
    };

    pollInterval = setInterval(checkStatus, 3000);
    return () => clearInterval(pollInterval);
  }, [vehicle, currentUser, inputSeats, onShowToast]);

  // =========================================================================
  // VIEW 1: BẢNG NHẬP LIỆU XE 10 GIÂY (NẾU CHƯA CÓ XE HOẶC BẤM [ĐỔI XE])
  // =========================================================================
  if (!vehicle || isEditingVehicle) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between select-none p-4 sm:p-6 font-sans">
        <header className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4 max-w-lg mx-auto w-full">
          <button
            type="button"
            onClick={() => {
              if (isEditingVehicle && vehicle) {
                setIsEditingVehicle(false);
              } else {
                onBack();
              }
            }}
            className="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center border border-white/[0.08] transition-all cursor-pointer"
            title="Quay lại"
          >
            <ChevronLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div className="text-right">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/30">
              SETUP 10 GIÂY
            </span>
          </div>
        </header>

        <main className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full space-y-4 my-auto animate-fade-in pb-4">
          <div className="text-center space-y-1">
            <div className="w-13 h-13 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl">
              <Car className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide">
              Thông Tin Xe Chia Sẻ
            </h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Để người đi cùng nhận diện đúng xe tại các trạm đón dọc Quốc lộ 13.
            </p>
          </div>

          <form onSubmit={handleSaveQuickVehicle} className="p-5 sm:p-6 rounded-3xl bg-white/[0.04] border border-white/[0.08] space-y-4 shadow-xl">
            {/* 1. Biển số xe */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-1.5 flex items-center justify-between">
                <span>1. Biển số xe:</span>
                <span className="text-[10px] text-slate-500 lowercase font-normal">VD: 93A-541.86, 61K-892.41</span>
              </label>
              <input
                type="text"
                value={inputPlate}
                onChange={(e) => setInputPlate(e.target.value.toUpperCase())}
                placeholder="VD: 93A - 541.86"
                maxLength={14}
                required
                className="w-full h-12 px-4 rounded-2xl bg-white/[0.06] border border-white/[0.12] text-sm font-mono font-bold tracking-wider text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 outline-none uppercase transition-all"
              />
            </div>

            {/* 2. Hiệu xe & Màu sắc + Quick Chips */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-1.5 flex items-center justify-between">
                <span>2. Hiệu xe & Màu sắc:</span>
                <span className="text-[10px] text-slate-500 lowercase font-normal">VD: Xpander Trắng, Vios Đen</span>
              </label>
              <input
                type="text"
                value={inputModel}
                onChange={(e) => setInputModel(e.target.value)}
                placeholder="VD: Mitsubishi Xpander - Trắng"
                required
                className="w-full h-12 px-4 rounded-2xl bg-white/[0.06] border border-white/[0.12] text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 outline-none transition-all"
              />
              {/* Quick Chips 1-Chạm */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {QUICK_CAR_MODELS.map((modelPreset) => (
                  <button
                    key={modelPreset}
                    type="button"
                    onClick={() => setInputModel(modelPreset)}
                    className="px-2.5 py-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-[11px] text-slate-300 border border-white/[0.08] cursor-pointer transition-all active:scale-95"
                  >
                    + {modelPreset}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Số ghế chia sẻ tối đa */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-1.5 flex items-center justify-between">
                <span>3. Số ghế chia sẻ tối đa:</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">{inputSeats} ghế trống</span>
              </label>
              <div className="flex items-center justify-between p-2 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setInputSeats((prev) => Math.max(1, prev - 1))}
                  className="w-11 h-11 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 text-lg font-mono font-bold text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  -
                </button>
                <div className="text-center">
                  <span className="text-2xl font-black font-mono text-emerald-400">{inputSeats}</span>
                  <span className="text-[11px] text-slate-400 block font-mono">ghế khách</span>
                </div>
                <button
                  type="button"
                  onClick={() => setInputSeats((prev) => Math.min(6, prev + 1))}
                  className="w-11 h-11 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 text-lg font-mono font-bold text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* 4. Tiện ích chuyến đi (Tùy chọn 1-Chạm) */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-1.5">
                4. Tiện nghi chuyến đi (Tùy chọn):
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { key: 'ac', label: '❄️ Máy lạnh mát' },
                  { key: 'no_smoking', label: '🚭 Không hút thuốc' },
                  { key: 'usb', label: '🔌 Sạc điện thoại' },
                  { key: 'trunk', label: '🧳 Cốp rộng rãi' }
                ].map((item) => {
                  const isChecked = inputAmenities.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleToggleAmenity(item.key)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-white/[0.02] border-white/[0.08] text-slate-400'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="font-mono text-xs">{isChecked ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nút bắt đầu chia sẻ */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isSubmittingVehicle}
                className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmittingVehicle ? 'ĐANG GỬI HỒ SƠ...' : 'BẮT ĐẦU CHIA SẺ GHẾ ➔'}</span>
              </button>
              <p className="text-[11px] text-center text-slate-400 font-sans">
                Cam kết lái xe an toàn & đúng lộ trình Quốc lộ 13
              </p>
            </div>
          </form>
        </main>

        <footer className="text-center text-[11px] font-mono text-slate-500 max-w-lg mx-auto w-full pt-2">
          CarMate Platform · Không thu thập giấy tờ phiền hà · Khởi hành ngay
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: MÀN HÌNH CHỜ KÍCH HOẠT (PENDING APPROVAL - DƯỚI 5 PHÚT)
  // =========================================================================
  if (vehicle && vehicle.status !== 'VERIFIED') {
    return (
      <div className="min-h-screen bg-[#07080d] text-white flex flex-col justify-between select-none p-4 sm:p-6 font-sans">
        <header className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4 max-w-lg mx-auto w-full">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center border border-white/[0.08] transition-all cursor-pointer"
            title="Quay lại sảnh"
          >
            <ChevronLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div className="text-right">
            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>CHỜ XÁC THỰC QL13</span>
            </span>
          </div>
        </header>

        <main className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full space-y-4 my-auto animate-fade-in">
          <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.04] border border-amber-500/30 space-y-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
            <div className="text-center space-y-2.5">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/10">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide">
                  HỒ SƠ ĐANG ĐƯỢC KÍCH HOẠT
                </h1>
                <p className="text-xs text-amber-300/90 font-mono mt-1">
                  Trạng thái: Chờ xác thực tuyến QL13
                </p>
              </div>
            </div>

            {/* Khung tóm tắt thông tin xe */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Phương tiện:</span>
                <span className="font-bold text-white text-right">{vehicle.model}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Biển số xe:</span>
                <span className="font-mono font-black text-emerald-400 tracking-wider text-sm">{vehicle.plate}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400">Số ghế chia sẻ:</span>
                <span className="font-mono font-bold text-white">{vehicle.seats} ghế trống</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Hành lang:</span>
                <span className="font-semibold text-slate-200">QL13 (Tân Khai ⇄ TP.HCM)</span>
              </div>
            </div>

            {/* Lời nhắn trấn an & Thời gian duyệt */}
            <div className="p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/20 space-y-1.5 text-center">
              <p className="text-xs text-slate-300">
                CarMate đang kiểm tra thông tin để bảo đảm an toàn cho hành trình.
              </p>
              <p className="text-xs font-bold text-emerald-400 font-mono flex items-center justify-center gap-1 pt-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Thời gian duyệt: Dưới 5 phút</span>
              </p>
              <p className="text-[10.5px] text-slate-400">
                (Hệ thống sẽ tự động chuyển sang Taplo khi hoàn tất)
              </p>
            </div>

            {/* Các nút hành động */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleSimulateFounderApprove}
                className="w-full h-12 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 active:scale-[0.99] border border-amber-500/40 text-amber-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-amber-500/10"
                title="Duyệt tức thì (Dành cho Solo Founder & Kiểm thử Dev)"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>⚡ Mô phỏng Founder duyệt ngay (Dev Demo)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputPlate(vehicle.plate);
                  setInputModel(vehicle.model);
                  setInputSeats(vehicle.seats);
                  setInputAmenities(vehicle.amenities || ['ac', 'no_smoking']);
                  setIsEditingVehicle(true);
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-white underline cursor-pointer py-1"
              >
                Chỉnh sửa lại thông tin xe
              </button>
            </div>
          </div>
        </main>

        <footer className="text-center text-[11px] font-mono text-slate-500 max-w-lg mx-auto w-full pt-2">
          CarMate Platform · Kích hoạt tự động O(1) · Không cần tải lại trang
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080d] text-white flex flex-col justify-between select-none font-sans overflow-x-hidden p-4 sm:p-6">
      {/* ── TOP BAR: ĐIỀU HƯỚNG & TRẠNG THÁI HÀNH LANG ── */}
      <header className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-11 h-11 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 flex items-center justify-center border border-white/[0.08] transition-all cursor-pointer"
            title="Thoát chế độ Taplo"
          >
            <ChevronLeft className="w-6 h-6 text-slate-300" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-base sm:text-lg font-black tracking-wide uppercase font-mono text-emerald-400">
                COCKPIT MODE · {initialCorridor.toUpperCase()}
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
              <span>TÂN KHAI ──&gt; TP.HCM (HÀNG XANH)</span>
              <span>•</span>
              <span className="text-emerald-400 font-mono font-bold">{vehicle?.plate}</span>
              <button
                type="button"
                onClick={() => {
                  setInputPlate(vehicle?.plate || '');
                  setInputModel(vehicle?.model || '');
                  setInputSeats(vehicle?.seats || 2);
                  setInputAmenities(vehicle?.amenities || ['ac', 'no_smoking']);
                  setIsEditingVehicle(true);
                }}
                className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                title="Cấu hình lại xe"
              >
                [Đổi xe]
              </button>
            </p>
          </div>
        </div>

        {/* NÚT THẺ PHÁP LÝ (TRÌNH CSGT) & THÔNG SỐ VÍ TIỀN */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setShowLegalShield(true)}
            className="px-3 py-1.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="Thẻ Pháp Lý Hành Trình Dân Sự (Điều 3 BLDS 2015 · Trình CSGT)"
          >
            <Scale className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Thẻ Pháp lý (CSGT)</span>
            <span className="sm:hidden">CSGT</span>
          </button>

          <div className="bg-white/[0.04] border border-white/[0.08] px-3.5 py-1.5 rounded-2xl text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-mono">Phụ xăng nhận</span>
            <span className="text-sm sm:text-base font-black font-mono text-emerald-400">
              +{formatVND(totalEarnings)}
            </span>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-2xl text-center hidden sm:block">
            <span className="text-[10px] text-slate-400 block uppercase font-mono">Đã ghép</span>
            <span className="text-sm sm:text-base font-black font-mono text-white">
              {boardedCount} người
            </span>
          </div>
        </div>
      </header>

      {/* ── THANH ĐIỀU HƯỚNG TAB: LỊCH TRÌNH ⟷ BUỒNG LÁI RADAR ── */}
      <div className="flex items-center justify-center mb-4">
        <div className="bg-white/[0.04] p-1 rounded-2xl border border-white/[0.08] flex items-center gap-1 shadow-lg">
          <button
            type="button"
            onClick={() => setActiveCockpitTab('SCHEDULE')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeCockpitTab === 'SCHEDULE'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>📅 LỊCH TRÌNH CỦA BẠN</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCockpitTab('RADAR')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeCockpitTab === 'RADAR'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>⚡ BUỒNG LÁI RADAR QL13</span>
          </button>
        </div>
      </div>

      {/* ── NỘI DUNG CHÍNH (QUẢN LÝ LỊCH TRÌNH HOẶC BUỒNG LÁI TAPLO) ── */}
      <main className="flex-1 flex flex-col justify-center my-auto max-w-2xl mx-auto w-full">
        {/* ========================================================================= */}
        {/* VIEW A: QUẢN LÝ LỊCH TRÌNH DẠNG THẺ (CARD VIEW & TRUST ENGINE)             */}
        {/* ========================================================================= */}
        {activeCockpitTab === 'SCHEDULE' && cockpitState === 'STANDBY' && (
          <DriverScheduleCardView
            vehicle={vehicle}
            onSwitchToRadar={() => setActiveCockpitTab('RADAR')}
            onShowToast={onShowToast}
            onChangeVehicle={() => {
              setInputPlate(vehicle?.plate || '');
              setInputModel(vehicle?.model || '');
              setInputSeats(vehicle?.seats || 2);
              setInputAmenities(vehicle?.amenities || ['ac', 'no_smoking']);
              setIsEditingVehicle(true);
            }}
          />
        )}

        {/* ========================================================================= */}
        {/* MÀN HÌNH D1: TAPLO CHỜ (STANDBY) KHI Ở TAB RADAR                          */}
        {/* ========================================================================= */}
        {activeCockpitTab === 'RADAR' && cockpitState === 'STANDBY' && (
          <div className="space-y-6 animate-fade-in">
            {/* TOGGLE TO BẬT / TẮT NHẬN GHÉP XE DỌC ĐƯỜNG */}
            <button
              type="button"
              onClick={() => {
                const nextState = !isReceivingGuests;
                setIsReceivingGuests(nextState);
                if (nextState) {
                  speakText('Đang bật nhận ghép xe dọc Quốc lộ 13');
                }
              }}
              className={`w-full py-6 sm:py-8 px-6 rounded-3xl border-2 transition-all flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer active:scale-[0.99] ${
                isReceivingGuests
                  ? 'bg-emerald-950/40 border-emerald-500/80 shadow-[0_0_50px_rgba(16,185,129,0.18)]'
                  : 'bg-white/[0.03] border-white/[0.12] opacity-75'
              }`}
            >
              <div className="flex items-center gap-4 text-left">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    isReceivingGuests
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Radio className={`w-7 h-7 ${isReceivingGuests ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-3 h-3 rounded-full ${
                        isReceivingGuests ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-lg sm:text-xl font-black tracking-wide uppercase">
                      {isReceivingGuests ? 'ĐANG BẬT NHẬN GHÉP XE' : 'TẠM TẮT NHẬN GHÉP XE'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    {isReceivingGuests
                      ? 'Radar đang quét tự động các trạm đón ảo trước mặt 3.5 km'
                      : 'Bấm để kích hoạt quét trạm đón trên Quốc lộ 13'}
                  </p>
                </div>
              </div>

              <div
                className={`px-5 py-2.5 rounded-2xl font-black text-sm font-mono uppercase tracking-wider shrink-0 ${
                  isReceivingGuests ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-white'
                }`}
              >
                {isReceivingGuests ? 'BẬT' : 'TẮT'}
              </div>
            </button>

            {/* BẢNG ĐIỀU KHIỂN SỐ GHẾ TRỐNG & THÔNG SỐ HUD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* SỐ GHẾ MỞ */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase text-slate-400 font-mono block">Số ghế mở</span>
                  <span className="text-3xl font-black font-mono text-white">{seatsAvailable} ghế</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSeatsAvailable((prev) => Math.max(1, prev - 1))}
                    className="w-12 h-12 rounded-2xl bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 text-xl font-bold font-mono flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeatsAvailable((prev) => Math.min(6, prev + 1))}
                    className="w-12 h-12 rounded-2xl bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 text-xl font-bold font-mono flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* VẬN TỐC & TRẠM KẾ TIẾP */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase text-slate-400 font-mono block">Trạm sắp tới</span>
                  <span className="text-base sm:text-lg font-bold text-slate-200 block truncate max-w-[170px]">
                    Petrolimex Tân Khai
                  </span>
                  <span className="text-xs text-amber-400 font-mono">Cách ~{simDistanceKm} km</span>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase text-slate-400 font-mono block">Tốc độ</span>
                  <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-400">{speed}</span>
                  <span className="text-[10px] text-slate-400 font-mono block">km/h</span>
                </div>
              </div>
            </div>

            {/* HỘP KÍCH HOẠT MÔ PHỎNG TIẾP CẬN TRẠM THỰC CHIẾN */}
            <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
              <div className="text-left space-y-0.5">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 font-mono uppercase">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kích hoạt radar đón khách tại trạm:</span>
                </span>
                <p className="text-[11.5px] text-slate-300">
                  Bấm nút để mô phỏng xe đang tiến vào trạm Petrolimex Tân Khai (cách 3.4km) và phát hiện khách chờ.
                </p>
              </div>
              <button
                type="button"
                onClick={() => triggerApproachRadar()}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer shrink-0 transition-all"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>NỔ RADAR ĐÓN KHÁCH (3.5 KM)</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MÀN HÌNH D2: BÁO ĐỘNG RADAR 3.5 KM (CẢNH BÁO TIẾP CẬN TRẠM)               */}
        {/* ========================================================================= */}
        {cockpitState === 'OFFERING' && activeOffer && (
          <div className="bg-gradient-to-b from-amber-950/40 via-[#10121a] to-[#07080d] border-2 border-amber-500/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_60px_rgba(245,158,11,0.25)] animate-fade-in">
            {/* HEADER CẢNH BÁO TIẾP CẬN */}
            <div className="flex items-start justify-between gap-3 border-b border-amber-500/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-black animate-bounce">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 font-mono block">
                    CẢNH BÁO TIẾP CẬN ĐIỂM ĐÓN CÂY XĂNG ({activeOffer.distanceKm} KM)
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                    {activeOffer.stationName}
                  </h2>
                </div>
              </div>

              {/* ĐỒNG HỒ ĐẾM LÙI 30S */}
              <div className="bg-amber-500/20 border border-amber-500/40 px-3.5 py-2 rounded-2xl text-center shrink-0">
                <span className="text-[10px] uppercase font-mono text-amber-300 block">Thời gian</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-amber-400">
                  {offerCountdown}s
                </span>
              </div>
            </div>

            {/* THÔNG TIN KHÁCH CHỜ & TIỀN PHỤ XĂNG */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/[0.04] p-4 rounded-2xl border border-white/[0.06]">
                <span className="text-xs uppercase text-slate-400 font-mono block">Hành khách</span>
                <span className="text-lg font-bold text-white block mt-0.5">
                  {activeOffer.riderCount} người cần đi
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                  Trả tại: {activeOffer.destinationName}
                </span>
              </div>

              <div className="bg-emerald-950/40 p-4 rounded-2xl border border-emerald-500/40">
                <span className="text-xs uppercase text-emerald-400 font-mono block">Phụ xăng thực nhận (90%)</span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 block mt-0.5">
                  +{formatVND(activeOffer.driverPayout || activeOffer.fuelSurcharge)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block mt-1">
                  (Cố định · 0% tăng giá giờ cao điểm)
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  Tự động cộng thẳng vào ví khi lên xe
                </span>
              </div>
            </div>

            {/* NÚT THAO TÁC 1-CHẠM (AUTOMOTIVE ERGONOMICS: NÚT TO 80PX) */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleAcceptOffer}
                className="w-full h-20 sm:h-24 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-xl sm:text-2xl uppercase tracking-wider flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(16,185,129,0.35)] cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-8 h-8" />
                <span>ĐỒNG Ý ĐÓN ({offerCountdown}s)</span>
              </button>

              <button
                type="button"
                onClick={handleRejectOffer}
                className="w-full h-12 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 text-slate-400 hover:text-white text-sm font-semibold uppercase tracking-wider flex items-center justify-center cursor-pointer transition-all"
              >
                BỎ QUA YÊU CẦU
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MÀN HÌNH D3: DOCKING TẠI SÂN TRẠM (GEOFENCE ACTIVE 60S & MÃ PIN)           */}
        {/* ========================================================================= */}
        {cockpitState === 'DWELLING' && (
          <div className="bg-gradient-to-b from-cyan-950/40 via-[#10121a] to-[#07080d] border-2 border-cyan-500/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_60px_rgba(6,182,212,0.2)] animate-fade-in">
            {/* HEADER DOCKING TẠI CÂY XĂNG */}
            <div className="flex items-start justify-between gap-3 border-b border-cyan-500/30 pb-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400 font-mono block">
                  ĐÃ VÀO SÂN TRẠM PETROLIMEX TÂN KHAI
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                  XÁC THỰC LÊN XE
                </h2>
              </div>

              {/* HẠN DỪNG TẠI TRẠM 60S (CURBSIDE WINDOW) */}
              <div className="bg-cyan-500/20 border border-cyan-500/40 px-4 py-2 rounded-2xl text-center">
                <span className="text-[10px] uppercase font-mono text-cyan-300 block">Hạn dừng đỗ</span>
                <span className="text-2xl font-black font-mono text-cyan-400">
                  00:{dockingCountdown < 10 ? `0${dockingCountdown}` : dockingCountdown}s
                </span>
              </div>
            </div>

            {/* KHUNG NHẬP MÃ PIN 4 SỐ */}
            <div className="space-y-3">
              <p className="text-sm text-slate-300 text-center font-medium">
                Mời khách bước lên xe và đọc <strong className="text-cyan-400">mã PIN 4 số</strong> trên màn hình của khách:
              </p>

              {/* Ô NHẬP 4 CHỮ SỐ TO RÕ RÀNG */}
              <div className="flex justify-center gap-3 sm:gap-4 my-2">
                {[0, 1, 2, 3].map((idx) => (
                  <input
                    key={idx}
                    id={`pin-input-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={pinDigits[idx]}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(-1);
                      const nextDigits = [...pinDigits];
                      nextDigits[idx] = val;
                      setPinDigits(nextDigits);
                      setPinError('');

                      // Tự động nhảy sang ô kế tiếp
                      if (val && idx < 3) {
                        const nextEl = document.getElementById(`pin-input-${idx + 1}`);
                        if (nextEl) nextEl.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !pinDigits[idx] && idx > 0) {
                        const prevEl = document.getElementById(`pin-input-${idx - 1}`);
                        if (prevEl) prevEl.focus();
                      }
                    }}
                    className="w-14 h-18 sm:w-16 sm:h-20 rounded-2xl bg-white/[0.06] border-2 border-cyan-500/60 focus:border-cyan-400 text-center text-3xl sm:text-4xl font-black font-mono text-white outline-none shadow-inner transition-all"
                  />
                ))}
              </div>

              {/* BÁO LỖI MÃ PIN NẾU CÓ */}
              {pinError && (
                <p className="text-xs text-rose-400 text-center font-medium flex items-center justify-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {pinError}
                </p>
              )}
            </div>

            {/* NÚT XÁC NHẬN VÀ BÁO VẮNG MẶT */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleVerifyPin}
                className="w-full h-18 sm:h-20 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-slate-950 font-black text-xl uppercase tracking-wider flex items-center justify-center gap-3 shadow-[0_0_35px_rgba(6,182,212,0.3)] cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-7 h-7" />
                <span>XÁC NHẬN KHÁCH LÊN XE</span>
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    // Trợ giúp điền nhanh mã PIN đúng trong demo
                    if (currentRider?.pin) {
                      setPinDigits(currentRider.pin.split(''));
                    } else {
                      setPinDigits(['8', '8', '4', '2']);
                    }
                  }}
                  className="flex-1 h-11 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Điền nhanh PIN (8842)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAbsentModal(true)}
                  className="h-11 px-4 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-xs font-semibold text-rose-300 flex items-center justify-center gap-1.5 cursor-pointer border border-rose-500/30 active:scale-95 transition-all"
                  title="Xác thực khách không đến theo bất biến Geofence & Dwell-Time"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Khách vắng mặt / Hủy</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MÀN HÌNH D3.5: CRUISING (ĐANG LĂN BÁNH TRÊN QL13 CÙNG KHÁCH)             */}
        {/* ========================================================================= */}
        {cockpitState === 'CRUISING' && (
          <div className="space-y-5 animate-fade-in text-center">
            {/* HUD TRẠNG THÁI LĂN BÁNH */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-emerald-950/50 to-white/[0.02] border-2 border-emerald-500/60 space-y-3 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>🚗 ĐANG LĂN BÁNH TRÊN QL13 ➔ VỀ HÀNG XANH</span>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2 text-left">
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">Khách trên xe</span>
                  <span className="text-base font-bold text-white flex items-center gap-1.5 pt-0.5">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span>{currentRider?.name || 'Khách đi cùng'} ({currentRider?.seatsNeeded || boardedCount || 2} người)</span>
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 block pt-0.5">
                    Mã PIN: {currentRider?.pin || '8842'} (Đã khớp)
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">Phụ xăng nhận</span>
                  <span className="text-lg font-black font-mono text-emerald-400 block pt-0.5">
                    +{formatVND(currentRider?.fuelSurcharge || totalEarnings || 220000)}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">VietQR / Tiền mặt trao tay</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-left text-xs text-amber-200 flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Khách đang chuẩn bị chuyển khoản VietQR trên xe hoặc trả tiền mặt khi tới nơi.</span>
              </div>
            </div>

            {/* NÚT LỚN TAPLO: [ 🏁 TỚI TRẠM HÀNG XANH · TRẢ KHÁCH (D4) ] */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCockpitState('DROPOFF');
                  playAudioChime();
                  speakText('Đã tới điểm đến Hàng Xanh. Vui lòng tấp lề trả khách nhanh trong 10 giây.');
                }}
                className="w-full h-20 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-[0.99] text-slate-950 font-black text-xl uppercase tracking-wider flex items-center justify-center gap-3 shadow-[0_0_35px_rgba(16,185,129,0.3)] cursor-pointer transition-all"
              >
                <MapPin className="w-7 h-7" />
                <span>🏁 TỚI TRẠM HÀNG XANH · TRẢ KHÁCH (D4)</span>
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLegalShield(true)}
                  className="flex-1 h-12 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  <Scale className="w-4 h-4 text-amber-400" />
                  <span>Thẻ Pháp Lý (CSGT)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MÀN HÌNH D4: DROPOFF (TRẢ KHÁCH NHANH 10 GIÂY & NHẬN PHỤ XĂNG VIETQR)      */}
        {/* ========================================================================= */}
        {cockpitState === 'DROPOFF' && (
          <div className="space-y-5 animate-fade-in text-center">
            <div className="p-6 rounded-3xl bg-slate-900 border-2 border-emerald-500/80 space-y-4 shadow-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold">
                <span>🏁 ĐÃ TỚI TRẠM HÀNG XANH · TRẢ KHÁCH NHANH</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 text-left">
                ⚠️ <strong>Lưu ý camera phạt nguội:</strong> Vui lòng dừng sát lề và trả khách trong dưới 30 giây.
              </div>

              {/* MÃ VIETQR HIỆN TRÊN TAPLO ĐỂ KHÁCH QUÉT NẾU CHƯA CHUYỂN TRƯỚC */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col items-center space-y-3">
                <span className="text-xs font-mono text-slate-300 uppercase">Mã VietQR nhận phụ xăng:</span>
                <img
                  src={`https://img.vietqr.io/image/MB-0938884288-compact.png?amount=${currentRider?.fuelSurcharge || totalEarnings || 220000}&addInfo=CARMATE%20PIN%20${currentRider?.pin || '8842'}&accountName=CHU%20XE%20CARMATE`}
                  alt="Mã VietQR phụ xăng"
                  className="w-44 h-44 rounded-xl bg-white p-2 shadow-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="text-emerald-400 font-mono font-bold text-lg">
                  +{formatVND(currentRider?.fuelSurcharge || totalEarnings || 220000)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  playAudioChime();
                  speakText('Chúc mừng đã hoàn tất cuốc đi an toàn. Cảm ơn bạn!');
                  onShowToast?.('🎉 Đã hoàn tất chuyến đi an toàn! Điểm tín nhiệm tăng +1');

                  // Đồng bộ trạng thái khách hoàn tất cuốc qua localStorage
                  try {
                    const savedPassRaw = localStorage.getItem('carmate_active_station_pass');
                    if (savedPassRaw) {
                      const parsed = JSON.parse(savedPassRaw);
                      if (parsed && parsed.pass) {
                        parsed.pass.status = 'COMPLETED';
                        localStorage.setItem('carmate_active_station_pass', JSON.stringify(parsed));
                      }
                    }
                  } catch {}

                  setShowMutualRating(true);
                }}
                className="w-full h-18 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-[0.99] transition-all"
              >
                <CheckCircle2 className="w-6 h-6" />
                <span>✓ ĐÃ NHẬN ĐỦ PHỤ XĂNG · HOÀN TẤT CUỐC</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── FOOTER: BỘ CÔNG CỤ MÔ PHỎNG THỰC TẾ (SIMULATION TOOLBAR) ── */}
      <footer className="border-t border-white/[0.08] pt-3 mt-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span className="font-mono">Bộ thử nghiệm Taplo:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => triggerApproachRadar()}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 font-semibold cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Thử nổ Radar 3.5 km</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playAudioChime();
                speakText('Kiểm tra loa xe ô tô thành công');
              }}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] text-slate-300 font-semibold cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Thử Loa & Giọng đọc</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentRider({
                  name: 'Bạn Hoàng (Khách đi cùng)',
                  seatsNeeded: 2,
                  destinationName: 'Hàng Xanh',
                  fuelSurcharge: 220000,
                  pin: '8842'
                });
                setCockpitState('CRUISING');
                playAudioChime();
                speakText('Đang thử nghiệm chế độ Cruising lăn bánh trên Quốc lộ 13.');
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 font-semibold cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Car className="w-3.5 h-3.5" />
              <span>Thử Cruising (QL13)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentRider({
                  name: 'Bạn Hoàng (Khách đi cùng)',
                  seatsNeeded: 2,
                  destinationName: 'Hàng Xanh',
                  fuelSurcharge: 220000,
                  pin: '8842'
                });
                setCockpitState('DROPOFF');
                playAudioChime();
                speakText('Đã tới Hàng Xanh, trả khách nhanh 10 giây.');
              }}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 text-cyan-300 font-semibold cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Thử Trả khách (D4)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCockpitState('STANDBY');
                setActiveOffer(null);
                setSimDistanceKm(6.2);
              }}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] text-slate-400 font-semibold cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Standby</span>
            </button>
          </div>
        </div>
      </footer>

      {/* 🛡️ MODAL THẺ PHÁP LÝ HÀNH TRÌNH DÂN SỰ (XUẤT TRÌNH CSGT) */}
      {showLegalShield && (
        <LegalShieldModal
          isOpen={showLegalShield}
          onClose={() => setShowLegalShield(false)}
          trip={{
            id: tripId,
            author: currentUser?.name || 'Chủ xe cá nhân',
            licensePlate: vehicle?.plate || currentUser?.licensePlate || currentUser?.carInfo?.plate || '93A-123.45',
            carModel: vehicle?.model || currentUser?.carModel || currentUser?.carInfo?.vehicleModel || 'Xe gia đình cá nhân',
            from: 'Tân Khai (Bình Phước)',
            to: 'Hàng Xanh (TP. Hồ Chí Minh)',
            timeSlotLabel: 'Hôm nay (Tiện chuyến)'
          }}
          ticket={{
            code: tripId,
            passengerName: currentRider?.author || 'Người đi cùng',
            fuelSurcharge: totalEarnings || 240000
          }}
          userRole="driver"
        />
      )}

      {/* ⚠️ MODAL XÁC THỰC KHÁCH VẮNG MẶT (DUAL GEOFENCE & DWELL-TIME INVARIANT) */}
      {showAbsentModal && (
        <Modal
          onClose={() => setShowAbsentModal(false)}
          size="md"
          icon={AlertTriangle}
          iconTone="warning"
          title="Xác thực Khách vắng mặt tại Trạm"
          subtitle="Đối chiếu dữ liệu Geofence 2 chiều & Thời gian dừng đỗ (Dwell-Time)"
          footer={
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button variant="outline" onClick={() => setShowAbsentModal(false)}>
                Quay lại đợi thêm
              </Button>
              {absentSimGpsStatus === 'FAR' ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    handleRejectOffer();
                    setShowAbsentModal(false);
                    onShowToast?.(
                      '✓ Đã xác thực Khách vắng mặt (Khách bị trừ 30 điểm tín nhiệm). Bạn được phép tiếp tục hành trình!'
                    );
                    speakText('Đã xác thực khách vắng mặt. Bạn được giải phóng cuốc đi an toàn.');
                  }}
                  className="font-bold"
                >
                  <span>Xác nhận No-Show (-30đ)</span>
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    onShowToast?.('💡 Đang bật đèn xi-nhan và phát tín hiệu tìm nhau tại sân trạm!');
                    speakText('Cả hai bạn đều đang ở trong trạm. Vui lòng bật xi-nhan tìm nhau.');
                  }}
                  className="font-bold"
                >
                  <span>Bật xi-nhan tìm nhau</span>
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4 text-sm text-[#1d1d1f] dark:text-slate-200">
            {/* 1. ĐIỀU KIỆN DWELL-TIME DỪNG ĐỖ */}
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 uppercase font-bold">1. Thời gian dừng tại trạm:</span>
                <span className="font-black text-emerald-500">ĐÃ DỪNG ĐỦ 5 PHÚT (05:00)</span>
              </div>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                ✓ Thỏa mãn bất biến dừng đỗ tối thiểu 5 phút để hành khách kịp bước ra xe.
              </p>
            </div>

            {/* 2. ĐỐI CHIẾU GPS 2 CHIỀU */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-black/30 border border-black/[0.08] dark:border-white/[0.08] space-y-2">
              <span className="text-xs font-mono font-bold uppercase text-slate-500 block">
                2. Đối chiếu GPS Không Gian 2 Chiều:
              </span>

              <div className="space-y-2 text-xs">
                {/* Vị trí xe */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span>🚗 Xe của bạn ({vehicle?.plate}):</span>
                  <span className="font-mono font-bold text-emerald-500">Trong sân trạm (R = 12m)</span>
                </div>

                {/* Vị trí khách */}
                {absentSimGpsStatus === 'FAR' ? (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <span>👤 Điện thoại khách:</span>
                    <span className="font-mono font-bold text-rose-500">Cách trạm 2.3 km (Vắng mặt)</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <span>👤 Điện thoại khách:</span>
                    <span className="font-mono font-bold text-cyan-500">Trong sân trạm (Cách xe 18m)</span>
                  </div>
                )}
              </div>
            </div>

            {/* THÔNG ĐIỆP KẾT LUẬN */}
            {absentSimGpsStatus === 'FAR' ? (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-900 dark:text-rose-200">
                <strong className="block font-bold mb-0.5">Xác thực: Khách không có mặt tại điểm đón!</strong>
                Hệ thống sẽ trừ 30 điểm tín nhiệm của hành khách này. Bạn không vi phạm bất cứ điều gì và được phép đạp ga lăn bánh tiếp tục lộ trình.
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                <strong className="block font-bold mb-0.5">⚠️ Chú ý: Khách cũng đang ở trong trạm xăng!</strong>
                GPS cho thấy khách chỉ cách xe bạn 18m (có thể đang đứng gần quầy thu ngân hoặc quầy tiện lợi). Hệ thống <strong>KHÔNG</strong> trừ điểm ai khi cả hai đều đã đến trạm. Vui lòng bấm còi nhẹ hoặc bật xi-nhan!
              </div>
            )}

            {/* CÔNG CỤ CHUYỂN ĐỔI MÔ PHỎNG TEST */}
            <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono text-[11px]">Mô phỏng thử nghiệm GPS:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAbsentSimGpsStatus('FAR')}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] cursor-pointer transition-all ${
                    absentSimGpsStatus === 'FAR'
                      ? 'bg-rose-500 text-white font-bold'
                      : 'bg-white/[0.05] text-slate-400'
                  }`}
                >
                  Khách ở xa (2.3km)
                </button>
                <button
                  type="button"
                  onClick={() => setAbsentSimGpsStatus('NEAR')}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] cursor-pointer transition-all ${
                    absentSimGpsStatus === 'NEAR'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-white/[0.05] text-slate-400'
                  }`}
                >
                  Khách cùng ở trạm (18m)
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 🌟 MODAL ĐÁNH GIÁ 2 CHIỀU (MUTUAL RATING CHỦ XE -> HÀNH KHÁCH) */}
      {showMutualRating && (
        <MutualReviewModal
          booking={{
            partyRole: 'Chủ xe đón',
            contactName: currentRider?.name || 'Bạn Hoàng (Khách đi cùng)',
            fuelSurcharge: currentRider?.fuelSurcharge || totalEarnings || 220000,
            seats: currentRider?.seatsNeeded || 2
          }}
          onClose={() => {
            setShowMutualRating(false);
            setCockpitState('STANDBY');
            setCurrentRider(null);
            setActiveOffer(null);
            setSimDistanceKm(6.2);
          }}
          onSubmitReview={() => {
            setShowMutualRating(false);
            setCockpitState('STANDBY');
            setCurrentRider(null);
            setActiveOffer(null);
            setSimDistanceKm(6.2);
            onShowToast?.('🌟 Đã gửi đánh giá 5 sao cho khách! Cảm ơn bạn.');
          }}
        />
      )}
    </div>
  );
}
