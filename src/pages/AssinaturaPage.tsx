import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  CalendarClock,
  Check,
  Crown,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { canManageFinance } from '../auth/permissions'
import { Badge, Button, Card, CardContent, CardHeader } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import { queryKeys } from '../lib/queryKeys'
import {
  selectSubscriptionPlan,
  type Plan,
  type SubscriptionAccessState,
} from '../services/subscriptionsService'
import { cn } from '../utils/cn'

type DisplayPlanSlug = 'starter' | 'professional' | 'premium'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

const featureLabels: Record<string, string> = {
  HAS_ADVANCED_REPORTS: 'Relatórios avançados',
  HAS_CLIENT_APP: 'App do cliente',
  HAS_EXECUTIVE_REPORTS: 'Relatórios executivos',
  HAS_EXECUTIVE_PDF: 'PDF executivo',
  HAS_LOYALTY: 'Planos e fidelidade',
  HAS_MULTI_UNITS: 'Multiunidades',
  HAS_PWA: 'PWA instalavel',
  HAS_WAITLIST: 'Lista de espera',
  HAS_WHATSAPP: 'WhatsApp',
  MAX_BARBERS: 'Barbeiros',
  MAX_CLIENTS: 'Clientes',
}

const planDisplayNames: Record<DisplayPlanSlug, string> = {
  premium: 'BW Elite',
  professional: 'BW Pro',
  starter: 'BW Start',
}

const planDisplayDescriptions: Record<DisplayPlanSlug, string> = {
  premium: 'Para operacoes maiores',
  professional: 'Para barbearias em crescimento',
  starter: 'Para barbeiro autonomo',
}

const planFeatureSummary: Record<DisplayPlanSlug, Array<[string, string]>> = {
  premium: [
    ['Barbeiros', 'Ilimitado'],
    ['Clientes', 'Ilimitado'],
    ['Lista de espera', 'incluído'],
    ['Fidelidade', 'incluído'],
    ['Relatórios executivos', 'incluído'],
    ['WhatsApp', 'incluído'],
    ['Multiunidades', 'incluído'],
  ],
  professional: [
    ['Barbeiros', '5'],
    ['Clientes', 'Ilimitado'],
    ['Lista de espera', 'incluído'],
    ['Fidelidade', 'incluído'],
    ['Relatórios executivos', 'incluído'],
    ['PDF executivo', 'incluído'],
    ['WhatsApp', 'não incluído'],
  ],
  starter: [
    ['Barbeiros', '1'],
    ['Clientes', '300'],
    ['Lista de espera', 'não incluído'],
    ['Fidelidade', 'não incluído'],
    ['Relatórios executivos', 'não incluído'],
    ['PWA', 'incluído'],
    ['App do cliente', 'incluído'],
  ],
}

function normalizePlanSlug(slug?: string | null): DisplayPlanSlug {
  const normalized = String(slug ?? 'professional').toLowerCase()

  if (normalized === 'starter' || normalized === 'premium') {
    return normalized
  }

  return 'professional'
}

function planDisplayName(plan?: Plan | null) {
  if (!plan) {
    return 'BW Pro'
  }

  return planDisplayNames[normalizePlanSlug(plan.slug)] ?? plan.name
}

function planDisplayDescription(plan?: Plan | null) {
  if (!plan) {
    return 'Plano liberado durante o trial.'
  }

  return planDisplayDescriptions[normalizePlanSlug(plan.slug)] ?? plan.description
}

const statusVariant: Record<SubscriptionAccessState, 'default' | 'danger' | 'success' | 'warning'> = {
  ACTIVE: 'success',
  BLOCKED: 'danger',
  TRIAL_ACTIVE: 'default',
  TRIAL_ENDING: 'warning',
  TRIAL_EXPIRED_GRACE: 'warning',
}

const statusLabels: Record<SubscriptionAccessState, string> = {
  ACTIVE: 'Ativa',
  BLOCKED: 'Bloqueada',
  TRIAL_ACTIVE: 'Teste ativo',
  TRIAL_ENDING: 'Teste terminando',
  TRIAL_EXPIRED_GRACE: 'Período de tolerância',
}

function planIcon(slug: Plan['slug']) {
  const normalized = normalizePlanSlug(slug)

  if (normalized === 'premium') {
    return <Crown size={22} />
  }

  if (normalized === 'professional') {
    return <Sparkles size={22} />
  }

  return <ShieldCheck size={22} />
}

function featureValue(value: unknown) {
  if (value === 'unlimited') {
    return 'Ilimitado'
  }

  if (value === true) {
    return 'Incluído'
  }

  if (value === false) {
    return 'Não incluído'
  }

  if (value === 'incluído') {
    return 'Incluído'
  }

  if (value === 'não incluído') {
    return 'Não incluído'
  }

  return String(value)
}

