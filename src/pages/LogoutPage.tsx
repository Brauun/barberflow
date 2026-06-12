import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { signOut } from '../services/authService'
import { createAuditLog } from '../services/observabilityService'

export function LogoutPage() {
  const navigate = useNavigate()
  const { clientProfile, profile, user } = useAuth()

  useEffect(() => {
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
      navigate('/login', { replace: true })
    }

    void logout()
  }, [clientProfile, navigate, profile, user])

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <p className="text-sm font-medium text-ink-700">Saindo...</p>
    </main>
  )
}
