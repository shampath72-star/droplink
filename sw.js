const C = 'droplink-v5';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'];
const CDN = /(^|\.)(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const same = u.origin === location.origin;
  if (!same && !CDN.test(u.host)) return;

  // The page itself: network first (so updates show up immediately), cache when offline or slow.
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(C);
      try {
        const r = await Promise.race([fetch(e.request), new Promise((_, j) => setTimeout(j, 3000))]);
        if (r && r.ok) c.put(e.request, r.clone());
        return r;
      } catch {
        return (await c.match(e.request, { ignoreSearch: true })) || (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Everything else: cache first, refreshed in the background.
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || c.match('./index.html');
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    if (e.action === 'reply' && e.reply) { l.forEach(c => c.postMessage({ t: 'reply', text: e.reply })); return l[0] ? undefined : clients.openWindow('./'); }
    return l[0] ? l[0].focus() : clients.openWindow('./');
  }));
});

// Push from a server (works even when the app is closed, once a push server is connected)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'DropLink', {
    body: d.body || 'New message', icon: 'icon-192.png', badge: 'icon-192.png',
    tag: d.tag || 'dl-' + Date.now(), renotify: true, vibrate: [120, 60, 120]
  }));
});
