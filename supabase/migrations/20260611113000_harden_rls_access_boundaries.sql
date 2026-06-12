-- Harden RLS boundaries after the initial product build.
-- This migration removes broad company-level FOR ALL policies and replaces
-- them with role-aware policies for staff, clients and barbers.

create or replace function public.is_uuid(value text)
returns boolean
language sql
immutable
as $$
  select coalesce(value, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

create or replace function public.current_usuario_id(target_empresa_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select u.id
  from public.usuarios u
  where u.auth_user_id = auth.uid()
    and u.empresa_id = target_empresa_id
    and u.status = 'ativo'
  limit 1;
$$;

create or replace function public.usuario_self_update_safe(
  p_id uuid,
  p_empresa_id uuid,
  p_auth_user_id uuid,
  p_papel text,
  p_status text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = p_id
      and u.auth_user_id = auth.uid()
      and u.empresa_id = p_empresa_id
      and u.auth_user_id = p_auth_user_id
      and u.papel = p_papel
      and u.status = p_status
  );
$$;

create or replace function public.employee_self_update_safe(
  p_id uuid,
  p_auth_user_id uuid,
  p_status text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = p_id
      and e.auth_user_id = auth.uid()
      and e.auth_user_id = p_auth_user_id
      and e.status = p_status
  );
$$;

create or replace function public.is_current_barbeiro(
  target_empresa_id uuid,
  target_barbeiro_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.barbeiros b
    join public.usuarios u
      on u.id = b.usuario_id
     and u.empresa_id = b.empresa_id
    where b.id = target_barbeiro_id
      and b.empresa_id = target_empresa_id
      and b.status = 'ativo'
      and u.auth_user_id = auth.uid()
      and u.status = 'ativo'
      and u.papel = 'barbeiro'
  );
$$;

create or replace function public.can_access_appointment(p_appointment_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    left join public.profiles p on p.id = a.client_profile_id
    where a.id = p_appointment_id
      and (
        (p.auth_user_id = auth.uid() and p.role = 'cliente')
        or public.has_empresa_role(a.empresa_id, array['administrador', 'gerente', 'recepcao'])
        or public.is_current_barbeiro(a.empresa_id, a.barbeiro_id)
      )
  );
$$;

create or replace function public.can_access_atendimento(p_atendimento_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.atendimentos a
    where a.id = p_atendimento_id
      and (
        public.has_empresa_role(a.empresa_id, array['administrador', 'gerente', 'recepcao'])
        or public.is_current_barbeiro(a.empresa_id, a.barbeiro_id)
      )
  );
$$;

create or replace function public.get_booking_busy_slots(
  p_barbershop_id uuid,
  p_barbeiro_id uuid,
  p_date date,
  p_exclude_appointment_id uuid default null
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with target_barbershop as (
    select b.id, b.empresa_id
    from public.barbershops b
    where b.id = p_barbershop_id
      and b.status = 'ativa'
  ),
  access_allowed as (
    select 1
    from target_barbershop tb
    where public.has_empresa_role(tb.empresa_id, array['administrador', 'gerente', 'recepcao'])
      or public.is_current_barbeiro(tb.empresa_id, p_barbeiro_id)
      or exists (
        select 1
        from public.profiles p
        where p.auth_user_id = auth.uid()
          and p.role = 'cliente'
      )
  ),
  day_window as (
    select
      p_date::timestamp as day_start,
      (p_date::timestamp + interval '1 day') as day_end
  )
  select a.starts_at, a.ends_at
  from public.appointments a
  join target_barbershop tb on tb.id = a.barbershop_id
  cross join day_window dw
  where exists (select 1 from access_allowed)
    and a.barbeiro_id = p_barbeiro_id
    and (p_exclude_appointment_id is null or a.id <> p_exclude_appointment_id)
    and a.status not in ('cancelado', 'remarcado', 'nao_compareceu', 'faltou')
    and a.starts_at < dw.day_end
    and a.ends_at > dw.day_start

  union all

  select
    at.data_hora_inicio as starts_at,
    coalesce(
      at.data_hora_fim,
      at.data_hora_inicio
        + make_interval(mins => coalesce(s.duration_minutes, s.duracao_minutos, 30))
    ) as ends_at
  from public.atendimentos at
  join target_barbershop tb on tb.empresa_id = at.empresa_id
  left join public.servicos s on s.id = at.servico_id and s.empresa_id = at.empresa_id
  cross join day_window dw
  where exists (select 1 from access_allowed)
    and at.barbeiro_id = p_barbeiro_id
    and at.status not in ('cancelado', 'remarcado', 'nao_compareceu', 'faltou')
    and at.data_hora_inicio < dw.day_end
    and coalesce(
      at.data_hora_fim,
      at.data_hora_inicio
        + make_interval(mins => coalesce(s.duration_minutes, s.duracao_minutos, 30))
    ) > dw.day_start;
$$;

create or replace function public.create_internal_notification(
  p_empresa_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb default '{}'::jsonb,
  p_barber_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_barber_name text;
  appointment_key text;
  waitlist_key text;
begin
  if auth.uid() is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  appointment_key := coalesce(p_metadata ->> 'appointmentId', p_metadata ->> 'appointment_id');
  waitlist_key := coalesce(p_metadata ->> 'waitlistId', p_metadata ->> 'waitlist_id');

  if not (
    public.has_empresa_role(p_empresa_id, array['administrador', 'gerente', 'recepcao'])
    or (
      public.is_uuid(appointment_key)
      and exists (
        select 1
        from public.appointments a
        join public.profiles p on p.id = a.client_profile_id
        where a.id = appointment_key::uuid
          and a.empresa_id = p_empresa_id
          and p.auth_user_id = auth.uid()
          and p.role = 'cliente'
      )
    )
    or (
      public.is_uuid(waitlist_key)
      and exists (
        select 1
        from public.appointment_waitlist w
        join public.profiles p on p.id = w.client_id
        where w.id = waitlist_key::uuid
          and w.empresa_id = p_empresa_id
          and p.auth_user_id = auth.uid()
          and p.role = 'cliente'
      )
    )
  ) then
    raise exception 'Usuario sem permissao para criar notificacao nesta empresa.';
  end if;

  normalized_barber_name := nullif(lower(trim(coalesce(p_barber_name, ''))), '');

  insert into public.notifications (
    empresa_id,
    recipient_user_id,
    type,
    title,
    message,
    metadata
  )
  select
    p_empresa_id,
    u.id,
    p_type,
    p_title,
    p_message,
    coalesce(p_metadata, '{}'::jsonb)
  from public.usuarios u
  where u.empresa_id = p_empresa_id
    and u.status = 'ativo'
    and (
      u.papel in ('administrador', 'gerente')
      or (
        normalized_barber_name is not null
        and u.papel = 'barbeiro'
        and lower(trim(u.nome)) = normalized_barber_name
      )
    )
  on conflict do nothing;
end;
$$;

create or replace function public.create_client_appointment(
  p_barbershop_id uuid,
  p_client_profile_id uuid,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  barbershop_row public.barbershops;
  barber_row public.barbeiros;
  service_row public.servicos;
  appointment_row public.appointments;
  service_duration integer;
begin
  if auth.uid() is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'Horario de agendamento invalido.';
  end if;

  select *
  into profile_row
  from public.profiles p
  where p.id = p_client_profile_id
    and p.auth_user_id = auth.uid()
    and p.role = 'cliente';

  if profile_row.id is null then
    raise exception 'Perfil de cliente invalido para o usuario autenticado.';
  end if;

  select *
  into barbershop_row
  from public.barbershops b
  where b.id = p_barbershop_id
    and b.status = 'ativa';

  if barbershop_row.id is null or barbershop_row.empresa_id is null then
    raise exception 'Barbearia indisponivel para agendamento.';
  end if;

  select *
  into barber_row
  from public.barbeiros b
  where b.id = p_barbeiro_id
    and b.empresa_id = barbershop_row.empresa_id
    and b.status = 'ativo';

  if barber_row.id is null then
    raise exception 'Profissional indisponivel para agendamento.';
  end if;

  select *
  into service_row
  from public.servicos s
  where s.id = p_servico_id
    and s.empresa_id = barbershop_row.empresa_id
    and s.ativo = true
    and coalesce(s.status, 'ativo') <> 'inativo';

  if service_row.id is null then
    raise exception 'Servico indisponivel para agendamento.';
  end if;

  if not exists (
    select 1
    from public.barber_services bs
    where bs.empresa_id = barbershop_row.empresa_id
      and bs.barbeiro_id = p_barbeiro_id
      and bs.service_id = p_servico_id
      and bs.active = true
  ) then
    raise exception 'Este profissional nao executa o servico selecionado.';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.barbershop_id = p_barbershop_id
      and a.barbeiro_id = p_barbeiro_id
      and a.status not in ('cancelado', 'remarcado', 'nao_compareceu', 'faltou')
      and a.starts_at < p_ends_at
      and a.ends_at > p_starts_at
  ) then
    raise exception 'Este horario acabou de ficar indisponivel. Escolha outro horario.';
  end if;

  if exists (
    select 1
    from public.atendimentos a
    left join public.servicos s on s.id = a.servico_id and s.empresa_id = a.empresa_id
    where a.empresa_id = barbershop_row.empresa_id
      and a.barbeiro_id = p_barbeiro_id
      and a.status not in ('cancelado', 'remarcado', 'nao_compareceu', 'faltou')
      and a.data_hora_inicio < p_ends_at
      and coalesce(
        a.data_hora_fim,
        a.data_hora_inicio + make_interval(mins => coalesce(s.duration_minutes, s.duracao_minutos, 30))
      ) > p_starts_at
  ) then
    raise exception 'Este horario acabou de ficar indisponivel. Escolha outro horario.';
  end if;

  if exists (
    select 1
    from public.barber_unavailability bu
    where bu.empresa_id = barbershop_row.empresa_id
      and bu.barber_id = p_barbeiro_id
      and bu.date = (p_starts_at at time zone 'America/Sao_Paulo')::date
      and (
        bu.all_day = true
        or (
          bu.start_time is not null
          and bu.end_time is not null
          and (p_starts_at at time zone 'America/Sao_Paulo')::time < bu.end_time
          and (p_ends_at at time zone 'America/Sao_Paulo')::time > bu.start_time
        )
      )
  ) then
    raise exception 'Este profissional nao esta disponivel neste horario.';
  end if;

  service_duration := coalesce(
    service_row.duration_minutes,
    service_row.duracao_minutos,
    greatest(1, extract(epoch from (p_ends_at - p_starts_at))::integer / 60)
  );

  insert into public.appointments (
    empresa_id,
    barbershop_id,
    client_profile_id,
    barbeiro_id,
    starts_at,
    ends_at,
    status,
    valor_original,
    valor_desconto,
    valor_final
  )
  values (
    barbershop_row.empresa_id,
    p_barbershop_id,
    p_client_profile_id,
    p_barbeiro_id,
    p_starts_at,
    p_ends_at,
    'agendado',
    service_row.preco,
    0,
    service_row.preco
  )
  returning * into appointment_row;

  insert into public.appointment_items (
    appointment_id,
    servico_id,
    nome,
    duration_minutes,
    valor_original,
    valor_desconto,
    valor_final
  )
  values (
    appointment_row.id,
    p_servico_id,
    service_row.nome,
    service_duration,
    service_row.preco,
    0,
    service_row.preco
  );

  return appointment_row;
end;
$$;

create or replace function public.enforce_limited_appointment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_operator boolean;
  is_client_owner boolean;
  is_own_barber boolean;
begin
  is_operator := public.has_empresa_role(
    coalesce(new.empresa_id, old.empresa_id),
    array['administrador', 'gerente', 'recepcao']
  );

  if is_operator then
    return new;
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = old.client_profile_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  ) into is_client_owner;

  is_own_barber := public.is_current_barbeiro(old.empresa_id, old.barbeiro_id);

  if not is_client_owner and not is_own_barber then
    raise exception 'Usuario sem permissao para alterar este agendamento.';
  end if;

  if new.empresa_id is distinct from old.empresa_id
    or new.barbershop_id is distinct from old.barbershop_id
    or new.client_profile_id is distinct from old.client_profile_id
    or new.atendimento_id is distinct from old.atendimento_id
    or new.barbeiro_id is distinct from old.barbeiro_id
    or new.valor_original is distinct from old.valor_original
    or new.valor_desconto is distinct from old.valor_desconto
    or new.valor_final is distinct from old.valor_final
    or new.motivo_desconto is distinct from old.motivo_desconto
    or new.created_at is distinct from old.created_at then
    raise exception 'Campos sensiveis do agendamento nao podem ser alterados por este perfil.';
  end if;

  if is_client_owner and new.status not in ('agendado', 'confirmado', 'cancelado') then
    raise exception 'Cliente so pode cancelar ou remarcar o proprio agendamento.';
  end if;

  if is_own_barber and new.status not in (
    'agendado',
    'confirmado',
    'em_atendimento',
    'concluido',
    'cancelado',
    'nao_compareceu'
  ) then
    raise exception 'Status invalido para atualizacao do barbeiro.';
  end if;

  if new.cancelled_by is not null and new.cancelled_by <> auth.uid() then
    raise exception 'Responsavel pelo cancelamento deve ser o usuario autenticado.';
  end if;

  if new.rescheduled_by is not null and new.rescheduled_by <> auth.uid() then
    raise exception 'Responsavel pela remarcacao deve ser o usuario autenticado.';
  end if;

  return new;
end;
$$;

revoke all on function public.is_uuid(text) from public;
revoke all on function public.current_usuario_id(uuid) from public;
revoke all on function public.usuario_self_update_safe(uuid, uuid, uuid, text, text) from public;
revoke all on function public.employee_self_update_safe(uuid, uuid, text) from public;
revoke all on function public.is_current_barbeiro(uuid, uuid) from public;
revoke all on function public.can_access_appointment(uuid) from public;
revoke all on function public.can_access_atendimento(uuid) from public;
revoke all on function public.get_booking_busy_slots(uuid, uuid, date, uuid) from public;
revoke all on function public.create_internal_notification(uuid, text, text, text, jsonb, text) from public;
revoke all on function public.create_client_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz) from public;
revoke all on function public.enforce_limited_appointment_update() from public;

grant execute on function public.is_uuid(text) to authenticated, anon;
grant execute on function public.current_usuario_id(uuid) to authenticated;
grant execute on function public.usuario_self_update_safe(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.employee_self_update_safe(uuid, uuid, text) to authenticated;
grant execute on function public.is_current_barbeiro(uuid, uuid) to authenticated;
grant execute on function public.can_access_appointment(uuid) to authenticated;
grant execute on function public.can_access_atendimento(uuid) to authenticated;
grant execute on function public.get_booking_busy_slots(uuid, uuid, date, uuid) to authenticated;
grant execute on function public.create_internal_notification(uuid, text, text, text, jsonb, text) to authenticated;
grant execute on function public.create_client_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz) to authenticated;

drop trigger if exists appointments_enforce_limited_update on public.appointments;
create trigger appointments_enforce_limited_update
before update on public.appointments
for each row execute function public.enforce_limited_appointment_update();

-- Users: avoid self role/status escalation.
drop policy if exists "usuarios_select_mesma_empresa" on public.usuarios;
drop policy if exists "usuarios_update_gestao_ou_proprio" on public.usuarios;

create policy "usuarios_select_por_permissao"
on public.usuarios
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao'])
);

create policy "usuarios_update_gestao_ou_proprio_seguro"
on public.usuarios
for update
to authenticated
using (
  public.has_empresa_role(empresa_id, array['administrador', 'gerente'])
  or auth_user_id = auth.uid()
)
with check (
  public.has_empresa_role(empresa_id, array['administrador', 'gerente'])
  or public.usuario_self_update_safe(id, empresa_id, auth_user_id, papel, status)
);

-- Company profile/location updates are management-only.
drop policy if exists "empresas_insert_autenticado" on public.empresas;
drop policy if exists "empresas_location_update_own_company" on public.empresas;

create policy "empresas_no_direct_insert"
on public.empresas
for insert
to authenticated
with check (false);

create policy "empresas_location_update_gestao"
on public.empresas
for update
to authenticated
using (public.has_empresa_role(id, array['administrador', 'gerente']))
with check (public.has_empresa_role(id, array['administrador', 'gerente']));

-- Remove broad company FOR ALL policies from the first schema migration.
drop policy if exists "clientes_empresa_isolada" on public.clientes;
drop policy if exists "barbeiros_empresa_isolada" on public.barbeiros;
drop policy if exists "servicos_empresa_isolada" on public.servicos;
drop policy if exists "atendimentos_empresa_isolada" on public.atendimentos;
drop policy if exists "produtos_empresa_isolada" on public.produtos;
drop policy if exists "movimentacoes_financeiras_empresa_isolada" on public.movimentacoes_financeiras;
drop policy if exists "contas_pagar_empresa_isolada" on public.contas_pagar;
drop policy if exists "comissoes_empresa_isolada" on public.comissoes;
drop policy if exists "configuracoes_empresa_isolada" on public.configuracoes;

-- Clientes: operators can manage, barbers can read clients tied to their own appointments.
create policy "clientes_select_operacao_ou_barbeiro"
on public.clientes
for select
to authenticated
using (
  public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao'])
  or exists (
    select 1
    from public.atendimentos a
    where a.empresa_id = clientes.empresa_id
      and a.cliente_id = clientes.id
      and public.is_current_barbeiro(a.empresa_id, a.barbeiro_id)
  )
);

create policy "clientes_insert_operacao"
on public.clientes
for insert
to authenticated
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao']));

create policy "clientes_update_operacao"
on public.clientes
for update
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao']));

create policy "clientes_delete_gestao"
on public.clientes
for delete
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

-- Barbers/employees exposed through the legacy barbeiros table.
create policy "barbeiros_select_empresa"
on public.barbeiros
for select
to authenticated
using (public.belongs_to_empresa(empresa_id));

create policy "barbeiros_insert_gestao"
on public.barbeiros
for insert
to authenticated
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "barbeiros_update_gestao"
on public.barbeiros
for update
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "barbeiros_delete_admin"
on public.barbeiros
for delete
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']));

-- Attendances: operators manage company schedule, barber sees own records only.
create policy "atendimentos_select_operacao_ou_barbeiro"
on public.atendimentos
for select
to authenticated
using (
  public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao'])
  or public.is_current_barbeiro(empresa_id, barbeiro_id)
);

create policy "atendimentos_insert_operacao"
on public.atendimentos
for insert
to authenticated
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao']));

create policy "atendimentos_update_operacao_ou_barbeiro"
on public.atendimentos
for update
to authenticated
using (
  public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao'])
  or public.is_current_barbeiro(empresa_id, barbeiro_id)
)
with check (
  public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao'])
  or public.is_current_barbeiro(empresa_id, barbeiro_id)
);

create policy "atendimentos_delete_admin"
on public.atendimentos
for delete
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']));

-- Inventory and finance are management-only.
create policy "produtos_select_gestao"
on public.produtos
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "produtos_insert_gestao"
on public.produtos
for insert
to authenticated
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "produtos_update_gestao"
on public.produtos
for update
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "produtos_delete_admin"
on public.produtos
for delete
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']));

create policy "movimentacoes_financeiras_select_gestao"
on public.movimentacoes_financeiras
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "movimentacoes_financeiras_insert_gestao"
on public.movimentacoes_financeiras
for insert
to authenticated
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "movimentacoes_financeiras_update_gestao"
on public.movimentacoes_financeiras
for update
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "movimentacoes_financeiras_delete_admin"
on public.movimentacoes_financeiras
for delete
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']));

create policy "contas_pagar_select_gestao"
on public.contas_pagar
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "contas_pagar_insert_gestao"
on public.contas_pagar
for insert
to authenticated
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "contas_pagar_update_gestao"
on public.contas_pagar
for update
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "contas_pagar_delete_admin"
on public.contas_pagar
for delete
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']));

create policy "comissoes_select_gestao_ou_barbeiro"
on public.comissoes
for select
to authenticated
using (
  public.has_empresa_role(empresa_id, array['administrador', 'gerente'])
  or public.is_current_barbeiro(empresa_id, barbeiro_id)
);

create policy "comissoes_insert_gestao"
on public.comissoes
for insert
to authenticated
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "comissoes_update_gestao"
on public.comissoes
for update
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "comissoes_delete_admin"
on public.comissoes
for delete
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']));

create policy "configuracoes_select_gestao"
on public.configuracoes
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "configuracoes_insert_gestao"
on public.configuracoes
for insert
to authenticated
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "configuracoes_update_gestao"
on public.configuracoes
for update
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "configuracoes_delete_admin"
on public.configuracoes
for delete
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']));

-- Client-facing barbershop relationships and favorites.
drop policy if exists "barbershops own company update" on public.barbershops;
drop policy if exists "barbershops own company insert" on public.barbershops;

create policy "barbershops_manage_gestao"
on public.barbershops
for update
to authenticated
using (empresa_id is not null and public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (empresa_id is not null and public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "barbershops_insert_gestao"
on public.barbershops
for insert
to authenticated
with check (empresa_id is not null and public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

drop policy if exists "client_barbershop own insert" on public.client_barbershop;
drop policy if exists "client_barbershop own update" on public.client_barbershop;

create policy "client_barbershop_own_insert_valid"
on public.client_barbershop
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = client_barbershop.client_profile_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
  and exists (
    select 1
    from public.barbershops b
    where b.id = client_barbershop.barbershop_id
      and b.status = 'ativa'
  )
);

create policy "client_barbershop_own_update_valid"
on public.client_barbershop
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = client_barbershop.client_profile_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = client_barbershop.client_profile_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
  and exists (
    select 1
    from public.barbershops b
    where b.id = client_barbershop.barbershop_id
      and b.status = 'ativa'
  )
);

drop policy if exists "client_favorites_own_insert" on public.client_favorite_barbershops;

create policy "client_favorites_own_insert_valid"
on public.client_favorite_barbershops
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = client_favorite_barbershops.client_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
  and exists (
    select 1
    from public.barbershops b
    where b.id = client_favorite_barbershops.barbershop_id
      and b.status = 'ativa'
      and (client_favorite_barbershops.empresa_id is null or client_favorite_barbershops.empresa_id = b.empresa_id)
  )
);

drop policy if exists "barber_services_select_empresa_or_client" on public.barber_services;

create policy "barber_services_select_por_vinculo"
on public.barber_services
for select
to authenticated
using (
  public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao'])
  or public.is_current_barbeiro(empresa_id, barbeiro_id)
  or exists (
    select 1
    from public.profiles p
    join public.barbershops b on b.empresa_id = barber_services.empresa_id
    where p.auth_user_id = auth.uid()
      and p.role = 'cliente'
      and b.status = 'ativa'
      and (
        p.primary_barbershop_id = b.id
        or exists (
          select 1
          from public.client_barbershop cb
          where cb.client_profile_id = p.id
            and cb.barbershop_id = b.id
        )
      )
  )
);

-- Appointments and items.
drop policy if exists "appointments client own select" on public.appointments;
drop policy if exists "appointments client own insert" on public.appointments;
drop policy if exists "appointments company and client update" on public.appointments;
drop policy if exists "appointments_client_booking_availability_select" on public.appointments;

create policy "appointments_select_por_vinculo"
on public.appointments
for select
to authenticated
using (
  public.can_access_appointment(id)
);

create policy "appointments_insert_cliente_valido"
on public.appointments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = appointments.client_profile_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
  and exists (
    select 1
    from public.barbershops b
    where b.id = appointments.barbershop_id
      and b.empresa_id = appointments.empresa_id
      and b.status = 'ativa'
  )
  and exists (
    select 1
    from public.barbeiros br
    where br.id = appointments.barbeiro_id
      and br.empresa_id = appointments.empresa_id
      and br.status = 'ativo'
  )
);

