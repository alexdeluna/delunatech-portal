const CACHE="digitai-v5-sports-cache";const FILES=["./","index.html","styles.css","app.js","manifest.json","assets/delunatech-logo.png","assets/digitai-icon.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(response=>{let copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return response}).catch(()=>caches.match("./index.html"))))});
