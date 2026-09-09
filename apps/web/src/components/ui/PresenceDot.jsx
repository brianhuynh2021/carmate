import React from 'react';

/**
 * PresenceDot — Chấm chỉ báo trạng thái trực tuyến (Live Online / Offline Telemetry)
 * Tuân thủ triệt để nguyên lý Apple HIG & Stanford Ergonomics:
 * - Đèn xanh / Green dot (Đang online): Màu xanh emerald-500 rực rỡ, có sóng phát xung nhấp nháy tỏa ra (Liveness broadcast pulse).
 * - Đèn đỏ / Red dot (Ngoại tuyến): Màu đỏ sẫm rose-700/rose-600 (hoặc rose-500), chìm xuống, hoàn toàn đứng im không hiệu ứng.
 */
export default function PresenceDot({
  isOnline = false,
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg'
  showLabel = false,
  compact = true,
  className = '',
  detail = '',
  label = null
}) {
  const sizeMap = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5'
  };

  const dotSize = sizeMap[size] || sizeMap.md;

  const defaultFullLabel = isOnline ? 'Đang online' : 'Ngoại tuyến';
  const defaultCompactLabel = isOnline ? 'Online' : 'Offline';
  const displayLabel = label || (compact ? defaultCompactLabel : defaultFullLabel);

  if (showLabel) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-tight leading-none whitespace-nowrap shrink-0 transition-all select-none border shadow-2xs ${
          isOnline
            ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 dark:border-emerald-500/35'
            : 'bg-slate-100/90 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 border-slate-200/90 dark:border-white/[0.08]'
        } ${className}`}
        title={detail || (isOnline ? 'Đang online (Sẵn sàng phản hồi ngay)' : 'Ngoại tuyến')}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
              isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-rose-700 dark:bg-rose-600'
            }`}
          />
        </span>
        <span className="leading-none">{displayLabel}</span>
      </span>
    );
  }

  return (
    <span
      className={`relative inline-flex shrink-0 ${dotSize} ${className}`}
      title={detail || (isOnline ? 'Đang online (Sẵn sàng phản hồi ngay)' : 'Ngoại tuyến')}
    >
      {isOnline && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      )}
      <span
        className={`relative inline-flex rounded-full ${dotSize} border-2 border-white dark:border-[#1c1c1e] ${
          isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-rose-700 dark:bg-rose-600'
        }`}
      />
    </span>
  );
}
