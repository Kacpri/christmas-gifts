// Bump VERSION przy każdej zmianie tego pliku — activate czyści stare cache.
const VERSION = "v2";
const STATIC_CACHE = `cg-static-${VERSION}`;
const PAGE_CACHE = `cg-pages-${VERSION}`;
const OFFLINE_URL = "/offline";

// Strona offline + jej chunki/_next/static w jednym spójnym zestawie —
// bez tego zakaszowany HTML referowałby hashowane chunki, których cache
// nigdy nie widział (strona offline nie ładuje się online).
async function precacheOfflineShell() {
  const pageCache = await caches.open(PAGE_CACHE);
  const staticCache = await caches.open(STATIC_CACHE);
  const res = await fetch(OFFLINE_URL);
  if (!res.ok) return;
  const html = await res.text();
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) {
    urls.add(m[1]);
  }
  await pageCache.put(OFFLINE_URL, res);
  for (const url of urls) {
    const r = await fetch(url);
    if (r.ok) await staticCache.put(url, r);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOfflineShell().catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || Response.error();
        })
    );
    return;
  }

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === OFFLINE_URL ||
    url.pathname.startsWith("/icon") ||
    /\.(png|jpe?g|svg|webp|ico|gif)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
  }
});
