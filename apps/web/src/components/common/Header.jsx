import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Sparkles,
  PlusCircle,
  Clock,
  ShieldCheck,
  FileText,
  Globe,
  Car,
  User,
  LogOut,
  ChevronDown,
  HelpCircle,
  Lock,
  Users,
  MessageCircle,
  Bell,
  Inbox,
  CheckCheck,
  Zap,
  CheckCircle2,
  ArrowRight,
  Fuel
} from 'lucide-react';
import { SITE_INFO } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import { LogoMark } from '../ui/Logo.jsx';
import Button, { IconButton } from '../ui/Button.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';
import { isAdminUser } from '../../utils/adminGate.js';

export function LanguageToggle({ className = '' } = {}) {
  const { lang, setLang } = useI18n();
  const next = lang === 'vi' ? 'en' : 'vi';
  const label = lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt';

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      title={label}
      aria-label={label}
      className={`type-button-sm relative tap-area-44 h-8.5 sm:h-9 px-2.5 rounded-full inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 text-[#1d1d1f] dark:text-white border border-black/[0.08] dark:border-white/[0.08] shadow-xs hover:bg-[#f5f5f7] dark:hover:bg-slate-700 active:scale-[0.98] transition-all cursor-pointer select-none shrink-0 ${className}`}
    >
      <Globe className="w-3.5 h-3.5 text-[#0071e3]" />
      <span className="type-caption uppercase">{lang === 'vi' ? 'EN' : 'VI'}</span>
    </button>
  );
}

/**
 * Giai đoạn 1 tập trung vào tìm chuyến; nút trợ lý AI tạm ẩn khỏi thanh tiêu đề.
 * Đổi về true để bật lại — không cần sửa gì thêm.
 */
const SHOW_AI_ASSISTANT_BUTTON = false;

