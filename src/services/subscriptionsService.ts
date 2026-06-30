import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import type { Database, Json } from '../types/database'

export type Plan = Database['public']['Tables']['plans']['Row']
export type Subscription = Database['public']['Tables']['subscriptions']['Row']
export type SubscriptionFeature =
  Database['public']['Tables']['subscription_features']['Row']
export type SubscriptionUsage =
  Database['public']['Tables']['subscription_usage']['Row']

export type FeatureKey =
  | 'MAX_BARBERS'
  | 'MAX_CLIENTS'
  | 'HAS_WAITLIST'
  | 'HAS_LOYALTY'
  | 'HAS_ADVANCED_REPORTS'
  | 'HAS_EXECUTIVE_REPORTS'
  | 'HAS_WHATSAPP'
  | 'HAS_MULTI_UNITS'
  | 'HAS_EXECUTIVE_PDF'
  | 'HAS_PWA'
  | 'HAS_CLIENT_APP'

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'EXPIRED'

export type ComputedSubscriptionState =
  | 'TRIAL_ACTIVE'
  | 'TRIAL_ENDING'
  | 'TRIAL_EXPIRED_GRACE'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'BLOCKED'
  | 'CANCELLED'

export type SubscriptionAccessState =
  | 'TRIAL_ACTIVE'
  | 'TRIAL_ENDING'
  | 'TRIAL_EXPIRED_GRACE'
  | 'BLOCKED'
  | 'ACTIVE'

export type FeatureValue = boolean | number | 'unlimited'

export type SubscriptionData = {
  features: Record<string, FeatureValue>
  plans: Plan[]
  schemaReady: boolean
  subscription: (Subscription & { plan?: Plan | null }) | null
  usage: SubscriptionUsage[]
}

export const SUBSCRIPTION_GRACE_DAYS = 3
export const SUBSCRIPTION_ENDING_DAYS = 3
const DAY_IN_MS = 1000 * 60 * 60 * 24

const fallbackPlans: Plan[] = [
  {
    created_at: new Date(0).toISOString(),
    description: 'Para barbeiro autonomo',
    id: 'starter',
    is_active: true,
    monthly_price: 49.9,
    name: 'BW Start',
    slug: 'starter',
    updated_at: new Date(0).toISOString(),
    yearly_price: 499,
  },
  {
    created_at: new Date(0).toISOString(),
    description: 'Para barbearias em crescimento',
    id: 'professional',
    is_active: true,
    monthly_price: 99.9,
    name: 'BW Pro',
    slug: 'professional',
    updated_at: new Date(0).toISOString(),
    yearly_price: 999,
  },
  {
    created_at: new Date(0).toISOString(),
    description: 'Para operacoes maiores',
    id: 'premium',
    is_active: true,
    monthly_price: 199.9,
    name: 'BW Elite',
    slug: 'premium',
    updated_at: new Date(0).toISOString(),
    yearly_price: 1999,
  },
]

const professionalTrialFeatures: Record<FeatureKey, FeatureValue> = {
  HAS_ADVANCED_REPORTS: true,
  HAS_CLIENT_APP: true,
  HAS_EXECUTIVE_REPORTS: true,
  HAS_EXECUTIVE_PDF: true,
  HAS_LOYALTY: true,
  HAS_MULTI_UNITS: false,
  HAS_PWA: true,
  HAS_WAITLIST: true,
  HAS_WHATSAPP: false,
  MAX_BARBERS: 5,
  MAX_CLIENTS: 'unlimited',
}

function isMissingSubscriptionSchemaError(message: string) {
  return (
    message.includes("Could not find the table 'public.plans'") ||
    message.includes("Could not find the table 'public.subscriptions'") ||
    message.includes("Could not find the table 'public.subscription_features'") ||
    message.includes("Could not find the table 'public.subscription_usage'") ||
    message.includes('schema cache')
  )
}

function parseFeatureValue(value: Json): FeatureValue {
  if (value === 'unlimited') {
    return 'unlimited'
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return value
  }

  return Boolean(value)
}

export function getTrialDaysRemaining(subscription?: Subscription | null) {
  if (!subscription?.trial_ends_at) {
    return null
  }

  const diff = new Date(subscription.trial_ends_at).getTime() - Date.now()

  return Math.max(0, Math.ceil(diff / DAY_IN_MS))
}

export function getSubscriptionState(
  subscription?: Subscription | null,
  now = new Date(),
): ComputedSubscriptionState {
  if (!subscription) {
    return 'BLOCKED'
  }

  if (subscription.status === 'CANCELED') {
    return 'CANCELLED'
  }

  if (subscription.status === 'EXPIRED') {
    return 'BLOCKED'
  }

  if (subscription.status === 'PAST_DUE') {
    return 'PAST_DUE'
  }

  if (subscription.status === 'ACTIVE') {
    if (!subscription.expires_at) {
      return 'BLOCKED'
    }

    if (new Date(subscription.expires_at).getTime() <= now.getTime()) {
      return 'PAST_DUE'
    }

    return 'ACTIVE'
  }

  if (!subscription.trial_ends_at) {
    return 'BLOCKED'
  }

  const trialEndsAt = new Date(subscription.trial_ends_at).getTime()

  if (!Number.isFinite(trialEndsAt)) {
    return 'BLOCKED'
  }

  const diff = trialEndsAt - now.getTime()

  if (diff > SUBSCRIPTION_ENDING_DAYS * DAY_IN_MS) {
    return 'TRIAL_ACTIVE'
  }

  if (diff > 0) {
    return 'TRIAL_ENDING'
  }

  if (Math.abs(diff) <= SUBSCRIPTION_GRACE_DAYS * DAY_IN_MS) {
    return 'TRIAL_EXPIRED_GRACE'
  }

  return 'BLOCKED'
}

