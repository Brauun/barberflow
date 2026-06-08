import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, CalendarClock, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Modal,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  cancelClientAppointment,
  cancelWaitlistEntry,
  listBarberAppointments,
  listBarberUnavailabilityForDate,
  listClientAppointments,
  listClientWaitlist,
  rescheduleClientAppointment,
  type BookingUnavailability,
  type ClientAppointment,
} from '../services/clientService'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function minutesFromDate(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function buildSlots(
  date: string,
  durationMinutes: number,
  appointments: Array<{ starts_at: string; ends_at: string }>,
  unavailability: BookingUnavailability[],
) {
  const slots: Array<{ label: string; value: string; available: boolean }> = []
  const openHour = 9
  const closeHour = 19
  const isAllDayBlocked = unavailability.some((block) => block.all_day)

  function timeToMinutes(value: string) {
    const [hour, minute] = value.split(':').map(Number)

    return hour * 60 + minute
  }

  for (
    let minutes = openHour * 60;
    minutes <= closeHour * 60 - durationMinutes;
    minutes += 30
  ) {
    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60
    const startsAt = new Date(
      `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
    )

    const hasAppointmentConflict = appointments.some((appointment) => {
      const busyStart = new Date(appointment.starts_at)
      const busyEnd = new Date(appointment.ends_at)
      const busyStartDate = localDateKey(busyStart)
      const busyEndDate = localDateKey(busyEnd)
      const busyStartMinutes =
        busyStartDate === date ? minutesFromDate(busyStart) : openHour * 60
      const busyEndMinutes =
        busyEndDate === date ? minutesFromDate(busyEnd) : closeHour * 60

      if (busyStartDate !== date && busyEndDate !== date) {
        return false
      }

      return minutes < busyEndMinutes && minutes + durationMinutes > busyStartMinutes
    })
    const hasUnavailabilityConflict =
      isAllDayBlocked ||
      unavailability.some((block) => {
        if (block.all_day) {
          return true
        }

        if (!block.start_time || !block.end_time) {
          return true
        }

        const blockStart = timeToMinutes(block.start_time)
        const blockEnd = timeToMinutes(block.end_time)

        return minutes < blockEnd && minutes + durationMinutes > blockStart
      })

    slots.push({
      available: !hasAppointmentConflict && !hasUnavailabilityConflict,
      label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      value: startsAt.toISOString(),
    })
  }

  return slots
}

function getStatusVariant(status: string) {
  if (status === 'concluido') {
    return 'success'
  }

  if (status === 'cancelado' || status === 'nao_compareceu' || status === 'faltou') {
    return 'danger'
  }

  if (status === 'remarcado') {
    return 'info'
  }

  return 'default'
}

function canChangeAppointment(appointment: ClientAppointment) {
  return (
    new Date(appointment.starts_at).getTime() > Date.now() &&
    !['cancelado', 'concluido', 'remarcado', 'nao_compareceu', 'faltou'].includes(
      appointment.status,
    )
  )
}

export function ClientAppointmentsPage() {
  const { clientProfile } = useAuth()
  const queryClient = useQueryClient()
  const [selectedAppointment, setSelectedAppointment] =
    useState<ClientAppointment | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState(todayInputValue())
  const [selectedSlot, setSelectedSlot] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const appointmentsQuery = useQuery({
    enabled: Boolean(clientProfile?.id),
    queryFn: () => listClientAppointments(clientProfile?.id as string),
    queryKey: ['client-appointments', clientProfile?.id],
  })

  const waitlistQuery = useQuery({
    enabled: Boolean(clientProfile?.id),
    queryFn: () => listClientWaitlist(clientProfile?.id as string),
    queryKey: ['client-waitlist', clientProfile?.id],
  })

  const duration = selectedAppointment?.items?.[0]?.duration_minutes ?? 30

  const busyQuery = useQuery({
    enabled: Boolean(
      selectedAppointment?.barbershop_id &&
        selectedAppointment?.barbeiro_id &&
        rescheduleDate,
    ),
    queryFn: () =>
      listBarberAppointments(
        selectedAppointment?.barbershop_id as string,
        selectedAppointment?.barbeiro_id as string,
        rescheduleDate,
        selectedAppointment?.id,
        selectedAppointment?.empresa_id,
      ),
    queryKey: [
      'booking-busy',
      selectedAppointment?.barbershop_id,
      selectedAppointment?.empresa_id,
      selectedAppointment?.barbeiro_id,
      rescheduleDate,
      selectedAppointment?.id,
    ],
  })

  const unavailabilityQuery = useQuery({
    enabled: Boolean(
      selectedAppointment?.empresa_id &&
        selectedAppointment?.barbeiro_id &&
        rescheduleDate,
    ),
    queryFn: () =>
      listBarberUnavailabilityForDate(
        selectedAppointment?.empresa_id as string,
        selectedAppointment?.barbeiro_id as string,
        rescheduleDate,
      ),
    queryKey: [
      'booking-unavailability',
      selectedAppointment?.empresa_id,
      selectedAppointment?.barbeiro_id,
      rescheduleDate,
    ],
  })

  const slots = useMemo(
    () =>
      buildSlots(
        rescheduleDate,
        duration,
        busyQuery.data ?? [],
        unavailabilityQuery.data ?? [],
      ),
    [busyQuery.data, duration, rescheduleDate, unavailabilityQuery.data],
  )

  const cancelMutation = useMutation({
    mutationFn: cancelClientAppointment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client-appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['booking-busy'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-appointments'] }),
      ])
    },
  })

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAppointment || !selectedSlot) {
        throw new Error('Selecione um novo horario.')
      }

      const slot = slots.find((item) => item.value === selectedSlot)

      if (!slot?.available) {
        throw new Error('Este horario nao esta disponivel.')
      }

      const startsAt = new Date(selectedSlot)
      const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000)

      await rescheduleClientAppointment({
        appointment: selectedAppointment,
        endsAt: endsAt.toISOString(),
        startsAt: startsAt.toISOString(),
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client-appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['booking-busy'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-appointments'] }),
      ])
      setSelectedAppointment(null)
      setSelectedSlot('')
    },
  })

  const cancelWaitlistMutation = useMutation({
    mutationFn: cancelWaitlistEntry,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['client-waitlist'] })
    },
  })

  return (
    <div className="space-y-8">
      <section>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600">
          Agendamentos
        </p>
        <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
          Seus horarios
        </h2>
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">
            Historico e proximos horarios
          </h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {actionError && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {actionError}
            </p>
          )}

          {appointmentsQuery.data?.length ? (
            appointmentsQuery.data.map((appointment) => (
              <div
                className="flex flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between"
                key={appointment.id}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">
                    <CalendarCheck size={18} />
                  </span>
                  <div>
                    <p className="font-black text-slate-950 dark:text-white">
                      {appointment.barbershop?.nome ?? 'Barbearia'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {dateTimeFormatter.format(new Date(appointment.starts_at))}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {appointment.barbeiro?.nome ?? 'Profissional'} ·{' '}
                      {appointment.items?.map((item) => item.nome).join(' + ') ??
                        'Servico'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-black text-brand-600">
                    {currencyFormatter.format(Number(appointment.valor_final))}
                  </p>
                  <Badge variant={getStatusVariant(appointment.status)}>
                    {appointment.status}
                  </Badge>
                  {canChangeAppointment(appointment) && (
                    <>
                      <Button
                        onClick={() => {
                          setSelectedAppointment(appointment)
                          setRescheduleDate(appointment.starts_at.slice(0, 10))
                          setSelectedSlot('')
                          setActionError(null)
                        }}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Remarcar
                      </Button>
                      <Button
                        disabled={cancelMutation.isPending}
                        onClick={() => {
                          const reason =
                            window.prompt('Motivo do cancelamento (opcional)') ??
                            ''

                          if (
                            !window.confirm(
                              'Tem certeza que deseja cancelar este horario?',
                            )
                          ) {
                            return
                          }

                          cancelMutation.mutate(
                            { appointment, reason },
                            {
                              onError: (error) =>
                                setActionError(
                                  error instanceof Error
                                    ? error.message
                                    : 'Nao foi possivel cancelar.',
                                ),
                            },
                          )
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              Nenhum agendamento encontrado ainda.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">
            Lista de espera
          </h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {waitlistQuery.data?.length ? (
            waitlistQuery.data.map((entry) => (
              <div
                className="flex flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between"
                key={entry.id}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-brand-600 dark:bg-brand-500/10">
                    <CalendarClock size={18} />
                  </span>
                  <div>
                    <p className="font-black text-slate-950 dark:text-white">
                      {entry.service?.nome ?? 'Servico'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(`${entry.desired_date}T00:00:00`).toLocaleDateString(
                        'pt-BR',
                      )}{' '}
                      · {entry.preferred_period ?? 'qualquer horario'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={entry.status === 'cancelado' ? 'danger' : 'info'}>
                    {entry.status}
                  </Badge>
                  {['aguardando', 'notificado'].includes(entry.status) && (
                    <Button
                      disabled={cancelWaitlistMutation.isPending}
                      leftIcon={<X size={14} />}
                      onClick={() =>
                        cancelWaitlistMutation.mutate({
                          clientProfileId: clientProfile?.id as string,
                          id: entry.id,
                        })
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              Voce ainda nao entrou em nenhuma lista de espera.
            </p>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={Boolean(selectedAppointment)}
        onClose={() => setSelectedAppointment(null)}
        title="Remarcar horario"
      >
        <div className="space-y-4">
          {rescheduleMutation.error && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {rescheduleMutation.error.message}
            </p>
          )}
          <Input
            label="Nova data"
            min={todayInputValue()}
            onChange={(event) => {
              setRescheduleDate(event.target.value)
              setSelectedSlot('')
            }}
            type="date"
            value={rescheduleDate}
          />
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Novo horario
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((item) => (
                <button
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                    selectedSlot === item.value && item.available
                      ? 'border-brand-200 bg-brand-50 text-brand-600'
                      : item.available
                        ? 'border-slate-200 bg-white text-slate-600 hover:border-brand-200'
                        : 'cursor-not-allowed border-rose-200/80 bg-rose-50/70 text-rose-500'
                  }`}
                  disabled={!item.available}
                  key={item.value}
                  onClick={() => setSelectedSlot(item.value)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setSelectedAppointment(null)}
              type="button"
              variant="secondary"
            >
              Fechar
            </Button>
            <Button
              disabled={rescheduleMutation.isPending || !selectedSlot}
              onClick={() => rescheduleMutation.mutate()}
              type="button"
            >
              {rescheduleMutation.isPending ? 'Remarcando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
