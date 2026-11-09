// scripts/build-sw.mjs rellena la versión y la lista al compilar.
const VERSION = '__VERSION__';
const PRECACHE = [/*__PRECACHE__*/];
const APP_CACHE = `notflix-app-${VERSION}`;
const POSTERS_CACHE = 'notflix-posters';
// La raíz de la app: '/NotFlix/' en GitHub Pages.
const SHELL = new URL('./', self.location).pathname;
const MAX_POSTERS = 600;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('notflix-app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Pósters: primero la caché, para verlos sin conexión. Se piden con CORS (TMDB
 * lo permite) porque Safari y Chrome cuentan las respuestas opacas como varios
 * MB cada una contra la cuota de almacenamiento.
 */
async function poster(request) {
  const cache = await caches.open(POSTERS_CACHE);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const response = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
  if (response.ok) {
    await cache.put(request.url, response.clone());
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_POSTERS)).map((k) => cache.delete(k)));
  }
  return response;
}

async function appFile(request) {
  const cache = await caches.open(APP_CACHE);
  // Se guarda la raíz y no '/index.html': algunos hosts redirigen este último y
  // Safari rechaza una navegación servida con una respuesta redirigida.
  if (request.mode === 'navigate') return (await cache.match(SHELL)) ?? fetch(request);
  return (await cache.match(request, { ignoreSearch: true })) ?? fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname === 'image.tmdb.org') event.respondWith(poster(request));
  else if (url.origin === self.location.origin) event.respondWith(appFile(request));
  // La API de TMDB va siempre a la red: lleva la key y no se guarda nada.
});
