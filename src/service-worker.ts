/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `zaki-gg-${version}`;
const STATIC_ASSETS = [
	...build,
	...files.filter(
		(path) =>
			path === '/manifest.webmanifest' ||
			path === '/apple-touch-icon.png' ||
			path.startsWith('/icons/')
	)
];

worker.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(STATIC_ASSETS);
			// The private craft manager is the offline entry point. Individual edit
			// routes are cached after they are visited.
			await cache.add('/crafts?edit');
			await worker.skipWaiting();
		})()
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key.startsWith('zaki-gg-') && key !== CACHE) await caches.delete(key);
			}
			await worker.clients.claim();
		})()
	);
});

worker.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (url.origin !== worker.location.origin) return;

	if (event.request.mode === 'navigate') {
		event.respondWith(handleNavigation(event.request));
		return;
	}

	if (STATIC_ASSETS.includes(url.pathname)) {
		event.respondWith(cacheFirst(event.request));
	}
});

async function handleNavigation(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	try {
		const response = await fetch(request);
		const url = new URL(request.url);
		if (response.ok && url.pathname.startsWith('/crafts') && url.searchParams.has('edit')) {
			await cache.put(request, response.clone());
		}
		return response;
	} catch {
		return (
			(await cache.match(request)) ??
			(await cache.match('/crafts?edit')) ??
			new Response('This page is unavailable offline.', {
				status: 503,
				headers: { 'content-type': 'text/plain; charset=utf-8' }
			})
		);
	}
}

async function cacheFirst(request: Request): Promise<Response> {
	const cached = await caches.match(request);
	if (cached) return cached;

	const response = await fetch(request);
	if (response.ok) {
		const cache = await caches.open(CACHE);
		await cache.put(request, response.clone());
	}
	return response;
}

export {};
