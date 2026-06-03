import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading, profile } = useAuth()

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-6">
        <p className="text-sm font-medium text-ink-700">Carregando...</p>
      </main>
    )
  }

  if (isAuthenticated && profile?.empresa_id) {
    return <Navigate replace to="/app/dashboard" />
  }

  return <Outlet />
}
