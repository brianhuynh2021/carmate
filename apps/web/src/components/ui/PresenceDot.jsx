import React from 'react';

/**
 * PresenceDot — Chấm chỉ báo trạng thái trực tuyến (Live Online / Offline Telemetry)
 * Tuân thủ triệt để nguyên lý Apple HIG & Stanford Ergonomics:
 * - Đèn xanh / Green dot (Đang online): Màu xanh emerald-500 sáng rõ, có sóng xung phát tín hiệu sống (Liveness pulse).
 * - Đèn đỏ / Red dot (Ngoại tuyến): Màu đỏ rose-500/red-500 rõ ràng, dứt khoát, không mập mờ.
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
            : 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/25 dark:border-rose-500/35'
        } ${className}`}
        title={detail || (isOnline ? 'Đang online (Sẵn sàng phản hồi ngay)' : 'Ngoại tuyến')}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
              isOnline ? 'bg-emerald-500' : 'bg-rose-500'
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
      title={detail || (isOnline ? 'Đang online' : 'Ngoại tuyến')}
    >
      {isOnline && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      )}
      <span
        className={`relative inline-flex rounded-full ${dotSize} border-2 border-white dark:border-[#1c1c1e] ${
          isOnline ? 'bg-emerald-500' : 'bg-rose-500'
        }`}
      />
    </span>
  );
}
