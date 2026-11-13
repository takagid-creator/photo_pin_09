/* SANEI_現場NOTE オフライン用（v14：アイコンとmanifestもオフラインで使えるように）
   ・アプリ本体（.html）は「ネット優先」：つながっていれば毎回新しい版を取りに行く（GitHubの更新が1回で反映）
     つながらない・遅い（4秒）ときは、保存してある版で起動する
   ・それ以外のファイルは、保存してある版をすぐ使い、裏で新しくする */
const CACHE = 'photopin-v14';
const ASSETS = ['./photo_pin_09.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const TIMEOUT = 4000;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u => fetch(u, { cache: 'reload' }).then(r => r.ok && c.put(u, r)).catch(() => { }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function keyOf(req) { const u = new URL(req.url); u.search = ''; u.hash = ''; return u.href; }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const key = keyOf(req);
  const isApp = req.mode === 'navigate' || /\.html?$/i.test(url.pathname);

  if (isApp) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(req.url, { cache: 'no-cache' }).then(r => {
        if (r && r.ok) cache.put(key, r.clone());
        return r;
      });
      const late = new Promise(res => setTimeout(res, TIMEOUT));
      try {
        const r = await Promise.race([net, late]);
        if (r && r.ok) return r;
      } catch (err) { }
      const hit = await cache.match(key, { ignoreSearch: true });
      if (hit) return hit;
      return net;                       /* 保存がなければ、届くまで待つ */
    })());
    return;
  }

  e.respondWith(
    caches.match(key, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(r => {
        if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
