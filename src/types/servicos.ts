import { z } from 'zod'

export const servicoSchema = z.object({
  ativo: z.coerce.boolean(),
  duracao_minutos: z.coerce
    .number()
    .int('A duração deve ser um número inteiro.')
    .min(1, 'Informe a duração estimada.'),
  nome: z.string().min(2, 'Informe o nome do serviço.'),
  preco: z.coerce.number().min(0, 'O preço não pode ser negativo.'),
})

export type ServicoFormInput = z.input<typeof servicoSchema>
export type ServicoFormData = z.output<typeof servicoSchema>
