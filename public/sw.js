// Service Worker для VPF-PWA-Web
const staticCacheName = 'vpf-cache-v9';

const assetUrls = [
    '/vpf-pwa-web/',
    '/vpf-pwa-web/index.html',
    '/vpf-pwa-web/about.html',
    '/vpf-pwa-web/schedule.html',
    '/vpf-pwa-web/partners.html',
    '/vpf-pwa-web/map.html',
    '/vpf-pwa-web/location.html',
    '/vpf-pwa-web/contacts.html',
    '/vpf-pwa-web/manifest.json',
    '/vpf-pwa-web/data/program.json',
    '/vpf-pwa-web/assets/screenshots/desktop.png',
    '/vpf-pwa-web/assets/screenshots/mobile.png'
];

self.addEventListener('install', event => {
    console.log('[SW]: install'); // debug
    event.waitUntil(
        (async () => {
            const cache = await caches.open(staticCacheName);
            for (const url of assetUrls) {
                try {
                    await cache.add(url);
                } catch (err) {
                    console.warn('[SW] Не удалось закешировать:', url, err);
                }
            }
        })()
    );
});


self.addEventListener('activate', async event => {
    console.log('[SW]: activate'); // debug

    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames
            .filter(name => name !== staticCacheName)
            .map(name => caches.delete(name))
    );
});

self.addEventListener('fetch', event => {
    // только GET-запросы
    if (event.request.method !== 'GET') return;

    event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    try {
        return cached ?? await fetch(request);
    } catch (e) {
        return cached ?? new Response('Offline', {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}
