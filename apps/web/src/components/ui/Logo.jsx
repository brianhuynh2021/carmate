import React from 'react';

export function LogoMark({ className = 'w-9 h-9' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cmNavyBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0e1e36" />
          <stop offset="100%" stopColor="#07111e" />
        </linearGradient>
        <linearGradient id="cmCyanLoop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="cmAmberLoop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <filter id="cmCyanGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#06b6d4" floodOpacity="0.45" />
        </filter>
        <filter id="cmAmberGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#f59e0b" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Nền Squircle Midnight Navy chuẩn thương hiệu (#0A192F) */}
      <rect width="100" height="100" rx="26" fill="url(#cmNavyBg)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

      {/* Vòng cung Cyan (Car & Connection) */}
      <path
        d="M 48 30 C 30 30, 20 40, 20 52 C 20 65, 32 75, 48 75 C 58 75, 64 68, 64 60"
        stroke="url(#cmCyanLoop)"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        filter="url(#cmCyanGlow)"
      />

      {/* Vòng cung Amber (Mate & Mutual) đan lồng vô cực */}
      <path
        d="M 52 70 C 70 70, 80 60, 80 48 C 80 35, 68 25, 52 25 C 42 25, 36 32, 36 40"
        stroke="url(#cmAmberLoop)"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        filter="url(#cmAmberGlow)"
      />
    </svg>
  );
}

export default function Logo({ size = 'md', tagline, onClick }) {
  const mark = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  const text = size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-2xl' : 'text-xl';
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2.5 select-none cursor-pointer group text-left shrink-0"
      aria-label="CarMate - Về trang chủ"
    >
      <LogoMark className={`${mark} transition-transform duration-200 group-hover:scale-105 shrink-0 shadow-sm`} />
      <div className="flex items-center gap-2">
        <span className={`font-display font-extrabold tracking-tight ${text} text-slate-900 dark:text-white leading-none`}>
          Car<span className="text-[#0284c7] dark:text-[#38bdf8]">Mate</span>
        </span>
        {tagline && (
          <span className="hidden 2xl:inline-block text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap border-l border-slate-300 dark:border-white/10 pl-2 leading-none">
            {tagline}
          </span>
        )}
      </div>
    </button>
  );
}
