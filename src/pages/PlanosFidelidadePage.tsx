import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Edit,
  Gift,
  HeartHandshake,
  Loader2,
  Plus,
  Repeat,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Modal,
  Select,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useFeatureAccess } from '../hooks/useSubscription'
import {
  createBenefitProgram,
  listBenefitInterests,
  listBenefitPrograms,
  listBenefitUsageLogs,
  listClientBenefits,
  reviewBenefitInterest,
  updateBenefitProgramStatus,
  updateBenefitProgram,
  type BenefitProgramWithDetails,
} from '../services/benefitsService'
import { listServicos } from '../services/servicosService'
import {
  benefitProgramSchema,
  benefitProgramTypes,
  benefitRewardTypes,
  benefitRuleTypes,
  benefitTargetTypes,
  serviceScopeTypes,
  type BenefitProgramFormData,
  type BenefitProgramFormInput,
} from '../types/benefits'
import type { Json } from '../types/database'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

function emptyFormValues(): BenefitProgramFormInput {
  return {
    acumulavel: false,
    categorias_servico: '',
    cliente_ids: [],
    descricao: '',
    meta_quantidade: 0,
    meta_valor: 0,
    nome: '',
    publico_alvo: 'todos_clientes',
    regra_acumulo: '',
    regra_resgate: '',
    renovacao_periodo: '',
    recompensa_descricao: '',
    recompensa_valor: 0,
    servico_ids: [],
    servico_recompensa_id: '',
    service_scope: 'todos_servicos',
    status: 'ativo',
    tipo: 'plano_mensal',
    tipo_regra: 'periodo',
    tipo_recompensa: 'credito_conta',
    validade_dias: 30,
    valor: 0,
  }
}

