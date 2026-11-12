// ときたね Service Worker（M6）
// 方針：キャッシュ優先（cache-first）。キャッシュ名に版を含め、アプリを更新するときは
// この版を上げる。古いキャッシュは有効化時にすべて消すため、旧版と新版が混ざらない。
const CACHE = "tokitane-v4";
const CORE = [
  "./",
  "./index.html",
  "./style.css",
  "./js/app.js",
  "./js/questions.js",
  "./js/store.js",
  "./js/dates.js",
  "./js/backup.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
  "./privacy.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
    )
  );
});
