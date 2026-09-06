import React from 'react';

export function LogoMark({ className = 'w-9 h-9' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cmObsidianBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#151d2e" />
          <stop offset="100%" stopColor="#080c16" />
        </linearGradient>
        {/* Dải chuyển màu cao tốc từ 4h sáng (Cyan) sang ấm áp bình minh (Amber) */}
        <linearGradient id="cmTrackGrad" x1="10%" y1="50%" x2="90%" y2="50%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="42%" stopColor="#06b6d4" />
          <stop offset="68%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <filter id="cmNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#06b6d4" floodOpacity="0.4" />
          <feDropShadow dx="0" dy="1" stdDeviation="3.5" floodColor="#f59e0b" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Nền Squircle Obsidian Dark chuẩn Apple / Cursor (#090D16) */}
      <rect width="100" height="100" rx="28" fill="url(#cmObsidianBg)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

      {/* Dải cao tốc CM Monogram liền mạch (Car C -> Mate M) */}
      <path
        d="M 38 35 C 20 35, 13 44, 13 52 C 13 61, 20 69, 38 69 C 45 69, 49 61, 53 48 C 55 41, 58 35, 63 35 C 67 35, 70 42, 73 50 C 76 42, 79 35, 84 35 C 88 35, 90 40, 90 48 L 90 69"
        stroke="url(#cmTrackGrad)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#cmNeonGlow)"
      />

      {/* Lõi laser vệt sáng phản quang trắng (Dấu ấn Cursor precision) */}
      <path
        d="M 38 35 C 20 35, 13 44, 13 52 C 13 61, 20 69, 38 69 C 45 69, 49 61, 53 48 C 55 41, 58 35, 63 35 C 67 35, 70 42, 73 50 C 76 42, 79 35, 84 35 C 88 35, 90 40, 90 48 L 90 69"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.85"
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
