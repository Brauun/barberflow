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
  type ClientAppointment,
} from '../services/clientService'
import {
  listBusinessHours,
  listSpecialBusinessHoursForDate,
} from '../services/businessHoursService'
import { buildBookingSlots } from '../utils/bookingSlots'

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

  const businessHoursQuery = useQuery({
    enabled: Boolean(selectedAppointment?.empresa_id),
    queryFn: () => listBusinessHours(selectedAppointment?.empresa_id as string),
    queryKey: ['business-hours', selectedAppointment?.empresa_id],
  })

  const specialHoursQuery = useQuery({
    enabled: Boolean(selectedAppointment?.empresa_id && rescheduleDate),
    queryFn: () =>
      listSpecialBusinessHoursForDate(
        selectedAppointment?.empresa_id as string,
        rescheduleDate,
      ),
    queryKey: [
      'special-business-hours',
      selectedAppointment?.empresa_id,
      rescheduleDate,
    ],
  })

  const slotResult = useMemo(
    () =>
      buildBookingSlots({
        appointments: busyQuery.data ?? [],
        businessHours: businessHoursQuery.data ?? [],
        date: rescheduleDate,
        durationMinutes: duration,
        specialHour: specialHoursQuery.data,
        unavailability: unavailabilityQuery.data ?? [],
      }),
    [
      busyQuery.data,
      businessHoursQuery.data,
      duration,
      rescheduleDate,
      specialHoursQuery.data,
      unavailabilityQuery.data,
    ],
  )
  const slots = slotResult.slots

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
        throw new Error('Selecione um novo horário.')
      }

      const slot = slots.find((item) => item.value === selectedSlot)

      if (!slot?.available) {
        throw new Error('Este horário não está disponível.')
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
          Seus horários
        </h2>
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">
            Histórico e próximos horários
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
                        'Serviço'}
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
                              'Tem certeza que deseja cancelar este horário?',
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
                                    : 'Não foi possível cancelar.',
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
                      {entry.service?.nome ?? 'Serviço'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(`${entry.desired_date}T00:00:00`).toLocaleDateString(
                        'pt-BR',
                      )}{' '}
                      · {entry.preferred_period ?? 'qualquer horário'}
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
              Você ainda não entrou em nenhuma lista de espera.
            </p>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={Boolean(selectedAppointment)}
        onClose={() => setSelectedAppointment(null)}
        title="Remarcar horário"
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
              Novo horário
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
