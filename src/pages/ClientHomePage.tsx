import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, MapPin, RefreshCcw, Route, Star } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'

import { BarbershopLogo } from '../components/BarbershopLogo'
import { Badge, Card, CardContent, CardHeader } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  getPrimaryBarbershop,
  formatBarbershopAddress,
  getBarbershopRouteUrl,
  listFavoriteBarbershops,
  listClientAppointments,
} from '../services/clientService'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function ClientHomePage() {
  const { clientProfile, isLoading, userType } = useAuth()

  const primaryQuery = useQuery({
    enabled: Boolean(clientProfile?.primary_barbershop_id),
    queryFn: () => getPrimaryBarbershop(clientProfile as NonNullable<typeof clientProfile>),
    queryKey: ['client-primary-barbershop', clientProfile?.id, clientProfile?.primary_barbershop_id],
  })

  const appointmentsQuery = useQuery({
    enabled: Boolean(clientProfile?.id),
    queryFn: () => listClientAppointments(clientProfile?.id as string),
    queryKey: ['client-appointments', clientProfile?.id],
  })

  const favoritesQuery = useQuery({
    enabled: Boolean(clientProfile?.id),
    queryFn: () => listFavoriteBarbershops(clientProfile?.id as string),
    queryKey: ['client-favorite-barbershops', clientProfile?.id],
  })

  if (isLoading || (!clientProfile && !userType)) {
    return (
      <main className="flex min-h-64 items-center justify-center px-6">
        <p className="text-sm font-medium text-slate-500">Carregando...</p>
      </main>
    )
  }

  if (!clientProfile) {
    return <Navigate replace to="/app/dashboard" />
  }

  if (!clientProfile.primary_barbershop_id) {
    return <Navigate replace to="/cliente/selecionar-barbearia" />
  }

  const nextAppointment = appointmentsQuery.data?.find(
    (appointment) => new Date(appointment.starts_at) >= new Date(),
  )
  const primary = primaryQuery.data
  const favoriteBarbershopsData = Array.isArray(favoritesQuery.data)
    ? favoritesQuery.data
    : []
  const favoriteBarbershops = favoriteBarbershopsData.filter(
    (barbershop) => barbershop.id !== primary?.id,
  )

  return (
    <div className="space-y-8">
      <section>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600">
          Sua Barbearia
        </p>
        <h2 className="mt-3 text-3xl font-black text-slate-950">
          {primary?.nome ?? 'Barbearia selecionada'}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Acesse sua barbearia principal, acompanhe horarios e agende sem
          procurar tudo de novo.
        </p>
      </section>

      <Card className="bw-barber-mark overflow-hidden">
        <CardContent>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <BarbershopLogo
                className="h-16 w-16 text-lg"
                logoUrl={primary?.logo_url}
                name={primary?.nome}
              />
              <div>
                <h3 className="text-xl font-black text-slate-950">
                  {primary?.nome ?? 'Carregando...'}
                </h3>
                <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                  <MapPin size={15} />
                  {formatBarbershopAddress(primary ?? null)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="warning">
                    <Star size={13} /> {primary?.rating ?? 5}
                  </Badge>
                  <Badge>{primary?.average_wait_minutes ?? 20} min espera</Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgb(15_23_42/0.14)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-brand-500 dark:text-slate-950"
                to="/cliente/agendar"
              >
                <CalendarPlus size={18} />
                Agendar Horario
              </Link>
              <Link
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/70"
                to="/cliente/selecionar-barbearia"
              >
                <RefreshCcw size={18} />
                Trocar Barbearia
              </Link>
              {primary && (
                <a
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/70"
                  href={getBarbershopRouteUrl(primary)}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Route size={18} />
                  Ver rota
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {favoriteBarbershops.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600">
              Favoritas
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              Minhas barbearias favoritas
            </h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {favoriteBarbershops.map((barbershop) => (
                <Card key={barbershop.id}>
                  <CardContent>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <BarbershopLogo
                          className="h-12 w-12 rounded-2xl"
                          logoUrl={barbershop.logo_url}
                          name={barbershop.nome}
                        />
                        <div>
                          <p className="font-black text-slate-950">
                            {barbershop.nome}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                            {formatBarbershopAddress(barbershop)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                          to="/cliente/agendar"
                        >
                          <CalendarPlus size={16} />
                          Agendar
                        </Link>
                        <a
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:border-brand-200"
                          href={getBarbershopRouteUrl(barbershop)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <Route size={16} />
                          Rota
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-slate-950">
              Proximo horario
            </h3>
          </CardHeader>
          <CardContent>
            {nextAppointment ? (
              <div>
                <p className="text-2xl font-black text-brand-600">
                  {dateTimeFormatter.format(new Date(nextAppointment.starts_at))}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {nextAppointment.barbershop?.nome ?? primary?.nome}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Nenhum agendamento futuro. Escolha um horario para voltar com
                estilo.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-slate-950">Historico</h3>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-slate-950">
              {appointmentsQuery.data?.length ?? 0}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              agendamento{appointmentsQuery.data?.length === 1 ? '' : 's'} no
              BW Barber.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
