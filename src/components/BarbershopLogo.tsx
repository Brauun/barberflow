import { Building2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { resolveAssetUrl } from '../services/assetsService'
import { cn } from '../utils/cn'

type BarbershopLogoProps = {
  className?: string
  logoUrl?: string | null
  name?: string | null
}

function initialsFromName(name?: string | null) {
  const initials = String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return initials || 'BW'
}

export function BarbershopLogo({
  className,
  logoUrl,
  name,
}: BarbershopLogoProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const initials = useMemo(() => initialsFromName(name), [name])

  useEffect(() => {
    let active = true
    queueMicrotask(() => setHasError(false))

    void resolveAssetUrl('company-assets', logoUrl).then((url) => {
      if (active) {
        setResolvedUrl(url)
      }
    })

    return () => {
      active = false
    }
  }, [logoUrl])

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-brand-50 text-sm font-black text-brand-600 ring-1 ring-brand-100 dark:bg-[var(--bf-surface-muted)] dark:text-slate-100 dark:ring-[var(--bf-border)]',
        className,
      )}
    >
      {resolvedUrl && !hasError ? (
        <img
          alt={name ?? 'Logo da barbearia'}
          className="h-full w-full object-cover"
          onError={() => setHasError(true)}
          src={resolvedUrl}
        />
      ) : logoUrl && !resolvedUrl && !hasError ? (
        <Building2 size={20} />
      ) : (
        <span className="select-none">{initials}</span>
      )}
    </div>
  )
}
