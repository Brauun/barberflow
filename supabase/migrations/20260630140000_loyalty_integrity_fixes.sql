begin;

drop policy if exists "benefit_rules_client_active_select" on public.benefit_rules;
create policy "benefit_rules_client_active_select"
on public.benefit_rules for select to authenticated
using (
  exists (
    select 1
    from public.benefit_programs bp
    join public.profiles p on p.auth_user_id = auth.uid() and p.role = 'cliente'
    where bp.id = benefit_rules.program_id
      and bp.empresa_id = benefit_rules.empresa_id
      and bp.status = 'ativo'
      and (
        p.primary_barbershop_id in (
          select b.id from public.barbershops b where b.empresa_id = bp.empresa_id
        )
        or exists (
          select 1 from public.client_barbershop cb
          join public.barbershops b on b.id = cb.barbershop_id
          where cb.client_profile_id = p.id and b.empresa_id = bp.empresa_id
        )
      )
  )
);

drop policy if exists "benefit_rewards_client_active_select" on public.benefit_rewards;
create policy "benefit_rewards_client_active_select"
on public.benefit_rewards for select to authenticated
using (
  exists (
    select 1
    from public.benefit_programs bp
    join public.profiles p on p.auth_user_id = auth.uid() and p.role = 'cliente'
    where bp.id = benefit_rewards.program_id
      and bp.empresa_id = benefit_rewards.empresa_id
      and bp.status = 'ativo'
      and (
        p.primary_barbershop_id in (
          select b.id from public.barbershops b where b.empresa_id = bp.empresa_id
        )
        or exists (
          select 1 from public.client_barbershop cb
          join public.barbershops b on b.id = cb.barbershop_id
          where cb.client_profile_id = p.id and b.empresa_id = bp.empresa_id
        )
      )
  )
);

create or replace function public.request_benefit_interest(
  p_program_id uuid,
  p_message text default null
)
returns public.benefit_interests
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  program_row public.benefit_programs%rowtype;
  client_row public.clientes%rowtype;
  interest_row public.benefit_interests%rowtype;
begin
  select * into profile_row from public.profiles
  where auth_user_id = auth.uid() and role = 'cliente' limit 1;
  if profile_row.id is null then raise exception 'Perfil de cliente não encontrado.'; end if;

  select * into program_row from public.benefit_programs
  where id = p_program_id and status = 'ativo';
  if program_row.id is null then raise exception 'Programa indisponível.'; end if;

  if not exists (
    select 1 from public.client_barbershop cb
    join public.barbershops b on b.id = cb.barbershop_id
    where cb.client_profile_id = profile_row.id
      and b.empresa_id = program_row.empresa_id
  ) and not exists (
    select 1 from public.barbershops b
    where b.id = profile_row.primary_barbershop_id
      and b.empresa_id = program_row.empresa_id
  ) then
    raise exception 'Cliente sem vínculo com esta barbearia.';
  end if;

  select * into client_row from public.clientes
  where empresa_id = program_row.empresa_id
    and client_profile_id = profile_row.id limit 1;

  insert into public.benefit_interests (
    empresa_id, program_id, client_profile_id, cliente_id, status, message
  ) values (
    program_row.empresa_id, program_row.id, profile_row.id, client_row.id,
    'pendente', nullif(trim(coalesce(p_message, '')), '')
  )
  on conflict (empresa_id, program_id, client_profile_id)
  do update set status = 'pendente', message = excluded.message,
    decided_at = null, decided_by = null, updated_at = now()
  returning * into interest_row;

  insert into public.notifications (
    empresa_id, recipient_user_id, type, title, message, metadata, created_at
  )
  select program_row.empresa_id, u.id, 'benefit_interest_created',
    'Interesse em benefício',
    coalesce(profile_row.nome, 'Cliente') || ' demonstrou interesse em ' || program_row.nome || '.',
    jsonb_build_object(
      'route', '/app/planos-fidelidade', 'entity_type', 'benefit_interest',
      'entity_id', interest_row.id, 'program_id', program_row.id,
      'client_profile_id', profile_row.id
    ), now()
  from public.usuarios u
  where u.empresa_id = program_row.empresa_id
    and u.papel = 'administrador' and u.status = 'ativo';

  return interest_row;
end;
$$;

