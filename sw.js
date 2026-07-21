const CACHE_VERSION = 'yeobo-dinner-v1.1.0';
const APP_SHELL = [
  './',
  './index.html',
  './styles/base.css',
  './styles/content.css',
  './styles/overlays.css',
  './styles/responsive.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/app-context.js',
  './js/app-view.js',
  './js/app-actions.js',
  './js/menu-options.js',
  './js/menu-catalog-a.js',
  './js/menu-catalog-b.js',
  './js/menus.js',
  './js/recommendation.js',
  './js/storage.js',
  './assets/icons/app-icon.svg',
  './assets/icons/app-icon-maskable.svg',
  './assets/icons/app-icon-192.png',
  './assets/icons/app-icon-512.png',
  './assets/icons/app-icon-maskable-512.png',
  './assets/menus/default.svg',
  './assets/menus/shabu-shabu.svg',
  './assets/menus/sundubu-jjigae.svg',
  './assets/menus/pho.svg',
  './assets/menus/seolleongtang.svg',
  './assets/menus/abalone-porridge.svg',
  './assets/menus/samgyetang.svg',
  './assets/menus/kimchi-jjigae.svg',
  './assets/menus/gamjatang.svg',
  './assets/menus/tteokbokki.svg',
  './assets/menus/malatang.svg',
  './assets/menus/dakbal.svg',
  './assets/menus/dakgalbi.svg',
  './assets/menus/samgyeopsal.svg',
  './assets/menus/bossam.svg',
  './assets/menus/bulgogi.svg',
  './assets/menus/sushi.svg',
  './assets/menus/salmon-bowl.svg',
  './assets/menus/ramen.svg',
  './assets/menus/udon.svg',
  './assets/menus/tomato-pasta.svg',
  './assets/menus/cream-pasta.svg',
  './assets/menus/steak.svg',
  './assets/menus/pizza.svg',
  './assets/menus/fried-chicken.svg',
  './assets/menus/burger.svg',
  './assets/menus/tonkatsu.svg',
  './assets/menus/bibimbap.svg',
  './assets/menus/salad.svg',
  './assets/menus/curry.svg',
  './assets/menus/kalguksu.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
