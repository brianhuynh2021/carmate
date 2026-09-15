import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`surface p-10 sm:p-16 text-center ${className}`}>
      {Icon && (
        <div className="w-16 h-16 rounded-3xl bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20 mx-auto mb-4 flex items-center justify-center shadow-xs">
          <Icon className="w-8 h-8" strokeWidth={1.8} />
        </div>
      )}
      <h4 className="type-heading text-[#1d1d1f]">{title}</h4>
      {description && <p className="type-body text-[#86868b] mt-1.5 max-w-sm mx-auto ">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function SectionHeader({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 flex-wrap ${className}`}>
      <div className="flex items-start gap-3.5 min-w-0">
        {Icon && (
          <span className="w-11 h-11 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20 inline-flex items-center justify-center shrink-0 shadow-xs">
            <Icon className="w-5 h-5" strokeWidth={2.2} />
          </span>
        )}
        <div className="min-w-0 pt-0.5">
          <h2 className="type-title text-[#1d1d1f] ">{title}</h2>
          {description && <p className="type-body text-[#86868b] mt-1  ">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
