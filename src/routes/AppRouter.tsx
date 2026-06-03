import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'

import { ProtectedRoute } from '../components/ProtectedRoute'
import { PublicOnlyRoute } from '../components/PublicOnlyRoute'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { RootLayout } from '../layouts/RootLayout'

const AtendimentosPage = lazy(() =>
  import('../pages/AtendimentosPage').then(({ AtendimentosPage }) => ({
    default: AtendimentosPage,
  })),
)
const BarbeirosPage = lazy(() =>
  import('../pages/BarbeirosPage').then(({ BarbeirosPage }) => ({
    default: BarbeirosPage,
  })),
)
const ClientesPage = lazy(() =>
  import('../pages/ClientesPage').then(({ ClientesPage }) => ({
    default: ClientesPage,
  })),
)
const ConfiguracoesPage = lazy(() =>
  import('../pages/ConfiguracoesPage').then(({ ConfiguracoesPage }) => ({
    default: ConfiguracoesPage,
  })),
)
const ContasPagarPage = lazy(() =>
  import('../pages/ContasPagarPage').then(({ ContasPagarPage }) => ({
    default: ContasPagarPage,
  })),
)
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then(({ DashboardPage }) => ({
    default: DashboardPage,
  })),
)
const FluxoCaixaPage = lazy(() =>
  import('../pages/FluxoCaixaPage').then(({ FluxoCaixaPage }) => ({
    default: FluxoCaixaPage,
  })),
)
const ForgotPasswordPage = lazy(() =>
  import('../pages/ForgotPasswordPage').then(({ ForgotPasswordPage }) => ({
    default: ForgotPasswordPage,
  })),
)
const HomePage = lazy(() =>
  import('../pages/HomePage').then(({ HomePage }) => ({ default: HomePage })),
)
const LoginPage = lazy(() =>
  import('../pages/LoginPage').then(({ LoginPage }) => ({ default: LoginPage })),
)
const LogoutPage = lazy(() =>
  import('../pages/LogoutPage').then(({ LogoutPage }) => ({
    default: LogoutPage,
  })),
)
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then(({ NotFoundPage }) => ({
    default: NotFoundPage,
  })),
)
const ProfilePage = lazy(() =>
  import('../pages/ProfilePage').then(({ ProfilePage }) => ({
    default: ProfilePage,
  })),
)
const ProdutosPage = lazy(() =>
  import('../pages/ProdutosPage').then(({ ProdutosPage }) => ({
    default: ProdutosPage,
  })),
)
const RegisterPage = lazy(() =>
  import('../pages/RegisterPage').then(({ RegisterPage }) => ({
    default: RegisterPage,
  })),
)
const RelatoriosPage = lazy(() =>
  import('../pages/RelatoriosPage').then(({ RelatoriosPage }) => ({
    default: RelatoriosPage,
  })),
)
const ServicosPage = lazy(() =>
  import('../pages/ServicosPage').then(({ ServicosPage }) => ({
    default: ServicosPage,
  })),
)

function withSuspense(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-64 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
          Carregando...
        </div>
      }
    >
      {element}
    </Suspense>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: withSuspense(<HomePage />),
      },
      {
        element: <PublicOnlyRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              {
                path: 'login',
                element: withSuspense(<LoginPage />),
              },
              {
                path: 'cadastro',
                element: withSuspense(<RegisterPage />),
              },
              {
                path: 'recuperar-senha',
                element: withSuspense(<ForgotPasswordPage />),
              },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: 'perfil',
            element: <Navigate replace to="/app/perfil" />,
          },
          {
            path: 'app',
            element: <AppLayout />,
            children: [
              {
                index: true,
                element: <Navigate replace to="/app/dashboard" />,
              },
              {
                path: 'dashboard',
                element: withSuspense(<DashboardPage />),
              },
              {
                path: 'clientes',
                element: withSuspense(<ClientesPage />),
              },
              {
                path: 'barbeiros',
                element: withSuspense(<BarbeirosPage />),
              },
              {
                path: 'servicos',
                element: withSuspense(<ServicosPage />),
              },
              {
                path: 'atendimentos',
                element: withSuspense(<AtendimentosPage />),
              },
              {
                path: 'produtos',
                element: withSuspense(<ProdutosPage />),
              },
              {
                path: 'fluxo-de-caixa',
                element: withSuspense(<FluxoCaixaPage />),
              },
              {
                path: 'contas-a-pagar',
                element: withSuspense(<ContasPagarPage />),
              },
              {
                path: 'relatorios',
                element: withSuspense(<RelatoriosPage />),
              },
              {
                path: 'configuracoes',
                element: withSuspense(<ConfiguracoesPage />),
              },
              {
                path: 'perfil',
                element: withSuspense(<ProfilePage />),
              },
            ],
          },
          {
            path: 'logout',
            element: withSuspense(<LogoutPage />),
          },
        ],
      },
      {
        path: '*',
        element: withSuspense(<NotFoundPage />),
      },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
