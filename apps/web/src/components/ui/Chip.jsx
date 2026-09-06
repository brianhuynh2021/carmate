import React from 'react';
import { Check } from 'lucide-react';

/** Filter chip theo chuẩn Cursor / Linear micro-interaction */
export default function Chip({ active = false, onClick, icon: Icon, children, showCheck = true, className = '', ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-full text-[12.5px] font-medium whitespace-nowrap select-none cursor-pointer border transition-all duration-150 touch-manipulation active:scale-95 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
        active
          ? 'bg-primary-500/20 text-primary-300 border-primary-500/50 font-bold shadow-sm'
          : 'bg-[#151c2e] text-slate-300 border-white/[0.08] hover:bg-[#1b243b] hover:border-white/[0.18] hover:text-white'
      } ${className}`}
      {...rest}
    >
      {active && showCheck ? <Check className="w-3.5 h-3.5 text-primary-400" strokeWidth={2.5} /> : Icon ? <Icon className="w-3.5 h-3.5 text-slate-400" /> : null}
      <span>{children}</span>
    </button>
  );
}

/** Segmented control (pill capsule phong cách Cursor / Linear - Zero Jitter) */
export function Segmented({ options, value, onChange, fullWidth = false, size = 'md' }) {
  const h = size === 'sm' ? 'h-8 text-[12.5px]' : 'h-9 text-[13px]';
  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-full bg-slate-200/60 dark:bg-[#151c2e] border border-black/5 dark:border-white/[0.08] ${fullWidth ? 'w-full' : ''}`}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`${h} px-3.5 rounded-full font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors duration-150 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 border ${
              fullWidth ? 'flex-1' : ''
            } ${
              active
                ? 'bg-white text-slate-900 shadow-2xs border-black/[0.06] dark:bg-[#1e293b] dark:text-white dark:border-white/10'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-black/[0.03] dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04]'
            }`}
          >
            {Icon && (
              <Icon
                className={`w-3.5 h-3.5 shrink-0 ${
                  active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              />
            )}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
