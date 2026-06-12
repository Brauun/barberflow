alter table public.appointments
  add column if not exists auto_completed boolean not null default false,
  add column if not exists auto_completed_at timestamptz,
  add column if not exists auto_completed_by text;

alter table public.atendimentos
  add column if not exists auto_completed boolean not null default false,
  add column if not exists auto_completed_at timestamptz,
  add column if not exists auto_completed_by text;

do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.appointments'::regclass
    and conname like '%status%check%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.appointments drop constraint %I', constraint_name);
  end if;
end;
$$;

alter table public.appointments
  add constraint appointments_status_check
  check (status in (
    'agendado',
    'confirmado',
    'em_atendimento',
    'aguardando_finalizacao',
    'concluido',
    'concluido_automatico',
    'cancelado',
    'remarcado',
    'nao_compareceu',
    'faltou'
  ));

do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.atendimentos'::regclass
    and conname like '%status%check%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.atendimentos drop constraint %I', constraint_name);
  end if;
end;
$$;

alter table public.atendimentos
  add constraint atendimentos_status_check
  check (status in (
    'agendado',
    'confirmado',
    'em_atendimento',
    'aguardando_finalizacao',
    'concluido',
    'concluido_automatico',
    'cancelado',
    'remarcado',
    'nao_compareceu',
    'faltou'
  ));

insert into public.configuracoes (empresa_id, chave, valor)
select
  e.id,
  'atendimentos_auto_complete',
  jsonb_build_object(
    'enabled', true,
    'after_minutes', 60,
    'allow_reversal', true,
    'reversal_hours', 24
  )
from public.empresas e
where not exists (
  select 1
  from public.configuracoes c
  where c.empresa_id = e.id
    and c.chave = 'atendimentos_auto_complete'
);

