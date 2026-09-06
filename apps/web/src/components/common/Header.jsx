import React from 'react';
import { Compass, Sparkles, PlusCircle, Clock, ShieldCheck, FileText, Globe, Car, User, LogOut } from 'lucide-react';
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
  setShowPolicyModal,
  bookedCount = 0,
  myTripsCount = 0,
  currentUser = null,
  onOpenAuth,
  onLogout,
  onOpenAi
}) {
  const { t } = useI18n();

  const tabs = [
    { id: 'market', label: t('nav.market'), icon: Compass },
    { id: 'match', label: t('nav.match'), icon: Sparkles },
    { id: 'my-trips', label: t('nav.myTrips'), icon: Car, badge: myTripsCount },
    { id: 'booked', label: t('nav.booked'), icon: Clock, badge: bookedCount }
  ];

  return (
    <header
      className="sticky top-0 z-30 bg-[#090d16]/90 backdrop-blur-2xl border-b border-white/[0.08] transition-colors"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 md:gap-6">
        <Logo
          size="sm"
          onClick={() => setActiveTab('market')}
          tagline="Ghép xe tiện chuyến"
        />

        {/* Điều hướng phong cách Cursor / Linear Pill Capsule Navigation */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-[#151c2e] border border-white/[0.08] shrink-0" aria-label="Primary">
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
                    ? 'bg-[#1e293b] text-white shadow-xs border-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
                }`}
              >
                <tab.icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-primary-400' : ''}`} strokeWidth={active ? 2.2 : 2} />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-bold inline-flex items-center justify-center tabular-nums shrink-0 transition-colors ${
                    active ? 'bg-primary-500 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <LanguageToggle size="sm" />
          <IconButton icon={FileText} label={t('nav.policy')} onClick={() => setShowPolicyModal(true)} className="hidden md:inline-flex text-slate-400 hover:text-white hover:bg-white/5" />
          
          {/* Trợ lý CarMate AI Button (Cursor Command Capsule) */}
          <button
            type="button"
            onClick={onOpenAi}
            title="Trợ lý CarMate AI (Phím tắt: ⌘K hoặc Ctrl+K)"
            aria-label="Mở Trợ lý CarMate AI"
            className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full text-xs font-bold bg-primary-500/10 hover:bg-primary-500/20 text-primary-300 border border-primary-500/30 hover:border-primary-500/60 cursor-pointer select-none outline-none focus:outline-none transition-colors shadow-2xs group"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary-400 group-hover:scale-110 transition-transform animate-pulse" />
            <span className="hidden sm:inline">Trợ lý AI</span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-white/10 text-slate-400 border border-white/10 ml-0.5">
              ⌘K
            </kbd>
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
              className="h-9 px-3.5 rounded-full inline-flex items-center gap-1.5 text-xs font-bold bg-[#151c2e] text-slate-200 hover:text-white border border-white/[0.08] hover:border-white/[0.18] shadow-2xs cursor-pointer active:scale-95 transition-all"
            >
              <User className="w-3.5 h-3.5 text-primary-400" />
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
