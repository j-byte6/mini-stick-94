/* Barnburner offline support. The app and its team data are saved on the device the first time it opens,
   so it still opens with no signal. Pages load fresh from the web when there is a connection, so updates show up right away.
   Bump VERSION when the list of files below changes. */
const VERSION = "barnburner-v1";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "logos.json",
  "headshots.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon.png"
];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* try the network first and keep the copy fresh; use the saved copy when offline,
   or after a few seconds on a weak rink signal */
function networkFirst(req, key){
  const saved = () => caches.match(key || req, { ignoreSearch: true });
  const net = fetch(req).then(res => {
    if (res.ok || res.type === "opaque"){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(key || req, copy)); }
    return res;
  });
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = res => { if (!done && res){ done = true; resolve(res); } };
    const timer = setTimeout(() => saved().then(finish), 4000);
    net.then(res => { clearTimeout(timer); finish(res); })
       .catch(() => { clearTimeout(timer); saved().then(hit => hit ? finish(hit) : (!done && reject(new Error("offline")))); });
  });
}

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  /* the pixel fonts come from Google Fonts: use the saved copy if there is one */
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com"){
    ev.respondWith(caches.match(req).then(hit => hit || networkFirst(req)));
    return;
  }
  if (url.origin !== location.origin) return;
  /* any page in the app (including #r= share links) opens the app itself */
  if (req.mode === "navigate"){ ev.respondWith(networkFirst(req, "index.html")); return; }
  ev.respondWith(networkFirst(req));
});
