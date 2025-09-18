// Service Worker для VPF-PWA-Web
const staticCacheName = 'vpf-cache-v26';

const assetUrls = [
    '/vpf-pwa-web/',
    '/vpf-pwa-web/index.html',
    '/vpf-pwa-web/participants.html',
    '/vpf-pwa-web/program.html',
    '/vpf-pwa-web/organizers.html',
    '/vpf-pwa-web/about.html',
    '/vpf-pwa-web/partners.html',
    '/vpf-pwa-web/map.html',
    '/vpf-pwa-web/location.html',
    '/vpf-pwa-web/contacts.html',
    '/vpf-pwa-web/negotiation.html',
    '/vpf-pwa-web/script.js',
    '/vpf-pwa-web/manifest.json',
    '/vpf-pwa-web/data/location.json',
    '/vpf-pwa-web/data/partners.json',
    '/vpf-pwa-web/data/schedule.json',
    '/vpf-pwa-web/data/contacts.json',
    '/vpf-pwa-web/data/speakers.json',
    '/vpf-pwa-web/data/map.json',
    '/vpf-pwa-web/assets/img/full-logo.png',
    '/vpf-pwa-web/assets/img/logo.png',
    '/vpf-pwa-web/assets/img/big-hall-pic.png',
    '/vpf-pwa-web/assets/img/big-hall-schem.png',
    '/vpf-pwa-web/assets/img/small-hall-pic.png',
    '/vpf-pwa-web/assets/img/small-hall-schem.png',
    '/vpf-pwa-web/assets/img/zal.png',
    '/vpf-pwa-web/assets/img/map-fallback.png'
];

self.addEventListener('install', event => {
    console.log('[SW]: install');
    self.skipWaiting();
    event.waitUntil(
        caches.open(staticCacheName).then(cache => cache.addAll(assetUrls).catch(() => { }))
    );
});

self.addEventListener('activate', event => {
    console.log('[SW]: activate');
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(n => n !== staticCacheName).map(n => caches.delete(n)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const isJSON = url.pathname.endsWith('.json');
    const isScript = url.pathname.endsWith('/script.js') || url.pathname.endsWith('script.js');

    if (isJSON || isScript) {
        event.respondWith(networkFirst(event.request));
    } else {
        event.respondWith(cacheFirst(event.request));
    }
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    try {
        return cached ?? await fetch(request);
    } catch {
        return cached ?? new Response('Offline', { status: 503, statusText: 'Offline' });
    }
}

async function networkFirst(request) {
    const cache = await caches.open(staticCacheName);
    try {
        const fresh = await fetch(request, { cache: 'no-store' });
        cache.put(request, fresh.clone());
        return fresh;
    } catch {
        const cached = await caches.match(request);
        return cached ?? new Response('Offline', { status: 503, statusText: 'Offline' });
    }
}
