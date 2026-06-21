alter table public.client_benefits
  add column if not exists client_profile_id uuid references public.profiles(id) on delete set null;

alter table public.benefit_usage_logs
  add column if not exists client_profile_id uuid references public.profiles(id) on delete set null;

create index if not exists client_benefits_profile_idx
  on public.client_benefits (empresa_id, client_profile_id, status)
  where client_profile_id is not null;

create index if not exists benefit_usage_logs_profile_idx
  on public.benefit_usage_logs (empresa_id, client_profile_id, created_at)
  where client_profile_id is not null;

create unique index if not exists benefit_usage_logs_progress_once_idx
  on public.benefit_usage_logs (empresa_id, program_id, atendimento_id, tipo)
  where atendimento_id is not null and tipo = 'progresso';

create table if not exists public.benefit_interests (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  program_id uuid not null references public.benefit_programs(id) on delete cascade,
  client_profile_id uuid not null references public.profiles(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'negado', 'ativado', 'cancelado')),
  message text,
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, program_id, client_profile_id)
);

create index if not exists benefit_interests_empresa_status_idx
  on public.benefit_interests (empresa_id, status, created_at);

drop trigger if exists benefit_interests_set_updated_at on public.benefit_interests;
create trigger benefit_interests_set_updated_at
before update on public.benefit_interests
for each row execute function public.set_updated_at();

alter table public.benefit_interests enable row level security;

drop policy if exists "benefit_interests_client_own_select" on public.benefit_interests;
create policy "benefit_interests_client_own_select"
on public.benefit_interests
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = benefit_interests.client_profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "benefit_interests_client_own_insert" on public.benefit_interests;
create policy "benefit_interests_client_own_insert"
on public.benefit_interests
for insert
with check (
  status = 'pendente'
  and exists (
    select 1
    from public.profiles p
    where p.id = benefit_interests.client_profile_id
      and p.auth_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.client_barbershop cb
    join public.barbershops b on b.id = cb.barbershop_id
    where cb.client_profile_id = benefit_interests.client_profile_id
      and b.empresa_id = benefit_interests.empresa_id
  )
);

drop policy if exists "benefit_interests_admin_manage" on public.benefit_interests;
create policy "benefit_interests_admin_manage"
on public.benefit_interests
for all
using (public.has_empresa_role(empresa_id, array['administrador']))
with check (public.has_empresa_role(empresa_id, array['administrador']));

drop policy if exists "client_benefits_client_own_select" on public.client_benefits;
create policy "client_benefits_client_own_select"
on public.client_benefits
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = client_benefits.client_profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "benefit_usage_logs_client_own_select" on public.benefit_usage_logs;
create policy "benefit_usage_logs_client_own_select"
on public.benefit_usage_logs
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = benefit_usage_logs.client_profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "benefit_programs_client_active_select" on public.benefit_programs;
create policy "benefit_programs_client_active_select"
on public.benefit_programs
for select
using (
  status = 'ativo'
  and exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and (
        p.primary_barbershop_id in (
          select b.id from public.barbershops b where b.empresa_id = benefit_programs.empresa_id
        )
        or exists (
          select 1
          from public.client_barbershop cb
          join public.barbershops b on b.id = cb.barbershop_id
          where cb.client_profile_id = p.id
            and b.empresa_id = benefit_programs.empresa_id
        )
      )
  )
);

drop policy if exists "benefit_rules_client_active_select" on public.benefit_rules;
create policy "benefit_rules_client_active_select"
on public.benefit_rules
for select
using (
  exists (
    select 1
    from public.benefit_programs bp
    where bp.id = benefit_rules.program_id
      and bp.empresa_id = benefit_rules.empresa_id
      and bp.status = 'ativo'
  )
);