create or replace function public.get_appointment_auto_complete_config(
  p_empresa_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  config_value jsonb;
begin
  select valor
  into config_value
  from public.configuracoes
  where empresa_id = p_empresa_id
    and chave = 'atendimentos_auto_complete'
  limit 1;

  return jsonb_build_object(
    'enabled', coalesce((config_value->>'enabled')::boolean, true),
    'after_minutes', coalesce((config_value->>'after_minutes')::integer, 60),
    'allow_reversal', coalesce((config_value->>'allow_reversal')::boolean, true),
    'reversal_hours', coalesce((config_value->>'reversal_hours')::integer, 24)
  );
end;
$$;

create or replace function public.save_appointment_auto_complete_config(
  p_empresa_id uuid,
  p_enabled boolean,
  p_after_minutes integer,
  p_allow_reversal boolean,
  p_reversal_hours integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value jsonb;
begin
  if not public.has_empresa_role(p_empresa_id, array['administrador', 'gerente']) then
    raise exception 'Apenas administradores ou gerentes podem alterar esta configuracao.';
  end if;

  if p_after_minutes not in (30, 60, 120, 240) then
    raise exception 'Tempo de finalizacao automatica invalido.';
  end if;

  if p_reversal_hours not in (12, 24, 48) then
    raise exception 'Prazo de correcao invalido.';
  end if;

  next_value := jsonb_build_object(
    'enabled', coalesce(p_enabled, true),
    'after_minutes', p_after_minutes,
    'allow_reversal', coalesce(p_allow_reversal, true),
    'reversal_hours', p_reversal_hours
  );

  insert into public.configuracoes (empresa_id, chave, valor)
  values (p_empresa_id, 'atendimentos_auto_complete', next_value)
  on conflict (empresa_id, chave)
  do update set
    valor = excluded.valor,
    updated_at = now();

  return next_value;
end;
$$;

create or replace function public.complete_appointment_financial_flow_with_status(
  p_empresa_id uuid,
  p_appointment_id uuid,
  p_forma_pagamento text default 'Agendamento',
  p_status text default 'concluido'
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_row public.appointments;
begin
  if p_status not in ('concluido', 'concluido_automatico') then
    raise exception 'Status de conclusao invalido.';
  end if;

  appointment_row := public.complete_appointment_financial_flow(
    p_empresa_id,
    p_appointment_id,
    p_forma_pagamento
  );

  update public.appointments
  set
    status = p_status,
    auto_completed = p_status = 'concluido_automatico',
    auto_completed_at = case when p_status = 'concluido_automatico' then coalesce(auto_completed_at, now()) else auto_completed_at end,
    auto_completed_by = case when p_status = 'concluido_automatico' then 'system' else auto_completed_by end,
    updated_at = now()
  where id = p_appointment_id
    and empresa_id = p_empresa_id
  returning * into appointment_row;

  update public.atendimentos
  set
    status = p_status,
    auto_completed = p_status = 'concluido_automatico',
    auto_completed_at = case when p_status = 'concluido_automatico' then coalesce(auto_completed_at, now()) else auto_completed_at end,
    auto_completed_by = case when p_status = 'concluido_automatico' then 'system' else auto_completed_by end,
    updated_at = now()
  where id = appointment_row.atendimento_id
    and empresa_id = p_empresa_id;

  return appointment_row;
end;
$$;

create or replace function public.process_pending_appointment_completions(
  p_empresa_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  config_value jsonb;
  after_minutes integer;
  changed_count integer := 0;
  appointment_row record;
begin
  if auth.uid() is not null
    and not public.has_empresa_role(p_empresa_id, array['administrador', 'gerente', 'barbeiro', 'recepcao'])
  then
    raise exception 'Usuario sem permissao para processar atendimentos.';
  end if;

  config_value := public.get_appointment_auto_complete_config(p_empresa_id);

  if coalesce((config_value->>'enabled')::boolean, true) = false then
    return 0;
  end if;

  after_minutes := coalesce((config_value->>'after_minutes')::integer, 60);

  for appointment_row in
    update public.appointments a
    set status = 'aguardando_finalizacao',
        updated_at = now()
    where a.empresa_id = p_empresa_id
      and a.status in ('agendado', 'confirmado', 'em_atendimento')
      and a.ends_at < now()
    returning a.*
  loop
    changed_count := changed_count + 1;

    insert into public.appointment_status_logs (
      appointment_id,
      source,
      empresa_id,
      old_status,
      new_status,
      changed_by,
      changed_by_role,
      reason,
      metadata
    )
    values (
      appointment_row.id,
      'appointments',
      p_empresa_id,
      'agendado',
      'aguardando_finalizacao',
      null,
      'system',
      'Atendimento aguardando finalizacao manual.',
      jsonb_build_object('auto_complete_after_minutes', after_minutes)
    );

    perform public.create_internal_notification(
      p_empresa_id,
      'appointment_pending_completion',
      'Finalizacao pendente',
      'Um atendimento terminou. Confirme se foi concluido ou se o cliente nao compareceu.',
      jsonb_build_object('appointmentId', appointment_row.id),
      null
    );
  end loop;

  for appointment_row in
    select *
    from public.appointments a
    where a.empresa_id = p_empresa_id
      and a.status = 'aguardando_finalizacao'
      and a.ends_at + make_interval(mins => after_minutes) <= now()
    for update
  loop
    perform public.complete_appointment_financial_flow_with_status(
      p_empresa_id,
      appointment_row.id,
      'Agendamento',
      'concluido_automatico'
    );

    changed_count := changed_count + 1;

    insert into public.appointment_status_logs (
      appointment_id,
      source,
      empresa_id,
      old_status,
      new_status,
      changed_by,
      changed_by_role,
      reason,
      metadata
    )
    values (
      appointment_row.id,
      'appointments',
      p_empresa_id,
      'aguardando_finalizacao',
      'concluido_automatico',
      null,
      'system',
      'Finalizacao automatica apos ' || after_minutes || ' minutos.',
      jsonb_build_object('auto_complete_after_minutes', after_minutes)
    );
  end loop;

  return changed_count;
end;
$$;

create or replace function public.reverse_auto_completed_appointment(
  p_empresa_id uuid,
  p_appointment_id uuid,
  p_next_status text
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_row public.appointments;
  config_value jsonb;
  reversal_hours integer;
begin
  if p_next_status not in ('concluido', 'nao_compareceu') then
    raise exception 'Status de correcao invalido.';
  end if;

  if not public.has_empresa_role(p_empresa_id, array['administrador', 'gerente', 'barbeiro']) then
    raise exception 'Usuario sem permissao para corrigir atendimento.';
  end if;

  select *
  into appointment_row
  from public.appointments
  where id = p_appointment_id
    and empresa_id = p_empresa_id
  for update;

  if appointment_row.id is null then
    raise exception 'Agendamento nao encontrado.';
  end if;

  if appointment_row.status <> 'concluido_automatico' then
    raise exception 'Somente atendimentos concluidos automaticamente podem ser corrigidos.';
  end if;

  config_value := public.get_appointment_auto_complete_config(p_empresa_id);

  if coalesce((config_value->>'allow_reversal')::boolean, true) = false then
    raise exception 'Correcao de conclusao automatica desativada.';
  end if;

  reversal_hours := coalesce((config_value->>'reversal_hours')::integer, 24);

  if appointment_row.auto_completed_at is not null
    and appointment_row.auto_completed_at + make_interval(hours => reversal_hours) < now()
  then
    raise exception 'Prazo de correcao expirado.';
  end if;

  update public.appointments
  set status = p_next_status,
      updated_at = now()
  where id = p_appointment_id
    and empresa_id = p_empresa_id
  returning * into appointment_row;

  update public.atendimentos
  set status = p_next_status,
      updated_at = now()
  where id = appointment_row.atendimento_id
    and empresa_id = p_empresa_id;

  if p_next_status = 'nao_compareceu' then
    update public.movimentacoes_financeiras
    set status = 'cancelada',
        cancelled_at = now(),
        updated_at = now()
    where empresa_id = p_empresa_id
      and status <> 'cancelada'
      and (
        appointment_id = p_appointment_id
        or atendimento_id = appointment_row.atendimento_id
      );

    update public.comissoes
    set status = 'cancelada',
        updated_at = now()
    where empresa_id = p_empresa_id
      and atendimento_id = appointment_row.atendimento_id;
  end if;

  insert into public.appointment_status_logs (
    appointment_id,
    source,
    empresa_id,
    old_status,
    new_status,
    changed_by,
    changed_by_role,
    reason,
    metadata
  )
  values (
    p_appointment_id,
    'appointments',
    p_empresa_id,
    'concluido_automatico',
    p_next_status,
    auth.uid(),
    'barbearia',
    'Correcao de finalizacao automatica.',
    jsonb_build_object('reversal_hours', reversal_hours)
  );

  return appointment_row;
end;
$$;

revoke all on function public.get_appointment_auto_complete_config(uuid) from public;
revoke all on function public.save_appointment_auto_complete_config(uuid, boolean, integer, boolean, integer) from public;
revoke all on function public.complete_appointment_financial_flow_with_status(uuid, uuid, text, text) from public;
revoke all on function public.process_pending_appointment_completions(uuid) from public;
revoke all on function public.reverse_auto_completed_appointment(uuid, uuid, text) from public;

grant execute on function public.get_appointment_auto_complete_config(uuid) to authenticated;
grant execute on function public.save_appointment_auto_complete_config(uuid, boolean, integer, boolean, integer) to authenticated;
grant execute on function public.complete_appointment_financial_flow_with_status(uuid, uuid, text, text) to authenticated;
grant execute on function public.process_pending_appointment_completions(uuid) to authenticated;
grant execute on function public.reverse_auto_completed_appointment(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
