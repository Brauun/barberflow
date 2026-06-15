import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  ChevronRight,
  ClipboardList,
  Download,
  FileJson,
  ImagePlus,
  Monitor,
  Moon,
  Paintbrush,
  Save,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { canExportData } from '../auth/permissions'
import { Button, Card, CardContent, CardHeader, Input, Select } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { queryKeys } from '../lib/queryKeys'
import {
  getAppointmentAutomationSettings,
  saveAppointmentAutomationSettings,
  updateEmpresaSettings,
  updateUserProfile,
  type AppointmentAutomationSettings,
} from '../services/configuracoesService'
import {
  exportAtendimentosCsv,
  exportClientesCsv,
  exportEmpresaJson,
  exportFinanceiroCsv,
  exportProdutosCsv,
} from '../services/backupService'
import { listAuditLogs, type AuditLog } from '../services/observabilityService'
import { lookupCep } from '../services/cepService'
import {
  defaultBusinessHours,
  listBusinessHours,
  saveBusinessHours,
} from '../services/businessHoursService'
import {
  resolveAssetUrl,
  uploadCompanyLogo,
  uploadUserAvatar,
} from '../services/assetsService'
import {
  empresaSettingsSchema,
  userProfileSchema,
  type EmpresaSettingsFormData,
  type EmpresaSettingsFormInput,
  type UserProfileFormData,
  type UserProfileFormInput,
} from '../types/configuracoes'
import {
  businessHoursSchema,
  type BusinessHourFormData,
  weekDays,
} from '../types/businessHours'
import {
  formatCep,
  formatCnpj,
  formatCpf,
  formatPhone,
  maskCepChange,
  maskCnpjChange,
  maskCpfChange,
  maskPhoneChange,
  onlyDigits,
} from '../utils/masks'
import { handleAppError } from '../utils/handleAppError'

type SettingsRowProps = {
  description: string
  icon: ReactNode
  title: string
  value?: string
}

const roleLabels: Record<string, string> = {
  administrador: 'Administrador',
  barbeiro: 'Barbeiro',
  gerente: 'Gerente',
  recepcao: 'Recepcao',
}

const auditActionLabels: Record<string, string> = {
  atendimento_cancelado: 'Atendimento cancelado',
  atendimento_concluido: 'Atendimento concluído',
  atendimento_remarcado: 'Atendimento remarcado',
  convite_funcionario: 'Convite de funcionário',
  despesa_criada: 'Despesa criada',
  empresa_atualizada: 'Empresa atualizada',
  exportacao_dados: 'Exportação de dados',
  exportacao_dados_completa: 'Exportação completa',
  funcionario_inativado: 'Funcionário inativado',
  login: 'Login',
  logout: 'Logout',
  movimentacao_criada: 'Movimentação financeira',
  servico_criado: 'Serviço criado',
  servico_editado: 'Serviço editado',
  servico_inativado: 'Serviço inativado',
}

const auditDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

type CompactTimeInputProps = {
  disabled?: boolean
  label?: string
  onChange: (value: string) => void
  value: string
}

function CompactTimeInput({ disabled, label, onChange, value }: CompactTimeInputProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-0.5 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </span>
      )}
      <input
        className="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-base tabular-nums text-slate-950 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100/80 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 sm:h-8 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:disabled:bg-slate-800/50"
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        type="time"
        value={value}
      />
    </label>
  )
}

function SettingsRow({ description, icon, title, value }: SettingsRowProps) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-[1.1rem] border border-slate-200/70 bg-white p-3 shadow-[0_12px_44px_rgb(15_23_42/0.025)] transition duration-200 hover:border-slate-300 sm:rounded-[1.35rem] sm:p-4 sm:hover:-translate-y-0.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-600">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-slate-950">{title}</p>
          {value && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
              {value}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <ChevronRight className="shrink-0 text-slate-300" size={18} />
    </div>
  )
}

function auditLabel(log: AuditLog) {
  return auditActionLabels[log.action] ?? log.action
}

