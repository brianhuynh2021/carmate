import React, { useState, useEffect } from 'react';
import {
  Clock, Phone, CheckCircle2, Timer, ShieldCheck, XCircle,
  Share2, Check, Ticket, MessageSquare, ArrowRight, History, Star
} from 'lucide-react';
import { formatVND, getZaloChatUrl, getWhatsAppChatUrl, getTelegramChatUrl, cleanPhoneNumber } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import EmptyState, { SectionHeader } from '../ui/EmptyState.jsx';
import { RouteTimeline } from '../market/TripCard.jsx';
import { ZaloIcon, WhatsAppIcon, TelegramIcon } from '../ui/SocialIcons.jsx';

/**
 * Đồng hồ đếm ngược 30 phút theo chuẩn ARCHITECTURE.md:
 * "Hành khách giữ chỗ 0đ, cam kết bằng danh tính thật qua Zalo trong 30 phút"
 */
function Countdown30Min({ createdAt }) {
  const [timeLeft, setTimeLeft] = useState(() => {
    let start = Date.now() - 4 * 60 * 1000;
    if (typeof createdAt === 'number') start = createdAt;
    else if (typeof createdAt === 'string' && createdAt.includes('06:20')) {
      start = Date.now() - 6 * 60 * 1000;
    }
    const expiry = start + 30 * 60 * 1000;
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
      <span>Còn {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} để chốt điểm đón qua Zalo</span>
    </div>
  );
}

export default function BookedTripList({ bookedEscrows = [], onCancel, onDelay, onComplete, onFindTrip, onReview }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [copiedId, setCopiedId] = useState(null);

  const activeBookings = bookedEscrows.filter((b) => b.status === 'zalo_active' || b.status === 'delayed');
  const historyBookings = bookedEscrows.filter((b) => b.status === 'completed' || b.status === 'cancelled');

  const displayedList = activeTab === 'active' ? activeBookings : historyBookings;

  const handleCopyForFamily = (record) => {
    const totalAmount = record.fullTripAmount || record.totalDeal || 0;
    const text = `🚗 THÔNG TIN CHUYẾN ĐI CARMATE (GỬI NGƯỜI THÂN)\n• Mã chuyến: ${record.escrowId}\n• Lộ trình: ${record.from} ➔ ${record.to}\n• Thời gian: ${record.timeSlot}\n• Đối tác: ${record.contactName} (SĐT: ${record.contactPhone})\n• Đóng góp nhiên liệu: ${formatVND(totalAmount)} (${record.seats} ghế · Trọn gói xăng & cầu đường, gửi khi lên xe)\n👉 Theo dõi lộ trình qua: https://carmate.vn`;
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
        description={`Quản lý vé hành trình · 0% chiết khấu sàn · Trực tiếp kết nối`}
        action={
          <Badge tone="success" icon={ShieldCheck} className="h-7 px-2.5">
            0đ Phí sàn · Kết nối Zalo
          </Badge>
        }
      />

      {/* Tabs Chuyển Đổi: Đang Hoạt Động vs Lịch Sử */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/70">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <span>Chuyến đang diễn ra</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold tabular">
            {activeBookings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4 text-slate-500" />
          <span>Lịch sử chuyến đi</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold tabular">
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
            description={activeTab === 'active' ? 'Tìm chuyến xe cùng tuyến để kết nối bạn đồng hành ngay.' : 'Các chuyến đi bạn đã hoàn thành hoặc huỷ sẽ lưu lại tại đây.'}
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
            const waUrl = getWhatsAppChatUrl(phone, `Xin chào, tôi vừa ghép chuyến CarMate [${record.escrowId}] tuyến ${record.from} đi ${record.to}`);
            const teleUrl = getTelegramChatUrl(phone);
            const totalCost = record.fullTripAmount || record.totalDeal || 0;
            const isCompleted = record.status === 'completed';
            const isCancelled = record.status === 'cancelled';
            const isDelayed = record.status === 'delayed';

            return (
              <article key={record.escrowId} className="surface overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-800 rounded-3xl">
                {/* Header Vé */}
                <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 flex-wrap border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 inline-flex items-center justify-center">
                      <Ticket className="w-5 h-5" />
                    </span>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Mã chuyến xe</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        <span className="tabular font-display tracking-tight text-primary-700 dark:text-primary-300">{record.escrowId}</span>
                        <span className="text-slate-400 mx-1.5">·</span>
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
                  {/* Lộ Trình & Thời Gian */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="flex items-center justify-between gap-3 mb-3 text-xs sm:text-[13px]">
                      <span className="font-semibold text-slate-900 dark:text-white tabular">
                        {record.timeSlot} {record.targetItem?.date ? `(${record.targetItem.date})` : ''}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {record.seats} người đồng hành
                      </span>
                    </div>
                    <RouteTimeline from={record.from} to={record.to} compact />
                  </div>

                  {/* Thẻ Liên Lạc Nổi Bật (Chỉ hiển thị khi chuyến đang hoạt động) */}
                  {!isCompleted && !isCancelled && (
                    <div className="rounded-2xl bg-gradient-to-br from-[#0c4a6e] via-[#075985] to-[#0e1e36] text-white p-4 sm:p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-sky-200">
                            Số điện thoại & Zalo đối tác
                          </p>
                          <p className="font-display text-xl sm:text-2xl font-bold tabular tracking-tight mt-0.5">
                            {phone}
                          </p>
                        </div>
                        <a
                          href={`tel:${cleanPhoneNumber(phone)}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white text-primary-800 font-semibold text-xs shadow-xs hover:bg-sky-50 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Gọi Điện</span>
                        </a>
                      </div>

                      <p className="text-xs text-sky-100/95 leading-relaxed font-medium">
                        🔒 <strong>Quy định bắt buộc:</strong> Mở Zalo để gửi định vị GPS và thống nhất chính xác điểm đón dọc tuyến:
                      </p>

                      {/* Nút Zalo Tiên Quyết Số 1 */}
                      <div className="space-y-2 pt-1">
                        <a
                          href={zaloUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full h-12 px-4 rounded-2xl font-bold text-sm bg-white text-[#0068ff] hover:bg-blue-50 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2.5 shadow-md shadow-blue-950/20 cursor-pointer"
                        >
                          <ZaloIcon className="w-5 h-5 shrink-0" />
                          <span>Mở Zalo chốt điểm đón & gửi định vị</span>
                        </a>

                        {/* Tuỳ chọn phụ & gọi điện */}
                        <div className="flex items-center justify-between gap-3 text-xs text-blue-100/90 pt-1 flex-wrap">
                          <a
                            href={`tel:${cleanPhoneNumber(record.contactPhone || phone)}`}
                            className="inline-flex items-center gap-1.5 font-semibold text-white hover:underline"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Gọi điện: {record.contactPhone || phone}</span>
                          </a>

                          <div className="flex items-center gap-2 text-[11.5px] text-blue-200">
                            <span className="opacity-80">Tùy chọn phụ:</span>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-white underline font-medium"
                              title="Mở WhatsApp (tuỳ chọn)"
                            >
                              WhatsApp
                            </a>
                            <span>·</span>
                            <a
                              href={teleUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-white underline font-medium"
                              title="Mở Telegram (tuỳ chọn)"
                            >
                              Telegram
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bảng Chi Phí Xăng Xe & Cầu Đường */}
                  <dl className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Phí sàn CarMate</dt>
                      <dd className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 tabular mt-0.5">
                        0 ₫ · Miễn phí hoàn toàn
                      </dd>
                    </div>
                    <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Gửi tiền xăng khi lên xe</dt>
                      <dd className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tabular mt-0.5">
                        {formatVND(totalCost)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Thanh Hành Động */}
                <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between gap-3 flex-wrap">
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
                    <div className="flex items-center gap-2">
                      <Button variant="warningGhost" size="sm" icon={Timer} onClick={() => onDelay(record)}>
                        Báo trễ
                      </Button>
                      <Button variant="dangerGhost" size="sm" icon={XCircle} onClick={() => onCancel(record)}>
                        Huỷ chuyến
                      </Button>
                      <Button variant="success" size="sm" icon={CheckCircle2} onClick={() => onComplete(record.escrowId, record)}>
                        Hoàn tất chuyến
                      </Button>
                    </div>
                  )}

                  {(isCompleted || isCancelled) && (
                    <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400">
                      <span>{isCompleted ? '✓ Chuyến đi đã hoàn tất an toàn' : `Lý do: ${record.cancelReason || 'Đã huỷ'}`}</span>
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
