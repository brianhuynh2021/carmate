import React from 'react';
import { Compass, Sparkles, Plus, Clock, Car } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';

export default function BottomNavBar({ activeTab, setActiveTab, bookedCount = 0, myTripsCount = 0 }) {
  const { t } = useI18n();

  const items = [
    { id: 'market', label: t('nav.mobile.market'), icon: Compass },
    { id: 'match', label: t('nav.mobile.match'), icon: Sparkles },
    { id: 'post', label: t('nav.mobile.post'), icon: Plus, fab: true },
    { id: 'my-trips', label: t('nav.mobile.myTrips') || 'Chuyến tôi', icon: Car, badge: myTripsCount },
    { id: 'booked', label: t('nav.mobile.booked'), icon: Clock, badge: bookedCount }
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#f5f5f7]/90 backdrop-blur-2xl border-t border-black/[0.06] transition-colors"
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
                <span className={`w-13 h-13 rounded-2xl inline-flex items-center justify-center text-white shadow-[0_4px_16px_rgba(0,113,227,0.3)] border-4 border-[#f5f5f7] transition-transform ${
                  active ? 'bg-[#0062c4] scale-105' : 'bg-[#0071e3] hover:bg-[#0077ed]'
                }`}>
                  <item.icon className="w-6 h-6" strokeWidth={2.4} />
                </span>
                <span className={`text-[11px] font-semibold mt-1 ${active ? 'text-[#0071e3]' : 'text-[#86868b]'}`}>
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
                active ? 'text-[#0071e3] font-bold' : 'text-[#86868b] font-medium'
              }`}
            >
              <span className={`relative w-14 h-8 rounded-full inline-flex items-center justify-center transition-all duration-200 ${
                active ? 'bg-white text-[#0071e3] shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-black/[0.04]' : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}>
                <item.icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                {item.badge > 0 && (
                  <span className="absolute -top-0.5 right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-[#0071e3] text-white text-[10px] font-mono font-bold inline-flex items-center justify-center border-2 border-white tabular">
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