create policy "appointments_update_por_vinculo"
on public.appointments
for update
to authenticated
using (
  public.can_access_appointment(id)
)
with check (
  (
    exists (
      select 1
      from public.profiles p
      where p.id = appointments.client_profile_id
        and p.auth_user_id = auth.uid()
        and p.role = 'cliente'
    )
    or public.has_empresa_role(appointments.empresa_id, array['administrador', 'gerente', 'recepcao'])
    or public.is_current_barbeiro(appointments.empresa_id, appointments.barbeiro_id)
  )
  and exists (
    select 1
    from public.barbershops b
    where b.id = appointments.barbershop_id
      and b.empresa_id = appointments.empresa_id
      and b.status = 'ativa'
  )
  and exists (
    select 1
    from public.barbeiros br
    where br.id = appointments.barbeiro_id
      and br.empresa_id = appointments.empresa_id
      and br.status = 'ativo'
  )
);

drop policy if exists "appointment_items visible by appointment" on public.appointment_items;
drop policy if exists "appointment_items insert by appointment owner" on public.appointment_items;

create policy "appointment_items_select_por_agendamento"
on public.appointment_items
for select
to authenticated
using (public.can_access_appointment(appointment_id));

create policy "appointment_items_insert_por_agendamento"
on public.appointment_items
for insert
to authenticated
with check (
  public.can_access_appointment(appointment_id)
  and (
    servico_id is null
    or exists (
      select 1
      from public.appointments a
      join public.servicos s on s.id = appointment_items.servico_id
      where a.id = appointment_items.appointment_id
        and s.empresa_id = a.empresa_id
        and s.ativo = true
    )
  )
);

