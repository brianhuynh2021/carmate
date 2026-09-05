import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' };

const ICON_TONES = {
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
  success: 'bg-success-100 text-success-700 dark:bg-success-600/20 dark:text-emerald-300',
  warning: 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-amber-300',
  danger: 'bg-danger-50 text-danger-700 dark:bg-danger-600/20 dark:text-rose-300',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
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
  bodyClassName = ''
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 anim-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div
        className={`w-full ${SIZES[size]} max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-[#0f1422] text-slate-900 dark:text-slate-100 rounded-t-[32px] sm:rounded-[28px] border-t sm:border border-slate-200/80 dark:border-white/[0.08] anim-slide-up sm:anim-scale-in overflow-hidden`}
        style={{ boxShadow: 'var(--shadow-modal)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/[0.08]">
          {Icon && (
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${ICON_TONES[iconTone] || ICON_TONES.primary}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white leading-snug">{title}</h3>
            {subtitle && <div className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 -mr-2 -mt-1 rounded-full inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className={`px-6 py-5 overflow-y-auto overscroll-contain flex-1 ${bodyClassName}`}>{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#151c2e]/70">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
