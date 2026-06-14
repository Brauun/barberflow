import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarOff,
  Copy,
  Edit,
  ExternalLink,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { canInviteEmployee, canManageEmployees } from '../auth/permissions'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Modal,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useFeatureAccess } from '../hooks/useSubscription'
import { queryKeys } from '../lib/queryKeys'
import {
  createBarberUnavailability,
  deleteBarberUnavailability,
  listBarberUnavailability,
  updateBarberUnavailability,
  type BarberUnavailability,
} from '../services/barberUnavailabilityService'
import {
  inactivateLegacyBarbeiro,
  listBarbeiros,
  updateBarbeiro,
  type BarbeiroWithIndicators,
} from '../services/barbeirosService'
import {
  cancelEmployeeInvitation,
  createEmployeeInvitation,
  inactivateEmployeeLink,
  listEmployeeInvitations,
  listEmployeeLinks,
  regenerateEmployeeInvitationLink,
  type EmployeeInvitation,
  type EmployeeLink,
} from '../services/employeesService'
import {
  barberUnavailabilityReasons,
  barberUnavailabilitySchema,
  type BarberUnavailabilityFormData,
  type BarberUnavailabilityFormInput,
} from '../types/barberUnavailability'
import {
  barbeiroSchema,
  type BarbeiroFormData,
  type BarbeiroFormInput,
} from '../types/barbeiros'
import {
  employeeInvitationSchema,
  employeeRoleOptions,
  type EmployeeInvitationFormData,
  type EmployeeInvitationFormInput,
} from '../types/employees'
import {
  buildEmployeeInviteLink,
  buildEmployeeInviteMessage,
} from '../utils/inviteLinks'
import { formatPhone, maskPhoneChange } from '../utils/masks'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
})

