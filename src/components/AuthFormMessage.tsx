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
      ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
      : 'border-rose-300/20 bg-rose-400/10 text-rose-100'

  return (
    <p className={`rounded-2xl border px-4 py-3 text-sm ${className}`}>
      {message}
    </p>
  )
}
