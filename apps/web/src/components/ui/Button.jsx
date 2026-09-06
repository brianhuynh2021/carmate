import React from 'react';

const VARIANTS = {
  primary:
    'bg-[#0071e3] text-white hover:bg-[#0077ed] active:bg-[#0062c4] shadow-xs hover:shadow-sm active:scale-[0.98] disabled:bg-[#0071e3]/40',
  secondary:
    'bg-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/15 active:bg-[#0071e3]/20',
  tonal:
    'bg-black/[0.05] text-[#1d1d1f] hover:bg-black/[0.08] active:bg-black/[0.12]',
  outline:
    'bg-white text-[#1d1d1f] border border-black/[0.08] hover:bg-[#f5f5f7] hover:border-black/[0.16] active:bg-[#ebebee] shadow-xs',
  ghost:
    'text-[#515154] hover:bg-black/[0.04] hover:text-[#1d1d1f] active:bg-black/[0.08]',
  dark:
    'bg-[#1d1d1f] text-white hover:bg-black active:bg-black/90 shadow-xs hover:shadow',
  googlePill:
    'bg-white text-[#1d1d1f] border border-black/[0.08] shadow-xs hover:border-black/[0.16]',
  success:
    'bg-[#107c41] text-white hover:bg-[#0f6e39] active:bg-[#0d5e30] shadow-xs',
  danger:
    'bg-[#e11d48] text-white hover:bg-[#be123c] active:bg-[#9f1239] shadow-xs',
  dangerGhost:
    'text-[#e11d48] hover:bg-rose-50 active:bg-rose-100',
  warningGhost:
    'text-[#b45309] hover:bg-amber-50 active:bg-amber-100'
};

// Chiều cao và bo góc chuẩn Apple Human Interface Guidelines (rounded-xl)
const SIZES = {
  xs: 'h-8 px-3 text-xs gap-1.5 rounded-xl',
  sm: 'h-10 px-4 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl'
};

const ICON_SIZES = { xs: 'w-3.5 h-3.5', sm: 'w-4 h-4', md: 'w-[18px] h-[18px]', lg: 'w-5 h-5' };

export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  className = '',
  children,
  type,
  ...rest
}) {
  const props = Component === 'button' ? { type: type || 'button', ...rest } : rest;
  const hasDisplayOverride = /\b(hidden|block|inline-block|flex|inline-flex|grid)\b/.test(className);
  const displayClass = hasDisplayOverride ? '' : 'inline-flex';
  return (
    <Component
      className={`${displayClass} items-center justify-center font-semibold whitespace-nowrap select-none cursor-pointer transition-all duration-150 active:scale-[0.98] touch-manipulation disabled:cursor-not-allowed disabled:opacity-60 tracking-tight ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {Icon && <Icon className={`${ICON_SIZES[size] || ICON_SIZES.md} shrink-0`} strokeWidth={2.2} />}
      {children && <span className="truncate">{children}</span>}
      {IconRight && <IconRight className={`${ICON_SIZES[size] || ICON_SIZES.md} shrink-0`} strokeWidth={2.2} />}
    </Component>
  );
}

/** Nút tròn chỉ có icon — chuẩn 44px Google Mobile */
export function IconButton({ icon: Icon, label, size = 'md', variant = 'ghost', className = '', ...rest }) {
  const dims = size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-12 h-12' : 'w-11 h-11';
  const ico = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const hasDisplayOverride = /\b(hidden|block|inline-block|flex|inline-flex|grid)\b/.test(className);
  const displayClass = hasDisplayOverride ? '' : 'inline-flex';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${displayClass} items-center justify-center rounded-full cursor-pointer transition-all duration-150 touch-manipulation active:scale-[0.94] ${VARIANTS[variant] || VARIANTS.ghost} ${dims} ${className}`}
      {...rest}
    >
      <Icon className={ico} strokeWidth={2} />
    </button>
  );
}
