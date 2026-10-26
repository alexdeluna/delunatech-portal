const CACHE_NAME = "anotacoes-delunatech-v7";

const ARQUIVOS = [
    "./",
    "./index.html",
    "./app.js",
    "./visual.css",
    "./manifest.json",
    "./brand-mark.svg",
    "./sqlite-worker.js"
];


self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ARQUIVOS))

    );

    self.skipWaiting();

});


self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys().then(chaves => {

            return Promise.all(

                chaves
                    .filter(chave => chave.startsWith("anotacoes-delunatech-") && chave !== CACHE_NAME)
                    .map(chave => caches.delete(chave))

            );

        })

    );

    self.clients.claim();

});


self.addEventListener("fetch", event => {

    event.respondWith(

        caches.match(event.request)
            .then(resposta => {

                return resposta ||
                    fetch(event.request);

            })

    );

});