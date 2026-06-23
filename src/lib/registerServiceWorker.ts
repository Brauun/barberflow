import { logger } from './logger'

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) {
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Força checagem de atualização sempre que o app volta ao foreground.
        // Necessário porque o WebKit/iOS não verifica isso de forma confiável
        // em background, principalmente em modo standalone (PWA instalado).
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {
              // Silencioso: falha de rede aqui não deve travar o app.
            })
          }
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
    logger.info({
      action: 'service_worker_controller_changed',
      area: 'pwa',
      message: 'Controle do service worker atualizado, recarregando.',
    })
    window.location.reload()
  })
}