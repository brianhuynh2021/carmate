import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  BadgeCheck,
  Share2,
  FileText,
  Check,
  ChevronRight,
  Heart,
  Users,
  CigaretteOff,
  Star,
  Languages,
  Car
} from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { LanguageToggle } from '../common/Header.jsx';
import Button from '../ui/Button.jsx';
import Badge, { IconTile } from '../ui/Badge.jsx';
import { SectionHeader } from '../ui/EmptyState.jsx';
import api from '../../api/client.js';

const DEFAULT_PROFILE = {
  name: 'Nguyễn Anh Tuấn',
  hometown: 'Lộc Ninh, Bình Phước',
  memberSince: '03/2024',
  trustScore: 98,
  safeTripsCount: 142,
  rating: 5.0,
  carModel: 'Mitsubishi Xpander (7 chỗ)',
  carSeats: 7,
  licensePlateMasked: '93A-182.xx',
  verifications: [
    { key: 'phone_zalo', label: 'Số điện thoại & Zalo chính chủ', verified: true },
    { key: 'id_card', label: 'Căn cước công dân gắn chip', verified: true },
    { key: 'driver_license', label: 'Giấy phép lái xe B2', verified: true },
    { key: 'car_inspection', label: 'Đăng kiểm & Bảo hiểm TNDS', verified: true }
  ]
};

const ETIQUETTE_ICONS = [CigaretteOff, Users, Heart];

function SettingRow({ icon: Icon, tone, title, description, action, onClick }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-4 p-4 text-left ${
        onClick ? 'hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors' : ''
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <IconTile icon={Icon} tone={tone} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-white">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action || <ChevronRight className="w-4 h-4 text-slate-400" />}</div>
    </Comp>
  );
}

export default function TrustProfileView({ onOpenPolicy, onShowToast }) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [copied, setCopied] = useState(false);
  const etiquettes = t('profile.etiquettes');

  useEffect(() => {
    let active = true;
    async function fetchTrust() {
      try {
        const res = await api.getTrustProfile('tuan-bp');
        if (active && res?.success && res?.data) {
          const d = res.data;
          setProfile({
            name: d.name || DEFAULT_PROFILE.name,
            hometown: d.hometown || DEFAULT_PROFILE.hometown,
            memberSince: d.memberSince || DEFAULT_PROFILE.memberSince,
            trustScore: d.trustScore || DEFAULT_PROFILE.trustScore,
            safeTripsCount: d.tripsCompleted || DEFAULT_PROFILE.safeTripsCount,
            rating: d.rating || DEFAULT_PROFILE.rating,
            carModel: d.car?.model || DEFAULT_PROFILE.carModel,
            carSeats: 7,
            licensePlateMasked: d.car?.plate || DEFAULT_PROFILE.licensePlateMasked,
            verifications: d.verifications || DEFAULT_PROFILE.verifications
          });
        }
      } catch (e) {
        console.warn('Lỗi tải hồ sơ tín nhiệm:', e);
      }
    }

    fetchTrust();
    return () => {
      active = false;
    };
  }, []);

  const handleShare = () => {
    const text = t('profile.shareText', {
      name: profile.name,
      role: t('profile.roleTitle'),
      score: profile.trustScore,
      rating: profile.rating,
      trips: profile.safeTripsCount,
      car: `${profile.carModel}`,
      plate: profile.licensePlateMasked
    });
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch (e) {
      console.warn('Copy error:', e);
    }
    setCopied(true);
    onShowToast?.(t('toast.passportCopied'));
    setTimeout(() => setCopied(false), 3000);
  };

  const stats = [
    { label: t('profile.vehicle'), value: profile.carModel },
    { label: t('profile.plate'), value: profile.licensePlateMasked, mono: true },
    { label: t('profile.trips'), value: profile.safeTripsCount, mono: true },
    { label: t('profile.rating'), value: `${profile.rating} / 5`, mono: true, star: true }
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <SectionHeader
        icon={ShieldCheck}
        title={t('profile.passport')}
        description={t('profile.memberSince', { date: profile.memberSince })}
        action={
          <Badge tone="success" icon={ShieldCheck} className="h-7 px-2.5 font-semibold">
            Đã Đối Soát Hồ Sơ
          </Badge>
        }
      />

      {/* Passport card — Phong cách Google Wallet Pass */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0c4a6e] via-[#075985] to-[#0e1e36] text-white p-6 sm:p-8 shadow-xl border border-white/10">
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/15 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md text-white font-display text-xl font-bold inline-flex items-center justify-center shrink-0 border border-white/30 shadow-sm">
              {profile.name
                .split(' ')
                .slice(-2)
                .map((w) => w[0])
                .join('')}
            </span>
            <div>
              <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                {profile.name}
                <BadgeCheck className="w-5 h-5 text-amber-300" />
              </h3>
              <p className="text-sm text-sky-100 mt-0.5 font-medium">
                {t('profile.roleTitle')} · {t('profile.hometownPrefix')} {profile.hometown}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-200">{t('profile.trustScore')}</p>
            <p className="font-display text-4xl font-extrabold tabular tracking-tight leading-none mt-1">
              {profile.trustScore}
              <span className="text-base font-medium text-sky-200">/100</span>
            </p>
          </div>
        </div>

        <dl className="relative mt-7 pt-6 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-xs text-sky-200">{s.label}</dt>
              <dd
                className={`text-sm font-semibold mt-0.5 truncate inline-flex items-center gap-1 ${s.mono ? 'tabular' : ''}`}
              >
                {s.star && <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />}
                {s.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="relative mt-6 pt-5 border-t border-white/15 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[13px] text-sky-100 max-w-md">{t('profile.shareHint')}</p>
          <button
            type="button"
            onClick={handleShare}
            className="h-10 px-4 rounded-full bg-white text-primary-800 hover:bg-sky-50 font-semibold text-sm inline-flex items-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            <span>{copied ? t('profile.copiedBtn') : t('profile.shareBtn')}</span>
          </button>
        </div>
      </div>

      {/* Xác Thực Đa Tầng 4 Lớp */}
      <section className="surface p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('profile.verifyTitle')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('profile.verifyDesc')}</p>
          </div>
          <Badge tone="success" icon={Check} className="h-7 px-2.5 font-semibold">
            {profile.verifications.length}/4 Hạng Mục Đã Duyệt
          </Badge>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {profile.verifications.map((v) => (
            <li
              key={v.key}
              className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151c2e]/60"
            >
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 inline-flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{v.label}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                  ✓ Đã xác thực thành công
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Tiêu Chuẩn 3 Không Văn Minh */}
      <section className="surface p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('profile.etiquetteTitle')}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 mb-5">{t('profile.etiquetteDesc')}</p>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {etiquettes.map((item, idx) => (
            <li
              key={item.title}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-750"
            >
              <IconTile icon={ETIQUETTE_ICONS[idx]} tone="primary" size="sm" />
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-3">{item.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">{item.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Cài Đặt Ứng Dụng & Quy Chế */}
      <section className="surface overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 dark:text-white px-5 pt-5 pb-3">
          {t('profile.settingsTitle')}
        </h3>
        <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
          <SettingRow
            icon={FileText}
            tone="primary"
            title={t('profile.policyTitle')}
            description={t('profile.policyDesc')}
            onClick={onOpenPolicy}
          />
          <SettingRow
            icon={Languages}
            tone="neutral"
            title={t('profile.langTitle')}
            description={t('profile.langDesc')}
            action={<LanguageToggle size="sm" />}
          />
        </div>
      </section>
    </div>
  );
}
