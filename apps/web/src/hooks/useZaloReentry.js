import { useState, useEffect } from 'react';

/**
 * Custom Hook: useZaloReentry
 * Quản lý vòng đời Zalo Re-entry & Magic Link Bác tài xác nhận 1-chạm
 * Sử dụng chuẩn Page Visibility API hiện đại của trình duyệt.
 */
export function useZaloReentry({ isOpsPortal, onNavigateTab } = {}) {
  const [driverConfirmCode, setDriverConfirmCode] = useState(null);
  const [pendingZaloBooking, setPendingZaloBooking] = useState(null);

  // 1. Hỗ trợ truy cập nhanh /#admin và Magic Link xác nhận /#confirm-[code]
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash || '';
      if (hash === '#admin' || isOpsPortal) {
        onNavigateTab?.('admin');
      } else if (hash.startsWith('#confirm-')) {
        const code = hash.replace('#confirm-', '').trim();
        if (code) {
          setDriverConfirmCode(code);
        }
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
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
