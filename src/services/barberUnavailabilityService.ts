import { supabase } from '../lib/supabase'
import type {
  BarberUnavailabilityFormData,
} from '../types/barberUnavailability'
import type { Database } from '../types/database'

export type BarberUnavailability =
  Database['public']['Tables']['barber_unavailability']['Row'] & {
    barbeiro?: { nome: string } | null
    criado_por?: { nome: string } | null
  }

function normalizeUnavailabilityInput(
  empresaId: string,
  data: BarberUnavailabilityFormData,
  createdBy?: string | null,
) {
  const payload = {
    all_day: data.all_day,
    barber_id: data.barber_id,
    date: data.date,
    empresa_id: empresaId,
    end_time: data.all_day ? null : data.end_time,
    reason: data.reason.trim(),
    start_time: data.all_day ? null : data.start_time,
  }

  if (createdBy !== undefined) {
    return {
      ...payload,
      created_by: createdBy,
    }
  }

  return payload
}

export async function listBarberUnavailability(empresaId: string) {
  const { data, error } = await supabase
    .from('barber_unavailability')
    .select('*,barbeiro:barbeiros(nome),criado_por:usuarios(nome)')
    .eq('empresa_id', empresaId)
    .order('date', { ascending: false })
    .order('start_time', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as BarberUnavailability[]
}

export async function createBarberUnavailability(
  empresaId: string,
  createdBy: string | null,
  data: BarberUnavailabilityFormData,
) {
  const { error } = await supabase
    .from('barber_unavailability')
    .insert(normalizeUnavailabilityInput(empresaId, data, createdBy))

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateBarberUnavailability(
  empresaId: string,
  blockId: string,
  data: BarberUnavailabilityFormData,
) {
  const { error } = await supabase
    .from('barber_unavailability')
    .update(normalizeUnavailabilityInput(empresaId, data))
    .eq('empresa_id', empresaId)
    .eq('id', blockId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteBarberUnavailability(
  empresaId: string,
  blockId: string,
) {
  const { error } = await supabase
    .from('barber_unavailability')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id', blockId)

  if (error) {
    throw new Error(error.message)
  }
}
