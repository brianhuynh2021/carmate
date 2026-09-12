import React from 'react';
import { MessageCircle } from 'lucide-react';
import { SITE_INFO } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import { LogoMark } from '../ui/Logo.jsx';
import { TelegramIcon } from '../ui/SocialIcons.jsx';
import { LanguageToggle } from './Header.jsx';

function FacebookIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

export default function Footer({ onNavigate, onOpenTerms, onOpenPolicy }) {
  const { lang } = useI18n();
  const year = new Date().getFullYear();

  const footerLinks = [
    {
      key: 'terms',
      label: lang === 'en' ? 'Terms & Regulations' : 'Quy chế & Điều khoản',
      action: onOpenTerms
    },
    {
      key: 'policy',
      label: lang === 'en' ? 'Safety Policy' : 'Chính sách an toàn',
      action: onOpenPolicy
    },
    {
      key: 'benchmark',
      label: lang === 'en' ? 'Fuel & Toll Benchmark' : 'Bảng định mức xăng & cầu đường',
      action: () => onNavigate?.('benchmark')
    }
  ];

  return (
    <>
      {/* ── MOBILE NATIVE SUPPORT CARD (md:hidden) ── */}
      {/* Thiết kế công thái học Stanford & Liquid Apple: Gọn nhẹ, tải nhận thức = 0, danh xưng 'Hỗ trợ bạn' chuẩn mực cộng đồng */}
      <section className="md:hidden mt-8 px-4 pb-28 pt-2">
        <div className="rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.08] p-5 shadow-xs text-center space-y-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-xs font-semibold">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{lang === 'en' ? 'Support' : 'Hỗ trợ bạn'}</span>
            </div>
            <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-white tracking-tight">
              {lang === 'en' ? 'Need help with your trip?' : 'Bạn cần hỗ trợ về chuyến đi?'}
            </h3>
            <p className="text-xs text-[#86868b] leading-relaxed max-w-xs mx-auto">
              {lang === 'en'
                ? 'CarMate is always ready to assist drivers and passengers directly.'
                : 'CarMate luôn sẵn sàng đồng hành cùng bạn và chủ xe qua kênh trao đổi trực tiếp.'}
            </p>
          </div>

          {/* Nút hỗ trợ trực tiếp 1-chạm (Telegram) */}
          <div className="pt-1">
            <a
              href={SITE_INFO.telegramSupport || SITE_INFO.telegram || 'https://t.me/brianhuynh91'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-11 px-3 rounded-2xl bg-[#229ED9]/10 hover:bg-[#229ED9]/15 active:scale-[0.98] border border-[#229ED9]/20 text-[#229ED9] text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <TelegramIcon className="w-4 h-4" />
              <span>{lang === 'en' ? 'Telegram Support' : 'Hỗ trợ Telegram'}</span>
            </a>
          </div>

          {/* Quy chế, Chính sách, Ngôn ngữ & Bản quyền */}
          <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[11px] text-[#86868b] flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenTerms}
                className="relative tap-area-44 hover:text-[#0071e3] transition-colors cursor-pointer"
              >
                {lang === 'en' ? 'Terms & Policies' : 'Quy chế & Điều khoản'}
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={onOpenPolicy}
                className="relative tap-area-44 hover:text-[#0071e3] transition-colors cursor-pointer"
              >
                {lang === 'en' ? 'Safety Policy' : 'Chính sách an toàn'}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span>© CarMate</span>
              <span>·</span>
              <LanguageToggle size="sm" />
            </div>
          </div>
        </div>
      </section>

      {/* ── DESKTOP FOOTER (hidden md:block) ── */}
      <footer className="hidden md:block mt-20 border-t border-black/[0.06] bg-[#f5f5f7] pb-8 transition-colors">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* ── TẦNG 1: TRẠNG THÁI & LIÊN HỆ TRỰC TIẾP ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-black/[0.06]">
          {/* Brand + Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <LogoMark className="w-6 h-6" />
              <span className="font-display font-black text-sm tracking-tight text-[#1d1d1f] dark:text-white">
                Car<span className="bg-gradient-to-r from-[#0099ff] to-[#f59e0b] bg-clip-text text-transparent">Mate</span>
              </span>
            </div>
            <span className="text-black/[0.15]">·</span>
            <div className="flex items-center gap-2 text-xs text-[#515154]">
              <span className="w-2 h-2 rounded-full bg-[#107c41] shrink-0" />
              <span className="text-[12px] font-medium text-[#515154]">
                {lang === 'en' ? 'Direct rideshare · 0% fee' : 'Tiện chuyến cùng đường · 0đ Phí trung gian'}
              </span>
            </div>
          </div>

          {/* Contact Capsule */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Telegram Support */}
            <a
              href={SITE_INFO.telegramSupport || SITE_INFO.telegram || 'https://t.me/brianhuynh91'}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8.5 px-3.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#229ED9]/50 text-slate-900 dark:text-white text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <TelegramIcon className="w-3.5 h-3.5 text-[#229ED9]" />
              <span>{lang === 'en' ? 'Telegram Support' : 'Hỗ Trợ Telegram'}</span>
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
                onClick={l.action}
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
            {SITE_INFO.legalName[lang]} ·{' '}
            {lang === 'en'
              ? 'Voluntary fuel cost-sharing platform, 0% platform fee.'
              : 'Nền tảng chia sẻ chi phí nhiên liệu tự nguyện, 0% chiết khấu.'}
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <span>© {year} CarMate.vn</span>
          </div>
        </div>
      </div>
    </footer>
  </>
  );
}
