import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Gift } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge, Button, Card, CardContent, CardHeader, DateInput, Select } from '../components/ui'
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
  hasConfiguredBusinessHours,
  listBusinessHours,
  listSpecialBusinessHoursForDate,
} from '../services/businessHoursService'
import {
  canWriteData,
  canUseFeature,
  fetchSubscriptionData,
  getSubscriptionAccessState,
} from '../services/subscriptionsService'
import { listMyClientBenefits } from '../services/benefitsService'
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
  const [selectedBenefitId, setSelectedBenefitId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const confirmActionRef = useRef<HTMLDivElement | null>(null)

  const primaryQuery = useQuery({
    enabled: Boolean(clientProfile?.primary_barbershop_id),
    queryFn: () => getPrimaryBarbershop(clientProfile as NonNullable<typeof clientProfile>),
    queryKey: ['client-primary-barbershop', clientProfile?.id, clientProfile?.primary_barbershop_id],
  })
  const barbershop = primaryQuery.data
  const subscriptionQuery = useQuery({
    enabled: Boolean(barbershop?.empresa_id),
    queryFn: () => fetchSubscriptionData(barbershop?.empresa_id as string),
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

  const businessHoursQuery = useQuery({
    enabled: Boolean(barbershop?.empresa_id),
    queryFn: () => listBusinessHours(barbershop?.empresa_id as string),
    queryKey: ['business-hours', barbershop?.empresa_id],
  })
  const isAgendaConfigured = hasConfiguredBusinessHours(
    businessHoursQuery.data ?? [],
  )

  const busyQuery = useQuery({
    enabled: Boolean(barbershop?.id && barberId && date && isAgendaConfigured),
    queryFn: () =>
      listBarberAppointments(
        barbershop?.id as string,
        barberId,
        date,
        undefined,
      ),
    queryKey: ['booking-busy', barbershop?.id, barbershop?.empresa_id, barberId, date],
  })

  const unavailabilityQuery = useQuery({
    enabled: Boolean(
      barbershop?.empresa_id && barberId && date && isAgendaConfigured,
    ),
    queryFn: () =>
      listBarberUnavailabilityForDate(
        barbershop?.empresa_id as string,
        barberId,
        date,
      ),
    queryKey: ['booking-unavailability', barbershop?.empresa_id, barberId, date],
  })

  const specialHoursQuery = useQuery({
    enabled: Boolean(barbershop?.empresa_id && date && isAgendaConfigured),
    queryFn: () =>
      listSpecialBusinessHoursForDate(barbershop?.empresa_id as string, date),
    queryKey: ['special-business-hours', barbershop?.empresa_id, date],
  })

  const benefitsQuery = useQuery({
    enabled: Boolean(barbershop?.empresa_id && clientProfile?.id),
    queryFn: () =>
      listMyClientBenefits(barbershop?.empresa_id as string, clientProfile?.id as string),
    queryKey: ['client-benefits-own', barbershop?.empresa_id, clientProfile?.id],
  })

  const availableBenefits = useMemo(
    () =>
      (benefitsQuery.data ?? []).filter(
        (benefit) =>
          benefit.status === 'ativo' &&
          (Number(benefit.saldo_usos) > 0 || Number(benefit.saldo_credito) > 0),
      ),
    [benefitsQuery.data],
  )

  const slotResult = useMemo(() => {
    if (!businessHoursQuery.isFetched) {
      return { slots: [], status: 'available' as const }
    }

    return buildBookingSlots({
        appointments: busyQuery.data ?? [],
        businessHours: businessHoursQuery.data ?? [],
        date,
        durationMinutes: duration,
        specialHour: specialHoursQuery.data,
        unavailability: unavailabilityQuery.data ?? [],
      })
    }, [
      busyQuery.data,
      businessHoursQuery.data,
      businessHoursQuery.isFetched,
      date,
      duration,
      specialHoursQuery.data,
      unavailabilityQuery.data,
    ])
  const slots = slotResult.slots
  const isAllDayUnavailable = Boolean(
    barberId && unavailabilityQuery.data?.some((block) => block.all_day),
  )
  const selectedSlotIsAvailable = Boolean(
    slot && slots.some((item) => item.value === slot && item.available),
  )
  const hasAvailableSlots = slots.some((item) => item.available)

  useEffect(() => {
    if (!selectedSlotIsAvailable) {
      return
    }

    confirmActionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }, [selectedSlotIsAvailable, slot])

  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (
        subscriptionQuery.data &&
        !canWriteData(getSubscriptionAccessState(subscriptionQuery.data.subscription))
      ) {
        throw new Error(
          'Esta barbearia está com o acesso limitado e não pode receber novos agendamentos no momento.',
        )
      }

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
        clientBenefitId: selectedBenefitId || null,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client-appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['booking-busy'] }),
        queryClient.invalidateQueries({ queryKey: ['client-benefits-own'] }),
      ])
      navigate('/cliente/agendamentos')
    },
  })

  const waitlistMutation = useMutation({
    mutationFn: async () => {
      if (
        subscriptionQuery.data &&
        !canWriteData(getSubscriptionAccessState(subscriptionQuery.data.subscription))
      ) {
        throw new Error(
          'Esta barbearia está com o acesso limitado e não pode receber novas solicitações no momento.',
        )
      }

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
    <div className="space-y-6 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:space-y-8 md:pb-0">
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
        <CardContent className="space-y-5 pb-6 md:pb-5">
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
              setSelectedBenefitId('')
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
              setSelectedBenefitId('')
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

          {availableBenefits.length > 0 && (
            <div className="rounded-[1.25rem] border border-brand-100 bg-brand-50/60 p-4 dark:border-brand-500/20 dark:bg-brand-500/10">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-brand-600 dark:bg-slate-900 dark:text-brand-300">
                  <Gift size={18} />
                </span>
                <div>
                  <p className="font-black text-slate-950 dark:text-white">
                    Você possui benefício disponível
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Escolha se deseja aplicar neste agendamento.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    selectedBenefitId === ''
                      ? 'border-slate-950 bg-slate-950 text-white dark:border-brand-400 dark:bg-brand-500 dark:text-slate-950'
                      : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                  onClick={() => setSelectedBenefitId('')}
                  type="button"
                >
                  Não usar agora
                </button>
                {availableBenefits.map((benefit) => (
                  <button
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      selectedBenefitId === benefit.id
                        ? 'border-slate-950 bg-slate-950 text-white dark:border-brand-400 dark:bg-brand-500 dark:text-slate-950'
                        : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                    key={benefit.id}
                    onClick={() => setSelectedBenefitId(benefit.id)}
                    type="button"
                  >
                    <span className="block text-sm font-black">
                      {benefit.program?.nome ?? 'Benefício'}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="success">{Number(benefit.saldo_usos)} uso(s)</Badge>
                      {Number(benefit.saldo_credito) > 0 && (
                        <Badge>{currencyFormatter.format(Number(benefit.saldo_credito))}</Badge>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {barberId && !servicesQuery.isLoading && servicesQuery.data?.length === 0 && (
            <p className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-slate-200">
              Este profissional ainda não possui serviços vinculados pela administração.
            </p>
          )}
          <DateInput
            label="Data"
            min={todayInputValue()}
            onChange={(value) => {
              setDate(value)
              setSlot('')
            }}
            value={date}
          />

          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Horário
            </p>
            {slotResult.status === 'agenda_not_configured' ? (
              <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 dark:border-brand-500/20 dark:bg-brand-500/10">
                <p className="text-sm font-black text-slate-950 dark:text-slate-50">
                  Sua agenda ainda não foi configurada.
                </p>
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                  Configure os dias e horários de funcionamento para liberar agendamentos.
                </p>
              </div>
            ) : slotResult.message ? (
              <p
                className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-medium ${
                  slotResult.status === 'closed'
                    ? 'border-rose-200/80 bg-rose-50/70 text-rose-700'
                    : 'border-brand-100 bg-brand-50 text-slate-700'
                }`}
              >
                {slotResult.message}
              </p>
            ) : null}
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
            {serviceId &&
              date &&
              !hasAvailableSlots &&
              slotResult.status !== 'agenda_not_configured' && (
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

          <div ref={confirmActionRef}>
            <Button
              className="w-full sm:w-auto"
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
