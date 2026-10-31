/* Service worker: cache app shell + thư viện CDN để mở nhanh, chạy lại được khi mạng yếu.
   Đổi VERSION mỗi lần cập nhật game để máy mọi người tải bản mới. */
const VERSION = 'tt-v1';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    // CDN: tải kiểu no-cors (opaque) để không bị chặn CORS; lỗi thì bỏ qua
    await Promise.all(CDN.map(u => fetch(new Request(u, {mode: 'no-cors'})).then(r => c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Supabase, WebSocket, YouTube: luôn đi thẳng ra mạng
  if (/supabase\.co|youtube\.com|ytimg\.com|googlevideo\.com/.test(url.hostname)) return;

  // Trang chính: ưu tiên mạng (luôn bản mới nhất), mất mạng thì dùng bản đã lưu
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => {
      const copy = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return r;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  // Còn lại (thư viện, font, icon): ưu tiên cache, chưa có thì tải rồi lưu
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => hit)));
});