export function AssinaturaPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const subscriptionQuery = useSubscription()
  const state = subscriptionQuery.data
  const subscription = state?.subscription
  const currentPlan = subscription?.plan
  const empresaId = profile?.empresa_id
  const schemaReady = state?.schemaReady ?? true
  const computedState = subscriptionQuery.state ?? 'BLOCKED'

  const selectPlanMutation = useMutation({
    mutationFn: async (plan: Plan) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      if (!subscription?.id) {
        throw new Error('Assinatura não encontrada.')
      }

      await selectSubscriptionPlan({
        empresaId,
        planId: plan.id,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assinatura.detail(empresaId) })
    },
  })

  if (profile?.papel && !canManageFinance(profile.papel)) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-slate-500">
            Apenas administradores podem gerenciar a assinatura.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (subscriptionQuery.isLoading) {
    return <p className="text-sm text-slate-500">Carregando assinatura...</p>
  }

  if (subscriptionQuery.error) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm font-semibold text-red-600">
            Não foi possível carregar a assinatura.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {subscriptionQuery.error.message}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5 md:space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600">
            Assinatura
          </p>
          <h2 className="mt-2 text-xl font-black text-slate-950 md:mt-3 md:text-3xl dark:text-white">
            Planos do BW Barber
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Controle trial, plano atual e limites do sistema. Pagamento será
            integrado em uma proxima etapa.
          </p>
        </div>
        <Badge
          variant={
            !schemaReady
              ? 'warning'
              : statusVariant[computedState]
          }
        >
          {!schemaReady
            ? 'Estrutura pendente'
            : statusLabels[computedState]}
        </Badge>
      </section>

      {!schemaReady && (
        <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-400/20 dark:bg-amber-400/10">
          <CardContent>
            <p className="text-sm font-black text-amber-900 dark:text-amber-100">
              Estrutura de assinatura ainda não foi aplicada no Supabase.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-800/80 dark:text-amber-100/80">
              A tela esta funcionando em modo de pre-visualizacao. Para liberar a
              assinatura real, aplique a migration{' '}
              <code className="rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-amber-950 dark:bg-slate-950/50 dark:text-amber-100">
                supabase/migrations/20260606170000_subscriptions_plans_foundation.sql
              </code>{' '}
              no banco e recarregue o schema cache do Supabase.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm text-slate-500">Plano atual</p>
              <h3 className="mt-1.5 text-xl font-black text-slate-950 md:mt-2 md:text-2xl dark:text-white">
                {planDisplayName(currentPlan)}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {planDisplayDescription(currentPlan)}
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-brand-100 bg-brand-50/70 p-4 dark:border-brand-400/20 dark:bg-brand-400/10">
              <div className="flex items-center gap-3">
                <CalendarClock className="text-brand-600" size={22} />
                <div>
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    {!schemaReady
                      ? 'Migration pendente para ativar trial e planos reais.'
                      : computedState === 'TRIAL_ACTIVE' || computedState === 'TRIAL_ENDING'
                      ? `Seu teste grátis termina em ${subscriptionQuery.daysRemaining ?? 0} dias.`
                      : computedState === 'TRIAL_EXPIRED_GRACE'
                        ? 'Seu teste terminou e está no período de tolerância.'
                        : 'Assinatura fora do período de teste.'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Durante o trial, os recursos do BW Pro ficam liberados.
                  </p>
                </div>
              </div>
              {schemaReady &&
                (computedState === 'TRIAL_ACTIVE' || computedState === 'TRIAL_ENDING') && (
                <div className="mt-4 h-2 rounded-full bg-white/80 dark:bg-slate-900">
                  <div
                    className="h-2 rounded-full bg-brand-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, ((14 - (subscriptionQuery.daysRemaining ?? 0)) / 14) * 100),
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-3">
        {state?.plans.map((plan) => {
          const isCurrent = plan.id === subscription?.plan_id
          const planSlug = normalizePlanSlug(plan.slug)
          const isLocked = planSlug === 'premium' && !isCurrent

          return (
            <Card
              className={cn(
                isCurrent ? 'ring-2 ring-brand-300' : '',
                isLocked && 'relative opacity-80',
              )}
              key={plan.id}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-400/10 dark:text-brand-300">
                    {planIcon(plan.slug)}
                  </span>
                  {isCurrent ? <Badge>Atual</Badge> : isLocked ? <Badge>Em breve</Badge> : null}
                </div>
                <h3 className="mt-3 text-xl font-black text-slate-950 md:mt-5 md:text-2xl dark:text-white">
                  {planDisplayName(plan)}
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {planDisplayDescription(plan)}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-slate-950 md:text-3xl dark:text-white">
                  {currencyFormatter.format(Number(plan.monthly_price))}
                  <span className="text-sm font-semibold text-slate-500">/Mes</span>
                </p>
                <div className="mt-6 space-y-3">
                  {planFeatureSummary[planSlug].map(([key, value]) => (
                      <div
                        className="flex items-center justify-between gap-3 text-sm"
                        key={`${plan.id}-${key}`}
                      >
                        <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <Check className="text-brand-500" size={15} />
                          {featureLabels[key] ?? key}
                        </span>
                        <span className="font-semibold text-slate-950 dark:text-white">
                          {featureValue(value)}
                        </span>
                      </div>
                    ))}
                </div>
                <Button
                  className="mt-6 w-full"
                  disabled={!schemaReady || selectPlanMutation.isPending || isCurrent || isLocked}
                  leftIcon={<BadgeCheck size={18} />}
                  onClick={() => selectPlanMutation.mutate(plan)}
                >
                  {!schemaReady
                    ? 'Migration pendente'
                    : isLocked
                      ? 'Em breve'
                      : isCurrent
                        ? 'Plano atual'
                        : 'Selecionar plano'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </section>
    </div>
  )
}
