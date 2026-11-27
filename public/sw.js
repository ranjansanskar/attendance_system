// Minimal service worker: makes the app installable and shows an offline notice.
// Attendance always needs the network, so pages are never served from cache.
const OFFLINE_HTML = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font-family:system-ui;padding:2rem;text-align:center">
<h1>You're offline</h1><p>Check-in needs an internet connection. Connect and try again.</p></body>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html" } })),
  );
});
