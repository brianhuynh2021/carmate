import React from 'react';

const VARIANTS = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm hover:shadow-md hover:shadow-primary-600/25 disabled:bg-primary-300 dark:disabled:bg-primary-900',
  secondary:
    'bg-primary-100/80 text-primary-800 hover:bg-primary-100 active:bg-primary-200 dark:bg-primary-900/40 dark:text-primary-200 dark:hover:bg-primary-900/70',
  tonal:
    'bg-primary-100/80 text-primary-800 hover:bg-primary-100 active:bg-primary-200 dark:bg-primary-900/40 dark:text-primary-200 dark:hover:bg-primary-900/70',
  outline:
    'bg-white text-slate-700 border border-slate-300/90 hover:bg-slate-50/80 hover:border-primary-400 hover:text-primary-700 active:bg-primary-50 dark:bg-[#151c2e] dark:text-slate-200 dark:border-white/[0.08] dark:hover:bg-[#1b243b] dark:hover:border-primary-500',
  ghost:
    'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white',
  dark:
    'bg-slate-900 text-white hover:bg-slate-800 active:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm hover:shadow',
  googlePill:
    'bg-white dark:bg-[#151c2e] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/[0.08] shadow-sm hover:shadow-md hover:border-primary-300',
  success:
    'bg-success-600 text-white hover:bg-success-700 active:bg-success-800 shadow-sm hover:shadow-md hover:shadow-success-600/20',
  danger:
    'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 shadow-sm hover:shadow-md hover:shadow-danger-600/20',
  dangerGhost:
    'text-danger-600 hover:bg-danger-50 active:bg-danger-100 dark:hover:bg-danger-600/10',
  warningGhost:
    'text-warning-700 hover:bg-warning-50 active:bg-warning-100 dark:text-warning-500 dark:hover:bg-warning-500/10'
};

// Chiều cao tối thiểu 40–48px cho vùng chạm chuẩn Google Mobile Accessibility
const SIZES = {
  xs: 'h-8 px-3 text-xs gap-1.5 rounded-full',
  sm: 'h-10 px-4 text-sm gap-1.5 rounded-full',
  md: 'h-11 px-5 text-sm gap-2 rounded-full',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-full'
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
