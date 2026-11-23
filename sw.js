// Service Worker: hält die App-Dateien bereit, damit sie schnell startet.
// Daten kommen immer frisch aus der Datenbank (werden nicht zwischengespeichert).
const CACHE = "fcs-trainer-v64";
const SHELL = ["./", "index.html", "styles.css", "config.js", "main.js", "store.js", "diagram.js", "pdf.js", "plan.js", "gen.js",
  "wissen.js", "seed-data.js", "manifest.webmanifest", "logo-white.png", "icon-192-v3.png", "apple-touch-icon-v3.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Datenbank & CDN direkt
  if (url.pathname.includes("/videos/")) return; // Videos direkt (Safari braucht Teil-Anfragen)
  // Zuerst Netz (immer aktuelle Version, am Browser-Zwischenspeicher vorbei), bei Funkloch aus dem Speicher
  e.respondWith(fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});

// Push: neue Vorschläge an den App-Besitzer
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Trainer-App", { body: d.body || "", icon: "icon-192-v3.png", badge: "icon-192-v3.png", data: { url: "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(l => { const w = l.find(c => "focus" in c); return w ? w.focus() : self.clients.openWindow("./"); }));
});
