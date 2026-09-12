import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';

export default function Toast({ message }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!message) return null;

  const toastNode = (
    <div
      className="fixed bottom-24 md:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[10000] anim-slide-up pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="bg-slate-900/95 dark:bg-white/95 backdrop-blur-md text-white dark:text-slate-900 px-4 py-3.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-start gap-3 text-sm pointer-events-auto border border-white/10 dark:border-black/10">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 dark:text-emerald-600 shrink-0 mt-px" />
        <span className="leading-snug font-medium">{message}</span>
      </div>
    </div>
  );

  if (mounted && typeof document !== 'undefined') {
    return createPortal(toastNode, document.body);
  }

  return toastNode;
}
