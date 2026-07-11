// Service Worker — push notifications handler for Cafam Telemetría
// This file is imported by the Workbox-generated SW via importScripts

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }

  const { title, body, level, url = '/', alarm_id } = payload;

  const options = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `alarm-${alarm_id || Date.now()}`,
    renotify: true,
    requireInteraction: level === 'critica',
    vibrate: level === 'critica' ? [300, 100, 300, 100, 600] : [200, 100, 200],
    data: { url },
    actions: [
      { action: 'open', title: 'Ver alarma' },
      { action: 'dismiss', title: 'Descartar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/alarms';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const existing = wins.find(w => w.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        return existing.navigate(url);
      }
      return clients.openWindow(url);
    })
  );
});
