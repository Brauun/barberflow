import { supabase } from '../lib/supabase'
import type {
  EmpresaSettingsFormData,
  UserProfileFormData,
} from '../types/configuracoes'
import type { Empresa, Usuario } from '../types/database'
import { onlyDigits } from '../utils/masks'

function optionalText(value?: string | null) {
  return value?.trim() || null
}

function optionalNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function buildAddress(data: EmpresaSettingsFormData) {
  const streetLine = [optionalText(data.rua), optionalText(data.numero)]
    .filter(Boolean)
    .join(', ')
  const cityLine = [
    optionalText(data.bairro),
    optionalText(data.cidade),
    optionalText(data.estado)?.toUpperCase(),
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
  const locationPayload = {
    bairro: optionalText(data.bairro),
    cep: onlyDigits(data.cep) || null,
    cidade: optionalText(data.cidade),
    complemento: optionalText(data.complemento),
    email: data.email || null,
    endereco,
    estado: optionalText(data.estado)?.toUpperCase() || null,
    latitude: optionalNumber(data.latitude),
    logo_url: data.logo_url || null,
    longitude: optionalNumber(data.longitude),
    nome: data.nome.trim(),
    numero: optionalText(data.numero),
    rua: optionalText(data.rua),
    telefone: onlyDigits(data.telefone) || null,
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

export type SettingsEmpresa = Empresa
export type SettingsUsuario = Usuario