create or replace function public.review_benefit_interest(
  p_interest_id uuid,
  p_status text
)
returns public.benefit_interests
language plpgsql
security definer
set search_path = public
as $$
declare
  interest_row public.benefit_interests%rowtype;
  program_row public.benefit_programs%rowtype;
  rule_row public.benefit_rules%rowtype;
  benefit_row public.client_benefits%rowtype;
  initial_uses numeric := 0;
begin
  if p_status not in ('aprovado', 'negado', 'ativado', 'cancelado') then
    raise exception 'Status inválido.';
  end if;

  select * into interest_row from public.benefit_interests
  where id = p_interest_id for update;
  if interest_row.id is null then raise exception 'Interesse não encontrado.'; end if;
  if not public.has_empresa_role(interest_row.empresa_id, array['administrador']) then
    raise exception 'Apenas administradores podem revisar interesses.';
  end if;

  if interest_row.status = p_status then return interest_row; end if;

  update public.benefit_interests
  set status = p_status, decided_at = now(), decided_by = auth.uid(), updated_at = now()
  where id = p_interest_id returning * into interest_row;

  if p_status in ('aprovado', 'ativado') then
    select * into program_row from public.benefit_programs
    where id = interest_row.program_id and empresa_id = interest_row.empresa_id;
    select * into rule_row from public.benefit_rules
    where program_id = interest_row.program_id and empresa_id = interest_row.empresa_id
    order by created_at limit 1;

    if program_row.status <> 'ativo' then raise exception 'Programa inativo.'; end if;
    initial_uses := case
      when program_row.tipo in ('plano_mensal', 'pacote_pre_pago')
        then greatest(coalesce((rule_row.parametros ->> 'meta_quantidade')::numeric, 1), 1)
      else 0
    end;

    select * into benefit_row from public.client_benefits
    where empresa_id = interest_row.empresa_id
      and program_id = interest_row.program_id
      and client_profile_id = interest_row.client_profile_id
      and status = 'ativo'
    order by created_at desc limit 1 for update;

    if benefit_row.id is null then
      insert into public.client_benefits (
        empresa_id, program_id, cliente_id, client_profile_id, status,
        saldo_usos, saldo_credito, pontos, expires_at, metadata
      ) values (
        interest_row.empresa_id, interest_row.program_id, interest_row.cliente_id,
        interest_row.client_profile_id, 'ativo', initial_uses, 0, 0,
        case when coalesce(program_row.validade_dias, 0) > 0
          then now() + make_interval(days => program_row.validade_dias) else null end,
        jsonb_build_object('source', 'interest', 'interest_id', interest_row.id)
      ) returning * into benefit_row;

      insert into public.benefit_usage_logs (
        empresa_id, program_id, client_benefit_id, cliente_id,
        client_profile_id, tipo, descricao, metadata
      ) values (
        interest_row.empresa_id, interest_row.program_id, benefit_row.id,
        interest_row.cliente_id, interest_row.client_profile_id,
        'ativacao_manual', 'Benefício ativado pela barbearia.',
        jsonb_build_object('interest_id', interest_row.id, 'initial_uses', initial_uses)
      );
    end if;
  end if;

  return interest_row;
end;
$$;

