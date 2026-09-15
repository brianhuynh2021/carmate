import React from 'react';
import { Compass, Fuel, Car, Clock, MessageSquare } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';

export default function BottomNavBar({
  activeTab,
  setActiveTab,
  onOpenInbox,
  onOpenQuickPostTrip,
  bookedCount = 0
}) {
  const { t } = useI18n();
  const items = [
    { id: 'market', label: t('nav.tabCorridor'), icon: Compass },
    { id: 'station', label: t('nav.tabStation'), icon: Fuel },
    { id: 'cockpit', label: t('nav.tabPickup'), icon: Car, fab: true },
    { id: 'booked', label: t('nav.tabRides'), icon: Clock, badge: bookedCount },
    { id: 'inbox', label: t('nav.tabInbox'), icon: MessageSquare }
  ];

  const handleTabClick = (itemId) => {
    if (itemId === 'inbox' && onOpenInbox) {
      onOpenInbox();
      return;
    }
    if (itemId === 'cockpit' && onOpenQuickPostTrip) {
      onOpenQuickPostTrip();
      return;
    }
    setActiveTab(itemId);
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#f5f5f7]/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-black/[0.06] dark:border-white/[0.08] transition-colors"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
    >
      <div className="grid grid-cols-5 items-center px-1 pt-2 pb-1">
        {items.map((item) => {
          const active = activeTab === item.id;
          if (item.fab) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabClick(item.id)}
                aria-label={t('bottomNav.s001')}
                className="type-button flex flex-col items-center justify-center -mt-6 cursor-pointer active:scale-95 transition-transform touch-manipulation"
              >
                <span
                  className={`w-13 h-13 rounded-2xl inline-flex items-center justify-center text-slate-950 shadow-[0_4px_20px_rgba(16,185,129,0.35)] border-4 border-[#f5f5f7] dark:border-slate-900 transition-transform ${
                    active ? 'bg-emerald-400 scale-105 ring-2 ring-emerald-400' : 'bg-emerald-500 hover:bg-emerald-400'
                  }`}
                >
                  <item.icon className="w-6 h-6 text-slate-950" strokeWidth={2.4} />
                </span>
                <span className={`type-nav mt-1 ${active ? 'text-emerald-500' : 'text-slate-500'}`}>
                  {item.label}
                </span>
              </button>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`type-button flex flex-col items-center justify-center py-1 cursor-pointer active:scale-95 transition-all touch-manipulation ${
                active ? 'text-[#0071e3]' : 'text-[#86868b]'
              }`}
            >
              <span
                className={`relative w-14 h-8 rounded-full inline-flex items-center justify-center transition-all duration-200 ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-[#0071e3] shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-black/[0.04] dark:border-white/[0.06]'
                    : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                {item.badge > 0 && (
                  <span className="type-badge absolute -top-0.5 right-2 min-w-5 h-5 px-1 rounded-full bg-[#0071e3] text-white inline-flex items-center justify-center border-2 border-white dark:border-slate-800 tabular">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="type-nav mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
