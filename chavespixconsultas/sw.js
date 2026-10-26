const CACHE_PREFIX = "delunatech-chaves-pix-";
const CACHE_NAME = "delunatech-chaves-pix-v10";

const ARQUIVOS_CACHE = [
    "./",
    "./index.html",
    "./visual.css",
    "./app.js",
    "./auth.js",
    "./db.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./assets/delunatech-logo.png",
    "./assets/delunatech-icon.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ARQUIVOS_CACHE);
            })
            .then(() => {
                return self.skipWaiting();
            })
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((nomesCaches) => {
                // Remover apenas versões antigas deste aplicativo.
                // Não apagar caches de outros aplicativos no mesmo domínio.
                return Promise.all(
                    nomesCaches
                        .filter((nomeCache) => nomeCache.startsWith(CACHE_PREFIX) && nomeCache !== CACHE_NAME)
                        .map((nomeCache) => caches.delete(nomeCache))
                );
            })
            .then(() => {
                return self.clients.claim();
            })
    );
});

self.addEventListener("fetch", (event) => {

    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    /*
     * Firebase e outros recursos externos:
     * não entram no cache do aplicativo.
     */
    if (url.origin !== self.location.origin) {
        return;
    }

    /*
     * Navegação entre páginas:
     * tenta buscar a versão atual na internet.
     * Se estiver sem internet, usa o index.html armazenado.
     */
    if (request.mode === "navigate") {

        event.respondWith(
            fetch(request)
                .then((response) => {

                    const resposta = response.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put("./index.html", resposta);
                        });

                    return response;
                })
                .catch(() => {
                    return caches.match("./index.html");
                })
        );

        return;
    }

    /*
     * Arquivos locais:
     * tenta primeiro a versão atual na internet.
     * Se não conseguir, usa o cache.
     */
    event.respondWith(
        fetch(request)
            .then((response) => {

                if (response && response.ok) {

                    const resposta = response.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(request, resposta);
                        });
                }

                return response;
            })
            .catch(() => {
                return caches.match(request);
            })
    );
});