export function ConfiguracoesPage() {
  const { profile, refreshProfile } = useAuth()
  const { resolvedTheme, setTheme, theme } = useTheme()
  const queryClient = useQueryClient()
  const [empresaError, setEmpresaError] = useState<string | null>(null)
  const [perfilError, setPerfilError] = useState<string | null>(null)
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null)
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [businessHours, setBusinessHours] = useState<BusinessHourFormData[]>(
    () => defaultBusinessHours(),
  )
  const [businessHoursError, setBusinessHoursError] = useState<string | null>(
    null,
  )
  const [appointmentAutomation, setAppointmentAutomation] =
    useState<AppointmentAutomationSettings>({
      after_minutes: 60,
      allow_reversal: true,
      enabled: true,
      reversal_hours: 24,
    })
  const [appointmentAutomationError, setAppointmentAutomationError] =
    useState<string | null>(null)
  const [cepStatus, setCepStatus] = useState<string | null>(null)
  const lastCepLookupRef = useRef('')

  const empresaId = profile?.empresa_id
  const empresa = profile?.empresa
  const isAdmin = canExportData(profile?.papel)

  const empresaForm = useForm<
    EmpresaSettingsFormInput,
    unknown,
    EmpresaSettingsFormData
  >({
    resolver: zodResolver(empresaSettingsSchema),
  })

  const perfilForm = useForm<
    UserProfileFormInput,
    unknown,
    UserProfileFormData
  >({
    resolver: zodResolver(userProfileSchema),
  })

  const watchedLogoUrl = useWatch({
    control: empresaForm.control,
    name: 'logo_url',
  })
  const watchedAvatarUrl = useWatch({
    control: perfilForm.control,
    name: 'avatar_url',
  })
  const watchedCep = useWatch({
    control: empresaForm.control,
    name: 'cep',
  })
  const watchedTipoPessoa = useWatch({
    control: empresaForm.control,
    name: 'tipo_pessoa',
  })

  const businessHoursQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listBusinessHours(empresaId as string),
    queryKey: ['business-hours', empresaId],
  })

  const appointmentAutomationQuery = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => getAppointmentAutomationSettings(empresaId as string),
    queryKey: ['appointment-automation-settings', empresaId],
  })

  const auditLogsQuery = useQuery({
    enabled: Boolean(empresaId && isAdmin),
    queryFn: () => listAuditLogs(empresaId as string),
    queryKey: queryKeys.configuracoes.auditLogs(empresaId),
  })

  useEffect(() => {
    empresaForm.reset({
      bairro: empresa?.bairro ?? '',
      cep: formatCep(empresa?.cep),
      cidade: empresa?.cidade ?? '',
      complemento: empresa?.complemento ?? '',
      cpf_cnpj:
        empresa?.tipo_pessoa === 'pj'
          ? formatCnpj(empresa?.cpf_cnpj)
          : formatCpf(empresa?.cpf_cnpj),
      email: empresa?.email ?? '',
      email_financeiro: empresa?.email_financeiro ?? empresa?.email ?? '',
      endereco: empresa?.endereco ?? '',
      estado: empresa?.estado ?? '',
      latitude: empresa?.latitude ?? null,
      logradouro: empresa?.logradouro ?? empresa?.rua ?? '',
      logo_url: empresa?.logo_url ?? '',
      longitude: empresa?.longitude ?? null,
      nome: empresa?.nome ?? '',
      nome_fantasia: empresa?.nome_fantasia ?? '',
      numero: empresa?.numero ?? '',
      percentual_comissao_padrao: empresa?.percentual_comissao_padrao ?? 60,
      razao_social: empresa?.razao_social ?? '',
      responsavel_cpf: formatCpf(empresa?.responsavel_cpf),
      responsavel_nome: empresa?.responsavel_nome ?? '',
      rua: empresa?.rua ?? '',
      telefone: formatPhone(empresa?.telefone),
      tipo_pessoa: empresa?.tipo_pessoa === 'pj' ? 'pj' : 'pf',
      uf: empresa?.uf ?? empresa?.estado ?? '',
    })
  }, [empresa, empresaForm])

  useEffect(() => {
    const cep = onlyDigits(watchedCep)

    if (cep.length !== 8) {
      lastCepLookupRef.current = ''
      queueMicrotask(() => setCepStatus(null))
      return
    }

    if (lastCepLookupRef.current === cep) {
      return
    }

    let active = true
    lastCepLookupRef.current = cep
    queueMicrotask(() => setCepStatus('Consultando CEP...'))

    const timeoutId = window.setTimeout(() => {
      void lookupCep(cep)
        .then((address) => {
          if (!active) {
            return
          }

          empresaForm.setValue('cep', formatCep(address.cep), {
            shouldDirty: true,
          })
          empresaForm.setValue('cidade', address.cidade, {
            shouldDirty: true,
            shouldValidate: true,
          })
          empresaForm.setValue('estado', address.estado, {
            shouldDirty: true,
            shouldValidate: true,
          })
          empresaForm.setValue('uf', address.estado, {
            shouldDirty: true,
            shouldValidate: true,
          })

          if (address.rua) {
            empresaForm.setValue('rua', address.rua, { shouldDirty: true })
            empresaForm.setValue('logradouro', address.rua, {
              shouldDirty: true,
            })
          }

          if (address.bairro) {
            empresaForm.setValue('bairro', address.bairro, {
              shouldDirty: true,
            })
          }

          setCepStatus('Cidade e estado preenchidos pelo CEP.')
        })
        .catch((error) => {
          if (active) {
            setCepStatus(
              error instanceof Error
                ? error.message
                : 'Não foi possível consultar o CEP.',
            )
          }
        })
    }, 350)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [empresaForm, watchedCep])

  useEffect(() => {
    let active = true

    if (companyLogoFile) {
      return undefined
    }

    void resolveAssetUrl('company-assets', empresa?.logo_url).then((url) => {
      if (active) {
        setCompanyLogoPreview(url)
      }
    })

    return () => {
      active = false
    }
  }, [companyLogoFile, empresa?.logo_url])

  useEffect(() => {
    perfilForm.reset({
      avatar_url: profile?.avatar_url ?? '',
      nome: profile?.nome ?? '',
      telefone: formatPhone(profile?.telefone),
    })
  }, [perfilForm, profile])

  useEffect(() => {
    let active = true

    if (avatarFile) {
      return undefined
    }

    void resolveAssetUrl('user-avatars', profile?.avatar_url).then((url) => {
      if (active) {
        setAvatarPreview(url)
      }
    })

    return () => {
      active = false
    }
  }, [avatarFile, profile?.avatar_url])

  useEffect(() => {
    const storedHours = businessHoursQuery.data

    if (!storedHours) {
      return
    }

    if (storedHours.length === 0) {
      queueMicrotask(() => setBusinessHours(defaultBusinessHours()))
      return
    }

    const storedByDay = new Map(
      storedHours.map((hour) => [hour.day_of_week, hour]),
    )

    const nextHours = defaultBusinessHours().map((defaultHour) => {
      const stored = storedByDay.get(defaultHour.day_of_week)

      if (!stored) {
        return defaultHour
      }

      return {
        break_end: stored.break_end ?? '',
        break_start: stored.break_start ?? '',
        close_time: stored.close_time ?? '',
        day_of_week: stored.day_of_week,
        is_open: stored.is_open,
        open_time: stored.open_time ?? '',
      }
    })

    queueMicrotask(() => setBusinessHours(nextHours))
  }, [businessHoursQuery.data])

  useEffect(() => {
    if (appointmentAutomationQuery.data) {
      queueMicrotask(() =>
        setAppointmentAutomation(appointmentAutomationQuery.data),
      )
    }
  }, [appointmentAutomationQuery.data])

  const empresaMutation = useMutation({
    mutationFn: async (data: EmpresaSettingsFormData) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      await updateEmpresaSettings(empresaId, data)
    },
    onSuccess: async () => {
      await refreshProfile()
      await queryClient.invalidateQueries()
      setEmpresaError(null)
    },
  })

  const perfilMutation = useMutation({
    mutationFn: async (data: UserProfileFormData) => {
      if (!empresaId || !profile?.id) {
        throw new Error('Perfil não encontrado.')
      }

      await updateUserProfile(empresaId, profile.id, data)
    },
    onSuccess: async () => {
      await refreshProfile()
      setPerfilError(null)
    },
  })

  const businessHoursMutation = useMutation({
    mutationFn: async () => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      const parsedHours = businessHoursSchema.parse(businessHours)

      await saveBusinessHours(empresaId, parsedHours)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['business-hours'] })
      setBusinessHoursError(null)
    },
  })

  const appointmentAutomationMutation = useMutation({
    mutationFn: async () => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      await saveAppointmentAutomationSettings(empresaId, appointmentAutomation)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['appointment-automation-settings'],
      })
      setAppointmentAutomationError(null)
    },
  })

  const exportMutation = useMutation({
    mutationFn: async (kind: 'atendimentos' | 'clientes' | 'financeiro' | 'produtos' | 'completo') => {
      if (!empresaId || !isAdmin) {
        throw new Error('Apenas administradores podem exportar dados.')
      }

      if (kind === 'clientes') {
        await exportClientesCsv(empresaId)
        return
      }

      if (kind === 'atendimentos') {
        await exportAtendimentosCsv(empresaId)
        return
      }

      if (kind === 'financeiro') {
        await exportFinanceiroCsv(empresaId)
        return
      }

      if (kind === 'produtos') {
        await exportProdutosCsv(empresaId)
        return
      }

      await exportEmpresaJson(empresaId)
    },
    onError: async (error) => {
      setEmpresaError(
        await handleAppError({
          area: 'backup_exportação',
          empresaId,
          error,
        }),
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.configuracoes.auditLogsAll,
      })
    },
  })

  async function onSubmitEmpresa(data: EmpresaSettingsFormData) {
    setEmpresaError(null)

    try {
      let logoUrl = data.logo_url

      if (empresaId && companyLogoFile) {
        logoUrl = await uploadCompanyLogo(empresaId, companyLogoFile)
      }

      await empresaMutation.mutateAsync({ ...data, logo_url: logoUrl })
      setCompanyLogoFile(null)
    } catch (error) {
      setEmpresaError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a empresa.',
      )
    }
  }

  async function onSubmitPerfil(data: UserProfileFormData) {
    setPerfilError(null)

    try {
      let avatarUrl = data.avatar_url

      if (profile?.id && avatarFile) {
        avatarUrl = await uploadUserAvatar(profile.id, avatarFile)
      }

      await perfilMutation.mutateAsync({ ...data, avatar_url: avatarUrl })
      setAvatarFile(null)
    } catch (error) {
      setPerfilError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o perfil.',
      )
    }
  }

  function removeCompanyLogo() {
    setCompanyLogoFile(null)
    setCompanyLogoPreview(null)
    empresaForm.setValue('logo_url', '')
  }

  function removeAvatar() {
    setAvatarFile(null)
    setAvatarPreview(null)
    perfilForm.setValue('avatar_url', '')
  }

  function updateBusinessHour(
    dayOfWeek: number,
    patch: Partial<BusinessHourFormData>,
  ) {
    setBusinessHours((current) =>
      current.map((hour) =>
        hour.day_of_week === dayOfWeek ? { ...hour, ...patch } : hour,
      ),
    )
  }

  function copyWeekdayHours() {
    const monday = businessHours.find((hour) => hour.day_of_week === 1)

    if (!monday) {
      return
    }

    setBusinessHours((current) =>
      current.map((hour) =>
        hour.day_of_week >= 1 && hour.day_of_week <= 5
          ? {
              ...hour,
              break_end: monday.break_end,
              break_start: monday.break_start,
              close_time: monday.close_time,
              is_open: monday.is_open,
              open_time: monday.open_time,
            }
          : hour,
      ),
    )
  }

  async function handleSaveBusinessHours() {
    setBusinessHoursError(null)

    try {
      await businessHoursMutation.mutateAsync()
    } catch (error) {
      setBusinessHoursError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar os horários.',
      )
    }
  }

  async function handleSaveAppointmentAutomation() {
    setAppointmentAutomationError(null)

    try {
      await appointmentAutomationMutation.mutateAsync()
    } catch (error) {
      setAppointmentAutomationError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a automação de atendimentos.',
      )
    }
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para acessar as
            configurações.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden pb-[env(safe-area-inset-bottom)] sm:space-y-6">
      <section className="min-w-0">
        <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-400">
          Configurações
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
          Empresa, perfil e tema
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Atualize os dados da barbearia, comissão padrão, aparência do sistema
          e informações do usuário.
        </p>
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
            Central de ajustes
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Atalhos visuais para empresa, perfil e aparencia.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              Empresa
            </p>
            <div className="space-y-3">
              <SettingsRow
                description={
                  empresa?.telefone
                    ? formatPhone(empresa.telefone)
                    : 'Telefone não informado'
                }
                icon={<Building2 size={19} />}
                title={empresa?.nome ?? 'Barbearia'}
                value={empresa?.email ?? 'Email não informado'}
              />
              <SettingsRow
                description={empresa?.endereco ?? 'Endereço não informado'}
                icon={<Save size={19} />}
                title="Comissão padrão"
                value={`${empresa?.percentual_comissao_padrao ?? 60}%`}
              />
            </div>
          </div>

          <div>
            <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              Sistema
            </p>
            <div className="space-y-3">
              <SettingsRow
                description="Preferência visual aplicada ao app"
                icon={<Paintbrush size={19} />}
                title="Tema"
                value={
                  theme === 'system'
                    ? `Sistema (${resolvedTheme === 'light' ? 'claro' : 'escuro'})`
                    : theme === 'light'
                      ? 'Claro'
                      : 'Escuro'
                }
              />
              <SettingsRow
                description={
                  profile?.telefone
                    ? formatPhone(profile.telefone)
                    : 'Telefone não informado'
                }
                icon={<UserRound size={19} />}
                title={profile?.nome ?? 'Usuário'}
                value={profile?.papel ? roleLabels[profile.papel] ?? profile.papel : 'Perfil'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Download
                  className="text-brand-600 dark:text-brand-400"
                  size={22}
                />
                <div>
                  <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                    Backup e exportação
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Exporte dados da sua empresa sem senhas ou tokens sensíveis.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Button
                className="border-slate-200 bg-white text-slate-950 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-transparent dark:bg-slate-950 dark:text-white dark:hover:border-transparent dark:hover:bg-slate-900"
                disabled={exportMutation.isPending}
                leftIcon={<Download size={18} />}
                onClick={() => exportMutation.mutate('clientes')}
                type="button"
                variant="secondary"
              >
                Exportar clientes
              </Button>
              <Button
                className="border-slate-200 bg-white text-slate-950 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-transparent dark:bg-slate-950 dark:text-white dark:hover:border-transparent dark:hover:bg-slate-900"
                disabled={exportMutation.isPending}
                leftIcon={<Download size={18} />}
                onClick={() => exportMutation.mutate('financeiro')}
                type="button"
                variant="secondary"
              >
                Exportar financeiro
              </Button>
              <Button
                className="border-slate-200 bg-white text-slate-950 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-transparent dark:bg-slate-950 dark:text-white dark:hover:border-transparent dark:hover:bg-slate-900"
                disabled={exportMutation.isPending}
                leftIcon={<Download size={18} />}
                onClick={() => exportMutation.mutate('atendimentos')}
                type="button"
                variant="secondary"
              >
                Exportar atendimentos
              </Button>
              <Button
                className="border-slate-200 bg-white text-slate-950 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-transparent dark:bg-slate-950 dark:text-white dark:hover:border-transparent dark:hover:bg-slate-900"
                disabled={exportMutation.isPending}
                leftIcon={<Download size={18} />}
                onClick={() => exportMutation.mutate('produtos')}
                type="button"
                variant="secondary"
              >
                Exportar produtos
              </Button>
              <div className="min-w-0 sm:col-span-2">
                <Button
                  className="w-full border-transparent bg-slate-950 text-white hover:border-transparent hover:bg-slate-800 sm:w-auto dark:border-transparent dark:bg-white dark:text-slate-950 dark:hover:border-transparent dark:hover:bg-slate-200"
                  disabled={exportMutation.isPending}
                  leftIcon={<FileJson size={18} />}
                  onClick={() => exportMutation.mutate('completo')}
                  type="button"
                >
                  {exportMutation.isPending
                    ? 'Preparando exportação...'
                    : 'Exportar dados da empresa'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <ClipboardList
                  className="text-brand-600 dark:text-brand-400"
                  size={22}
                />
                <div>
                  <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                    Auditoria
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Últimas ações sensíveis registradas no sistema.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {auditLogsQuery.isLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Carregando auditoria...
                </p>
              ) : auditLogsQuery.data?.length ? (
                <div className="max-h-80 min-w-0 space-y-2 overflow-y-auto pr-1">
                  {auditLogsQuery.data.slice(0, 12).map((log) => (
                    <div
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/70"
                      key={log.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-black text-slate-950 dark:text-slate-50">
                          {auditLabel(log)}
                        </p>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {auditDateFormatter.format(new Date(log.created_at))}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {log.entity_type}
                        {log.entity_id ? ` #${log.entity_id}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                  Nenhum evento de auditoria registrado ainda.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
  <CardHeader>
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
          Horários de funcionamento
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Dias, expediente e pausas que liberam a agenda.
        </p>
      </div>
      <div className="grid w-full gap-2 sm:flex sm:w-auto">
        <Button
          className="w-full border-slate-200 bg-white text-slate-950 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 sm:w-auto dark:border-transparent dark:bg-slate-950 dark:text-white dark:hover:border-transparent dark:hover:bg-slate-900"
          onClick={copyWeekdayHours}
          type="button"
          variant="secondary"
        >
          Seg → Sex
        </Button>
        <Button
          className="w-full border-transparent bg-slate-950 text-white hover:border-transparent hover:bg-slate-800 sm:w-auto dark:border-transparent dark:bg-white dark:text-slate-950 dark:hover:border-transparent dark:hover:bg-slate-200"
          disabled={businessHoursMutation.isPending}
          onClick={() => void handleSaveBusinessHours()}
          type="button"
        >
          {businessHoursMutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  </CardHeader>

  <CardContent className="min-w-0 space-y-1.5">
    {businessHoursError && (
      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        {businessHoursError}
      </p>
    )}
    {businessHoursMutation.isSuccess && (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        Horários salvos com sucesso.
      </p>
    )}

    {/* Cabeçalho das colunas — visível apenas em telas médias+ */}
    <div className="hidden min-w-0 grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-x-2 px-2 sm:grid">
      <span />
      <span className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">Abertura</span>
      <span className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">Fechamento</span>
      <span className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">Intervalo</span>
      <span className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">Fim intervalo</span>
      <span />
    </div>

    {weekDays.map((day) => {
      const hour =
        businessHours.find((item) => item.day_of_week === day.value) ??
        defaultBusinessHours()[day.value]

      return (
        <div
          key={day.value}
          className={[
            'min-w-0 rounded-2xl border px-3 py-2.5 transition-colors',
            hour.is_open
              ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60'
              : 'border-slate-100 bg-slate-50/60 dark:border-slate-800/60 dark:bg-slate-900/30',
          ].join(' ')}
        >
          {/* Layout mobile: empilhado */}
          <div className="flex items-center justify-between sm:hidden">
            <div>
              <p className="text-sm font-bold text-slate-950 dark:text-slate-50">
                {day.label}
              </p>
              {hour.is_open && (
                <p className="mt-0.5 text-[0.7rem] tabular-nums text-slate-500">
                  {hour.open_time} – {hour.close_time}
                  {hour.break_start && (
                    <span className="ml-1 text-slate-400">
                      · {hour.break_start}–{hour.break_end}
                    </span>
                  )}
                </p>
              )}
            </div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <input
                checked={hour.is_open}
                className="h-3.5 w-3.5 accent-brand-500"
                onChange={(e) =>
                  updateBusinessHour(day.value, { is_open: e.target.checked })
                }
                type="checkbox"
              />
              {hour.is_open ? 'Aberto' : 'Fechado'}
            </label>
          </div>

          {/* Expandido no mobile quando aberto */}
          {hour.is_open && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
              <CompactTimeInput
                label="Abertura"
                disabled={!hour.is_open}
                value={hour.open_time ?? ''}
                onChange={(v) => updateBusinessHour(day.value, { open_time: v })}
              />
              <CompactTimeInput
                label="Fechamento"
                disabled={!hour.is_open}
                value={hour.close_time ?? ''}
                onChange={(v) => updateBusinessHour(day.value, { close_time: v })}
              />
              <CompactTimeInput
                label="Intervalo"
                disabled={!hour.is_open}
                value={hour.break_start ?? ''}
                onChange={(v) => updateBusinessHour(day.value, { break_start: v })}
              />
              <CompactTimeInput
                label="Fim intervalo"
                disabled={!hour.is_open}
                value={hour.break_end ?? ''}
                onChange={(v) => updateBusinessHour(day.value, { break_end: v })}
              />
            </div>
          )}

          {/* Layout desktop: linha única */}
          <div className="hidden min-w-0 grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-x-2 sm:grid">
            <p className="text-sm font-bold text-slate-950 dark:text-slate-50">
              {day.label}
            </p>
            <CompactTimeInput
              disabled={!hour.is_open}
              value={hour.open_time ?? ''}
              onChange={(v) => updateBusinessHour(day.value, { open_time: v })}
            />
            <CompactTimeInput
              disabled={!hour.is_open}
              value={hour.close_time ?? ''}
              onChange={(v) => updateBusinessHour(day.value, { close_time: v })}
            />
            <CompactTimeInput
              disabled={!hour.is_open}
              value={hour.break_start ?? ''}
              onChange={(v) => updateBusinessHour(day.value, { break_start: v })}
            />
            <CompactTimeInput
              disabled={!hour.is_open}
              value={hour.break_end ?? ''}
              onChange={(v) => updateBusinessHour(day.value, { break_end: v })}
            />
            <label className="flex items-center justify-center">
              <input
                checked={hour.is_open}
                className="h-3.5 w-3.5 accent-brand-500"
                onChange={(e) =>
                  updateBusinessHour(day.value, { is_open: e.target.checked })
                }
                type="checkbox"
              />
            </label>
          </div>
        </div>
      )
    })}
  </CardContent>
</Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Automação de atendimentos
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Defina quando o sistema conclui atendimentos esquecidos e por
                quanto tempo eles podem ser corrigidos.
              </p>
            </div>
            <Button
              className="w-full border-transparent bg-slate-950 text-white hover:border-transparent hover:bg-slate-800 sm:w-auto dark:border-transparent dark:bg-white dark:text-slate-950 dark:hover:border-transparent dark:hover:bg-slate-200"
              disabled={appointmentAutomationMutation.isPending}
              onClick={() => void handleSaveAppointmentAutomation()}
              type="button"
            >
              {appointmentAutomationMutation.isPending
                ? 'Salvando...'
                : 'Salvar automação'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {appointmentAutomationError && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
              {appointmentAutomationError}
            </p>
          )}
          {appointmentAutomationMutation.isSuccess && (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              Automação salva com sucesso.
            </p>
          )}
          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <Select
              label="Finalização automatica"
              onChange={(event) => {
                const value = event.target.value

                setAppointmentAutomation((current) => ({
                  ...current,
                  after_minutes:
                    value === 'off' ? current.after_minutes : Number(value),
                  enabled: value !== 'off',
                }))
              }}
              options={[
                { label: 'Desativado', value: 'off' },
                { label: '30 minutos após fim', value: '30' },
                { label: '1 hora após fim', value: '60' },
                { label: '2 horas após fim', value: '120' },
                { label: '4 horas após fim', value: '240' },
              ]}
              value={
                appointmentAutomation.enabled
                  ? String(appointmentAutomation.after_minutes)
                  : 'off'
              }
            />
            <Select
              label="Permitir correcao"
              onChange={(event) =>
                setAppointmentAutomation((current) => ({
                  ...current,
                  allow_reversal: event.target.value === 'true',
                }))
              }
              options={[
                { label: 'Sim', value: 'true' },
                { label: 'Não', value: 'false' },
              ]}
              value={String(appointmentAutomation.allow_reversal)}
            />
            <Select
              disabled={!appointmentAutomation.allow_reversal}
              label="Prazo para correcao"
              onChange={(event) =>
                setAppointmentAutomation((current) => ({
                  ...current,
                  reversal_hours: Number(event.target.value),
                }))
              }
              options={[
                { label: '12 horas', value: '12' },
                { label: '24 horas', value: '24' },
                { label: '48 horas', value: '48' },
              ]}
              value={String(appointmentAutomation.reversal_hours)}
            />
          </div>
          {appointmentAutomationQuery.isLoading && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Carregando configuração de atendimentos...
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="text-brand-600 dark:text-brand-400" size={22} />
              <div>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  Dados da empresa
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Informações principais da barbearia.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={empresaForm.handleSubmit(onSubmitEmpresa)}
            >
              {empresaError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {empresaError}
                </p>
              )}

              <Input
                error={empresaForm.formState.errors.nome?.message}
                label="Nome da barbearia"
                placeholder="Nome da barbearia"
                {...empresaForm.register('nome')}
              />

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Input
                  error={empresaForm.formState.errors.telefone?.message}
                  inputMode="numeric"
                  label="Telefone"
                  placeholder="(99) 9 9999-9999"
                  autoComplete="tel"
                  {...empresaForm.register('telefone', {
                    onChange: maskPhoneChange,
                  })}
                />
                <Input
                  error={empresaForm.formState.errors.email?.message}
                  label="Email"
                  placeholder="exemplo@exemplo.com"
                  type="email"
                  {...empresaForm.register('email')}
                />
              </div>

              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                    Dados fiscais e cobrança
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Informações usadas futuramente para assinatura, cobrança e emissão fiscal.
                  </p>
                </div>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Select
                    error={empresaForm.formState.errors.tipo_pessoa?.message}
                    label="Tipo de cadastro"
                    options={[
                      { label: 'Pessoa Física', value: 'pf' },
                      { label: 'Pessoa Jurídica', value: 'pj' },
                    ]}
                    {...empresaForm.register('tipo_pessoa')}
                  />
                  <Input
                    error={empresaForm.formState.errors.cpf_cnpj?.message}
                    inputMode="numeric"
                    label={watchedTipoPessoa === 'pj' ? 'CNPJ' : 'CPF'}
                    placeholder={
                      watchedTipoPessoa === 'pj'
                        ? '00.000.000/0000-00'
                        : '000.000.000-00'
                    }
                    {...empresaForm.register('cpf_cnpj', {
                      onChange:
                        watchedTipoPessoa === 'pj'
                          ? maskCnpjChange
                          : maskCpfChange,
                    })}
                  />
                  {watchedTipoPessoa === 'pj' && (
                    <>
                      <Input
                        error={empresaForm.formState.errors.razao_social?.message}
                        label="Razão social"
                        placeholder="Razão social da empresa"
                        {...empresaForm.register('razao_social')}
                      />
                      <Input
                        error={empresaForm.formState.errors.nome_fantasia?.message}
                        label="Nome fantasia"
                        placeholder="Nome fantasia"
                        {...empresaForm.register('nome_fantasia')}
                      />
                    </>
                  )}
                  <Input
                    error={empresaForm.formState.errors.email_financeiro?.message}
                    label="E-mail financeiro"
                    placeholder="financeiro@barbearia.com"
                    type="email"
                    {...empresaForm.register('email_financeiro')}
                  />
                  <Input
                    error={empresaForm.formState.errors.responsavel_nome?.message}
                    label="Nome do responsável"
                    placeholder="João Silva"
                    {...empresaForm.register('responsavel_nome')}
                  />
                  <Input
                    error={empresaForm.formState.errors.responsavel_cpf?.message}
                    inputMode="numeric"
                    label="CPF do responsável"
                    placeholder="000.000.000-00"
                    {...empresaForm.register('responsavel_cpf', {
                      onChange: maskCpfChange,
                    })}
                  />
                </div>
              </div>

              <Input
                error={empresaForm.formState.errors.endereco?.message}
                label="Endereço resumido"
                {...empresaForm.register('endereco')}
              />

              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                    Localização da barbearia
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Esses dados aparecem para o cliente e alimentam o botao Ver rota.
                  </p>
                </div>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Input
                    error={empresaForm.formState.errors.cep?.message}
                    inputMode="numeric"
                    label="CEP"
                    placeholder="00000-000"
                    {...empresaForm.register('cep', {
                      onChange: maskCepChange,
                    })}
                  />
                  <Input
                    error={empresaForm.formState.errors.rua?.message}
                    label="Rua"
                    placeholder="Rua Exemplo"
                    {...empresaForm.register('rua', {
                      onChange: (event) => {
                        empresaForm.setValue('logradouro', event.target.value, {
                          shouldDirty: true,
                        })
                      },
                    })}
                  />
                  <Input
                    error={empresaForm.formState.errors.numero?.message}
                    label="Número"
                    placeholder="123"
                    {...empresaForm.register('numero')}
                  />
                  <Input
                    error={empresaForm.formState.errors.bairro?.message}
                    label="Bairro"
                    placeholder="Centro"
                    {...empresaForm.register('bairro')}
                  />
                  <Input
                    error={empresaForm.formState.errors.cidade?.message}
                    label="Cidade"
                    placeholder="Porto Alegre"
                    {...empresaForm.register('cidade')}
                  />
                  <Input
                    error={empresaForm.formState.errors.estado?.message}
                    label="UF"
                    maxLength={2}
                    placeholder="RS"
                    {...empresaForm.register('estado', {
                      onChange: (event) => {
                        empresaForm.setValue(
                          'uf',
                          event.target.value.toUpperCase(),
                          { shouldDirty: true },
                        )
                      },
                    })}
                  />
                  <Input
                    error={empresaForm.formState.errors.complemento?.message}
                    label="Complemento"
                    placeholder="Sala, andar ou referência"
                    {...empresaForm.register('complemento')}
                  />
                </div>
                {cepStatus && (
                  <p className="mt-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-100">
                    {cepStatus}
                  </p>
                )}
                <input type="hidden" {...empresaForm.register('logradouro')} />
                <input type="hidden" {...empresaForm.register('uf')} />
              </div>

              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-brand-100 bg-brand-50 text-brand-600 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-200">
                    {companyLogoPreview ? (
                      <img
                        alt="Logo da barbearia"
                        className="h-full w-full object-cover"
                        src={companyLogoPreview}
                      />
                    ) : (
                      <Building2 size={26} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                      Logo da barbearia
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      PNG, JPG, JPEG ou WEBP até 2MB.
                    </p>
                    {empresaForm.formState.errors.logo_url?.message && (
                      <p className="mt-2 text-sm text-red-600">
                        {empresaForm.formState.errors.logo_url.message}
                      </p>
                    )}
                  </div>
                  <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
                    <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-base font-semibold text-white transition hover:bg-slate-800 sm:h-10 sm:w-auto sm:text-sm dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                      <ImagePlus size={16} />
                      Trocar
                      <input
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="sr-only"
                        type="file"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          setCompanyLogoFile(file)
                          setCompanyLogoPreview(
                            file ? URL.createObjectURL(file) : null,
                          )
                        }}
                      />
                    </label>
                    {(companyLogoPreview || watchedLogoUrl) && (
                      <Button
                        leftIcon={<Trash2 size={16} />}
                        onClick={removeCompanyLogo}
                        type="button"
                        variant="secondary"
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
                <input type="hidden" {...empresaForm.register('logo_url')} />
              </div>

              <Input
                error={
                  empresaForm.formState.errors.percentual_comissao_padrao
                    ?.message
                }
                label="Comissão padrão (%)"
                max={100}
                min={0}
                step="0.01"
                type="number"
                {...empresaForm.register('percentual_comissao_padrao')}
              />

              <div className="flex justify-end">
                <Button
                  className="w-full sm:w-auto"
                  disabled={empresaMutation.isPending}
                  leftIcon={<Save size={18} />}
                  type="submit"
                >
                  {empresaMutation.isPending ? 'Salvando...' : 'Salvar empresa'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Tema
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Ajuste a aparência do sistema.
              </p>
            </CardHeader>
          <CardContent>
              <div className="grid min-w-0 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <Button
                  leftIcon={<Sun size={18} />}
                  onClick={() => setTheme('light')}
                  variant={theme === 'light' ? 'primary' : 'secondary'}
                >
                  Claro
                </Button>
                <Button
                  leftIcon={<Moon size={18} />}
                  onClick={() => setTheme('dark')}
                  variant={theme === 'dark' ? 'primary' : 'secondary'}
                >
                  Escuro
                </Button>
                <Button
                  leftIcon={<Monitor size={18} />}
                  onClick={() => setTheme('system')}
                  variant={theme === 'system' ? 'primary' : 'secondary'}
                >
                  Sistema
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <UserRound
                  className="text-brand-600 dark:text-brand-400"
                  size={22}
                />
                <div>
                  <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                    Perfil do usuário
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Gerencie seus dados de exibição.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={perfilForm.handleSubmit(onSubmitPerfil)}
              >
                {perfilError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {perfilError}
                  </p>
                )}

                <Input
                  error={perfilForm.formState.errors.nome?.message}
                  label="Nome"
                  placeholder="Joao Silva"
                  {...perfilForm.register('nome')}
                />

                <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-100 bg-brand-50 text-brand-600 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-200">
                      {avatarPreview ? (
                        <img
                          alt="Foto de perfil"
                          className="h-full w-full object-cover"
                          src={avatarPreview}
                        />
                      ) : (
                        <UserRound size={26} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                        Foto de perfil
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Usada na sidebar e no perfil do usuário.
                      </p>
                    </div>
                    <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
                      <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-base font-semibold text-white transition hover:bg-slate-800 sm:h-10 sm:w-auto sm:text-sm dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                        <ImagePlus size={16} />
                        Trocar
                        <input
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="sr-only"
                          type="file"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null
                            setAvatarFile(file)
                            setAvatarPreview(file ? URL.createObjectURL(file) : null)
                          }}
                        />
                      </label>
                      {(avatarPreview || watchedAvatarUrl) && (
                        <Button
                          leftIcon={<Trash2 size={16} />}
                          onClick={removeAvatar}
                          type="button"
                          variant="secondary"
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                  <input type="hidden" {...perfilForm.register('avatar_url')} />
                </div>

                <Input
                  error={perfilForm.formState.errors.telefone?.message}
                  inputMode="numeric"
                  label="Telefone"
                  placeholder="(99) 9 9999-9999"
                  autoComplete="tel"
                  {...perfilForm.register('telefone', {
                    onChange: maskPhoneChange,
                  })}
                />

                <div className="flex justify-end">
                  <Button
                    className="w-full sm:w-auto"
                    disabled={perfilMutation.isPending}
                    leftIcon={<Save size={18} />}
                    type="submit"
                  >
                    {perfilMutation.isPending ? 'Salvando...' : 'Salvar perfil'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
