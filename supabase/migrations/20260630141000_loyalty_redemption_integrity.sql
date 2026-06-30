begin;

create or replace function public.redeem_client_benefit(
  p_client_benefit_id uuid,
  p_appointment_id uuid
)
returns public.client_benefits
language plpgsql
security definer
set search_path = public
as $$
declare
  benefit_row public.client_benefits%rowtype;
  appointment_row public.appointments%rowtype;
  program_row public.benefit_programs%rowtype;
  rule_row public.benefit_rules%rowtype;
  reward_row public.benefit_rewards%rowtype;
  discount_value numeric := 0;
  target_item_id uuid;
  target_item_value numeric := 0;
begin
  select * into benefit_row from public.client_benefits
  where id = p_client_benefit_id and status = 'ativo' for update;
  if benefit_row.id is null then raise exception 'Benefício não encontrado ou indisponível.'; end if;

  if benefit_row.expires_at is not null and benefit_row.expires_at <= now() then
    update public.client_benefits set status = 'expirado', updated_at = now()
    where id = benefit_row.id;
    raise exception 'Benefício expirado.';
  end if;

  select * into appointment_row from public.appointments
  where id = p_appointment_id for update;
  if appointment_row.id is null then raise exception 'Agendamento não encontrado.'; end if;
  if appointment_row.client_profile_id is distinct from benefit_row.client_profile_id
    or appointment_row.empresa_id is distinct from benefit_row.empresa_id then
    raise exception 'Benefício não pertence a este cliente ou empresa.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = appointment_row.client_profile_id and p.auth_user_id = auth.uid()
  ) and not public.has_empresa_role(benefit_row.empresa_id, array['administrador', 'barbeiro']) then
    raise exception 'Sem permissão para usar este benefício.';
  end if;
  if appointment_row.status not in ('agendado', 'confirmado', 'em_atendimento') then
    raise exception 'Benefício só pode ser aplicado antes da conclusão.';
  end if;
  if exists (
    select 1 from public.benefit_usage_logs
    where client_benefit_id = benefit_row.id
      and atendimento_id = appointment_row.id and tipo = 'uso'
  ) then raise exception 'Benefício já aplicado neste agendamento.'; end if;
  if coalesce(benefit_row.saldo_usos, 0) <= 0
    and coalesce(benefit_row.saldo_credito, 0) <= 0 then
    raise exception 'Benefício sem saldo disponível.';
  end if;

  select * into program_row from public.benefit_programs
  where id = benefit_row.program_id and empresa_id = benefit_row.empresa_id
    and status = 'ativo';
  if program_row.id is null then raise exception 'Programa indisponível.'; end if;
  select * into rule_row from public.benefit_rules
  where program_id = benefit_row.program_id and empresa_id = benefit_row.empresa_id
  order by created_at limit 1;
  select * into reward_row from public.benefit_rewards
  where program_id = benefit_row.program_id and empresa_id = benefit_row.empresa_id
  order by created_at limit 1;
  if reward_row.id is null then raise exception 'Recompensa não configurada.'; end if;

  select ai.id, ai.valor_final into target_item_id, target_item_value
  from public.appointment_items ai
  where ai.appointment_id = appointment_row.id
    and (coalesce(array_length(rule_row.servico_ids, 1), 0) = 0
      or ai.servico_id = any(rule_row.servico_ids))
    and (reward_row.servico_id is null or ai.servico_id = reward_row.servico_id)
  order by ai.valor_final desc limit 1;
  if target_item_id is null then raise exception 'Benefício não é válido para o serviço selecionado.'; end if;

  if reward_row.tipo_recompensa = 'desconto_valor' then
    discount_value := least(coalesce(reward_row.valor, 0), target_item_value);
  elsif reward_row.tipo_recompensa = 'desconto_percentual' then
    discount_value := round(target_item_value * (coalesce(reward_row.valor, 0) / 100), 2);
  elsif reward_row.tipo_recompensa = 'credito_conta'
    and coalesce(benefit_row.saldo_credito, 0) > 0 then
    discount_value := least(benefit_row.saldo_credito, target_item_value);
  elsif reward_row.tipo_recompensa = 'servico_gratis'
    or program_row.tipo in ('plano_mensal', 'pacote_pre_pago') then
    discount_value := target_item_value;
  else
    discount_value := least(coalesce(reward_row.valor, 0), target_item_value);
  end if;

  if discount_value <= 0 then raise exception 'Benefício não possui valor aplicável.'; end if;

  update public.appointment_items
  set valor_desconto = least(coalesce(valor_desconto, 0) + discount_value, valor_original),
      valor_final = greatest(coalesce(valor_final, 0) - discount_value, 0),
      updated_at = now()
  where id = target_item_id;

  update public.appointments
  set valor_desconto = least(coalesce(valor_desconto, 0) + discount_value, valor_original),
      valor_final = greatest(coalesce(valor_final, 0) - discount_value, 0),
      motivo_desconto = coalesce(motivo_desconto, 'Benefício BW Barber'),
      updated_at = now()
  where id = appointment_row.id returning * into appointment_row;

  update public.client_benefits
  set saldo_usos = case when coalesce(saldo_usos, 0) > 0 then saldo_usos - 1 else saldo_usos end,
      saldo_credito = case
        when reward_row.tipo_recompensa = 'credito_conta' and saldo_credito > 0
          then greatest(saldo_credito - discount_value, 0) else saldo_credito end,
      updated_at = now()
  where id = benefit_row.id returning * into benefit_row;

  insert into public.benefit_usage_logs (
    empresa_id, program_id, client_benefit_id, cliente_id, client_profile_id,
    atendimento_id, tipo, valor_desconto, descricao, metadata
  ) values (
    benefit_row.empresa_id, benefit_row.program_id, benefit_row.id,
    benefit_row.cliente_id, benefit_row.client_profile_id, appointment_row.id,
    'uso', discount_value, 'Benefício aplicado ao agendamento.',
    jsonb_build_object('reward_type', reward_row.tipo_recompensa,
      'service_item_id', target_item_id)
  );
  return benefit_row;
