import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'

import { ProtectedRoute } from '../components/ProtectedRoute'
import { PublicOnlyRoute } from '../components/PublicOnlyRoute'
import { PageSkeleton } from '../components/layout/PageSkeleton'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { ClientLayout } from '../layouts/ClientLayout'
import { RootLayout } from '../layouts/RootLayout'
import { lazyWithRetry } from '../utils/lazyWithRetry'

const AtendimentosPage = lazy(lazyWithRetry(() =>
  import('../pages/AtendimentosPage').then(({ AtendimentosPage }) => ({
    default: AtendimentosPage,
  })),
))
const AssinaturaPage = lazy(lazyWithRetry(() =>
  import('../pages/AssinaturaPage').then(({ AssinaturaPage }) => ({
    default: AssinaturaPage,
  })),
))
const BarbeirosPage = lazy(lazyWithRetry(() =>
  import('../pages/BarbeirosPage').then(({ BarbeirosPage }) => ({
    default: BarbeirosPage,
  })),
))
const ClientesPage = lazy(lazyWithRetry(() =>
  import('../pages/ClientesPage').then(({ ClientesPage }) => ({
    default: ClientesPage,
  })),
))
const ClientAppointmentsPage = lazy(lazyWithRetry(() =>
  import('../pages/ClientAppointmentsPage').then(({ ClientAppointmentsPage }) => ({
    default: ClientAppointmentsPage,
  })),
))
const ClientBarbershopPage = lazy(lazyWithRetry(() =>
  import('../pages/ClientBarbershopPage').then(({ ClientBarbershopPage }) => ({
    default: ClientBarbershopPage,
  })),
))
const ClientBarbershopSearchPage = lazy(lazyWithRetry(() =>
  import('../pages/ClientBarbershopSearchPage').then(
    ({ ClientBarbershopSearchPage }) => ({
      default: ClientBarbershopSearchPage,
    }),
  ),
))
const ClientBookingPage = lazy(lazyWithRetry(() =>
  import('../pages/ClientBookingPage').then(({ ClientBookingPage }) => ({
    default: ClientBookingPage,
  })),
))
const ClientBenefitsPage = lazy(lazyWithRetry(() =>
  import('../pages/ClientBenefitsPage').then(({ ClientBenefitsPage }) => ({
    default: ClientBenefitsPage,
  })),
))
const ClientHomePage = lazy(lazyWithRetry(() =>
  import('../pages/ClientHomePage').then(({ ClientHomePage }) => ({
    default: ClientHomePage,
  })),
))
const ClientProfilePage = lazy(lazyWithRetry(() =>
  import('../pages/ClientProfilePage').then(({ ClientProfilePage }) => ({
    default: ClientProfilePage,
  })),
))
const ConfiguracoesPage = lazy(lazyWithRetry(() =>
  import('../pages/ConfiguracoesPage').then(({ ConfiguracoesPage }) => ({
    default: ConfiguracoesPage,
  })),
))
const ContasPagarPage = lazy(lazyWithRetry(() =>
  import('../pages/ContasPagarPage').then(({ ContasPagarPage }) => ({
    default: ContasPagarPage,
  })),
))
const DashboardPage = lazy(lazyWithRetry(() =>
  import('../pages/DashboardPage').then(({ DashboardPage }) => ({
    default: DashboardPage,
  })),
))
const EmployeeInvitePage = lazy(lazyWithRetry(() =>
  import('../pages/EmployeeInvitePage').then(({ EmployeeInvitePage }) => ({
    default: EmployeeInvitePage,
  })),
))
const FluxoCaixaPage = lazy(lazyWithRetry(() =>
  import('../pages/FluxoCaixaPage').then(({ FluxoCaixaPage }) => ({
    default: FluxoCaixaPage,
  })),
))
const ForgotPasswordPage = lazy(lazyWithRetry(() =>
  import('../pages/ForgotPasswordPage').then(({ ForgotPasswordPage }) => ({
    default: ForgotPasswordPage,
  })),
))
const HomePage = lazy(lazyWithRetry(() =>
  import('../pages/HomePage').then(({ HomePage }) => ({ default: HomePage })),
))
const LoginPage = lazy(lazyWithRetry(() =>
  import('../pages/LoginPage').then(({ LoginPage }) => ({ default: LoginPage })),
))
const LogoutPage = lazy(lazyWithRetry(() =>
  import('../pages/LogoutPage').then(({ LogoutPage }) => ({
    default: LogoutPage,
  })),
))
const NotFoundPage = lazy(lazyWithRetry(() =>
  import('../pages/NotFoundPage').then(({ NotFoundPage }) => ({
    default: NotFoundPage,
  })),
))
const PlanosFidelidadePage = lazy(lazyWithRetry(() =>
  import('../pages/PlanosFidelidadePage').then(({ PlanosFidelidadePage }) => ({
    default: PlanosFidelidadePage,
  })),
))
const ProfilePage = lazy(lazyWithRetry(() =>
  import('../pages/ProfilePage').then(({ ProfilePage }) => ({
    default: ProfilePage,
  })),
))
const ProdutosPage = lazy(lazyWithRetry(() =>
  import('../pages/ProdutosPage').then(({ ProdutosPage }) => ({
    default: ProdutosPage,
  })),
))
const RegisterPage = lazy(lazyWithRetry(() =>
  import('../pages/RegisterPage').then(({ RegisterPage }) => ({
    default: RegisterPage,
  })),
))
const RelatoriosPage = lazy(lazyWithRetry(() =>
  import('../pages/RelatoriosPage'),
))
const RelatoriosExecutivosPage = lazy(lazyWithRetry(() =>
  import('../pages/RelatoriosExecutivosPage'),
))
const ServicosPage = lazy(lazyWithRetry(() =>
  import('../pages/ServicosPage').then(({ ServicosPage }) => ({
    default: ServicosPage,
  })),
))

function withSuspense(element: ReactNode) {
  return (
    <Suspense fallback={<PageSkeleton />}>
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
        path: 'convite/:token',
        element: withSuspense(<EmployeeInvitePage />),
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
        path: 'logout',
        element: withSuspense(<LogoutPage />),
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: 'cliente',
            element: <ClientLayout />,
            children: [
              {
                index: true,
                element: withSuspense(<ClientHomePage />),
              },
              {
                path: 'selecionar-barbearia',
                element: withSuspense(<ClientBarbershopSearchPage />),
              },
              {
                path: 'agendar',
                element: withSuspense(<ClientBookingPage />),
              },
              {
                path: 'agendamentos',
                element: withSuspense(<ClientAppointmentsPage />),
              },
              {
                path: 'minha-barbearia',
                element: withSuspense(<ClientBarbershopPage />),
              },
              {
                path: 'beneficios',
                element: withSuspense(<ClientBenefitsPage />),
              },
              {
                path: 'perfil',
                element: withSuspense(<ClientProfilePage />),
              },
            ],
          },
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
                path: 'planos-fidelidade',
                element: withSuspense(<PlanosFidelidadePage />),
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
                path: 'relatorios-executivos',
                element: withSuspense(<RelatoriosExecutivosPage />),
              },
              {
                path: 'configuracoes',
                element: withSuspense(<ConfiguracoesPage />),
              },
              {
                path: 'assinatura',
                element: withSuspense(<AssinaturaPage />),
              },
              {
                path: 'perfil',
                element: withSuspense(<ProfilePage />),
              },
            ],
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
