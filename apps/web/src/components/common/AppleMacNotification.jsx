import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  MessageSquare,
  Zap,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldAlert,
  Car
} from 'lucide-react';
import { playMessageChime } from '../../utils/audioFeedback.js';
import { useI18n } from '../../i18n/index.jsx';

/**
 * Event emitter đơn giản cho Apple macOS In-App Notification
 */
export function triggerMacNotification({
  title = 'Thông báo mới',
  message = '',
  type = 'message', // 'message' | 'pre_confirmed' | 'confirmed' | 'warning' | 'trip'
  bookingId = null,
  partnerName = '',
  actionLabel = 'Xem ngay',
  duration = 6000
} = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('carmate:mac-notify', {
      detail: {
        id: `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        message,
        type,
        bookingId,
        partnerName,
        actionLabel,
        duration,
        timestamp: Date.now()
      }
    })
  );
}

export default function AppleMacNotification({ onOpenInbox, onSelectBooking }) {
  const { t } = useI18n();
  const [notification, setNotification] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleIncomingNotification = (e) => {
      const data = e.detail;
      if (!data) return;
      setIsClosing(false);
      setNotification(data);
      // Phát âm thanh chuông Apple nhẹ nhàng
      playMessageChime();
    };

    window.addEventListener('carmate:mac-notify', handleIncomingNotification);
    return () => {
      window.removeEventListener('carmate:mac-notify', handleIncomingNotification);
    };
  }, []);

  // Tự động đóng sau `duration` nếu không hover chuột
  useEffect(() => {
    if (!notification || isHovered) return;

    const timer = setTimeout(() => {
      handleClose();
    }, notification.duration || 6000);

    return () => clearTimeout(timer);
  }, [notification, isHovered]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setNotification(null);
      setIsClosing(false);
    }, 280);
  };

  const handleAction = () => {
    if (notification?.bookingId) {
      if (onSelectBooking) {
        onSelectBooking(notification.bookingId);
      } else if (onOpenInbox) {
        onOpenInbox(notification.bookingId);
      }
    } else if (onOpenInbox) {
      onOpenInbox();
    }
    handleClose();
  };

  if (!notification || typeof document === 'undefined') return null;

  const getIcon = () => {
    switch (notification.type) {
      case 'pre_confirmed':
        return <Zap className="w-3.5 h-3.5 text-blue-500" />;
      case 'confirmed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'warning':
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />;
      case 'trip':
        return <Car className="w-3.5 h-3.5 text-[#0071e3]" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-[#0071e3]" />;
    }
  };

  return createPortal(
    <aside
      aria-label={t('macNotif.s003')}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed top-4 right-4 z-[999999] w-[calc(100vw-32px)] sm:w-[360px] select-none pointer-events-auto transition-all duration-300 ease-out ${
        isClosing
          ? 'opacity-0 translate-x-12 scale-95'
          : 'opacity-100 translate-x-0 scale-100'
      }`}
    >
      {/* Khung kính mờ Apple macOS Liquid Banner */}
      <div
        onClick={handleAction}
        className="group relative overflow-hidden rounded-2xl bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl border border-black/10 dark:border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.22)] p-3 sm:p-3.5 cursor-pointer transition-all hover:shadow-[0_25px_60px_rgba(0,0,0,0.28)] hover:bg-white/95 dark:hover:bg-[#242426]/95"
      >
        {/* Thanh tiêu đề Apple macOS Style */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* App Icon Squircle */}
            <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#0071e3] to-[#5ac8fa] flex items-center justify-center text-white shadow-2xs shrink-0">
              {getIcon()}
            </div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 font-mono truncate">
              CARMATE
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              {t('macNotif.s001')}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            aria-label={t('macNotif.s004')}
            className="w-9 h-9 -m-2 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Nội dung thông báo */}
        <div className="space-y-1 pr-1">
          <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-[#0071e3] transition-colors">
            {notification.title}
          </h4>
          <p className="text-[11.5px] sm:text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {notification.message}
          </p>
        </div>

        {/* Nút hành động chuẩn macOS */}
        <div className="mt-2.5 pt-2 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            {t('macNotif.s002')}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAction();
            }}
            className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 text-white shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>{notification.actionLabel || 'Xem ngay'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Thanh đếm thời gian mờ Apple */}
        {!isHovered && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/5 dark:bg-white/5">
            <div
              className="h-full bg-[#0071e3]/60 transition-all ease-linear"
              style={{
                width: '100%',
                animation: `shrinkWidth ${notification.duration || 6000}ms linear forwards`
              }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </aside>,
    document.body
  );
}
