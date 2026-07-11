// @ts-nocheck
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NetworkFirst } from 'workbox-strategies';
import { registerRoute } from 'workbox-routing';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// API routes — network first
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'cafam-api', networkTimeoutSeconds: 5 })
);

// ── Push notifications ────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload: any;
  try { payload = event.data.json(); } catch { return; }

  const { title, body, level, url = '/alarms', alarm_id } = payload;

  const options: NotificationOptions = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `alarm-${alarm_id || Date.now()}`,
    renotify: true,
    requireInteraction: level === 'critica',
    vibrate: level === 'critica' ? [300, 100, 300, 100, 600] : [200, 100, 200],
    data: { url },
    actions: [
      { action: 'open', title: 'Ver alarma' },
      { action: 'dismiss', title: 'Descartar' }
    ] as NotificationAction[]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = (event.notification.data?.url as string) || '/alarms';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const existing = wins.find((w) => w.url.includes(self.location.origin));
      if (existing) { existing.focus(); return (existing as WindowClient).navigate(url); }
      return self.clients.openWindow(url);
    })
  );
});
