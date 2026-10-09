import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Zap,
  MessageSquare,
  Car,
  ShieldCheck,
  X,
  MoreVertical,
  ArrowRight,
  Sparkles,
  Inbox,
  Check,
  EyeOff
} from 'lucide-react';
import { cleanPhoneNumber } from '@carmate/shared';
import { triggerMacNotification } from './AppleMacNotification.jsx';
import { useI18n } from '../../i18n/index.jsx';

/**
 * YouTube-style relative time format in Vietnamese:
 * "vừa xong" (just now), "5 phút trước" (5 minutes ago), "2 giờ trước" (2 hours ago), "Hôm qua" (yesterday), "09/09"
 */
export function formatRelativeTimeVi(timestamp) {
  if (!timestamp) return 'vừa xong';
  const now = Date.now();
  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : Number(timestamp);
  if (!time || isNaN(time)) return 'vừa xong';

  const diffSec = Math.floor((now - time) / 1000);
  if (diffSec < 45) return 'vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Hôm qua';
  if (diffDay < 7) return `${diffDay} ngày trước`;

  const d = new Date(time);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export default function NotificationDropdown({
  isOpen,
  onClose,
  bookedEscrows = [],
  currentUser = null,
  socialMatches = [],
  readBookingTimestamps = {},
  unreadBookingIds = [],
  onSelectBooking,
  onSelectTrip,
  onMarkAllRead,
  onMarkAsRead,
  onMarkAsUnread,
  onOpenInbox
}) {
  const { t } = useI18n();
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unread'
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('carmate_dismissed_notifs') || '[]');
    } catch {
      return [];
    }
  });

  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuId(null);
      }
    };
    if (activeMenuId) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeMenuId]);

  // Aggregate the full notification list, YouTube style
  const allNotifications = useMemo(() => {
    const list = [];
    const userPhone = currentUser?.phone ? cleanPhoneNumber(currentUser.phone) : '';
    const userId = currentUser?.id || currentUser?.userId || '';

    // 1. Browse the list of trip bookings
    (bookedEscrows || []).forEach((b) => {
      const bId = b.escrowId || b.id;
      if (!bId) return;

      const isDriver =
        (userPhone && b.driverPhone && cleanPhoneNumber(b.driverPhone) === userPhone) ||
        (userId && b.driverId === userId) ||
        b.partyRole?.includes('Chủ xe') ||
        b.tripType === 'driver_offer';

      const partnerName =
        b.partnerName ||
        (isDriver ? b.passengerName : b.driverName) ||
        (isDriver ? 'Người đi cùng' : 'Chủ xe');

      const partnerAvatar = b.partnerAvatar || (isDriver ? b.passengerAvatar : b.driverAvatar) || '';
      const origin = b.pickup || b.tripOrigin || 'Điểm đón';
      const destination = b.destination || b.tripDestination || 'Điểm đến';
      const thumbnail = b.vehiclePhoto || (b.carPhotos && b.carPhotos[0]) || '';
      const lastRead = readBookingTimestamps?.[bId] || 0;
      const isExplicitUnread = (unreadBookingIds || []).includes(bId);

      const messages = b.messages || [];
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

      let type = 'message';
      let actionText = '';
      let snippet = '';
      let time = b.createdAt || Date.now();
      let isUnread = isExplicitUnread;

      if (lastMsg) {
        const isFromMe = userPhone && cleanPhoneNumber(lastMsg.senderPhone || '') === userPhone;
        const msgTime = lastMsg.timestamp ? new Date(lastMsg.timestamp).getTime() : 0;
        time = msgTime || time;
        snippet = lastMsg.text || '';

        if (!isFromMe) {
          actionText = 'đã gửi một tin nhắn mới:';
          if (!lastRead || msgTime > lastRead) {
            isUnread = true;
          }
        } else {
          actionText = 'Trao đổi gần nhất:';
        }
      } else {
        if (b.status === 'pre_confirmed') {
          type = 'pre_confirmed';
          actionText = isDriver ? 'Bạn đã chấp thuận giữ chỗ 15 phút' : 'Chủ xe đã đồng ý giữ chỗ 15 phút cho bạn';
          snippet = `${origin} ➔ ${destination}`;
          if (!lastRead) isUnread = true;
        } else if (b.status === 'confirmed') {
          type = 'confirmed';
          actionText = 'Chuyến đi đã được chốt giữ chỗ thành công!';
          snippet = `${origin} ➔ ${destination}`;
          if (!lastRead) isUnread = true;
        } else if (b.status === 'inquiring') {
          type = 'inquiring';
          actionText = isDriver ? 'đã gửi một yêu cầu ghép xe mới' : 'đã tiếp nhận yêu cầu ghép xe của bạn';
          snippet = `${origin} ➔ ${destination}`;
          if (!lastRead) isUnread = true;
        } else if (b.status === 'cancelled') {
          type = 'cancelled';
          actionText = 'Yêu cầu ghép chuyến đã kết thúc / huỷ';
          snippet = `${origin} ➔ ${destination}`;
        } else if (b.status === 'completed') {
          type = 'completed';
          actionText = 'Chuyến đi đã hoàn thành an toàn';
          snippet = 'Hãy dành 30 giây đánh giá tín nhiệm cho bạn đồng hành!';
        }
      }

      list.push({
        id: `notif-booking-${bId}`,
        targetType: 'booking',
        bookingId: bId,
        booking: b,
        type,
        senderName: partnerName,
        avatar: partnerAvatar,
        actionText,
        snippet,
        time,
        relativeTime: formatRelativeTimeVi(time),
        thumbnail,
        routeBadge: `${origin.split(',')[0]} ➔ ${destination.split(',')[0]}`,
        isUnread: Boolean(isUnread)
      });
    });

    // 2. Instant match suggestions (Social Smart Match)
    (socialMatches || []).slice(0, 3).forEach((item) => {
      if (!item?.trip?.id) return;
      const mTrip = item.trip;
      const isDriver = mTrip.type === 'driver_offer';
      const partnerName = mTrip.partnerAlias || (isDriver ? `Chủ xe #${mTrip.id.slice(0, 4)}` : `Người đi cùng #${mTrip.id.slice(0, 4)}`);
      const notifId = `notif-match-${mTrip.id}`;

      list.push({
        id: notifId,
        targetType: 'trip',
        trip: mTrip,
        type: 'match',
        senderName: partnerName,
        avatar: '',
        actionText: `Tìm thấy chuyến phù hợp · Khớp ${item.score}%`,
        snippet: `${mTrip.from} ➔ ${mTrip.to}${item.fuelSavings?.savingsVndFormatted ? ` · ${item.fuelSavings.savingsVndFormatted}` : ''}`,
        time: mTrip.createdAt || (Date.now() - 1000 * 60 * 15),
        relativeTime: formatRelativeTimeVi(mTrip.createdAt || (Date.now() - 1000 * 60 * 15)),
        thumbnail: '',
        routeBadge: `🔥 Khớp ${item.score}%`,
        isUnread: false
      });
    });

    // 3. Notifications from CarMate 24/7 customer support
    list.push({
      id: 'notif-support-desk',
      targetType: 'support',
      bookingId: 'support',
      type: 'support',
      senderName: 'CarMate Hỗ trợ 24/7',
      avatar: '',
      actionText: 'Kênh CSKH & Kháng nghị trực tuyến sẵn sàng hỗ trợ bạn',
      snippet: 'Nhắn tin trực tiếp với đội ngũ CarMate khi cần giải đáp hoặc gỡ hạn chế tài khoản.',
      time: Date.now() - 3600000 * 2,
      relativeTime: formatRelativeTimeVi(Date.now() - 3600000 * 2),
      thumbnail: '',
      routeBadge: 'CSKH 24/7',
      isUnread: false
    });

    // Sort newest first
    list.sort((a, b) => {
      const tA = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
      const tB = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
      return tB - tA;
    });

    return list.filter((item) => !dismissedIds.includes(item.id));
  }, [bookedEscrows, currentUser, readBookingTimestamps, unreadBookingIds, dismissedIds, socialMatches]);

  // Filter by Tab (All / Unread)
  const displayedNotifications = useMemo(() => {
    if (filterTab === 'unread') {
      return allNotifications.filter((n) => n.isUnread);
    }
    return allNotifications;
  }, [allNotifications, filterTab]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => n.isUnread).length;
  }, [allNotifications]);

  // Action when a notification is clicked ("muốn xem kỹ gì thì nhấp vô là xem như hiện tại" — click whatever you want to look at closely, same as it works today)
  const handleItemClick = (item) => {
    if (item.isUnread && item.bookingId && item.bookingId !== 'support') {
      onMarkAsRead?.(item.bookingId);
    }
    onClose?.();

    if (item.targetType === 'booking') {
      if (onSelectBooking) {
        onSelectBooking(item.bookingId);
      } else if (onOpenInbox) {
        onOpenInbox(item.bookingId);
      }
    } else if (item.targetType === 'support') {
      onOpenInbox?.('support');
    } else if (item.targetType === 'trip' && item.trip) {
      onSelectTrip?.(item.trip);
    }
  };

  const handleDismiss = (e, notifId) => {
    e.stopPropagation();
    const next = [...dismissedIds, notifId];
    setDismissedIds(next);
    setActiveMenuId(null);
    try {
      localStorage.setItem('carmate_dismissed_notifs', JSON.stringify(next));
    } catch {}
  };

  const handleToggleReadStatus = (e, item) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (!item.bookingId || item.bookingId === 'support') return;

    if (item.isUnread) {
      onMarkAsRead?.(item.bookingId);
    } else {
      onMarkAsUnread?.(item.bookingId);
    }
  };

  const renderEventIcon = (type) => {
    switch (type) {
      case 'match':
        return <Sparkles className="w-2.5 h-2.5 text-white" />;
      case 'pre_confirmed':
        return <Zap className="w-2.5 h-2.5 text-white" />;
      case 'confirmed':
        return <CheckCircle2 className="w-2.5 h-2.5 text-white" />;
      case 'support':
        return <ShieldCheck className="w-2.5 h-2.5 text-white" />;
      case 'inquiring':
        return <Car className="w-2.5 h-2.5 text-white" />;
      default:
        return <MessageSquare className="w-2.5 h-2.5 text-white" />;
    }
  };

  const getBadgeBg = (type) => {
    switch (type) {
      case 'match':
        return 'bg-gradient-to-tr from-amber-500 to-orange-500';
      case 'pre_confirmed':
        return 'bg-amber-500';
      case 'confirmed':
        return 'bg-emerald-500';
      case 'support':
        return 'bg-indigo-500';
      case 'inquiring':
        return 'bg-[#0071e3]';
      case 'cancelled':
        return 'bg-rose-500';
      default:
        return 'bg-[#0071e3]';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      aria-label={t('notifDrop.s008')}
      className="absolute right-0 top-[calc(100%+8px)] w-[calc(100vw-24px)] sm:w-[440px] max-h-[85vh] flex flex-col rounded-3xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_20px_60px_rgba(0,0,0,0.22)] z-50 animate-in fade-in zoom-in-95 duration-150 text-left select-none overflow-hidden"
    >
      {/* ── 1. YouTube Notification Header ── */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <h3 className="type-heading text-slate-900 dark:text-white">
            {t('notifDrop.s001')}
          </h3>
          {unreadCount > 0 && (
            <span className="type-footnote px-2 py-0.5 rounded-full bg-[#0071e3] text-white">
              {unreadCount} mới
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && onMarkAllRead && (
            <button
              type="button"
              onClick={onMarkAllRead}
              title={t('notifDrop.s009')}
              className="type-button px-2.5 py-1 rounded-full text-[#0071e3] hover:bg-[#0071e3]/10 transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>{t('notifDrop.s002')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label={t('notifDrop.s010')}
            className="type-button w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 2. YouTube Filter Chips ("Tất cả" / "Chưa đọc" = All / Unread) ── */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.04] dark:border-white/[0.04]">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`type-button px-3 py-1 rounded-full transition-all cursor-pointer ${
            filterTab === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
              : 'bg-black/[0.05] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
          }`}
        >
          {t('notifDrop.s003')}
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('unread')}
          className={`type-button px-3 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
            filterTab === 'unread'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
              : 'bg-black/[0.05] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
          }`}
        >
          <span>{t('notifDrop.s004')}</span>
          {unreadCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#0071e3] inline-block ml-0.5" />
          )}
        </button>
      </div>

      {/* ── 3. YouTube Notification Feed ── */}
      <div className="flex-1 overflow-y-auto max-h-[460px] divide-y divide-black/[0.04] dark:divide-white/[0.05] custom-scrollbar">
        {displayedNotifications.length > 0 ? (
          displayedNotifications.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`flex items-start gap-3 p-3.5 sm:p-4 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors cursor-pointer group relative ${
                item.isUnread ? 'bg-[#0071e3]/[0.03] dark:bg-[#0071e3]/[0.05]' : ''
              }`}
            >
              {/* Left column: Avatar + Mini Event Badge */}
              <div className="relative shrink-0 mt-0.5">
                {item.avatar ? (
                  <img
                    src={item.avatar}
                    alt={item.senderName}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/10 shadow-xs"
                  />
                ) : (
                  <div className="type-body-strong w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-[#0071e3] to-[#5ac8fa] text-white flex items-center justify-center shadow-xs">
                    {item.senderName ? item.senderName.charAt(0).toUpperCase() : 'C'}
                  </div>
                )}

                {/* Event Badge at the avatar corner */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-[#1c1c1e] shadow-xs flex items-center justify-center p-0.5">
                  <div className={`w-full h-full rounded-full flex items-center justify-center ${getBadgeBg(item.type)}`}>
                    {renderEventIcon(item.type)}
                  </div>
                </div>
              </div>

              {/* Middle column: Detailed content, YouTube style */}
              <div className="flex-1 min-w-0 pr-1">
                <p className="type-caption text-slate-800 dark:text-slate-200 line-clamp-2">
                  <span className="font-bold text-slate-900 dark:text-white mr-1">
                    {item.senderName}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {item.actionText}
                  </span>
                </p>

                {item.snippet && (
                  <p className="type-caption text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 italic">
                    &ldquo;{item.snippet}&rdquo;
                  </p>
                )}

                <div className="flex items-center gap-2 mt-1.5">
                  <span className="type-footnote text-slate-400 dark:text-slate-500">
                    {item.relativeTime}
                  </span>
                  {item.booking?.status && (
                    <span className="type-footnote px-1.5 py-0.2 rounded bg-black/[0.04] dark:bg-white/[0.06] text-slate-500 dark:text-slate-400">
                      {item.booking.status === 'confirmed' ? 'Đã chốt' : item.booking.status === 'pre_confirmed' ? 'Giữ chỗ 15p' : 'Trao đổi'}
                    </span>
                  )}
                </div>
              </div>

              {/* Right column: Vehicle thumbnail / Route + Blue unread dot + 3-dot menu */}
              <div className="flex items-center gap-2 shrink-0 self-center">
                {item.thumbnail ? (
                  <div className="w-12 h-9 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 shrink-0 bg-slate-100 dark:bg-slate-800 shadow-2xs">
                    <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : item.routeBadge ? (
                  <div className="type-footnote hidden xs:flex flex-col items-end justify-center px-2 py-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-slate-600 dark:text-slate-300 max-w-[85px] truncate">
                    <span className="truncate">{item.routeBadge}</span>
                  </div>
                ) : null}

                {/* YouTube-standard blue unread dot */}
                {item.isUnread && (
                  <span
                    title={t('notifDrop.s004')}
                    className="w-2.5 h-2.5 rounded-full bg-[#0071e3] ring-2 ring-[#0071e3]/30 shrink-0 animate-pulse"
                  />
                )}

                {/* YouTube 3-dot options button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === item.id ? null : item.id);
                    }}
                    title={t('notifDrop.s011')}
                    className="type-button w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {/* 3-dot popover menu */}
                  {activeMenuId === item.id && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 top-full mt-1 w-48 rounded-2xl bg-white dark:bg-[#252528] shadow-xl border border-black/[0.08] dark:border-white/[0.12] p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
                    >
                      {item.bookingId && item.bookingId !== 'support' && (
                        <button
                          type="button"
                          onClick={(e) => handleToggleReadStatus(e, item)}
                          className="type-button w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-[#0071e3]" />
                          <span>{item.isUnread ? 'Đánh dấu là đã đọc' : 'Đánh dấu là chưa đọc'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDismiss(e, item.id)}
                        className="type-button w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      >
                        <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                        <span>{t('notifDrop.s005')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          /* YouTube-style Empty State */
          <div className="py-12 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-black/[0.03] dark:bg-white/[0.05] flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Bell className="w-7 h-7 opacity-50" />
            </div>
            <h4 className="type-heading text-slate-800 dark:text-slate-200">
              {filterTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Thông báo của bạn sẽ hiển thị ở đây'}
            </h4>
            <p className="type-caption text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
              {filterTab === 'unread'
                ? 'Tuyệt vời! Bạn đã đọc toàn bộ tin nhắn và cập nhật chuyến đi.'
                : 'Mọi tin nhắn, cập nhật giữ chỗ và ghép xe tiện chuyến sẽ hiển thị tức thời tại đây.'}
            </p>
          </div>
        )}
      </div>

      {/* ── 4. YouTube Notification Footer ── */}
      <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            triggerMacNotification({
              title: 'Tin nhắn từ Chủ xe Mai Anh',
              message: 'Mình đã tới điểm đón tại Trạm thu phí, xe Mazda đỏ 51H-982.xx bạn nhé!',
              type: 'message',
              actionLabel: 'Xem ngay'
            });
          }}
          title={t('notifDrop.s012')}
          className="type-button px-2.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-[#0071e3] hover:bg-[#0071e3]/10 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#0071e3]" />
          <span>{t('notifDrop.s006')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose?.();
            onOpenInbox?.();
          }}
          className="type-button px-3.5 py-1.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>{t('notifDrop.s007')}</span>
          <ArrowRight className="w-3 h-3 opacity-80" />
        </button>
      </div>
    </div>
  );
}
