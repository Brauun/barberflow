import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type {
  EstoqueFormData,
  ProdutoFormData,
  VendaProdutoFormData,
} from '../types/produtos'

export type Produto = Database['public']['Tables']['produtos']['Row']

function normalizeProdutoInput(data: ProdutoFormData, empresaId: string) {
  return {
    ativo: data.ativo,
    categoria: data.categoria.trim(),
    empresa_id: empresaId,
    estoque_atual: Number(data.estoque_atual),
    nome: data.nome.trim(),
    preco_custo: Number(data.preco_custo),
    preco_venda: Number(data.preco_venda),
  }
}

export async function listProdutos(
  empresaId: string,
  search: string,
): Promise<Produto[]> {
  let query = supabase
    .from('produtos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nome', { ascending: true })

  const normalizedSearch = search.trim()

  if (normalizedSearch) {
    query = query.or(
      `nome.ilike.%${normalizedSearch}%,categoria.ilike.%${normalizedSearch}%`,
    )
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Produto[]
}

export async function createProduto(empresaId: string, data: ProdutoFormData) {
  const { error } = await supabase
    .from('produtos')
    .insert(normalizeProdutoInput(data, empresaId))

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateProduto(
  empresaId: string,
  produtoId: string,
  data: ProdutoFormData,
) {
  const { error } = await supabase
    .from('produtos')
    .update(normalizeProdutoInput(data, empresaId))
    .eq('empresa_id', empresaId)
    .eq('id', produtoId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteProduto(empresaId: string, produtoId: string) {
  const { error } = await supabase
    .from('produtos')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id', produtoId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function registrarEntradaEstoque(
  empresaId: string,
  produtoId: string,
  data: EstoqueFormData,
) {
  const { error } = await supabase.rpc('registrar_entrada_estoque', {
    p_empresa_id: empresaId,
    p_produto_id: produtoId,
    p_quantidade: Number(data.quantidade),
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function registrarVendaProduto(
  empresaId: string,
  produtoId: string,
  data: VendaProdutoFormData,
) {
  const { error } = await supabase.rpc('registrar_venda_produto', {
    p_empresa_id: empresaId,
    p_forma_pagamento: data.forma_pagamento,
    p_produto_id: produtoId,
    p_quantidade: Number(data.quantidade),
  })

  if (error) {
    throw new Error(error.message)
  }
}
