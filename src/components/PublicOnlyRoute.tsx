import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

export function PublicOnlyRoute() {
  const { clientProfile, isAuthenticated, isLoading, profileLoading, profile, user } = useAuth()

  // Aguarda tanto o carregamento da sessão quanto do profile
  if (isLoading || (isAuthenticated && profileLoading)) {
    return (
      <main className="dark flex min-h-screen items-center justify-center bg-[var(--bf-background)] px-6">
        <p className="text-sm font-medium text-[var(--bf-text-secondary)]">
          Entrando no BW Barber...
        </p>
      </main>
    )
  }

  // Usuário autenticado com profile de barbearia carregado
  if (isAuthenticated && profile?.empresa_id) {
    return <Navigate replace to="/app/dashboard" />
  }

  // Usuário autenticado com profile de cliente carregado
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

  // Usuário autenticado mas profile ainda não identificado (fallback por metadata)
  if (isAuthenticated && !profileLoading) {
    return (
      <Navigate
        replace
        to={user?.user_metadata.role === 'cliente' ? '/cliente' : '/app/dashboard'}
      />
    )
  }

  return <Outlet />
}
