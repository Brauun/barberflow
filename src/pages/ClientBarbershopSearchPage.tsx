import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, MapPin, Navigation, Route, Search, Star, Timer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BarbershopLogo } from '../components/BarbershopLogo'
import { Badge, Button, Card, CardContent, SearchInput } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  listBarbershops,
  favoriteBarbershop,
  formatBarbershopAddress,
  getBarbershopRouteUrl,
  listFavoriteBarbershopIds,
  setPrimaryBarbershop,
  unfavoriteBarbershop,
  type Barbershop,
} from '../services/clientService'

type Coordinates = {
  latitude: number
  longitude: number
}

function distanceInKm(origin: Coordinates | null, barbershop: Barbershop) {
  if (!origin || !barbershop.latitude || !barbershop.longitude) {
    return null
  }

  const earthRadius = 6371
  const dLat = ((Number(barbershop.latitude) - origin.latitude) * Math.PI) / 180
  const dLon =
    ((Number(barbershop.longitude) - origin.longitude) * Math.PI) / 180
  const lat1 = (origin.latitude * Math.PI) / 180
  const lat2 = (Number(barbershop.latitude) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(distance: number | null) {
  if (distance === null) {
    return 'Cidade'
  }

  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`
  }

  return `${distance.toFixed(distance < 10 ? 1 : 0)}km`
}

export function ClientBarbershopSearchPage() {
  const { clientProfile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<
    'nearby' | 'rating' | 'booked' | 'waiting'
  >('nearby')
  const [position, setPosition] = useState<Coordinates | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (result) =>
        setPosition({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        }),
      () => setPosition(null),
      { enableHighAccuracy: true, maximumAge: 1000 * 60 * 10, timeout: 8000 },
    )
  }, [])

  const barbershopsQuery = useQuery({
    queryFn: () => listBarbershops(searchTerm),
    queryKey: ['barbershops', searchTerm],
  })

  const favoritesQuery = useQuery({
    enabled: Boolean(clientProfile?.id),
    queryFn: () => listFavoriteBarbershopIds(clientProfile?.id as string),
    queryKey: ['client-favorite-barbershop-ids', clientProfile?.id],
  })

  const favoriteIds = useMemo(
    () =>
      favoritesQuery.data instanceof Set
        ? favoritesQuery.data
        : new Set<string>(),
    [favoritesQuery.data],
  )

  const barbershops = useMemo(() => {
    const items = [...(barbershopsQuery.data ?? [])]

    return items.sort((first, second) => {
      if (first.id === clientProfile?.primary_barbershop_id) {
        return -1
      }

      if (second.id === clientProfile?.primary_barbershop_id) {
        return 1
      }

      const firstFavorite = favoriteIds.has(first.id)
      const secondFavorite = favoriteIds.has(second.id)

      if (firstFavorite !== secondFavorite) {
        return firstFavorite ? -1 : 1
      }

      if (filter === 'rating') {
        return Number(second.rating) - Number(first.rating)
      }

      if (filter === 'booked') {
        return second.total_appointments - first.total_appointments
      }

      if (filter === 'waiting') {
        return first.average_wait_minutes - second.average_wait_minutes
      }

      return (
        (distanceInKm(position, first) ?? Number.MAX_SAFE_INTEGER) -
        (distanceInKm(position, second) ?? Number.MAX_SAFE_INTEGER)
      )
    })
  }, [
    barbershopsQuery.data,
    clientProfile?.primary_barbershop_id,
    favoriteIds,
    filter,
    position,
  ])

  const selectMutation = useMutation({
    mutationFn: async (barbershopId: string) => {
      if (!clientProfile) {
        throw new Error('Perfil de cliente não encontrado.')
      }

      await setPrimaryBarbershop(clientProfile, barbershopId)
    },
    onSuccess: async () => {
      await refreshProfile()
      await queryClient.invalidateQueries({ queryKey: ['client-primary-barbershop'] })
      navigate('/cliente', { replace: true })
    },
  })

  const filters = [
    { label: 'Mais proximas', value: 'nearby' },
    { label: 'Melhor avaliação', value: 'rating' },
    { label: 'Mais agendadas', value: 'booked' },
    { label: 'Menor espera', value: 'waiting' },
  ] as const

  const favoriteMutation = useMutation({
    mutationFn: async (barbershop: Barbershop) => {
      if (!clientProfile) {
        throw new Error('Perfil de cliente não encontrado.')
      }

      if (favoriteIds.has(barbershop.id)) {
        await unfavoriteBarbershop(clientProfile, barbershop.id)
        return
      }

      await favoriteBarbershop(clientProfile, barbershop)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['client-favorite-barbershop-ids', clientProfile?.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['client-favorite-barbershops', clientProfile?.id],
        }),
      ])
    },
  })

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:space-y-8 md:pb-6">
      <section>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600">
          Encontrar Barbearias
        </p>
        <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white sm:mt-3 sm:text-3xl">
          Selecionar Barbearia
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-300">
          Escolha sua barbearia principal uma vez. Ela aparece primeiro nas
          próximas buscas.
        </p>
      </section>

      <Card>
        <CardContent className="space-y-3 p-3 sm:space-y-5 sm:p-5">
          <SearchInput
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nome, bairro ou cidade"
            value={searchTerm}
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {filters.map((item) => (
              <button
                className={`min-h-10 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                  filter === item.value
                    ? 'border-brand-200 bg-brand-50 text-brand-600'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-brand-200 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-400/40 dark:hover:text-white'
                }`}
                key={item.value}
                onClick={() => setFilter(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:gap-4 md:pb-0">
        {barbershops.map((barbershop) => {
          const distance = distanceInKm(position, barbershop)
          const isPrimary = barbershop.id === clientProfile?.primary_barbershop_id
          const isFavorite = favoriteIds.has(barbershop.id)

          return (
            <Card key={barbershop.id}>
              <CardContent className="p-3 sm:p-5">
                <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                    <BarbershopLogo
                      className="h-12 w-12 shrink-0 text-sm sm:h-14 sm:w-14 sm:text-base"
                      logoUrl={barbershop.logo_url}
                      name={barbershop.nome}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="min-w-0 break-words text-base font-black text-slate-950 dark:text-white sm:text-lg">
                          {barbershop.nome}
                        </h3>
                        {isPrimary && <Badge variant="warning">Principal</Badge>}
                        {isFavorite && <Badge>Favorita</Badge>}
                      </div>
                      <p className="mt-1 flex min-w-0 items-start gap-2 break-words text-xs leading-5 text-slate-500 dark:text-slate-300 sm:text-sm">
                        <MapPin className="mt-0.5 shrink-0" size={14} />
                        <span className="min-w-0">{formatBarbershopAddress(barbershop)}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                        <Badge>
                          <Navigation size={13} /> {formatDistance(distance)}
                        </Badge>
                        <Badge variant="warning">
                          <Star size={13} /> {barbershop.rating}
                        </Badge>
                        <Badge>
                          <Timer size={13} /> {barbershop.average_wait_minutes}min
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-none md:flex md:flex-wrap md:justify-end">
                    <Button
                      className="h-10 w-full min-w-0 text-sm md:w-auto"
                      disabled={favoriteMutation.isPending}
                      leftIcon={
                        <Heart
                          className={isFavorite ? 'fill-current' : undefined}
                          size={17}
                        />
                      }
                      onClick={() => favoriteMutation.mutate(barbershop)}
                      type="button"
                      variant="secondary"
                    >
                      {isFavorite ? 'Favoritada' : 'Favoritar'}
                    </Button>
                    <a
                      className="inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 md:w-auto"
                      href={getBarbershopRouteUrl(barbershop)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Route size={17} />
                      Ver rota
                    </a>
                    <Button
                      className="col-span-2 h-11 w-full min-w-0 text-sm md:col-auto md:w-auto"
                      disabled={selectMutation.isPending}
                      leftIcon={<Search size={17} />}
                      onClick={() => selectMutation.mutate(barbershop.id)}
                    >
                      Selecionar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
