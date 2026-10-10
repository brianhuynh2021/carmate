import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import { I18nProvider } from './i18n/index.jsx';
import './index.css';

// Normalize the canonical domain: redirect www.carmate.vn -> carmate.vn to match the BotFather Telegram OAuth setup 100%
if (typeof window !== 'undefined' && window.location.hostname.startsWith('www.')) {
  window.location.replace(window.location.href.replace('://www.', '://'));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        {/* A root-level Suspense backs every lazily loaded component (React.lazy) inside App:
            cockpit, pickup station, inbox, profile, booking and admin pages. These
            screens are heavy and only opened on demand, so they are split out of the initial bundle. */}
        <React.Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <span className="w-6 h-6 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <App />
        </React.Suspense>
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
