// N1 プレー分析ボード service worker
// アプリを更新したら VERSION の数字を上げる（index.html の ?v= も合わせて上げる）
const VERSION = 'n1-analysis-v20';
const SHELL = ['./', './index.html', './css/app.css?v=20', './js/app.js?v=20', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.url.startsWith('blob:')) return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.includes('/board/')) return;
  // ページ本体・アプリのコードはネット優先（更新がすぐ届く）、オフラインならキャッシュ
  const own = url.origin === location.origin && /\.(html|js|css)$|\/$/.test(url.pathname);
  if (req.mode === 'navigate' || own){
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req, { ignoreSearch:false }).then(h => h || caches.match('./index.html'))));
    return;
  }
  // それ以外（アイコン・フォント）はキャッシュ優先
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque'){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => hit)));
});
