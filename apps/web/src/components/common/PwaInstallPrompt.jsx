import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Laptop } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import Button from '../ui/Button.jsx';

function detectPlatform() {
  if (typeof window === 'undefined') {
    return { isMac: false, isIos: false, isSafari: false, isChrome: false, isFirefox: false, isDesktop: true };
  }
  const ua = (window.navigator.userAgent || '').toLowerCase();
  const ios = /iphone|ipad|ipod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const mac = /macintosh|mac os x/.test(ua) && !ios;
  const firefox = /firefox/.test(ua);
  const safari = /safari/.test(ua) && !/chrome|crios|fxios|edg|firefox/.test(ua);
  const chrome = /chrome|crios|edg/.test(ua) && !firefox;
  const desktop = !ios && !/android/.test(ua);
  return { isMac: mac, isIos: ios, isSafari: safari, isChrome: chrome, isFirefox: firefox, isDesktop: desktop };
}

export default function PwaInstallPrompt() {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [platform] = useState(() => detectPlatform());
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || document.referrer.includes('android-app://');
    const dismissed = sessionStorage.getItem('carmate_pwa_dismissed');

    // Không hiện popup làm phiền trên desktop trừ khi browser hỗ trợ install prompt
    if (platform.isDesktop && !deferredPrompt) {
      setHidden(true);
    } else {
      setHidden(Boolean(standalone || dismissed));
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!dismissed && !standalone) setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, [platform.isDesktop, deferredPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setHidden(true);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setHidden(true);
    try { sessionStorage.setItem('carmate_pwa_dismissed', 'true'); } catch {}
  };

  if (hidden) return null;

  const { isMac, isIos, isFirefox, isSafari } = platform;
  const title = isMac ? (isFirefox ? t('pwa.titleFirefoxMac') : t('pwa.titleMac')) : t('pwa.titleDefault');
  const tag = isMac ? (isFirefox ? t('pwa.tagTip') : t('pwa.tagDock')) : t('pwa.tagOneTap');
  const desc = isMac && isFirefox ? t('pwa.firefoxMac')
    : isMac && isSafari ? t('pwa.safariMac')
    : isMac && !deferredPrompt ? t('pwa.chromeMac')
    : isIos ? t('pwa.ios')
    : isMac ? t('pwa.defaultMac') : t('pwa.defaultMobile');

  return (
    <aside aria-label={title} className="fixed bottom-20 md:bottom-5 left-4 right-4 md:left-auto md:right-5 z-50 md:max-w-md anim-slide-up">
      <div className="surface p-4 flex items-start gap-3 shadow-xl">
        <span className="w-10 h-10 rounded-xl bg-primary-600 text-white inline-flex items-center justify-center shrink-0">
          {isMac ? <Laptop className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            {title}
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">{tag}</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{desc}</p>
          {deferredPrompt && (
            <Button size="xs" icon={Download} className="mt-2.5" onClick={handleInstall}>{t('pwa.install')}</Button>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('pwa.dismiss')}
          className="w-8 h-8 -mr-1 -mt-1 rounded-full inline-flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
