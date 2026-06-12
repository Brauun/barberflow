import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, profileLoading } = useAuth()
  const location = useLocation()

  if (isLoading || (isAuthenticated && profileLoading)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-6">
        <p className="text-sm font-medium text-ink-700">
          Entrando no BW Barber...
        </p>
      </main>
    )
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  return <Outlet />
}