drop policy if exists "discount_logs company select" on public.discount_logs;
drop policy if exists "discount_logs company insert" on public.discount_logs;

create policy "discount_logs_select_gestao"
on public.discount_logs
for select
to authenticated
using (empresa_id is not null and public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "discount_logs_insert_gestao"
on public.discount_logs
for insert
to authenticated
with check (empresa_id is not null and public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

-- Status logs and waitlist.
drop policy if exists "appointment_status_logs own select" on public.appointment_status_logs;
drop policy if exists "appointment_status_logs authenticated insert" on public.appointment_status_logs;

create policy "appointment_status_logs_select_por_vinculo"
on public.appointment_status_logs
for select
to authenticated
using (
  (source = 'appointments' and public.can_access_appointment(appointment_id))
  or (source = 'atendimentos' and public.can_access_atendimento(appointment_id))
);

create policy "appointment_status_logs_insert_por_vinculo"
on public.appointment_status_logs
for insert
to authenticated
with check (
  changed_by = auth.uid()
  and (
    (source = 'appointments' and public.can_access_appointment(appointment_id))
    or (source = 'atendimentos' and public.can_access_atendimento(appointment_id))
  )
);

drop policy if exists "appointment_waitlist own select" on public.appointment_waitlist;
drop policy if exists "appointment_waitlist client insert" on public.appointment_waitlist;
drop policy if exists "appointment_waitlist own update" on public.appointment_waitlist;

create policy "appointment_waitlist_select_por_vinculo"
on public.appointment_waitlist
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = appointment_waitlist.client_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
  or public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao'])
);

create policy "appointment_waitlist_insert_cliente_valido"
on public.appointment_waitlist
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = appointment_waitlist.client_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
  and exists (
    select 1
    from public.servicos s
    where s.id = appointment_waitlist.service_id
      and s.empresa_id = appointment_waitlist.empresa_id
      and s.ativo = true
  )
  and (
    appointment_waitlist.barber_id is null
    or exists (
      select 1
      from public.barbeiros b
      where b.id = appointment_waitlist.barber_id
        and b.empresa_id = appointment_waitlist.empresa_id
        and b.status = 'ativo'
    )
  )
);

