import { supabase } from '../lib/supabase'
import type {
  EmpresaSettingsFormData,
  UserProfileFormData,
} from '../types/configuracoes'
import type { Empresa, Usuario } from '../types/database'

export async function updateEmpresaSettings(
  empresaId: string,
  data: EmpresaSettingsFormData,
) {
  const { error } = await supabase
    .from('empresas')
    .update({
      email: data.email || null,
      endereco: data.endereco?.trim() || null,
      logo_url: data.logo_url || null,
      nome: data.nome.trim(),
      percentual_comissao_padrao: Number(data.percentual_comissao_padrao),
      telefone: data.telefone?.trim() || null,
    })
    .eq('id', empresaId)

  if (error) {
    throw new Error(error.message)
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
      telefone: data.telefone?.trim() || null,
    })
    .eq('empresa_id', empresaId)
    .eq('id', usuarioId)

  if (error) {
    throw new Error(error.message)
  }
}

export type SettingsEmpresa = Empresa
export type SettingsUsuario = Usuario
