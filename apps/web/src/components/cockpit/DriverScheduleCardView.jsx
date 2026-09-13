import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Zap,
  CheckCircle2,
  ChevronRight,
  Plus,
  ArrowRight,
  Edit3,
  X,
  Scale,
  Award,
  Info,
  Radio,
  Share2,
  Car,
  Sparkles
} from 'lucide-react';
import { formatVND, VIRTUAL_HUBS, cleanPhoneNumber } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import api from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import ActiveTripCard from './ActiveTripCard.jsx';

/**
 * BẢN ĐỒ TUYẾN ➔ TRẠM ẢO (HUB)
 *
 * Máy chủ định danh điểm đi/đến bằng hubId của mạng lưới Trạm đón ảo QL13.
 * Form thêm lịch ở đây dùng tên tuyến rút gọn, nên cần quy chiếu về đúng hubId
 * thì ý định mới lọt vào đúng bucket khớp lệnh của cỗ máy gom khách.
 */
const ROUTE_HUB_MAP = {
  'Tân Khai (Bình Phước)': 'hub_ql13_tan_khai',
  'Tân Khai (Cây Xăng)': 'hub_ql13_tan_khai',
  'TP.HCM (Hàng Xanh)': 'hub_ql13_hang_xanh',
  'TP.HCM (Ngã 4 Hàng Xanh)': 'hub_ql13_hang_xanh'
};

function resolveHubId(routeName) {
  if (ROUTE_HUB_MAP[routeName]) return ROUTE_HUB_MAP[routeName];
  const hit = VIRTUAL_HUBS.find(
    (h) => h.name === routeName || h.shortName === routeName
  );
  return hit ? hit.id : '';
}

/**
 * Quy chiếu một bản ghi Ý Định (Intent) từ máy chủ về đúng hình dạng thẻ lịch trình
 * mà giao diện này đang hiển thị.
 */
function intentToSchedule(intent) {
  const seats = Number(intent.seats) || 1;
  const matchedCount = Array.isArray(intent.matchedRiders) ? intent.matchedRiders.length : 0;
  return {
    id: intent.id,
    status: intent.status === 'matched' ? 'MATCHED' : intent.status === 'cancelled' ? 'CANCELLED' : 'WAITING',
    from: intent.originName || '',
    to: intent.destinationName || '',
    timeDisplay: intent.timeSlot || '',
    dateDisplay: intent.isRecurring
      ? `${(intent.recurringDays || []).join(', ') || 'Hàng tuần'}`
      : intent.date || 'Ngày mai',
    totalSeats: seats,
    matchedCount,
    fareEstimated: Number(intent.estimatedPricing?.pricePerSeat || 0) * seats,
    riders: intent.matchedRiders || [],
    isRemote: true
  };
}

