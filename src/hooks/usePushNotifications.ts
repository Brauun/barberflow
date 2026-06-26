import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from './useAuth'
import {
  createBrowserPushSubscription,
  disablePushNotifications,
  getBrowserPushSubscription,
  getPushDeviceInfo,
  getPushPermission,
  hasActivePushSubscription,
  hasPushVapidKey,
  requestPushPermission,
  savePushSubscription,
  sendTestPushNotification,
  supportsPushNotifications,
} from '../services/pushNotificationsService'

export function usePushNotifications() {
  const { profile, user } = useAuth()
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'default'>(
    getPushPermission(),
  )

  const device = useMemo(() => getPushDeviceInfo(), [])
  const empresaId = profile?.empresa_id ?? null
  const userId = user?.id ?? null
  const isSupported = supportsPushNotifications()
  const hasVapidKey = hasPushVapidKey()
  const isIOSBrowser = device.isIOS && !device.isStandalone
  const canSendTest = import.meta.env.DEV || profile?.papel === 'administrador'

  const refresh = useCallback(async () => {
    if (!userId || !isSupported) {
      setIsActive(false)
      return
    }

    try {
      const [browserSubscription, persistedSubscription] = await Promise.all([
        getBrowserPushSubscription(),
        hasActivePushSubscription(userId),
      ])

      setIsActive(Boolean(browserSubscription && persistedSubscription))
    } catch {
      setIsActive(false)
    }
  }, [isSupported, userId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [refresh])

  const activate = useCallback(async () => {
    setMessage(null)

    if (!isSupported) {
      setMessage('Seu navegador não suporta notificações push. Instale o app ou use um navegador compatível.')
      return false
    }

    if (isIOSBrowser) {
      setMessage('No iPhone, instale o BW Barber e abra-o pelo ícone da Tela de Início para ativar notificações.')
      return false
    }

    if (!hasVapidKey) {
      setMessage('As notificações push ainda não foram configuradas neste ambiente.')
      return false
    }

    if (!userId) {
      setMessage('Entre novamente para ativar notificações neste dispositivo.')
      return false
    }

    setIsLoading(true)

    try {
      const nextPermission = await requestPushPermission()
      setPermission(nextPermission)

      if (nextPermission !== 'granted') {
        setMessage('Permissão não concedida. Você pode ativá-la nas configurações do navegador.')
        return false
      }

      const subscription = await createBrowserPushSubscription()
      await savePushSubscription({
        empresaId,
        subscription,
        userId,
      })
      setIsActive(true)
      setMessage('Notificações ativadas com sucesso.')
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível ativar notificações.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [empresaId, hasVapidKey, isIOSBrowser, isSupported, userId])

  const disable = useCallback(async () => {
    if (!userId) {
      return false
    }

    setIsLoading(true)
    setMessage(null)

    try {
      await disablePushNotifications({ userId })
      setIsActive(false)
      setMessage('Notificações desativadas neste dispositivo.')
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível desativar notificações.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const sendTest = useCallback(async () => {
    if (!userId || !canSendTest || !isActive) {
      return false
    }

    setIsLoading(true)
    setMessage(null)

    try {
      await sendTestPushNotification({ userId })
      setMessage('Notificação de teste enviada.')
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a notificação de teste.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [canSendTest, isActive, userId])

  return {
    activate,
    canSendTest,
    device,
    disable,
    hasVapidKey,
    isActive,
    isIOSBrowser,
    isLoading,
    isSupported,
    message,
    permission,
    refresh,
    sendTest,
  }
}
