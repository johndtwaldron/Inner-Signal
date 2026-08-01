const CACHE = "inner-signal-v9";
const OFFLINE_CACHE = "inner-signal-offline-v1";
const SHELL = ["./", "styles.css", "enhancements.css", "offline.css", "mobile-fixes.css", "player-controls.css", "drive-source.js", "app.js", "manifest.webmanifest", "images/inner-signal-default.png", "images/stasya-knight-relaxation.png"];
let driveAccessToken = null;
self.addEventListener("message", event => {
  if (event.data?.type === "DRIVE_TOKEN") driveAccessToken = event.data.accessToken;
});
self.addEventListener("install", event => event.waitUntil(Promise.all([self.skipWaiting(), caches.open(CACHE).then(cache => cache.addAll(SHELL))])));
self.addEventListener("activate", event => event.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("inner-signal-v") && key !== CACHE).map(key => caches.delete(key))))
])));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  if (url.pathname.includes("/drive-media/")) {
    event.respondWith((async () => {
      if (!driveAccessToken) return new Response("Reconnect Google Drive", {status: 401});
      const fileId = decodeURIComponent(url.pathname.split("/drive-media/").pop());
      const headers = {Authorization: `Bearer ${driveAccessToken}`};
      const range = event.request.headers.get("range");
      if (range) headers.Range = range;
      return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {headers});
    })());
    return;
  }
  if (url.pathname.includes("/offline/")) {
    event.respondWith((async () => {
      const cached = await (await caches.open(OFFLINE_CACHE)).match(event.request.url);
      if (!cached) return new Response("Not downloaded", {status: 404});
      const range = event.request.headers.get("range");
      if (!range) return cached;
      const blob = await cached.blob();
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (!match) return cached;
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;
      const headers = new Headers(cached.headers);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Range", `bytes ${start}-${end}/${blob.size}`);
      headers.set("Content-Length", String(end - start + 1));
      return new Response(blob.slice(start, end + 1, blob.type), {status: 206, headers});
    })());
    return;
  }
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
