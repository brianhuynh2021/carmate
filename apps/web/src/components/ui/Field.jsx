import React from 'react';

export const inputBase =
  'w-full h-12 px-4 rounded-2xl border text-base sm:text-sm text-slate-900 placeholder:text-slate-400 bg-white border-slate-200/90 hover:border-slate-300 focus:border-primary-600 focus:ring-4 focus:ring-primary-600/15 outline-none transition-all duration-200 dark:bg-[#151c2e] dark:text-slate-100 dark:border-white/[0.08] dark:hover:border-white/[0.16] dark:focus:border-primary-400 dark:placeholder:text-slate-500 shadow-sm';

export function Field({ label, hint, required, optional, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="flex items-baseline justify-between mb-1.5">
          <span className="text-[13.5px] font-semibold text-slate-700 dark:text-slate-300 tracking-tight">
            {label}
            {required && <span className="text-danger-600 ml-0.5">*</span>}
          </span>
          {optional && <span className="text-xs text-slate-400">{optional}</span>}
        </span>
      )}
      {children}
      {hint && <span className="block mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-snug">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={`${inputBase} ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${inputBase} cursor-pointer [color-scheme:light] dark:[color-scheme:dark] ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', rows = 3, ...props }) {
  return <textarea rows={rows} className={`${inputBase} h-auto py-3 resize-y leading-relaxed ${className}`} {...props} />;
}

export function Checkbox({ label, description, className = '', ...props }) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer select-none ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5 w-5 h-5 rounded-lg border-slate-300 dark:border-slate-600 accent-primary-600 cursor-pointer"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm text-slate-800 dark:text-slate-200 leading-snug font-medium">{label}</span>
        {description && <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{description}</span>}
      </span>
    </label>
  );
}

/** Nút lựa chọn dạng thẻ (Google Option Card) */
export function OptionCard({ active, onClick, title, description, icon: Icon, tag, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 cursor-pointer ${
        active
          ? 'border-primary-600/80 bg-primary-50/70 ring-2 ring-primary-500/20 shadow-sm dark:bg-primary-950/40 dark:border-primary-500/80'
          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50 dark:bg-[#151c2e] dark:border-white/[0.08] dark:hover:border-white/[0.16]'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          active ? 'border-primary-600 dark:border-primary-400' : 'border-slate-300 dark:border-slate-600'
        }`}>
          {active && <span className="w-2.5 h-2.5 rounded-full bg-primary-600 dark:bg-primary-400" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
              {Icon && <Icon className={`w-4 h-4 ${active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'}`} />}
              {title}
            </span>
            {tag && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success-50 text-success-700 border border-success-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 shrink-0">
                {tag}
              </span>
            )}
          </div>
          {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{description}</p>}
        </div>
      </div>
    </button>
  );
}
