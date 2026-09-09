import React from 'react';
import { Scale, ShieldCheck, Users, Car, Handshake, Link2 } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

function PolicySection({ icon, title, children }) {
  const Icon = icon;
  return (
    <section>
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 inline-flex items-center justify-center shrink-0">
          {Icon ? <Icon className="w-4 h-4" /> : null}
        </span>
        {title}
      </h4>
      <div className="pl-9 space-y-2.5">{children}</div>
    </section>
  );
}

export default function PolicyModal({ onClose, zIndex = 'z-50' }) {
  const { t } = useI18n();

  return (
    <Modal
      onClose={onClose}
      zIndex={zIndex}
      size="xl"
      icon={Scale}
      title={t('policy.title')}
      subtitle={`${t('policy.subtitle')} · ${t('policy.updated')}`}
      footer={
        <Button fullWidth size="lg" onClick={onClose}>
          {t('policy.accept')}
        </Button>
      }
    >
      <div className="space-y-7 text-sm leading-relaxed">
        <PolicySection icon={ShieldCheck} title={t('policy.s1Title')}>
          {t('policy.s1').map(([head, body]) => (
            <p key={head} className="text-slate-600 dark:text-slate-400">
              <strong className="font-semibold text-slate-900 dark:text-white">{head}.</strong> {body}
            </p>
          ))}
        </PolicySection>

        <PolicySection icon={Link2} title={t('policy.s2Title')}>
          {t('policy.s2').map(([head, body]) => (
            <p key={head} className="text-slate-600 dark:text-slate-400">
              <strong className="font-semibold text-slate-900 dark:text-white">{head}.</strong> {body}
            </p>
          ))}
        </PolicySection>

        <PolicySection icon={Handshake} title={t('policy.s3Title')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                <Car className="w-4 h-4 text-primary-600" />
                {t('policy.s3Driver')}
              </p>
              <p className="text-[13px] text-slate-600 dark:text-slate-400">{t('policy.s3DriverText')}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                <Users className="w-4 h-4 text-warning-600" />
                {t('policy.s3Passenger')}
              </p>
              <p className="text-[13px] text-slate-600 dark:text-slate-400">{t('policy.s3PassengerText')}</p>
            </div>
          </div>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 pt-1">{t('policy.s3Note')}</p>
        </PolicySection>
      </div>
    </Modal>
  );
}
