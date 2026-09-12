import React, { useState, useMemo } from 'react';
import {
  Clock,
  Phone,
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
  ChevronDown,
  Search,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { formatVND, toPublicAlias, getUserOnlineStatus, formatCleanDateLabel, parseLocation, isEmergencyPhoneUnlocked } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import EmptyState, { SectionHeader } from '../ui/EmptyState.jsx';
import { RouteTimeline } from '../market/TripCard.jsx';
import PresenceDot from '../ui/PresenceDot.jsx';
import RescueModeBanner from './RescueModeBanner.jsx';



function TripProgressStepper({ status, delayedMinutes, hasSilentFailover }) {
  const { t } = useI18n();
  const isCompleted = status === 'completed';
  const isReassigned = status === 'reassigned' || Boolean(hasSilentFailover);
  const isCancelled = status === 'cancelled' && !isReassigned;
  const isDelayed = status === 'delayed';

  const steps = [
    {
      id: 1,
      label: 'Khớp xe',
      desc: 'Chi phí xăng & phí cầu đường',
      state: 'completed'
    },
    {
      id: 2,
      label: isDelayed ? `Trễ +${delayedMinutes || 15}p` : isReassigned ? 'Xe hỗ trợ' : 'Trao đổi',
      desc: isReassigned ? 'Đang điều phối tiếp quản' : isCancelled ? 'Đã dừng kết nối' : 'Điểm đón & hành lý',
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
      label: 'Tín nhiệm',
      desc: isCompleted ? 'Đã ghi nhận' : 'Đánh giá 2 chiều',
      state: isCompleted ? 'completed' : 'pending'
    }
  ];

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-[#1d1d1f] dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>{t('booked2.s001')}</span>
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-slate-800 text-[#86868b] border border-black/[0.04]">
            {t('booked2.s002')}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-[#86868b] tabular">
          {isCompleted
            ? '4/4 hoàn tất'
            : isReassigned
              ? 'Bước 2/4 (Xe hỗ trợ)'
              : isCancelled
                ? 'Đã dừng'
                : isDelayed
                  ? 'Bước 2/4 (Báo trễ)'
                  : 'Bước 2/4 đang kết nối'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {steps.map((step) => {
          const isDone = step.state === 'completed';
          const isActive = step.state === 'active';
          const isDelayState = step.state === 'delayed';
          const isCancelState = step.state === 'cancelled';

          return (
            <div
              key={step.id}
              className={`p-2 sm:p-2.5 rounded-xl border transition-all ${
                isDone
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-200'
                  : isActive
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-100 ring-1 ring-blue-500/25'
                    : isDelayState
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
                      : isCancelState
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 text-rose-900'
                        : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.04] text-[#86868b] opacity-60'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5 sm:mb-1">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0 ${
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : isActive
                        ? 'bg-[#0071e3] text-white shadow-xs'
                        : isDelayState
                          ? 'bg-amber-500 text-white'
                          : isCancelState
                            ? 'bg-rose-500 text-white'
                            : 'bg-black/[0.08] dark:bg-white/[0.1] text-[#86868b]'
                  }`}
                >
                  {isDone ? '✓' : isCancelState ? '✕' : step.id}
                </span>
                <span className="text-[10.5px] sm:text-[11.5px] font-bold leading-tight truncate">{step.label}</span>
              </div>
              <p className="text-[9.5px] sm:text-[10.5px] leading-tight opacity-75 truncate font-medium">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BookedTripList({
  bookedEscrows = [],
  currentUser = null,
  onCancel,
  onDelay,
  onComplete,
  onFindTrip,
  onReview,
  onOpenChat
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [copiedId, setCopiedId] = useState(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState(null);


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
    const totalAmount = record.fullTripAmount || record.totalDeal || 0;
    const dateFormatted = formatCleanDateLabel(
      record.targetItem?.date || record.date || record.tripDate || record.targetTrip?.date || record.createdAt
    );
    const phoneDisplay = 'Bảo mật (Trao đổi trực tiếp qua app CarMate)';
    const text = `[CARMATE] THÔNG TIN CHUYẾN ĐI TIỆN ĐƯỜNG (GỬI NGƯỜI THÂN)\n• Mã chuyến: ${record.escrowId}\n• Lộ trình: ${record.from} ➔ ${record.to}\n• Thời gian: ${record.timeSlot} (${dateFormatted})\n• Đối tác: ${record.contactName} (${phoneDisplay})\n• Đóng góp nhiên liệu: ${formatVND(totalAmount)} (${record.seats} ghế · Trọn gói xăng & cầu đường, gửi khi lên xe)\n• Theo dõi lộ trình: https://carmate.vn`;

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
    const totalAmount = record.fullTripAmount || record.totalDeal || 0;
    const dateFormatted = formatCleanDateLabel(
      record.targetItem?.date || record.date || record.tripDate || record.targetTrip?.date || record.createdAt
    );
    const phoneDisplay = 'Bảo mật qua CarMate';
    const text = `Thong tin chuyen di CarMate ${record.escrowId}: ${record.from} ve ${record.to}, ngay ${dateFormatted}, gio ${record.timeSlot}, doi tac ${record.contactName} (${phoneDisplay}), gia ${formatVND(totalAmount)}. Xem tai carmate.vn`;
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_self');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header Tiêu Đề */}
      <SectionHeader
        icon={Clock}
        title={t('booked.title')}
        description="Lịch hẹn đi chung xe · Cam kết đồng hành 0đ phí sàn · Trực tiếp kết nối bạn đồng hành"
        action={
          <Badge tone="success" icon={ShieldCheck} className="h-7 px-2.5 font-medium">
            {t('booked2.s003')}
          </Badge>
        }
      />

      {/* Tabs Chuyển Đổi: Đang Hoạt Động vs Lịch Sử */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-[#e8e8ed]/90 dark:bg-slate-800/80 border border-black/[0.04] dark:border-white/[0.06]">
        <button
          type="button"
          onClick={() => {
            setActiveTab('active');
            setStatusSubFilter('all');
            setCurrentPage(1);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-white dark:bg-slate-900 text-[#1d1d1f] dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-bold'
              : 'text-[#86868b] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-white'
          }`}
        >
          <Clock className={`w-4 h-4 ${activeTab === 'active' ? 'text-[#0071e3]' : 'text-[#86868b]'}`} />
          <span>{t('booked2.s004')}</span>
          <span
            className={`ml-1 px-2 py-0.2 rounded-full text-[11px] font-bold tabular ${
              activeTab === 'active'
                ? 'bg-[#0071e3] text-white'
                : 'bg-black/[0.08] dark:bg-white/[0.1] text-[#515154] dark:text-slate-300'
            }`}
          >
            {activeBookings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('history');
            setStatusSubFilter('all');
            setCurrentPage(1);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-white dark:bg-slate-900 text-[#1d1d1f] dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-bold'
              : 'text-[#86868b] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-white'
          }`}
        >
          <History className={`w-4 h-4 ${activeTab === 'history' ? 'text-[#0071e3]' : 'text-[#86868b]'}`} />
          <span>{t('booked2.s005')}</span>
          <span
            className={`ml-1 px-2 py-0.2 rounded-full text-[11px] font-bold tabular ${
              activeTab === 'history'
                ? 'bg-[#0071e3] text-white'
                : 'bg-black/[0.08] dark:bg-white/[0.1] text-[#515154] dark:text-slate-300'
            }`}
          >
            {historyBookings.length}
          </span>
        </button>
      </div>

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
        <div className="space-y-3">
          {paginatedList.map((record) => {
            const totalCost = record.fullTripAmount || record.totalDeal || 0;
            const hasSilentFailover =
              record.status === 'reassigned' ||
              Boolean(record.salvageInfo?.supportDispatched) ||
              Boolean(record.supportDispatched);
            const isCompleted = record.status === 'completed';
            const isCancelled = record.status === 'cancelled' && !hasSilentFailover;
            const isDelayed = record.status === 'delayed';
            const isConfirmed = record.status === 'confirmed' || record.bothConfirmed === true;
            const partnerOnline = getUserOnlineStatus(record.targetItem || record, currentUser?.phone || currentUser?.id);
            const rawTripDate =
              record.targetItem?.date || record.date || record.tripDate || record.targetTrip?.date || record.createdAt;
            const tripDateLabel = formatCleanDateLabel(rawTripDate);

            const isExpanded = expandedIds.has(record.escrowId || record.id);
            const fromParsed = parseLocation(record.from);
            const toParsed = parseLocation(record.to);

            const partnerPhone = record.contactPhone || record.driverPhone || record.passengerPhone || record.phoneReal || '';
            const isEmergencyUnlocked = isEmergencyPhoneUnlocked({
              bookingId: record.escrowId || record.id,
              callerId: currentUser?.phone || currentUser?.id
            });

            // Chuyến đã xong hoặc đã huỷ thì không còn gì để cứu hộ nữa
            const needsRescueWatch = !isCompleted && !isCancelled;

            return (
              <article
                key={record.escrowId || record.id}
                className="surface overflow-hidden rounded-2xl sm:rounded-3xl border border-black/[0.08] dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_28px_-8px_rgba(0,0,0,0.08)] hover:border-[#0071e3]/40 dark:hover:border-sky-400/40 transition-all duration-200"
              >
                {/* CHẾ ĐỘ CỨU HỘ: tự hiện khi máy chủ bật cờ ở mốc T-20, đặt trên
                    cùng thẻ chuyến để khách nhìn thấy ngay mà không phải bấm gì. */}
                {needsRescueWatch && (
                  <div className="p-3 pb-0">
                    <RescueModeBanner bookingId={record.escrowId || record.id} />
                  </div>
                )}
                {/* ── 1. KHỐI THU GỌN TINH TẾ (COMPACT SUMMARY ROW) ── */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(record.escrowId || record.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(record.escrowId || record.id);
                    }
                  }}
                  className="p-4 sm:p-5 flex flex-col gap-3 cursor-pointer select-none transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.02]"
                >
                  {/* Dòng 1: Mã CX, Đối tác, PresenceDot & Badge Trạng Thái */}
                  <div className="flex items-center justify-between gap-2.5 flex-wrap">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20 inline-flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </span>
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-display font-bold text-sm text-[#0071e3] tabular tracking-tight">
                          {record.escrowId}
                        </span>
                        <span className="text-[#86868b]">·</span>
                        <span className="font-bold text-sm text-[#1d1d1f] dark:text-white truncate">
                          {toPublicAlias(record.contactName)}
                        </span>
                        <PresenceDot isOnline={partnerOnline.isOnline} size="xs" detail={partnerOnline.detail} />
                      </div>
                    </div>

                    {/* Badge trạng thái dứt khoát */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isCompleted ? (
                        <Badge tone="success" icon={CheckCircle2} className="h-6.5 px-2.5 text-[11px] font-semibold">
                          {t('booked2.s011')}
                        </Badge>
                      ) : hasSilentFailover ? (
                        <Badge tone="primary" icon={Sparkles} className="h-6.5 px-2.5 text-[11px] font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                          {t('booked2.s012')}
                        </Badge>
                      ) : isCancelled ? (
                        <Badge tone="danger" icon={XCircle} className="h-6.5 px-2.5 text-[11px] font-semibold">
                          {t('booked2.s013')}
                        </Badge>
                      ) : isDelayed ? (
                        <Badge tone="warning" icon={Timer} className="h-6.5 px-2.5 text-[11px] font-semibold">
                          Trễ +{record.delayedMinutes || 15} phút
                        </Badge>
                      ) : isConfirmed ? (
                        <Badge tone="success" icon={CheckCircle2} className="h-6.5 px-2.5 text-[11px] font-semibold">
                          {t('booked2.s014')}
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{t('booked2.s015')}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dòng 2: Lộ Trình Tuyến Đường & Thời Gian (Đồng Bộ Chuẩn Apple HIG) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 font-bold text-[#1d1d1f] dark:text-white min-w-0">
                      <span className="text-[14.5px] sm:text-[15.5px] font-bold tracking-tight truncate max-w-[44%]">
                        {fromParsed.main}
                      </span>
                      <div className="shrink-0 flex items-center px-0.5 text-slate-400 dark:text-slate-500 transition-colors">
                        <svg
                          className="w-7 h-3 text-current shrink-0"
                          viewBox="0 0 28 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M2 6h22.5M18.5 2.5L24.5 6L18.5 9.5" />
                        </svg>
                      </div>
                      <span className="text-[14.5px] sm:text-[15.5px] font-bold tracking-tight truncate max-w-[44%]">
                        {toParsed.main}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[#86868b] dark:text-slate-400 shrink-0 font-medium">
                      <Clock className="w-3.5 h-3.5 text-[#0071e3]" />
                      <span className="tabular font-semibold text-[#1d1d1f] dark:text-slate-200">
                        {record.timeSlot}
                      </span>
                      {tripDateLabel && <span className="tabular">· {tripDateLabel}</span>}
                    </div>
                  </div>

                  {/* Dòng 3: Chi Phí Xăng Xe & Nút Thao Tác Nhanh */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04] text-xs">
                    <div className="flex items-center gap-2 text-[#86868b] dark:text-slate-400">
                      <span className="text-sm sm:text-base font-bold text-[#1d1d1f] dark:text-white tabular font-display">
                        {formatVND(totalCost)}
                      </span>
                      <span>·</span>
                      <span>{record.seats} ghế</span>
                      <span className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline text-emerald-600 dark:text-emerald-400 font-medium">
                        {t('booked2.s016')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCompleted && !isCancelled && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenChat?.(record.escrowId || record.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{t('booked2.s017')}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(record.escrowId || record.id);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl font-semibold text-xs inline-flex items-center gap-1 transition-all cursor-pointer ${
                          isExpanded
                            ? 'bg-[#0071e3]/10 text-[#0071e3]'
                            : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08]'
                        }`}
                      >
                        <span>{isExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180 text-[#0071e3]' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── 2. KHỐI CHI TIẾT MỞ RỘNG (EXPANDED ACCORDION) ── */}
                {isExpanded && (
                  <div className="border-t border-black/[0.06] dark:border-white/[0.06] bg-[#fafafa] dark:bg-slate-900/60 p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                    {/* THÔNG BÁO ĐIỀU PHỐI XE HỖ TRỢ (SILENT FALLBACK N+1) */}
                    {hasSilentFailover && (
                      <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-bold uppercase tracking-wider">
                          <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />
                          <span>{t('booked2.s018')}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
                          {t('booked2.s019')} <strong>{record.salvageInfo?.supportVehicleModel || 'Toyota Vios (Đen)'}</strong> (<strong>{record.salvageInfo?.supportPlate || '61A - 892.41'}</strong>), do <strong>{record.salvageInfo?.supportDriverName || 'Anh Hải (Chủ xe)'}</strong> {t('booked2.s020')} <strong>{record.salvageInfo?.supportPickupTime || '06:25'}</strong>.
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{t('booked2.s021')}</span>
                        </div>
                      </div>
                    )}

                    {/* Quy trình kết nối an toàn 4 bước */}
                    <TripProgressStepper status={record.status} delayedMinutes={record.delayedMinutes} hasSilentFailover={hasSilentFailover} />

                    {/* Lộ Trình & Thời Gian Chi Tiết */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08]">
                      <div className="flex items-center justify-between gap-3 mb-3 text-xs sm:text-[13px]">
                        <span className="font-semibold text-[#1d1d1f] dark:text-white tabular">
                          {record.timeSlot} {tripDateLabel ? `· ${tripDateLabel}` : ''}
                        </span>
                        <span className="text-[#86868b] font-medium">{record.seats} người đồng hành</span>
                      </div>
                      <RouteTimeline from={record.from} to={record.to} compact />
                    </div>

                    {/* Thẻ Liên Lạc & Khung Chat Chuẩn MIT 2-Phase Commit */}
                    {!isCompleted && !isCancelled && (
                      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] p-4 sm:p-5 shadow-[0_2px_16px_rgba(0,0,0,0.04)] space-y-3.5">
                        {/* Hàng Tiêu Đề Đối Tác */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.05] dark:border-white/[0.06]">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0071e3] to-[#5ac8fa] text-white flex items-center justify-center shadow-xs ring-2 ring-[#0071e3]/20">
                                <User className="w-5 h-5 text-white" strokeWidth={2.2} />
                              </div>
                              <span
                                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold ring-2 ring-white dark:ring-slate-900"
                                title={t('booked2.s052')}
                              >
                                ✓
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-sm text-[#1d1d1f] dark:text-white">{record.contactName}</p>
                                <PresenceDot isOnline={partnerOnline.isOnline} showLabel detail={partnerOnline.detail} />
                                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 inline-flex items-center gap-1">
                                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                  <span>{t('booked2.s022')}</span>
                                </span>
                              </div>
                              <p className="text-xs text-[#86868b] mt-0.5">{t('booked2.s023')}</p>
                            </div>
                          </div>

                          {/* Trạng thái liên hệ: 100% trực tiếp qua App */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-black/[0.03] dark:border-white/[0.04]">
                            <p className="text-[11px] font-medium text-[#86868b]">
                              {t('booked2.s024')}
                            </p>
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-300/40">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{t('booked2.s025')}</span>
                            </span>
                          </div>
                        </div>

                        {/* Khối Hành Động Tự Do & An Toàn (100% In-App Chat & In-App Call) */}
                        <div className="space-y-3">
                          {isConfirmed ? (
                            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
                              {isEmergencyUnlocked && partnerPhone ? (
                                <div className="p-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 text-xs space-y-2 animate-in fade-in duration-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200 text-xs">
                                      <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">!</span>
                                      <span>{t('booked2.s026')}</span>
                                    </div>
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-semibold">
                                      {t('booked2.s027')}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-500/20">
                                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{partnerPhone}</span>
                                    <div className="flex items-center gap-1.5">
                                      <a
                                        href={`tel:${partnerPhone}`}
                                        className="py-1 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <Phone className="w-3 h-3 fill-current" />
                                        <span>{t('booked2.s028')}</span>
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard?.writeText?.(partnerPhone);
                                          setCopiedPhoneId(record.id);
                                          setTimeout(() => setCopiedPhoneId(null), 2000);
                                        }}
                                        className="py-1 px-2 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
                                      >
                                        {copiedPhoneId === record.id ? 'Đã chép' : 'Chép'}
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                                    {t('booked2.s029')}
                                  </p>
                                </div>
                              ) : null}

                              <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                  <span>{t('booked2.s030')}</span>
                                </span>
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                                  {t('booked2.s031')}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => onOpenChat?.(record.escrowId || record.id)}
                                  className="w-full h-11 px-4 rounded-xl font-bold text-xs sm:text-sm bg-[#0071e3] hover:bg-[#0077ed] text-white transition-all inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99]"
                                >
                                  <MessageSquare className="w-4 h-4 fill-current shrink-0" />
                                  <span>{t('booked2.s032')}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onOpenChat?.(record.escrowId || record.id, { autoCall: true })}
                                  className="w-full h-11 px-4 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99]"
                                >
                                  <Phone className="w-4 h-4 fill-current shrink-0" />
                                  <span>{t('booked2.s033')}</span>
                                </button>
                              </div>

                              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed pt-1 border-t border-slate-200/60 dark:border-slate-800">
                                {t('booked2.s034')} <strong>{t('booked2.s035')}</strong> {t('booked2.s036')}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 text-blue-950 dark:text-blue-200 text-xs flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
                                <span className="leading-relaxed">
                                  {record.status === 'pre_confirmed'
                                    ? '⚡ Chuyến xe đang được đề xuất chốt. Vui lòng mở khung chat để xác nhận!'
                                    : '💬 Hai bên chủ động nhắn tin hoặc gọi qua App để hẹn điểm đón cụ thể (Bảo mật 100% SĐT).'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => onOpenChat?.(record.escrowId || record.id)}
                                  className="w-full h-11 px-4 rounded-2xl font-bold text-xs sm:text-sm bg-[#0071e3] text-white hover:bg-[#0077ed] active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
                                >
                                  <MessageSquare className="w-4 h-4 shrink-0 fill-current" />
                                  <span>{t('booked2.s037')}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onOpenChat?.(record.escrowId || record.id, { autoCall: true })}
                                  className="w-full h-11 px-4 rounded-2xl font-bold text-xs sm:text-sm bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
                                >
                                  <Phone className="w-4 h-4 shrink-0 fill-current" />
                                  <span>{t('booked2.s033')}</span>
                                </button>
                              </div>

                              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                                {t('booked2.s038')} <strong>{t('booked2.s039')}</strong> {t('booked2.s040')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bảng Chi Phí Xăng Xe Chuẩn Apple Wallet */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f5f5f7]/70 dark:bg-slate-800/40">
                        <p className="text-xs text-[#86868b] font-medium">{t('booked2.s041')}</p>
                        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular mt-1">
                          {t('booked2.s042')}
                        </p>
                        <p className="text-[11px] text-[#86868b] mt-0.5">{t('booked2.s043')}</p>
                      </div>

                      <div className="p-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f5f5f7]/70 dark:bg-slate-800/40">
                        <p className="text-xs text-[#86868b] font-medium">{t('booked2.s044')}</p>
                        <p className="text-base sm:text-lg font-bold text-[#1d1d1f] dark:text-white tabular mt-1">
                          {formatVND(totalCost)}
                        </p>
                        <p className="text-[11px] text-[#86868b] mt-0.5">{t('booked2.s045')}</p>
                      </div>
                    </div>

                    {/* Thanh Hành Động Chi Tiết */}
                    <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Cụm chia sẻ cho người thân */}
                      <div className="flex items-center gap-1.5 justify-between sm:justify-start w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleCopyForFamily(record)}
                          className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1.5 cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                        >
                          {copiedId === record.escrowId ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span className="text-emerald-600 dark:text-emerald-400">{t('booked2.s046')}</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-4 h-4 text-slate-500" />
                              <span>{t('booked2.s047')}</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendSMS(record)}
                          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 py-1.5 px-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title={t('booked2.s053')}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>SMS</span>
                        </button>
                      </div>

                      {/* Nút hành động trạng thái */}
                      {!isCompleted && !isCancelled && (
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Timer}
                            onClick={() => onDelay(record)}
                            className="flex-1 sm:flex-initial justify-center text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          >
                            {t('booked2.s048')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={XCircle}
                            onClick={() => onCancel(record)}
                            className="flex-1 sm:flex-initial justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            {isConfirmed ? 'Huỷ chuyến' : 'Dừng trao đổi'}
                          </Button>
                          <button
                            type="button"
                            onClick={() => onComplete(record.escrowId, record)}
                            className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-4 py-2 rounded-xl sm:rounded-full bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] hover:bg-black text-xs font-semibold shadow-2xs transition-all cursor-pointer min-h-[38px] sm:min-h-0"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                            <span>{t('booked2.s049')}</span>
                          </button>
                        </div>
                      )}

                      {(isCompleted || isCancelled) && (
                        <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span>
                              {isCompleted
                                ? '✓ Chuyến đi đã hoàn tất an toàn'
                                : `Lý do: ${record.cancelReason || 'Đã huỷ'}`}
                            </span>
                          </div>
                          {isCompleted && onReview && (
                            <button
                              type="button"
                              onClick={() => onReview(record)}
                              className="font-bold text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 py-1.5 px-3 rounded-xl inline-flex items-center gap-1.5 hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs"
                            >
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                              <span>{record.reviews?.length > 0 ? 'Xem / Sửa đánh giá' : 'Đánh giá 2 chiều'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
  );
}
