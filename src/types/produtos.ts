import { z } from 'zod'

export const produtoSchema = z.object({
  ativo: z.coerce.boolean(),
  categoria: z.string().min(2, 'Informe a categoria.'),
  estoque_atual: z.coerce
    .number()
    .int('O estoque deve ser um número inteiro.')
    .min(0, 'O estoque não pode ser negativo.'),
  nome: z.string().min(2, 'Informe o nome do produto.'),
  preco_custo: z.coerce.number().min(0, 'O valor de compra não pode ser negativo.'),
  preco_venda: z.coerce.number().min(0, 'O valor de venda não pode ser negativo.'),
})

export const estoqueSchema = z.object({
  quantidade: z.coerce
    .number()
    .int('A quantidade deve ser um número inteiro.')
    .min(1, 'Informe uma quantidade maior que zero.'),
})

export const vendaProdutoSchema = estoqueSchema.extend({
  forma_pagamento: z.string().min(2, 'Informe a forma de pagamento.'),
})

export type ProdutoFormInput = z.input<typeof produtoSchema>
export type ProdutoFormData = z.output<typeof produtoSchema>
export type EstoqueFormInput = z.input<typeof estoqueSchema>
export type EstoqueFormData = z.output<typeof estoqueSchema>
export type VendaProdutoFormInput = z.input<typeof vendaProdutoSchema>
export type VendaProdutoFormData = z.output<typeof vendaProdutoSchema>
