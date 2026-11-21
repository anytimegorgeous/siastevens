/* The Love Arcade's offline keeper. It sits at the top of the site so it can also keep the Forecast,
   but it only ever touches the Arcade, the Forecast and their fonts. Every other page of the site
   goes to the network exactly as before. Bump VERSION whenever a booth changes. */
const VERSION = "love-arcade-v2";
const FILES = [
  "arcade/", "arcade/index.html", "arcade/arcade.js", "arcade/arcade.css", "arcade/manifest.webmanifest", "arcade/joystick-180.png", "arcade/joystick-512.png",
  "arcade/myth-or-fact.html", "arcade/love-lab.html", "arcade/text-back.html", "arcade/what-they-mean.html",
  "arcade/face-off.html", "arcade/who-gets-the-call.html", "arcade/fight-night.html", "arcade/in-sync.html",
  "arcade/fortune-cookie.html", "arcade/spot-the-stage.html", "arcade/matchmaker.html", "arcade/skip-the-shortcut.html",
  "arcade/were-you-listening.html", "arcade/sail-or-anchor.html", "arcade/consume-or-create.html", "arcade/promise-or-proof.html", "arcade/love-superpower.html", "forecast.html", "forecast"
];
const BASE = new URL("./", self.location).pathname;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(FILES.map(f => c.add(new Request(f, {cache: "reload"}))))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("love-arcade-") && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function ours(url){
  if (url.origin === self.location.origin){
    const p = url.pathname;
    return p.startsWith(BASE + "arcade") || p.startsWith(BASE + "forecast") || p.startsWith(BASE + "images/") || p.endsWith("favicon.ico");
  }
  return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (!ours(url)) return;
  /* the saved copy answers at once; a fresh copy is fetched behind it for next time */
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, {ignoreSearch: url.origin === self.location.origin});
    const net = fetch(e.request).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
