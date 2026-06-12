import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, Card, CardContent, CardHeader, Select } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  createWaitlistEntry,
  createClientAppointment,
  getPrimaryBarbershop,
  listBarberAppointments,
  listBarberUnavailabilityForDate,
  listBookingBarbers,
  listBookingServices,
} from '../services/clientService'
import {
  listBusinessHours,
  listSpecialBusinessHoursForDate,
} from '../services/businessHoursService'
import {
  canUseFeature,
  getSubscriptionState,
} from '../services/subscriptionsService'
import { buildBookingSlots } from '../utils/bookingSlots'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export function ClientBookingPage() {
  const { clientProfile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [serviceId, setServiceId] = useState('')
  const [barberId, setBarberId] = useState('')
  const [date, setDate] = useState(todayInputValue())
  const [slot, setSlot] = useState('')
  const [preferredPeriod, setPreferredPeriod] = useState<
    'manha' | 'tarde' | 'noite' | 'qualquer'
  >('qualquer')
  const [formError, setFormError] = useState<string | null>(null)

  const primaryQuery = useQuery({
    enabled: Boolean(clientProfile?.primary_barbershop_id),
    queryFn: () => getPrimaryBarbershop(clientProfile as NonNullable<typeof clientProfile>),
    queryKey: ['client-primary-barbershop', clientProfile?.id, clientProfile?.primary_barbershop_id],
  })
  const barbershop = primaryQuery.data
  const subscriptionQuery = useQuery({
    enabled: Boolean(barbershop?.empresa_id),
    queryFn: () => getSubscriptionState(barbershop?.empresa_id as string),
    queryKey: ['subscription', barbershop?.empresa_id],
  })
  const canUseWaitlist = canUseFeature(subscriptionQuery.data, 'HAS_WAITLIST')

  const servicesQuery = useQuery({
    enabled: Boolean(barbershop?.empresa_id && barberId),
    queryFn: () => listBookingServices(barbershop?.empresa_id as string, barberId),
    queryKey: ['booking-services', barbershop?.empresa_id, barberId],
  })
  const barbersQuery = useQuery({
    enabled: Boolean(barbershop?.empresa_id),
    queryFn: () => listBookingBarbers(barbershop?.empresa_id as string),
    queryKey: ['booking-barbers', barbershop?.empresa_id],
  })

  const selectedService = servicesQuery.data?.find((service) => service.id === serviceId)
  const selectedBarber = barbersQuery.data?.find((barber) => barber.id === barberId)
  const duration = selectedService?.duration_minutes ?? selectedService?.duracao_minutos ?? 30

  const busyQuery = useQuery({
    enabled: Boolean(barbershop?.id && barberId && date),
    queryFn: () =>
      listBarberAppointments(
        barbershop?.id as string,
        barberId,
        date,
        undefined,
        barbershop?.empresa_id,
      ),
    queryKey: ['booking-busy', barbershop?.id, barbershop?.empresa_id, barberId, date],
  })

  const unavailabilityQuery = useQuery({
    enabled: Boolean(barbershop?.empresa_id && barberId && date),
    queryFn: () =>
      listBarberUnavailabilityForDate(
        barbershop?.empresa_id as string,
        barberId,
        date,
      ),
    queryKey: ['booking-unavailability', barbershop?.empresa_id, barberId, date],
  })

  const businessHoursQuery = useQuery({
    enabled: Boolean(barbershop?.empresa_id),
    queryFn: () => listBusinessHours(barbershop?.empresa_id as string),
    queryKey: ['business-hours', barbershop?.empresa_id],
  })

  const specialHoursQuery = useQuery({
    enabled: Boolean(barbershop?.empresa_id && date),
    queryFn: () =>
      listSpecialBusinessHoursForDate(barbershop?.empresa_id as string, date),
    queryKey: ['special-business-hours', barbershop?.empresa_id, date],
  })

  const slotResult = useMemo(
    () =>
      buildBookingSlots({
        appointments: busyQuery.data ?? [],
        businessHours: businessHoursQuery.data ?? [],
        date,
        durationMinutes: duration,
        specialHour: specialHoursQuery.data,
        unavailability: unavailabilityQuery.data ?? [],
      }),
    [
      busyQuery.data,
      businessHoursQuery.data,
      date,
      duration,
      specialHoursQuery.data,
      unavailabilityQuery.data,
    ],
  )
  const slots = slotResult.slots
  const isAllDayUnavailable = Boolean(
    barberId && unavailabilityQuery.data?.some((block) => block.all_day),
  )
  const selectedSlotIsAvailable = Boolean(
    slot && slots.some((item) => item.value === slot && item.available),
  )
  const hasAvailableSlots = slots.some((item) => item.available)

  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!clientProfile || !barbershop || !selectedService || !selectedBarber || !slot) {
        throw new Error('Selecione barbearia, serviço, profissional, data e horário.')
      }

      const selectedSlot = slots.find((item) => item.value === slot)

      if (!selectedSlot?.available) {
        throw new Error('Este horário não está disponível para agendamento.')
      }

      const startsAt = new Date(slot)
      const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000)

      await createClientAppointment({
        barber: selectedBarber,
        barbershop,
        clientProfile,
        endsAt: endsAt.toISOString(),
        service: selectedService,
        startsAt: startsAt.toISOString(),
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client-appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['booking-busy'] }),
      ])
      navigate('/cliente/agendamentos')
    },
  })

  const waitlistMutation = useMutation({
    mutationFn: async () => {
      if (!clientProfile || !barbershop || !selectedService) {
        throw new Error('Selecione barbearia, serviço e data para entrar na lista.')
      }

      await createWaitlistEntry({
        barberId: barberId || null,
        barbershop,
        clientProfile,
        desiredDate: date,
        preferredPeriod,
        serviceId: selectedService.id,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['client-waitlist'] })
      setFormError('Você entrou na lista de espera para esta data.')
    },
  })

  return (
    <div className="space-y-8">
      <section>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600">
          Agendar
        </p>
        <h2 className="mt-3 text-3xl font-black text-slate-950">
          Novo horário
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {barbershop?.nome ?? 'Selecione uma barbearia principal para agendar.'}
        </p>
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-slate-950">
            Fluxo de agendamento
          </h3>
        </CardHeader>
        <CardContent className="space-y-5">
          {formError && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </p>
          )}

          <Select
            label="Profissional"
            onChange={(event) => {
              setBarberId(event.target.value)
              setServiceId('')
              setSlot('')
            }}
            options={[
              { label: 'Selecione', value: '' },
              ...(barbersQuery.data ?? []).map((barber) => ({
                label: barber.nome,
                value: barber.id,
              })),
            ]}
            value={barberId}
          />

          <Select
            label="Serviço"
            onChange={(event) => {
              setServiceId(event.target.value)
              setSlot('')
            }}
            options={[
              {
                label: barberId
                  ? 'Selecione'
                  : 'Selecione um profissional primeiro',
                value: '',
              },
              ...(servicesQuery.data ?? []).map((service) => ({
                label: `${service.nome} · ${currencyFormatter.format(Number(service.preco))} · ${service.duration_minutes ?? service.duracao_minutos}min`,
                value: service.id,
              })),
            ]}
            value={serviceId}
          />

          {barberId && !servicesQuery.isLoading && servicesQuery.data?.length === 0 && (
            <p className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-slate-200">
              Este profissional ainda não possui serviços vinculados pela administração.
            </p>
          )}
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Data
            </span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-950 outline-none transition duration-200 focus:border-brand-300 focus:ring-4 focus:ring-brand-100/80"
              min={todayInputValue()}
              onChange={(event) => {
                setDate(event.target.value)
                setSlot('')
              }}
              type="date"
              value={date}
            />
          </label>

          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Horário
            </p>
            {slotResult.message && (
              <p
                className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-medium ${
                  slotResult.status === 'closed'
                    ? 'border-rose-200/80 bg-rose-50/70 text-rose-700'
                    : 'border-brand-100 bg-brand-50 text-slate-700'
                }`}
              >
                {slotResult.message}
              </p>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slots.map((item) => (
                <button
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                    slot === item.value && item.available
                      ? 'border-brand-200 bg-brand-50 text-brand-600'
                      : item.available
                        ? 'border-slate-200 bg-white text-slate-600 hover:border-brand-200'
                        : 'cursor-not-allowed border-rose-200/80 bg-rose-50/70 text-rose-500'
                  }`}
                  disabled={!item.available}
                  key={item.value}
                  onClick={() => setSlot(item.value)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            {isAllDayUnavailable && (
              <p className="mt-3 rounded-2xl border border-rose-200/80 bg-rose-50/70 px-4 py-3 text-sm font-medium text-rose-700">
                Este profissional não está disponível neste dia.
              </p>
            )}
            {serviceId && date && !hasAvailableSlots && (
              <div className="mt-4 rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Nenhum horário disponível para essa combinação.
                </p>
                {canUseWaitlist ? (
                  <>
                    <p className="mt-1 text-sm text-slate-500">
                      Entre na lista de espera e avisaremos por WhatsApp quando surgir
                      uma vaga.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <Select
                        label="Período preferido"
                        onChange={(event) =>
                          setPreferredPeriod(
                            event.target.value as typeof preferredPeriod,
                          )
                        }
                        options={[
                          { label: 'Qualquer horário', value: 'qualquer' },
                          { label: 'Manhã', value: 'manha' },
                          { label: 'Tarde', value: 'tarde' },
                          { label: 'Noite', value: 'noite' },
                        ]}
                        value={preferredPeriod}
                      />
                      <div className="flex items-end">
                        <Button
                          disabled={waitlistMutation.isPending}
                          onClick={() =>
                            waitlistMutation.mutate(undefined, {
                              onError: (error) =>
                                setFormError(
                                  error instanceof Error
                                    ? error.message
                                    : 'Não foi possível entrar na lista de espera.',
                                ),
                            })
                          }
                          type="button"
                          variant="secondary"
                        >
                          {waitlistMutation.isPending
                            ? 'Salvando...'
                            : 'Entrar na lista de espera'}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-slate-700">
                    A lista de espera não está disponível no plano atual desta barbearia.
                  </p>
                )}
              </div>
            )}
          </div>

          <Button
            disabled={bookingMutation.isPending || Boolean(slot && !selectedSlotIsAvailable)}
            leftIcon={<CalendarPlus size={18} />}
            onClick={() => {
              setFormError(null)
              bookingMutation.mutate(undefined, {
                onError: (error) =>
                  setFormError(
                    error instanceof Error
                      ? error.message
                      : 'Não foi possível agendar.',
                  ),
              })
            }}
          >
            {bookingMutation.isPending ? 'Agendando...' : 'Confirmar horário'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
