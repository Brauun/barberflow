export type LogLevel = 'info' | 'warn' | 'error' | 'fatal'

export type LogContext = {
  action?: string
  area?: string
  empresaId?: string | null
  metadata?: Record<string, unknown>
  requestId?: string
  userId?: string | null
  userRole?: string | null
}

type LogPayload = LogContext & {
  error?: unknown
  message: string
}

const sensitiveKeyPattern =
  /(password|senha|token|access_token|refresh_token|authorization|auth|secret|apikey|api_key|cpf|documento|telefone|phone|email|avatar_url|logo_url)/i

function maskEmail(value: string) {
  const [name, domain] = value.split('@')

  if (!domain) {
    return '[REDACTED]'
  }

  return `${name.slice(0, 2)}***@${domain}`
}

function maskDigits(value: string) {
  const digits = value.replace(/\D/g, '')

  if (digits.length <= 4) {
    return '[REDACTED]'
  }

  return `***${digits.slice(-4)}`
}

function sanitizeString(value: string) {
  if (/Bearer\s+[A-Za-z0-9._-]+/i.test(value)) {
    return value.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
  }

  if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value)) {
    return '[REDACTED_JWT]'
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return maskEmail(value)
  }

  const digits = value.replace(/\D/g, '')

  if (digits.length === 11 || digits.length === 14) {
    return maskDigits(value)
  }

  return value
}

export function sanitizeLogData(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[MAX_DEPTH]'
  }

  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string') {
    return sanitizeString(value)
  }

  if (typeof value !== 'object') {
    return value
  }

  if (value instanceof Error) {
    return {
      message: sanitizeString(value.message),
      name: value.name,
      stack: value.stack ? sanitizeString(value.stack) : null,
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogData(item, depth + 1))
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, unknown>
  >((acc, [key, item]) => {
    acc[key] = sensitiveKeyPattern.test(key)
      ? '[REDACTED]'
      : sanitizeLogData(item, depth + 1)

    return acc
  }, {})
}

export function createRequestId(prefix = 'req') {
  const randomValue =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `${prefix}_${randomValue}`
}

function serializeError(error: unknown) {
  if (!error) {
    return undefined
  }

  if (error instanceof Error) {
    return sanitizeLogData({
      message: error.message,
      name: error.name,
      stack: error.stack,
    })
  }

  return sanitizeLogData(error)
}

function writeLog(level: LogLevel, payload: LogPayload) {
  const entry = sanitizeLogData({
    action: payload.action,
    area: payload.area,
    empresaId: payload.empresaId,
    error: serializeError(payload.error),
    level,
    message: payload.message,
    metadata: payload.metadata ?? {},
    requestId: payload.requestId ?? createRequestId(level),
    timestamp: new Date().toISOString(),
    userId: payload.userId,
    userRole: payload.userRole,
  })

  const line = JSON.stringify(entry)

  if (level === 'fatal' || level === 'error') {
    console.error(line)
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  if (import.meta.env.DEV) {
    console.info(line)
  }
}

export const logger = {
  error(payload: LogPayload) {
    writeLog('error', payload)
  },
  fatal(payload: LogPayload) {
    writeLog('fatal', payload)
  },
  info(payload: LogPayload) {
    writeLog('info', payload)
  },
  warn(payload: LogPayload) {
    writeLog('warn', payload)
  },
}
