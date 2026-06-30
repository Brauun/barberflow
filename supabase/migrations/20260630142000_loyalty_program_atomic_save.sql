begin;

create or replace function public.save_benefit_program_bundle(
  p_empresa_id uuid,
  p_program_id uuid,
  p_program jsonb,
  p_rule jsonb,
  p_reward jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_program_id uuid;
begin
  if auth.uid() is null
     or not public.has_empresa_role(p_empresa_id, array['administrador']) then
    raise exception 'Apenas administradores podem gerenciar programas.';
  end if;

  if nullif(trim(p_program->>'nome'), '') is null then
    raise exception 'Informe o nome do benefício.';
  end if;

  if p_program_id is null then
    insert into public.benefit_programs (
      empresa_id, nome, descricao, tipo, valor, validade_dias,
      renovacao_periodo, acumulavel, regra_acumulo, regra_resgate,
      publico_alvo, status, config
    ) values (
      p_empresa_id,
      trim(p_program->>'nome'),
      nullif(trim(p_program->>'descricao'), ''),
      p_program->>'tipo',
      coalesce((p_program->>'valor')::numeric, 0),
      nullif(p_program->>'validade_dias', '')::integer,
      nullif(trim(p_program->>'renovacao_periodo'), ''),
      coalesce((p_program->>'acumulavel')::boolean, false),
      nullif(trim(p_program->>'regra_acumulo'), ''),
      nullif(trim(p_program->>'regra_resgate'), ''),
      coalesce(nullif(p_program->>'publico_alvo', ''), 'todos_clientes'),
      coalesce(nullif(p_program->>'status', ''), 'ativo'),
      coalesce(p_program->'config', '{}'::jsonb)
    ) returning id into saved_program_id;
  else
    update public.benefit_programs
       set nome = trim(p_program->>'nome'),
           descricao = nullif(trim(p_program->>'descricao'), ''),
           tipo = p_program->>'tipo',
           valor = coalesce((p_program->>'valor')::numeric, 0),
           validade_dias = nullif(p_program->>'validade_dias', '')::integer,
           renovacao_periodo = nullif(trim(p_program->>'renovacao_periodo'), ''),
           acumulavel = coalesce((p_program->>'acumulavel')::boolean, false),
           regra_acumulo = nullif(trim(p_program->>'regra_acumulo'), ''),
           regra_resgate = nullif(trim(p_program->>'regra_resgate'), ''),
           publico_alvo = coalesce(nullif(p_program->>'publico_alvo', ''), 'todos_clientes'),
           status = coalesce(nullif(p_program->>'status', ''), 'ativo'),
           config = coalesce(p_program->'config', '{}'::jsonb),
           updated_at = now()
     where id = p_program_id
       and empresa_id = p_empresa_id
     returning id into saved_program_id;

    if saved_program_id is null then
      raise exception 'Programa não encontrado nesta empresa.';
    end if;

    delete from public.benefit_rules
     where empresa_id = p_empresa_id and program_id = saved_program_id;
    delete from public.benefit_rewards
     where empresa_id = p_empresa_id and program_id = saved_program_id;
  end if;

  insert into public.benefit_rules (
    empresa_id, program_id, tipo_regra, parametros,
    servico_ids, categorias_servico, cliente_ids
  ) values (
    p_empresa_id,
    saved_program_id,
    p_rule->>'tipo_regra',
    coalesce(p_rule->'parametros', '{}'::jsonb),
    array(select value::uuid from jsonb_array_elements_text(coalesce(p_rule->'servico_ids', '[]'::jsonb)) as item(value)),
    array(select value from jsonb_array_elements_text(coalesce(p_rule->'categorias_servico', '[]'::jsonb)) as item(value)),
    array(select value::uuid from jsonb_array_elements_text(coalesce(p_rule->'cliente_ids', '[]'::jsonb)) as item(value))
  );

  insert into public.benefit_rewards (
    empresa_id, program_id, tipo_recompensa, descricao,
    valor, servico_id, parametros
  ) values (
    p_empresa_id,
    saved_program_id,
    p_reward->>'tipo_recompensa',
    nullif(trim(p_reward->>'descricao'), ''),
    coalesce((p_reward->>'valor')::numeric, 0),
    nullif(p_reward->>'servico_id', '')::uuid,
    coalesce(p_reward->'parametros', '{}'::jsonb)
  );

  return saved_program_id;
end;
$$;

revoke all on function public.save_benefit_program_bundle(uuid, uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_benefit_program_bundle(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;

commit;
