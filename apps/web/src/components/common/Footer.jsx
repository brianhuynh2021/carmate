import React from 'react';
import { SITE_INFO } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import { LogoMark } from '../ui/Logo.jsx';
import { ZaloIcon, TelegramIcon } from '../ui/SocialIcons.jsx';
import { LanguageToggle } from './Header.jsx';

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

  const footerLinks = [
    { key: 'market', label: 'Khám phá chuyến' },
    { key: 'post', label: 'Đăng chuyến' },
    { key: 'benchmark', label: 'Bảng giá tuyến' },
    { key: 'terms', label: 'Quy chế & Điều khoản', isTerms: true },
    { key: 'help_zalo', label: 'Hỗ trợ Zalo' },
    { key: 'help_telegram', label: 'Hỗ trợ Telegram' }
  ];

  return (
    <footer className="mt-20 border-t border-black/[0.06] bg-[#f5f5f7] pb-24 md:pb-8 transition-colors">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* ── TẦNG 1: TRẠNG THÁI & LIÊN HỆ TRỰC TIẾP ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-black/[0.06]">
          {/* Brand + Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <LogoMark className="w-6 h-6" />
              <span className="font-display font-black text-sm tracking-tight text-[#1d1d1f]">
                Car<span className="text-[#0071e3]">Mate</span>
              </span>
            </div>
            <span className="text-black/[0.15]">·</span>
            <div className="flex items-center gap-2 text-xs text-[#515154]">
              <span className="w-2 h-2 rounded-full bg-[#107c41] shrink-0" />
              <span className="text-[12px] font-medium text-[#515154]">Tiện chuyến cùng đường · 0đ Phí trung gian</span>
            </div>
          </div>

          {/* Contact Capsule */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Zalo Direct */}
            <a
              href={SITE_INFO.zaloOA}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8.5 px-3.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#0068ff]/50 text-slate-900 dark:text-white text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <ZaloIcon className="w-3.5 h-3.5 text-[#0068ff]" />
              <span>Hỗ Trợ Zalo</span>
            </a>

            {/* Telegram Support */}
            <a
              href={SITE_INFO.telegramSupport || SITE_INFO.telegram || 'https://t.me/brianhuynh91'}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8.5 px-3.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#229ED9]/50 text-slate-900 dark:text-white text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <TelegramIcon className="w-3.5 h-3.5 text-[#229ED9]" />
              <span>Hỗ Trợ Telegram</span>
            </a>

            {/* Facebook Fanpage */}
            <a
              href={SITE_INFO.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8.5 px-3.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-700 text-slate-900 dark:text-white text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2]" />
              <span>Fanpage</span>
            </a>
          </div>
        </div>

        {/* ── TẦNG 2: NAVIGATION TINH GỌN (CHUẨN APPLE) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs pt-1">
          {/* Main Links */}
          <nav className="flex items-center gap-x-6 gap-y-2 flex-wrap">
            {footerLinks.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => {
                  if (l.isTerms) {
                    onOpenTerms?.();
                  } else if (l.key === 'help_zalo') {
                    window.open(SITE_INFO.zaloOA, '_blank', 'noopener,noreferrer');
                  } else if (l.key === 'help_telegram') {
                    window.open(
                      SITE_INFO.telegramSupport || SITE_INFO.telegram || 'https://t.me/brianhuynh91',
                      '_blank',
                      'noopener,noreferrer'
                    );
                  } else {
                    onNavigate?.(l.key);
                  }
                }}
                className="text-[#515154] hover:text-[#0071e3] font-medium transition-colors cursor-pointer"
              >
                {l.label}
              </button>
            ))}
          </nav>

          {/* Đổi ngôn ngữ kín đáo ở góc phải */}
          <div className="flex items-center gap-2 shrink-0">
            <LanguageToggle size="sm" />
          </div>
        </div>

        {/* ── TẦNG 3: LEGAL & COPYRIGHT ── */}
        <div className="pt-2 border-t border-black/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11.5px] text-[#86868b]">
          <p className="leading-relaxed">
            {SITE_INFO.legalName[lang]} · Nền tảng chia sẻ chi phí nhiên liệu tự nguyện, 0% chiết khấu.
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <span>© {year} CarMate.vn</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
