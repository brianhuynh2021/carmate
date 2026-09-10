import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Users,
  ShieldCheck,
  MapPin,
  Check,
  Sparkles,
  MessageSquare,
  Clock,
  Search,
  CheckCircle2,
  Calendar,
  Info,
  Zap,
  Bell,
  ArrowRight,
  Loader2,
  SlidersHorizontal
} from 'lucide-react';
import {
  formatVND,
  calculatePricing,
  getTimeSlotLabel,
  getCorridorWaypoints,
  toPublicAlias,
  normalizePhoneNumber,
  getPriceGuardrail
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { RouteTimeline } from '../market/TripCard.jsx';
import { searchLocations, getSuggestedWaypoints } from '../../utils/vietnamLocations.js';
import api from '../../api/client.js';

// Điểm đón mốc nổi tiếng dọc trục QL13 & liên tỉnh (Hotspot Chips 1 chạm kiểu Grab)
const POPULAR_HOTSPOTS = [
  'Ngã 4 Bình Phước',
  'Trạm thu phí Lái Thiêu',
  'Cổng KCN VSIP 1',
  'Cầu Bình Triệu',
  'Ngã 4 Hàng Xanh',
  'Bến xe Miền Đông',
  'Cây xăng Petrolimex 17',
  'Chợ Tân Khai',
  'Cổng chào Bình Long'
];

export default function EscrowBookingModal({
  item,
  isOwner = false,
  currentUser,
  onClose,
  onConfirmBooking,
  onViewTrustProfile,
  onViewBookedTab,
  onAutoPostDemand,
  onShowToast
}) {
  const { lang } = useI18n();
  const [seats, setSeats] = useState(1);
  const [pickupPoint, setPickupPoint] = useState('');
  const [passengerNote, setPassengerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [postedDemand, setPostedDemand] = useState(false);
  const [isPostingDemand, setIsPostingDemand] = useState(false);

  const [bookingCode] = useState(() => `CX-${Math.floor(1000 + Math.random() * 9000)}`);

  // Autocomplete Dropdown State
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (pickupPoint.trim().length >= 2) {
      const results = searchLocations(pickupPoint, 5);
      setSuggestions(results);
    } else {
      setSuggestions([]);
    }
  }, [pickupPoint]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Gợi ý điểm đón dọc trục theo chuyến đi cụ thể (Corridor Waypoints + Hotspots)
  const routeHotspots = useMemo(() => {
    if (!item) return POPULAR_HOTSPOTS;
    const fromNote = item.waypointNote ? item.waypointNote.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : [];
    const corridorFrom = getCorridorWaypoints(item.from || '') || [];
    const corridorTo = getCorridorWaypoints(item.to || '') || [];
    const suggested = getSuggestedWaypoints(item.from || '', item.to || '') || [];
    const combined = Array.from(new Set([...fromNote, ...corridorFrom, ...corridorTo, ...suggested, ...POPULAR_HOTSPOTS]));
    return combined.slice(0, 10);
  }, [item?.from, item?.to, item?.waypointNote]);

  // Cửa sổ phản hồi động (Dynamic SLA) dựa trên thời gian tới lúc khởi hành
  const dynamicSlaText = useMemo(() => {
    if (!item) return 'khoảng 30 – 45 phút';
    const dateStr = String(item.date || '');
    const isTomorrow = dateStr && !dateStr.toLowerCase().includes('hôm nay');
    if (isTomorrow) {
      return 'khoảng 2 – 3 tiếng (hoặc trước 21:00 tối nay)';
    }
    if (item.timeSlot && /gấp|ngay/i.test(item.timeSlot)) {
      return 'khoảng 15 – 20 phút';
    }
    return 'khoảng 30 – 45 phút';
  }, [item?.date, item?.timeSlot]);

  // BẤT BIẾN MIT: Kiểm tra quyền sở hữu bài đăng để ngăn chặn 100% việc tự ghép chuyến cho chính mình
  const isTripOwner = useMemo(() => {
    if (isOwner) return true;
    if (!item) return false;
    if (currentUser) {
      const cId = currentUser.id || currentUser.userId;
      if (cId && (item.userId === cId || item.creatorId === cId || item.driverId === cId)) return true;
      const uPhone = currentUser.phone ? normalizePhoneNumber(currentUser.phone) : '';
      const tPhone = (item.phoneReal || item.phone) ? normalizePhoneNumber(item.phoneReal || item.phone) : '';
      if (uPhone && tPhone && uPhone === tPhone) return true;
      if (currentUser.telegramId && item.telegramId && String(currentUser.telegramId) === String(item.telegramId)) return true;
    }
    try {
      const guestStored = JSON.parse(localStorage.getItem('carmate_guest_trip_ids') || '[]');
      if (Array.isArray(guestStored) && guestStored.includes(item.id)) return true;
      const legacyStored = JSON.parse(localStorage.getItem('carmate_my_trip_ids') || '[]');
      if (Array.isArray(legacyStored) && legacyStored.includes(item.id)) return true;
      if (currentUser) {
        const userKey = `carmate_my_trip_ids_${currentUser.id || currentUser.userId || currentUser.phone}`;
        const userStored = JSON.parse(localStorage.getItem(userKey) || '[]');
        if (Array.isArray(userStored) && userStored.includes(item.id)) return true;
      }
    } catch {}
    return false;
  }, [isOwner, item, currentUser]);

  const baseSeatPrice = item?.basePricePerSeat || item?.expectedPrice || item?.price || 180000;
  const [proposedUnitPrice, setProposedUnitPrice] = useState(baseSeatPrice);
  const [showNegotiate, setShowNegotiate] = useState(false);

  // Price Guardrail
  const priceGuardrail = useMemo(() => {
    if (!item) return null;
    return getPriceGuardrail(item?.from, item?.to, proposedUnitPrice);
  }, [item, proposedUnitPrice]);

  useEffect(() => {
    setProposedUnitPrice(baseSeatPrice);
    setShowNegotiate(false);
  }, [item?.id, baseSeatPrice]);

  if (!item) return null;

  const isDriverItem = item.type === 'driver_offer';
  const maxSeats = item.availableSeats || item.seatsNeeded || 4;
  const pricing = calculatePricing(item, seats);
  const timeSlot = getTimeSlotLabel(item, lang);

  const effectiveUnitPrice = Number(proposedUnitPrice) || baseSeatPrice;
  const effectiveTotal = effectiveUnitPrice * seats;

  const handleSendInquiry = async () => {
    if (isTripOwner) {
      onShowToast?.('Đây là bài đăng của chính bạn. Bạn không thể gửi yêu cầu ghép cho chính mình.');
      onClose();
      return;
    }
    if (submitting) return;
    setSubmitting(true);

    const bookingData = {
      escrowId: bookingCode,
      tripId: item.id,
      targetTripId: item.id,
      from: item.from,
      to: item.to,
      date: item.date,
      time: item.time,
      targetItem: item,
      pickupPoint: pickupPoint.trim() || undefined,
      passengerNote: passengerNote.trim() || undefined,
      seats,
      totalDeal: effectiveTotal,
      proposedPricePerSeat: effectiveUnitPrice !== baseSeatPrice ? effectiveUnitPrice : undefined,
      originalPricePerSeat: baseSeatPrice,
      timeSlot,
      passengerPhone: currentUser?.phone || undefined,
      driverPhone: item.phoneReal,
      contactPhone: currentUser?.phone || item.phoneReal,
      status: 'inquiring',
      commitmentType: 'inquiry_chat',
      partyRole: isDriverItem ? 'Người đi cùng Chủ Xe' : 'Chủ xe đón Người đi cùng',
      contactName: toPublicAlias(item),
      createdAt: 'Vừa xong'
    };

    try {
      const res = await api.createBooking(bookingData);
      if (res?.error || res?.success === false) {
        throw new Error(res?.error || 'Không thể tạo yêu cầu ghép chuyến');
      }

      onConfirmBooking?.(bookingData, { keepModalOpen: true });
      setIsSubmitted(true);
    } catch (apiErr) {
      const errMsg = apiErr?.data?.error || apiErr?.message || 'Không thể gửi yêu cầu ghép chuyến';
      onShowToast?.(errMsg);
      return;
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoPostDemand = async () => {
    if (isPostingDemand || postedDemand) return;
    setIsPostingDemand(true);
    try {
      const isDriver = !isDriverItem;
      const newPostPayload = isDriver
        ? {
            id: `TRIP-DRV-${Date.now()}`,
            type: 'driver_offer',
            from: item.from,
            to: item.to,
            waypointNote: item.waypointNote || '',
            date: item.date || 'Hôm nay',
            timeSlot: item.timeSlot || '07:00-09:00',
            availableSeats: 3,
            basePricePerSeat: pricing.total / seats || 150000,
            carType: 'Xe ô tô gia đình',
            note: 'Chủ xe tiện chuyến đón khách cùng lộ trình',
            publicName: currentUser?.name || 'Chủ xe',
            phoneReal: currentUser?.phone || '',
            createdAt: 'Vừa xong'
          }
        : {
            id: `TRIP-REQ-${Date.now()}`,
            type: 'passenger_request',
            from: item.from,
            to: item.to,
            pickupPoint: pickupPoint.trim() || undefined,
            date: item.date || 'Hôm nay',
            timeSlot: item.timeSlot || '07:00-09:00',
            seatsNeeded: seats,
            expectedPrice: Math.round(pricing.total / seats),
            note: passengerNote ? `Ghi chú: ${passengerNote}` : `Cần tìm xe tiện chuyến ${item.from} về ${item.to}`,
            publicName: currentUser?.name || 'Người đi cùng',
            phoneReal: currentUser?.phone || '',
            createdAt: 'Vừa xong'
          };

      await onAutoPostDemand?.(newPostPayload);
      setPostedDemand(true);
      onShowToast?.(
        isDriver
          ? '🎉 Đã đưa chuyến xe trống lên Sàn! Các hành khách khác sẽ liên hệ bạn.'
          : '🎉 Đã đưa nhu cầu tìm xe lên Sàn! Các chủ xe khác cùng tuyến sẽ thấy để đón bạn.'
      );
    } catch (err) {
      console.warn('[AutoPost] Lỗi tự động đăng:', err);
    } finally {
      setIsPostingDemand(false);
    }
  };

  // -------------------------------------------------------------
  // TRẠNG THÁI 2: ĐÃ GỬI LỜI NHẮN (THẺ TIẾP NHẬN YÊU CẦU & DYNAMIC SLA)
  // -------------------------------------------------------------
  if (isSubmitted) {
    return (
      <Modal
        onClose={onClose}
        size="md"
        icon={CheckCircle2}
        iconTone="success"
        title={isDriverItem ? 'Đã gửi lời nhắn ghép chuyến!' : 'Đã gửi đề xuất đón khách!'}
        subtitle={`Đã chuyển tới ${toPublicAlias(item)} · Thông báo tức thì qua App & Telegram`}
        footer={
          <div className="w-full space-y-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm bg-primary-600 hover:bg-primary-700 active:scale-[0.99] text-white shadow-md shadow-primary-500/25 cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" strokeWidth={2.5} />
              <span>Đã hiểu & Tiếp tục tìm chuyến</span>
            </button>
            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
              💡 Bạn có thể kiểm tra tiến độ phản hồi bất kỳ lúc nào tại mục <strong className="text-slate-600 dark:text-slate-300">Chuyến đã hẹn</strong> trên menu.
            </p>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Apple Live Activity Stepper — Tiến trình sống động */}
          <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-black/[0.04] dark:border-white/[0.05]">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="flex flex-col items-center gap-1">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  ✓
                </span>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Đã gửi tin</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold animate-pulse shadow-xs">
                  ⚡
                </span>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">Đã rung chuông</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center text-xs font-bold">
                  ⏳
                </span>
                <span className="text-[11px] font-medium text-slate-500">Chờ phản hồi</span>
              </div>
            </div>
          </div>

          {/* Card tóm tắt yêu cầu vừa gửi */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider">
                  Yêu cầu kết nối #{bookingCode}
                </p>
                <p className="font-bold text-slate-900 dark:text-white text-base mt-0.5">
                  {toPublicAlias(item)}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-300 text-xs font-bold tabular">
                {timeSlot}
              </span>
            </div>

            <RouteTimeline from={item.from} to={item.to} compact />

            <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Điểm đón đề xuất:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {pickupPoint || 'Thỏa thuận tiện đường'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-slate-500 dark:text-slate-400">Chi phí dự kiến ({seats} người):</span>
                <p className="font-bold text-emerald-700 dark:text-emerald-400 tabular">
                  {formatVND(pricing.total)}
                </p>
              </div>
            </div>

            {passengerNote && (
              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-emerald-200/60 text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Lời nhắn gửi kèm: </span>
                {passengerNote}
              </div>
            )}
          </div>

          {/* Trigger Siêu Tốc 1-Chạm (Two-Sided Matching Liquidity) */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-slate-900 border border-blue-200/80 dark:border-blue-800/60 shadow-xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                <Zap className="w-5 h-5 fill-current text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {isDriverItem ? 'Tăng 95% cơ hội có xe: Đăng tìm xe' : 'Tăng lấp đầy xe: Đăng chuyến trống'}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300/40">
                    Khuyên dùng
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {isDriverItem
                    ? `Tại sao chỉ đợi 1 xe? Đưa luôn nhu cầu đi ${item.from} ➔ ${item.to} lên Sàn để các chủ xe khác cùng tuyến cũng thấy và chủ động liên hệ đón bạn!`
                    : `Bạn còn ghế trống? Đưa chuyến ${item.from} ➔ ${item.to} lên Sàn để các người tìm xe khác tiện đường đặt chỗ ngay!`}
                </p>
              </div>
            </div>

            {postedDemand ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Đã đưa lên Bảng tin CarMate! Các đối tác khác cùng tuyến đang thấy bài của bạn.</span>
              </div>
            ) : (
              <button
                type="button"
                disabled={isPostingDemand}
                onClick={handleAutoPostDemand}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#0071e3] to-[#0055d4] hover:from-[#0077ed] hover:to-[#004bbd] active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75"
              >
                {isPostingDemand ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang đưa bài lên Sàn...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current text-amber-300" />
                    <span>
                      {isDriverItem
                        ? 'Đăng nhu cầu tìm xe lên Bảng tin'
                        : 'Đăng chuyến xe trống lên Bảng tin'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Hộp thoại SLA phản hồi động & Closed-loop Alert */}
          <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 text-amber-900 dark:text-amber-200 space-y-1.5">
            <div className="flex items-center justify-between gap-2 font-bold text-xs flex-wrap">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                <span>Thời gian phản hồi dự kiến: {dynamicSlaText}</span>
              </span>
              <span className="text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Bell className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                Báo qua Telegram/App
              </span>
            </div>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
              Khi chủ xe bấm Xác nhận hoặc có tin nhắn mới, CarMate sẽ báo ngay về Telegram/App của bạn. Bạn yên tâm tắt ứng dụng để làm việc khác mà không lo lỡ chuyến!
            </p>
          </div>

          <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Chỉ khi 2 bên cùng bấm Xác nhận, chuyến đi mới chính thức chốt ghế.</span>
          </p>
        </div>
      </Modal>
    );
  }

  // -------------------------------------------------------------
  // TRẠNG THÁI 1: FORM GỬI LỜI NHẮN HỎI GHÉP CHUYẾN
  // -------------------------------------------------------------
  const footer = isTripOwner ? (
    <div className="space-y-2 w-full">
      <Button
        fullWidth
        size="lg"
        onClick={() => {
          onClose();
          onViewBookedTab?.('my-trips');
        }}
        className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-base py-3.5 cursor-pointer transition-all duration-150 active:scale-[0.99]"
      >
        <SlidersHorizontal className="w-4 h-4 mr-2" />
        <span>Quản lý bài đăng của bạn</span>
      </Button>
    </div>
  ) : (
    <div className="space-y-2 w-full">
      <Button
        fullWidth
        size="lg"
        disabled={submitting}
        onClick={handleSendInquiry}
        className="relative overflow-hidden bg-gradient-to-r from-primary-600 via-blue-600 to-primary-700 hover:from-primary-700 hover:to-blue-800 text-white shadow-md shadow-primary-500/25 font-bold text-base py-3.5 cursor-pointer transition-all duration-150 active:scale-[0.99] group"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Đang gửi yêu cầu...</span>
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 text-amber-300 animate-pulse fill-amber-300" />
              <span>{isDriverItem ? 'Gửi yêu cầu ghép ngay' : 'Gửi đề xuất đón ngay'}</span>
            </>
          )}
        </span>
      </Button>
      <p className="text-center text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1.5 pt-0.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>0đ cọc</span>
      </p>
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={MessageSquare}
      iconTone="primary"
      title={isTripOwner ? 'Bài đăng chuyến đi của bạn' : (isDriverItem ? 'Hỏi ghép chuyến cùng Chủ xe' : 'Đề xuất đón Người tìm xe')}
      subtitle={isTripOwner ? 'Đây là chuyến đi do bạn tạo trên hệ thống' : '0% phí sàn · Trao đổi điểm đón & hành lý trước khi chốt'}
      footer={footer}
    >
      <div className="space-y-4">
        {/* Cảnh báo nếu mở nhầm chuyến của chính mình */}
        {isTripOwner && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-medium flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Đây là bài đăng của chính bạn. Bạn không thể gửi yêu cầu ghép cho chính mình.</span>
          </div>
        )}

        {/* Tóm tắt chuyến đi */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="font-bold text-slate-900 text-base leading-tight">{toPublicAlias(item)}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 font-medium">{item.carType || 'Xe ô tô gia đình'}</span>
                {onViewTrustProfile && (
                  <button
                    type="button"
                    onClick={() => onViewTrustProfile(item)}
                    className="text-xs text-primary-600 font-semibold hover:underline cursor-pointer"
                  >
                    · Xem hồ sơ tín nhiệm
                  </button>
                )}
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200/60 text-xs font-bold tabular">
              {timeSlot}
            </span>
          </div>
          <RouteTimeline from={item.from} to={item.to} compact />
        </div>

        {/* Chọn số lượng người cùng đi */}
        {isDriverItem && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200">
            <span className="text-sm font-semibold text-slate-800 inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600" />
              Số người cùng đi:
            </span>
            <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-slate-100">
              {[1, 2, 3, 4]
                .filter((n) => n <= maxSeats)
                .map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSeats(n)}
                    className={`w-8 h-8 rounded-md text-sm font-bold tabular cursor-pointer transition-all ${
                      seats === n
                        ? 'bg-white text-primary-700 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {n}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Điểm đón mong muốn cụ thể với Hotspots & Dropdown Autocomplete */}
        <div ref={dropdownRef} className="relative p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Điểm hẹn đón mong muốn:
            </label>
            {pickupPoint && (
              <button
                type="button"
                onClick={() => setPickupPoint('')}
                className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Xóa
              </button>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              value={pickupPoint}
              onChange={(e) => {
                setPickupPoint(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="VD: Cổng KCN VSIP 1, Cây xăng Petrolimex..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />

            {/* Dropdown gợi ý */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden py-1 max-h-48 overflow-y-auto anim-fade-in">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPickupPoint(s.name);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{s.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{s.detail}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Gợi ý điểm đón nhanh 1 chạm theo lộ trình (Hotspot Chips) */}
          <div className="space-y-1 pt-1">
            <p className="text-[11px] text-slate-500 font-medium">Gợi ý điểm đón thuận tiện dọc tuyến:</p>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {routeHotspots.map((spot) => (
                <button
                  key={spot}
                  type="button"
                  onClick={() => {
                    setPickupPoint(pickupPoint === spot ? '' : spot);
                    setShowSuggestions(false);
                  }}
                  className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                    pickupPoint === spot
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                  }`}
                >
                  {pickupPoint === spot && <Check className="w-3 h-3 inline mr-1 text-emerald-600 stroke-[3]" />}
                  {spot}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ghi chú thêm cho Chủ xe (Hành lý / Yêu cầu riêng) */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 inline-flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-primary-600" />
              Lời nhắn gửi {isDriverItem ? 'Chủ xe' : 'Người tìm xe'} (Hành lý / Thời gian):
            </label>
            {passengerNote && (
              <button
                type="button"
                onClick={() => setPassengerNote('')}
                className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Quick Note Chips (1-chạm) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              '🧳 1 Vali nhỏ size 20',
              '🎒 Ba lô gọn nhẹ',
              '⏰ Đúng giờ 100%',
              '📍 Tiện đường là đón được'
            ].map((chip) => {
              const isSelected = passengerNote.includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setPassengerNote((prev) =>
                        prev
                          .replace(chip, '')
                          .replace(/^,\s*|,\s*$/g, '')
                          .replace(/,\s*,/g, ',')
                          .trim()
                      );
                    } else {
                      setPassengerNote((prev) =>
                        prev ? `${prev}, ${chip}` : chip
                      );
                    }
                  }}
                  className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 inline mr-1 text-primary-600 stroke-[3]" />}
                  {chip}
                </button>
              );
            })}
          </div>

          <textarea
            rows={2}
            value={passengerNote}
            onChange={(e) => setPassengerNote(e.target.value)}
            placeholder="VD: Em có 1 vali nhỏ size 20, đứng chờ trước cây xăng Petrolimex..."
            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
          />
        </div>

        {/* Đề xuất mức chia sẻ chi phí (Thương lượng văn minh có dải giá an toàn) */}
        {isDriverItem && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 inline-flex items-center gap-1.5">
                <span>Mức phụ xăng:</span>
                <span className="text-[11.5px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {formatVND(effectiveUnitPrice)}/ghế
                </span>
              </label>
              <button
                type="button"
                onClick={() => setShowNegotiate(!showNegotiate)}
                className="text-[11px] font-semibold text-[#0071e3] hover:underline cursor-pointer"
              >
                {showNegotiate ? 'Đóng đề xuất' : 'Đề xuất mức khác?'}
              </button>
            </div>

            {showNegotiate ? (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] text-slate-500">
                  Chọn mức chia sẻ phù hợp (giới hạn tối đa 20% so với giá đề xuất):
                </p>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {[
                    { label: `Giá gốc (${formatVND(baseSeatPrice)})`, price: baseSeatPrice },
                    ...(baseSeatPrice - 15000 >= priceGuardrail.minSafePrice
                      ? [{ label: `-15k (${formatVND(baseSeatPrice - 15000)})`, price: baseSeatPrice - 15000 }]
                      : []),
                    ...(baseSeatPrice - 25000 >= priceGuardrail.minSafePrice && (baseSeatPrice - 25000) >= baseSeatPrice * 0.8
                      ? [{ label: `-25k (${formatVND(baseSeatPrice - 25000)})`, price: baseSeatPrice - 25000 }]
                      : []),
                    ...(baseSeatPrice - 35000 >= priceGuardrail.minSafePrice && (baseSeatPrice - 35000) >= baseSeatPrice * 0.8
                      ? [{ label: `-35k (${formatVND(baseSeatPrice - 35000)})`, price: baseSeatPrice - 35000 }]
                      : [])
                  ].map((chip) => {
                    const isSelected = effectiveUnitPrice === chip.price;
                    return (
                      <button
                        key={chip.price}
                        type="button"
                        onClick={() => setProposedUnitPrice(chip.price)}
                        className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer font-medium ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 inline mr-1 text-emerald-600 stroke-[3]" />}
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10.5px] text-slate-400 leading-tight">
                  * Mức đề xuất hợp lý giúp Chủ xe dễ dàng đồng thuận đón bạn hơn.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Theo mức chia sẻ của Chủ xe ({formatVND(baseSeatPrice)}/ghế)</span>
                {priceGuardrail?.comparisonBadge && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {priceGuardrail.comparisonBadge}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Chi phí chia sẻ minh bạch - 0% phí sàn, KHÔNG THU CỌC */}
        <div className="p-3.5 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white flex items-center justify-between shadow-2xs">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900">Chi phí chia sẻ ({seats} người)</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                0% phí sàn
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {effectiveUnitPrice !== baseSeatPrice ? (
                <span>Đề xuất: {formatVND(effectiveUnitPrice)}/ghế (Giá gốc {formatVND(baseSeatPrice)})</span>
              ) : (
                <span>Trọn gói xăng & cầu đường · Thanh toán khi lên xe</span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display font-black text-xl text-primary-700 tabular leading-none">
              {formatVND(effectiveTotal)}
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Không thu cọc</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