function labelFromOptions(options: readonly { label: string; value: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

// Mesma lógica de fallback usada em normalizePilotProgramData, só que aqui
// é usada apenas para mostrar ao usuário, em tempo real, qual vai ser a
// frase de recompensa caso ele deixe o campo em branco.
function defaultRecompensaText(
  tipo: BenefitProgramFormInput['tipo'],
  metaQuantidade: unknown,
) {
  const meta = Number(metaQuantidade) || 0

  if (tipo === 'plano_mensal') {
    return 'Benefícios disponíveis durante o mês.'
  }

  if (tipo === 'pacote_pre_pago') {
    return `${meta || 1} usos pré-pagos.`
  }

  return 'Recompensa ao completar o cartão fidelidade.'
}

function jsonRecord(value: Json): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function normalizeProgramType(
  tipo: string,
): BenefitProgramFormInput['tipo'] {
  if (
    tipo === 'plano_mensal' ||
    tipo === 'pacote_pre_pago' ||
    tipo === 'cartao_fidelidade'
  ) {
    return tipo
  }

  return 'cartao_fidelidade'
}

function programToFormValues(
  program: BenefitProgramWithDetails,
): BenefitProgramFormInput {
  const rule = program.rules[0]
  const reward = program.rewards[0]
  const config = jsonRecord(program.config)
  const rewardParams = jsonRecord(reward?.parametros ?? {})

  return {
    acumulavel: program.acumulavel,
    categorias_servico:
      Array.isArray(rule?.categorias_servico) && rule.categorias_servico.length
        ? rule.categorias_servico.join(', ')
        : Array.isArray(config.categorias_servico)
          ? config.categorias_servico.join(', ')
          : '',
    cliente_ids: rule?.cliente_ids ?? [],
    descricao: program.descricao ?? '',
    meta_quantidade: Number(rule?.parametros && jsonRecord(rule.parametros).meta_quantidade) || 0,
    meta_valor: Number(rule?.parametros && jsonRecord(rule.parametros).meta_valor) || 0,
    nome: program.nome,
    publico_alvo: program.publico_alvo,
    regra_acumulo: program.regra_acumulo ?? '',
    regra_resgate: program.regra_resgate ?? '',
    renovacao_periodo: program.renovacao_periodo ?? '',
    recompensa_descricao: reward?.descricao ?? '',
    recompensa_valor: reward?.valor ?? 0,
    servico_ids: rule?.servico_ids ?? [],
    servico_recompensa_id: String(rewardParams.servico_recompensa_id ?? reward?.servico_id ?? ''),
    service_scope: String(jsonRecord(rule?.parametros ?? {}).service_scope ?? config.service_scope ?? 'todos_servicos'),
    status: program.status,
    tipo: normalizeProgramType(program.tipo),
    tipo_regra: rule?.tipo_regra ?? 'manual',
    tipo_recompensa: reward?.tipo_recompensa ?? 'manual',
    validade_dias: program.validade_dias ?? 0,
    valor: program.valor,
  }
}

function normalizePilotProgramData(
  data: BenefitProgramFormData,
): BenefitProgramFormData {
  const hasSpecificServices = data.servico_ids.length > 0

  const baseData: BenefitProgramFormData = {
    ...data,
    acumulavel: false,
    categorias_servico: '',
    cliente_ids: [],
    publico_alvo: 'todos_clientes',
    service_scope: hasSpecificServices ? 'servicos_especificos' : 'todos_servicos',
    status: 'ativo',
  }

  if (data.tipo === 'plano_mensal') {
    return {
      ...baseData,
      meta_quantidade: data.meta_quantidade || 1,
      renovacao_periodo: 'mensal',
      regra_acumulo: 'Plano mensal ativado manualmente pela barbearia.',
      regra_resgate: 'Cliente usa os benefícios dentro da validade mensal.',
      recompensa_descricao:
        data.recompensa_descricao || 'Benefícios disponíveis durante o mês.',
      tipo_regra: 'periodo',
      tipo_recompensa: 'credito_conta',
      validade_dias: data.validade_dias || 30,
    }
  }

  if (data.tipo === 'pacote_pre_pago') {
    return {
      ...baseData,
      meta_quantidade: data.meta_quantidade || 1,
      regra_acumulo: 'Usos liberados após ativação manual do pacote.',
      regra_resgate: 'Cliente consome um uso a cada atendimento concluído.',
      recompensa_descricao:
        data.recompensa_descricao || `${data.meta_quantidade || 1} usos pré-pagos.`,
      tipo_regra: 'quantidade_atendimentos',
      tipo_recompensa: 'credito_conta',
      validade_dias: data.validade_dias || 30,
    }
  }

  return {
    ...baseData,
    meta_quantidade: data.meta_quantidade || 10,
    regra_acumulo: 'A cada atendimento concluído, o cliente soma um ponto.',
    regra_resgate: 'Ao atingir a meta, o cliente recebe a recompensa configurada.',
    recompensa_descricao:
      data.recompensa_descricao || 'Recompensa ao completar o cartão fidelidade.',
    tipo_regra: 'quantidade_atendimentos',
    tipo_recompensa: 'servico_gratis',
    validade_dias: data.validade_dias || 180,
  }
}

export function PlanosFidelidadePage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const loyaltyAccess = useFeatureAccess('HAS_LOYALTY')
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProgram, setEditingProgram] =
    useState<BenefitProgramWithDetails | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [participantsTab, setParticipantsTab] = useState<
    'participantes' | 'historico'
  >('participantes')

  const programsQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listBenefitPrograms(empresaId as string),
    queryKey: ['benefit-programs', empresaId],
  })

  const clientBenefitsQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listClientBenefits(empresaId as string),
    queryKey: ['client-benefits', empresaId],
  })

  const usageLogsQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listBenefitUsageLogs(empresaId as string),
    queryKey: ['benefit-usage-logs', empresaId],
  })

  const interestsQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listBenefitInterests(empresaId as string),
    queryKey: ['benefit-interests', empresaId],
  })

  const servicosQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listServicos(empresaId as string, ''),
    queryKey: ['serviços', empresaId, 'benefits'],
  })
  const clientesQuery = { data: [] as Array<{ id: string; nome: string }> }

  const totals = useMemo(() => {
    const programs = programsQuery.data ?? []

    return {
      active: programs.filter((program) => program.status === 'ativo').length,
      participants: programs.reduce(
        (total, program) => total + program.participantsCount,
        0,
      ),
      usage: programs.reduce((total, program) => total + program.usageCount, 0),
      pendingInterests: (interestsQuery.data ?? []).filter(
        (interest) => interest.status === 'pendente',
      ).length,
    }
  }, [interestsQuery.data, programsQuery.data])

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<BenefitProgramFormInput, unknown, BenefitProgramFormData>({
    defaultValues: emptyFormValues(),
    resolver: zodResolver(benefitProgramSchema),
  })

  const selectedServiceIds = useWatch({ control, name: 'servico_ids' }) ?? []
  const selectedProgramType = useWatch({ control, name: 'tipo' })
  const watchedMetaQuantidade = useWatch({ control, name: 'meta_quantidade' })
  const selectedClientIds: string[] = []
  const publicTarget: string = 'todos_clientes'

  const saveMutation = useMutation({
    mutationFn: async (data: BenefitProgramFormData) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      const pilotProgramData = normalizePilotProgramData(data)

      if (editingProgram) {
        await updateBenefitProgram(empresaId, editingProgram.id, pilotProgramData)
        return
      }

      await createBenefitProgram(empresaId, pilotProgramData)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['benefit-programs'] }),
        queryClient.invalidateQueries({ queryKey: ['client-benefits'] }),
        queryClient.invalidateQueries({ queryKey: ['benefit-usage-logs'] }),
      ])
      setIsFormOpen(false)
      setEditingProgram(null)
      setFormError(null)
      reset(emptyFormValues())
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({
      programId,
      status,
    }: {
      programId: string
      status: 'ativo' | 'inativo'
    }) => updateBenefitProgramStatus(empresaId as string, programId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['benefit-programs'] })
    },
  })

  const reviewInterestMutation = useMutation({
    mutationFn: ({
      interestId,
      status,
    }: {
      interestId: string
      status: 'aprovado' | 'negado'
    }) => reviewBenefitInterest(interestId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['benefit-interests'] }),
        queryClient.invalidateQueries({ queryKey: ['client-benefits'] }),
        queryClient.invalidateQueries({ queryKey: ['benefit-usage-logs'] }),
      ])
    },
  })

  function openCreateModal() {
    setEditingProgram(null)
    setFormError(null)
    reset(emptyFormValues())
    setIsFormOpen(true)
  }

  function openEditModal(program: BenefitProgramWithDetails) {
    setEditingProgram(program)
    setFormError(null)
    reset(programToFormValues(program))
    setIsFormOpen(true)
  }

  function toggleArrayValue(
    field: 'servico_ids' | 'cliente_ids',
    currentValues: string[],
    value: string,
  ) {
    setValue(
      field,
      currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value],
      { shouldDirty: true },
    )
  }

  async function onSubmit(data: BenefitProgramFormData) {
    setFormError(null)

    try {
      await saveMutation.mutateAsync(data)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o programa.',
      )
    }
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para gerenciar planos
            e fidelidade.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!loyaltyAccess.isLoading && !loyaltyAccess.canUse) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600">
                Upgrade
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                Planos e Fidelidade não está disponível no seu plano.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Faça upgrade para BW Pro ou BW Elite para criar programas
                de fidelidade, pacotes e benefícios.
              </p>
            </div>
            <Button
              onClick={() => {
                window.location.href = '/app/assinatura'
              }}
            >
              Ver assinatura
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400">
            Planos e Fidelidade
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-normal text-zinc-950 dark:text-zinc-50">
            Benefícios para o piloto
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Crie um Plano Mensal, Pacote Pré-pago ou Cartão Fidelidade em poucos
            passos, sem regras avançadas.
          </p>
        </div>

        <Button leftIcon={<Plus size={18} />} onClick={openCreateModal}>
          Novo benefício
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Programas ativos
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {totals.active}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Clientes participantes
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {totals.participants}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Usos registrados
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {totals.usage}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Interesses pendentes
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {totals.pendingInterests}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div>
            <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              Programas ativos
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Estruturas comerciais configuradas pela barbearia.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {programsQuery.isLoading ? (
            <div className="flex min-h-48 items-center justify-center">
              <Loader2 className="animate-spin text-brand-500" size={26} />
            </div>
          ) : programsQuery.data?.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {programsQuery.data.map((program) => {
                const rule = program.rules[0]
                const reward = program.rewards[0]

                return (
                  <article
                    className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_16px_52px_rgb(15_23_42/0.035)] transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 sm:p-5"
                    key={program.id}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 gap-3 sm:gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                          <Gift size={22} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <h4 className="max-w-full break-words text-lg font-black leading-tight text-slate-950 dark:text-slate-50">
                              {program.nome}
                            </h4>
                            <Badge
                              variant={
                                program.status === 'ativo' ? 'success' : 'default'
                              }
                            >
                              {program.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {labelFromOptions(benefitProgramTypes, program.tipo)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:items-center">
                        <Button
                          className="w-full justify-center sm:w-auto"
                          onClick={() =>
                            statusMutation.mutate({
                              programId: program.id,
                              status: program.status === 'ativo' ? 'inativo' : 'ativo',
                            })
                          }
                          size="sm"
                          variant="secondary"
                        >
                          {program.status === 'ativo' ? 'Inativar' : 'Ativar'}
                        </Button>
                        <Button
                          aria-label="Editar programa"
                          className="shrink-0"
                          onClick={() => openEditModal(program)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <Edit size={16} />
                        </Button>
                      </div>
                    </div>

                    {program.descricao && (
                      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {program.descricao}
                      </p>
                    )}

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50/70 p-3 dark:bg-slate-950/40 sm:bg-transparent sm:p-0 dark:sm:bg-transparent">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Valor
                        </p>
                        <p className="mt-1 font-black text-brand-600 dark:text-brand-300">
                          {currencyFormatter.format(program.valor)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50/70 p-3 dark:bg-slate-950/40 sm:bg-transparent sm:p-0 dark:sm:bg-transparent">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Como funciona
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                          {program.regra_acumulo ??
                            (rule ? labelFromOptions(benefitRuleTypes, rule.tipo_regra) : 'Manual')}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50/70 p-3 dark:bg-slate-950/40 sm:bg-transparent sm:p-0 dark:sm:bg-transparent">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Recompensa
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                          {reward?.descricao ??
                            (reward
                              ? labelFromOptions(benefitRewardTypes, reward.tipo_recompensa)
                              : 'Manual')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Badge>{program.participantsCount} participantes</Badge>
                      <Badge>{program.usageCount} usos</Badge>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Sparkles size={22} />
              </span>
              <p className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">
                Nenhum programa criado
              </p>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Crie o primeiro Plano Mensal, Pacote Pré-pago ou Cartão
                Fidelidade da barbearia.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {(interestsQuery.isLoading || (interestsQuery.data?.length ?? 0) > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <HeartHandshake className="text-brand-600" size={20} />
              <div>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  Interesses de clientes
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Solicitações feitas pelo app do cliente para planos e pacotes.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {interestsQuery.data?.length ? (
              <div className="space-y-3">
                {interestsQuery.data.slice(0, 8).map((interest) => (
                  <div
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
                    key={interest.id}
                  >
                    <div>
                      <p className="font-black text-slate-950 dark:text-slate-50">
                        {interest.profile?.nome ?? interest.cliente?.nome ?? 'Cliente'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {interest.program?.nome ?? 'Programa'} ·{' '}
                        {interest.status.charAt(0).toUpperCase() + interest.status.slice(1)}
                      </p>
                    </div>
                    {interest.status === 'pendente' ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          leftIcon={<CheckCircle2 size={16} />}
                          onClick={() =>
                            reviewInterestMutation.mutate({
                              interestId: interest.id,
                              status: 'aprovado',
                            })
                          }
                          size="sm"
                        >
                          Aprovar
                        </Button>
                        <Button
                          leftIcon={<XCircle size={16} />}
                          onClick={() =>
                            reviewInterestMutation.mutate({
                              interestId: interest.id,
                              status: 'negado',
                            })
                          }
                          size="sm"
                          variant="secondary"
                        >
                          Negar
                        </Button>
                      </div>
                    ) : (
                      <Badge variant={interest.status === 'negado' ? 'danger' : 'success'}>
                        {interest.status.charAt(0).toUpperCase() + interest.status.slice(1)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nenhum cliente demonstrou interesse ainda.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {participantsTab === 'participantes' ? (
                <Users className="text-brand-600" size={20} />
              ) : (
                <Repeat className="text-brand-600" size={20} />
              )}
              <div>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  {participantsTab === 'participantes'
                    ? 'Clientes participantes'
                    : 'Histórico de uso'}
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {participantsTab === 'participantes'
                    ? 'Saldos, usos, pontos e créditos por cliente.'
                    : 'Resgates, descontos, cortesias e benefícios aplicados.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
              <Button
                onClick={() => setParticipantsTab('participantes')}
                size="sm"
                variant={participantsTab === 'participantes' ? 'primary' : 'ghost'}
              >
                Participantes
              </Button>
              <Button
                onClick={() => setParticipantsTab('historico')}
                size="sm"
                variant={participantsTab === 'historico' ? 'primary' : 'ghost'}
              >
                Histórico
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {participantsTab === 'participantes' ? (
            clientBenefitsQuery.data?.length ? (
              <div className="space-y-3">
                {clientBenefitsQuery.data.slice(0, 6).map((benefit) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    key={benefit.id}
                  >
                    <div>
                      <p className="font-black text-slate-950 dark:text-slate-50">
                        {benefit.cliente?.nome ?? 'Cliente'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {benefit.program?.nome ?? 'Programa'} · {benefit.status}
                      </p>
                    </div>
                    <Badge>{Number(benefit.saldo_usos)} usos</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nenhum cliente participante ainda.
              </p>
            )
          ) : usageLogsQuery.data?.length ? (
            <div className="space-y-3">
              {usageLogsQuery.data.slice(0, 6).map((log) => (
                <div
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  key={log.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950 dark:text-slate-50">
                        {log.program?.nome ?? 'Programa'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {log.cliente?.nome ?? 'Cliente'} · {log.tipo}
                      </p>
                    </div>
                    <p className="font-black text-brand-600 dark:text-brand-300">
                      {currencyFormatter.format(Number(log.valor_desconto))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum uso registrado ainda.
            </p>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingProgram ? 'Editar benefício' : 'Criar benefício'}
      >
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {formError && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </p>
          )}

          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700 shadow-sm dark:border-brand-500/30 dark:bg-slate-950/70 dark:text-slate-300">
            <p className="font-black text-slate-950 dark:text-white">
              Fluxo rápido para o piloto
            </p>
            <p className="mt-1 leading-6">
              Escolha um tipo, preencha o essencial e publique. As regras
              avançadas ficam padronizadas para evitar configuração complexa.
            </p>
          </div>

          <div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              1. Escolha o tipo
            </span>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {benefitProgramTypes.map((option) => {
                const isSelected = selectedProgramType === option.value

                return (
                  <button
                    className={[
                      'min-h-[136px] rounded-2xl border px-4 py-4 text-left transition hover:-translate-y-0.5',
                      isSelected
                        ? 'border-brand-300 bg-brand-50 text-brand-700 shadow-sm dark:border-brand-400/70 dark:bg-brand-500/15 dark:text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200',
                    ].join(' ')}
                    key={option.value}
                    onClick={() =>
                      setValue('tipo', option.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    type="button"
                  >
                    <span className="block text-sm font-black">{option.label}</span>
                    <span
                      className={[
                        'mt-1 block text-xs leading-5',
                        isSelected
                          ? 'text-slate-600 dark:text-slate-200'
                          : 'text-slate-500 dark:text-slate-400',
                      ].join(' ')}
                    >
                      {option.value === 'plano_mensal'
                        ? 'Cobrança recorrente e benefício mensal.'
                        : option.value === 'pacote_pre_pago'
                          ? 'Cliente compra usos antecipados.'
                          : 'Progresso por visitas até liberar recompensa.'}
                    </span>
                  </button>
                )
              })}
            </div>
            {errors.tipo?.message && (
              <p className="mt-2 text-sm text-red-600">{errors.tipo.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              error={errors.nome?.message}
              label="2. Nome do benefício"
              placeholder={
                selectedProgramType === 'cartao_fidelidade'
                  ? 'A cada 10 cortes, ganha 1'
                  : selectedProgramType === 'pacote_pre_pago'
                    ? 'Pacote de 5 barbas'
                    : 'Plano mensal corte ilimitado'
              }
              {...register('nome')}
            />
          </div>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Descrição
            </span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100/80 sm:text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
              placeholder="Explique de forma simples o que o cliente recebe."
              {...register('descricao')}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              error={errors.valor?.message}
              label="Valor cobrado"
              min={0}
              step="0.01"
              type="number"
              {...register('valor')}
            />
          </div>

          {/*
            Validade e renovação já têm um valor padrão inteligente calculado
            por tipo de programa em normalizePilotProgramData (30 dias para
            plano/pacote, 180 para cartão fidelidade, renovação mensal para
            plano). Mantemos os campos registrados (para não perder o valor
            no submit), só não expomos a digitação manual no fluxo simplificado.
          */}
          <div className="hidden">
            <Select
              label="Tipo de regra"
              options={benefitRuleTypes.map((option) => ({ ...option }))}
              {...register('tipo_regra')}
            />
            <Select
              label="Tipo de recompensa"
              options={benefitRewardTypes.map((option) => ({ ...option }))}
              {...register('tipo_recompensa')}
            />
            <Input
              label="Validade (dias)"
              min={0}
              step="1"
              type="number"
              {...register('validade_dias')}
            />
            <Input
              label="Renovação"
              {...register('renovacao_periodo')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={
                selectedProgramType === 'cartao_fidelidade'
                  ? 'Quantidade para ganhar'
                  : selectedProgramType === 'pacote_pre_pago'
                    ? 'Quantidade de usos'
                    : 'Usos por mês'
              }
              min={0}
              step="1"
              type="number"
              {...register('meta_quantidade')}
            />
          </div>

          <div className="hidden">
            <Select
              label="Publico"
              options={benefitTargetTypes.map((option) => ({ ...option }))}
              {...register('publico_alvo')}
            />
            <Select
              label="Serviços aplicáveis"
              options={serviceScopeTypes.map((option) => ({ ...option }))}
              {...register('service_scope')}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
              Serviços incluídos
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Deixe vazio para valer em todos os serviços.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(servicosQuery.data ?? []).map((servico) => (
                <label
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                  key={servico.id}
                >
                  <input
                    checked={selectedServiceIds.includes(servico.id)}
                    className="h-4 w-4 accent-brand-500"
                    onChange={() =>
                      toggleArrayValue('servico_ids', selectedServiceIds, servico.id)
                    }
                    type="checkbox"
                  />
                  {servico.nome}
                </label>
              ))}
            </div>
            {servicosQuery.data?.length === 0 && (
              <p className="mt-2 text-sm text-slate-500">
                Nenhum serviço cadastrado ainda.
              </p>
            )}
          </div>

          {publicTarget === 'clientes_especificos' && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                Clientes especificos
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(clientesQuery.data ?? []).map((cliente) => (
                  <label
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                    key={cliente.id}
                  >
                    <input
                      checked={selectedClientIds.includes(cliente.id)}
                      className="h-4 w-4 accent-brand-500"
                      onChange={() =>
                        toggleArrayValue('cliente_ids', selectedClientIds, cliente.id)
                      }
                      type="checkbox"
                    />
                    {cliente.nome}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Desconto ou crédito"
              min={0}
              step="0.01"
              type="number"
              {...register('recompensa_valor')}
            />
          </div>

          <Input
            label="Recompensa (opcional)"
            placeholder={defaultRecompensaText(selectedProgramType, watchedMetaQuantidade)}
            {...register('recompensa_descricao')}
          />

          <div className="-mx-5 mt-6 flex justify-end gap-3 border-t border-slate-100 bg-white px-5 pb-[env(safe-area-inset-bottom)] pt-4 dark:border-slate-800 dark:bg-zinc-900">
            <Button
              onClick={() => setIsFormOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={isSubmitting || saveMutation.isPending} type="submit">
              {saveMutation.isPending ? 'Publicando...' : 'Publicar benefício'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
