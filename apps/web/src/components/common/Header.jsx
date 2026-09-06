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

  const isMac = typeof window !== 'undefined' && typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent || navigator.platform || '');

  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 transition-all duration-200 border-b ${
        isScrolled
          ? 'bg-[#f5f5f7]/96 dark:bg-[#151c28]/96 backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.04)]'
          : 'bg-[#f5f5f7]/92 dark:bg-[#151c28]/92 backdrop-blur-xl border-black/[0.05] dark:border-white/[0.06]'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-[1320px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 md:gap-6">
        <Logo
          size="sm"
          onClick={() => setActiveTab('market')}
          tagline="Ghép xe tiện chuyến"
        />

        {/* Điều hướng phong cách Apple Segmented Capsule Navigation */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-[#e8e8ed] dark:bg-slate-800 border border-black/[0.05] dark:border-white/[0.08] shrink-0 shadow-2xs" aria-label="Primary">
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
                <tab.icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-[#0071e3]' : 'text-[#86868b]'}`} strokeWidth={active ? 2.2 : 2} />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-bold inline-flex items-center justify-center tabular-nums shrink-0 transition-colors ${
                    active ? 'bg-[#0071e3] text-white' : 'bg-black/[0.08] text-[#515154]'
                  }`}>
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
            title={isMac ? "Trợ lý CarMate AI (Phím tắt: ⌘K)" : "Trợ lý CarMate AI (Phím tắt: Ctrl+K)"}
            aria-label="Mở Trợ lý CarMate AI"
            className="inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto px-0 sm:px-3 rounded-full text-xs font-semibold bg-white hover:bg-[#f5f5f7] text-[#1d1d1f] border border-black/[0.08] cursor-pointer select-none outline-none focus:outline-none transition-all shadow-xs active:scale-[0.98] group shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0071e3] group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline font-medium">Trợ lý AI</span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-black/[0.05] text-[#515154] border border-black/[0.06] ml-0.5">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>

          {/* Tài khoản Người dùng / Tài xế */}
          {currentUser ? (
            <div className="flex items-center gap-1 pl-1">
              <button
                type="button"
                onClick={() => setActiveTab('my-trips')}
                title={`Tài xế: ${currentUser.name} (${currentUser.phone})`}
                className="h-9 pl-2 pr-2.5 sm:pr-3 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold bg-white text-[#1d1d1f] border border-black/[0.08] shadow-xs hover:bg-[#f5f5f7] transition-all active:scale-[0.98] shrink-0"
              >
                <span className="relative flex items-center justify-center">
                  <span className="w-5 h-5 rounded-full bg-[#107c41] text-white inline-flex items-center justify-center text-[10px] font-bold">
                    {currentUser.name?.[0]?.toUpperCase() || 'T'}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
                </span>
                <span className="max-w-[70px] sm:max-w-[110px] truncate">{currentUser.name}</span>
              </button>

              {/* Cổng Quản Trị Chỉ Hiển Thị Riêng Cho Admin / Founder */}
              {(currentUser.role === 'admin' || currentUser.phone?.includes('0984883750') || currentUser.phone?.includes('0984 883 750')) && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  title="Cổng Quản Trị Hệ Thống CarMate"
                  className="h-9 px-2.5 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100 transition-colors shadow-xs cursor-pointer select-none outline-none focus:outline-none"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                  <span className="hidden xl:inline">Quản trị</span>
                </button>
              )}

              <button
                type="button"
                onClick={onLogout}
                title="Đăng xuất"
                aria-label="Đăng xuất tài khoản"
                className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[#86868b] hover:text-rose-600 hover:bg-rose-50 cursor-pointer active:scale-90 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="h-9 px-2.5 sm:px-3.5 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] border border-black/[0.08] hover:border-black/[0.16] shadow-xs cursor-pointer active:scale-[0.98] transition-all shrink-0"
            >
              <User className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
              <span className="hidden sm:inline">Đăng nhập / Đăng ký</span>
              <span className="sm:hidden">Đăng nhập</span>
            </button>
          )}

          <div className="hidden lg:block ml-1">
            <Button
              size="sm"
              icon={PlusCircle}
              onClick={() => setActiveTab('post')}
              className="bg-[#0071e3] hover:bg-[#0077ed] text-white rounded-full shadow-xs active:scale-[0.98] transition-all font-bold px-4"
            >
              {t('nav.postCta')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
