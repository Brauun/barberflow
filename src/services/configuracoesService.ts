import { supabase } from '../lib/supabase'
import type {
  EmpresaSettingsFormData,
  UserProfileFormData,
} from '../types/configuracoes'
import type { Database, Empresa, Usuario } from '../types/database'
import { onlyDigits } from '../utils/masks'
import { createAuditLog } from './observabilityService'

export type CurrentEmployeeParticipation =
  Database['public']['Tables']['employees']['Row']

function optionalText(value?: string | null) {
  return value?.trim() || null
}

function optionalNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function buildAddress(data: EmpresaSettingsFormData) {
  const streetLine = [
    optionalText(data.logradouro) ?? optionalText(data.rua),
    optionalText(data.numero),
  ]
    .filter(Boolean)
    .join(', ')
  const cityLine = [
    optionalText(data.bairro),
    optionalText(data.cidade),
    (optionalText(data.uf) ?? optionalText(data.estado))?.toUpperCase(),
  ]
    .filter(Boolean)
    .join(' - ')

  return (
    [streetLine, cityLine].filter(Boolean).join(' — ') ||
    optionalText(data.endereco)
  )
}

export async function updateEmpresaSettings(
  empresaId: string,
  data: EmpresaSettingsFormData,
) {
  const endereco = buildAddress(data)
  const street = optionalText(data.logradouro) ?? optionalText(data.rua)
  const state = (optionalText(data.uf) ?? optionalText(data.estado))?.toUpperCase() ?? null
  const locationPayload = {
    bairro: optionalText(data.bairro),
    cep: onlyDigits(data.cep) || null,
    cidade: optionalText(data.cidade),
    complemento: optionalText(data.complemento),
    cpf_cnpj: onlyDigits(data.cpf_cnpj) || null,
    email: data.email || null,
    email_financeiro: data.email_financeiro || null,
    endereco,
    estado: state,
    logradouro: street,
    latitude: optionalNumber(data.latitude),
    logo_url: data.logo_url || null,
    longitude: optionalNumber(data.longitude),
    nome: data.nome.trim(),
    nome_fantasia: optionalText(data.nome_fantasia),
    numero: optionalText(data.numero),
    razao_social: optionalText(data.razao_social),
    responsavel_cpf: onlyDigits(data.responsavel_cpf) || null,
    responsavel_nome: optionalText(data.responsavel_nome),
    rua: street,
    telefone: onlyDigits(data.telefone) || null,
    tipo_pessoa: data.tipo_pessoa || null,
    uf: state,
  }

  const { error } = await supabase
    .from('empresas')
    .update({
      ...locationPayload,
      percentual_comissao_padrao: Number(data.percentual_comissao_padrao),
    })
    .eq('id', empresaId)

  if (error) {
    throw new Error(error.message)
  }

  const { error: barbershopError } = await supabase
    .from('barbershops')
    .update(locationPayload)
    .eq('empresa_id', empresaId)

  if (barbershopError) {
    throw new Error(barbershopError.message)
  }

  await createAuditLog({
    action: 'empresa_atualizada',
    empresaId,
    entityId: empresaId,
    entityType: 'empresas',
    metadata: {
      campos: Object.keys(locationPayload),
    },
    userRole: 'administrador',
  })
}

export async function updateUserProfile(
  empresaId: string,
  usuarioId: string,
  data: UserProfileFormData,
) {
  const { error } = await supabase
    .from('usuarios')
    .update({
      nome: data.nome.trim(),
      avatar_url: data.avatar_url || null,
      telefone: onlyDigits(data.telefone) || null,
    })
    .eq('empresa_id', empresaId)
    .eq('id', usuarioId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function getCurrentEmployeeParticipation(authUserId: string) {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as CurrentEmployeeParticipation | null
}

export async function setCurrentAdminBarberParticipation(
  empresaId: string,
  appearsInSchedule: boolean,
) {
  const { data, error } = await supabase.rpc(
    'set_current_admin_barber_participation',
    {
      p_appears_in_schedule: appearsInSchedule,
      p_empresa_id: empresaId,
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  await createAuditLog({
    action: appearsInSchedule
      ? 'admin_ativou_atendimento_agenda'
      : 'admin_desativou_atendimento_agenda',
    empresaId,
    entityId: data?.id,
    entityType: 'employees',
    metadata: {
      appears_in_schedule: appearsInSchedule,
    },
    userRole: 'administrador',
  })

  return data as CurrentEmployeeParticipation
}

export type SettingsEmpresa = Empresa
export type SettingsUsuario = Usuario

export type AppointmentAutomationSettings = {
  enabled: boolean
  after_minutes: number
  allow_reversal: boolean
  reversal_hours: number
}

const defaultAppointmentAutomationSettings: AppointmentAutomationSettings = {
  after_minutes: 60,
  allow_reversal: true,
  enabled: true,
  reversal_hours: 24,
}

function normalizeAppointmentAutomationSettings(
  value: unknown,
): AppointmentAutomationSettings {
  const config = (value ?? {}) as Partial<AppointmentAutomationSettings>

  return {
    after_minutes: Number(config.after_minutes ?? 60),
    allow_reversal: config.allow_reversal ?? true,
    enabled: config.enabled ?? true,
    reversal_hours: Number(config.reversal_hours ?? 24),
  }
}

export async function getAppointmentAutomationSettings(
  empresaId: string,
): Promise<AppointmentAutomationSettings> {
  const { data, error } = await supabase.rpc(
    'get_appointment_auto_complete_config',
    {
      p_empresa_id: empresaId,
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  return normalizeAppointmentAutomationSettings(
    data ?? defaultAppointmentAutomationSettings,
  )
}

export async function saveAppointmentAutomationSettings(
  empresaId: string,
  settings: AppointmentAutomationSettings,
): Promise<AppointmentAutomationSettings> {
  const { data, error } = await supabase.rpc(
    'save_appointment_auto_complete_config',
    {
      p_after_minutes: settings.after_minutes,
      p_allow_reversal: settings.allow_reversal,
      p_empresa_id: empresaId,
      p_enabled: settings.enabled,
      p_reversal_hours: settings.reversal_hours,
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  return normalizeAppointmentAutomationSettings(
    data ?? defaultAppointmentAutomationSettings,
  )
}
