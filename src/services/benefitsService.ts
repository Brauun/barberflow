import { supabase } from '../lib/supabase'
import type { BenefitProgramFormData } from '../types/benefits'
import type { Database, Json } from '../types/database'

export type BenefitProgram =
  Database['public']['Tables']['benefit_programs']['Row']
export type BenefitRule = Database['public']['Tables']['benefit_rules']['Row']
export type BenefitReward =
  Database['public']['Tables']['benefit_rewards']['Row']
export type ClientBenefit =
  Database['public']['Tables']['client_benefits']['Row'] & {
    cliente?: { nome: string } | null
    program?: { nome: string } | null
  }
export type BenefitUsageLog =
  Database['public']['Tables']['benefit_usage_logs']['Row'] & {
    cliente?: { nome: string } | null
    program?: { nome: string } | null
  }

export type BenefitProgramWithDetails = BenefitProgram & {
  rules: BenefitRule[]
  rewards: BenefitReward[]
  participantsCount: number
  usageCount: number
}

function splitCommaList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeProgramInput(data: BenefitProgramFormData, empresaId: string) {
  return {
    acumulavel: Boolean(data.acumulavel),
    config: {
      categorias_servico: splitCommaList(data.categorias_servico),
      meta_quantidade: data.meta_quantidade ?? null,
      meta_valor: data.meta_valor ?? null,
      service_scope: data.service_scope,
      servico_ids: data.servico_ids,
    } satisfies Json,
    descricao: data.descricao?.trim() || null,
    empresa_id: empresaId,
    nome: data.nome.trim(),
    publico_alvo: data.publico_alvo,
    regra_acumulo: data.regra_acumulo?.trim() || null,
    regra_resgate: data.regra_resgate?.trim() || null,
    renovacao_periodo: data.renovacao_periodo?.trim() || null,
    status: data.status,
    tipo: data.tipo,
    validade_dias: data.validade_dias || null,
    valor: Number(data.valor ?? 0),
  }
}

function normalizeRuleInput(
  data: BenefitProgramFormData,
  empresaId: string,
  programId: string,
) {
  return {
    categorias_servico: splitCommaList(data.categorias_servico),
    cliente_ids: data.cliente_ids,
    empresa_id: empresaId,
    parametros: {
      meta_quantidade: data.meta_quantidade ?? null,
      meta_valor: data.meta_valor ?? null,
      publico_alvo: data.publico_alvo,
      service_scope: data.service_scope,
    } satisfies Json,
    program_id: programId,
    servico_ids: data.servico_ids,
    tipo_regra: data.tipo_regra,
  }
}

function normalizeRewardInput(
  data: BenefitProgramFormData,
  empresaId: string,
  programId: string,
) {
  return {
    descricao: data.recompensa_descricao?.trim() || null,
    empresa_id: empresaId,
    parametros: {
      servico_recompensa_id: data.servico_recompensa_id || null,
    } satisfies Json,
    program_id: programId,
    servico_id: data.servico_recompensa_id || null,
    tipo_recompensa: data.tipo_recompensa,
    valor: Number(data.recompensa_valor ?? 0),
  }
}

export async function listBenefitPrograms(empresaId: string) {
  const [
    programsResponse,
    rulesResponse,
    rewardsResponse,
    participantsResponse,
    usageResponse,
  ] = await Promise.all([
    supabase
      .from('benefit_programs')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false }),
    supabase.from('benefit_rules').select('*').eq('empresa_id', empresaId),
    supabase.from('benefit_rewards').select('*').eq('empresa_id', empresaId),
    supabase.from('client_benefits').select('program_id').eq('empresa_id', empresaId),
    supabase.from('benefit_usage_logs').select('program_id').eq('empresa_id', empresaId),
  ])

  const failedResponse = [
    programsResponse,
    rulesResponse,
    rewardsResponse,
    participantsResponse,
    usageResponse,
  ].find((response) => response.error)

  if (failedResponse?.error) {
    throw new Error(failedResponse.error.message)
  }

  const rules = (rulesResponse.data ?? []) as BenefitRule[]
  const rewards = (rewardsResponse.data ?? []) as BenefitReward[]
  const participants = (participantsResponse.data ?? []) as Array<{
    program_id: string
  }>
  const usage = (usageResponse.data ?? []) as Array<{ program_id: string }>

  return ((programsResponse.data ?? []) as BenefitProgram[]).map((program) => ({
    ...program,
    participantsCount: participants.filter(
      (participant) => participant.program_id === program.id,
    ).length,
    rewards: rewards.filter((reward) => reward.program_id === program.id),
    rules: rules.filter((rule) => rule.program_id === program.id),
    usageCount: usage.filter((log) => log.program_id === program.id).length,
  }))
}

export async function createBenefitProgram(
  empresaId: string,
  data: BenefitProgramFormData,
) {
  const { data: program, error: programError } = await supabase
    .from('benefit_programs')
    .insert(normalizeProgramInput(data, empresaId))
    .select()
    .single()

  if (programError) {
    throw new Error(programError.message)
  }

  const programId = (program as BenefitProgram).id

  const { error: ruleError } = await supabase
    .from('benefit_rules')
    .insert(normalizeRuleInput(data, empresaId, programId))

  if (ruleError) {
    throw new Error(ruleError.message)
  }

  const { error: rewardError } = await supabase
    .from('benefit_rewards')
    .insert(normalizeRewardInput(data, empresaId, programId))

  if (rewardError) {
    throw new Error(rewardError.message)
  }
}

export async function updateBenefitProgram(
  empresaId: string,
  programId: string,
  data: BenefitProgramFormData,
) {
  const { error: programError } = await supabase
    .from('benefit_programs')
    .update(normalizeProgramInput(data, empresaId))
    .eq('empresa_id', empresaId)
    .eq('id', programId)

  if (programError) {
    throw new Error(programError.message)
  }

  await supabase
    .from('benefit_rules')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('program_id', programId)
  await supabase
    .from('benefit_rewards')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('program_id', programId)

  const { error: ruleError } = await supabase
    .from('benefit_rules')
    .insert(normalizeRuleInput(data, empresaId, programId))

  if (ruleError) {
    throw new Error(ruleError.message)
  }

  const { error: rewardError } = await supabase
    .from('benefit_rewards')
    .insert(normalizeRewardInput(data, empresaId, programId))

  if (rewardError) {
    throw new Error(rewardError.message)
  }
}

export async function listClientBenefits(empresaId: string) {
  const { data, error } = await supabase
    .from('client_benefits')
    .select('*,cliente:clientes(nome),program:benefit_programs(nome)')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as ClientBenefit[]
}

export async function listBenefitUsageLogs(empresaId: string) {
  const { data, error } = await supabase
    .from('benefit_usage_logs')
    .select('*,cliente:clientes(nome),program:benefit_programs(nome)')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as BenefitUsageLog[]
}
