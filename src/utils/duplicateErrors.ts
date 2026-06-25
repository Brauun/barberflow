type DuplicateMessageMap = Record<string, string>

function errorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '')
  }

  return ''
}

function errorText(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    return [record.message, record.details, record.hint]
      .filter(Boolean)
      .join(' ')
  }

  return String(error ?? '')
}

export function friendlyDuplicateMessage(
  error: unknown,
  messages: DuplicateMessageMap,
) {
  const text = errorText(error)
  const isUniqueViolation = errorCode(error) === '23505'

  if (!isUniqueViolation && !text.toLowerCase().includes('duplicate key')) {
    return null
  }

  const matchedEntry = Object.entries(messages).find(([constraint]) =>
    text.includes(constraint),
  )

  return matchedEntry?.[1] ?? 'Já existe um registro com esses dados.'
}

export function duplicateAwareError(
  error: unknown,
  messages: DuplicateMessageMap,
  fallback: string,
) {
  return new Error(friendlyDuplicateMessage(error, messages) ?? fallback, {
    cause: error,
  })
}