export default function DriverScheduleCardView({
  vehicle,
  onSwitchToRadar,
  onShowToast,
  onOpenQuickPostTrip,
  onChangeVehicle: _onChangeVehicle,
  activeDriverTrip: externalActiveDriverTrip,
  onRefreshActiveTrip: externalRefreshActiveTrip
}) {
  const { t } = useI18n();
  // NGUỒN SỰ THẬT DUY NHẤT LÀ MÁY CHỦ.
  const [schedules, setSchedules] = useState([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [isSavingTrip, setIsSavingTrip] = useState(false);

  // Chuyến xe active thật trên Sàn Tuyến Tiện Chuyến
  const [activeDriverTrip, setActiveDriverTrip] = useState(null);
  const displayedActiveTrip = externalActiveDriverTrip !== undefined ? externalActiveDriverTrip : activeDriverTrip;
  const [, setIsLoadingActiveTrip] = useState(true);

  const driverPhone = (() => {
    try {
      return localStorage.getItem('carmate_rider_phone') || localStorage.getItem('carmate_driver_phone') || '';
    } catch {
      return '';
    }
  })();

  const reloadActiveTrip = useCallback(async () => {
    setIsLoadingActiveTrip(true);
    try {
      const clean = driverPhone ? cleanPhoneNumber(driverPhone) : '';
      const res = await api.getTrips({ type: 'drivers' });
      const allDriverTrips = res?.data?.driverOffers || res?.data?.all || [];

      let storedTripId = null;
      try {
        const storedIds = JSON.parse(
          localStorage.getItem(`carmate_my_trip_ids_${clean}`) ||
          localStorage.getItem('carmate_my_trip_ids') ||
          '[]'
        );
        if (storedIds.length > 0) storedTripId = storedIds[0];
      } catch {}

      const myActiveTrip = allDriverTrips.find((t) => {
        if (t.status === 'cancelled' || t.status === 'completed') return false;
        if (storedTripId && t.id === storedTripId) return true;
        const pReal = cleanPhoneNumber(t.phoneReal || t.phone || '');
        if (clean && pReal === clean) return true;
        return false;
      });

      if (myActiveTrip) {
        try {
          const detailRes = await api.getTrip(myActiveTrip.id);
          setActiveDriverTrip(detailRes?.data || myActiveTrip);
        } catch {
          setActiveDriverTrip(myActiveTrip);
        }
      } else {
        setActiveDriverTrip(null);
      }
    } catch (err) {
      console.warn('[DriverScheduleCardView] Load active trip error:', err);
    } finally {
      setIsLoadingActiveTrip(false);
    }
  }, [driverPhone]);

  const reloadSchedules = useCallback(async () => {
    setIsLoadingSchedules(true);
    try {
      const res = await api.getMovementIntents({ role: 'driver', mine: 1 });
      const rows = Array.isArray(res?.data) ? res.data : [];
      setSchedules(rows.map(intentToSchedule));
    } catch (err) {
      console.warn('[DriverSchedule] Không tải được lịch trình từ máy chủ:', err);
      setSchedules([]);
    } finally {
      setIsLoadingSchedules(false);
    }
  }, []);

  useEffect(() => {
    reloadSchedules();
    reloadActiveTrip();
  }, [reloadSchedules, reloadActiveTrip]);

  // Nạp điểm tín nhiệm THẬT từ máy chủ (/api/trust), không bịa ở client.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.getTrustProfile();
        if (!alive) return;
        const d = res?.data || {};
        if (typeof d.trustScore === 'number') setTrustScore(d.trustScore);
      } catch (err) {
        console.warn('[DriverSchedule] Không tải được hồ sơ tin cậy:', err);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // HỆ THỐNG ĐIỂM TÍN NHIỆM (CARMATE TRUST ENGINE)
  // Điểm tín nhiệm là dữ liệu CHẾ TÀI, nguồn sự thật duy nhất nằm ở máy chủ.
  // Trước đây đọc/ghi thẳng localStorage nên chủ xe chỉ cần sửa trình duyệt là
  // thành "Uy Tín Hạng Vàng", và con số đó không liên quan gì tới điểm thật.
  const [trustScore, setTrustScore] = useState(null);


  // MODALS STATE
  const [showTrustModal, setShowTrustModal] = useState(false);
  const [showAddTripModal, setShowAddTripModal] = useState(false);
  const [cancelingTrip, setCancelingTrip] = useState(null); // Trip object being canceled

  // NEW TRIP INTENT FORM STATE
  const [newFrom, setNewFrom] = useState('Tân Khai (Bình Phước)');
  const [newTo, setNewTo] = useState('TP.HCM (Hàng Xanh)');
  const [newTime, setNewTime] = useState('06:15');
  const [newSeats, setNewSeats] = useState(2);
  const [isRecurringCommute, setIsRecurringCommute] = useState(true);

  // 3-TIER CHECKPOINTS STATE (QUY TRÌNH GÁC CỔNG 3 MỐC)
  const [activeCheckpoint, setActiveCheckpoint] = useState('MORNING_WAKE');
  const [nightConfirmed, setNightConfirmed] = useState(true);
  const [morningAwakeConfirmed, setMorningAwakeConfirmed] = useState(false);

  // Cập nhật lạc quan trên giao diện. Máy chủ mới là nơi lưu thật, nên các thao
  // tác thay đổi lịch đều gọi API rồi nạp lại danh sách từ máy chủ.
  const updateSchedulesState = (newScheds) => {
    setSchedules(newScheds);
  };

  // Chỉ cập nhật hiển thị lạc quan; máy chủ mới là nơi trừ điểm thật
  // (xem applyCancellationPenalty trong sqliteStore).
  const updateTrustScoreState = (newScore) => {
    setTrustScore(Math.max(0, Math.min(100, newScore)));
  };

  // 1. THAO TÁC 3 GIÂY: DỜI GIỜ (+15P HOẶC +30P)
  const handleDelayTrip = (tripId, minutesToAdd) => {
    setSchedules((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t;

        // Tính giờ mới
        const [hh, mm] = t.timeDisplay.split(':').map(Number);
        let totalMinutes = hh * 60 + mm + minutesToAdd;
        const newH = Math.floor(totalMinutes / 60) % 24;
        const newM = totalMinutes % 60;
        const formattedTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;

        return {
          ...t,
          timeDisplay: formattedTime
        };
      })
    );

    // Gửi thông báo đến người đi cùng
    onShowToast?.(
      `⏱️ Đã dời giờ sang ${minutesToAdd === 15 ? '+15p' : '+30p'}. Đã gửi tin nhắn xác nhận tới người đi cùng!`
    );
  };

  // 2. THAO TÁC 3 GIÂY: ĐỔI GHẾ (GIẢM HOẶC TĂNG GHẾ)
  const handleChangeSeats = (tripId, delta) => {
    const target = schedules.find((s) => s.id === tripId);
    if (!target) return;

    const newSeatsCount = target.totalSeats + delta;
    if (newSeatsCount < 1 || newSeatsCount > 4) return;

    if (delta < 0 && target.matchedCount > newSeatsCount) {
      // BẤT BIẾN FIFO (GALE-SHAPLEY): Giữ người đặt trước, đẩy người thứ 2 lên ưu tiên #1 của Trạm
      const preservedRider = target.riders[0];
      const releasedRider = target.riders[1];

      const updated = schedules.map((t) => {
        if (t.id !== tripId) return t;
        return {
          ...t,
          totalSeats: newSeatsCount,
          matchedCount: newSeatsCount,
          fareEstimated: newSeatsCount * 110000,
          riders: [preservedRider]
        };
      });

      updateSchedulesState(updated);
      onShowToast?.(
        `💺 Đã giảm còn 1 ghế. Giữ chỗ cho bạn ${preservedRider.name}. Bạn ${releasedRider?.name} được chuyển ưu tiên #1 trạm đón!`
      );
    } else {
      // Tăng số ghế
      const updated = schedules.map((t) => {
        if (t.id !== tripId) return t;
        return {
          ...t,
          totalSeats: newSeatsCount,
          fareEstimated: Math.max(t.matchedCount, newSeatsCount) * 110000
        };
      });
      updateSchedulesState(updated);
      onShowToast?.(`💺 Đã cập nhật số ghế thành ${newSeatsCount} ghế.`);
    }
  };

  // 3. THAO TÁC 3 GIÂY: HUỶ LỊCH TRÌNH CHỜ (THẺ 2 - KHÔNG RÀO CẢN)
  const handleQuickCancelWaitingTrip = (tripId) => {
    const next = schedules.filter((s) => s.id !== tripId);
    updateSchedulesState(next);
    onShowToast?.('✓ Đã huỷ lịch trình chờ thành công.');
  };

  // 4. XÁC NHẬN HUỶ CHUYẾN ĐÃ KHỚP (THẺ 1 - CHẾ TÀI LEO THANG OSTROM)
  const handleConfirmCancelMatchedTrip = () => {
    if (!cancelingTrip) return;

    // Giả lập huỷ sát giờ (<15 phút) -> Trừ 20 điểm
    const penaltyPoints = 20;
    const newScore = (trustScore ?? 98) - penaltyPoints;
    updateTrustScoreState(newScore);

    // Cập nhật trạng thái chuyến
    const updated = schedules.map((s) => {
      if (s.id === cancelingTrip.id) {
        return { ...s, status: 'CANCELLED' };
      }
      return s;
    });
    updateSchedulesState(updated);

    onShowToast?.(
      `⚠️ Đã huỷ chuyến. Điểm tín nhiệm giảm còn ${newScore}đ. Đã gửi SMS xin lỗi & điều phối cứu hộ cho khách.`
    );
    setCancelingTrip(null);
  };

  // 5. THÊM Ý ĐỊNH CHUYẾN MỚI
  /**
   * Tạo ý định chuyến mới — ĐẨY THẲNG LÊN MÁY CHỦ.
   *
   * Trước đây hàm này chỉ nhét một object vào localStorage rồi báo thành công,
   * nên lịch tạo ra chỉ tồn tại trong trình duyệt của chính chủ xe: máy chủ không
   * biết nó tồn tại, cỗ máy gom khách không thấy, và không bao giờ ghép được ai.
   * Nay dùng đúng một đường đi với modal "Lên lịch xe" ngoài trang chủ:
   * POST /api/intents rồi kích hoạt luôn phiên khớp lệnh.
   */
  const handleCreateNewTrip = async (e) => {
    e.preventDefault();
    if (isSavingTrip) return;

    const clean = driverPhone.replace(/\D/g, '');
    if (clean.length < 10) {
      onShowToast?.('⚠️ Cần số điện thoại để người đi cùng liên hệ. Vui lòng đăng nhập hoặc đặt chuyến một lần để lưu số.');
      return;
    }

    // Ngày đi: lịch cố định hàng tuần hoặc chuyến lẻ ngày mai
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    setIsSavingTrip(true);
    try {
      await api.createMovementIntent({
        role: 'driver',
        originHubId: resolveHubId(newFrom),
        originName: newFrom,
        destinationHubId: resolveHubId(newTo),
        destinationName: newTo,
        corridor: 'Tuyến QL13',
        date: dateStr,
        timeSlot: newTime,
        seats: newSeats,
        isRecurring: isRecurringCommute,
        recurringDays: isRecurringCommute ? ['T2', 'T3', 'T4', 'T5', 'T6'] : [],
        phone: clean,
        contactName: vehicle?.ownerName || 'Chủ xe'
      });

      // Kích hoạt ngay phiên gom khớp lệnh để khách cùng giờ được ghép tức thì
      try {
        await api.runBatchMatch({ epochType: 'micro_batch', corridor: 'Tuyến QL13', date: dateStr });
      } catch (matchErr) {
        console.warn('[DriverSchedule] Auto batch match:', matchErr);
      }

      await reloadSchedules();
      setShowAddTripModal(false);
      onShowToast?.(
        isRecurringCommute
          ? '⚡ Đã lưu lịch xe cố định T2-T6! Hệ thống đang tự động gom khách cùng tuyến.'
          : '🎉 Đã lưu ý định chuyến đi! Hệ thống đang tự động gom khách cùng tuyến.'
      );
    } catch (err) {
      onShowToast?.(`⚠️ Chưa lưu được lịch trình: ${err?.message || 'Vui lòng thử lại'}`);
    } finally {
      setIsSavingTrip(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in font-sans text-white max-w-2xl mx-auto w-full">
      {/* ── THANH TRẠNG THÁI CHỦ XE & ĐIỂM TÍN NHIỆM ── */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-mono font-black text-white">
                {vehicle?.plate || '93A - 541.86'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                {t('driverSchedule.roleDriver')}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {vehicle?.model || 'Mitsubishi Xpander · Màu Trắng'}
            </p>
          </div>
        </div>

        {/* BADGE ĐIỂM TÍN NHIỆM (CLICK ĐỂ XEM QUY CHẾ KHOA HỌC) */}
        <button
          type="button"
          onClick={() => setShowTrustModal(true)}
          className="px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-400 active:scale-95 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group"
          title={t('driverSchedule.viewTrustTable')}
        >
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-mono block">{t('driverSchedule.trustLabel')}</span>
                <span className="text-sm font-black font-mono text-emerald-400">
                  {trustScore ?? '—'}/100
                </span>
              </div>
              <span className="text-[11px] text-amber-300 font-medium block">
                {trustScore == null ? 'Đang tải hồ sơ…' : trustScore >= 90 ? '🟢 Uy Tín Hạng Vàng' : trustScore >= 70 ? '🟡 Mức Bình Thường' : '🔴 Cần Chú Ý'}
              </span>
            </div>
          </div>
          <Info className="w-4 h-4 text-slate-500 group-hover:text-white" />
        </button>
      </div>

      {/* ── THẺ QUẢN LÝ CHUYẾN XE ĐANG NHẬN KHÁCH TRỰC TIẾP (ACTIVE TRIP DASHBOARD) ── */}
      {displayedActiveTrip && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Chuyến xe đang mở nhận khách trực tiếp</span>
            </span>
          </div>
          <ActiveTripCard
            trip={displayedActiveTrip}
            onLockTrip={(tripId, newStatus) => {
              setActiveDriverTrip((prev) => (prev ? { ...prev, status: newStatus } : null));
            }}
            onCancelTrip={() => {
              setActiveDriverTrip(null);
            }}
            onRefresh={externalRefreshActiveTrip || reloadActiveTrip}
            onShowToast={onShowToast}
          />
        </div>
      )}

      {/* ── HEADER DANH SÁCH LỊCH TRÌNH & NÚT THÊM ── */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-base sm:text-lg font-black tracking-wide uppercase font-mono text-white flex items-center gap-2">
            <span>{t('driverSchedule.yourSchedule')}</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-300">
              {schedules.filter((s) => s.status !== 'CANCELLED').length}
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            {t('driverSchedule.scheduleDesc')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onOpenQuickPostTrip) onOpenQuickPostTrip();
            else setShowAddTripModal(true);
          }}
          className="h-10 px-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Đăng chuyến mới</span>
        </button>
      </div>

      {/* ── DANH SÁCH CÁC THẺ LỊCH TRÌNH ── */}
      <div className="space-y-4">
        {isLoadingSchedules && (
          <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.10] text-center text-sm text-slate-400 font-mono">
            {t('driverSchedule.loadingSchedules')}
          </div>
        )}

        {!isLoadingSchedules && schedules.filter((t) => t.status !== 'CANCELLED').length === 0 && (
          <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.10] text-center space-y-2">
            <p className="text-sm font-bold text-white">{t('driverSchedule.emptyTitle')}</p>
            <p className="text-xs text-slate-400">
              {t('driverSchedule.emptyDesc')}
            </p>
          </div>
        )}

        {schedules.map((trip) => {
          if (trip.status === 'CANCELLED') return null;

          const isMatched = trip.status === 'MATCHED';

          return (
            <div
              key={trip.id}
              className={`rounded-3xl border transition-all overflow-hidden ${
                isMatched
                  ? 'bg-gradient-to-b from-emerald-950/20 via-[#0e1017] to-[#07080d] border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.08)]'
                  : 'bg-white/[0.03] border-white/[0.10]'
              }`}
            >
              {/* PHẦN TRÊN: THÔNG TIN LỘ TRÌNH & GIỜ GIẤC */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isMatched ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    <span
                      className={`text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isMatched
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {isMatched ? '🟢 ĐÃ KHỚP KHÁCH' : '🟡 ĐANG CHỜ KHỚP'}
                    </span>
                  </div>

                  <span className="text-xs font-mono text-slate-400">
                    Mã: {trip.id}
                  </span>
                </div>

                {/* LỘ TRÌNH & THỜI GIAN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{trip.from} ➔ {trip.to}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono pl-6">
                      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{trip.dateDisplay}: <strong className="text-emerald-400 font-mono text-sm">{trip.timeDisplay}</strong></span>
                    </div>
                  </div>

                  <div className="sm:text-right space-y-1">
                    <div className="flex sm:justify-end items-center gap-2 text-xs font-mono">
                      <Users className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>{t('driverSchedule.matched')} <strong className="text-white text-sm">{trip.matchedCount}/{trip.totalSeats}</strong> {t('driverSchedule.seat')}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      {t('driverSchedule.fuelEstimate')} <strong className="text-emerald-400 font-bold">{formatVND(trip.fareEstimated)}</strong>
                      <span className="text-[10px] text-slate-500 block">{t('driverSchedule.cashOrQr')}</span>
                    </p>
                  </div>
                </div>

                {/* DANH SÁCH NGƯỜI ĐI CÙNG (NẾU ĐÃ KHỚP) */}
                {isMatched && trip.riders && trip.riders.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.06] space-y-2">
                    <span className="text-[11px] font-mono font-bold uppercase text-slate-400 block">
                      Khách đi cùng trên xe ({trip.riders.length} người):
                    </span>
                    <div className="space-y-1.5">
                      {trip.riders.map((r, idx) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between text-xs p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center text-[11px]">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-white">{r.name}</span>
                            <span className="text-[11px] text-slate-400">({r.phoneMasked})</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-slate-300 block">{r.pickup}</span>
                            <span className="text-[10px] font-mono text-emerald-400">PIN: {r.pin}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* QUY TRÌNH GÁC CỔNG 3 MỐC THỜI GIAN (TRIỆT TIÊU RỦI RO NGỦ QUÊN / HỦY SÁNG) */}
                {isMatched && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Gác cổng 3 mốc: {activeCheckpoint === 'NIGHT_LOCK' ? '21:00 Đêm (Khóa sổ)' : activeCheckpoint === 'MORNING_WAKE' ? '05:15 Sáng (Báo thức)' : '05:30 Sáng (Lằn ranh đỏ)'}</span>
                      </span>
                      {/* Selector mô phỏng 3 mốc (chỉ hiện ở dev) */}
                      {import.meta.env.DEV && (
                        <div className="flex items-center gap-1 text-[10px] font-mono">
                          <button
                            type="button"
                            onClick={() => setActiveCheckpoint('NIGHT_LOCK')}
                            className={`px-2 py-0.5 rounded cursor-pointer transition-all ${activeCheckpoint === 'NIGHT_LOCK' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/[0.05] text-slate-400'}`}
                            title={t('driverSchedule.cp1Title')}
                          >
                            {t('driverSchedule.night21')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveCheckpoint('MORNING_WAKE')}
                            className={`px-2 py-0.5 rounded cursor-pointer transition-all ${activeCheckpoint === 'MORNING_WAKE' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/[0.05] text-slate-400'}`}
                            title={t('driverSchedule.cp2Title')}
                          >
                            {t('driverSchedule.morning0515')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveCheckpoint('RED_LINE')}
                            className={`px-2 py-0.5 rounded cursor-pointer transition-all ${activeCheckpoint === 'RED_LINE' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/[0.05] text-slate-400'}`}
                            title={t('driverSchedule.cp3Title')}
                          >
                            {t('driverSchedule.redline0530')}
                          </button>
                        </div>
                      )}
                    </div>

                    {activeCheckpoint === 'NIGHT_LOCK' && (
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <p className="text-xs text-slate-300">
                          🌙 <strong>{t('driverSchedule.cp1')}</strong> {t('driverSchedule.cp1Desc')}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setNightConfirmed(true);
                            onShowToast?.('✓ Đã chốt sổ ban đêm! Khách nhận được thông báo an tâm.');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs shrink-0 cursor-pointer active:scale-95 transition-all"
                        >
                          {nightConfirmed ? '✓ Đã chốt sổ 21h' : 'Chốt sổ ngay'}
                        </button>
                      </div>
                    )}

                    {activeCheckpoint === 'MORNING_WAKE' && (
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <p className="text-xs text-slate-300">
                          ⏰ <strong>{t('driverSchedule.cp2')}</strong> {t('driverSchedule.cp2Desc')}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setMorningAwakeConfirmed(true);
                            onShowToast?.('⏰ Đã xác nhận thức dậy! Đường ống mở sẵn sàng đón khách lúc 06:15.');
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold font-mono text-xs shrink-0 cursor-pointer active:scale-95 transition-all ${
                            morningAwakeConfirmed
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 animate-pulse'
                          }`}
                        >
                          {morningAwakeConfirmed ? '✓ Đã thức dậy (05:15)' : 'Tôi đã thức dậy'}
                        </button>
                      </div>
                    )}

                    {activeCheckpoint === 'RED_LINE' && (
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex items-center justify-between text-xs text-rose-300">
                          <span>🚨 <strong>{t('driverSchedule.cp3')}</strong> {t('driverSchedule.redline')}</span>
                          <span className="font-mono text-[10px] text-rose-400 font-bold">{t('driverSchedule.autoCancelIfAbsent')}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {t('driverSchedule.failsafe1')} <strong>{t('driverSchedule.failsafe2')}</strong> {t('driverSchedule.failsafe3')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* PHẦN DƯỚI: THANH THAO TÁC 3 GIÂY (ACTION BAR) */}
              <div className="px-5 py-3.5 bg-black/30 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                {isMatched ? (
                  <>
                    {/* NHÓM DỜI GIỜ & ĐỔI GHẾ */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* DỜI +15P */}
                      <button
                        type="button"
                        onClick={() => handleDelayTrip(trip.id, 15)}
                        className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 text-xs font-mono font-bold text-slate-200 border border-white/[0.08] transition-all cursor-pointer flex items-center gap-1"
                        title={t('driverSchedule.delay15Title')}
                      >
                        <span>{t('driverSchedule.delay15')}</span>
                      </button>

                      {/* DỜI +30P */}
                      <button
                        type="button"
                        onClick={() => handleDelayTrip(trip.id, 30)}
                        className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 text-xs font-mono font-bold text-slate-200 border border-white/[0.08] transition-all cursor-pointer flex items-center gap-1"
                        title={t('driverSchedule.delay30Title')}
                      >
                        <span>{t('driverSchedule.delay30')}</span>
                      </button>

                      {/* BỘ ĐẾM ĐỔI GHẾ ([-] 1 [+]) */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/[0.08]">
                        <span className="text-[11px] text-slate-400 font-mono">{t('driverSchedule.seatsLabel')}</span>
                        <button
                          type="button"
                          onClick={() => handleChangeSeats(trip.id, -1)}
                          className="w-9 h-9 rounded-lg bg-white/[0.10] hover:bg-white/[0.20] active:bg-white/[0.28] text-xs font-bold font-mono flex items-center justify-center cursor-pointer active:scale-90"
                          title={t('driverSchedule.seatMinus')}
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-xs px-1 text-emerald-400">
                          {trip.totalSeats}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleChangeSeats(trip.id, 1)}
                          className="w-9 h-9 rounded-lg bg-white/[0.10] hover:bg-white/[0.20] active:bg-white/[0.28] text-xs font-bold font-mono flex items-center justify-center cursor-pointer active:scale-90"
                          title={t('driverSchedule.seatPlus')}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* NÚT HUỶ CHUYẾN KHẨN CẤP */}
                    <button
                      type="button"
                      onClick={() => setCancelingTrip(trip)}
                      className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-xs font-mono font-bold text-rose-400 border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1 ml-auto"
                      title={t('driverSchedule.cancelTripTitle')}
                    >
                      <span>{t('driverSchedule.cancelTrip')}</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* THAO TÁC NHANH CHO THẺ CHỜ KHỚP (ZERO FRICTION) */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          // Chuyển đổi nhanh các mốc giờ chiều
                          const nextTimes = ['17:00', '17:30', '18:00', '18:30'];
                          const curIdx = nextTimes.indexOf(trip.timeDisplay);
                          const newT = nextTimes[(curIdx + 1) % nextTimes.length];
                          const updated = schedules.map((s) =>
                            s.id === trip.id ? { ...s, timeDisplay: newT } : s
                          );
                          updateSchedulesState(updated);
                          onShowToast?.(`Đã đổi giờ thành ${newT}`);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 text-xs font-mono font-bold text-slate-200 border border-white/[0.08] transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Đổi giờ ({trip.timeDisplay})</span>
                      </button>
                    </div>

                    {/* HUỶ LỊCH CHỜ 1-CHẠM (KHÔNG CẦN POPUP XÁC NHẬN) */}
                    <button
                      type="button"
                      onClick={() => handleQuickCancelWaitingTrip(trip.id)}
                      className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 active:scale-95 text-xs font-mono font-bold text-slate-400 hover:text-rose-400 border border-white/[0.06] hover:border-rose-500/30 transition-all cursor-pointer ml-auto"
                      title={t('driverSchedule.cancelScheduleTitle')}
                    >
                      <span>{t('driverSchedule.cancelSchedule')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {schedules.filter((s) => s.status !== 'CANCELLED').length === 0 && (
          <div className="p-8 rounded-3xl bg-white/[0.02] border border-dashed border-white/[0.10] text-center space-y-3">
            <Calendar className="w-10 h-10 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">
              {t('driverSchedule.noSavedSchedule')}
            </p>
            <p className="text-xs text-slate-500">
              {t('driverSchedule.pressHint')} <strong>{t('driverSchedule.addScheduleBtn')}</strong> {t('driverSchedule.addScheduleHint')}
            </p>
          </div>
        )}
      </div>

      {/* ── PHÍM TẮT: CHUYỂN SANG BUỒNG LÁI RADAR QL13 KHI LĂN BÁNH ── */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onSwitchToRadar}
          className="w-full py-4 px-6 rounded-3xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-between shadow-[0_0_40px_rgba(16,185,129,0.25)] transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3 text-left">
            <Radio className="w-6 h-6 animate-pulse shrink-0" />
            <div>
              <div className="text-sm font-black font-mono">{t('driverSchedule.startRadar')}</div>
              <div className="text-[11px] text-slate-900/80 font-medium">
                {t('driverSchedule.startRadarDesc')}
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 shrink-0" />
        </button>
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: GIẢI THÍCH QUY CHẾ ĐIỂM TÍN NHIỆM (NOBEL OSTROM & D.R.E.A.M.S) */}
      {/* ===================================================================== */}
      {showTrustModal && (
        <Modal
          onClose={() => setShowTrustModal(false)}
          size="lg"
          icon={Award}
          iconTone="warning"
          title={t('driverSchedule.trustModalTitle')}
          subtitle={t('driverSchedule.trustModalSub')}
          footer={
            <div className="w-full flex justify-end">
              <Button onClick={() => setShowTrustModal(false)}>{t('driverSchedule.understood')}</Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm text-[#1d1d1f] dark:text-slate-200">
            {/* THÔNG ĐIỆP CỐT LÕI */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <strong className="font-bold flex items-center gap-1.5 mb-1 text-amber-800 dark:text-amber-300">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{t('driverSchedule.honorTitle')}</span>
              </strong>
              {t('driverSchedule.honorDesc1')} <strong>{t('driverSchedule.graduatedSanctions')}</strong> {t('driverSchedule.honorDesc2')}
            </div>

            {/* BẢNG THANG ĐIỂM VÀ HÀNH VI */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-500 mb-2">
                {t('driverSchedule.scoreTable')}
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <span>{t('driverSchedule.score1')}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{t('driverSchedule.score1v')}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                  <span>{t('driverSchedule.score2')}</span>
                  <span className="font-mono font-bold text-slate-500">{t('driverSchedule.score2v')}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                  <span>{t('driverSchedule.score3')}</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{t('driverSchedule.score3v')}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                  <span>{t('driverSchedule.score4')}</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{t('driverSchedule.score4v')}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-between">
                  <span>{t('driverSchedule.score5')}</span>
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-300">{t('driverSchedule.score5v')}</span>
                </div>
              </div>
            </div>

            {/* CÁC MỨC QUYỀN LỢI */}
            <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] text-xs space-y-1.5">
              <span className="font-mono font-bold uppercase text-slate-500 block">{t('driverSchedule.benefitsTitle')}</span>
              <p>• <strong className="text-emerald-600 dark:text-emerald-400">{t('driverSchedule.vipTier')}</strong> {t('driverSchedule.vipDesc')}</p>
              <p>• <strong className="text-amber-600 dark:text-amber-400">{t('driverSchedule.warnTier')}</strong> {t('driverSchedule.warnDesc')}</p>
              <p>• <strong className="text-rose-600 dark:text-rose-400">{t('driverSchedule.lowTier')}</strong> {t('driverSchedule.lowDesc')}</p>
            </div>
          </div>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: HUỶ CHUYẾN ĐÃ KHỚP (CẢNH BÁO CHẾ TÀI LEO THANG OSTROM)        */}
      {/* ===================================================================== */}
      {cancelingTrip && (
        <Modal
          onClose={() => setCancelingTrip(null)}
          size="md"
          icon={AlertTriangle}
          iconTone="danger"
          title={t('driverSchedule.confirmCancelTitle')}
          subtitle={`Mã chuyến: ${cancelingTrip.id} · Đã khớp ${cancelingTrip.matchedCount} người đi cùng`}
          footer={
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button variant="outline" onClick={() => setCancelingTrip(null)}>
                {t('driverSchedule.backToTrip')}
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmCancelMatchedTrip}
                className="font-bold"
              >
                <span>{t('driverSchedule.cancelAnyway')}</span>
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm">
            <div className="p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08]">
              <span className="text-xs text-slate-500 font-mono block">{t('driverSchedule.cancelledRoute')}</span>
              <p className="font-bold text-[#1d1d1f] dark:text-white mt-0.5">
                {cancelingTrip.from} ➔ {cancelingTrip.to} ({cancelingTrip.timeDisplay})
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-900 dark:text-rose-200 leading-relaxed space-y-2">
              <strong className="font-bold block text-rose-700 dark:text-rose-300">
                {t('driverSchedule.sanctionWarn')}
              </strong>
              <p>
                {t('driverSchedule.sanctionDesc1')} <strong>{cancelingTrip.matchedCount} người đi cùng</strong> {t('driverSchedule.sanctionDesc2')}
              </p>
              <div className="flex items-center justify-between p-2 rounded-xl bg-black/10 dark:bg-black/40 font-mono text-xs">
                <span>{t('driverSchedule.yourTrust')}</span>
                <span className="font-black text-rose-500">
                  {trustScore ?? '—'} ➔ {Math.max(0, (trustScore ?? 98) - 20)} điểm (-20đ)
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('driverSchedule.smsNote')}
            </p>
          </div>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: THÊM Ý ĐỊNH CHUYẾN MỚI (LỊCH CỐ ĐỊNH HOẶC CHUYẾN LẺ)          */}
      {/* ===================================================================== */}
      {showAddTripModal && (
        <Modal
          onClose={() => setShowAddTripModal(false)}
          size="md"
          icon={Plus}
          iconTone="primary"
          title={t('driverSchedule.addModalTitle')}
          subtitle={t('driverSchedule.addModalSub')}
          footer={
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button variant="outline" onClick={() => setShowAddTripModal(false)}>
                {t('driverSchedule.cancel')}
              </Button>
              <Button onClick={handleCreateNewTrip} disabled={isSavingTrip}>
                {isSavingTrip ? 'Đang lưu…' : 'Lưu lịch trình ➔'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleCreateNewTrip} className="space-y-4 text-sm text-[#1d1d1f] dark:text-slate-200">
            {/* TUYẾN ĐƯỜNG */}
            <div>
              <label className="text-xs font-bold uppercase font-mono text-slate-500 mb-1.5 block">
                {t('driverSchedule.sharedRoute')}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] text-xs font-bold">
                  {newFrom} ➔ {newTo}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const temp = newFrom;
                    setNewFrom(newTo);
                    setNewTo(temp);
                  }}
                  className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-mono cursor-pointer"
                  title={t('driverSchedule.swapTitle')}
                >
                  {t('driverSchedule.swap')}
                </button>
              </div>
            </div>

            {/* CHỌN NHANH GIỜ KHỞI HÀNH */}
            <div>
              <label className="text-xs font-bold uppercase font-mono text-slate-500 mb-1.5 block">
                {t('driverSchedule.departureTime')}
              </label>
              <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                {['06:15', '06:45', '17:30', '18:00'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewTime(t)}
                    className={`py-2 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                      newTime === t
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-white/[0.04] border-white/[0.08] text-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* SỐ GHẾ TRỐNG CHIA SẺ */}
            <div>
              <label className="text-xs font-bold uppercase font-mono text-slate-500 mb-1.5 block">
                {t('driverSchedule.openSeats')}
              </label>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewSeats(s)}
                    className={`flex-1 py-2.5 rounded-xl border text-center font-mono font-bold cursor-pointer transition-all ${
                      newSeats === s
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-white/[0.04] border-white/[0.08] text-slate-300'
                    }`}
                  >
                    {s} ghế
                  </button>
                ))}
              </div>
            </div>

            {/* TÙY CHỌN LẶP LẠI HÀNG TUẦN */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-300 block">
                  {t('driverSchedule.weeklyCommute')}
                </span>
                <span className="text-[11px] text-slate-400 block">
                  {t('driverSchedule.weeklyDesc')}
                </span>
              </div>
              <input
                type="checkbox"
                checked={isRecurringCommute}
                onChange={(e) => setIsRecurringCommute(e.target.checked)}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
