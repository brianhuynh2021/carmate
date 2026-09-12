import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBDDCdttfpC9JfTgEAmviAhWw5Az6kIAvI',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'carmate-auth.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'carmate-auth',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'carmate-auth.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '933454059432',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:933454059432:web:9a73fd92e1166c1847ef9d',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-CRMCGMJGLD'
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
auth.useDeviceLanguage();

// Tự động bỏ qua xác thực reCAPTCHA cho số điện thoại test trên môi trường Local / Dev
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local') ||
    window.location.hostname.startsWith('192.168.'));

if (import.meta.env.DEV || isLocalhost) {
  auth.settings.appVerificationDisabledForTesting = true;
}

export let analytics = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

// Khởi tạo Firebase App Check bảo vệ Production khi có cấu hình VITE_RECAPTCHA_ENTERPRISE_KEY
export let appCheck = null;
if (typeof window !== 'undefined') {
  const enterpriseSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY;
  if (enterpriseSiteKey) {
    import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
      if (import.meta.env.DEV || isLocalhost) {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(enterpriseSiteKey),
        isTokenAutoRefreshEnabled: true
      });
    }).catch(() => {});
  }
}

export default app;

