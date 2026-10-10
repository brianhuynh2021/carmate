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
// PUSH NOTIFICATIONS (WEB PUSH)
//
// This is the only channel that can wake a passenger when the app is closed — which is exactly
// the most critical moment for the intercity problem (the night before and the early morning).
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
  // Notifications that need the passenger to act right away (go to the station, swap vehicle) must stay on screen
  // until clicked, and must not disappear on their own after a few seconds.
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
      // Group by kind + request ID: a second reminder REPLACES the old notification instead of
      // stacking one more entry in the passenger's notification tray.
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

  // Tap "Tôi đang ra trạm" ("I'm heading to the station") straight from the notification tray, without opening the app
  if (event.action === 'on-the-way' && data.intentId) {
    event.waitUntil(
      fetch('/api/station/rider/on-the-way', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId: data.intentId })
      })
        .then((res) => {
          // fetch only rejects on a network failure: 404/500 still go into .then. Reporting "confirmed"
          // here would be lying to the passenger — they would wait calmly and then lose their seat after 10 minutes.
          if (!res.ok) throw new Error('server_rejected');
          return self.registration.showNotification('Đã xác nhận', {
            body: 'Chủ xe đã được báo là bạn đang ra trạm.',
            icon: '/icons/icon-192.png',
            tag: `confirmed:${data.intentId}`
          });
        })
        .catch(() => {
          // Real failure: open the app so the passenger can tap again themselves, never report success
          return self.clients.openWindow('/?intent=' + encodeURIComponent(data.intentId));
        })
    );
    return;
  }

  const targetUrl = data.intentId ? `/?intent=${encodeURIComponent(data.intentId)}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a CarMate tab is already open, reuse it instead of opening a new one
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
