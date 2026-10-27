const CACHE='dt-consulta-tecnica-v2';
const FILES=['./','./index.html','./css/style.css','./js/app.js','./manifest.json','./assets/icon.svg','./assets/delunatech-logo.png','./assets/icon-brand.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('dt-consulta-tecnica-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached) return cached;
      return fetch(e.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
        return response;
      }).catch(()=>caches.match('./index.html'));
    })
  );
});
