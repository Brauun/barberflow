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
            if (nextWorker.state === 'installed') {
              logger.info({
                action: 'service_worker_update_available',
                area: 'pwa',
                message: 'Nova versão do BW Barber disponível para a próxima abertura.',
                metadata: {
                  hasController: Boolean(navigator.serviceWorker.controller),
                },
              })
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

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    logger.info({
      action: 'service_worker_controller_changed',
      area: 'pwa',
      message: 'Controle do service worker atualizado.',
    })
  })
}
