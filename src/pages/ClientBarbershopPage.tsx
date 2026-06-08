import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, MapPin, RefreshCcw, Route, Star } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge, Card, CardContent } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  formatBarbershopAddress,
  getBarbershopRouteUrl,
  getPrimaryBarbershop,
  listFavoriteBarbershops,
} from '../services/clientService'

export function ClientBarbershopPage() {
  const { clientProfile } = useAuth()
  const primaryQuery = useQuery({
    enabled: Boolean(clientProfile?.primary_barbershop_id),
    queryFn: () => getPrimaryBarbershop(clientProfile as NonNullable<typeof clientProfile>),
    queryKey: ['client-primary-barbershop', clientProfile?.id, clientProfile?.primary_barbershop_id],
  })

  const barbershop = primaryQuery.data
  const favoritesQuery = useQuery({
    enabled: Boolean(clientProfile?.id),
    queryFn: () => listFavoriteBarbershops(clientProfile?.id as string),
    queryKey: ['client-favorite-barbershops', clientProfile?.id],
  })
  const favoriteBarbershops = (favoritesQuery.data ?? []).filter(
    (favorite) => favorite.id !== barbershop?.id,
  )

  return (
    <div className="space-y-8">
      <section>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600">
          Minha Barbearia
        </p>
        <h2 className="mt-3 text-3xl font-black text-slate-950">
          {barbershop?.nome ?? 'Nenhuma barbearia selecionada'}
        </h2>
      </section>

      <Card>
        <CardContent>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-lg font-black text-brand-600">
                BF
              </div>
              <div>
                <p className="text-xl font-black text-slate-950">
                  {barbershop?.nome ?? 'Escolha uma barbearia'}
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <MapPin size={15} />
                  {barbershop
                    ? formatBarbershopAddress(barbershop)
                    : 'Use a busca para definir a principal.'}
                </p>
                {barbershop && (
                  <div className="mt-3 flex gap-2">
                    <Badge variant="warning">
                      <Star size={13} /> {barbershop.rating}
                    </Badge>
                    <Badge>{barbershop.average_wait_minutes}min espera</Badge>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {barbershop && (
                <>
                  <Link
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
                    to="/cliente/agendar"
                  >
                    <CalendarPlus size={17} />
                    Agendar
                  </Link>
                  <a
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200"
                    href={getBarbershopRouteUrl(barbershop)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Route size={17} />
                    Ver rota
                  </a>
                </>
              )}
              <Link
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200"
                to="/cliente/selecionar-barbearia"
              >
                <RefreshCcw size={17} />
                Trocar Barbearia
              </Link>
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
            <h3 className="text-xl font-black text-slate-950">
              Minhas barbearias favoritas
            </h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {favoriteBarbershops.map((favorite) => (
              <Card key={favorite.id}>
                <CardContent>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-sm font-black text-brand-600">
                        {favorite.logo_url ? (
                          <img
                            alt={favorite.nome}
                            className="h-full w-full object-cover"
                            src={favorite.logo_url}
                          />
                        ) : (
                          'BF'
                        )}
                      </div>
                      <div>
                        <p className="font-black text-slate-950">{favorite.nome}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatBarbershopAddress(favorite)}
                        </p>
                      </div>
                    </div>
                    <a
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200"
                      href={getBarbershopRouteUrl(favorite)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Route size={17} />
                      Ver rota
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
