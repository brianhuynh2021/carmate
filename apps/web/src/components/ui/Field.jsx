import React from 'react';

export const inputBase =
  'w-full h-11 px-3.5 rounded-xl border type-input text-[#1d1d1f] placeholder:text-[#86868b] bg-[#f5f5f7] hover:bg-[#ebebee] focus:bg-white border-black/[0.08] focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 outline-none transition-all duration-150 shadow-2xs';

export function Field({ label, hint, required, optional, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="flex items-baseline justify-between mb-1.5">
          <span className="type-label text-[#1d1d1f]">
            {label}
            {required && <span className="text-[#ff3b30] ml-0.5">*</span>}
          </span>
          {optional && <span className="type-caption text-[#86868b]">{optional}</span>}
        </span>
      )}
      {children}
      {hint && <span className="block mt-1.5 type-caption text-[#86868b] ">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={`${inputBase} ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${inputBase} cursor-pointer [color-scheme:light] ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', rows = 3, ...props }) {
  return (
    <textarea rows={rows} className={`${inputBase} h-auto py-3 resize-y  ${className}`} {...props} />
  );
}

export function Checkbox({ label, description, className = '', ...props }) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer select-none ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5 w-4.5 h-4.5 rounded-md border-black/[0.16] text-[#0071e3] accent-[#0071e3] cursor-pointer"
        {...props}
      />
      <span className="min-w-0">
        <span className="block type-label text-[#1d1d1f]">{label}</span>
        {description && <span className="block type-caption text-[#86868b] mt-0.5 ">{description}</span>}
      </span>
    </label>
  );
}

/** Nút lựa chọn dạng thẻ (Apple Option Card) */
export function OptionCard({ active, onClick, title, description, icon: Icon, tag, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 cursor-pointer ${
        active
          ? 'border-[#0071e3] bg-[#0071e3]/[0.04] ring-2 ring-[#0071e3]/20 shadow-xs'
          : 'border-black/[0.08] bg-white hover:border-black/[0.16] hover:bg-[#f5f5f7]'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            active ? 'border-[#0071e3] bg-[#0071e3]' : 'border-black/[0.2] bg-white'
          }`}
        >
          {active && <span className="w-2 h-2 rounded-full bg-white" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon className={`w-4 h-4 ${active ? 'text-[#0071e3]' : 'text-[#86868b]'}`} />}
            <span className={`type-body-strong ${active ? 'text-[#1d1d1f]' : 'text-[#515154]'}`}>{title}</span>
            {tag && (
              <span className="ml-auto type-badge px-2 py-0.5 rounded-full bg-black/[0.05] text-[#515154]">
                {tag}
              </span>
            )}
          </div>
          {description && <p className="type-caption text-[#86868b] mt-1 ">{description}</p>}
        </div>
      </div>
    </button>
  );
}
