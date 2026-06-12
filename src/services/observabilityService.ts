import { supabase } from '../lib/supabase'
import type { Database, UserRole } from '../types/database'

export type AuditLog = Database['public']['Tables']['audit_logs']['Row']

type AuditInput = {
  action: string
  empresaId?: string | null
  entityId?: string | null
  entityType: string
  metadata?: Record<string, unknown>
  userRole?: UserRole | 'cliente' | null
}

type ErrorInput = {
  area: string
  empresaId?: string | null
  error: unknown
  metadata?: Record<string, unknown>
}

function userAgent() {
  return typeof navigator === 'undefined' ? null : navigator.userAgent
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error || 'Erro inesperado')
}

export async function createAuditLog(input: AuditInput) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return
  }

  const { error } = await supabase.from('audit_logs').insert({
    action: input.action,
    empresa_id: input.empresaId ?? null,
    entity_id: input.entityId ?? null,
    entity_type: input.entityType,
    metadata: (input.metadata ?? {}) as never,
    user_agent: userAgent(),
    user_id: user.id,
    user_role: input.userRole ?? null,
  })

  if (error && import.meta.env.DEV) {
    console.warn('[BW Barber Audit] Falha ao registrar auditoria:', error.message)
  }
}

export async function createErrorLog(input: ErrorInput) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const message = errorMessage(input.error)
  const stack = input.error instanceof Error ? input.error.stack : null

  if (!user) {
    return
  }

  const { error } = await supabase.from('error_logs').insert({
    area: input.area,
    empresa_id: input.empresaId ?? null,
    message,
    metadata: (input.metadata ?? {}) as never,
    stack,
    user_id: user.id,
  })

  if (error && import.meta.env.DEV) {
    console.warn('[BW Barber ErrorLog] Falha ao registrar erro:', error.message)
  }
}

export async function handleAppError(input: ErrorInput) {
  await createErrorLog(input)

  if (import.meta.env.DEV) {
    return errorMessage(input.error)
  }

  return 'Nao foi possivel concluir a acao agora. Tente novamente em alguns instantes.'
}

export async function listAuditLogs(empresaId: string): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as AuditLog[]
}
