import { Link, Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <main className="grid min-h-screen bg-surface lg:grid-cols-[1fr_480px]">
      <section className="hidden bg-ink-900 px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Link className="text-lg font-semibold" to="/">
          BarberFlow
        </Link>
        <div className="max-w-xl">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-100">
            SaaS Multi-Tenant
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-normal">
            Gestao profissional para barbearias modernas.
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-300">
            Acesso seguro por empresa, perfis de usuario e dados isolados no
            Supabase.
          </p>
        </div>
        <p className="text-sm text-slate-400">BarberFlow SaaS</p>
      </section>

      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </section>
    </main>
  )
}
