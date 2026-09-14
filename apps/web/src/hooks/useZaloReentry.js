import { useState, useEffect } from 'react';

/**
 * Custom Hook: useZaloReentry
 * Điều hướng nhanh tới Admin Portal và xử lý Magic Link Chủ xe xác nhận 1-chạm.
 */
export function useZaloReentry({ isOpsPortal, onNavigateTab } = {}) {
  const [driverConfirmCode, setDriverConfirmCode] = useState(null);

  // Hỗ trợ truy cập nhanh /#admin, /admin và Magic Link xác nhận /#confirm-[code]
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash || '';
      const path = window.location.pathname || '';
      if (
        hash === '#admin' ||
        path === '/admin' ||
        path.startsWith('/admin') ||
        window.location.search.includes('portal=ops') ||
        isOpsPortal
      ) {
        onNavigateTab?.('admin');
      } else if (hash.startsWith('#confirm-')) {
        // Định dạng Magic Link: #confirm-<escrowId>~<accessToken>
        // Token là bí mật do server cấp, dùng để chống IDOR khi xác nhận không cần đăng nhập.
        const raw = hash.replace('#confirm-', '').trim();
        const [code, token] = raw.split('~');
        if (code) {
          setDriverConfirmCode({ code: code.trim(), token: (token || '').trim() });
        }
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('popstate', handleHash);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('popstate', handleHash);
    };
  }, [isOpsPortal, onNavigateTab]);

  return {
    driverConfirmCode,
    setDriverConfirmCode
  };
}

export default useZaloReentry;
