/**
 * pushNotifications.js — Đăng ký nhận thông báo đẩy từ trình duyệt.
 *
 * Nguyên tắc xin quyền: KHÔNG bao giờ hỏi ngay khi khách vừa mở app. Chỉ hỏi
 * đúng lúc quyền đó có ý nghĩa rõ ràng — khi khách vừa check-in vào hàng đợi
 * trạm, tức là họ đang thực sự cần được báo lúc xe tới. Hỏi sớm thì bị từ chối,
 * mà trình duyệt từ chối một lần là gần như không xin lại được nữa.
 */

import api from '../api/client.js';

/** Chuyển khoá VAPID base64url sang Uint8Array theo yêu cầu của PushManager. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Trình duyệt có hỗ trợ đủ bộ Service Worker + Push + Notification không. */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Trạng thái quyền hiện tại: 'granted' | 'denied' | 'default' | 'unsupported'. */
export function getPermissionState() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Đăng ký nhận thông báo đẩy cho số điện thoại này.
 * Trả về { success, reason } — không bao giờ ném lỗi ra ngoài, vì thất bại ở
 * đây chỉ làm giảm trải nghiệm chứ không được phép chặn luồng đặt chuyến.
 */
export async function enablePushNotifications(phone) {
  if (!isPushSupported()) return { success: false, reason: 'unsupported' };
  if (!phone) return { success: false, reason: 'missing_phone' };

  try {
    const keyRes = await api.getVapidKey();
    if (!keyRes?.enabled || !keyRes?.publicKey) {
      // Máy chủ chưa cấu hình VAPID: khách vẫn nhận được thông báo in-app
      return { success: false, reason: 'server_not_configured' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { success: false, reason: permission };

    const registration = await navigator.serviceWorker.ready;

    // Dùng lại đăng ký cũ nếu đã có, tránh sinh endpoint rác mỗi lần gọi
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey)
      });
    }

    await api.subscribePush(subscription.toJSON(), phone);
    return { success: true };
  } catch (err) {
    console.warn('[Push] Không bật được thông báo đẩy:', err?.message);
    return { success: false, reason: 'error', message: err?.message };
  }
}

/** Tắt thông báo đẩy trên thiết bị này. */
export async function disablePushNotifications() {
  if (!isPushSupported()) return { success: false, reason: 'unsupported' };
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { success: true, reason: 'not_subscribed' };

    await api.unsubscribePush(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
    return { success: true };
  } catch (err) {
    return { success: false, reason: 'error', message: err?.message };
  }
}

/**
 * Lắng nghe cú bấm vào thông báo (Service Worker gửi về qua postMessage).
 * Trả về hàm huỷ đăng ký để component dọn dẹp khi unmount.
 */
export function onNotificationClick(handler) {
  if (!isPushSupported()) return () => {};
  const listener = (event) => {
    if (event.data?.type === 'NOTIFICATION_CLICK') handler(event.data.data);
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}
