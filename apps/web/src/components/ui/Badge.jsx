import React from 'react';

const TONES = {
  neutral: 'bg-black/[0.04] text-[#515154] border border-black/[0.06]',
  primary: 'bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20',
  success: 'bg-[#34c759]/10 text-[#107c41] border border-[#34c759]/20',
  warning: 'bg-[#ff9500]/10 text-[#b25e00] border border-[#ff9500]/20',
  danger: 'bg-[#ff3b30]/10 text-[#d70015] border border-[#ff3b30]/20',
  outline: 'bg-white text-[#515154] border border-black/[0.08]'
};

export default function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full type-badge whitespace-nowrap ${TONES[tone] || TONES.neutral} ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />}
      <span>{children}</span>
    </span>
  );
}

/** Initial-letter avatar following the Apple Profile Avatar standard */
export function Avatar({ label = '', tone = 'primary', size = 'md', className = '' }) {
  const dims = size === 'sm' ? 'w-8 h-8 type-badge' : size === 'lg' ? 'w-12 h-12 type-heading' : 'w-10 h-10 type-body-strong';
  const tones = {
    primary: 'bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20',
    warning: 'bg-[#ff9500]/10 text-[#b25e00]',
    success: 'bg-[#34c759]/10 text-[#107c41]',
    neutral: 'bg-black/[0.05] text-[#515154]'
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
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 select-none shadow-sm ${dims} ${tones[tone] || tones.primary} ${className}`}
    >
      {initials || '?'}
    </span>
  );
}

/** Soft-rounded square icon, Google Material Tile (used for section titles) */
export function IconTile({ icon, tone = 'primary', size = 'md', className = '' }) {
  const Icon = icon;
  const dims = size === 'sm' ? 'w-8 h-8 rounded-xl' : size === 'lg' ? 'w-12 h-12 rounded-2xl' : 'w-10 h-10 rounded-2xl';
  const ico = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${dims} ${TONES[tone] || TONES.primary} ${className}`}
    >
      {Icon ? <Icon className={ico} /> : null}
    </span>
  );
}
