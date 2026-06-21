import { useCallback, useEffect, useMemo, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function getUserAgent() {
  if (typeof navigator === 'undefined') {
    return ''
  }

  return navigator.userAgent || ''
}

function getStandaloneState() {
  if (typeof window === 'undefined') {
    return false
  }

  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean
  }

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(getStandaloneState)
  const [message, setMessage] = useState<string | null>(null)

  const device = useMemo(() => {
    const ua = getUserAgent()
    const isAndroid = /Android/i.test(ua)
    const isIOS =
      /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isChrome = /Chrome|CriOS/i.test(ua) && !/Edg|OPR|SamsungBrowser/i.test(ua)
    const isSafari = /^((?!Chrome|CriOS|Android|Edg|OPR|Firefox|FxiOS).)*Safari/i.test(ua)

    return {
      isAndroid,
      isChrome,
      isIOS,
      isSafari,
      supportsNativePrompt: Boolean(installPrompt),
    }
  }, [installPrompt])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      setMessage('BW Barber instalado com sucesso.')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(display-mode: standalone)')

    if (!mediaQuery) {
      return
    }

    const onChange = () => setIsInstalled(getStandaloneState())
    mediaQuery.addEventListener?.('change', onChange)

    return () => {
      mediaQuery.removeEventListener?.('change', onChange)
    }
  }, [])

  const install = useCallback(async () => {
    if (getStandaloneState()) {
      setIsInstalled(true)
      setMessage('Aplicativo já instalado.')
      return 'installed' as const
    }

    if (!installPrompt) {
      return 'manual' as const
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)

    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
      setMessage('BW Barber instalado com sucesso.')
      return 'accepted' as const
    }

    return 'dismissed' as const
  }, [installPrompt])

  return {
    canUseNativePrompt: Boolean(installPrompt),
    device,
    install,
    isInstalled,
    message,
    setMessage,
  }
}
