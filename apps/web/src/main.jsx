import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import { I18nProvider } from './i18n/index.jsx';
import './index.css';

// Chuẩn hóa tên miền Canonical: Chuyển hướng www.carmate.vn -> carmate.vn để khớp 100% với BotFather Telegram OAuth
if (typeof window !== 'undefined' && window.location.hostname.startsWith('www.')) {
  window.location.replace(window.location.href.replace('://www.', '://'));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
