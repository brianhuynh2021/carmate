import { useState, useEffect } from 'react';

/**
 * Custom Hook: useZaloReentry
 * Quick navigation to the Admin Portal and handling of the driver one-tap confirmation Magic Link.
 */
export function useZaloReentry({ isOpsPortal, onNavigateTab } = {}) {
  const [driverConfirmCode, setDriverConfirmCode] = useState(null);

  // Support quick access via /#admin, /admin and the confirmation Magic Link /#confirm-[code]
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
        // Magic Link format: #confirm-<escrowId>~<accessToken>
        // The token is a server-issued secret, used to prevent IDOR when confirming without logging in.
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
