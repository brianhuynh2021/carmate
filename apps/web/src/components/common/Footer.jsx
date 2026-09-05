import React from 'react';
import { Phone, Mail, MapPin, ExternalLink, Activity, Terminal } from 'lucide-react';
import { SITE_INFO } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import { LogoMark } from '../ui/Logo.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';

function FacebookIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

export default function Footer({ onNavigate, onOpenTerms }) {
  const { t, lang } = useI18n();
  const year = new Date().getFullYear();

  const primaryLinks = [
    { key: 'market', label: 'Tìm chuyến' },
    { key: 'match', label: 'Ghép tiện tuyến' },
    { key: 'post', label: 'Đăng chuyến' },
    { key: 'benchmark', label: 'Bảng giá tuyến' },
    { key: 'trust', label: 'Hộ chiếu tín nhiệm' }
  ];

  const secondaryLinks = [
    { key: 'policy', label: 'Quy chế cộng đồng' },
    { key: 'terms', label: 'Điều khoản' },
    { key: 'privacy', label: 'Bảo mật' },
    { key: 'dispute', label: 'Xử lý khiếu nại' },
    { key: 'help', label: 'Hỗ trợ' }
  ];

  return (
    <footer className="mt-20 border-t border-slate-200/80 dark:border-white/[0.08] bg-white/60 dark:bg-[#090d16]/90 backdrop-blur-md pb-24 md:pb-8 transition-colors">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        
        {/* ── TẦNG 1: TRẠNG THÁI & LIÊN HỆ TRỰC TIẾP ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-white/5">
          {/* Brand + Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <LogoMark className="w-6 h-6" />
              <span className="font-display font-bold text-sm tracking-tight text-slate-900 dark:text-white">
                Car<span className="text-primary-600 dark:text-primary-400">Mate</span>
              </span>
            </div>
            <span className="text-slate-300 dark:text-white/20">·</span>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
                Tiện chuyến cùng đường · 0đ Phí trung gian
              </span>
            </div>
          </div>

          {/* Contact Capsule (Monochrome Obsidian / Glassmorphism) */}
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`tel:${SITE_INFO.phoneRaw || '0984883750'}`}
              className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-mono font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>{SITE_INFO.hotline}</span>
              <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">({SITE_INFO.contactPerson})</span>
            </a>

            <a
              href={SITE_INFO.zaloOA}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <ZaloIcon className="w-3.5 h-3.5 text-blue-500" />
              <span>Zalo Trực Tiếp</span>
            </a>

            <a
              href={SITE_INFO.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2]" />
              <span>Fanpage Facebook</span>
            </a>
          </div>
        </div>

        {/* ── TẦNG 2: INLINE NAVIGATION & SHORTCUT CUES ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          {/* Main Links */}
          <nav className="flex items-center gap-x-3 gap-y-1.5 flex-wrap">
            {primaryLinks.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => onNavigate?.(l.key)}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors cursor-pointer"
              >
                {l.label}
              </button>
            ))}
            <span className="text-slate-300 dark:text-white/20 hidden sm:inline">|</span>
            {secondaryLinks.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => {
                  if (['terms', 'policy', 'privacy', 'dispute'].includes(l.key)) {
                    onOpenTerms?.();
                  } else {
                    onNavigate?.(l.key);
                  }
                }}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                {l.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── TẦNG 3: LEGAL & COPYRIGHT ── */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <p className="leading-relaxed">
            {SITE_INFO.legalName[lang]} · Nền tảng chia sẻ chi phí nhiên liệu tự nguyện, 0% chiết khấu.
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <span>© {year} CarMate.vn</span>
            <a
              href={SITE_INFO.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook CarMate"
              className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <FacebookIcon />
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
