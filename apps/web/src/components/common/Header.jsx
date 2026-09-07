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
  MessageCircle
} from 'lucide-react';
import { SITE_INFO } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Logo from '../ui/Logo.jsx';
import Button, { IconButton } from '../ui/Button.jsx';

export function LanguageToggle({ size = 'md' }) {
  const { lang, setLang } = useI18n();
  const next = lang === 'vi' ? 'en' : 'vi';
  const dims = size === 'sm' ? 'h-9 px-2.5 text-xs' : 'h-11 px-3 text-[13px]';
  const label = lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt';

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer transition-colors ${dims}`}
    >
      <Globe className="w-4 h-4" strokeWidth={2} />
      <span className="uppercase tracking-wide font-mono text-xs">{lang}</span>
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
  currentUser = null,
  onOpenAuth,
  onLogout,
  onOpenAi,
  onOpenProfile,
  onOpenDeleteAccount
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
  const userMenuRef = useRef(null);
  const postMenuRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Đóng menu người dùng & menu đăng chuyến khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
      if (postMenuRef.current && !postMenuRef.current.contains(e.target)) {
        setIsPostMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-200 border-b backdrop-blur-xl ${
        isScrolled
          ? 'bg-white/90 dark:bg-[#151c28]/90 border-black/[0.08] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.06)]'
          : 'bg-white/80 dark:bg-[#151c28]/80 border-black/[0.05] dark:border-white/[0.06]'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-[1320px] mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 md:gap-6">
        <Logo size="sm" onClick={() => setActiveTab('market')} tagline="Ghép xe tiện chuyến" />

        {/* Điều hướng phong cách Apple Segmented Capsule Navigation */}
        <nav
          className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-[#e8e8ed]/80 dark:bg-slate-800/80 backdrop-blur-md border border-black/[0.05] dark:border-white/[0.08] shrink-0 shadow-2xs"
          aria-label="Primary"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`h-9 px-4 rounded-full inline-flex items-center gap-2 text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-all duration-150 select-none outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40 ${
                  active
                    ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]'
                    : 'text-[#515154] hover:text-[#1d1d1f] hover:bg-white/60'
                }`}
              >
                <tab.icon
                  className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-[#0071e3]' : 'text-[#86868b]'}`}
                  strokeWidth={active ? 2.2 : 2}
                />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.badge > 0 && (
                  <span
                    className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-bold inline-flex items-center justify-center tabular-nums shrink-0 transition-colors ${
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
          {/* Trợ lý CarMate AI Button (Apple Command Capsule) */}
          <button
            type="button"
            onClick={onOpenAi}
            title={isMac ? 'Trợ lý CarMate AI (Phím tắt: ⌘K)' : 'Trợ lý CarMate AI (Phím tắt: Ctrl+K)'}
            aria-label="Mở Trợ lý CarMate AI"
            className="inline-flex items-center justify-center gap-1.5 h-8.5 w-8.5 sm:h-9 sm:w-auto px-0 sm:px-3 rounded-full text-xs font-semibold bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-black/[0.08] cursor-pointer select-none outline-none focus:outline-none transition-all shadow-xs active:scale-[0.98] group shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0071e3] group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline font-medium">Trợ lý AI</span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-black/[0.05] text-[#515154] border border-black/[0.06] ml-0.5">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>

          {/* Tài khoản Người dùng / Quản trị viên (Apple Profile Capsule & Dropdown) */}
          {currentUser ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
                title={`Tài khoản: ${currentUser.name} (${currentUser.phone || ''})`}
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
                    <span className="w-5 h-5 rounded-full bg-[#107c41] text-white inline-flex items-center justify-center text-[10px] font-bold">
                      {currentUser.name?.[0]?.toUpperCase() || 'T'}
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
                      <span className="w-9 h-9 rounded-full bg-[#107c41] text-white inline-flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                        {currentUser.name?.[0]?.toUpperCase() || 'T'}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1d1d1f] dark:text-white truncate">{currentUser.name}</p>
                      <p className="text-[11px] text-[#86868b] font-mono truncate">
                        {currentUser.phone || 'Đã xác thực danh tính'}
                      </p>
                      {(currentUser.role === 'admin' ||
                        currentUser.phone?.includes('0984883750') ||
                        currentUser.phone?.includes('0984 883 750')) && (
                        <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40">
                          <ShieldCheck className="w-3 h-3" /> Quản trị viên
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mục 0: Hồ sơ & Garage của tôi */}
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
                      <span>Hồ sơ & Garage của tôi</span>
                    </div>
                    {currentUser?.vehicle?.brand ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                        {currentUser.vehicle.brand}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#86868b] font-normal">Chưa có xe</span>
                    )}
                  </button>

                  {/* Mục 1: Chuyến xe của tôi */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('my-trips');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full h-8.5 px-2.5 rounded-xl inline-flex items-center gap-2 text-xs font-medium text-[#1d1d1f] dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <Car className="w-3.5 h-3.5 text-[#0071e3]" />
                    <span>Chuyến xe của tôi</span>
                  </button>

                  {/* Mục 2: Cổng Quản Trị Hệ Thống (CHỈ HIỂN THỊ NẾU LÀ ADMIN) */}
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
                      <span>Cổng Quản Trị Hệ Thống</span>
                    </button>
                  )}

                  {/* Mục 3: Chính sách & An toàn */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowPolicyModal?.(true);
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full h-8.5 px-2.5 rounded-xl inline-flex items-center gap-2 text-xs font-medium text-[#515154] dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span>Quy chế an toàn 100%</span>
                  </button>

                  {/* Mục 4: Ngôn ngữ hiển thị (Apple Segmented Capsule) */}
                  <div className="w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs text-[#1d1d1f] dark:text-slate-200">
                    <div className="inline-flex items-center gap-2 font-medium">
                      <Globe className="w-3.5 h-3.5 text-[#0071e3]" />
                      <span>Ngôn ngữ</span>
                    </div>
                    <div className="inline-flex items-center p-0.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => setLang('vi')}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          lang === 'vi'
                            ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-xs'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                      >
                        VI
                      </button>
                      <button
                        type="button"
                        onClick={() => setLang('en')}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          lang === 'en'
                            ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-xs'
                            : 'text-[#86868b] hover:text-[#1d1d1f]'
                        }`}
                      >
                        EN
                      </button>
                    </div>
                  </div>

                  {/* Mục 5: Hỗ trợ bạn (Zalo OA chính chủ) */}
                  <a
                    href={SITE_INFO.zaloOA}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full h-8.5 px-2.5 rounded-xl inline-flex items-center justify-between text-xs font-medium text-[#1d1d1f] dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <div className="inline-flex items-center gap-2">
                      <MessageCircle className="w-3.5 h-3.5 text-[#0068ff]" />
                      <span>Hỗ trợ bạn</span>
                    </div>
                    <span className="text-[10.5px] font-bold text-[#0068ff] bg-[#0068ff]/10 px-1.5 py-0.5 rounded">
                      Zalo OA
                    </span>
                  </a>

                  <div className="my-1 border-t border-black/[0.05] dark:border-white/[0.06]" />

                  {/* Mục 6: Đăng xuất */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout?.();
                    }}
                    className="w-full h-8.5 px-2.5 rounded-xl inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-slate-400" />
                    <span>Đăng xuất</span>
                  </button>

                  <div className="my-1 border-t border-black/[0.05] dark:border-white/[0.06]" />

                  {/* Mục 5: Xóa tài khoản vĩnh viễn (Chỉ hiển thị cho người dùng thường - MIT Invariant: Admin không thể tự xoá) */}
                  {currentUser.role === 'admin' ||
                  currentUser.phone?.includes('0984883750') ||
                  currentUser.phone?.includes('0984 883 750') ? (
                    <div className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Tài khoản Quản trị</span>
                      </span>
                      <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                        Bảo vệ
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenDeleteAccount?.();
                      }}
                      className="w-full h-8.5 px-2.5 rounded-xl inline-flex items-center gap-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Xóa tài khoản vĩnh viễn</span>
                    </button>
                  )}
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
              <span className="hidden sm:inline">Đăng nhập / Đăng ký</span>
              <span className="sm:hidden">Đăng nhập</span>
            </button>
          )}

          {/* Cụm nút Hành Động Chính (Apple Single Primary Action) - Ẩn trên Mobile vì BottomNavBar đã có FAB Đăng chuyến trung tâm */}
          <div className="hidden sm:block relative ml-1" ref={postMenuRef}>
            <button
              type="button"
              onClick={() => setIsPostMenuOpen((prev) => !prev)}
              aria-expanded={isPostMenuOpen}
              aria-haspopup="true"
              className="h-9 pl-3.5 pr-3 rounded-full inline-flex items-center gap-1.5 text-xs font-bold bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] text-white shadow-[0_2px_8px_rgba(0,113,227,0.28)] hover:shadow-[0_4px_16px_rgba(0,113,227,0.38)] active:scale-[0.98] transition-all cursor-pointer select-none shrink-0 group"
            >
              <PlusCircle className="w-3.5 h-3.5 text-white/90 group-hover:rotate-90 transition-transform duration-200" strokeWidth={2.4} />
              <span>Đăng chuyến</span>
              <ChevronDown
                className={`w-3 h-3 text-white/80 transition-transform duration-200 ${isPostMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Apple Action Sheet Popover: Phân nhánh 2 vai trò 1-chạm rõ ràng, tải nhận thức = 0 */}
            {isPostMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-72 rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_16px_40px_rgba(0,0,0,0.16)] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-left">
                <div className="px-2.5 py-1 mb-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#86868b]">Bạn muốn đăng nhu cầu nào?</p>
                </div>

                {/* Lựa chọn 1: Chủ xe có xe trống */}
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
                        Đăng xe trống
                      </span>
                      <span className="text-[10px] font-semibold text-[#0071e3] bg-[#0071e3]/10 px-1.5 py-0.5 rounded-full">Chủ xe</span>
                    </div>
                    <p className="text-[11px] text-[#515154] dark:text-slate-400 mt-0.5 leading-snug">
                      Xe gia đình còn ghế trống, san sẻ bớt tiền xăng & cầu đường
                    </p>
                  </div>
                </button>

                {/* Lựa chọn 2: Người tìm xe (Khách đi cùng) */}
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
                        Cần tìm xe
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Người tìm xe</span>
                    </div>
                    <p className="text-[11px] text-[#515154] dark:text-slate-400 mt-0.5 leading-snug">
                      Báo lộ trình, tìm chủ xe cùng chuyến đón trả tận nơi
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