create policy "appointment_waitlist_update_por_vinculo"
on public.appointment_waitlist
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = appointment_waitlist.client_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
  or public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao'])
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = appointment_waitlist.client_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
  or public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao'])
);

-- Notifications: prevent arbitrary authenticated inserts.
drop policy if exists "notifications authenticated insert" on public.notifications;

create policy "notifications_insert_empresa_ou_cliente_evento"
on public.notifications
for insert
to authenticated
with check (
  (
    public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao'])
    and (
      recipient_user_id is null
      or exists (
        select 1
        from public.usuarios u
        where u.id = notifications.recipient_user_id
          and u.empresa_id = notifications.empresa_id
          and u.status = 'ativo'
      )
    )
  )
  or (
    recipient_user_id is not null
    and exists (
      select 1
      from public.usuarios u
      where u.id = notifications.recipient_user_id
        and u.empresa_id = notifications.empresa_id
        and u.status = 'ativo'
        and u.papel in ('administrador', 'gerente', 'barbeiro')
    )
    and (
      (
        public.is_uuid(notifications.metadata ->> 'appointmentId')
        and exists (
          select 1
          from public.appointments a
          join public.profiles p on p.id = a.client_profile_id
          where a.id = (notifications.metadata ->> 'appointmentId')::uuid
            and a.empresa_id = notifications.empresa_id
            and p.auth_user_id = auth.uid()
            and p.role = 'cliente'
        )
      )
      or (
        public.is_uuid(notifications.metadata ->> 'waitlistId')
        and exists (
          select 1
          from public.appointment_waitlist w
          join public.profiles p on p.id = w.client_id
          where w.id = (notifications.metadata ->> 'waitlistId')::uuid
            and w.empresa_id = notifications.empresa_id
            and p.auth_user_id = auth.uid()
            and p.role = 'cliente'
        )
      )
    )
  )
);

