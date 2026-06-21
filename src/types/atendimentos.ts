import { z } from 'zod'

export const atendimentoSchema = z
  .object({
    atendimento_tipo: z.enum(['cadastrado', 'avulso']).default('cadastrado'),
    barbeiro_id: z.string().uuid('Selecione um barbeiro.'),
    benefit_id: z.string().optional(),
    cliente_id: z.string().optional(),
    cliente_avulso_nome: z.string().optional(),
    cliente_avulso_observacao: z.string().optional(),
    cliente_avulso_telefone: z.string().optional(),
    comissao_base: z.enum(['cheio', 'liquido']).default('liquido'),
    data: z.string().min(1, 'Informe a data.'),
    desconto_tipo: z.enum(['valor', 'percentual']).default('valor'),
    forma_pagamento: z.string().optional(),
    hora: z.string().min(1, 'Informe a hora.'),
    motivo_desconto: z
      .enum(['Promoção', 'Cliente fiel', 'Cupom', 'Cortesia', 'Outro'])
      .optional(),
    servico_id: z.string().uuid('Selecione um serviço.'),
    valor: z.coerce.number().min(0, 'O valor não pode ser negativo.'),
    valor_desconto: z.coerce
      .number()
      .min(0, 'O desconto não pode ser negativo.')
      .default(0),
  })
  .superRefine((data, ctx) => {
    if (data.atendimento_tipo === 'cadastrado' && !data.cliente_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selecione um cliente.',
        path: ['cliente_id'],
      })
    }

    if (
      data.atendimento_tipo === 'avulso' &&
      !data.cliente_avulso_nome?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o nome do cliente avulso.',
        path: ['cliente_avulso_nome'],
      })
    }
  })

export type AtendimentoFormInput = z.input<typeof atendimentoSchema>
export type AtendimentoFormData = z.output<typeof atendimentoSchema>
