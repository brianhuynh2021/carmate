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
        {/* Suspense ở gốc đỡ cho mọi component tải trễ (React.lazy) bên trong App:
            buồng lái, trạm đón, hộp thư, hồ sơ, đặt chỗ và trang quản trị. Các màn
            hình này nặng và chỉ mở khi cần, nên tách khỏi gói tải ban đầu. */}
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
