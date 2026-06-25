import type {
  BusinessHour,
  SpecialBusinessHour,
} from '../services/businessHoursService'
import type { BookingUnavailability } from '../services/clientService'

export type BookingSlot = {
  label: string
  value: string
  available: boolean
}

export type BookingSlotResult = {
  slots: BookingSlot[]
  status: 'available' | 'not_configured' | 'closed'
  message?: string
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function minutesFromDate(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)

  return hour * 60 + minute
}

function dateDayOfWeek(date: string) {
  const [year, month, day] = date.split('-').map(Number)

  return new Date(year, month - 1, day).getDay()
}

function toLocalIso(date: string, minutes: number) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60

  return new Date(
    `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
  ).toISOString()
}

export function buildBookingSlots(input: {
  date: string
  durationMinutes: number
  appointments: Array<{ starts_at: string; ends_at: string }>
  unavailability: BookingUnavailability[]
  businessHours: BusinessHour[]
  specialHour?: SpecialBusinessHour | null
}) {
  const specialHour = input.specialHour

  if (specialHour) {
    if (specialHour.is_closed) {
      return {
        message: specialHour.reason
          ? `Esta barbearia não atende neste dia: ${specialHour.reason}.`
          : 'Esta barbearia não atende neste dia.',
        slots: [],
        status: 'closed',
      } satisfies BookingSlotResult
    }

    if (!specialHour.open_time || !specialHour.close_time) {
      return {
        message: 'Agenda ainda não configurada pela barbearia.',
        slots: [],
        status: 'not_configured',
      } satisfies BookingSlotResult
    }
  }

  const daySchedule = input.businessHours.find(
    (hour) => hour.day_of_week === dateDayOfWeek(input.date),
  )

  if (!specialHour && !daySchedule) {
    return {
      message: 'Agenda ainda não configurada pela barbearia.',
      slots: [],
      status: 'not_configured',
    } satisfies BookingSlotResult
  }

  const isOpen = specialHour ? !specialHour.is_closed : Boolean(daySchedule?.is_open)
  const openTime = specialHour?.open_time ?? daySchedule?.open_time
  const closeTime = specialHour?.close_time ?? daySchedule?.close_time
  const breakStart = specialHour ? null : daySchedule?.break_start
  const breakEnd = specialHour ? null : daySchedule?.break_end

  if (!isOpen) {
    return {
      message: 'Esta barbearia não atende neste dia.',
      slots: [],
      status: 'closed',
    } satisfies BookingSlotResult
  }

  if (!openTime || !closeTime) {
    return {
      message: 'Agenda ainda não configurada pela barbearia.',
      slots: [],
      status: 'not_configured',
    } satisfies BookingSlotResult
  }

  const slots: BookingSlot[] = []
  const openMinutes = timeToMinutes(openTime)
  const closeMinutes = timeToMinutes(closeTime)
  const breakStartMinutes = breakStart ? timeToMinutes(breakStart) : null
  const breakEndMinutes = breakEnd ? timeToMinutes(breakEnd) : null
  const isAllDayBlocked = input.unavailability.some((block) => block.all_day)

  for (
    let minutes = openMinutes;
    minutes <= closeMinutes - input.durationMinutes;
    minutes += 30
  ) {
    const slotEnd = minutes + input.durationMinutes
    const hasBreakConflict =
      breakStartMinutes !== null &&
      breakEndMinutes !== null &&
      minutes < breakEndMinutes &&
      slotEnd > breakStartMinutes

    const hasAppointmentConflict = input.appointments.some((appointment) => {
      const busyStart = new Date(appointment.starts_at)
      const busyEnd = new Date(appointment.ends_at)
      const busyStartDate = localDateKey(busyStart)
      const busyEndDate = localDateKey(busyEnd)
      const busyStartMinutes =
        busyStartDate === input.date ? minutesFromDate(busyStart) : openMinutes
      const busyEndMinutes =
        busyEndDate === input.date ? minutesFromDate(busyEnd) : closeMinutes

      if (busyStartDate !== input.date && busyEndDate !== input.date) {
        return false
      }

      return minutes < busyEndMinutes && slotEnd > busyStartMinutes
    })

    const hasUnavailabilityConflict =
      isAllDayBlocked ||
      input.unavailability.some((block) => {
        if (block.all_day) {
          return true
        }

        if (!block.start_time || !block.end_time) {
          return true
        }

        const blockStart = timeToMinutes(block.start_time)
        const blockEnd = timeToMinutes(block.end_time)

        return minutes < blockEnd && slotEnd > blockStart
      })

    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60

    slots.push({
      available:
        !hasBreakConflict && !hasAppointmentConflict && !hasUnavailabilityConflict,
      label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      value: toLocalIso(input.date, minutes),
    })
  }

  return {
    slots,
    status: 'available',
  } satisfies BookingSlotResult
}
