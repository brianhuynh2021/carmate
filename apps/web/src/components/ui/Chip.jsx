import React from 'react';
import { Check } from 'lucide-react';

/** Filter chip following the Cursor / Linear micro-interaction standard */
export default function Chip({
  active = false,
  onClick,
  icon: Icon,
  children,
  showCheck = true,
  className = '',
  ...rest
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-full type-button-sm whitespace-nowrap select-none cursor-pointer border transition-all duration-150 touch-manipulation active:scale-[0.98] outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] ${
        active
          ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-xs'
          : 'bg-white text-[#515154] border-black/[0.08] hover:bg-[#f5f5f7] hover:border-black/[0.16] hover:text-[#1d1d1f] shadow-xs'
      } ${className}`}
      {...rest}
    >
      {active && showCheck ? (
        <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5 text-[#86868b]" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

/** Segmented control (pill capsule in Apple iOS / macOS style) */
export function Segmented({ options, value, onChange, fullWidth = false, size = 'md' }) {
  const h = size === 'sm' ? 'h-8 type-button-sm' : 'h-9 type-button-sm';
  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-full bg-[#e8e8ed]/90 border border-black/[0.04] ${fullWidth ? 'w-full' : ''}`}
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
            className={`${h} px-3.5 rounded-full inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-all duration-150 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/30 ${
              fullWidth ? 'flex-1' : ''
            } ${
              active
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]'
                : 'text-[#515154] hover:text-[#1d1d1f] hover:bg-white/60'
            }`}
          >
            {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#0071e3]' : 'text-[#86868b]'}`} />}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
