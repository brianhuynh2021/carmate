import React from 'react';

export function LogoMark({ className = 'w-9 h-9' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cmObsidianBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#131b2e" />
          <stop offset="100%" stopColor="#080c16" />
        </linearGradient>
        <linearGradient id="cmDawnCyan" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="cmWarmAmber" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <filter id="cmSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#38bdf8" floodOpacity="0.4" />
        </filter>
        <filter id="cmWarmGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#f59e0b" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Nền Squircle Obsidian Dark chuẩn Apple / Cursor (#090D16) */}
      <rect width="100" height="100" rx="28" fill="url(#cmObsidianBg)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

      {/* Dải sáng Cyan 4h sáng: Chữ C & Đường cao tốc ban mai */}
      <path
        d="M 46 29 C 28 29, 18 39, 18 51 C 18 64, 30 73, 46 73 C 58 73, 66 66, 66 57 C 66 49, 58 45, 50 45"
        stroke="url(#cmDawnCyan)"
        strokeWidth="7.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#cmSoftGlow)"
      />

      {/* Dải sáng Amber ấm áp: Chữ M & Người bạn đồng hành */}
      <path
        d="M 54 71 C 72 71, 82 61, 82 49 C 82 36, 70 27, 54 27 C 42 27, 34 34, 34 43 C 34 51, 42 55, 50 55"
        stroke="url(#cmWarmAmber)"
        strokeWidth="7.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#cmWarmGlow)"
      />

      {/* Điểm chạm trung tâm: Giao điểm hai người bạn cùng đường */}
      <circle cx="50" cy="50" r="3" fill="#ffffff" />
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
