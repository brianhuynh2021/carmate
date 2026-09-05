import React from 'react';
import { Compass, Sparkles, Plus, Clock, Car } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';

export default function BottomNavBar({ activeTab, setActiveTab, bookedCount = 0, myTripsCount = 0 }) {
  const { t } = useI18n();

  const items = [
    { id: 'market', label: t('nav.mobile.market'), icon: Compass },
    { id: 'match', label: t('nav.mobile.match'), icon: Sparkles },
    { id: 'post', label: t('nav.mobile.post'), icon: Plus, fab: true },
    { id: 'my-trips', label: 'Bài tôi', icon: Car, badge: myTripsCount },
    { id: 'booked', label: t('nav.mobile.booked'), icon: Clock, badge: bookedCount }
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#f8fafc]/95 dark:bg-[#090d16]/95 backdrop-blur-2xl border-t border-slate-200/80 dark:border-white/[0.08] transition-colors shadow-lg"
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
                onClick={() => setActiveTab(item.id)}
                aria-label={t('nav.post')}
                className="flex flex-col items-center justify-center -mt-6 cursor-pointer active:scale-95 transition-transform touch-manipulation"
              >
                <span className={`w-13 h-13 rounded-2xl inline-flex items-center justify-center text-white shadow-md shadow-primary-600/30 border-4 border-[#f8fafc] dark:border-[#090d16] transition-transform ${
                  active ? 'bg-primary-700 scale-105' : 'bg-primary-600 hover:bg-primary-700'
                }`}>
                  <item.icon className="w-6 h-6" strokeWidth={2.4} />
                </span>
                <span className={`text-[11px] font-semibold mt-1 ${active ? 'text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center py-1 cursor-pointer active:scale-95 transition-all touch-manipulation ${
                active ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-500 dark:text-slate-400 font-medium'
              }`}
            >
              <span className={`relative w-14 h-8 rounded-full inline-flex items-center justify-center transition-all duration-200 ${
                active ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400'
              }`}>
                <item.icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                {item.badge > 0 && (
                  <span className="absolute -top-0.5 right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold inline-flex items-center justify-center border-2 border-white dark:border-[#090d16] tabular">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="text-[11px] mt-1 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
