const CACHE_NAME = 'rahunok-app-shell-v2';
const APP_SHELL = ['/app/', '/app/manifest.webmanifest', '/app/icon.svg', '/app/icon-192.png', '/app/icon-512.png', '/app/icon-maskable-512.png'];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		Promise.all([
			caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
			self.clients.claim()
		])
	);
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
	const requestUrl = new URL(event.request.url);
	if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;
	if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname.includes('/auth/')) return;

	event.respondWith(
		fetch(event.request)
			.then((response) => {
				if (response.ok && requestUrl.pathname.startsWith('/app/')) {
					const copy = response.clone();
					void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
				}
				return response;
			})
			.catch(() =>
				caches.match(event.request).then((response) => {
					if (response) return response;
					if (event.request.mode === 'navigate') return caches.match('/app/');
					return Response.error();
				})
			)
	);
});