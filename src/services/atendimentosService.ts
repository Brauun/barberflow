import type { PostgrestError } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import type { AtendimentoFormData } from '../types/atendimentos'
import type { Database } from '../types/database'

export type Atendimento = Database['public']['Tables']['atendimentos']['Row']

export type AtendimentoListItem = Atendimento & {
  barbeiros: { nome: string } | null
  clientes: { nome: string } | null
  servicos: { nome: string } | null
}

export type AtendimentoOption = {
  id: string
  nome: string
}

export type ServicoOption = {
  id: string
  nome: string
  preco: number
}

type RegistrarAtendimentoArgs =
  Database['public']['Functions']['registrar_atendimento']['Args']

const registrarAtendimentoRpc = supabase.rpc as unknown as (
  functionName: 'registrar_atendimento',
  args: RegistrarAtendimentoArgs,
) => Promise<{
  data: Atendimento | null
  error: PostgrestError | null
}>

export async function listAtendimentos(
  empresaId: string,
): Promise<AtendimentoListItem[]> {
  const { data, error } = await supabase
    .from('atendimentos')
    .select(
      '*,clientes(nome),barbeiros(nome),servicos(nome)',
    )
    .eq('empresa_id', empresaId)
    .order('data_hora_inicio', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as AtendimentoListItem[]
}

export async function listAtendimentoClientes(
  empresaId: string,
): Promise<AtendimentoOption[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id,nome')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativo')
    .order('nome', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function listAtendimentoBarbeiros(
  empresaId: string,
): Promise<AtendimentoOption[]> {
  const { data, error } = await supabase
    .from('barbeiros')
    .select('id,nome')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativo')
    .order('nome', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function listAtendimentoServicos(
  empresaId: string,
): Promise<ServicoOption[]> {
  const { data, error } = await supabase
    .from('servicos')
    .select('id,nome,preco')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('nome', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function registrarAtendimento(
  empresaId: string,
  data: AtendimentoFormData,
) {
  const dataHoraInicio = new Date(`${data.data}T${data.hora}:00`)

  const { error } = await registrarAtendimentoRpc('registrar_atendimento', {
    p_barbeiro_id: data.barbeiro_id,
    p_cliente_id: data.cliente_id,
    p_data_hora_inicio: dataHoraInicio.toISOString(),
    p_empresa_id: empresaId,
    p_forma_pagamento: data.forma_pagamento,
    p_servico_id: data.servico_id,
    p_valor: Number(data.valor),
  })

  if (error) {
    throw new Error(error.message)
  }
}
