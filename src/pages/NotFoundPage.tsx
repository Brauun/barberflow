import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          404
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal">
          Página não encontrada.
        </h1>
        <Link
          className="mt-6 inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500"
          to="/"
        >
          Voltar ao inicio
        </Link>
      </section>
    </main>
  )
}
