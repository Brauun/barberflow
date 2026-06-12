import { z } from 'zod'

export const servicoSchema = z.object({
  ativo: z.coerce.boolean(),
  categoria: z.string().optional().default(''),
  descricao: z.string().optional().default(''),
  duracao_minutos: z.coerce
    .number()
    .int('A duração deve ser um número inteiro.')
    .min(1, 'Informe a duração estimada.'),
  nome: z.string().min(2, 'Informe o nome do serviço.'),
  percentual_comissao: z.coerce
    .number()
    .min(0, 'A comissão não pode ser negativa.')
    .max(100, 'A comissão não pode passar de 100%.')
    .optional()
    .default(60),
  preco: z.coerce.number().min(0, 'O preço não pode ser negativo.'),
})

export type ServicoFormInput = z.input<typeof servicoSchema>
export type ServicoFormData = z.output<typeof servicoSchema>
