type AuthFormMessageProps = {
  message: string | null
  tone?: 'error' | 'success'
}

export function AuthFormMessage({
  message,
  tone = 'error',
}: AuthFormMessageProps) {
  if (!message) {
    return null
  }

  const className =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-red-200 bg-red-50 text-red-700'

  return (
    <p className={`rounded-md border px-3 py-2 text-sm ${className}`}>
      {message}
    </p>
  )
}
