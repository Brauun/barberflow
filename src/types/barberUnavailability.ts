import { z } from 'zod'

export const barberUnavailabilityReasons = [
  'Folga',
  'Ferias',
  'Atestado',
  'Horário bloqueado',
  'Compromisso pessoal',
  'Outro',
] as const

export const barberUnavailabilitySchema = z
  .object({
    all_day: z.coerce.boolean(),
    barber_id: z.string().min(1, 'Selecione o barbeiro.'),
    date: z.string().min(1, 'Informe a data.'),
    end_time: z.string().optional(),
    reason: z.string().min(2, 'Informe o motivo.'),
    start_time: z.string().optional(),
  })
  .superRefine((data, context) => {
    if (data.all_day) {
      return
    }

    if (!data.start_time) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe a hora inicial.',
        path: ['start_time'],
      })
    }

    if (!data.end_time) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe a hora final.',
        path: ['end_time'],
      })
    }

    if (data.start_time && data.end_time && data.start_time >= data.end_time) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A hora final deve ser maior que a hora inicial.',
        path: ['end_time'],
      })
    }
  })

export type BarberUnavailabilityFormInput = z.input<
  typeof barberUnavailabilitySchema
>

export type BarberUnavailabilityFormData = z.output<
  typeof barberUnavailabilitySchema
>
