import { z } from 'zod'

export const contaPagarStatusSchema = z.enum(['pendente', 'paga', 'vencida'])

export const contaPagarSchema = z.object({
  categoria: z.string().min(2, 'Informe a categoria.'),
  data_vencimento: z.string().min(1, 'Informe a data de vencimento.'),
  descricao: z.string().min(2, 'Informe a descrição.'),
  status: contaPagarStatusSchema,
  valor: z.coerce.number().min(0.01, 'Informe um valor maior que zero.'),
})

export type ContaPagarFormInput = z.input<typeof contaPagarSchema>
export type ContaPagarFormData = z.output<typeof contaPagarSchema>
export type ContaPagarStatus = z.infer<typeof contaPagarStatusSchema>
