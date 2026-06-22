import { z } from 'zod'

export const benefitProgramTypes = [
  { label: 'Plano Mensal', value: 'plano_mensal' },
  { label: 'Pacote Pré-pago', value: 'pacote_pre_pago' },
  { label: 'Cartão Fidelidade', value: 'cartao_fidelidade' },
] as const

export const benefitRuleTypes = [
  { label: 'Por quantidade de atendimentos', value: 'quantidade_atendimentos' },
  { label: 'Por valor gasto', value: 'valor_gasto' },
  { label: 'Por serviço específico', value: 'servico_especifico' },
  { label: 'Por período', value: 'periodo' },
  { label: 'Manual', value: 'manual' },
] as const

export const benefitRewardTypes = [
  { label: 'Serviço grátis', value: 'servico_gratis' },
  { label: 'Desconto em valor', value: 'desconto_valor' },
  { label: 'Desconto percentual', value: 'desconto_percentual' },
  { label: 'Crédito em conta', value: 'credito_conta' },
  { label: 'Brinde', value: 'brinde' },
  { label: 'Recompensa manual', value: 'manual' },
] as const

export const benefitTargetTypes = [
  { label: 'Todos os clientes', value: 'todos_clientes' },
] as const

export const serviceScopeTypes = [
  { label: 'Todos os serviços', value: 'todos_servicos' },
  { label: 'Serviços específicos', value: 'servicos_especificos' },
] as const

export const benefitProgramSchema = z.object({
  acumulavel: z
    .preprocess((value) => value === true || value === 'true', z.boolean())
    .default(false),
  categorias_servico: z.string().optional(),
  cliente_ids: z.array(z.string()).default([]),
  descricao: z.string().optional(),
  meta_quantidade: z.coerce.number().min(0).optional(),
  meta_valor: z.coerce.number().min(0).optional(),
  nome: z.string().min(2, 'Informe o nome do benefício.'),
  publico_alvo: z.string().default('todos_clientes'),
  regra_acumulo: z.string().optional(),
  regra_resgate: z.string().optional(),
  recompensa_descricao: z.string().optional(),
  recompensa_valor: z.coerce.number().min(0).default(0),
  renovacao_periodo: z.string().optional(),
  servico_ids: z.array(z.string()).default([]),
  servico_recompensa_id: z.string().optional(),
  service_scope: z.string().default('todos_servicos'),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
  tipo: z.enum(['plano_mensal', 'pacote_pre_pago', 'cartao_fidelidade']),
  tipo_regra: z.string().default('manual'),
  tipo_recompensa: z.string().default('manual'),
  validade_dias: z.coerce.number().int().min(0).optional(),
  valor: z.coerce.number().min(0, 'O valor não pode ser negativo.').default(0),
})

export type BenefitProgramFormData = z.output<typeof benefitProgramSchema>
export type BenefitProgramFormInput = z.input<typeof benefitProgramSchema>
