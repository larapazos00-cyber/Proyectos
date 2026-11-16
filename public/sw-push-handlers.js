/**
 * Handlers de Notificaciones Push y Mensajes en Segundo Plano para StudyFlow
 * Importado por el Service Worker generado por Workbox (vite-plugin-pwa).
 */

const STALE_CACHE_NAMES = [
  'studyflow-app-shell-swr',
  'studyflow-static-resources-swr',
];

if (typeof caches !== 'undefined') {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (STALE_CACHE_NAMES.includes(key)) {
        caches.delete(key).catch(() => {});
      }
    });
  }).catch(() => {});
}

self.addEventListener('activate', (event) => {
  if (typeof caches !== 'undefined') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => STALE_CACHE_NAMES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {
    title: '🧠 Repaso Espaciado Pendiente · StudyFlow',
    body: 'Tienes un repaso programado que está próximo a vencer o vencido. ¡Consolida tu memoria con Active Recall!',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'studyflow-spaced-review',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (_) {
      try {
        const text = event.data.text();
        if (text) {
          data.body = text;
        }
      } catch (__) {}
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || `studyflow-push-${Date.now()}`,
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: 'Abrir Repaso' },
      { action: 'dismiss', title: 'Entendido' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SHOW_NOTIFICATION' && payload) {
    const { title, options } = payload;
    self.registration.showNotification(title || 'StudyFlow Notificación', {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      ...options,
    });
  }

  if (type === 'PING') {
    event.source?.postMessage({ type: 'PONG', timestamp: Date.now() });
  }
});