create or replace function public.apply_loyalty_progress_for_appointment(
  p_empresa_id uuid,
  p_appointment_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_row public.appointments%rowtype;
  program_row record;
  reward_row public.benefit_rewards%rowtype;
  benefit_row public.client_benefits%rowtype;
  client_row public.clientes%rowtype;
  points_to_add numeric;
  target_points numeric;
  reward_count integer;
  generated_count integer := 0;
begin
  select * into appointment_row from public.appointments
  where id = p_appointment_id and empresa_id = p_empresa_id
    and status in ('concluido', 'concluido_automatico')
  for update;
  if appointment_row.id is null or appointment_row.client_profile_id is null then return 0; end if;

  select * into client_row from public.clientes
  where empresa_id = p_empresa_id
    and client_profile_id = appointment_row.client_profile_id limit 1;

  for program_row in
    select bp.*, br.tipo_regra, br.parametros, br.servico_ids, br.cliente_ids,
      case
        when br.tipo_regra = 'valor_gasto' then (
          select coalesce(sum(ai.valor_final), 0)
          from public.appointment_items ai
          where ai.appointment_id = appointment_row.id
            and (coalesce(array_length(br.servico_ids, 1), 0) = 0
              or ai.servico_id = any(br.servico_ids))
        )
        else 1
      end as calculated_points
    from public.benefit_programs bp
    join public.benefit_rules br
      on br.program_id = bp.id and br.empresa_id = bp.empresa_id
    where bp.empresa_id = p_empresa_id and bp.status = 'ativo'
      and bp.tipo = 'cartao_fidelidade'
      and br.tipo_regra in ('quantidade_atendimentos', 'valor_gasto', 'servico_especifico')
      and (coalesce(array_length(br.cliente_ids, 1), 0) = 0 or client_row.id = any(br.cliente_ids))
      and (
        coalesce(array_length(br.servico_ids, 1), 0) = 0
        or exists (
          select 1 from public.appointment_items ai
          where ai.appointment_id = appointment_row.id
            and ai.servico_id = any(br.servico_ids)
        )
      )
  loop
    if exists (
      select 1 from public.benefit_usage_logs l
      where l.empresa_id = p_empresa_id and l.program_id = program_row.id
        and l.atendimento_id = appointment_row.id and l.tipo = 'progresso'
    ) then continue; end if;

    points_to_add := greatest(coalesce(program_row.calculated_points, 0), 0);
    if points_to_add = 0 then continue; end if;
    target_points := coalesce(
      nullif((program_row.parametros ->> 'meta_quantidade')::numeric, 0),
      nullif((program_row.parametros ->> 'meta_valor')::numeric, 0), 1
    );

    select * into benefit_row from public.client_benefits
    where empresa_id = p_empresa_id and program_id = program_row.id
      and client_profile_id = appointment_row.client_profile_id and status = 'ativo'
      and (expires_at is null or expires_at > now())
    order by created_at desc limit 1 for update;

    if benefit_row.id is null then
      insert into public.client_benefits (
        empresa_id, program_id, cliente_id, client_profile_id, status,
        pontos, saldo_usos, saldo_credito, expires_at, metadata
      ) values (
        p_empresa_id, program_row.id, client_row.id, appointment_row.client_profile_id,
        'ativo', 0, 0, 0,
        case when coalesce(program_row.validade_dias, 0) > 0
          then now() + make_interval(days => program_row.validade_dias) else null end,
        jsonb_build_object('source', 'automatic_progress')
      ) returning * into benefit_row;
    end if;

    select * into reward_row from public.benefit_rewards
    where empresa_id = p_empresa_id and program_id = program_row.id
    order by created_at limit 1;

    reward_count := floor((coalesce(benefit_row.pontos, 0) + points_to_add) / target_points);
    update public.client_benefits
    set pontos = mod(coalesce(pontos, 0) + points_to_add, target_points),
        saldo_usos = coalesce(saldo_usos, 0) + reward_count,
        saldo_credito = coalesce(saldo_credito, 0) + case
          when reward_row.tipo_recompensa = 'credito_conta'
            then reward_count * coalesce(reward_row.valor, 0) else 0 end,
        updated_at = now()
    where id = benefit_row.id returning * into benefit_row;

    if reward_count > 0 then
      generated_count := generated_count + reward_count;
      insert into public.benefit_usage_logs (
        empresa_id, program_id, client_benefit_id, cliente_id, client_profile_id,
        atendimento_id, tipo, descricao, metadata
      ) values (
        p_empresa_id, program_row.id, benefit_row.id, client_row.id,
        appointment_row.client_profile_id, appointment_row.id, 'beneficio_liberado',
        'Recompensa liberada automaticamente.',
        jsonb_build_object('target_points', target_points, 'points_added', points_to_add,
          'rewards_generated', reward_count)
      );
    end if;

    insert into public.benefit_usage_logs (
      empresa_id, program_id, client_benefit_id, cliente_id, client_profile_id,
      atendimento_id, tipo, descricao, metadata
    ) values (
      p_empresa_id, program_row.id, benefit_row.id, client_row.id,
      appointment_row.client_profile_id, appointment_row.id, 'progresso',
      'Atendimento concluído somou progresso.',
      jsonb_build_object('target_points', target_points, 'points_added', points_to_add)
    ) on conflict do nothing;
  end loop;

  return generated_count;
end;
$$;

create or replace function public.apply_loyalty_on_appointment_completion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('concluido', 'concluido_automatico')
    and old.status not in ('concluido', 'concluido_automatico') then
    perform public.apply_loyalty_progress_for_appointment(new.empresa_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_apply_loyalty_on_completion on public.appointments;
create trigger appointments_apply_loyalty_on_completion
after update of status on public.appointments
for each row execute function public.apply_loyalty_on_appointment_completion();

revoke all on function public.apply_loyalty_progress_for_appointment(uuid, uuid)
  from public, anon, authenticated;

commit;
