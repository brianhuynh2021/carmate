import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Navigation,
  MapPin,
  Clock,
  Home,
  CheckCircle2,
  Car,
  Users,
  Radio,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  VIRTUAL_HUBS,
  DOORSTEP_CONFIG,
  calculateDistanceKm
} from '@carmate/shared';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';

export default function ZeroSearchMatchWidget({
  currentUser,
  onShowToast,
  onOpenBooking
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [role, setRole] = useState('passenger'); // 'passenger' | 'driver'
  const [corridor, setCorridor] = useState('Tuyến QL13');
  const [originHubId, setOriginHubId] = useState('hub_ql13_cho_loc_ninh');
  const [destHubId, setDestHubId] = useState('hub_ql13_hang_xanh');
  const [timeSlot, setTimeSlot] = useState('Sáng sớm (05:00 - 08:00)');
  const [seats, setSeats] = useState(1);
  const [isDoorstep, setIsDoorstep] = useState(false);
  const [doorstepAddress, setDoorstepAddress] = useState('');
  const [phone, setPhone] = useState(currentUser?.phone || '');

  const [isSearching, setIsSearching] = useState(false);
  const [matchResult, setMatchResult] = useState(null);

  // Lọc danh sách trạm đón theo hành lang
  const corridorHubs = useMemo(() => {
    return VIRTUAL_HUBS.filter((h) => h.corridor === corridor);
  }, [corridor]);

  const originHub = useMemo(() => {
    return corridorHubs.find((h) => h.id === originHubId) || corridorHubs[0];
  }, [corridorHubs, originHubId]);

  const destHub = useMemo(() => {
    return corridorHubs.find((h) => h.id === destHubId) || corridorHubs[corridorHubs.length - 1];
  }, [corridorHubs, destHubId]);

  // Tính cự ly và giá Shapley Value tức thì (< 1ms client-side)
  const pricingEstimate = useMemo(() => {
    if (!originHub || !destHub) return { finalPrice: 140000, distanceKm: 110 };
    const directKm = calculateDistanceKm(originHub.lat, originHub.lng, destHub.lat, destHub.lng) || 100;
    const distKm = Math.max(15, Math.round(directKm * 1.28));
    const fuel = Math.round(distKm * 1500);
    const bot = 70000;
    const baseShare = Math.round((fuel + bot) / 3 / 1000) * 1000;
    const clampedBase = Math.max(80000, Math.min(220000, baseShare));
    const surcharge = isDoorstep ? (DOORSTEP_CONFIG.DEFAULT_SURCHARGE || 40000) : 0;

    return {
      distanceKm: distKm,
      basePrice: clampedBase,
      doorstepSurcharge: surcharge,
      finalPrice: (clampedBase + surcharge) * seats
    };
  }, [originHub, destHub, isDoorstep, seats]);

  // Gửi ý định ghép đôi tự động và gom phiên
  const handleStartZeroSearch = async () => {
    const contactPhone = phone || currentUser?.phone;
    if (!contactPhone) {
      onShowToast?.('Vui lòng nhập số điện thoại để hệ thống gửi thông báo ghép chuyến', 'warning');
      return;
    }

    if (originHubId === destHubId) {
      onShowToast?.('Điểm xuất phát và điểm đến không được trùng nhau', 'warning');
      return;
    }

    setIsSearching(true);
    setMatchResult(null);

    try {
      // 1. Tạo Intent trong cơ sở dữ liệu
      const intentRes = await fetch('/api/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          originHubId: originHub.id,
          originName: originHub.shortName,
          destinationHubId: destHub.id,
          destinationName: destHub.shortName,
          corridor,
          timeSlot,
          seats: Number(seats),
          isDoorstep: isDoorstep ? 1 : 0,
          doorstepAddress: isDoorstep ? doorstepAddress : '',
          phone: contactPhone,
          contactName: currentUser?.name || (role === 'driver' ? 'Chủ xe' : 'Người đi cùng')
        })
      });

      const intentData = await intentRes.json();
      if (!intentData.success) {
        throw new Error(intentData.error || 'Không thể tạo ý định ghép');
      }

      // 2. Kích hoạt cỗ máy Gom phiên vi mô (WATTER Micro-Batch Engine)
      const matchRes = await fetch('/api/intents/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corridor })
      });

      const matchData = await matchRes.json();

      if (matchData.success && matchData.matchedClusters?.length > 0) {
        // Tìm cluster có chứa intent này
        const myCluster = matchData.matchedClusters.find((c) =>
          c.driver.id === intentData.data.id ||
          c.passengers.some((p) => p.id === intentData.data.id || p.phone === contactPhone)
        );

        if (myCluster) {
          setMatchResult({
            cluster: myCluster,
            role,
            isDoorstep,
            finalPrice: pricingEstimate.finalPrice
          });
          onShowToast?.('✓ Tìm thấy chuyến ghép ổn định tối ưu toàn cục!', 'success');
        } else {
          onShowToast?.('Ý định đã được lưu vào phiên gom tự động (sẽ ghép trong 3 phút).', 'info');
        }
      } else {
        onShowToast?.('Ý định đã được lưu vào phiên gom tự động (sẽ ghép trong 3 phút).', 'info');
      }
    } catch (err) {
      onShowToast?.(err.message || 'Lỗi điều phối tự động', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-blue-500/20 dark:border-blue-500/10 bg-gradient-to-b from-blue-50/60 via-white to-white dark:from-[#15233b]/40 dark:via-[#1c1c1e] dark:to-[#1c1c1e] p-4 sm:p-6 shadow-sm backdrop-blur-md transition-all">
      {/* Header Widget */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Ghép Xe Nhanh 3 Giây
              </h3>
              <Badge variant="primary" size="sm" className="bg-blue-600 text-white font-medium text-[11px] px-2 py-0.5">
                Tự Động Kết Nối
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Tự động ghép người cùng lộ trình · Báo giá xăng chuẩn xác · Không cần lướt tìm
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors"
          aria-label="Thu gọn widget"
        >
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="pt-4 space-y-4">
          {/* Chọn vai trò & Tuyến hành lang */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Toggle Vai trò */}
            <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/60 dark:border-zinc-700/60 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setRole('passenger')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  role === 'passenger'
                    ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Người đi cùng (Tìm xe)
              </button>
              <button
                type="button"
                onClick={() => setRole('driver')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  role === 'driver'
                    ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                Chủ xe (Có chỗ trống)
              </button>
            </div>

            {/* Chọn Hành lang Trọng điểm */}
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 font-medium">
              <span>Hành lang:</span>
              <select
                value={corridor}
                onChange={(e) => {
                  setCorridor(e.target.value);
                  const newHubs = VIRTUAL_HUBS.filter((h) => h.corridor === e.target.value);
                  if (newHubs.length > 0) {
                    setOriginHubId(newHubs[0].id);
                    setDestHubId(newHubs[newHubs.length - 1].id);
                  }
                }}
                className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 text-xs"
              >
                <option value="Tuyến QL13">Tuyến QL13 (TP.HCM ⇄ Bình Phước)</option>
                <option value="Tuyến N2 - Kiên Giang">Tuyến N2 (Đông Nam Bộ ⇄ Miền Tây)</option>
              </select>
            </div>
          </div>

          {/* Bộ chọn 3 giây: Điểm đi & Điểm đến tại Trạm đón ảo (Virtual Hubs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Điểm xuất phát */}
            <div className="p-3 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 space-y-1.5 shadow-2xs">
              <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Trạm đón ảo (Xuất phát)
              </label>
              <select
                value={originHubId}
                onChange={(e) => setOriginHubId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {corridorHubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 line-clamp-1">
                📍 Mốc: {originHub?.landmark} (Dừng tối đa 5 phút)
              </p>
            </div>

            {/* Điểm đến */}
            <div className="p-3 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 space-y-1.5 shadow-2xs">
              <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                Trạm trả (Điểm đến)
              </label>
              <select
                value={destHubId}
                onChange={(e) => setDestHubId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                {corridorHubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 line-clamp-1">
                📍 Mốc: {destHub?.landmark} (Trả dọc trục chính)
              </p>
            </div>
          </div>

          {/* Tùy chọn đón tận cửa nhà (Compensated Doorstep) */}
          <div className="p-3 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/20 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isDoorstep}
                onChange={(e) => setIsDoorstep(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-zinc-600 cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Cần đón tận nhà (+40k phụ phí xăng ngõ ngách)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Phù hợp khi có con nhỏ hoặc hành lý nặng. Ghép trong bán kính láng giềng ≤ 1km. 50% tiền này tự động giảm trừ cho các khách khác cùng xe đền bù thời gian chờ.
                </p>
              </div>
            </label>

            {isDoorstep && (
              <div className="pt-1">
                <input
                  type="text"
                  placeholder="Nhập địa chỉ nhà / hẻm cụ thể (VD: Hẻm 12, Ấp 3, Lộc Ninh)..."
                  value={doorstepAddress}
                  onChange={(e) => setDoorstepAddress(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/30 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            )}
          </div>

          {/* Hàng điều khiển: Khung giờ, Số ghế & Báo giá Shapley */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              {/* Khung giờ */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="bg-transparent outline-none font-medium text-slate-900 dark:text-white text-xs cursor-pointer"
                >
                  <option value="Sáng sớm (05:00 - 08:00)">Sáng sớm (05:00 - 08:00)</option>
                  <option value="Buổi sáng (08:00 - 11:30)">Buổi sáng (08:00 - 11:30)</option>
                  <option value="Buổi trưa (11:30 - 13:30)">Buổi trưa (11:30 - 13:30)</option>
                  <option value="Buổi chiều (13:30 - 17:30)">Buổi chiều (13:30 - 17:30)</option>
                  <option value="Chiều tối (17:30 - 20:30)">Chiều tối (17:30 - 20:30)</option>
                </select>
              </div>

              {/* Số ghế */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <span>{role === 'driver' ? 'Ghế trống:' : 'Số người:'}</span>
                <select
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value))}
                  className="bg-transparent outline-none font-bold text-slate-900 dark:text-white text-xs cursor-pointer"
                >
                  <option value={1}>1 ghế</option>
                  <option value={2}>2 ghế</option>
                  <option value={3}>3 ghế</option>
                  <option value={4}>4 ghế</option>
                </select>
              </div>
            </div>

              {/* Thẻ Báo giá Gợi ý */}
              <div className="flex items-baseline gap-2 text-right">
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  Phí xăng gợi ý ({pricingEstimate.distanceKm}km):
                </span>
                <span className="text-lg sm:text-xl font-mono font-extrabold text-blue-600 dark:text-blue-400">
                  {pricingEstimate.finalPrice.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* Nhập số điện thoại nếu chưa đăng nhập */}
            {!currentUser?.phone && (
              <div className="pt-1">
                <input
                  type="tel"
                  placeholder="Nhập số điện thoại Zalo của bạn để nhận thông báo ghép xe..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

          {/* Nút hành động Bắt tay 1-Chạm */}
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base py-3 rounded-2xl shadow-md transition-all flex items-center gap-2"
              onClick={handleStartZeroSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <>
                  <Radio className="w-5 h-5 animate-spin" />
                  Đang tìm chuyến tiện đường phù hợp...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Gửi Yêu Cầu Ghép Nhanh (1-Chạm)
                </>
              )}
            </Button>
          </div>

          {/* Kết quả ghép thành công (Match Result Bento Card) */}
          {matchResult && (
            <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 dark:bg-emerald-950/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Đã tìm thấy chuyến xe tiện đường phù hợp nhất!
                </span>
                <Badge variant="success" size="sm" className="font-mono">
                  Khớp lộ trình: 100%
                </Badge>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Chủ xe: {matchResult.cluster.driver.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Trạm đón: {originHub?.shortName} ➔ Trả tại: {destHub?.shortName}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {matchResult.finalPrice.toLocaleString('vi-VN')}đ
                  </span>
                  <p className="text-[10px] text-slate-400">Phí xăng chia sẻ</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="success"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-4 py-2"
                  onClick={() => {
                    onShowToast?.('Đã chốt ghép chuyến thành công! Vui lòng trao đổi Zalo văn minh.', 'success');
                    if (matchResult.cluster.driver.raw && onOpenBooking) {
                      onOpenBooking(matchResult.cluster.driver.raw);
                    }
                    setMatchResult(null);
                  }}
                >
                  ✓ Xác nhận bắt tay 1-chạm
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
