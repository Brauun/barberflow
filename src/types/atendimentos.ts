import { z } from 'zod'

export const atendimentoSchema = z.object({
  barbeiro_id: z.string().uuid('Selecione um barbeiro.'),
  cliente_id: z.string().uuid('Selecione um cliente.'),
  data: z.string().min(1, 'Informe a data.'),
  forma_pagamento: z.string().min(2, 'Informe a forma de pagamento.'),
  hora: z.string().min(1, 'Informe a hora.'),
  servico_id: z.string().uuid('Selecione um serviço.'),
  valor: z.coerce.number().min(0, 'O valor não pode ser negativo.'),
})

export type AtendimentoFormInput = z.input<typeof atendimentoSchema>
export type AtendimentoFormData = z.output<typeof atendimentoSchema>
