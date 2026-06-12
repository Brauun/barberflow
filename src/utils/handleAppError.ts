import { handleAppError as logAppError } from '../services/observabilityService'

export function getAppErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir a operação.',
) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return fallback
}

export function toAppError(error: unknown, fallback?: string) {
  return new Error(getAppErrorMessage(error, fallback), { cause: error })
}

export async function handleAppError(input: {
  area: string
  error: unknown
  empresaId?: string | null
  fallback?: string
  metadata?: Record<string, unknown>
}) {
  const message = await logAppError({
    area: input.area,
    empresaId: input.empresaId,
    error: input.error,
    metadata: input.metadata,
  })

  if (input.fallback && !import.meta.env.DEV) {
    return input.fallback
  }

  return message
}
