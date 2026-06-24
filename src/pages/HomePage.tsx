import { Navigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

export function HomePage() {
  const { clientProfile, isAuthenticated, isLoading, profile } = useAuth()

  if (isLoading) {
    return (
      <main className="dark flex min-h-screen items-center justify-center bg-[var(--bf-background)] px-6">
        <p className="text-sm font-medium text-[var(--bf-text-secondary)]">Carregando...</p>
      </main>
    )
  }

  if (isAuthenticated && profile?.empresa_id) {
    return <Navigate replace to="/app/dashboard" />
  }

  if (isAuthenticated && clientProfile) {
    return (
      <Navigate
        replace
        to={
          clientProfile.primary_barbershop_id
            ? '/cliente'
            : '/cliente/selecionar-barbearia'
        }
      />
    )
  }

  return <Navigate replace to="/login" />
}
