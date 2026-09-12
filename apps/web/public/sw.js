// CarMate Service Worker v3.0
const CACHE_NAME = 'carmate-shell-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Let API requests pass directly to the network
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Network-First for HTML navigation to ensure users always get the freshest version
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Stale-While-Revalidate for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────
// THÔNG BÁO ĐẨY (WEB PUSH)
//
// Đây là kênh duy nhất đánh thức được khách khi app đã đóng — chính là lúc
// quan trọng nhất của bài toán liên tỉnh (đêm hôm trước và rạng sáng).
// ─────────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'CarMate', body: event.data.text() };
  }

  const kind = payload.kind || '';
  // Thông báo cần khách hành động ngay (ra trạm, đổi xe) phải ở lại màn hình
  // cho tới khi được bấm, không được tự biến mất sau vài giây.
  const requireInteraction = ['T30_APPROACH', 'CHECKIN_REMINDER', 'SHADOW_SWAP'].includes(kind);

  const actions = [];
  if (payload.data?.requiresHandshake) {
    actions.push({ action: 'on-the-way', title: 'Tôi đang ra trạm' });
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'CarMate', {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Gộp theo loại + mã yêu cầu: nhắc lần 2 THAY THẾ thông báo cũ thay vì
      // chồng thêm một dòng nữa vào khay thông báo của khách.
      tag: `${kind}:${payload.data?.intentId || payload.notificationId || ''}`,
      renotify: true,
      requireInteraction,
      vibrate: requireInteraction ? [200, 100, 200] : [100],
      data: { ...payload.data, kind, notificationId: payload.notificationId },
      actions
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  // Bấm thẳng "Tôi đang ra trạm" từ khay thông báo, không cần mở app
  if (event.action === 'on-the-way' && data.intentId) {
    event.waitUntil(
      fetch('/api/station/rider/on-the-way', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId: data.intentId })
      })
        .then((res) => {
          // fetch chỉ reject khi đứt mạng: 404/500 vẫn vào .then. Báo "đã xác nhận"
          // ở đây là nói dối khách — họ yên tâm đứng đợi rồi mất chỗ sau 10 phút.
          if (!res.ok) throw new Error('server_rejected');
          return self.registration.showNotification('Đã xác nhận', {
            body: 'Chủ xe đã được báo là bạn đang ra trạm.',
            icon: '/icons/icon-192.png',
            tag: `confirmed:${data.intentId}`
          });
        })
        .catch(() => {
          // Thất bại thật: mở app để khách tự bấm lại, tuyệt đối không báo thành công
          return self.clients.openWindow('/?intent=' + encodeURIComponent(data.intentId));
        })
    );
    return;
  }

  const targetUrl = data.intentId ? `/?intent=${encodeURIComponent(data.intentId)}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Đã có tab CarMate đang mở thì dùng lại, đừng mở thêm tab mới
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
