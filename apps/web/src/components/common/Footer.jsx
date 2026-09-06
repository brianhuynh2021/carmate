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
    { key: 'market', label: 'Khám phá chuyến' },
    { key: 'match', label: 'Radar ghép' },
    { key: 'post', label: 'Đăng chuyến' },
    { key: 'benchmark', label: 'Bảng giá tuyến' },
    { key: 'trust', label: 'Tín nhiệm cộng đồng' }
  ];

  const secondaryLinks = [
    { key: 'policy', label: 'Quy chế cộng đồng' },
    { key: 'terms', label: 'Điều khoản' },
    { key: 'privacy', label: 'Bảo mật' },
    { key: 'dispute', label: 'Xử lý khiếu nại' },
    { key: 'help', label: 'Hỗ trợ' }
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
              <span className="text-[12px] font-medium text-[#515154]">
                Tiện chuyến cùng đường · 0đ Phí trung gian
              </span>
            </div>
          </div>

          {/* Contact Capsule */}
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`tel:${SITE_INFO.phoneRaw || '0984883750'}`}
              className="h-8 px-3.5 rounded-full border border-black/[0.08] bg-white hover:bg-[#ebebee] text-[#1d1d1f] text-xs font-mono font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Phone className="w-3 h-3 text-[#107c41]" />
              <span>{SITE_INFO.hotline}</span>
              <span className="text-[10px] text-[#86868b] font-sans hidden sm:inline">({SITE_INFO.contactPerson})</span>
            </a>

            <a
              href={SITE_INFO.zaloOA}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3.5 rounded-full border border-black/[0.08] bg-white hover:bg-[#ebebee] text-[#1d1d1f] text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <ZaloIcon className="w-3.5 h-3.5 text-[#0068ff]" />
              <span>Zalo Trực Tiếp</span>
            </a>

            <a
              href={SITE_INFO.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3.5 rounded-full border border-black/[0.08] bg-white hover:bg-[#ebebee] text-[#1d1d1f] text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2]" />
              <span>Fanpage Facebook</span>
            </a>
          </div>
        </div>

        {/* ── TẦNG 2: INLINE NAVIGATION & SHORTCUT CUES ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          {/* Main Links */}
          <nav className="flex items-center gap-x-4 gap-y-2 flex-wrap">
            {primaryLinks.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => onNavigate?.(l.key)}
                className="text-[#1d1d1f] hover:text-[#0071e3] font-semibold transition-colors cursor-pointer"
              >
                {l.label}
              </button>
            ))}
            <span className="text-black/[0.15] hidden sm:inline">|</span>
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
                className="text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                {l.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── TẦNG 3: LEGAL & COPYRIGHT ── */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11.5px] text-[#86868b]">
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
              className="text-[#86868b] hover:text-[#0071e3] transition-colors"
            >
              <FacebookIcon />
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
