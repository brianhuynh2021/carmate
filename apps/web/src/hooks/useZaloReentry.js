import { useState, useEffect } from 'react';

/**
 * Custom Hook: useZaloReentry
 * Quản lý vòng đời Zalo Re-entry & Magic Link Chủ xe xác nhận 1-chạm
 * Sử dụng chuẩn Page Visibility API hiện đại của trình duyệt.
 */
export function useZaloReentry({ isOpsPortal, onNavigateTab } = {}) {
  const [driverConfirmCode, setDriverConfirmCode] = useState(null);
  const [pendingZaloBooking, setPendingZaloBooking] = useState(null);

  // 1. Hỗ trợ truy cập nhanh /#admin, /admin và Magic Link xác nhận /#confirm-[code]
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

  // 2. Lắng nghe sự kiện Page Visibility API khi hành khách quay lại CarMate sau khi mở app Zalo
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        try {
          const raw = localStorage.getItem('carmate_pending_zalo_booking');
          if (raw) {
            const data = JSON.parse(raw);
            // Chỉ kích hoạt nếu hành khách vừa mở Zalo trong vòng 15 phút
            if (data && Date.now() - (data.timestamp || 0) < 15 * 60 * 1000) {
              setPendingZaloBooking(data);
            } else {
              localStorage.removeItem('carmate_pending_zalo_booking');
            }
          }
        } catch {
          // Bỏ qua nếu dữ liệu không hợp lệ
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const clearPendingBooking = () => {
    try {
      localStorage.removeItem('carmate_pending_zalo_booking');
    } catch {
      // Bỏ qua lỗi storage
    }
    setPendingZaloBooking(null);
  };

  return {
    driverConfirmCode,
    setDriverConfirmCode,
    pendingZaloBooking,
    setPendingZaloBooking,
    clearPendingBooking
  };
}

export default useZaloReentry;
