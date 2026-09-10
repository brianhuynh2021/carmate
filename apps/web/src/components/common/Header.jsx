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
  Trash2,
  Lock,
  Users,
  MessageCircle,
  Bell,
  Inbox,
  CheckCheck,
  Zap,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { SITE_INFO } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import { LogoMark } from '../ui/Logo.jsx';
import Button, { IconButton } from '../ui/Button.jsx';
import { triggerMacNotification } from './AppleMacNotification.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';

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
      className={`h-8.5 sm:h-9 px-2.5 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-slate-800 text-[#1d1d1f] dark:text-white border border-black/[0.08] dark:border-white/[0.08] shadow-xs hover:bg-[#f5f5f7] dark:hover:bg-slate-700 active:scale-[0.98] transition-all cursor-pointer select-none shrink-0 ${className}`}
    >
      <Globe className="w-3.5 h-3.5 text-[#0071e3]" />
      <span className="font-mono text-xs font-bold uppercase">{lang === 'vi' ? 'EN' : 'VI'}</span>
    </button>
  );
}

export default function Header({
  activeTab,
  setActiveTab,
  onRequestPostTrip,
  setShowPolicyModal,
  bookedCount = 0,
  myTripsCount = 0,
  inboxCount = 0,
  onOpenInbox,
  currentUser = null,
  onOpenAuth,
  onLogout,
  onOpenAi,
  onOpenProfile,
  onOpenDeleteAccount,
  bookedEscrows = [],
  onSelectBooking,
  onSelectTrip,
  onMarkAllRead,
  onMarkAsRead,
  onMarkAsUnread,
  readBookingTimestamps = {},
  unreadBookingIds = [],
  socialMatches = []
}) {
  const { t, lang, setLang } = useI18n();
  const tabs = [
    { id: 'market', label: t('nav.market'), icon: Compass },
    { id: 'match', label: t('nav.match'), icon: Sparkles },
    { id: 'my-trips', label: t('nav.myTrips'), icon: Car, badge: myTripsCount },
    { id: 'booked', label: t('nav.booked'), icon: Clock, badge: bookedCount }
  ];

  const isMac =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent || navigator.platform || '');

  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPostMenuOpen, setIsPostMenuOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const userMenuRef = useRef(null);
  const postMenuRef = useRef(null);
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
      if (postMenuRef.current && !postMenuRef.current.contains(e.target)) {
        setIsPostMenuOpen(false);
      }
      if (notificationCenterRef.current && !notificationCenterRef.current.contains(e.target)) {
        setIsNotificationCenterOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsPostMenuOpen(false);
        setIsNotificationCenterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const recentBookings = (bookedEscrows || []).slice(0, 6);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/85 dark:bg-[#1c1c1e]/85 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
          : 'bg-white/60 dark:bg-[#1c1c1e]/60 backdrop-blur-md border-b border-transparent'
      }`}
    >
      <div className="max-w-[1320px] mx-auto px-3 sm:px-6 lg:px-8 h-15 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('market')}
            className="flex items-center gap-2 cursor-pointer select-none text-left group"
            aria-label="CarMate Home"
          >
            <LogoMark className="w-7 h-7 sm:w-8 sm:h-8 group-hover:scale-105 transition-transform" />
            <span className="font-display font-black text-lg sm:text-xl tracking-tight leading-none text-[#1d1d1f] dark:text-white">
              Car<span className="bg-gradient-to-r from-[#0099ff] to-[#f59e0b] bg-clip-text text-transparent">Mate</span>
            </span>
          </button>
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
                className={`relative px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer select-none flex items-center gap-1.5 ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                    : 'text-[#515154] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-white'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" strokeWidth={active ? 2.4 : 2} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
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

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenAi}
            title={isMac ? 'Trợ lý CarMate AI (Phím tắt: ⌘K)' : 'Trợ lý CarMate AI (Phím tắt: Ctrl+K)'}
            aria-label="Mở Trợ lý CarMate AI"
            className="inline-flex items-center justify-center gap-1.5 h-8.5 w-8.5 sm:h-9 sm:w-auto px-0 sm:px-3 rounded-full text-xs font-semibold bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-black/[0.08] cursor-pointer select-none outline-none focus:outline-none transition-all shadow-xs active:scale-[0.98] group shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0071e3] group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline font-medium">{t('nav.aiAssistant') || 'Trợ lý AI'}</span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-black/[0.05] text-[#515154] border border-black/[0.06] ml-0.5">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>

          <div className="hidden sm:block relative" ref={postMenuRef}>
            <button
              type="button"
              onClick={() => setIsPostMenuOpen((prev) => !prev)}
              aria-expanded={isPostMenuOpen}
              aria-haspopup="true"
              className="h-9 pl-3.5 pr-3 rounded-full inline-flex items-center gap-1.5 text-xs font-bold bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] text-white shadow-[0_2px_8px_rgba(0,113,227,0.28)] hover:shadow-[0_4px_16px_rgba(0,113,227,0.38)] active:scale-[0.98] transition-all cursor-pointer select-none shrink-0 group"
            >
              <PlusCircle className="w-3.5 h-3.5 text-white/90 group-hover:rotate-90 transition-transform duration-200" strokeWidth={2.4} />
              <span>{t('nav.post')}</span>
              <ChevronDown
                className={`w-3 h-3 text-white/80 transition-transform duration-200 ${isPostMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isPostMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-72 rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_16px_40px_rgba(0,0,0,0.16)] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-left">
                <div className="px-2.5 py-1 mb-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#86868b]">{t('postMenu.title')}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsPostMenuOpen(false);
                    if (onRequestPostTrip) {
                      onRequestPostTrip('driver');
                    } else {
                      setActiveTab('post');
                    }
                  }}
                  className="w-full p-2.5 rounded-xl flex items-start gap-3 hover:bg-[#0071e3]/8 dark:hover:bg-[#0071e3]/15 transition-all text-left group cursor-pointer border border-transparent hover:border-[#0071e3]/20"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Car className="w-4 h-4 text-[#0071e3]" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1d1d1f] dark:text-white group-hover:text-[#0071e3] transition-colors">
                        {t('postMenu.driverTitle')}
                      </span>
                      <span className="text-[10px] font-semibold text-[#0071e3] bg-[#0071e3]/10 px-1.5 py-0.5 rounded-full">
                        {t('postMenu.driverBadge')}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#515154] dark:text-slate-400 mt-0.5 leading-snug">
                      {t('postMenu.driverDesc')}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPostMenuOpen(false);
                    if (onRequestPostTrip) {
                      onRequestPostTrip('passenger');
                    } else {
                      setActiveTab('post');
                    }
                  }}
                  className="w-full p-2.5 rounded-xl flex items-start gap-3 hover:bg-emerald-500/8 dark:hover:bg-emerald-500/15 transition-all text-left group cursor-pointer border border-transparent hover:border-emerald-500/20 mt-1"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Users className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1d1d1f] dark:text-white group-hover:text-emerald-600 transition-colors">
                        {t('postMenu.passengerTitle')}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                        {t('postMenu.passengerBadge')}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#515154] dark:text-slate-400 mt-0.5 leading-snug">
                      {t('postMenu.passengerDesc')}
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {currentUser ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
                className="h-8.5 sm:h-9 pl-2 pr-2.5 sm:pr-3 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-slate-800 text-[#1d1d1f] dark:text-white border border-black/[0.08] dark:border-white/[0.08] shadow-xs hover:bg-[#f5f5f7] dark:hover:bg-slate-700 transition-all active:scale-[0.98] shrink-0 cursor-pointer"
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
                <div className="absolute right-0 top-[calc(100%+8px)] w-60 rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_16px_40px_rgba(0,0,0,0.14)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-left">
                  {/* Header Thông tin tài khoản */}
                  <div className="px-3 py-2.5 border-b border-black/[0.05] dark:border-white/[0.06] mb-1 flex items-center gap-2.5">
                    {currentUser.avatar ? (
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        className="w-9 h-9 rounded-full object-cover shadow-xs ring-1 ring-emerald-500/30 shrink-0"
                      />
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0071e3] to-[#5ac8fa] text-white inline-flex items-center justify-center shadow-xs ring-2 ring-[#0071e3]/20 shrink-0">
                        <User className="w-4.5 h-4.5 text-white" strokeWidth={2.2} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1d1d1f] dark:text-white truncate">{currentUser.name}</p>
                      <p className="text-[11px] text-[#86868b] font-mono truncate">
                        {currentUser.phone || t('userMenu.verifiedIdentity')}
                      </p>
                      {(currentUser.role === 'admin' ||
                        currentUser.phone?.includes('0984883750') ||
                        currentUser.phone?.includes('0984 883 750')) && (
                        <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40">
                          <ShieldCheck className="w-3 h-3" /> {t('userMenu.adminBadge')}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenProfile?.();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full h-8.5 px-2.5 rounded-xl inline-flex items-center justify-between text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer group"
                  >
                    <div className="inline-flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-[#0071e3] group-hover:scale-110 transition-transform" />
                      {/* Hồ sơ & Garage của tôi */}
                      <span>{t('userMenu.profileGarage')}</span>
                    </div>
                    {currentUser?.vehicle?.brand ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                        {currentUser.vehicle.brand}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#86868b] font-normal">{t('userMenu.noVehicle')}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenInbox?.();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full h-8.5 px-2.5 rounded-xl inline-flex items-center justify-between text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer group"
                  >
                    <div className="inline-flex items-center gap-2">
                      <Inbox className="w-3.5 h-3.5 text-[#0071e3] group-hover:scale-110 transition-transform" />
                      <span>Hộp thư & Chat chuyến</span>
                    </div>
                    {inboxCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                        {inboxCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('my-trips');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full h-8.5 px-2.5 rounded-xl inline-flex items-center gap-2 text-xs font-medium text-[#1d1d1f] dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <Car className="w-3.5 h-3.5 text-[#0071e3]" />
                    <span>{t('userMenu.myTrips')}</span>
                  </button>

                  {(currentUser.role === 'admin' ||
                    currentUser.phone?.includes('0984883750') ||
                    currentUser.phone?.includes('0984 883 750')) && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('admin');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full h-8.5 px-2.5 rounded-xl inline-flex items-center gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                      <span>{t('userMenu.adminPortal')}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowPolicyModal?.(true);
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full h-8.5 px-2.5 rounded-xl inline-flex items-center gap-2 text-xs font-medium text-[#515154] dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('userMenu.safetyPolicy')}</span>
                  </button>

                  <div className="w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs text-[#1d1d1f] dark:text-slate-200">
                    <div className="inline-flex items-center gap-2 font-medium">
                      <Globe className="w-3.5 h-3.5 text-[#0071e3]" />
                      <span>{t('userMenu.language')}</span>
                    </div>
                    <div className="inline-flex items-center p-0.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => setLang('vi')}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          lang === 'vi' ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-xs' : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                      >
                        VI
                      </button>
                      <button
                        type="button"
                        onClick={() => setLang('en')}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          lang === 'en' ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-xs' : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                      >
                        EN
                      </button>
                    </div>
                  </div>

                  {/* Mục 5: Hỗ trợ bạn qua Telegram trực tiếp */}
                  <a
                    href={SITE_INFO.telegramSupport || SITE_INFO.telegram || 'https://t.me/brianhuynh91'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full h-8.5 px-2.5 rounded-xl inline-flex items-center justify-between text-xs font-medium text-[#1d1d1f] dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <div className="inline-flex items-center gap-2">
                      <MessageCircle className="w-3.5 h-3.5 text-[#229ED9]" />
                      <span>{t('userMenu.support')}</span>
                    </div>
                    <span className="text-[10.5px] font-bold text-[#229ED9] bg-[#229ED9]/10 px-1.5 py-0.5 rounded">
                      Telegram
                    </span>
                  </a>

                  <div className="my-1 border-t border-black/[0.05] dark:border-white/[0.06]" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout?.();
                    }}
                    className="w-full h-8.5 px-2.5 rounded-xl inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('userMenu.logout')}</span>
                  </button>

                  <div className="my-1 border-t border-black/[0.05] dark:border-white/[0.06]" />

                  {currentUser.role === 'admin' ||
                  currentUser.phone?.includes('0984883750') ||
                  currentUser.phone?.includes('0984 883 750') ? (
                    <div className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Lock className="w-3 h-3 text-slate-400" />
                        {/* Tài khoản Quản trị */}
                        <span>{t('userMenu.adminAccount')}</span>
                      </span>
                      {/* Bảo vệ */}
                      <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                        {t('userMenu.protected')}
                      </span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="h-8.5 sm:h-9 px-2.5 sm:px-3.5 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] border border-black/[0.08] hover:border-black/[0.16] shadow-xs cursor-pointer active:scale-[0.98] transition-all shrink-0"
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
              title="Trung tâm thông báo (Apple macOS)"
              aria-label="Mở Trung tâm thông báo"
              className={`relative inline-flex items-center justify-center h-8.5 w-8.5 sm:h-9 sm:w-9 rounded-full text-xs font-semibold border cursor-pointer transition-all shadow-xs active:scale-[0.98] shrink-0 ${
                isNotificationCenterOpen
                  ? 'bg-[#0071e3]/10 dark:bg-[#0071e3]/20 border-[#0071e3]/30 text-[#0071e3]'
                  : 'bg-white dark:bg-slate-800 hover:bg-[#f5f5f7] dark:hover:bg-slate-700 text-[#1d1d1f] dark:text-white border-black/[0.08] dark:border-white/[0.08]'
              }`}
            >
              <Bell className={`w-4 h-4 transition-transform ${isNotificationCenterOpen ? 'rotate-12 text-[#0071e3]' : 'text-slate-700 dark:text-slate-200'}`} />
              {inboxCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs animate-pulse">
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