drop policy if exists "notification_logs authenticated insert" on public.notification_logs;

create policy "notification_logs_insert_empresa_ou_cliente"
on public.notification_logs
for insert
to authenticated
with check (
  (
    empresa_id is not null
    and public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao'])
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = notification_logs.client_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
);

-- Audit/error logs: clients can log without company scope; company-scoped logs require company membership.
drop policy if exists "audit_logs_authenticated_insert" on public.audit_logs;
drop policy if exists "error_logs_authenticated_insert" on public.error_logs;

create policy "audit_logs_authenticated_insert_scoped"
on public.audit_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    empresa_id is null
    or public.belongs_to_empresa(empresa_id)
  )
);

create policy "error_logs_authenticated_insert_scoped"
on public.error_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    empresa_id is null
    or public.belongs_to_empresa(empresa_id)
  )
);

-- Employees: direct employee creation is invitation/RPC-only. Self update cannot reactivate or relink auth.
drop policy if exists "employees_admin_insert" on public.employees;
drop policy if exists "employees_admin_update" on public.employees;

create policy "employees_no_direct_insert"
on public.employees
for insert
to authenticated
with check (false);

drop policy if exists "employees_company_or_self_select" on public.employees;

create policy "employees_select_gestao_ou_proprio"
on public.employees
for select
to authenticated
using (
  public.employee_is_current_auth_user(id)
  or exists (
    select 1
    from public.barbershop_employee_links link
    where link.employee_id = employees.id
      and public.has_empresa_role(link.empresa_id, array['administrador', 'gerente', 'recepcao'])
  )
);

