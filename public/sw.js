/* SSS HR System service worker (Phase 3 task 8): the app shell works offline; data never comes from a cache.
 * - Navigations: the network first, the cached shell when offline (the app then says it is offline).
 * - /assets/*: hashed by the build, so cached once and kept (cache first).
 * - The API, signed file links, Django's admin / static / media: always the network, never stored (personal data,
 *   and a punch must reach the server's clock).
 * Bump VERSION when this file changes; old caches are removed on activate. */
const VERSION = "smarthr-v3"; // v3: the SSS HR System logo (vector) and icons
const SHELL = ["/", "/manifest.webmanifest", "/logo.svg", "/favicon.png", "/icons/icon-192.png", "/icons/icon-512.png"];
const NEVER = ["/api/", "/admin/", "/static/", "/media/", "/platform/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || NEVER.some((p) => url.pathname.startsWith(p))) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached || Response.error())),
    );
    return;
  }
  if (url.pathname.startsWith("/assets/") || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