function emptyFormValues(): BarbeiroFormInput {
  return {
    nome: '',
    percentual_comissao: 60,
    telefone: '',
  }
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function emptyUnavailabilityValues(
  barberId = '',
): BarberUnavailabilityFormInput {
  return {
    all_day: false,
    barber_id: barberId,
    date: todayInputValue(),
    end_time: '',
    reason: 'Folga',
    start_time: '',
  }
}

function emptyInvitationValues(): EmployeeInvitationFormInput {
  return {
    commission_percentage: 60,
    email: '',
    nome: '',
    role: 'barbeiro',
    telefone: '',
  }
}

function getInvitationStatus(invitation: EmployeeInvitation) {
  if (
    invitation.status === 'pendente' &&
    invitation.expires_at &&
    new Date(invitation.expires_at).getTime() <= Date.now()
  ) {
    return 'expirado'
  }

  return invitation.status
}

function unavailabilityToFormValues(
  block: BarberUnavailability,
): BarberUnavailabilityFormInput {
  return {
    all_day: block.all_day,
    barber_id: block.barber_id,
    date: block.date,
    end_time: block.end_time ?? '',
    reason: block.reason,
    start_time: block.start_time ?? '',
  }
}

function formatBlockTime(block: BarberUnavailability) {
  if (block.all_day) {
    return 'Dia inteiro'
  }

  return `${block.start_time?.slice(0, 5) ?? '--:--'} - ${
    block.end_time?.slice(0, 5) ?? '--:--'
  }`
}

function barbeiroToFormValues(
  barbeiro: BarbeiroWithIndicators,
): BarbeiroFormInput {
  return {
    nome: barbeiro.nome,
    percentual_comissao: Number(barbeiro.percentual_comissao),
    telefone: formatPhone(barbeiro.telefone),
  }
}

export function BarbeirosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBarbeiro, setEditingBarbeiro] =
    useState<BarbeiroWithIndicators | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isUnavailabilityFormOpen, setIsUnavailabilityFormOpen] =
    useState(false)
  const [editingUnavailability, setEditingUnavailability] =
    useState<BarberUnavailability | null>(null)
  const [unavailabilityError, setUnavailabilityError] = useState<string | null>(
    null,
  )
  const [isInviteFormOpen, setIsInviteFormOpen] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null)
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)
  const canManageUnavailability = canManageEmployees(profile?.papel)
  const canInviteEmployees = canInviteEmployee(profile?.papel)
  const barberLimitAccess = useFeatureAccess('MAX_BARBERS')
  const barbershopName = profile?.empresa?.nome ?? 'barbearia'

  const barbeirosQueryKey = useMemo(
    () => queryKeys.barbeiros.list(empresaId, searchTerm),
    [empresaId, searchTerm],
  )

  const {
    data: barbeiros = [],
    error: barbeirosError,
    isLoading: isLoadingBarbeiros,
  } = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listBarbeiros(empresaId as string, searchTerm),
    queryKey: barbeirosQueryKey,
  })

  const {
    data: unavailability = [],
    error: unavailabilityQueryError,
    isLoading: isLoadingUnavailability,
  } = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listBarberUnavailability(empresaId as string),
    queryKey: ['barber-unavailability', empresaId],
  })

  const employeeLinksQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listEmployeeLinks(empresaId as string),
    queryKey: ['employee-links', empresaId],
  })

  const employeeInvitationsQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listEmployeeInvitations(empresaId as string),
    queryKey: ['employee-invitations', empresaId],
  })

  const totals = useMemo(
    () =>
      barbeiros.reduce(
        (acc, barbeiro) => ({
          atendimentos: acc.atendimentos + barbeiro.atendimentos_count,
          comissao: acc.comissao + barbeiro.comissao_acumulada,
          faturamento: acc.faturamento + barbeiro.valor_faturado,
        }),
        {
          atendimentos: 0,
          comissao: 0,
          faturamento: 0,
        },
      ),
    [barbeiros],
  )

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<BarbeiroFormInput, unknown, BarbeiroFormData>({
    defaultValues: emptyFormValues(),
    resolver: zodResolver(barbeiroSchema),
  })

  const unavailabilityForm = useForm<
    BarberUnavailabilityFormInput,
    unknown,
    BarberUnavailabilityFormData
  >({
    defaultValues: emptyUnavailabilityValues(),
    resolver: zodResolver(barberUnavailabilitySchema),
  })

  const invitationForm = useForm<
    EmployeeInvitationFormInput,
    unknown,
    EmployeeInvitationFormData
  >({
    defaultValues: emptyInvitationValues(),
    resolver: zodResolver(employeeInvitationSchema),
  })

  const isAllDay = useWatch({
    control: unavailabilityForm.control,
    name: 'all_day',
  })

  useEffect(() => {
    if (editingBarbeiro) {
      reset(barbeiroToFormValues(editingBarbeiro))
      return
    }

    reset(emptyFormValues())
  }, [editingBarbeiro, reset])

  useEffect(() => {
    if (editingUnavailability) {
      unavailabilityForm.reset(unavailabilityToFormValues(editingUnavailability))
      return
    }

    unavailabilityForm.reset(emptyUnavailabilityValues(barbeiros[0]?.id ?? ''))
  }, [barbeiros, editingUnavailability, unavailabilityForm])

  const saveMutation = useMutation({
    mutationFn: async (data: BarbeiroFormData) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      if (editingBarbeiro) {
        await updateBarbeiro(empresaId, editingBarbeiro.id, data)
        return
      }

      throw new Error('Funcionários devem ser criados somente por convite.')
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.barbeiros.all })
      setIsFormOpen(false)
      setEditingBarbeiro(null)
      setFormError(null)
    },
  })

  const saveUnavailabilityMutation = useMutation({
    mutationFn: async (data: BarberUnavailabilityFormData) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      if (!canManageUnavailability) {
        throw new Error('Apenas administrador ou gerente pode criar bloqueios.')
      }

      if (editingUnavailability) {
        await updateBarberUnavailability(
          empresaId,
          editingUnavailability.id,
          data,
        )
        return
      }

      await createBarberUnavailability(empresaId, profile?.id ?? null, data)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['barber-unavailability'] }),
        queryClient.invalidateQueries({ queryKey: ['booking-unavailability'] }),
      ])
      setIsUnavailabilityFormOpen(false)
      setEditingUnavailability(null)
      setUnavailabilityError(null)
    },
  })

  const deleteUnavailabilityMutation = useMutation({
    mutationFn: async (block: BarberUnavailability) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      if (!canManageUnavailability) {
        throw new Error('Apenas administrador ou gerente pode excluir bloqueios.')
      }

      await deleteBarberUnavailability(empresaId, block.id)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['barber-unavailability'] }),
        queryClient.invalidateQueries({ queryKey: ['booking-unavailability'] }),
      ])
    },
  })

  const createInvitationMutation = useMutation({
    mutationFn: async (data: EmployeeInvitationFormData) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      if (!canInviteEmployees) {
        throw new Error('Apenas administrador ou gerente pode convidar.')
      }

      return createEmployeeInvitation({
        createdBy: profile?.id ?? null,
        data,
        empresaId,
      })
    },
    onSuccess: async (invitation) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-invitations'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-links'] }),
      ])
      setInviteError(null)
      setLastInviteLink(buildEmployeeInviteLink(invitation.token))
      invitationForm.reset(emptyInvitationValues())
    },
  })

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitation: EmployeeInvitation) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      await cancelEmployeeInvitation(empresaId, invitation.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employee-invitations'] })
    },
  })

  const regenerateInvitationMutation = useMutation({
    mutationFn: async (invitation: EmployeeInvitation) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      return regenerateEmployeeInvitationLink(empresaId, invitation.id)
    },
    onSuccess: async (invitation) => {
      await queryClient.invalidateQueries({ queryKey: ['employee-invitations'] })
      setLastInviteLink(buildEmployeeInviteLink(invitation.token))
    },
  })

  const inactivateEmployeeMutation = useMutation({
    mutationFn: async (link: EmployeeLink) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      await inactivateEmployeeLink(empresaId, link)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-links'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.barbeiros.all }),
      ])
    },
  })

  const inactivateLegacyBarberMutation = useMutation({
    mutationFn: async (barbeiro: BarbeiroWithIndicators) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      await inactivateLegacyBarbeiro(empresaId, barbeiro.id)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.barbeiros.all }),
        queryClient.invalidateQueries({ queryKey: ['atendimento-barbeiros'] }),
        queryClient.invalidateQueries({ queryKey: ['booking-barbers'] }),
      ])
    },
  })

  function openInviteModal() {
    if (
      barberLimitAccess.limit !== 'unlimited' &&
      typeof barberLimitAccess.limit === 'number' &&
      barbeiros.length >= barberLimitAccess.limit
    ) {
      setInviteError(
        `Seu plano atual permite até ${barberLimitAccess.limit} barbeiro. Faça upgrade para adicionar mais.`,
      )
      return
    }

    setInviteError(null)
    setLastInviteLink(null)
    invitationForm.reset(emptyInvitationValues())
    setIsInviteFormOpen(true)
  }

  function openEditModal(barbeiro: BarbeiroWithIndicators) {
    setEditingBarbeiro(barbeiro)
    setFormError(null)
    setIsFormOpen(true)
  }

  function openCreateUnavailabilityModal() {
    setEditingUnavailability(null)
    setUnavailabilityError(null)
    unavailabilityForm.reset(emptyUnavailabilityValues(barbeiros[0]?.id ?? ''))
    setIsUnavailabilityFormOpen(true)
  }

  function openEditUnavailabilityModal(block: BarberUnavailability) {
    setEditingUnavailability(block)
    setUnavailabilityError(null)
    setIsUnavailabilityFormOpen(true)
  }

  async function onSubmit(data: BarbeiroFormData) {
    setFormError(null)

    try {
      await saveMutation.mutateAsync(data)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o barbeiro.',
      )
    }
  }

  async function onSubmitUnavailability(data: BarberUnavailabilityFormData) {
    setUnavailabilityError(null)

    try {
      await saveUnavailabilityMutation.mutateAsync(data)
    } catch (error) {
      setUnavailabilityError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a indisponibilidade.',
      )
    }
  }

  async function onSubmitInvite(data: EmployeeInvitationFormData) {
    setInviteError(null)

    try {
      await createInvitationMutation.mutateAsync(data)
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : 'Não foi possível convidar.',
      )
    }
  }

  async function handleDeleteUnavailability(block: BarberUnavailability) {
    const shouldDelete = window.confirm(
      `Excluir o bloqueio de ${block.barbeiro?.nome ?? 'barbeiro'}?`,
    )

    if (!shouldDelete) {
      return
    }

    await deleteUnavailabilityMutation.mutateAsync(block)
  }

  async function handleCancelInvitation(invitation: EmployeeInvitation) {
    const shouldCancel = window.confirm(`Cancelar convite para ${invitation.email}?`)

    if (!shouldCancel) {
      return
    }

    await cancelInvitationMutation.mutateAsync(invitation)
  }

  async function copyToClipboard(text: string, successKey: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', 'true')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    setCopiedInviteId(successKey)
    window.setTimeout(() => setCopiedInviteId(null), 1800)
  }

  function getInviteLink(invitation: EmployeeInvitation) {
    return buildEmployeeInviteLink(invitation.token)
  }

  function getInviteMessage(invitation: EmployeeInvitation) {
    return buildEmployeeInviteMessage({
      barbershopName,
      link: getInviteLink(invitation),
    })
  }

  function openInviteLink(invitation: EmployeeInvitation) {
    window.open(getInviteLink(invitation), '_blank', 'noopener,noreferrer')
  }

  async function handleRegenerateInvitation(invitation: EmployeeInvitation) {
    await regenerateInvitationMutation.mutateAsync(invitation)
  }

  async function handleInactivateEmployee(link: EmployeeLink) {
    const shouldInactivate = window.confirm(
      [
        `Inativar ${link.employee?.nome ?? 'funcionário'}?`,
        'Atendimentos e comissões antigos seráo preservados.',
        'Agendamentos futuros deverao ser redistribuidos manualmente.',
      ].join('\n'),
    )

    if (!shouldInactivate) {
      return
    }

    await inactivateEmployeeMutation.mutateAsync(link)
  }

  async function handleInactivateLegacyBarber(barbeiro: BarbeiroWithIndicators) {
    const shouldInactivate = window.confirm(
      [
        `Remover ${barbeiro.nome} da equipe ativa?`,
        'O funcionário será inativado, mas atendimentos, comissões e relatórios antigos seráo preservados.',
        'Ele nao aparecera para novos agendamentos.',
      ].join('\n'),
    )

    if (!shouldInactivate) {
      return
    }

    await inactivateLegacyBarberMutation.mutateAsync(barbeiro)
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para gerenciar
            barbeiros.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-400">
            Barbeiros
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
            Equipe e comissões
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Convide funcionários, acompanhe desempenho e gerencie comissões
            respeitando o isolamento por empresa.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {canInviteEmployees && (
            <Button
              leftIcon={<Plus size={18} />}
              onClick={openInviteModal}
            >
              Convidar funcionário
            </Button>
          )}
        </div>
      </section>

      {inviteError && !isInviteFormOpen && (
        <Card>
          <CardContent>
            <p className="text-sm font-semibold text-red-600">{inviteError}</p>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Quantidade de atendimentos
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {totals.atendimentos}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Valor faturado
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {currencyFormatter.format(totals.faturamento)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Comissão acumulada
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {currencyFormatter.format(totals.comissao)}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Funcionários ativos
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {barbeiros.length} funcionário{barbeiros.length === 1 ? '' : 's'}{' '}
                vinculado{barbeiros.length === 1 ? '' : 's'}.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                size={16}
              />
              <input
                className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-brand-400 dark:focus:ring-brand-500/20"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar por nome ou telefone"
                value={searchTerm}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {barbeirosError && (
            <div className="p-5 text-sm text-red-600">
              {barbeirosError.message}
            </div>
          )}

          {isLoadingBarbeiros ? (
            <div className="flex min-h-56 items-center justify-center">
              <Loader2 className="animate-spin text-brand-500" size={28} />
            </div>
          ) : barbeiros.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <Scissors size={22} />
              </span>
              <p className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">
                Nenhum funcionário ativo encontrado
              </p>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Convide um funcionário ou ajuste a pesquisa.
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nome</TableHeaderCell>
                  <TableHeaderCell>Telefone</TableHeaderCell>
                  <TableHeaderCell>Comissão padrão</TableHeaderCell>
                  <TableHeaderCell>Atendimentos</TableHeaderCell>
                  <TableHeaderCell>Faturado</TableHeaderCell>
                  <TableHeaderCell>Comissão acumulada</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ações</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {barbeiros.map((barbeiro) => (
                  <TableRow key={barbeiro.id}>
                    <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                      {barbeiro.nome}
                    </TableCell>
                    <TableCell>
                      {barbeiro.telefone ? formatPhone(barbeiro.telefone) : '-'}
                    </TableCell>
                    <TableCell>{Number(barbeiro.percentual_comissao)}%</TableCell>
                    <TableCell>{barbeiro.atendimentos_count}</TableCell>
                    <TableCell>
                      {currencyFormatter.format(barbeiro.valor_faturado)}
                    </TableCell>
                    <TableCell>
                      {currencyFormatter.format(barbeiro.comissao_acumulada)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={barbeiro.status === 'ativo' ? 'success' : 'default'}
                      >
                        {barbeiro.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          aria-label="Editar funcionário"
                          size="icon-sm"
                          onClick={() => openEditModal(barbeiro)}
                          variant="ghost"
                        >
                          <Edit size={16} />
                        </Button>
                        {canManageUnavailability && (
                          <Button
                            aria-label="Remover funcionário da equipe ativa"
                            disabled={inactivateLegacyBarberMutation.isPending}
                            onClick={() => void handleInactivateLegacyBarber(barbeiro)}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              Funcionários e convites
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Convide funcionários para criarem a própria senha e preserve o
              histórico ao inativar.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Vínculos ativos
            </p>
            {employeeLinksQuery.isLoading ? (
              <div className="flex min-h-24 items-center justify-center">
                <Loader2 className="animate-spin text-brand-500" size={24} />
              </div>
            ) : employeeLinksQuery.data?.length ? (
              <div className="space-y-3">
                {employeeLinksQuery.data.map((link) => (
                  <div
                    className="flex flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    key={link.id}
                  >
                    <div>
                      <p className="font-black text-slate-950">
                        {link.employee?.nome ?? 'Funcionário'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {link.employee?.email ?? '-'} · {link.role}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={link.status === 'ativo' ? 'success' : 'default'}>
                        {link.status}
                      </Badge>
                      <Badge>{Number(link.commission_percentage)}%</Badge>
                      {canManageUnavailability && link.status === 'ativo' && (
                        <Button
                          onClick={() => void handleInactivateEmployee(link)}
                          size="sm"
                          variant="secondary"
                        >
                          Inativar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nenhum funcionário vinculado ainda.
              </p>
            )}
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Convites
            </p>
            {employeeInvitationsQuery.data?.length ? (
              <div className="space-y-3">
                {employeeInvitationsQuery.data.map((invitation) => {
                  const status = getInvitationStatus(invitation)
                  const inviteLink = getInviteLink(invitation)
                  const inviteMessage = getInviteMessage(invitation)
                  const canUseLink = status === 'pendente'
                  const canRegenerate = status === 'pendente' || status === 'expirado'

                  return (
                  <div
                    className="flex flex-col gap-4 rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900"
                    key={invitation.id}
                  >
                    <div>
                      <p className="font-black text-slate-950">
                        {invitation.nome}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {invitation.email} · {invitation.role}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          status === 'aceito'
                            ? 'success'
                            : status === 'cancelado' || status === 'expirado'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {status}
                      </Badge>
                      {canInviteEmployees &&
                        status === 'pendente' && (
                          <Button
                            disabled={cancelInvitationMutation.isPending}
                            onClick={() => void handleCancelInvitation(invitation)}
                            size="sm"
                            variant="secondary"
                          >
                            Cancelar convite
                          </Button>
                        )}
                    </div>

                    {canUseLink && (
                      <div className="rounded-2xl border border-brand-100 bg-white p-3 text-sm text-slate-600 dark:border-brand-400/20 dark:bg-slate-950 dark:text-slate-300">
                        <p className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
                          <MessageCircle size={16} />
                          Mensagem para WhatsApp
                        </p>
                        <p className="mt-2 leading-6">{inviteMessage}</p>
                        <p className="mt-2 break-all text-xs font-semibold text-brand-600 dark:text-brand-300">
                          {inviteLink}
                        </p>
                      </div>
                    )}

                    {canInviteEmployees && (
                      <div className="flex flex-wrap gap-2">
                        {canUseLink && (
                          <>
                            <Button
                              leftIcon={<Copy size={15} />}
                              onClick={() =>
                                void copyToClipboard(inviteLink, `${invitation.id}:link`)
                              }
                              size="sm"
                              variant="secondary"
                            >
                              {copiedInviteId === `${invitation.id}:link`
                                ? 'Link copiado'
                                : 'Copiar link'}
                            </Button>
                            <Button
                              leftIcon={<ExternalLink size={15} />}
                              onClick={() => openInviteLink(invitation)}
                              size="sm"
                              variant="secondary"
                            >
                              Abrir link
                            </Button>
                          </>
                        )}
                        {canRegenerate && (
                          <Button
                            disabled={regenerateInvitationMutation.isPending}
                            leftIcon={<RefreshCw size={15} />}
                            onClick={() => void handleRegenerateInvitation(invitation)}
                            size="sm"
                            variant="secondary"
                          >
                            Regerar link
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nenhum convite enviado ainda.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Indisponibilidades
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Bloqueie dias inteiros ou intervalos especificos dos barbeiros.
              </p>
            </div>

            {canManageUnavailability && (
              <Button
                leftIcon={<CalendarOff size={18} />}
                onClick={openCreateUnavailabilityModal}
                variant="secondary"
              >
                Criar bloqueio
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {unavailabilityQueryError && (
            <div className="p-5 text-sm text-red-600">
              {unavailabilityQueryError.message}
            </div>
          )}

          {isLoadingUnavailability ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="animate-spin text-brand-500" size={26} />
            </div>
          ) : unavailability.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <CalendarOff size={22} />
              </span>
              <p className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">
                Nenhum bloqueio cadastrado
              </p>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Crie indisponibilidades para impedir agendamentos em folgas,
                ferias ou compromissos.
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Barbeiro</TableHeaderCell>
                  <TableHeaderCell>Data</TableHeaderCell>
                  <TableHeaderCell>Horário</TableHeaderCell>
                  <TableHeaderCell>Motivo</TableHeaderCell>
                  <TableHeaderCell>Criado por</TableHeaderCell>
                  {canManageUnavailability && (
                    <TableHeaderCell className="text-right">
                      Acoes
                    </TableHeaderCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {unavailability.map((block) => (
                  <TableRow key={block.id}>
                    <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                      {block.barbeiro?.nome ?? 'Barbeiro'}
                    </TableCell>
                    <TableCell>
                      {dateFormatter.format(new Date(`${block.date}T00:00:00`))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={block.all_day ? 'danger' : 'warning'}>
                        {formatBlockTime(block)}
                      </Badge>
                    </TableCell>
                    <TableCell>{block.reason}</TableCell>
                    <TableCell>{block.criado_por?.nome ?? '-'}</TableCell>
                    {canManageUnavailability && (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            aria-label="Editar bloqueio"
                            onClick={() => openEditUnavailabilityModal(block)}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            aria-label="Excluir bloqueio"
                            disabled={deleteUnavailabilityMutation.isPending}
                            onClick={() => void handleDeleteUnavailability(block)}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Editar funcionário"
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {formError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <Input
            error={errors.nome?.message}
            label="Nome"
            placeholder="Joao Silva"
            {...register('nome')}
          />

          <Input
            error={errors.telefone?.message}
            inputMode="numeric"
            label="Telefone"
            placeholder="(99) 9 9999-9999"
            autoComplete="tel"
            {...register('telefone', {
              onChange: maskPhoneChange,
            })}
          />

          <Input
            error={errors.percentual_comissao?.message}
            label="Comissão padrão (%)"
            max={100}
            min={0}
            step="0.01"
            type="number"
            {...register('percentual_comissao')}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setIsFormOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={isSubmitting || saveMutation.isPending} type="submit">
              {saveMutation.isPending ? 'Salvando...' : 'Salvar funcionário'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isInviteFormOpen}
        onClose={() => setIsInviteFormOpen(false)}
        title="Convidar funcionário"
      >
        <form
          className="space-y-4"
          onSubmit={invitationForm.handleSubmit(onSubmitInvite)}
        >
          {inviteError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {inviteError}
            </p>
          )}

          {lastInviteLink && (
            <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/70 p-4 dark:border-brand-400/20 dark:bg-brand-400/10">
              <p className="text-sm font-semibold text-slate-950">
                Convite criado
              </p>
              <Badge variant="warning">Pendente</Badge>
              <p className="mt-2 break-all text-sm text-brand-700">
                {lastInviteLink}
              </p>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {buildEmployeeInviteMessage({
                  barbershopName,
                  link: lastInviteLink,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  leftIcon={<Copy size={15} />}
                  onClick={() => void copyToClipboard(lastInviteLink, 'last-link')}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {copiedInviteId === 'last-link' ? 'Link copiado' : 'Copiar link'}
                </Button>
                <Button
                  leftIcon={<ExternalLink size={15} />}
                  onClick={() => window.open(lastInviteLink, '_blank', 'noopener,noreferrer')}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Abrir link
                </Button>
              </div>
            </div>
          )}

          <Input
            error={invitationForm.formState.errors.nome?.message}
            label="Nome"
            placeholder="Joao Silva"
            {...invitationForm.register('nome')}
          />
          <Input
            error={invitationForm.formState.errors.email?.message}
            label="E-mail"
            placeholder="exemplo@exemplo.com"
            type="email"
            {...invitationForm.register('email')}
          />
          <Input
            error={invitationForm.formState.errors.telefone?.message}
            inputMode="numeric"
            label="Telefone"
            placeholder="(99) 9 9999-9999"
            autoComplete="tel"
            {...invitationForm.register('telefone', {
              onChange: maskPhoneChange,
            })}
          />
          <Select
            error={invitationForm.formState.errors.role?.message}
            label="Funcao"
            options={employeeRoleOptions.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
            {...invitationForm.register('role')}
          />
          <Input
            error={invitationForm.formState.errors.commission_percentage?.message}
            label="Comissão padrão (%)"
            max={100}
            min={0}
            step="0.01"
            type="number"
            {...invitationForm.register('commission_percentage')}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setIsInviteFormOpen(false)}
              type="button"
              variant="secondary"
            >
              Fechar
            </Button>
            <Button
              disabled={
                invitationForm.formState.isSubmitting ||
                createInvitationMutation.isPending
              }
              type="submit"
            >
              {createInvitationMutation.isPending
                ? 'Criando...'
                : 'Gerar convite'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isUnavailabilityFormOpen}
        onClose={() => setIsUnavailabilityFormOpen(false)}
        title={
          editingUnavailability
            ? 'Editar indisponibilidade'
            : 'Criar indisponibilidade'
        }
      >
        <form
          className="space-y-4"
          onSubmit={unavailabilityForm.handleSubmit(onSubmitUnavailability)}
        >
          {unavailabilityError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {unavailabilityError}
            </p>
          )}

          <Select
            error={unavailabilityForm.formState.errors.barber_id?.message}
            label="Barbeiro"
            options={[
              { label: 'Selecione', value: '' },
              ...barbeiros.map((barbeiro) => ({
                label: barbeiro.nome,
                value: barbeiro.id,
              })),
            ]}
            {...unavailabilityForm.register('barber_id')}
          />

          <Input
            error={unavailabilityForm.formState.errors.date?.message}
            label="Data"
            min={todayInputValue()}
            type="date"
            {...unavailabilityForm.register('date')}
          />

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              type="checkbox"
              {...unavailabilityForm.register('all_day')}
            />
            Dia inteiro
          </label>

          {!isAllDay && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                error={unavailabilityForm.formState.errors.start_time?.message}
                label="Hora inicio"
                type="time"
                {...unavailabilityForm.register('start_time')}
              />
              <Input
                error={unavailabilityForm.formState.errors.end_time?.message}
                label="Hora fim"
                type="time"
                {...unavailabilityForm.register('end_time')}
              />
            </div>
          )}

          <Select
            error={unavailabilityForm.formState.errors.reason?.message}
            label="Motivo"
            options={barberUnavailabilityReasons.map((reason) => ({
              label: reason,
              value: reason,
            }))}
            {...unavailabilityForm.register('reason')}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setIsUnavailabilityFormOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              disabled={
                unavailabilityForm.formState.isSubmitting ||
                saveUnavailabilityMutation.isPending
              }
              type="submit"
            >
              {saveUnavailabilityMutation.isPending
                ? 'Salvando...'
                : 'Salvar bloqueio'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
