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
  const text = size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-2xl' : 'text-xl';
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2.5 select-none cursor-pointer group text-left shrink-0 active:scale-[0.98] transition-transform"
      aria-label={t('logo.s001')}
    >
      <LogoMark className={`${mark} transition-transform duration-200 group-hover:scale-105 shrink-0 shadow-xs`} />
      <div className="flex items-center gap-2">
        <span className={`font-display font-black tracking-tight ${text} text-[#1d1d1f] dark:text-white leading-none`}>
          Car<span className="bg-gradient-to-r from-[#0099ff] to-[#f59e0b] bg-clip-text text-transparent">Mate</span>
        </span>
        {tagline && (
          <span className="hidden 2xl:inline-block text-[11px] font-medium text-[#86868b] whitespace-nowrap border-l border-black/[0.1] pl-2 leading-none">
            {tagline}
          </span>
        )}
      </div>
    </button>
  );
}
