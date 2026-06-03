import { supabase } from '../lib/supabase'
import type { BarbeiroFormData } from '../types/barbeiros'
import type { Database } from '../types/database'

export type Barbeiro = Database['public']['Tables']['barbeiros']['Row']

export type BarbeiroWithIndicators = Barbeiro & {
  atendimentos_count: number
  valor_faturado: number
  comissao_acumulada: number
}

type AtendimentoIndicator = {
  barbeiro_id: string
  valor: number
}

type ComissaoIndicator = {
  barbeiro_id: string
  valor_comissao: number
}

function normalizeBarbeiroInput(data: BarbeiroFormData, empresaId: string) {
  return {
    empresa_id: empresaId,
    nome: data.nome.trim(),
    telefone: data.telefone?.trim() || null,
    percentual_comissao: Number(data.percentual_comissao),
  }
}

export async function listBarbeiros(
  empresaId: string,
  search: string,
): Promise<BarbeiroWithIndicators[]> {
  let barbeirosQuery = supabase
    .from('barbeiros')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nome', { ascending: true })

  const normalizedSearch = search.trim()

  if (normalizedSearch) {
    barbeirosQuery = barbeirosQuery.or(
      `nome.ilike.%${normalizedSearch}%,telefone.ilike.%${normalizedSearch}%`,
    )
  }

  const [barbeirosResponse, atendimentosResponse, comissoesResponse] =
    await Promise.all([
      barbeirosQuery,
      supabase
        .from('atendimentos')
        .select('barbeiro_id,valor')
        .eq('empresa_id', empresaId)
        .eq('status', 'concluido'),
      supabase
        .from('comissoes')
        .select('barbeiro_id,valor_comissao')
        .eq('empresa_id', empresaId)
        .neq('status', 'cancelada'),
    ])

  const failedResponse = [
    barbeirosResponse,
    atendimentosResponse,
    comissoesResponse,
  ].find((response) => response.error)

  if (failedResponse?.error) {
    throw new Error(failedResponse.error.message)
  }

  const atendimentos =
    (atendimentosResponse.data ?? []) as AtendimentoIndicator[]
  const comissoes = (comissoesResponse.data ?? []) as ComissaoIndicator[]

  return ((barbeirosResponse.data ?? []) as Barbeiro[]).map((barbeiro) => {
    const atendimentosDoBarbeiro = atendimentos.filter(
      (atendimento) => atendimento.barbeiro_id === barbeiro.id,
    )
    const comissoesDoBarbeiro = comissoes.filter(
      (comissao) => comissao.barbeiro_id === barbeiro.id,
    )

    return {
      ...barbeiro,
      atendimentos_count: atendimentosDoBarbeiro.length,
      comissao_acumulada: comissoesDoBarbeiro.reduce(
        (total, comissao) => total + Number(comissao.valor_comissao),
        0,
      ),
      valor_faturado: atendimentosDoBarbeiro.reduce(
        (total, atendimento) => total + Number(atendimento.valor),
        0,
      ),
    }
  })
}

export async function createBarbeiro(
  empresaId: string,
  data: BarbeiroFormData,
) {
  const { error } = await supabase
    .from('barbeiros')
    .insert(normalizeBarbeiroInput(data, empresaId))

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateBarbeiro(
  empresaId: string,
  barbeiroId: string,
  data: BarbeiroFormData,
) {
  const { error } = await supabase
    .from('barbeiros')
    .update(normalizeBarbeiroInput(data, empresaId))
    .eq('empresa_id', empresaId)
    .eq('id', barbeiroId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteBarbeiro(empresaId: string, barbeiroId: string) {
  const { error } = await supabase
    .from('barbeiros')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id', barbeiroId)

  if (error) {
    throw new Error(error.message)
  }
}