export default function Header({
  activeTab,
  setActiveTab,
  onRequestPostTrip,
  setShowPolicyModal,
  bookedCount = 0,
  _myTripsCount = 0,
  inboxCount = 0,
  onOpenInbox,
  currentUser = null,
  onOpenAuth,
  onLogout,
  onOpenAi,
  onOpenProfile,
  bookedEscrows = [],
  onSelectBooking,
  onSelectTrip,
  onMarkAllRead,
  onMarkAsRead,
  onMarkAsUnread,
  readBookingTimestamps = {},
  unreadBookingIds = [],
  socialMatches = [],
}) {
  const { t, lang, setLang } = useI18n();
  const tabs = [
    { id: 'market', label: t('nav.corridorTab'), icon: Compass },
    { id: 'station', label: t('nav.stationTab'), icon: Fuel },
    { id: 'booked', label: t('nav.booked') || 'Chuyến của tôi', icon: Clock, badge: bookedCount }
  ];

  const isMac =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent || navigator.platform || '');

  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const userMenuRef = useRef(null);
  const notificationCenterRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
      if (notificationCenterRef.current && !notificationCenterRef.current.contains(e.target)) {
        setIsNotificationCenterOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsNotificationCenterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/85 dark:bg-[#1c1c1e]/85 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
          : 'bg-white/60 dark:bg-[#1c1c1e]/60 backdrop-blur-md border-b border-transparent'
      }`}
    >
      <div className="max-w-[1320px] mx-auto px-3 sm:px-6 lg:px-8 h-15 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('market')}
            className="type-button-sm flex items-center gap-2 cursor-pointer select-none text-left group"
            aria-label="CarMate.vn Home"
          >
            <LogoMark className="w-7 h-7 sm:w-8 sm:h-8 group-hover:scale-105 transition-transform" />
            <span className="type-title font-display text-[#1d1d1f] dark:text-white">
              Car<span className="bg-gradient-to-r from-[#0099ff] to-[#f59e0b] bg-clip-text text-transparent">Mate</span>
              <span className="type-body-strong text-[#0071e3] ml-0.5">.vn</span>
            </span>
          </button>

          {/* Badge cam kết bảo chứng toàn cục theo tư duy MIT Invariants */}
          <span className="type-footnote hidden lg:inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-200/60 dark:border-emerald-500/20 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>0% Phí sàn · 0đ Cọc</span>
          </span>
        </div>

        <nav
          aria-label="Desktop navigation"
          className="hidden md:flex items-center p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06]"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`type-button-sm relative px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer select-none flex items-center gap-1.5 ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-md hover:scale-[1.02]'
                    : 'text-[#515154] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:scale-[1.02]'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" strokeWidth={active ? 2.4 : 2} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span
                    className={`type-footnote ml-1 px-1.5 py-0.2 rounded-full ${
                      active ? 'bg-[#0071e3] text-white' : 'bg-black/[0.08] text-[#515154]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ĐĂNG CHUYẾN — tách khỏi nhóm tab tra cứu và tạo điểm nhấn riêng.
            Đây là nút sinh ra NGUỒN CUNG cho nền tảng: chủ xe lướt vào phải
            thấy ngay lối đi của mình, không để nó chìm lẫn giữa các tab xem
            thông tin. Dùng xanh mint đồng bộ với nút nổi trên thanh dưới. */}
        <button
          type="button"
          onClick={() => onRequestPostTrip?.('driver')}
          aria-current={activeTab === 'cockpit' ? 'page' : undefined}
          className={`type-button-sm hidden md:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border transition-all duration-200 cursor-pointer select-none shrink-0 ${
            activeTab === 'cockpit'
              ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/25'
              : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
          }`}
        >
          <Car className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
          <span>{t('nav.tabPickup')}</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* NÚT TRỢ LÝ AI — TẠM ẨN Ở GIAI ĐOẠN 1.
              Bài toán cốt lõi lúc này là niềm tin và thanh khoản trên trục QL13.
              Một nút trợ lý nằm ngay cạnh hành động chính chỉ làm phân tán sự
              chú ý khỏi việc quan trọng nhất: TÌM CHUYẾN XE.
              Phím tắt ⌘K vẫn hoạt động cho người dùng nội bộ; bật lại nút chỉ
              cần đổi cờ này về true khi nghiệp vụ trợ lý đủ sâu. */}
          {SHOW_AI_ASSISTANT_BUTTON && (
          <button
            type="button"
            onClick={onOpenAi}
            title={isMac ? 'Trợ lý CarMate (Phím tắt: ⌘K)' : 'Trợ lý CarMate (Phím tắt: Ctrl+K)'}
            aria-label={t('header2.s004')}
            className="type-button-sm relative tap-area-44 inline-flex items-center justify-center gap-1.5 h-8.5 w-8.5 sm:h-9 sm:w-auto px-0 sm:px-3 rounded-full bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-black/[0.08] cursor-pointer select-none outline-none focus:outline-none transition-all shadow-xs active:scale-[0.98] group shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0071e3] group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline font-medium">{t('nav.assistant') || t('nav.aiAssistant') || 'Trợ lý'}</span>
            <kbd className="type-footnote hidden lg:inline-flex items-center px-1.5 py-0.5 font-mono rounded-md bg-black/[0.05] text-[#515154] border border-black/[0.06] ml-0.5">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
          )}

          {currentUser ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
                className="type-button-sm relative tap-area-44 h-8.5 sm:h-9 pl-2 pr-2.5 sm:pr-3 rounded-full inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 text-[#1d1d1f] dark:text-white border border-black/[0.08] dark:border-white/[0.08] shadow-xs hover:bg-[#f5f5f7] dark:hover:bg-slate-700 transition-all active:scale-[0.98] shrink-0 cursor-pointer"
              >
                <span className="relative flex items-center justify-center shrink-0">
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-5 h-5 rounded-full object-cover shadow-2xs ring-1 ring-emerald-500/30"
                    />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#0071e3] to-[#5ac8fa] text-white inline-flex items-center justify-center shadow-2xs">
                      <User className="w-3 h-3 text-white" />
                    </span>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
                </span>
                <span className="max-w-[70px] sm:max-w-[110px] truncate">{currentUser.name}</span>
                <ChevronDown
                  className={`w-3 h-3 text-[#86868b] transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Apple Profile Popover Menu */}
              {isUserMenuOpen && (
                <>
                  {/* Backdrop cho mobile để chạm ngoài đóng popover tức thì */}
                  <div
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] sm:hidden"
                    onClick={() => setIsUserMenuOpen(false)}
                    aria-hidden="true"
                  />

                  <div className="absolute right-0 top-[calc(100%+8px)] w-[calc(100vw-24px)] sm:w-72 max-w-[320px] max-h-[calc(100vh-80px)] overflow-y-auto overscroll-contain rounded-3xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_20px_50px_rgba(0,0,0,0.18)] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-left select-none custom-scrollbar">
                    {/* KHỐI 1: Nhận diện & Trạng thái tài khoản */}
                    <div className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.04] mb-1.5 flex items-center gap-2.5">
                      <div className="relative shrink-0">
                        {currentUser.avatar ? (
                          <img
                            src={currentUser.avatar}
                            alt={currentUser.name}
                            className="w-10 h-10 rounded-full object-cover shadow-xs ring-2 ring-[#0071e3]/20"
                          />
                        ) : (
                          <span className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0071e3] to-[#5ac8fa] text-white inline-flex items-center justify-center shadow-xs ring-2 ring-[#0071e3]/20">
                            <User className="w-5 h-5 text-white" strokeWidth={2.2} />
                          </span>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#1c1c1e]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="type-caption text-[#1d1d1f] dark:text-white truncate">
                            {currentUser.name}
                          </p>
                          {isAdminUser(currentUser) && (
                            <span className="type-footnote inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              {t('userMenu.adminBadge')}
                            </span>
                          )}
                        </div>
                        <p className="type-caption text-[#86868b] truncate mt-0.5">
                          {currentUser.phone || t('userMenu.verifiedIdentity')}
                        </p>
                      </div>
                    </div>

                    {/* KHỐI 2: Hoạt động cá nhân & Chuyến đi */}
                    <div className="space-y-0.5">
                      {/* Hồ sơ & Garage của tôi */}
                      <button
                        type="button"
                        onClick={() => {
                          onOpenProfile?.();
                          setIsUserMenuOpen(false);
                        }}
                        className="type-button-sm w-full min-h-[42px] sm:min-h-[38px] px-3 py-2 rounded-xl inline-flex items-center justify-between text-[#1d1d1f] dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer group active:scale-[0.99]"
                      >
                        <div className="inline-flex items-center gap-2.5">
                          <User className="w-4 h-4 text-[#0071e3] group-hover:scale-110 transition-transform shrink-0" />
                          <span>{t('userMenu.profileGarage')}</span>
                        </div>
                        {currentUser?.vehicle?.brand ? (
                          <span className="type-footnote px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                            {currentUser.vehicle.brand}
                          </span>
                        ) : (
                          <span className="type-footnote text-[#86868b]">{t('userMenu.noVehicle')}</span>
                        )}
                      </button>

                      {/* Chuyến đi & Lịch hẹn của tôi */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('booked');
                          setIsUserMenuOpen(false);
                        }}
                        className="type-button-sm w-full min-h-[42px] sm:min-h-[38px] px-3 py-2 rounded-xl inline-flex items-center justify-between text-[#1d1d1f] dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer group active:scale-[0.99]"
                      >
                        <div className="inline-flex items-center gap-2.5">
                          <Clock className="w-4 h-4 text-[#0071e3] group-hover:scale-110 transition-transform shrink-0" />
                          <span>{t('userMenu.myTrips')}</span>
                        </div>
                        {bookedCount > 0 && (
                          <span className="type-footnote px-2 py-0.5 rounded-full bg-[#0071e3] text-white tabular">
                            {bookedCount}
                          </span>
                        )}
                      </button>

                      {/* Hộp thư & Chat chuyến */}
                      <button
                        type="button"
                        onClick={() => {
                          onOpenInbox?.();
                          setIsUserMenuOpen(false);
                        }}
                        className="type-button-sm w-full min-h-[42px] sm:min-h-[38px] px-3 py-2 rounded-xl inline-flex items-center justify-between text-[#1d1d1f] dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer group active:scale-[0.99]"
                      >
                        <div className="inline-flex items-center gap-2.5">
                          <Inbox className="w-4 h-4 text-[#0071e3] group-hover:scale-110 transition-transform shrink-0" />
                          <span>{t('header2.s001')}</span>
                        </div>
                        {inboxCount > 0 && (
                          <span className="type-footnote px-2 py-0.5 rounded-full bg-rose-500 text-white tabular">
                            {inboxCount}
                          </span>
                        )}
                      </button>

                      {/* Buồng lái chủ xe & Quản lý chuyến */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('cockpit');
                          setIsUserMenuOpen(false);
                        }}
                        className="type-button-sm w-full min-h-[42px] sm:min-h-[38px] px-3 py-2 rounded-xl inline-flex items-center justify-between text-[#1d1d1f] dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer group active:scale-[0.99]"
                      >
                        <div className="inline-flex items-center gap-2.5">
                          <Car className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform shrink-0" />
                          <span>Quản lý xe đang chạy</span>
                        </div>
                        <span className="type-footnote px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                          {t('userMenu.driverShortcutBadge')}
                        </span>
                      </button>

                      {/* Lối tắt: Đăng chuyến đón khách */}
                      <button
                        type="button"
                        onClick={() => {
                          onRequestPostTrip?.('driver');
                          setIsUserMenuOpen(false);
                        }}
                        className="type-button-sm w-full min-h-[42px] sm:min-h-[38px] px-3 py-2 rounded-xl inline-flex items-center justify-between text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer group active:scale-[0.99]"
                      >
                        <div className="inline-flex items-center gap-2.5">
                          <Sparkles className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform shrink-0" />
                          <span>{t('userMenu.postTripShortcut')}</span>
                        </div>
                        <span className="type-footnote px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/40">
                          {t('userMenu.driverShortcutBadge')}
                        </span>
                      </button>
                    </div>

                    {/* KHỐI 3: Quản trị hệ thống (Chỉ dành cho Admin) */}
                    {isAdminUser(currentUser) && (
                      <>
                        <div className="my-1.5 border-t border-black/[0.05] dark:border-white/[0.06]" />
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('admin');
                            setIsUserMenuOpen(false);
                          }}
                          className="type-button-sm w-full min-h-[42px] sm:min-h-[38px] px-3 py-2 rounded-xl inline-flex items-center justify-between text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer group active:scale-[0.99]"
                        >
                          <div className="inline-flex items-center gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform shrink-0" />
                            <span>{t('userMenu.adminPortal')}</span>
                          </div>
                          <span className="type-footnote text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200/60 dark:border-rose-800/40">
                            Admin
                          </span>
                        </button>
                      </>
                    )}

                    {/* KHỐI 4: Tuỳ chọn & Hỗ trợ */}
                    <div className="my-1.5 border-t border-black/[0.05] dark:border-white/[0.06]" />
                    <div className="space-y-0.5">
                      {/* Chuyển đổi ngôn ngữ */}
                      <div className="type-caption w-full min-h-[42px] sm:min-h-[38px] px-3 py-1.5 rounded-xl flex items-center justify-between text-[#1d1d1f] dark:text-slate-200">
                        <div className="inline-flex items-center gap-2.5 font-semibold">
                          <Globe className="w-4 h-4 text-[#0071e3] shrink-0" />
                          <span>{t('userMenu.language')}</span>
                        </div>
                        <div className="inline-flex items-center p-0.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.06]">
                          <button
                            type="button"
                            onClick={() => setLang('vi')}
                            className={`type-button-sm px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                              lang === 'vi' ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-xs' : 'text-[#86868b] hover:text-[#1d1d1f]'
                            }`}
                          >
                            VI
                          </button>
                          <button
                            type="button"
                            onClick={() => setLang('en')}
                            className={`type-button-sm px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                              lang === 'en' ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-xs' : 'text-[#86868b] hover:text-[#1d1d1f]'
                            }`}
                          >
                            EN
                          </button>
                        </div>
                      </div>

                      {/* Quy chế & Chính sách an toàn */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowPolicyModal?.(true);
                          setIsUserMenuOpen(false);
                        }}
                        className="type-button-sm w-full min-h-[42px] sm:min-h-[38px] px-3 py-2 rounded-xl inline-flex items-center gap-2.5 text-[#515154] dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer active:scale-[0.99]"
                      >
                        <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{t('userMenu.safetyPolicy')}</span>
                      </button>

                      {/* Hỗ trợ trực tiếp qua Telegram */}
                      <a
                        href={SITE_INFO.telegramSupport || SITE_INFO.telegram || 'https://t.me/brianhuynh91'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="type-badge w-full min-h-[42px] sm:min-h-[38px] px-3 py-2 rounded-xl inline-flex items-center justify-between text-[#1d1d1f] dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer group active:scale-[0.99]"
                      >
                        <div className="inline-flex items-center gap-2.5">
                          <MessageCircle className="w-4 h-4 text-[#229ED9] group-hover:scale-110 transition-transform shrink-0" />
                          <span>{t('userMenu.support')}</span>
                        </div>
                        <span className="type-footnote text-[#229ED9] bg-[#229ED9]/10 px-2 py-0.5 rounded-md">
                          Telegram
                        </span>
                      </a>
                    </div>

                    {/* KHỐI 5: Thoát & Quyền riêng tư */}
                    <div className="my-1.5 border-t border-black/[0.05] dark:border-white/[0.06]" />
                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onLogout?.();
                        }}
                        className="type-button-sm w-full min-h-[42px] sm:min-h-[38px] px-3 py-2 rounded-xl inline-flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer active:scale-[0.99]"
                      >
                        <LogOut className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{t('userMenu.logout')}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="type-button-sm relative tap-area-44 h-8.5 sm:h-9 px-2.5 sm:px-3.5 rounded-full inline-flex items-center gap-1.5 bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] border border-black/[0.08] hover:border-black/[0.16] shadow-xs cursor-pointer active:scale-[0.98] transition-all shrink-0"
            >
              <User className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
              <span className="hidden sm:inline">{t('nav.signInOrRegister')}</span>
              <span className="sm:hidden">{t('nav.signIn')}</span>
            </button>
          )}

          {/* Nút Chuông Thông Báo macOS - Góc phải trên cùng */}
          <div className="relative" ref={notificationCenterRef}>
            <button
              type="button"
              onClick={() => setIsNotificationCenterOpen((prev) => !prev)}
              aria-expanded={isNotificationCenterOpen}
              aria-haspopup="true"
              title={t('header2.s005')}
              aria-label={t('header2.s006')}
              className={`type-button-sm relative tap-area-44 inline-flex items-center justify-center h-8.5 w-8.5 sm:h-9 sm:w-9 rounded-full border cursor-pointer transition-all shadow-xs active:scale-[0.98] shrink-0 ${
                isNotificationCenterOpen
                  ? 'bg-[#0071e3]/10 dark:bg-[#0071e3]/20 border-[#0071e3]/30 text-[#0071e3]'
                  : 'bg-white dark:bg-slate-800 hover:bg-[#f5f5f7] dark:hover:bg-slate-700 text-[#1d1d1f] dark:text-white border-black/[0.08] dark:border-white/[0.08]'
              }`}
            >
              <Bell className={`w-4 h-4 transition-transform ${isNotificationCenterOpen ? 'rotate-12 text-[#0071e3]' : 'text-slate-700 dark:text-slate-200'}`} />
              {inboxCount > 0 && (
                <span className="type-footnote absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs animate-pulse">
                  {inboxCount > 9 ? '9+' : inboxCount}
                </span>
              )}
            </button>

            {/* YouTube Style Notification Dropdown */}
            <NotificationDropdown
              isOpen={isNotificationCenterOpen}
              onClose={() => setIsNotificationCenterOpen(false)}
              bookedEscrows={bookedEscrows}
              currentUser={currentUser}
              socialMatches={socialMatches}
              readBookingTimestamps={readBookingTimestamps}
              unreadBookingIds={unreadBookingIds}
              onSelectBooking={onSelectBooking}
              onSelectTrip={onSelectTrip}
              onMarkAllRead={onMarkAllRead}
              onMarkAsRead={onMarkAsRead}
              onMarkAsUnread={onMarkAsUnread}
              onOpenInbox={onOpenInbox}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
