import { logger } from '../lib/logger'

type LazyFactory<T> = () => Promise<T>

const reloadKey = 'bw-barber:lazy-reload'

async function clearAppCaches() {
  if ('caches' in window) {
    const cacheNames = await window.caches.keys()
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)))
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      registrations.map((registration) => registration.update().catch(() => undefined)),
    )
  }
}

function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('Loading chunk') ||
    message.includes('dynamically imported module')
  )
}

export function lazyWithRetry<T>(factory: LazyFactory<T>): LazyFactory<T> {
  return async () => {
    try {
      const module = await factory()
      sessionStorage.removeItem(reloadKey)

      return module
    } catch (error) {
      if (
        typeof window !== 'undefined' &&
        isChunkLoadError(error) &&
        sessionStorage.getItem(reloadKey) !== 'true'
      ) {
        logger.warn({
          action: 'lazy_chunk_load_failed_retry',
          area: 'routing',
          error,
          message: 'Falha ao carregar pacote dinamico. Limpando caches e recarregando.',
          metadata: {
            hasServiceWorker: 'serviceWorker' in navigator,
            willReload: true,
          },
        })
        sessionStorage.setItem(reloadKey, 'true')
        await clearAppCaches()
        window.location.reload()
      }

      logger.error({
        action: 'lazy_chunk_load_failed',
        area: 'routing',
        error,
        message: 'Falha ao carregar rota dinamica.',
        metadata: {
          alreadyRetried: sessionStorage.getItem(reloadKey) === 'true',
        },
      })

      throw error
    }
  }
}
