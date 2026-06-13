import { z } from 'zod'

export const entradaCategorias = [
  'Servicos',
  'Produtos',
  'Receitas Extras',
] as const

export const saidaCategorias = [
  'Aluguel',
  'Água',
  'Luz',
  'Internet',
  'Materiais',
  'Fornecedores',
  'Salários',
  'Outros',
] as const

export const fluxoCaixaSchema = z
  .object({
    categoria: z.string().min(1, 'Selecione uma categoria.'),
    data_movimentacao: z.string().min(1, 'Informe a data.'),
    descricao: z.string().min(2, 'Informe a descrição.'),
    tipo: z.enum(['entrada', 'saida']),
    valor: z.coerce.number().min(0.01, 'Informe um valor maior que zero.'),
  })
  .refine(
    (data) =>
      data.tipo === 'entrada'
        ? entradaCategorias.includes(
            data.categoria as (typeof entradaCategorias)[number],
          )
        : saidaCategorias.includes(
            data.categoria as (typeof saidaCategorias)[number],
          ),
    {
      message: 'Categoria inválida para o tipo selecionado.',
      path: ['categoria'],
    },
  )

export type FluxoCaixaFormInput = z.input<typeof fluxoCaixaSchema>
export type FluxoCaixaFormData = z.output<typeof fluxoCaixaSchema>
