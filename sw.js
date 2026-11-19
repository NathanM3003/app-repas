/* App repas — service worker : l'app marche hors ligne, et se met à jour quand une nouvelle version est publiée.
   Pour publier une nouvelle version du code : changer VERSION ci-dessous (ex. 1.5.1). */
const VERSION = "1.6.1";
const CACHE = "app-repas-" + VERSION;
const FONTS = "app-repas-polices";
const CORE = ["./", "./index.html", "./recettes.json", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" })))));
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== FONTS) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej("lent"), 4000))]);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (_) {
    return (await c.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? c.match("./index.html") : Response.error());
  }
}
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.endsWith("recuperation-v1.json")) return; // toujours en ligne
    if (req.mode === "navigate" || url.pathname.endsWith("recettes.json") || url.pathname.endsWith("index.html")) { e.respondWith(networkFirst(req)); return; }
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
