import { useQuery } from '@tanstack/react-query'

import { useAuth } from './useAuth'
import { queryKeys } from '../lib/queryKeys'
import {
  canUseFeature,
  getFeatureLimit,
  getSubscriptionState,
  getTrialDaysRemaining,
  isSubscriptionExpired,
  type FeatureKey,
} from '../services/subscriptionsService'

export function useSubscription() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id

  const query = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => getSubscriptionState(empresaId as string),
    queryKey: queryKeys.assinatura.detail(empresaId),
  })

  const subscription = query.data?.subscription ?? null

  return {
    ...query,
    daysRemaining: getTrialDaysRemaining(subscription),
    isExpired: isSubscriptionExpired(subscription),
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