create policy "employees_admin_update_or_self_safe"
on public.employees
for update
to authenticated
using (
  public.can_manage_employee(id)
  or auth_user_id = auth.uid()
)
with check (
  public.can_manage_employee(id)
  or public.employee_self_update_safe(id, auth_user_id, status)
);

drop policy if exists "employee_links_company_select" on public.barbershop_employee_links;

create policy "employee_links_select_gestao_ou_proprio"
on public.barbershop_employee_links
for select
to authenticated
using (
  public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao'])
  or public.employee_is_current_auth_user(employee_id)
);

drop policy if exists "employee_invitations_company_select" on public.employee_invitations;

create policy "employee_invitations_select_gestao"
on public.employee_invitations
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

-- Product sales and legacy RPC must respect finance permissions.
drop policy if exists "vendas_produtos_empresa_isolada" on public.vendas_produtos;

create policy "vendas_produtos_select_gestao"
on public.vendas_produtos
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "vendas_produtos_insert_gestao"
on public.vendas_produtos
for insert
to authenticated
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "vendas_produtos_update_gestao"
on public.vendas_produtos
for update
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create or replace function public.registrar_venda_produto(
  p_empresa_id uuid,
  p_produto_id uuid,
  p_quantidade integer,
  p_forma_pagamento text
)
returns public.produtos
language plpgsql
security definer
set search_path = public
as $$
declare
  produto_atual public.produtos;
  produto_atualizado public.produtos;
  valor_total numeric(12, 2);
