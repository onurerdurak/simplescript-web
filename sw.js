/*! SimpleScript. Copyright (c) 2026 Onur Erdurak. All rights reserved. */
/* global self, caches, fetch, URL, Response, setTimeout, clearTimeout */
// The browser build's offline cache (registered by registerServiceWorker.ts,
// browser build only). vite.config.ts copies this file to dist-web/sw.js
// and fills in the two lists below: every file the build wrote, and a
// version name that changes whenever any of them does.
//
// - The page itself (a navigation) comes from the network first, so an
//   update shows on the next load; the saved copy answers when offline or
//   when the network takes too long.
// - Everything else (scripts, styles, fonts, images) has a content hash in
//   its name, so a saved copy never goes stale: it answers first.
// - Each install saves every file of the new build, so the whole app works
//   offline after one visit, lazily loaded parts included. The previous
//   build's files are kept too: a tab still open on it may load one of its
//   parts later, and the host no longer has them.
// - Requests to other sites (the feedback form, the email check) are never
//   touched.

const VERSION = "7f64f02f76b90bc1";
const FILES = ["apple-touch-icon.png","assets/CourierPrime-Bold-CsRXgBhi.ttf","assets/CourierPrime-Regular-DXo6U2x0.ttf","assets/event-D4cyESDH.js","assets/html2canvas.esm-DXEQVQnt.js","assets/hunspell.web-CwNXaGyd.js","assets/index-C4wGFm9z.js","assets/index-RWf0r8gF.css","assets/index.es-Bz7z7jgg.js","assets/pdf-gh-BrLFn.js","assets/pdf.worker.min-CxGOWlsj.js","assets/purify.es-21m173o_.js","assets/scriptmanLogo-B0GUAhiO.png","assets/spellWorker-CQ5N8DV-.js","assets/third-party-notices-DV3L-p-m.js","assets/window-D-F_Sbmh.js","dict/en.aff","dict/en.dic","favicon.png","icon-512.png","index.html","manifest.webmanifest","share.jpg"];
const CACHE = "simplescript";
const LIST_KEY = "__simplescript-files__";
const NETWORK_WAIT_MS = 4000;

const scoped = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(FILES.map(scoped));
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Keep this build's files and the previous build's; drop the rest.
      const listResponse = await cache.match(LIST_KEY);
      const previous = listResponse ? (await listResponse.json()).files : [];
      const keep = new Set([...FILES, ...previous].map(scoped));
      for (const request of await cache.keys()) {
        if (request.url !== scoped(LIST_KEY) && !keep.has(request.url)) await cache.delete(request);
      }
      await cache.put(scoped(LIST_KEY), new Response(JSON.stringify({ version: VERSION, files: FILES })));
      // Other caches by an older version of this file.
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(pageFromNetworkFirst(request));
    return;
  }
  event.respondWith(savedCopyFirst(request));
});

async function pageFromNetworkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetchWithin(request, NETWORK_WAIT_MS);
    if (response.ok) await cache.put(scoped("index.html"), response.clone());
    return response;
  } catch {
    const saved = await cache.match(scoped("index.html"));
    if (saved) return saved;
    throw new Error("offline and no saved copy of the page");
  }
}

async function savedCopyFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request, { ignoreSearch: true });
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

function fetchWithin(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("network too slow")), ms);
    fetch(request).then(
      (response) => { clearTimeout(timer); resolve(response); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}
