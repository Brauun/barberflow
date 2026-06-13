import { z } from 'zod'

export const servicoSchema = z.object({
  ativo: z.coerce.boolean(),
  categoria: z.string().optional().default(''),
  descricao: z.string().optional().default(''),
  duracao_minutos: z.coerce
    .number()
    .int('A duracao deve ser um numero inteiro.')
    .min(1, 'Informe a duracao estimada.'),
  nome: z.string().min(2, 'Informe o nome do servico.'),
  percentual_comissao: z.coerce
    .number()
    .min(0, 'A comissao não pode ser negativa.')
    .max(100, 'A comissao não pode passar de 100%.')
    .optional()
    .default(60),
  preco: z.coerce.number().min(0, 'O preco não pode ser negativo.'),
})

export type ServicoFormInput = z.input<typeof servicoSchema>
export type ServicoFormData = z.output<typeof servicoSchema>
