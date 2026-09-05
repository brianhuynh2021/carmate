import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function Toast({ message }) {
  if (!message) return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[60] anim-slide-up" role="status" aria-live="polite">
      <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3.5 rounded-xl shadow-2xl flex items-start gap-3 text-sm">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 dark:text-emerald-600 shrink-0 mt-px" />
        <span className="leading-snug">{message}</span>
      </div>
    </div>
  );
}
