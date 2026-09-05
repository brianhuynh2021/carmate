import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`surface p-10 sm:p-16 text-center ${className}`}>
      {Icon && (
        <div className="w-16 h-16 rounded-3xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border border-primary-100/80 dark:border-primary-900/60 mx-auto mb-4 flex items-center justify-center shadow-xs">
          <Icon className="w-8 h-8" strokeWidth={1.8} />
        </div>
      )}
      <h4 className="font-display text-lg font-bold text-slate-900 dark:text-white">{title}</h4>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function SectionHeader({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 flex-wrap ${className}`}>
      <div className="flex items-start gap-3.5 min-w-0">
        {Icon && (
          <span className="w-11 h-11 rounded-2xl bg-primary-100/80 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 inline-flex items-center justify-center shrink-0 shadow-xs">
            <Icon className="w-5 h-5" strokeWidth={2.2} />
          </span>
        )}
        <div className="min-w-0 pt-0.5">
          <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">{title}</h2>
          {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-normal">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
