import React from 'react';
import { Compass, Sparkles, PlusCircle, Clock, ShieldCheck, Sun, Moon, FileText, Globe, Car, User, LogOut, ShieldAlert } from 'lucide-react';
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
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer transition-colors ${dims}`}
    >
      <Globe className="w-[18px] h-[18px]" strokeWidth={2} />
      <span className="uppercase tracking-wide">{lang}</span>
    </button>
  );
}

export default function Header({
  activeTab,
  setActiveTab,
  themeMode,
  setThemeMode,
  setShowPolicyModal,
  bookedCount = 0,
  myTripsCount = 0,
  currentUser = null,
  onOpenAuth,
  onLogout,
  onOpenAi
}) {
  const { t } = useI18n();
  const isLight = themeMode === 'light';

  const tabs = [
    { id: 'market', label: t('nav.market'), icon: Compass },
    { id: 'match', label: t('nav.match'), icon: Sparkles },
    { id: 'my-trips', label: 'Bài của tôi', icon: Car, badge: myTripsCount },
    { id: 'booked', label: t('nav.booked'), icon: Clock, badge: bookedCount }
  ];

  return (
    <header
      className="sticky top-0 z-30 bg-[#f8fafc]/90 dark:bg-[#090d16]/90 backdrop-blur-2xl border-b border-slate-200/80 dark:border-white/[0.08] transition-colors"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 md:gap-6">
        <Logo
          size="sm"
          onClick={() => setActiveTab('market')}
          tagline="Ghép xe tiện chuyến"
        />

        {/* Điều hướng phong cách Cursor / Linear Pill Capsule Navigation */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-slate-200/50 dark:bg-[#151c2e] border border-black/5 dark:border-white/[0.08] shrink-0" aria-label="Primary">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`h-9 px-3.5 xl:px-4 rounded-full inline-flex items-center gap-1.5 xl:gap-2 text-[13px] xl:text-[13.5px] font-semibold whitespace-nowrap cursor-pointer transition-colors duration-150 select-none outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 border ${
                  active
                    ? 'bg-white text-slate-900 dark:bg-[#1e293b] dark:text-white shadow-xs border-black/[0.06] dark:border-white/10'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border-transparent'
                }`}
              >
                <tab.icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-primary-600 dark:text-primary-400' : ''}`} strokeWidth={active ? 2.2 : 2} />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-bold inline-flex items-center justify-center tabular-nums shrink-0 transition-colors ${
                    active ? 'bg-primary-600 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <LanguageToggle />
          <IconButton icon={FileText} label={t('nav.policy')} onClick={() => setShowPolicyModal(true)} className="hidden md:inline-flex" />
          
          {/* Trợ lý CarMate AI Button (Cursor Command Capsule) */}
          <button
            type="button"
            onClick={onOpenAi}
            title="Trợ lý CarMate AI (Phím tắt: ⌘K hoặc Ctrl+K)"
            aria-label="Mở Trợ lý CarMate AI"
            className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full text-xs font-bold bg-primary-500/10 hover:bg-primary-500/20 text-primary-700 dark:text-primary-300 border border-primary-500/30 hover:border-primary-500/60 cursor-pointer select-none outline-none focus:outline-none transition-colors shadow-2xs group"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary-500 group-hover:scale-110 transition-transform animate-pulse" />
            <span className="hidden sm:inline">Trợ lý AI</span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-black/5 dark:bg-white/10 text-slate-500 dark:text-slate-400 border border-black/5 dark:border-white/10 ml-0.5">
              ⌘K
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => setThemeMode(isLight ? 'dark' : 'light')}
            title={isLight ? (t('nav.themeToDark') || 'Bật chế độ tối dịu mắt') : (t('nav.themeToLight') || 'Chuyển giao diện sáng')}
            aria-label={isLight ? 'Bật chế độ tối dịu mắt' : 'Bật giao diện sáng'}
            className={`inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full text-xs font-semibold cursor-pointer select-none outline-none focus:outline-none transition-colors ${
              isLight
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80 shadow-2xs'
                : 'bg-[#151c2e] text-amber-300 hover:bg-[#1e293b] border border-white/[0.08] shadow-2xs'
            }`}
          >
            {isLight ? <Moon className="w-3.5 h-3.5 text-slate-700" strokeWidth={2.4} /> : <Sun className="w-3.5 h-3.5 text-amber-400" strokeWidth={2.4} />}
            <span className="hidden sm:inline">{isLight ? 'Dịu mắt' : 'Sáng'}</span>
          </button>

          {/* Tài khoản Người dùng / Tài xế (Linear / Superhuman Identity Capsule) */}
          {currentUser ? (
            <div className="flex items-center gap-1 pl-1">
              <button
                type="button"
                onClick={() => setActiveTab('my-trips')}
                title={`Tài xế: ${currentUser.name} (${currentUser.phone})`}
                className="h-9 pl-2 pr-3 rounded-full inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30 cursor-pointer select-none outline-none focus:outline-none shadow-2xs hover:bg-emerald-500/20 transition-colors"
              >
                <span className="relative flex items-center justify-center">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px] font-bold">
                    {currentUser.name?.[0]?.toUpperCase() || 'T'}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-[#090d16]" />
                </span>
                <span className="max-w-[80px] sm:max-w-[110px] truncate">{currentUser.name}</span>
              </button>

              {/* Cổng Quản Trị Chỉ Hiển Thị Riêng Cho Admin / Founder */}
              {(currentUser.role === 'admin' || currentUser.phone?.includes('0984883750') || currentUser.phone?.includes('0984 883 750')) && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  title="Cổng Quản Trị Hệ Thống CarMate"
                  className="h-9 px-2.5 rounded-full inline-flex items-center gap-1.5 text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 cursor-pointer select-none outline-none focus:outline-none hover:bg-rose-500/20 transition-colors shadow-2xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                  <span className="hidden xl:inline">Quản trị</span>
                </button>
              )}

              <button
                type="button"
                onClick={onLogout}
                title="Đăng xuất"
                aria-label="Đăng xuất tài khoản"
                className="w-8 h-8 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer active:scale-90 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="h-9 px-3.5 rounded-full inline-flex items-center gap-1.5 text-xs font-bold bg-white dark:bg-[#151c2e] text-slate-700 dark:text-slate-200 hover:text-primary-600 dark:hover:text-white border border-slate-200/90 dark:border-white/[0.08] shadow-2xs cursor-pointer active:scale-95 transition-all"
            >
              <User className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              <span>Đăng nhập / Đăng ký</span>
            </button>
          )}

          <div className="hidden lg:block ml-1">
            <Button size="sm" icon={PlusCircle} onClick={() => setActiveTab('post')} className="shadow-md shadow-primary-600/20 active:scale-95 transition-all font-bold">
              {t('nav.postCta')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
