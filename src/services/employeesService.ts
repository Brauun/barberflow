import { supabase } from '../lib/supabase'
import type {
  EmployeeInvitationFormData,
} from '../types/employees'
import type { Database } from '../types/database'
import { onlyDigits } from '../utils/masks'
import { createAuditLog } from './observabilityService'

export type Employee = Database['public']['Tables']['employees']['Row']
export type EmployeeLink =
  Database['public']['Tables']['barbershop_employee_links']['Row'] & {
    employee?: Employee | null
  }
export type EmployeeInvitation =
  Database['public']['Tables']['employee_invitations']['Row']

export async function listEmployeeLinks(empresaId: string) {
  const { data, error } = await supabase
    .from('barbershop_employee_links')
    .select('*,employee:employees(*)')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as EmployeeLink[]
}

export async function listEmployeeInvitations(empresaId: string) {
  const { data, error } = await supabase
    .from('employee_invitations')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as EmployeeInvitation[]
}

export async function createEmployeeInvitation(input: {
  empresaId: string
  createdBy: string | null
  data: EmployeeInvitationFormData
}) {
  const telefone = onlyDigits(input.data.telefone)

  const { data: invitation, error } = await supabase.rpc(
    'create_employee_invitation',
    {
      p_commission_percentage: Number(input.data.commission_percentage),
      p_created_by: input.createdBy,
      p_email: input.data.email.trim().toLowerCase(),
      p_empresa_id: input.empresaId,
      p_nome: input.data.nome.trim(),
      p_role: input.data.role,
      p_telefone: telefone || '',
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  await createAuditLog({
    action: 'convite_funcionario',
    empresaId: input.empresaId,
    entityId: (invitation as EmployeeInvitation).id,
    entityType: 'employee_invitations',
    metadata: {
      email: input.data.email.trim().toLowerCase(),
      role: input.data.role,
    },
    userRole: 'administrador',
  })

  return invitation as EmployeeInvitation
}

export async function cancelEmployeeInvitation(
  empresaId: string,
  invitationId: string,
) {
  const { error } = await supabase
    .from('employee_invitations')
    .update({ status: 'cancelado' })
    .eq('empresa_id', empresaId)
    .eq('id', invitationId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function getEmployeeInvitationByToken(token: string) {
  const { data, error } = await supabase
    .from('employee_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as EmployeeInvitation | null
}

export async function acceptEmployeeInvitation(input: {
  email: string
  password: string
  token: string
  nome: string
  telefone?: string
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        nome: input.nome,
        role: 'barbearia',
        telefone: onlyDigits(input.telefone) || null,
      },
    },
  })

  if (error) {
    throw new Error(`Falha ao criar usuario no Auth: ${error.message}`)
  }

  if (!data.session) {
    throw new Error(
      'Usuario criado, mas o Supabase exige confirmacao de e-mail antes de aceitar o convite.',
    )
  }

  const { error: acceptError } = await supabase.rpc(
    'accept_employee_invitation',
    {
      p_nome: input.nome,
      p_telefone: onlyDigits(input.telefone),
      p_token: input.token,
    },
  )

  if (acceptError) {
    throw new Error(acceptError.message)
  }
}

export async function inactivateEmployeeLink(
  empresaId: string,
  link: EmployeeLink,
) {
  const now = new Date().toISOString()

  const { error: linkError } = await supabase
    .from('barbershop_employee_links')
    .update({ left_at: now, status: 'inativo' })
    .eq('empresa_id', empresaId)
    .eq('id', link.id)

  if (linkError) {
    throw new Error(linkError.message)
  }

  await supabase
    .from('employees')
    .update({ status: 'inativo' })
    .eq('id', link.employee_id)

  if (link.employee?.auth_user_id) {
    await supabase
      .from('usuarios')
      .update({ status: 'inativo' })
      .eq('empresa_id', empresaId)
      .eq('auth_user_id', link.employee.auth_user_id)
  }

  await createAuditLog({
    action: 'funcionario_inativado',
    empresaId,
    entityId: link.employee_id,
    entityType: 'employees',
    metadata: {
      link_id: link.id,
      nome: link.employee?.nome ?? null,
    },
    userRole: 'administrador',
  })
}
