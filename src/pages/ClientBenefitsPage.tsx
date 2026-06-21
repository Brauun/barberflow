import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gift, HeartHandshake, Loader2, Sparkles } from 'lucide-react'
import { useMemo } from 'react'

import { Badge, Button, Card, CardContent, CardHeader } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  listClientAvailableBenefitPrograms,
  listMyBenefitInterests,
  listMyClientBenefits,
  requestBenefitInterest,
  type BenefitProgramWithDetails,
  type ClientBenefitWithDetails,
} from '../services/benefitsService'
import { getPrimaryBarbershop } from '../services/clientService'
import { benefitProgramTypes, benefitRewardTypes, benefitRuleTypes } from '../types/benefits'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

function labelFromOptions(options: readonly { label: string; value: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

function isPaidOrManual(program: BenefitProgramWithDetails) {
  return (
    Number(program.valor) > 0 ||
    ['plano_mensal', 'pacote_pre_pago', 'clube_assinatura', 'beneficio_manual'].includes(
      program.tipo,
    )
  )
}

function getRuleTarget(program: BenefitProgramWithDetails) {
  const rule = program.rules[0]
  const params =
    rule?.parametros && typeof rule.parametros === 'object' && !Array.isArray(rule.parametros)
      ? (rule.parametros as Record<string, unknown>)
      : {}

  return Number(params.meta_quantidade ?? params.meta_valor ?? 0)
}

function progressText(benefit: ClientBenefitWithDetails) {
  const rule = benefit.rules?.[0]
  const params =
    rule?.parametros && typeof rule.parametros === 'object' && !Array.isArray(rule.parametros)
      ? (rule.parametros as Record<string, unknown>)
      : {}
  const target = Number(params.meta_quantidade ?? params.meta_valor ?? 0)

  if (!target) {
    return `${Number(benefit.pontos)} ponto(s) acumulados`
  }

  const current = Math.min(Number(benefit.pontos), target)
  const missing = Math.max(target - current, 0)

  return `${current}/${target} concluídos · faltam ${missing}`
}

export function ClientBenefitsPage() {
  const { clientProfile } = useAuth()
  const queryClient = useQueryClient()

  const barbershopQuery = useQuery({
    enabled: Boolean(clientProfile),
    queryFn: () => getPrimaryBarbershop(clientProfile!),
    queryKey: ['client-primary-barbershop', clientProfile?.id],
  })

  const empresaId = barbershopQuery.data?.empresa_id

  const programsQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listClientAvailableBenefitPrograms(empresaId as string),
    queryKey: ['client-benefit-programs', empresaId],
  })

  const benefitsQuery = useQuery({
    enabled: Boolean(empresaId && clientProfile?.id),
    queryFn: () =>
      listMyClientBenefits(empresaId as string, clientProfile?.id as string),
    queryKey: ['client-benefits-own', empresaId, clientProfile?.id],
  })

  const interestsQuery = useQuery({
    enabled: Boolean(empresaId && clientProfile?.id),
    queryFn: () =>
      listMyBenefitInterests(empresaId as string, clientProfile?.id as string),
    queryKey: ['client-benefit-interests-own', empresaId, clientProfile?.id],
  })

  const interestProgramIds = useMemo(
    () =>
      new Set(
        (interestsQuery.data ?? [])
          .filter((interest) => ['pendente', 'aprovado', 'ativado'].includes(interest.status))
          .map((interest) => interest.program_id),
      ),
    [interestsQuery.data],
  )

  const requestMutation = useMutation({
    mutationFn: requestBenefitInterest,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client-benefit-interests-own'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ])
    },
  })

  if (!clientProfile) {
    return null
  }

  if (barbershopQuery.isLoading) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={26} />
      </div>
    )
  }

  if (!barbershopQuery.data) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Escolha uma barbearia principal para visualizar planos e benefícios.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-7">
      <section>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400">
          Planos e benefícios
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 dark:text-white">
          Benefícios da {barbershopQuery.data.nome}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Acompanhe seus pontos, veja recompensas liberadas e demonstre interesse
          em planos ou pacotes da sua barbearia.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Benefícios ativos</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              {(benefitsQuery.data ?? []).filter((benefit) => benefit.status === 'ativo').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Disponíveis para uso</p>
            <p className="mt-2 text-2xl font-black text-brand-600 dark:text-brand-300">
              {(benefitsQuery.data ?? []).reduce(
                (total, benefit) => total + Number(benefit.saldo_usos),
                0,
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Interesses enviados</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              {interestsQuery.data?.length ?? 0}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div>
            <h3 className="text-base font-black text-slate-950 dark:text-white">
              Programas disponíveis
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Programas ativos configurados pela barbearia.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {programsQuery.isLoading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="animate-spin text-brand-500" size={24} />
            </div>
          ) : programsQuery.data?.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {programsQuery.data.map((program) => {
                const reward = program.rewards[0]
                const rule = program.rules[0]
                const target = getRuleTarget(program)
                const alreadyRequested = interestProgramIds.has(program.id)

                return (
                  <article
                    className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_16px_52px_rgb(15_23_42/0.035)] dark:border-slate-800 dark:bg-slate-900"
                    key={program.id}
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                        <Gift size={21} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-black text-slate-950 dark:text-white">
                            {program.nome}
                          </h4>
                          <Badge>{labelFromOptions(benefitProgramTypes, program.tipo)}</Badge>
                        </div>
                        {program.descricao && (
                          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {program.descricao}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Valor
                        </p>
                        <p className="mt-1 font-black text-brand-600 dark:text-brand-300">
                          {program.valor > 0 ? currencyFormatter.format(program.valor) : 'Grátis'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Regra
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                          {rule ? labelFromOptions(benefitRuleTypes, rule.tipo_regra) : 'Manual'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Meta
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                          {target ? `${target} ponto(s)` : 'Manual'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <Badge variant="success">
                        {reward
                          ? labelFromOptions(benefitRewardTypes, reward.tipo_recompensa)
                          : 'Benefício'}
                      </Badge>
                      {isPaidOrManual(program) && (
                        <Button
                          disabled={alreadyRequested || requestMutation.isPending}
                          onClick={() => requestMutation.mutate(program.id)}
                          size="sm"
                        >
                          {alreadyRequested ? 'Interesse enviado' : 'Tenho interesse'}
                        </Button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Esta barbearia ainda não possui programas ativos.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Sparkles className="text-brand-600" size={20} />
              <div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  Meus benefícios
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Recompensas liberadas ou créditos disponíveis para uso.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {benefitsQuery.data?.length ? (
              <div className="space-y-3">
                {benefitsQuery.data.map((benefit) => (
                  <div
                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    key={benefit.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950 dark:text-white">
                          {benefit.program?.nome ?? 'Programa'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {progressText(benefit)}
                        </p>
                      </div>
                      <Badge variant={Number(benefit.saldo_usos) > 0 ? 'success' : 'default'}>
                        {Number(benefit.saldo_usos)} uso(s)
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Você ainda não possui benefícios ativos.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <HeartHandshake className="text-brand-600" size={20} />
              <div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  Progresso e interesses
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Acompanhe solicitações enviadas para a barbearia.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {interestsQuery.data?.length ? (
              <div className="space-y-3">
                {interestsQuery.data.map((interest) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    key={interest.id}
                  >
                    <div>
                      <p className="font-black text-slate-950 dark:text-white">
                        {interest.program?.nome ?? 'Programa'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Solicitação enviada para análise.
                      </p>
                    </div>
                    <Badge variant={interest.status === 'pendente' ? 'warning' : 'success'}>
                      {interest.status.charAt(0).toUpperCase() + interest.status.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum interesse enviado até agora.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