end;
$$;

create or replace function public.create_client_appointment_with_benefit(
  p_barbershop_id uuid,
  p_client_profile_id uuid,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_client_benefit_id uuid default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare appointment_row public.appointments%rowtype;
begin
  appointment_row := public.create_client_appointment(
    p_barbershop_id, p_client_profile_id, p_barbeiro_id,
    p_servico_id, p_starts_at, p_ends_at
  );
  if p_client_benefit_id is not null then
    perform public.redeem_client_benefit(p_client_benefit_id, appointment_row.id);
    select * into appointment_row from public.appointments where id = appointment_row.id;
  end if;
  return appointment_row;
end;
$$;

revoke all on function public.create_client_appointment_with_benefit(
  uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid
) from public;
grant execute on function public.create_client_appointment_with_benefit(
  uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid
) to authenticated;

create or replace function public.create_internal_appointment_with_benefit(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_is_walk_in boolean,
  p_walk_in_customer_name text,
  p_walk_in_customer_phone text,
  p_walk_in_notes text,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_valor_original numeric,
  p_valor_desconto numeric default 0,
  p_valor_final numeric default null,
  p_motivo_desconto text default null,
  p_client_benefit_id uuid default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare appointment_row public.appointments%rowtype;
begin
  if p_is_walk_in and p_client_benefit_id is not null then
    raise exception 'Benefícios não podem ser aplicados a clientes avulsos.';
  end if;

  appointment_row := public.create_internal_appointment(
    p_empresa_id, p_cliente_id, p_is_walk_in, p_walk_in_customer_name,
    p_walk_in_customer_phone, p_walk_in_notes, p_barbeiro_id, p_servico_id,
    p_starts_at, p_ends_at, p_valor_original, p_valor_desconto,
    p_valor_final, p_motivo_desconto
  );
  if p_client_benefit_id is not null then
    perform public.redeem_client_benefit(p_client_benefit_id, appointment_row.id);
    select * into appointment_row from public.appointments where id = appointment_row.id;
  end if;
  return appointment_row;
end;
$$;

revoke all on function public.create_internal_appointment_with_benefit(
  uuid, uuid, boolean, text, text, text, uuid, uuid, timestamptz,
  timestamptz, numeric, numeric, numeric, text, uuid
) from public;
grant execute on function public.create_internal_appointment_with_benefit(
  uuid, uuid, boolean, text, text, text, uuid, uuid, timestamptz,
  timestamptz, numeric, numeric, numeric, text, uuid
) to authenticated;

commit;