begin
  if not public.has_empresa_role(p_empresa_id, array['administrador', 'gerente']) then
    raise exception 'Apenas administradores ou gerentes podem registrar venda de produto.';
  end if;

  if p_quantidade <= 0 then
    raise exception 'Quantidade vendida deve ser maior que zero.';
  end if;

  select *
  into produto_atual
  from public.produtos
  where id = p_produto_id
    and empresa_id = p_empresa_id
    and ativo = true
  for update;

  if produto_atual.id is null then
    raise exception 'Produto nao encontrado ou inativo.';
  end if;

  if produto_atual.estoque_atual < p_quantidade then
    raise exception 'Estoque insuficiente para venda.';
  end if;

  valor_total := round(produto_atual.preco_venda * p_quantidade, 2);

  update public.produtos
  set estoque_atual = estoque_atual - p_quantidade
  where id = p_produto_id
    and empresa_id = p_empresa_id
  returning * into produto_atualizado;

  insert into public.vendas_produtos (
    empresa_id,
    produto_id,
    quantidade,
    valor_unitario,
    valor_total,
    forma_pagamento,
    data_venda
  )
  values (
    p_empresa_id,
    p_produto_id,
    p_quantidade,
    produto_atual.preco_venda,
    valor_total,
    p_forma_pagamento,
    current_date
  );

  insert into public.movimentacoes_financeiras (
    empresa_id,
    tipo,
    categoria,
    descricao,
    valor,
    forma_pagamento,
    data_movimentacao,
    status
  )
  values (
    p_empresa_id,
    'entrada',
    'produto',
    'Venda de produto - ' || produto_atual.nome,
    valor_total,
    p_forma_pagamento,
    current_date,
    'confirmada'
  );

  return produto_atualizado;
