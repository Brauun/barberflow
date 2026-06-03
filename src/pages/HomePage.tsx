import { Link } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

export function HomePage() {
  const { isAuthenticated } = useAuth()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12">
      <section className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          BarberFlow SaaS
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-ink-900 sm:text-5xl">
          Arquitetura inicial pronta.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-ink-700">
          Base React, TypeScript, Vite, Tailwind CSS, React Router, TanStack
          Query, React Hook Form, Zod e Supabase configurada para evoluir com
          segurança.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
            to={isAuthenticated ? '/perfil' : '/login'}
          >
            {isAuthenticated ? 'Ver perfil' : 'Entrar'}
          </Link>
          {!isAuthenticated && (
            <Link
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-brand-500 hover:text-brand-600"
              to="/cadastro"
            >
              Criar conta
            </Link>
          )}
        </div>
      </section>
    </main>
  )
}