drop policy if exists "benefit_rewards_client_active_select" on public.benefit_rewards;
create policy "benefit_rewards_client_active_select"
on public.benefit_rewards
for select
using (
  exists (
    select 1
    from public.benefit_programs bp
    where bp.id = benefit_rewards.program_id
      and bp.empresa_id = benefit_rewards.empresa_id
      and bp.status = 'ativo'
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
  select * into profile_row
  from public.profiles
  where auth_user_id = auth.uid()
    and role = 'cliente'
  limit 1;

  if profile_row.id is null then
    raise exception 'Perfil de cliente não encontrado.';
  end if;

  select * into program_row
  from public.benefit_programs
  where id = p_program_id
    and status = 'ativo';

  if program_row.id is null then
    raise exception 'Programa indisponível.';
  end if;

  if not exists (
    select 1
    from public.client_barbershop cb
    join public.barbershops b on b.id = cb.barbershop_id
    where cb.client_profile_id = profile_row.id
      and b.empresa_id = program_row.empresa_id
  ) then
    raise exception 'Cliente sem vínculo com esta barbearia.';
  end if;

  select * into client_row
  from public.clientes
  where empresa_id = program_row.empresa_id
    and client_profile_id = profile_row.id
  limit 1;

  insert into public.benefit_interests (
    empresa_id,
    program_id,
    client_profile_id,
    cliente_id,
    status,
    message
  )
  values (
    program_row.empresa_id,
    program_row.id,
    profile_row.id,
    client_row.id,
    'pendente',
    nullif(trim(coalesce(p_message, '')), '')
  )
  on conflict (empresa_id, program_id, client_profile_id)
  do update set
    status = 'pendente',
    message = excluded.message,
    decided_at = null,
    decided_by = null,
    updated_at = now()
  returning * into interest_row;

  insert into public.notifications (
    empresa_id,
    recipient_user_id,
    type,
    title,
    message,
    metadata,
    created_at
  )
  select
    program_row.empresa_id,
    u.id,
    'benefit_interest_created',
    'Interesse em benefício',
    coalesce(profile_row.nome, 'Cliente') || ' demonstrou interesse em ' || program_row.nome || '.',
    jsonb_build_object(
      'route', '/app/planos-fidelidade',
      'entity_type', 'benefit_interest',
      'entity_id', interest_row.id,
      'program_id', program_row.id,
      'client_profile_id', profile_row.id
    ),
    now()
  from public.usuarios u
  where u.empresa_id = program_row.empresa_id
    and u.role = 'administrador';

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
  benefit_row public.client_benefits%rowtype;
begin
  if p_status not in ('aprovado', 'negado', 'ativado', 'cancelado') then
    raise exception 'Status inválido.';
  end if;

  select * into interest_row
  from public.benefit_interests
  where id = p_interest_id
  for update;

  if interest_row.id is null then
    raise exception 'Interesse não encontrado.';
  end if;

  if not public.has_empresa_role(interest_row.empresa_id, array['administrador']) then
    raise exception 'Apenas administradores podem revisar interesses.';
  end if;

  update public.benefit_interests
  set status = p_status,
      decided_at = now(),
      decided_by = auth.uid(),
      updated_at = now()
  where id = p_interest_id
  returning * into interest_row;

  if p_status in ('aprovado', 'ativado') then
    select * into program_row
    from public.benefit_programs
    where id = interest_row.program_id;

    insert into public.client_benefits (
      empresa_id,
      program_id,
      cliente_id,
      client_profile_id,
      status,
      saldo_usos,
      saldo_credito,
      pontos,
      expires_at,
      metadata
    )
    values (
      interest_row.empresa_id,
      interest_row.program_id,
      interest_row.cliente_id,
      interest_row.client_profile_id,
      'ativo',
      case when program_row.tipo in ('pacote_pre_pago', 'beneficio_manual', 'cortesia', 'cupom') then 1 else 0 end,
      0,
      0,
      case when program_row.validade_dias is not null and program_row.validade_dias > 0
        then now() + make_interval(days => program_row.validade_dias)
        else null
      end,
      jsonb_build_object('source', 'interest', 'interest_id', interest_row.id)
    )
    returning * into benefit_row;

    insert into public.benefit_usage_logs (
      empresa_id,
      program_id,
      client_benefit_id,
      cliente_id,
      client_profile_id,
      tipo,
      descricao,
      metadata
    )
    values (
      interest_row.empresa_id,
      interest_row.program_id,
      benefit_row.id,
      interest_row.cliente_id,
      interest_row.client_profile_id,
      'ativacao_manual',
      'Benefício ativado pela barbearia.',
      jsonb_build_object('interest_id', interest_row.id)
    );
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
  item_row record;
  program_row record;
  reward_row public.benefit_rewards%rowtype;
  benefit_row public.client_benefits%rowtype;
  client_row public.clientes%rowtype;
  points_to_add numeric;
  target_points numeric;
  generated_count integer := 0;
begin
  select * into appointment_row
  from public.appointments
  where id = p_appointment_id
    and empresa_id = p_empresa_id
    and status in ('concluido', 'concluido_automatico');

  if appointment_row.id is null or appointment_row.client_profile_id is null then
    return 0;
  end if;

  select * into client_row
  from public.clientes
  where empresa_id = p_empresa_id
    and client_profile_id = appointment_row.client_profile_id
  limit 1;

  for item_row in
    select ai.servico_id, ai.valor_final
    from public.appointment_items ai
    where ai.appointment_id = appointment_row.id
  loop
    for program_row in
      select bp.*, br.tipo_regra, br.parametros, br.servico_ids, br.cliente_ids
      from public.benefit_programs bp
      join public.benefit_rules br on br.program_id = bp.id and br.empresa_id = bp.empresa_id
      where bp.empresa_id = p_empresa_id
        and bp.status = 'ativo'
        and br.tipo_regra in ('quantidade_atendimentos', 'valor_gasto', 'servico_especifico')
        and (coalesce(array_length(br.cliente_ids, 1), 0) = 0 or client_row.id = any(br.cliente_ids))
        and (
          br.tipo_regra <> 'servico_especifico'
          or coalesce(array_length(br.servico_ids, 1), 0) = 0
          or item_row.servico_id = any(br.servico_ids)
        )
    loop
      if exists (
        select 1
        from public.benefit_usage_logs l
        where l.empresa_id = p_empresa_id
          and l.program_id = program_row.id
          and l.atendimento_id = appointment_row.id
          and l.tipo = 'progresso'
      ) then
        continue;
      end if;

      points_to_add := case
        when program_row.tipo_regra = 'valor_gasto' then coalesce(item_row.valor_final, 0)
        else 1
      end;

      target_points := coalesce(
        nullif((program_row.parametros ->> 'meta_quantidade')::numeric, 0),
        nullif((program_row.parametros ->> 'meta_valor')::numeric, 0),
        1
      );

      select * into benefit_row
      from public.client_benefits
      where empresa_id = p_empresa_id
        and program_id = program_row.id
        and client_profile_id = appointment_row.client_profile_id
        and status = 'ativo'
      order by created_at desc
      limit 1;

      if benefit_row.id is null then
        insert into public.client_benefits (
          empresa_id,
          program_id,
          cliente_id,
          client_profile_id,
          status,
          pontos,
          saldo_usos,
          saldo_credito,
          expires_at,
          metadata
        )
        values (
          p_empresa_id,
          program_row.id,
          client_row.id,
          appointment_row.client_profile_id,
          'ativo',
          0,
          0,
          0,
          case when program_row.validade_dias is not null and program_row.validade_dias > 0
            then now() + make_interval(days => program_row.validade_dias)
            else null
          end,
          jsonb_build_object('source', 'automatic_progress')
        )
        returning * into benefit_row;
      end if;

      update public.client_benefits
      set pontos = coalesce(pontos, 0) + points_to_add,
          updated_at = now()
      where id = benefit_row.id
      returning * into benefit_row;

      select * into reward_row
      from public.benefit_rewards
      where empresa_id = p_empresa_id
        and program_id = program_row.id
      limit 1;

      if benefit_row.pontos >= target_points then
        update public.client_benefits
        set pontos = greatest(benefit_row.pontos - target_points, 0),
            saldo_usos = coalesce(saldo_usos, 0) + 1,
            saldo_credito = coalesce(saldo_credito, 0)
              + case when reward_row.tipo_recompensa = 'credito_conta' then coalesce(reward_row.valor, 0) else 0 end,
            updated_at = now()
        where id = benefit_row.id
        returning * into benefit_row;

        generated_count := generated_count + 1;

        insert into public.benefit_usage_logs (
          empresa_id,
          program_id,
          client_benefit_id,
          cliente_id,
          client_profile_id,
          atendimento_id,
          tipo,
          descricao,
          metadata
        )
        values (
          p_empresa_id,
          program_row.id,
          benefit_row.id,
          client_row.id,
          appointment_row.client_profile_id,
          appointment_row.id,
          'beneficio_liberado',
          'Recompensa liberada automaticamente.',
          jsonb_build_object('target_points', target_points, 'points_added', points_to_add)
        );
      end if;

      insert into public.benefit_usage_logs (
        empresa_id,
        program_id,
        client_benefit_id,
        cliente_id,
        client_profile_id,
        atendimento_id,
        tipo,
        descricao,
        metadata
      )
      values (
        p_empresa_id,
        program_row.id,
        benefit_row.id,
        client_row.id,
        appointment_row.client_profile_id,
        appointment_row.id,
        'progresso',
        'Atendimento concluído somou progresso.',
        jsonb_build_object('target_points', target_points, 'points_added', points_to_add)
      )
      on conflict do nothing;
    end loop;
  end loop;

  return generated_count;
end;
$$;

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
  reward_row public.benefit_rewards%rowtype;
  discount_value numeric := 0;
  target_item_id uuid;
  target_item_value numeric := 0;
begin
  select * into benefit_row
  from public.client_benefits
  where id = p_client_benefit_id
    and status = 'ativo'
  for update;

  if benefit_row.id is null then
    raise exception 'Benefício não encontrado ou indisponível.';
  end if;

  select * into appointment_row
  from public.appointments
  where id = p_appointment_id
  for update;

  if appointment_row.id is null then
    raise exception 'Agendamento não encontrado.';
  end if;

  if appointment_row.client_profile_id is distinct from benefit_row.client_profile_id
    or appointment_row.empresa_id is distinct from benefit_row.empresa_id then
    raise exception 'Benefício não pertence a este cliente ou empresa.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = appointment_row.client_profile_id
      and p.auth_user_id = auth.uid()
  ) and not public.has_empresa_role(benefit_row.empresa_id, array['administrador', 'barbeiro']) then
    raise exception 'Sem permissão para usar este benefício.';
  end if;

  if appointment_row.status not in ('agendado', 'confirmado', 'em_atendimento') then
    raise exception 'Benefício só pode ser aplicado antes da conclusão.';
  end if;

  if coalesce(benefit_row.saldo_usos, 0) <= 0
    and coalesce(benefit_row.saldo_credito, 0) <= 0 then
    raise exception 'Benefício sem saldo disponível.';
  end if;

  select * into reward_row
  from public.benefit_rewards
  where empresa_id = benefit_row.empresa_id
    and program_id = benefit_row.program_id
  limit 1;

  select id, valor_final into target_item_id, target_item_value
  from public.appointment_items
  where appointment_id = appointment_row.id
    and (reward_row.servico_id is null or servico_id = reward_row.servico_id)
  order by valor_final desc
  limit 1;

  if reward_row.tipo_recompensa = 'desconto_valor' then
    discount_value := least(coalesce(reward_row.valor, 0), appointment_row.valor_final);
  elsif reward_row.tipo_recompensa = 'desconto_percentual' then
    discount_value := round(appointment_row.valor_final * (coalesce(reward_row.valor, 0) / 100), 2);
  elsif reward_row.tipo_recompensa = 'credito_conta' then
    discount_value := least(coalesce(benefit_row.saldo_credito, 0), appointment_row.valor_final);
  elsif reward_row.tipo_recompensa = 'servico_gratis' then
    discount_value := least(coalesce(target_item_value, appointment_row.valor_final), appointment_row.valor_final);
  else
    discount_value := least(coalesce(reward_row.valor, 0), appointment_row.valor_final);
  end if;

  update public.appointments
  set valor_desconto = coalesce(valor_desconto, 0) + discount_value,
      valor_final = greatest(coalesce(valor_final, 0) - discount_value, 0),
      motivo_desconto = coalesce(motivo_desconto, 'Benefício BW Barber'),
      updated_at = now()
  where id = appointment_row.id
  returning * into appointment_row;

  if target_item_id is not null and discount_value > 0 then
    update public.appointment_items
    set valor_desconto = coalesce(valor_desconto, 0) + discount_value,
        valor_final = greatest(coalesce(valor_final, 0) - discount_value, 0),
        updated_at = now()
    where id = target_item_id;
  end if;

  update public.client_benefits
  set saldo_usos = case
        when coalesce(saldo_usos, 0) > 0 then saldo_usos - 1
        else saldo_usos
      end,
      saldo_credito = case
        when reward_row.tipo_recompensa = 'credito_conta'
          then greatest(coalesce(saldo_credito, 0) - discount_value, 0)
        else saldo_credito
      end,
      updated_at = now()
  where id = benefit_row.id
  returning * into benefit_row;

  insert into public.benefit_usage_logs (
    empresa_id,
    program_id,
    client_benefit_id,
    cliente_id,
    client_profile_id,
    atendimento_id,
    tipo,
    valor_desconto,
    descricao,
    metadata
  )
  values (
    benefit_row.empresa_id,
    benefit_row.program_id,
    benefit_row.id,
    benefit_row.cliente_id,
    benefit_row.client_profile_id,
    appointment_row.id,
    'uso',
    discount_value,
    'Benefício aplicado ao agendamento.',
    jsonb_build_object('reward_type', reward_row.tipo_recompensa)
  );

  return benefit_row;
end;
$$;
