// RIN Service Worker — Phase 4 PWA support
const CACHE_NAME = 'rin-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/rin-logo-img.png',
]

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first for API calls, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin API requests
  if (request.method !== 'GET') return
  if (url.pathname.startsWith('/rpn/v1/') || url.pathname.startsWith('/wp-json/')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful HTML/JS/CSS responses
        if (response.ok && ['document', 'script', 'style', 'image'].includes(request.destination)) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  )
})
