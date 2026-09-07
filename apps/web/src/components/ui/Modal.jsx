import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' };

const ICON_TONES = {
  primary: 'bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20',
  success: 'bg-[#34c759]/10 text-[#107c41] border border-[#34c759]/20',
  warning: 'bg-[#ff9500]/10 text-[#b25e00] border border-[#ff9500]/20',
  danger: 'bg-[#ff3b30]/10 text-[#d70015] border border-[#ff3b30]/20',
  neutral: 'bg-black/[0.04] text-[#515154] border border-black/[0.06]',
  brand: 'bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20'
};

export default function Modal({
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconTone = 'primary',
  size = 'md',
  footer,
  children,
  bodyClassName = '',
  zIndex = 'z-50'
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-end sm:items-center justify-center bg-black/25 backdrop-blur-md p-0 sm:p-4 anim-fade-in`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div
        className={`w-full ${SIZES[size]} max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-white text-[#1d1d1f] rounded-t-[32px] sm:rounded-3xl border-t sm:border border-black/[0.08] anim-slide-up sm:anim-scale-in overflow-hidden shadow-[0_20px_48px_-12px_rgba(0,0,0,0.18)]`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-black/[0.06]">
          {Icon && (
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${ICON_TONES[iconTone] || ICON_TONES.primary}`}
            >
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-display text-lg font-bold text-[#1d1d1f] leading-snug">{title}</h3>
            {subtitle && <div className="text-[13px] text-[#86868b] mt-0.5 leading-snug">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 -mr-1 -mt-1 rounded-full inline-flex items-center justify-center text-[#86868b] hover:bg-black/[0.05] hover:text-[#1d1d1f] cursor-pointer transition-colors active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className={`px-6 py-5 overflow-y-auto overscroll-contain flex-1 ${bodyClassName}`}>{children}</div>

        {/* Footer */}
        {footer && <div className="px-6 py-4 border-t border-black/[0.06] bg-[#f5f5f7]">{footer}</div>}
      </div>
    </div>
  );
}
