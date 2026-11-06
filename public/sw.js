/**
 * Service Worker para StudyFlow - Servicio de Notificaciones Push y Alertas en Segundo Plano
 * Permite recibir alertas de repasos espaciados vencidos o próximos a vencer,
 * incluso si la aplicación no está en primer plano o la pestaña está minimizada.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Manejo de eventos Push del navegador
self.addEventListener('push', (event) => {
  let data = {
    title: '🧠 Repaso Espaciado Pendiente · StudyFlow',
    body: 'Tienes un repaso programado que está próximo a vencer o vencido. ¡Consolida tu memoria con Active Recall!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
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
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
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

// Al hacer clic en la notificación: enfocar ventana abierta o abrir la aplicación
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

// Comunicación mediante mensajes desde la app para disparar alertas en segundo plano
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SHOW_NOTIFICATION' && payload) {
    const { title, options } = payload;
    self.registration.showNotification(title || 'StudyFlow Notificación', {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
  }

  if (type === 'PING') {
    event.source?.postMessage({ type: 'PONG', timestamp: Date.now() });
  }
});
