import { Link } from 'react-router-dom'

import { Badge, Card, CardContent } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

const roleLabels = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  barbeiro: 'Barbeiro',
  recepcao: 'Recepcao',
}

export function ProfilePage() {
  const { profile, user } = useAuth()

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          Perfil
        </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal">
          Dados do usuário
          </h2>
        </div>
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-brand-400 dark:hover:text-brand-400"
          to="/logout"
        >
          Sair
        </Link>
      </section>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Nome
            </p>
            <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {profile?.nome ?? user?.user_metadata.nome ?? 'Usuário'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              E-mail
            </p>
            <p className="mt-2 break-words text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {profile?.email ?? user?.email}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Tipo de usuário
            </p>
            <div className="mt-3">
              <Badge variant={profile ? 'warning' : 'default'}>
                {profile ? roleLabels[profile.papel] : 'Pendente'}
              </Badge>
            </div>
          </CardContent>
        </Card>
        </div>

      <Card>
        <CardContent>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Empresa
          </p>
          <p className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            {profile?.empresa?.nome ?? user?.user_metadata.empresa ?? 'Não vinculada'}
          </p>
          {!profile && (
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              O usuário está autenticado, mas ainda não possui perfil vinculado
              a uma empresa. Confirme se a funcao SQL de onboarding foi aplicada
              no Supabase.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
