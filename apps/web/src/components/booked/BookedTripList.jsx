import React, { useState, useMemo } from 'react';
import {
  Clock,
  Phone,
  PhoneCall,
  CheckCircle2,
  Timer,
  ShieldCheck,
  XCircle,
  Share2,
  Check,
  MessageSquare,
  History,
  Star,
  Sparkles,
  Lock,
  Shield,
  ShieldAlert,
  User,
  Car,
  ChevronDown,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  MessageCircle,
  RotateCcw
} from 'lucide-react';
import {
  formatVND,
  getUserOnlineStatus,
  parseTripDate,
  parseLocation,
  resolveDriverRealName,
  maskCustomerPlate
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import EmptyState, { SectionHeader } from '../ui/EmptyState.jsx';
import { RouteTimeline } from '../market/TripCard.jsx';
import PresenceDot from '../ui/PresenceDot.jsx';
import RescueModeBanner from './RescueModeBanner.jsx';
import DriverScheduleCardView from '../cockpit/DriverScheduleCardView.jsx';

const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function formatTicketDateTime(timeSlot, rawDate) {
  const d = parseTripDate(rawDate);
  const weekday = WEEKDAY_NAMES[d.getDay()] || 'Thứ 2';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const time = timeSlot || '';
  return `${time} · ${weekday} (${day}/${month})`;
}



function TripProgressStepper({ status, delayedMinutes, hasSilentFailover }) {
  const isCompleted = status === 'completed';
  const isReassigned = status === 'reassigned' || Boolean(hasSilentFailover);
  const isCancelled = status === 'cancelled' && !isReassigned;
  const isDelayed = status === 'delayed';

  const steps = [
    {
      id: 1,
      label: 'Yêu cầu',
      desc: 'Đã gửi trên CarMate',
      state: 'completed'
    },
    {
      id: 2,
      label: isDelayed ? `Trễ +${delayedMinutes || 15}p` : isReassigned ? 'Xe hỗ trợ' : 'Trao đổi',
      desc: isReassigned ? 'Cần xác nhận lại phương án' : isCancelled ? 'Đã dừng kết nối' : 'Điểm đón & hành lý',
      state: isCompleted ? 'completed' : isReassigned ? 'active' : isCancelled ? 'cancelled' : isDelayed ? 'delayed' : 'active'
    },
    {
      id: 3,
      label: 'Lên xe',
      desc: 'Gửi tiền trực tiếp',
      state: isCompleted ? 'completed' : 'pending'
    },
    {
      id: 4,
      label: 'Đánh giá',
      desc: 'Phản hồi sau chuyến đi',
      state: 'pending'
    }
  ];

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-[#1d1d1f] dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Tiến trình kết nối an toàn</span>
          </span>
          <span className="text-[10px] text-[#86868b] dark:text-slate-400">
            {isCompleted ? 'Đã hoàn tất' : isCancelled ? 'Đã huỷ' : 'Đang xử lý'}
          </span>
        </div>
        <Badge tone={isCompleted ? 'success' : isCancelled ? 'danger' : isDelayed ? 'warning' : 'info'} size="xs">
          {isCompleted ? 'Hoàn tất' : isCancelled ? 'Đã huỷ' : isDelayed ? 'Báo trễ' : 'Đang kết nối'}
        </Badge>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {steps.map((step) => {
          const isDone = step.state === 'completed';
          const isActive = step.state === 'active';
          const isStepDelayed = step.state === 'delayed';
          const isStepCancelled = step.state === 'cancelled';

          return (
            <div
              key={step.id}
              className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all ${
                isDone
                  ? 'bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : isActive
                  ? 'bg-[#0071e3]/10 dark:bg-[#0071e3]/20 border-[#0071e3]/40 text-[#0071e3] dark:text-sky-300 ring-2 ring-[#0071e3]/20'
                  : isStepDelayed
                  ? 'bg-amber-500/10 dark:bg-amber-950/20 border-amber-500/40 text-amber-700 dark:text-amber-300'
                  : isStepCancelled
                  ? 'bg-rose-500/10 dark:bg-rose-950/20 border-rose-500/30 text-rose-700 dark:text-rose-300'
                  : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.04] dark:border-white/[0.04] text-[#86868b] dark:text-slate-500'
              }`}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : isStepCancelled ? (
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                ) : isStepDelayed ? (
                  <Timer className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                ) : (
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${
                      isActive ? 'bg-[#0071e3] text-white' : 'bg-black/10 dark:bg-white/10 text-[#86868b]'
                    }`}
                  >
                    {step.id}
                  </span>
                )}
                <span className="text-[11px] font-bold truncate">{step.label}</span>
              </div>
              <p className="text-[9px] text-[#86868b] dark:text-slate-400 truncate hidden sm:block">
                {step.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function recordAmount(record) {
  const value = record.committedTerms?.totalPrice ?? (record.pricingMode === 'contact' ? null : record.fullTripAmount ?? record.totalDeal ?? record.price);
  return value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
}
function amountLabel(record) {
  const amount = recordAmount(record);
  return amount === null ? 'Chưa chốt giá' : formatVND(amount);
}

export default function BookedTripList({
  bookedEscrows = [],
  currentUser = null,
  onCancel,
  onDelay,
  onComplete,
  onFindTrip,
  onReview,
  onOpenChat,
  onOpenCockpit,
  onOpenQuickPostTrip,
  onShowToast,
  defaultSubTab = null
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState(() => {
    if (defaultSubTab) return defaultSubTab;
    try {
      const preferred = sessionStorage.getItem('carmate_booked_subtab');
      if (preferred === 'driver' || preferred === 'active' || preferred === 'history') {
        return preferred;
      }
    } catch {}
    if (currentUser?.vehicle?.plate || currentUser?.isDriverVerified) {
      return 'driver';
    }
    return 'active';
  });

  const driverVehicle = useMemo(() => {
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
  }, [currentUser]);

  const [copiedId, setCopiedId] = useState(null);


  // Trạng thái Cursor Ambient: Quản lý danh sách thu gọn & mở rộng (Accordion)
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusSubFilter, setStatusSubFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const validBookings = useMemo(() => {
    return (bookedEscrows || []).filter((b) => {
      if (!b) return false;
      const target = b.targetItem || b.targetTrip || {};
      const from = b.from || b.fromLocation || target.from || target.fromLocation;
      const to = b.to || b.toLocation || target.to || target.toLocation;
      return Boolean(from && to);
    });
  }, [bookedEscrows]);

  const activeBookings = useMemo(
    () => validBookings.filter((b) => b.status !== 'completed' && b.status !== 'cancelled'),
    [validBookings]
  );
  const historyBookings = useMemo(
    () => validBookings.filter((b) => b.status === 'completed' || b.status === 'cancelled'),
    [validBookings]
  );

  const baseList = activeTab === 'active' ? activeBookings : historyBookings;

  // Lọc nhanh trực tiếp trên Client < 1ms
  const filteredList = useMemo(() => {
    return baseList.filter((record) => {
      // 1. Lọc theo trạng thái con
      if (activeTab === 'active') {
        if (statusSubFilter === 'connecting' && (record.status === 'confirmed' || record.bothConfirmed)) return false;
        if (statusSubFilter === 'confirmed' && !(record.status === 'confirmed' || record.bothConfirmed)) return false;
        if (statusSubFilter === 'delayed' && record.status !== 'delayed') return false;
      } else {
        if (statusSubFilter === 'completed' && record.status !== 'completed') return false;
        if (statusSubFilter === 'cancelled' && record.status !== 'cancelled') return false;
      }

      // 2. Tìm kiếm theo từ khóa (Mã CX, tên đối tác, lộ trình)
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const matchId = String(record.escrowId || '').toLowerCase().includes(term);
      const matchName = String(record.contactName || '').toLowerCase().includes(term);
      const matchFrom = String(record.from || '').toLowerCase().includes(term);
      const matchTo = String(record.to || '').toLowerCase().includes(term);
      return matchId || matchName || matchFrom || matchTo;
    });
  }, [baseList, activeTab, statusSubFilter, searchTerm]);

  // Phân trang chuẩn Apple: Giữ DOM nhẹ tênh dù có 1000 chuyến
  const totalPages = Math.max(1, Math.ceil(filteredList.length / itemsPerPage));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage, itemsPerPage]);

  // Thao tác 1-chạm: Mở / Đóng chi tiết từng thẻ
  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedIds(new Set(paginatedList.map((r) => r.escrowId || r.id)));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleCopyForFamily = (record) => {
    const totalAmount = recordAmount(record);
    const dateFormatted = formatTicketDateTime(
      record.timeSlot,
      record.targetItem?.date || record.date || record.tripDate || record.targetTrip?.date || record.createdAt
    );
    const hostName = resolveDriverRealName(record.targetItem || record.targetTrip || record, record.contactName || 'Chủ xe');
    const text = `[CARMATE] THÔNG TIN CHUYẾN ĐI TIỆN ĐƯỜNG (GỬI NGƯỜI THÂN)\n• Mã chuyến: #${String(record.escrowId || '').replace(/^#/, '')}\n• Lộ trình: ${record.from} ➔ ${record.to}\n• Thời gian: ${dateFormatted}\n• Chủ xe: ${hostName}\n• Giá chuyến đi: ${totalAmount === null ? 'Chưa chốt giá' : formatVND(totalAmount)} (${record.seats || 1} người · Hai bên tự chốt thanh toán)\n• Theo dõi lộ trình: https://carmate.vn`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch (e) {
      console.warn('Copy error:', e);
    }
    setCopiedId(record.escrowId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSendSMS = (record) => {
    const totalAmount = recordAmount(record);
    const dateFormatted = formatTicketDateTime(
      record.timeSlot,
      record.targetItem?.date || record.date || record.tripDate || record.targetTrip?.date || record.createdAt
    );
    const hostName = resolveDriverRealName(record.targetItem || record.targetTrip || record, record.contactName || 'Chủ xe');
    const text = `Thong tin chuyen di CarMate #${String(record.escrowId || '').replace(/^#/, '')}: ${record.from} ve ${record.to}, thoi gian ${dateFormatted}, chu xe ${hostName}, gia ${totalAmount === null ? 'Chưa chốt giá' : formatVND(totalAmount)}. Xem tai carmate.vn`;
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_self');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header Tiêu Đề */}
      <SectionHeader
        icon={Clock}
        title={t('booked.title') || 'Chuyến của tôi'}
        description="Yêu cầu, lịch đón và lịch sử · Kết nối miễn phí"
        action={
          <Badge tone="success" icon={ShieldCheck} className="h-7 px-2.5 font-medium">
            {t('booked2.s003')}
          </Badge>
        }
      />

      {/* Tabs Chuyển Đổi: Đăng chuyến & Taplo (T1) | Sắp đi (T2) | Lịch sử (T3) */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/80 dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs">
        {/* Tab 1: Đăng chuyến & Taplo */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('driver');
            try { sessionStorage.setItem('carmate_booked_subtab', 'driver'); } catch {}
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'driver'
              ? 'bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] shadow-xs'
              : 'text-[#86868b] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-white'
          }`}
        >
          <Car className={`w-4 h-4 ${activeTab === 'driver' ? 'text-emerald-400 dark:text-emerald-600' : 'text-emerald-500'}`} />
          <span>Đăng chuyến & Taplo</span>
        </button>

        {/* Tab 2: Sắp đi */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('active');
            setStatusSubFilter('all');
            setCurrentPage(1);
            try { sessionStorage.setItem('carmate_booked_subtab', 'active'); } catch {}
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] shadow-xs'
              : 'text-[#86868b] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{t('booked2.s004') || 'Sắp đi'}</span>
          <span
            className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold tabular ${
              activeTab === 'active'
                ? 'bg-white/20 dark:bg-black/10 text-white dark:text-[#1d1d1f]'
                : 'bg-black/[0.06] dark:bg-white/[0.1] text-[#515154] dark:text-slate-300'
            }`}
          >
            {activeBookings.length}
          </span>
        </button>

        {/* Tab 3: Lịch sử */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('history');
            setStatusSubFilter('all');
            setCurrentPage(1);
            try { sessionStorage.setItem('carmate_booked_subtab', 'history'); } catch {}
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] shadow-xs'
              : 'text-[#86868b] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{t('booked2.s005') || 'Lịch sử'}</span>
          <span
            className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold tabular ${
              activeTab === 'history'
                ? 'bg-white/20 dark:bg-black/10 text-white dark:text-[#1d1d1f]'
                : 'bg-black/[0.06] dark:bg-white/[0.1] text-[#515154] dark:text-slate-300'
            }`}
          >
            {historyBookings.length}
          </span>
        </button>
      </div>

      {/* ── NỘI DUNG TAB 1: ĐĂNG CHUYẾN & TAPLO CHỦ XE ── */}
      {activeTab === 'driver' && (
        <div className="pt-1 animate-fade-in">
          <DriverScheduleCardView
            currentUser={currentUser}
            onOpenBookings={() => setActiveTab('active')}
            vehicle={driverVehicle}
            onSwitchToRadar={onOpenCockpit}
            onShowToast={onShowToast}
            onOpenQuickPostTrip={onOpenQuickPostTrip}
          />
        </div>
      )}

      {/* ── NỘI DUNG TAB 2 & 3: VÉ XE HÀNH KHÁCH (SẮP ĐI & LỊCH SỬ) ── */}
      {activeTab !== 'driver' && (
        <div className="space-y-5 animate-fade-in">
          {/* Thanh Tìm Kiếm & Lọc Nhanh Chuẩn Cursor Ambient (< 1ms) */}
      {baseList.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Ô tìm kiếm tức thì */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t('booked2.s051')}
                className="w-full h-10 pl-9.5 pr-8 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/80 border border-black/[0.06] dark:border-white/[0.08] text-xs sm:text-sm text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-hidden focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Chips lọc trạng thái con */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {activeTab === 'active' ? (
                <>
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'confirmed', label: 'Đã chốt' },
                    { id: 'connecting', label: 'Đang trao đổi' },
                    { id: 'delayed', label: 'Báo trễ' }
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        setStatusSubFilter(chip.id);
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        statusSubFilter === chip.id
                          ? 'bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] shadow-2xs'
                          : 'bg-[#f5f5f7] dark:bg-slate-800/60 text-[#86868b] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-white'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'completed', label: 'Đã hoàn tất' },
                    { id: 'cancelled', label: 'Đã huỷ' }
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        setStatusSubFilter(chip.id);
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        statusSubFilter === chip.id
                          ? 'bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] shadow-2xs'
                          : 'bg-[#f5f5f7] dark:bg-slate-800/60 text-[#86868b] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-white'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Thanh tổng quan số lượng & Nút mở/thu gọn nhanh */}
          <div className="flex items-center justify-between text-xs text-[#86868b] px-1 font-medium">
            <span>
              {searchTerm
                ? `Tìm thấy ${filteredList.length} kết quả`
                : `Đang hiển thị ${filteredList.length} chuyến`}
            </span>
            {filteredList.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="hover:text-[#0071e3] transition-colors cursor-pointer"
                >
                  {t('booked2.s006')}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="hover:text-[#0071e3] transition-colors cursor-pointer"
                >
                  {t('booked2.s007')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Danh Sách Chuyến (Compact Accordion List) */}
      {baseList.length === 0 ? (
        <div className="py-8">
          <EmptyState
            icon={activeTab === 'active' ? Clock : History}
            title={activeTab === 'active' ? 'Chưa có chuyến đi nào đang chờ' : 'Chưa có lịch sử chuyến'}
            description={
              activeTab === 'active'
                ? 'Tìm chuyến xe cùng tuyến để kết nối bạn đồng hành ngay.'
                : 'Các chuyến đi bạn đã hoàn thành hoặc huỷ sẽ lưu lại tại đây.'
            }
            action={<Button onClick={onFindTrip}>{t('booked2.s008')}</Button>}
          />
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.08] space-y-2">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t('booked2.s009')}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusSubFilter('all');
            }}
            className="text-xs text-[#0071e3] hover:underline font-semibold cursor-pointer"
          >
            {t('booked2.s010')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedList.map((record) => {
            const target = record.targetItem || record.targetTrip || record;
            const hasSilentFailover =
              record.status === 'reassigned' ||
              Boolean(record.salvageInfo?.supportDispatched) ||
              Boolean(record.supportDispatched);
            const isCompleted = record.status === 'completed';
            const isCancelled = record.status === 'cancelled' && !hasSilentFailover;
            const isDelayed = record.status === 'delayed';
            const partnerOnline = getUserOnlineStatus(target, currentUser?.phone || currentUser?.id);

            const rawTripDate =
              record.targetItem?.date || record.date || record.tripDate || record.targetTrip?.date || record.createdAt;
            const ticketDateLabel = formatTicketDateTime(record.timeSlot, rawTripDate);

            const isExpanded = expandedIds.has(record.escrowId || record.id);
            const fromParsed = parseLocation(record.from);
            const toParsed = parseLocation(record.to);

            const hostName = resolveDriverRealName(target, record.driverName || record.contactName || '');
            const carModel = record.vehicleModel || record.carModel || target.carModel || target.vehicleModel || '';
            const maskedPlate = maskCustomerPlate(target, '');
            const vehicleInfo = `${carModel} (${maskedPlate})`;

            const pickupStation = record.committedTerms?.pickupPoint || record.pickupPoint || record.from || record.fromLocation || target.from || target.fromLocation || 'Chưa rõ điểm đón';
            const dropoffStation = record.committedTerms?.dropoffPoint || record.dropoffPoint || record.to || record.toLocation || target.to || target.toLocation || 'Chưa rõ điểm đến';

            const rawDriverPhone = record.driverPhone || record.phoneReal || record.contactPhone || target.phoneReal || target.phone || '';
            const cleanCallPhone = String(rawDriverPhone).replace(/\D/g, '');
            // Chỉ gọi được khi có số ĐẦY ĐỦ, hợp lệ.
            // - KHÔNG fallback sang số quản trị viên khi vé thiếu SĐT.
            // - Số đang bị che ('098***3750') sau khi bỏ ký tự lạ còn '0983750' — bảy chữ số
            //   vẫn "truthy" nên trước đây tạo ra link tel: tới một số rác.
            const isCallablePhone = /^0\d{9}$/.test(cleanCallPhone);
            const callPhone = isCallablePhone ? cleanCallPhone : '';

            const needsRescueWatch = !isCompleted && !isCancelled;

            // ── TAB 1: THẺ CHUYẾN ĐANG DIỄN RA (TAB "SẮP ĐI" - TRỌNG TÂM CHÍNH) ──
            if (activeTab === 'active') {
              return (
                <article
                  key={record.escrowId || record.id}
                  className="overflow-hidden rounded-3xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs hover:shadow-md transition-all duration-200"
                >
                  {/* CHẾ ĐỘ CỨU HỘ */}
                  {needsRescueWatch && (
                    <div className="p-3.5 pb-0">
                      <RescueModeBanner bookingId={record.escrowId || record.id} />
                    </div>
                  )}

                  <div className="p-4 sm:p-5.5 space-y-4">
                    {/* Header Thẻ: Mã chuyến xe & Badge trạng thái */}
                    <div className="flex items-center justify-between gap-2.5 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm sm:text-base text-[#0071e3] tracking-tight bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 px-3 py-1 rounded-xl">
                          #{String(record.escrowId || record.id || '').replace(/^#/, '')}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">·</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline">
                          {record.seats || 1} ghế
                        </span>
                      </div>

                      {/* Badge trạng thái */}
                      <div>
                        {record.needsReplacement || ['inquiring', 'pre_confirmed', 'expired'].includes(record.status) ? (
                          <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200">{record.needsReplacement ? 'Đang tìm xe thay thế' : record.status === 'pre_confirmed' ? 'Chờ bên còn lại xác nhận' : 'Chưa có lịch đón đã chốt'}</span>
                        ) : isDelayed ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-300/60">
                            <Timer className="w-3.5 h-3.5 text-amber-500" />
                            <span>Báo trễ +{record.delayedMinutes || 15}p</span>
                          </span>
                        ) : hasSilentFailover ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-300/60">
                            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                            <span>Xe hỗ trợ</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{record.status === 'confirmed' ? 'Đã xác nhận đón' : 'Cần xem trạng thái'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Thời gian & Hành trình */}
                    <div className="space-y-3 py-3.5 border-y border-dashed border-slate-200 dark:border-white/10">
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        <Calendar className="w-4 h-4 text-[#0071e3] shrink-0" />
                        <span className="font-semibold text-[#0071e3] dark:text-[#3898ec]">
                          {ticketDateLabel}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs sm:text-[13px] pl-0.5">
                        <div className="flex items-start gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 ring-4 ring-emerald-100 dark:ring-emerald-950/80" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Điểm đón</p>
                            <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-[13.5px] leading-snug">
                              {pickupStation}
                            </p>
                          </div>
                        </div>

                        <div className="w-0.5 h-3.5 bg-slate-200 dark:bg-slate-700 ml-1 rounded-full" />

                        <div className="flex items-start gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full border-2 border-[#0071e3] bg-white dark:bg-slate-900 mt-1 shrink-0 ring-4 ring-blue-100 dark:ring-blue-950/80" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Điểm đến</p>
                            <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-[13.5px] leading-snug">
                              {dropoffStation}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Thông tin phương tiện & Chủ xe */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-white/5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[#0071e3] flex items-center justify-center font-bold text-xs shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold">Chủ xe</p>
                            <PresenceDot isOnline={partnerOnline.isOnline} size="xs" detail={partnerOnline.detail} />
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white truncate text-xs sm:text-[13px]">{hostName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-white/5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                          <Car className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold">Xe & Biển số</p>
                          <p className="font-bold text-slate-900 dark:text-white truncate text-xs sm:text-[13px]">{vehicleInfo}</p>
                        </div>
                      </div>
                    </div>

                    {/* Chi phí & Cam kết 0đ cọc */}
                    <div className="flex items-baseline gap-2 flex-wrap text-xs pt-0.5">
                      <span className="text-base sm:text-lg font-bold text-[#1d1d1f] dark:text-white font-mono">
                        {amountLabel(record)}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 font-medium">·</span>
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold text-xs sm:text-[12.5px]">
                        Hai bên tự chốt thanh toán
                      </span>
                    </div>

                    <button type="button" onClick={() => onOpenChat?.(record.escrowId || record.id)} className="w-full p-3 rounded-xl bg-[#0071e3] text-white font-semibold text-sm">{record.needsReplacement ? 'Xem phương án thay thế và trao đổi' : 'Xem trao đổi và xác nhận phương án'}</button>
                    {record.needsReplacement && <p className="text-sm text-amber-800 dark:text-amber-200">Chưa có xe thay thế đã chốt. Nhu cầu ban đầu được giữ; hai bên cần xác nhận phương án mới trước khi đón.</p>}
                    {/* Cụm nút hành động nhanh (Quick Actions) */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                      {callPhone ? (
                        <>
                          <a
                            href={`tel:${callPhone}`}
                            className="flex-1 min-w-[130px] h-11 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          >
                            <PhoneCall className="w-4 h-4 shrink-0" />
                            <span>Gọi chủ xe</span>
                          </a>

                          <a
                            href={`https://zalo.me/${callPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 min-w-[130px] h-11 px-3 rounded-2xl bg-[#0068ff] hover:bg-[#0058db] active:scale-[0.98] text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          >
                            <MessageCircle className="w-4 h-4 shrink-0" />
                            <span>Nhắn Zalo</span>
                          </a>
                        </>
                      ) : (
                        <div className="flex-1 min-w-[130px] h-11 px-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-400 font-semibold text-xs inline-flex items-center justify-center gap-1.5">
                          <PhoneCall className="w-4 h-4 shrink-0" />
                          <span>Chưa có số liên hệ được chia sẻ</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => onCancel?.(record)}
                        className="h-11 px-3.5 rounded-2xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:text-slate-400 dark:hover:text-rose-300 border border-slate-200/80 dark:border-white/10 font-semibold text-xs transition-colors cursor-pointer shrink-0"
                      >
                        Hủy chuyến
                      </button>
                    </div>

                    {/* Thanh mở rộng chi tiết / Hoàn tất */}
                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => toggleExpand(record.escrowId || record.id)}
                        className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-[#0071e3] transition-colors cursor-pointer"
                      >
                        <span>{isExpanded ? 'Thu gọn chi tiết' : 'Chi tiết yêu cầu và lịch đón'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[#0071e3]' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onComplete?.(record.escrowId, record)}
                        disabled={record.needsReplacement || !['confirmed', 'delayed', 'boarded', 'in_progress'].includes(record.status)}
                        className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Đã đến nơi</span>
                      </button>
                    </div>
                  </div>

                  {/* Khối chi tiết mở rộng nếu bấm xem thêm */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-slate-900/40 p-4 sm:p-5 space-y-3.5 text-xs">
                      {!record.needsReplacement && ['confirmed', 'delayed', 'completed', 'cancelled'].includes(record.status) && <TripProgressStepper status={record.status} delayedMinutes={record.delayedMinutes} hasSilentFailover={hasSilentFailover} />}

                      <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyForFamily(record)}
                            className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#0071e3] inline-flex items-center gap-1.5 cursor-pointer py-1.5 px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-2xs"
                          >
                            {copiedId === record.escrowId ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-600">Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                                <span>Gửi cho người thân</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendSMS(record)}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 py-1.5 px-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>SMS</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onDelay?.(record)}
                            className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 py-1.5 px-2.5 rounded-xl inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Timer className="w-3.5 h-3.5" />
                            <span>Báo trễ</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenChat?.(record.escrowId || record.id)}
                            className="text-xs font-bold text-[#0071e3] hover:bg-blue-50 dark:hover:bg-blue-950/40 py-1.5 px-2.5 rounded-xl inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat trên CarMate</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            }

            // ── TAB 2: THẺ LỊCH SỬ CHUYẾN (COMPACT CARD & PRIVACY PROTECTED) ──
            return (
              <article
                key={record.escrowId || record.id}
                className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    #{String(record.escrowId || record.id || '').replace(/^#/, '')}
                  </span>

                  <div>
                    {isCompleted ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Đã hoàn thành
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        Đã hủy
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                  <span className="truncate">{fromParsed.main}</span>
                  <span className="text-slate-400 shrink-0">➔</span>
                  <span className="truncate">{toParsed.main}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{ticketDateLabel}</span>
                  <span>·</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{amountLabel(record)}</span>
                  <span>·</span>
                  <span>{record.seats || 1} ghế</span>
                </div>

                {/* Thông tin Chủ xe & Xe (Số điện thoại và nút gọi được ẨN HOÀN TOÀN để bảo mật) */}
                <div className="text-[11.5px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                  <span>Chủ xe: <strong className="text-slate-700 dark:text-slate-300">{hostName}</strong></span>
                  <span className="mx-1.5">·</span>
                  <span>Xe: <strong className="text-slate-700 dark:text-slate-300">{vehicleInfo}</strong></span>
                </div>

                <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                    {isCompleted ? '✓ Chuyến đi an toàn' : `Lý do hủy: ${record.cancelReason || 'Thay đổi lịch trình'}`}
                  </div>

                  <div className="flex items-center gap-2">
                    {isCompleted && onReview && (
                      <button
                        type="button"
                        onClick={() => onReview(record)}
                        className="font-semibold text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 py-1.5 px-3 rounded-xl inline-flex items-center gap-1 hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        <span>{record.reviews?.length > 0 ? 'Sửa đánh giá' : 'Đánh giá'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onFindTrip?.(record)}
                      className="py-2 px-3.5 rounded-xl font-bold text-xs text-white bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Đặt lại chuyến này</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {/* ── 3. THANH PHÂN TRANG CHUẨN APPLE (PAGINATION) ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 pb-2 px-1 text-xs text-[#86868b] dark:text-slate-400">
              <span>
                Trang {currentPage} / {totalPages} (Tổng {filteredList.length} chuyến)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer inline-flex items-center gap-1 font-medium"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{t('booked2.s050')}</span>
                </button>

                {/* Các nút số trang */}
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`w-9 h-9 rounded-lg text-xs font-semibold tabular transition-all cursor-pointer ${
                        currentPage === p
                          ? 'bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] shadow-2xs'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#86868b]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer inline-flex items-center gap-1 font-medium"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )}
</div>
  );
}