export function getSubscriptionAccessState(
  subscription?: Subscription | null,
  now = new Date(),
): SubscriptionAccessState {
  const state = getSubscriptionState(subscription, now)

  if (state === 'PAST_DUE' || state === 'CANCELLED') {
    return 'BLOCKED'
  }

  return state
}

export function isTrialEnding(state: SubscriptionAccessState) {
  return state === 'TRIAL_ENDING'
}

export function isInGracePeriod(state: SubscriptionAccessState) {
  return state === 'TRIAL_EXPIRED_GRACE'
}

export function canReadData(_state: SubscriptionAccessState) {
  return true
}

export function canWriteData(state: SubscriptionAccessState) {
  return state !== 'BLOCKED'
}

export function canUsePremiumFeature(state: SubscriptionAccessState) {
  return state !== 'BLOCKED'
}

export function getGraceDaysRemaining(
  subscription?: Subscription | null,
  now = new Date(),
) {
  if (!subscription?.trial_ends_at) {
    return null
  }

  const graceEndsAt =
    new Date(subscription.trial_ends_at).getTime() + SUBSCRIPTION_GRACE_DAYS * DAY_IN_MS
  const diff = graceEndsAt - now.getTime()

  return Math.max(0, Math.ceil(diff / DAY_IN_MS))
}

function logSubscriptionState(
  empresaId: string,
  subscription: Subscription | null,
  computedState: ComputedSubscriptionState,
) {
  if (!import.meta.env.DEV) {
    return
  }

  logger.info({
    action: 'subscription_state_calculated',
    area: 'subscription',
    empresaId,
    message: 'Estado da assinatura calculado.',
    metadata: {
      computedState,
      currentPeriodEnd: subscription?.expires_at ?? null,
      databaseStatus: subscription?.status ?? null,
      now: new Date().toISOString(),
      trialEndsAt: subscription?.trial_ends_at ?? null,
    },
  })
}

export async function fetchSubscriptionData(
  empresaId: string,
): Promise<SubscriptionData> {
  const [plansResponse, subscriptionResponse, usageResponse] = await Promise.all([
    supabase.from('plans').select('*').eq('is_active', true).order('monthly_price'),
    supabase
      .from('subscriptions')
      .select('*,plan:plans(*)')
      .eq('empresa_id', empresaId)
      .maybeSingle(),
    supabase.from('subscription_usage').select('*').eq('empresa_id', empresaId),
  ])

  if (plansResponse.error) {
    if (isMissingSubscriptionSchemaError(plansResponse.error.message)) {
      return {
        features: professionalTrialFeatures,
        plans: fallbackPlans,
        schemaReady: false,
        subscription: null,
        usage: [],
      }
    }

    throw new Error(plansResponse.error.message)
  }

  if (subscriptionResponse.error) {
    if (isMissingSubscriptionSchemaError(subscriptionResponse.error.message)) {
      return {
        features: professionalTrialFeatures,
        plans: fallbackPlans,
        schemaReady: false,
        subscription: null,
        usage: [],
      }
    }

    throw new Error(subscriptionResponse.error.message)
  }

  if (usageResponse.error) {
    if (isMissingSubscriptionSchemaError(usageResponse.error.message)) {
      return {
        features: professionalTrialFeatures,
        plans: fallbackPlans,
        schemaReady: false,
        subscription: null,
        usage: [],
      }
    }

    throw new Error(usageResponse.error.message)
  }

  const subscription =
    (subscriptionResponse.data as (Subscription & { plan?: Plan | null }) | null) ??
    null
  const computedState = getSubscriptionState(subscription)

  logSubscriptionState(empresaId, subscription, computedState)
  const planId = subscription?.plan_id
  const featuresResponse = planId
    ? await supabase.from('subscription_features').select('*').eq('plan_id', planId)
    : null

  if (featuresResponse?.error) {
    throw new Error(featuresResponse.error.message)
  }

  const features = ((featuresResponse?.data ?? []) as SubscriptionFeature[]).reduce<
    Record<string, FeatureValue>
  >((acc, feature) => {
    acc[feature.feature_key] = parseFeatureValue(feature.feature_value)
    return acc
  }, {})

  return {
    features:
      subscription?.status === 'TRIAL' && !Object.keys(features).length
        ? professionalTrialFeatures
        : features,
    plans: (plansResponse.data ?? []) as Plan[],
    schemaReady: true,
    subscription,
    usage: (usageResponse.data ?? []) as SubscriptionUsage[],
  }
}

export async function selectSubscriptionPlan(input: {
  empresaId: string
  planId: string
}) {
  const { error } = await supabase.functions.invoke('select-subscription-plan', {
    body: {
      empresa_id: input.empresaId,
      plan_id: input.planId,
    },
  })

  if (error) {
    throw new Error('Não foi possível alterar o plano. Tente novamente.')
  }
}

export function canUseFeature(
  state: SubscriptionData | undefined,
  featureKey: FeatureKey,
) {
  if (
    !state ||
    !canUsePremiumFeature(getSubscriptionAccessState(state.subscription))
  ) {
    return false
  }

  const value = state?.features[featureKey]

  return value === true || value === 'unlimited' || typeof value === 'number'
}

export function getFeatureLimit(
  state: SubscriptionData | undefined,
  featureKey: FeatureKey,
) {
  if (
    !state ||
    !canUsePremiumFeature(getSubscriptionAccessState(state.subscription))
  ) {
    return null
  }

  const value = state?.features[featureKey]

  return typeof value === 'number' || value === 'unlimited' ? value : null
}
