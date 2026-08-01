const CACHE = "inner-signal-v7";
const OFFLINE_CACHE = "inner-signal-offline-v1";
const SHELL = ["./", "styles.css", "enhancements.css", "offline.css", "mobile-fixes.css", "drive-source.js", "app.js", "manifest.webmanifest", "images/inner-signal-default.png", "images/stasya-knight-relaxation.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.url.includes("/api/media/")) {
    event.respondWith(caches.open(OFFLINE_CACHE).then(cache => cache.match(event.request.url)).then(cached => cached || fetch(event.request)));
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request)));
});
