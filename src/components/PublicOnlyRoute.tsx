import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

export function PublicOnlyRoute() {
  const { clientProfile, isAuthenticated, isLoading, profile, user } = useAuth()

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-6">
        <p className="text-sm font-medium text-ink-700">
          Entrando no BW Barber...
        </p>
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

  if (isAuthenticated) {
    return (
      <Navigate
        replace
        to={user?.user_metadata.role === 'cliente' ? '/cliente' : '/app/dashboard'}
      />
    )
  }

  return <Outlet />
}
