import { z } from 'zod'

import { onlyDigits } from '../utils/masks'

export const barbeiroSchema = z.object({
  nome: z.string().min(2, 'Informe o nome do barbeiro.'),
  telefone: z
    .string()
    .optional()
    .refine((value) => !value || onlyDigits(value).length === 11, {
      message: 'Informe um telefone com 11 digitos.',
    }),
  percentual_comissao: z.coerce
    .number()
    .min(0, 'A comissão não pode ser negativa.')
    .max(100, 'A comissão não pode passar de 100%.'),
})

export type BarbeiroFormInput = z.input<typeof barbeiroSchema>
export type BarbeiroFormData = z.output<typeof barbeiroSchema>
