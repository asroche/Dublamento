// Service worker: app funciona offline (cenas do YouTube precisam de internet)
const VERSION = 'dublamento-v3';
const SHELL = ['./', './index.html', './css/app.css', './js/app.js', './js/util.js', './js/db.js', './js/scenes.js', './js/player.js', './js/audio.js', './js/studio.js', './js/export.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    // rede primeiro (atualizações), cache como reserva offline
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
  } else if (url.hostname === 'i.ytimg.com') {
    e.respondWith(caches.open(VERSION + '-img').then(async c => { const hit = await c.match(e.request); if (hit) return hit; try { const r = await fetch(e.request); c.put(e.request, r.clone()); return r; } catch { return new Response('', { status: 504 }); } }));
  }
});
