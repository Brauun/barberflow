import { z } from 'zod'

import { onlyDigits } from '../utils/masks'

export const clienteSchema = z.object({
  nome: z.string().min(2, 'Informe o nome do cliente.'),
  telefone: z
    .string()
    .optional()
    .refine((value) => !value || onlyDigits(value).length === 11, {
      message: 'Informe um telefone com 11 dígitos.',
    }),
  data_nascimento: z.string().optional(),
  observacoes: z.string().optional(),
})

export type ClienteFormData = z.infer<typeof clienteSchema>
