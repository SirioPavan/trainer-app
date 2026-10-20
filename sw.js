// Service Worker: hält die App-Dateien bereit, damit sie schnell startet.
// Daten kommen immer frisch aus der Datenbank (werden nicht zwischengespeichert).
const CACHE = "fcs-trainer-v7";
const SHELL = ["./", "index.html", "styles.css", "config.js", "main.js", "store.js", "diagram.js",
  "wissen.js", "seed-data.js", "manifest.webmanifest", "logo-white.png", "icon-192-v2.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Datenbank & CDN direkt
  // Zuerst Netz (immer aktuelle Version), bei Funkloch aus dem Speicher
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});
