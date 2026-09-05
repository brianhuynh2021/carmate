import React from 'react';

const TONES = {
  neutral: 'bg-slate-100/90 text-slate-700 border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  primary: 'bg-primary-50 text-primary-700 border border-primary-200/70 dark:bg-primary-950/60 dark:text-primary-300 dark:border-primary-900/60',
  success: 'bg-success-50 text-success-700 border border-success-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
  warning: 'bg-warning-50 text-warning-700 border border-warning-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
  danger: 'bg-danger-50 text-danger-700 border border-danger-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60',
  outline: 'bg-transparent text-slate-600 border border-slate-300 dark:text-slate-300 dark:border-slate-700'
};

export default function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-medium whitespace-nowrap tracking-tight ${TONES[tone] || TONES.neutral} ${className}`}>
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />}
      <span>{children}</span>
    </span>
  );
}

/** Avatar chữ cái đầu chuẩn Google Profile Avatar */
export function Avatar({ label = '', tone = 'primary', size = 'md', className = '' }) {
  const dims = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  const tones = {
    primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300',
    warning: 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-amber-300',
    success: 'bg-success-100 text-success-700 dark:bg-success-600/20 dark:text-emerald-300',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
  };
  const initials = label
    .replace(/[^A-Za-zÀ-ỹ0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 select-none shadow-sm ${dims} ${tones[tone] || tones.primary} ${className}`}>
      {initials || '?'}
    </span>
  );
}

/** Icon vuông bo mềm Google Material Tile (dùng cho tiêu đề section) */
export function IconTile({ icon: Icon, tone = 'primary', size = 'md', className = '' }) {
  const dims = size === 'sm' ? 'w-8 h-8 rounded-xl' : size === 'lg' ? 'w-12 h-12 rounded-2xl' : 'w-10 h-10 rounded-2xl';
  const ico = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${dims} ${TONES[tone] || TONES.primary} ${className}`}>
      <Icon className={ico} />
    </span>
  );
}
