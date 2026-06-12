import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { signOut } from '../services/authService'
import { createAuditLog } from '../services/observabilityService'
import { queryClient } from '../lib/queryClient'

export function LogoutPage() {
  const navigate = useNavigate()
  const { clientProfile, profile, user } = useAuth()
  const hasLoggedOut = useRef(false)

  useEffect(() => {
    if (hasLoggedOut.current) return
    hasLoggedOut.current = true

    async function logout() {
      await createAuditLog({
        action: 'logout',
        empresaId: profile?.empresa_id ?? null,
        entityId: user?.id ?? null,
        entityType: 'auth',
        metadata: clientProfile ? { perfil: 'cliente' } : {},
        userRole: profile?.papel ?? (clientProfile ? 'cliente' : null),
      })
      await signOut()
      queryClient.clear()
      navigate('/login', { replace: true })
    }

    void logout()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <p className="text-sm font-medium text-ink-700">Saindo...</p>
    </main>
  )
}
