import { useQuery } from '@tanstack/react-query'

import { useAuth } from './useAuth'
import { queryKeys } from '../lib/queryKeys'
import {
  canUseFeature,
  canWriteData,
  fetchSubscriptionData,
  getFeatureLimit,
  getGraceDaysRemaining,
  getSubscriptionAccessState,
  getTrialDaysRemaining,
  type FeatureKey,
} from '../services/subscriptionsService'

export function useSubscription() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id

  const query = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => fetchSubscriptionData(empresaId as string),
    queryKey: queryKeys.assinatura.detail(empresaId),
    refetchInterval: 60_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  })

  const subscription = query.data?.subscription ?? null
  const state = query.isSuccess ? getSubscriptionAccessState(subscription) : null

  return {
    ...query,
    canWrite: state ? canWriteData(state) : true,
    daysRemaining: getTrialDaysRemaining(subscription),
    graceDaysRemaining: getGraceDaysRemaining(subscription),
    isBlocked: state ? !canWriteData(state) : false,
    state,
    subscription,
  }
}

export function useFeatureAccess(featureKey: FeatureKey) {
  const subscriptionQuery = useSubscription()

  return {
    ...subscriptionQuery,
    canUse: canUseFeature(subscriptionQuery.data, featureKey),
    limit: getFeatureLimit(subscriptionQuery.data, featureKey),
  }
}
