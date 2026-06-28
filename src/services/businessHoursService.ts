import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type { BusinessHourFormData } from '../types/businessHours'

export type BusinessHour =
  Database['public']['Tables']['barbershop_business_hours']['Row']
export type SpecialBusinessHour =
  Database['public']['Tables']['barbershop_special_hours']['Row']

export function hasConfiguredBusinessHours(hours: BusinessHour[]) {
  return hours.some(
    (hour) => hour.is_open && Boolean(hour.open_time) && Boolean(hour.close_time),
  )
}

export function defaultBusinessHours(): BusinessHourFormData[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    break_end: day === 0 ? '' : '13:30',
    break_start: day === 0 ? '' : '12:00',
    close_time: day === 0 ? '' : '18:00',
    day_of_week: day,
    is_open: day !== 0,
    open_time: day === 0 ? '' : '08:00',
  }))
}

export async function listBusinessHours(empresaId: string) {
  const { data, error } = await supabase
    .from('barbershop_business_hours')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('day_of_week', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as BusinessHour[]
}

export async function listSpecialBusinessHoursForDate(
  empresaId: string,
  date: string,
) {
  const { data, error } = await supabase
    .from('barbershop_special_hours')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('date', date)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as SpecialBusinessHour | null
}

export async function saveBusinessHours(
  empresaId: string,
  hours: BusinessHourFormData[],
) {
  const { error } = await supabase.from('barbershop_business_hours').upsert(
    hours.map((hour) => ({
      break_end: hour.is_open ? hour.break_end || null : null,
      break_start: hour.is_open ? hour.break_start || null : null,
      close_time: hour.is_open ? hour.close_time || null : null,
      day_of_week: hour.day_of_week,
      empresa_id: empresaId,
      is_open: hour.is_open,
      open_time: hour.is_open ? hour.open_time || null : null,
    })),
    { onConflict: 'empresa_id,day_of_week' },
  )

  if (error) {
    throw new Error(error.message)
  }
}