end;
$$;

-- Benefits/fidelity are business configuration; management manages, operation can read.
drop policy if exists "benefit_programs_empresa_isolada" on public.benefit_programs;
drop policy if exists "benefit_rules_empresa_isolada" on public.benefit_rules;
drop policy if exists "benefit_rewards_empresa_isolada" on public.benefit_rewards;
drop policy if exists "client_benefits_empresa_isolada" on public.client_benefits;
drop policy if exists "benefit_usage_logs_empresa_isolada" on public.benefit_usage_logs;

create policy "benefit_programs_select_operacao"
on public.benefit_programs
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao']));

create policy "benefit_programs_manage_gestao"
on public.benefit_programs
for all
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "benefit_rules_select_operacao"
on public.benefit_rules
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao']));

create policy "benefit_rules_manage_gestao"
on public.benefit_rules
for all
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "benefit_rewards_select_operacao"
on public.benefit_rewards
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao']));

create policy "benefit_rewards_manage_gestao"
on public.benefit_rewards
for all
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "client_benefits_select_operacao"
on public.client_benefits
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente', 'recepcao']));

create policy "client_benefits_manage_gestao"
on public.client_benefits
for all
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "benefit_usage_logs_select_gestao"
on public.benefit_usage_logs
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "benefit_usage_logs_insert_gestao"
on public.benefit_usage_logs
for insert
to authenticated
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

-- Attending services must be registered by operation roles only.
create or replace function public.registrar_atendimento(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_data date,
  p_hora time,
  p_forma_pagamento text
)
returns public.atendimentos
language plpgsql
security definer
set search_path = public
as $$
declare
  servico public.servicos;
  barbeiro public.barbeiros;
  atendimento public.atendimentos;
  valor_comissao numeric(12, 2);
begin
  if not public.has_empresa_role(p_empresa_id, array['administrador', 'gerente', 'recepcao']) then
    raise exception 'Usuario sem permissao para registrar atendimento nesta empresa.';
  end if;

  select * into servico
  from public.servicos
  where id = p_servico_id
    and empresa_id = p_empresa_id
    and ativo = true;

  if servico.id is null then
    raise exception 'Servico nao encontrado ou inativo.';
  end if;

  select * into barbeiro
  from public.barbeiros
  where id = p_barbeiro_id
    and empresa_id = p_empresa_id
    and status = 'ativo';

  if barbeiro.id is null then
    raise exception 'Barbeiro nao encontrado ou inativo.';
  end if;

  if not exists (
    select 1 from public.clientes
    where id = p_cliente_id and empresa_id = p_empresa_id
  ) then
    raise exception 'Cliente nao encontrado.';
  end if;

  valor_comissao := round(servico.preco * (coalesce(barbeiro.percentual_comissao, servico.percentual_comissao) / 100), 2);

  insert into public.atendimentos (
    empresa_id,
    cliente_id,
    barbeiro_id,
    servico_id,
    data_hora_inicio,
    data_hora_fim,
    valor,
    forma_pagamento,
    status
  )
  values (
    p_empresa_id,
    p_cliente_id,
    p_barbeiro_id,
    p_servico_id,
    (p_data::timestamp + p_hora),
    (p_data::timestamp + p_hora + make_interval(mins => coalesce(servico.duracao_minutos, 30))),
    servico.preco,
    p_forma_pagamento,
    'concluido'
  )
  returning * into atendimento;

  insert into public.movimentacoes_financeiras (
    empresa_id,
    tipo,
    categoria,
    descricao,
    valor,
    forma_pagamento,
    data_movimentacao,
    atendimento_id,
    status
  )
  values (
    p_empresa_id,
    'entrada',
    'servico',
    'Atendimento - ' || servico.nome,
    servico.preco,
    p_forma_pagamento,
    p_data,
    atendimento.id,
    'confirmada'
  );

  insert into public.comissoes (
    empresa_id,
    barbeiro_id,
    atendimento_id,
    percentual,
    valor_base,
    valor_comissao,
    status
  )
  values (
    p_empresa_id,
    p_barbeiro_id,
    atendimento.id,
    coalesce(barbeiro.percentual_comissao, servico.percentual_comissao),
    servico.preco,
    valor_comissao,
    'pendente'
  );

  return atendimento;
end;
$$;
