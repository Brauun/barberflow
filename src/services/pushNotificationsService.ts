import { supabase } from '../lib/supabase'

export type PushDeviceType = 'ios_pwa' | 'ios_safari' | 'android' | 'desktop' | 'browser'

export type PushDeviceInfo = {
  isAndroid: boolean
  isIOS: boolean
  isStandalone: boolean
  type: PushDeviceType
}

function isStandalone() {
  if (typeof window === 'undefined') {
    return false
  }

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

function toBase64(value: ArrayBuffer | null) {
  if (!value) {
    return ''
  }

  return btoa(String.fromCharCode(...new Uint8Array(value)))
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const normalizedValue = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const decoded = atob(normalizedValue)

  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

export function getPushDeviceInfo(): PushDeviceInfo {
  if (typeof navigator === 'undefined') {
    return { isAndroid: false, isIOS: false, isStandalone: false, type: 'browser' }
  }

  const userAgent = navigator.userAgent ?? ''
  const isIOS =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/i.test(userAgent)
  const standalone = isStandalone()

  return {
    isAndroid,
    isIOS,
    isStandalone: standalone,
    type: isIOS ? (standalone ? 'ios_pwa' : 'ios_safari') : isAndroid ? 'android' : 'desktop',
  }
}

export function supportsPushNotifications() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in navigator
  )
}

export function getPushPermission() {
  return typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission
    : 'default'
}

export function hasPushVapidKey() {
  return Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim())
}

async function getPushServiceWorkerRegistration() {
  if (!supportsPushNotifications()) {
    throw new Error('Seu navegador não suporta notificações push.')
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration('/')

  return existingRegistration ?? navigator.serviceWorker.register('/sw.js')
}

export async function getBrowserPushSubscription() {
  if (!supportsPushNotifications()) {
    return null
  }

  const registration = await getPushServiceWorkerRegistration()
  return registration.pushManager.getSubscription()
}

export async function requestPushPermission() {
  if (!supportsPushNotifications()) {
    throw new Error('Seu navegador não suporta notificações push.')
  }

  if (getPushPermission() === 'denied') {
    throw new Error('As notificações foram bloqueadas nas configurações do navegador.')
  }

  return Notification.requestPermission()
}

export async function createBrowserPushSubscription() {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()

  if (!vapidPublicKey) {
    throw new Error('As notificações push ainda não foram configuradas neste ambiente.')
  }

  const registration = await getPushServiceWorkerRegistration()
  const existingSubscription = await registration.pushManager.getSubscription()

  return (
    existingSubscription ??
    registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      userVisibleOnly: true,
    })
  )
}

export async function savePushSubscription(input: {
  empresaId?: string | null
  subscription: PushSubscription
  userId: string
}) {
  const existing = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', input.subscription.endpoint)
    .eq('user_id', input.userId)
    .maybeSingle()

  if (existing.error) {
    throw new Error(existing.error.message)
  }

  const payload = {
    auth: toBase64(input.subscription.getKey('auth')),
    device_type: getPushDeviceInfo().type,
    empresa_id: input.empresaId ?? null,
    endpoint: input.subscription.endpoint,
    is_active: true,
    p256dh: toBase64(input.subscription.getKey('p256dh')),
    user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    user_id: input.userId,
  }

  const query = existing.data?.id
    ? supabase.from('push_subscriptions').update(payload).eq('id', existing.data.id)
    : supabase.from('push_subscriptions').insert(payload)
  const { error } = await query

  if (error) {
    if (error.code === '23505') {
      throw new Error('Este dispositivo já está vinculado a outra conta.')
    }

    throw new Error(error.message)
  }
}

export async function disablePushNotifications(input: { userId: string }) {
  const browserSubscription = await getBrowserPushSubscription()

  if (browserSubscription) {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('endpoint', browserSubscription.endpoint)
      .eq('user_id', input.userId)

    if (error) {
      throw new Error(error.message)
    }

    await browserSubscription.unsubscribe()
  }
}

export async function hasActivePushSubscription(userId: string) {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  return Boolean(data?.length)
}

export async function sendTestPushNotification(input: { userId: string }) {
  const { error } = await supabase.functions.invoke('send-push-notification', {
    body: {
      body: 'Notificações ativadas com sucesso.',
      metadata: { kind: 'push_test' },
      title: 'BW Barber',
      url: '/app/dashboard',
      user_id: input.userId,
    },
  })

  if (error) {
    throw new Error(error.message)
  }
}
