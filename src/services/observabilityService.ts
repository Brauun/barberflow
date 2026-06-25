import { supabase } from '../lib/supabase'
import {
  createRequestId,
  logger,
  sanitizeLogData,
  type LogLevel,
} from '../lib/logger'
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
  action?: string
  area: string
  empresaId?: string | null
  error: unknown
  level?: LogLevel
  metadata?: Record<string, unknown>
  requestId?: string
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
    logger.warn({
      action: input.action,
      area: 'audit',
      empresaId: input.empresaId,
      message: 'Auditoria ignorada porque não há usuário autenticado.',
      metadata: input.metadata,
      userRole: input.userRole,
    })
    return
  }

  const { error } = await supabase.from('audit_logs').insert({
    action: input.action,
    empresa_id: input.empresaId ?? null,
    entity_id: input.entityId ?? null,
    entity_type: input.entityType,
    metadata: sanitizeLogData(input.metadata ?? {}) as never,
    user_agent: userAgent(),
    user_id: user.id,
    user_role: input.userRole ?? null,
  })

  if (error) {
    logger.warn({
      action: input.action,
      area: 'audit',
      empresaId: input.empresaId,
      error,
      message: 'Falha ao registrar auditoria.',
      metadata: input.metadata,
      userId: user.id,
      userRole: input.userRole,
    })
  }
}

export async function createErrorLog(input: ErrorInput) {
  const requestId = input.requestId ?? createRequestId(input.area)
  const level = input.level ?? 'error'
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const message = errorMessage(input.error)
  const stack = input.error instanceof Error ? input.error.stack : null

  logger[level]({
    action: input.action,
    area: input.area,
    empresaId: input.empresaId,
    error: input.error,
    message,
    metadata: input.metadata,
    requestId,
    userId: user?.id ?? null,
  })

  if (!user) {
    return
  }

  const { error } = await supabase.from('error_logs').insert({
    action: input.action ?? null,
    area: input.area,
    empresa_id: input.empresaId ?? null,
    level,
    message: sanitizeLogData(message) as string,
    metadata: sanitizeLogData(input.metadata ?? {}) as never,
    request_id: requestId,
    stack: stack ? (sanitizeLogData(stack) as string) : null,
    user_agent: userAgent(),
    user_id: user.id,
  })

  if (error) {
    logger.warn({
      action: 'error_log_insert_failed',
      area: 'observability',
      empresaId: input.empresaId,
      error,
      message: 'Falha ao registrar erro no banco.',
      metadata: {
        originalArea: input.area,
        originalRequestId: requestId,
      },
      requestId,
      userId: user.id,
    })
  }
}

export async function handleAppError(input: ErrorInput) {
  await createErrorLog(input)

  if (import.meta.env.DEV) {
    return errorMessage(input.error)
  }

  return 'Não foi possível concluir a ação agora. Tente novamente em alguns instantes.'
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
