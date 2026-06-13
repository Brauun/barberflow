import { logger } from './logger'

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) {
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const nextWorker = registration.installing

          if (!nextWorker) {
            return
          }

          nextWorker.addEventListener('statechange', () => {
            if (
              nextWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              nextWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      })
      .catch((error) => {
        logger.warn({
          action: 'service_worker_register_failed',
          area: 'pwa',
          error,
          message: 'Falha ao registrar service worker.',
        })
      })
  })

  let refreshing = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) {
      return
    }

    refreshing = true
    window.location.reload()
  })
}
