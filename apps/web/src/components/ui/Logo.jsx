import React from 'react';
import { useI18n } from '../../i18n/index.jsx';

export function LogoMark({ className = 'w-9 h-9' }) {
  return (
    <img
      src="/icons/icon-192.png"
      alt="CarMate"
      className={`${className} object-contain rounded-2xl select-none`}
      draggable={false}
    />
  );
}

export default function Logo({ size = 'md', tagline, onClick }) {
  const { t } = useI18n();
  const mark = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  const text = size === 'lg' ? 'type-page-title' : 'type-title';
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2.5 select-none cursor-pointer group text-left shrink-0 active:scale-[0.98] transition-transform"
      aria-label={t('logo.s001')}
    >
      <LogoMark className={`${mark} transition-transform duration-200 group-hover:scale-105 shrink-0 shadow-xs`} />
      <div className="flex items-center gap-2">
        <span className={`font-display ${text} text-[#1d1d1f] dark:text-white`}>
          Car<span className="bg-gradient-to-r from-[#0099ff] to-[#f59e0b] bg-clip-text text-transparent">Mate</span>
        </span>
        {tagline && (
          <span className="hidden 2xl:inline-block type-caption text-[#86868b] whitespace-nowrap border-l border-black/[0.1] pl-2">
            {tagline}
          </span>
        )}
      </div>
    </button>
  );
}

export function CarMateBadge({ size = 'sm', className = '' }) {
  const mark = size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const text = size === 'xs' ? 'type-badge' : 'type-body-strong';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 dark:bg-white/10 border border-slate-200/80 dark:border-white/15 shadow-2xs select-none shrink-0 ${className}`}
    >
      <LogoMark className={`${mark} rounded-full object-contain shrink-0`} />
      <span className={`font-display ${text} text-[#1d1d1f] dark:text-white`}>
        Car<span className="bg-gradient-to-r from-[#0099ff] to-[#f59e0b] bg-clip-text text-transparent">Mate</span>
      </span>
    </span>
  );
}

