const CACHE_VERSION = 'push-foundation-20260626'
const STATIC_CACHE = `bw-barber-static-${CACHE_VERSION}`
const ASSET_CACHE = `bw-barber-assets-${CACHE_VERSION}`
const OFFLINE_URL = '/offline.html'

const STATIC_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-512.png',
]

function isSupabaseRequest(url) {
  return url.hostname.includes('supabase.co') || url.pathname.includes('/auth/v1/')
}

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/favicon.svg' ||
      url.pathname === '/favicon.ico' ||
      url.pathname === '/manifest.webmanifest')
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await Promise.allSettled(STATIC_ASSETS.map((asset) => cache.add(asset)))
      await self.skipWaiting()
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_BW_BARBER_CACHES') {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    )
  }
})

self.addEventListener('push', (event) => {
  const fallbackPayload = {
    body: 'Você recebeu uma nova atualização no BW Barber.',
    metadata: {},
    title: 'BW Barber',
    url: '/app/dashboard',
  }

  let payload = fallbackPayload

  try {
    payload = {
      ...fallbackPayload,
      ...(event.data ? event.data.json() : {}),
    }
  } catch {
    if (event.data?.text()) {
      payload = {
        ...fallbackPayload,
        body: event.data.text(),
      }
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      badge: '/icons/icon-192x192.png',
      body: payload.body,
      data: {
        metadata: payload.metadata ?? {},
        url: payload.url ?? '/app/dashboard',
      },
      icon: '/icons/icon-192x192.png',
      tag: `bw-barber-${payload.metadata?.notification_id ?? payload.title}`,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = new URL(
    event.notification.data?.url ?? '/app/dashboard',
    self.location.origin,
  ).href

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
      const matchingClient = clients.find((client) => client.url.startsWith(self.location.origin))

      if (matchingClient) {
        return matchingClient.focus().then(() => matchingClient.navigate(targetUrl))
      }

      return self.clients.openWindow(targetUrl)
    }),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || isSupabaseRequest(url)) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  if (!isStaticAsset(url)) {
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(ASSET_CACHE).then((cache) => {
              cache.put(request, responseClone)
            })
          }

          return response
        })
        .catch(() => caches.match(request)),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone)
          })
        }

        return response
      })
    }),
  )
})
