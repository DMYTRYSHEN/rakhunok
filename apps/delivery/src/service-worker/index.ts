import { self } from '$app/service-worker';
import { version } from '$app/env';

const cachePrefix = 'rahunok-delivery-public-';
const cacheName = `${cachePrefix}${version}`;
const base = new URL('./', self.location.href);
const offlineUrl = new URL('pwa/offline.html', base).href;
const publicUrls = ['pwa/offline.html', 'pwa/icon-192.png', 'pwa/icon-512.png', 'manifest.webmanifest']
	.map(path => new URL(path, base).href);

self.addEventListener('install', event => {
	event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(publicUrls)));
});

self.addEventListener('activate', event => {
	event.waitUntil((async () => {
		for (const name of await caches.keys()) {
			if (name.startsWith(cachePrefix) && name !== cacheName) await caches.delete(name);
		}
		await self.clients.claim();
	})());
});

self.addEventListener('fetch', event => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
	if (publicUrls.includes(url.href)) {
		event.respondWith((async () => (await caches.open(cacheName)).match(url.href)
			.then(response => response ?? fetch(event.request)))());
	} else if (event.request.mode === 'navigate') {
		event.respondWith(fetch(event.request).catch(async () => {
			const response = await (await caches.open(cacheName)).match(offlineUrl);
			if (!response) return Response.error();
			return new Response((await response.text()).replace('href="../"', `href="${base.pathname}"`), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
			});
		}));
	}
});