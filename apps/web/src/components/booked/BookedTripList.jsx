import React, { useState, useEffect } from 'react';
import {
  Clock,
  Phone,
  CheckCircle2,
  Timer,
  ShieldCheck,
  XCircle,
  Share2,
  Check,
  Ticket,
  MessageSquare,
  ArrowRight,
  History,
  Star,
  Sparkles,
  Lock,
  Shield,
  ShieldAlert
} from 'lucide-react';
import { formatVND, getZaloChatUrl, getWhatsAppChatUrl, getTelegramChatUrl, cleanPhoneNumber } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import EmptyState, { SectionHeader } from '../ui/EmptyState.jsx';
import { RouteTimeline } from '../market/TripCard.jsx';
import { ZaloIcon, WhatsAppIcon, TelegramIcon } from '../ui/SocialIcons.jsx';

/**
 * Đồng hồ đếm ngược 15 phút theo chuẩn ARCHITECTURE.md:
 * "Hành khách giữ chỗ 0đ, cam kết bằng danh tính thật qua Zalo trong 15 phút"
 */
function Countdown30Min({ createdAt }) {
  const [timeLeft, setTimeLeft] = useState(() => {
    let start = Date.now() - 4 * 60 * 1000;
    if (typeof createdAt === 'number') start = createdAt;
    else if (typeof createdAt === 'string' && createdAt.includes('06:20')) {
      start = Date.now() - 6 * 60 * 1000;
    }
    const expiry = start + 15 * 60 * 1000;
    return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft < 5 * 60;
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tabular ${
        isUrgent
          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 animate-pulse'
          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200/80'
      }`}
    >
      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
      <span>
        Còn {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} để chốt điểm đón qua Zalo
      </span>
    </div>
  );
}

function TripProgressStepper({ status, delayedMinutes }) {
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';
  const isDelayed = status === 'delayed';

  const steps = [
    {
      id: 1,
      label: 'Khớp xe tiện đường',
      desc: 'Chi phí xăng & vé trạm',
      state: 'completed'
    },
    {
      id: 2,
      label: isDelayed ? `Báo trễ +${delayedMinutes || 15}p` : 'Hẹn điểm đón Zalo',
      desc: isCancelled ? 'Đã dừng kết nối' : 'Thoả thuận điểm đón GPS',
      state: isCompleted ? 'completed' : isCancelled ? 'cancelled' : isDelayed ? 'delayed' : 'active'
    },
    {
      id: 3,
      label: 'Lên xe & Phụ xăng',
      desc: '0% phí sàn · Đưa trực tiếp',
      state: isCompleted ? 'completed' : 'pending'
    },
    {
      id: 4,
      label: 'Tín nhiệm 2 chiều',
      desc: isCompleted ? 'Đã ghi nhận uy tín' : 'Tích xanh CCCD',
      state: isCompleted ? 'completed' : 'pending'
    }
  ];

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-[#1d1d1f] dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>Tiến trình kết nối an toàn</span>
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-slate-800 text-[#86868b] border border-black/[0.04]">
            Quy trình 4 bước
          </span>
        </div>
        <span className="text-[11px] font-semibold text-[#86868b] tabular">
          {isCompleted
            ? '4/4 hoàn tất'
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
              className={`p-2.5 rounded-xl border transition-all ${
                isDone
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-200'
                  : isActive
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/15'
                    : isDelayState
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
                      : isCancelState
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 text-rose-900'
                        : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.04] text-[#86868b] opacity-60'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : isActive
                        ? 'bg-[#0071e3] text-white animate-pulse'
                        : isDelayState
                          ? 'bg-amber-500 text-white'
                          : isCancelState
                            ? 'bg-rose-500 text-white'
                            : 'bg-black/[0.08] dark:bg-white/[0.1] text-[#86868b]'
                  }`}
                >
                  {isDone ? '✓' : isCancelState ? '✕' : step.id}
                </span>
                <span className="text-[11.5px] font-bold leading-tight line-clamp-1">{step.label}</span>
              </div>
              <p className="text-[10.5px] leading-tight opacity-75 truncate font-medium">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BookedTripList({
  bookedEscrows = [],
  onCancel,
  onDelay,
  onComplete,
  onFindTrip,
  onReview,
  onReportMismatch
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [copiedId, setCopiedId] = useState(null);

  const activeBookings = bookedEscrows.filter((b) => b.status === 'zalo_active' || b.status === 'delayed');
  const historyBookings = bookedEscrows.filter((b) => b.status === 'completed' || b.status === 'cancelled');

  const displayedList = activeTab === 'active' ? activeBookings : historyBookings;

  const handleCopyForFamily = (record) => {
    const totalAmount = record.fullTripAmount || record.totalDeal || 0;
    const text = `[CARMATE] THÔNG TIN CHUYẾN ĐI TIỆN ĐƯỜNG (GỬI NGƯỜI THÂN)\n• Mã chuyến: ${record.escrowId}\n• Lộ trình: ${record.from} ➔ ${record.to}\n• Thời gian: ${record.timeSlot}\n• Đối tác: ${record.contactName} (SĐT: ${record.contactPhone})\n• Đóng góp nhiên liệu: ${formatVND(totalAmount)} (${record.seats} ghế · Trọn gói xăng & cầu đường, gửi khi lên xe)\n• Theo dõi lộ trình: https://carmate.vn`;

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
    const text = `Thong tin chuyen di CarMate ${record.escrowId}: ${record.from} ve ${record.to}, gio ${record.timeSlot}, doi tac ${record.contactName} (${record.contactPhone}), gia ${formatVND(totalAmount)}. Xem tai carmate.vn`;
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_self');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <SectionHeader
        icon={Clock}
        title={t('booked.title')}
        description="Lịch hẹn đi chung xe · 0% chiết khấu sàn · Trực tiếp kết nối bạn đồng hành"
        action={
          <Badge tone="success" icon={ShieldCheck} className="h-7 px-2.5">
            0đ Phí sàn · Kết nối Zalo
          </Badge>
        }
      />

      {/* Tabs Chuyển Đổi: Đang Hoạt Động vs Lịch Sử */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-[#e8e8ed]/90 border border-black/[0.04]">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-bold'
              : 'text-[#86868b] hover:text-[#1d1d1f]'
          }`}
        >
          <Clock className={`w-4 h-4 ${activeTab === 'active' ? 'text-[#0071e3]' : 'text-[#86868b]'}`} />
          <span>Chuyến đang diễn ra</span>
          <span
            className={`ml-1 px-2 py-0.2 rounded-full text-[11px] font-bold tabular ${
              activeTab === 'active' ? 'bg-[#0071e3] text-white' : 'bg-black/[0.08] text-[#515154]'
            }`}
          >
            {activeBookings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-bold'
              : 'text-[#86868b] hover:text-[#1d1d1f]'
          }`}
        >
          <History className={`w-4 h-4 ${activeTab === 'history' ? 'text-[#0071e3]' : 'text-[#86868b]'}`} />
          <span>Lịch sử chuyến đi</span>
          <span
            className={`ml-1 px-2 py-0.2 rounded-full text-[11px] font-bold tabular ${
              activeTab === 'history' ? 'bg-[#0071e3] text-white' : 'bg-black/[0.08] text-[#515154]'
            }`}
          >
            {historyBookings.length}
          </span>
        </button>
      </div>

      {/* Danh Sách Chuyến */}
      {displayedList.length === 0 ? (
        <div className="py-8">
          <EmptyState
            icon={activeTab === 'active' ? Clock : History}
            title={activeTab === 'active' ? 'Chưa có chuyến đi nào đang chờ' : 'Chưa có lịch sử chuyến'}
            description={
              activeTab === 'active'
                ? 'Tìm chuyến xe cùng tuyến để kết nối bạn đồng hành ngay.'
                : 'Các chuyến đi bạn đã hoàn thành hoặc huỷ sẽ lưu lại tại đây.'
            }
            action={<Button onClick={onFindTrip}>Tìm chuyến tiện đường ngay</Button>}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {displayedList.map((record) => {
            const phone = record.contactPhone;
            const zaloUrl = getZaloChatUrl(
              phone,
              `Xin chào ${record.contactName}, tôi vừa ghép chuyến CarMate [${record.escrowId}] tuyến ${record.from} đi ${record.to}. Mình trao đổi chốt điểm đón nhé!`
            );
            const waUrl = getWhatsAppChatUrl(
              phone,
              `Xin chào, tôi vừa ghép chuyến CarMate [${record.escrowId}] tuyến ${record.from} đi ${record.to}`
            );
            const teleUrl = getTelegramChatUrl(phone);
            const totalCost = record.fullTripAmount || record.totalDeal || 0;
            const isCompleted = record.status === 'completed';
            const isCancelled = record.status === 'cancelled';
            const isDelayed = record.status === 'delayed';

            return (
              <article
                key={record.escrowId}
                className="surface overflow-hidden shadow-xs border border-black/[0.08] rounded-3xl"
              >
                {/* Header Vé */}
                <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 flex-wrap border-b border-black/[0.06]">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20 inline-flex items-center justify-center">
                      <Ticket className="w-5 h-5" />
                    </span>
                    <div>
                      <p className="text-xs text-[#86868b]">Mã chuyến xe</p>
                      <p className="text-base font-bold text-[#1d1d1f]">
                        <span className="tabular font-display tracking-tight text-[#0071e3]">{record.escrowId}</span>
                        <span className="text-[#86868b] mx-1.5">·</span>
                        <span>{record.contactName}</span>
                      </p>
                    </div>
                  </div>

                  {isCompleted ? (
                    <Badge tone="success" icon={CheckCircle2} className="h-7 px-2.5 font-semibold">
                      Đã hoàn tất an toàn
                    </Badge>
                  ) : isCancelled ? (
                    <Badge tone="danger" icon={XCircle} className="h-7 px-2.5 font-semibold">
                      Đã huỷ chuyến
                    </Badge>
                  ) : isDelayed ? (
                    <Badge tone="warning" icon={Timer} className="h-7 px-2.5 font-semibold">
                      Trễ +{record.delayedMinutes || 15} phút
                    </Badge>
                  ) : (
                    <Countdown30Min createdAt={record.createdAt} />
                  )}
                </div>

                <div className="p-5 space-y-4">
                  {/* Cảnh báo đã báo cáo sai lệch loại xe nếu có */}
                  {record.vehicleMismatchReport && (
                    <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-semibold min-w-0">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <span className="truncate">
                          Đã báo cáo: {record.vehicleMismatchReport.mismatchTitle || 'Sai lệch loại xe'}
                        </span>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-200/80 dark:bg-rose-900/80 text-rose-900 dark:text-rose-100">
                        {record.vehicleMismatchReport.status === 'resolved_converted'
                          ? '✓ Đã chuyển Biển vàng'
                          : 'Đang xử lý'}
                      </span>
                    </div>
                  )}

                  {/* Quy trình kết nối an toàn 4 bước */}
                  <TripProgressStepper status={record.status} delayedMinutes={record.delayedMinutes} />

                  {/* Lộ Trình & Thời Gian */}
                  <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-black/[0.06]">
                    <div className="flex items-center justify-between gap-3 mb-3 text-xs sm:text-[13px]">
                      <span className="font-semibold text-[#1d1d1f] tabular">
                        {record.timeSlot} {record.targetItem?.date ? `(${record.targetItem.date})` : ''}
                      </span>
                      <span className="text-[#86868b] font-medium">{record.seats} người đồng hành</span>
                    </div>
                    <RouteTimeline from={record.from} to={record.to} compact />
                  </div>

                  {/* Thẻ Liên Lạc Chuẩn Apple HIG & Cursor Minimalist */}
                  {!isCompleted && !isCancelled && (
                    <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-black/[0.08] p-4 sm:p-5 shadow-[0_2px_16px_rgba(0,0,0,0.04)] space-y-3.5">
                      {/* Hàng Tiêu Đề Đối Tác */}
                      <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-black/[0.05] dark:border-white/[0.06]">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-bold text-sm flex items-center justify-center border border-[#0071e3]/20">
                              {(record.contactName || 'T')[0]?.toUpperCase()}
                            </div>
                            <span
                              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold ring-2 ring-white dark:ring-slate-900"
                              title="Đã xác thực CCCD & GPLX"
                            >
                              ✓
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-sm text-[#1d1d1f] dark:text-white">{record.contactName}</p>
                              <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60">
                                98đ Tín nhiệm
                              </span>
                            </div>
                            <p className="text-xs text-[#86868b] mt-0.5">Chủ xe gia đình · Xác thực danh tính thật</p>
                          </div>
                        </div>

                        {/* Số điện thoại duy nhất */}
                        <div className="text-right">
                          <p className="text-[11px] font-medium text-[#86868b]">Số điện thoại liên hệ</p>
                          <p className="font-display text-base sm:text-lg font-bold text-[#1d1d1f] dark:text-white tabular tracking-tight">
                            {phone}
                          </p>
                        </div>
                      </div>

                      {/* Nút Zalo Tiên Quyết - Chuẩn Apple HIG */}
                      <div className="space-y-2.5">
                        <a
                          href={zaloUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full h-12 px-4 rounded-2xl font-bold text-sm bg-[#0068ff] text-white hover:bg-[#0057d9] active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2.5 shadow-md shadow-blue-500/20 cursor-pointer"
                        >
                          <ZaloIcon className="w-5 h-5 shrink-0" />
                          <span>Mở Zalo chốt điểm đón & gửi định vị</span>
                        </a>

                        {/* Hàng tuỳ chọn liên lạc phụ */}
                        <div className="flex items-center justify-between gap-2 pt-1 text-xs text-[#86868b] flex-wrap">
                          <a
                            href={`tel:${cleanPhoneNumber(phone)}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f5f5f7] dark:bg-slate-800 hover:bg-[#e8e8ed] text-[#1d1d1f] dark:text-white font-semibold text-xs transition-colors border border-black/[0.04]"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Gọi điện trực tiếp</span>
                          </a>

                          <div className="flex items-center gap-2 text-[11.5px]">
                            <span className="opacity-75">Tùy chọn khác:</span>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0071e3] hover:underline font-medium"
                              title="Mở WhatsApp (tuỳ chọn)"
                            >
                              WhatsApp
                            </a>
                            <span>·</span>
                            <a
                              href={teleUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0071e3] hover:underline font-medium"
                              title="Mở Telegram (tuỳ chọn)"
                            >
                              Telegram
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bảng Chi Phí Xăng Xe Chuẩn Apple Wallet */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl border border-black/[0.06] bg-[#f5f5f7]/70 dark:bg-slate-800/40">
                      <p className="text-xs text-[#86868b] font-medium">Phí nền tảng CarMate</p>
                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular mt-1">
                        0 ₫ · Miễn phí trọn đời
                      </p>
                      <p className="text-[11px] text-[#86868b] mt-0.5">Không thu chiết khấu trung gian</p>
                    </div>

                    <div className="p-4 rounded-2xl border border-black/[0.06] bg-[#f5f5f7]/70 dark:bg-slate-800/40">
                      <p className="text-xs text-[#86868b] font-medium">Chia sẻ chi phí xăng xe</p>
                      <p className="text-base sm:text-lg font-bold text-[#1d1d1f] dark:text-white tabular mt-1">
                        {formatVND(totalCost)}
                      </p>
                      <p className="text-[11px] text-[#86868b] mt-0.5">Gửi trực tiếp tài xế khi lên xe</p>
                    </div>
                  </div>
                </div>

                {/* Thanh Hành Động */}
                <div className="px-5 py-3.5 border-t border-black/[0.06] bg-[#fbfbfd] dark:bg-slate-900/60 flex items-center justify-between gap-3 flex-wrap">
                  {/* Cụm chia sẻ cho người thân */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyForFamily(record)}
                      className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1.5 cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                    >
                      {copiedId === record.escrowId ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-600 dark:text-emerald-400">Đã chép thông tin</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4 text-slate-500" />
                          <span>Gửi tin người thân</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendSMS(record)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 py-1.5 px-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      title="Soạn tin nhắn SMS gửi người thân"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>SMS</span>
                    </button>
                  </div>

                  {/* Nút hành động trạng thái */}
                  {!isCompleted && !isCancelled && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="warningGhost" size="sm" icon={Timer} onClick={() => onDelay(record)}>
                        Báo trễ
                      </Button>
                      <Button variant="dangerGhost" size="sm" icon={XCircle} onClick={() => onCancel(record)}>
                        Huỷ chuyến
                      </Button>
                      {onReportMismatch && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={ShieldAlert}
                          onClick={() => onReportMismatch(record)}
                          className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold"
                          title="Báo cáo xe đón thực tế là Biển vàng hoặc sai mô tả"
                        >
                          Báo sai loại xe
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => onComplete(record.escrowId, record)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] hover:bg-black text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                        <span>Hoàn tất chuyến</span>
                      </button>
                    </div>
                  )}

                  {(isCompleted || isCancelled) && (
                    <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span>
                          {isCompleted ? '✓ Chuyến đi đã hoàn tất an toàn' : `Lý do: ${record.cancelReason || 'Đã huỷ'}`}
                        </span>
                        {onReportMismatch && !record.vehicleMismatchReport && (
                          <button
                            type="button"
                            onClick={() => onReportMismatch(record)}
                            className="text-[11.5px] text-slate-400 hover:text-rose-600 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ml-1"
                            title="Báo cáo nếu xe đón không đúng cam kết"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                            <span>Báo sai xe</span>
                          </button>
                        )}
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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
