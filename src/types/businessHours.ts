import { z } from 'zod'

export const weekDays = [
  { label: 'Domingo', value: 0 },
  { label: 'Segunda-feira', value: 1 },
  { label: 'Terca-feira', value: 2 },
  { label: 'Quarta-feira', value: 3 },
  { label: 'Quinta-feira', value: 4 },
  { label: 'Sexta-feira', value: 5 },
  { label: 'Sabado', value: 6 },
] as const

export const businessHourSchema = z
  .object({
    break_end: z.string().optional().nullable(),
    break_start: z.string().optional().nullable(),
    close_time: z.string().optional().nullable(),
    day_of_week: z.coerce.number().min(0).max(6),
    is_open: z.boolean(),
    open_time: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.is_open) {
      return
    }

    if (!data.open_time || !data.close_time) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe abertura e fechamento para dias abertos.',
        path: ['open_time'],
      })
      return
    }

    if (data.open_time >= data.close_time) {
      ctx.addIssue({
        code: 'custom',
        message: 'A abertura deve ser antes do fechamento.',
        path: ['open_time'],
      })
    }

    if ((data.break_start && !data.break_end) || (!data.break_start && data.break_end)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe inicio e fim da pausa.',
        path: ['break_start'],
      })
      return
    }

    if (data.break_start && data.break_end) {
      if (data.break_start >= data.break_end) {
        ctx.addIssue({
          code: 'custom',
          message: 'A pausa deve iniciar antes de terminar.',
          path: ['break_start'],
        })
      }

      if (
        data.open_time &&
        data.close_time &&
        (data.break_start < data.open_time || data.break_end > data.close_time)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'A pausa precisa estar dentro do expediente.',
          path: ['break_start'],
        })
      }
    }
  })

export const businessHoursSchema = z.array(businessHourSchema).length(7)

export type BusinessHourFormData = z.output<typeof businessHourSchema>
