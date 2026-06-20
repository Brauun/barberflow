-- Simplifica o MVP para ADMIN + BARBEIRO + CLIENTE.
-- Dados antigos sao preservados: gerente/recepcao passam a administrador.

update public.usuarios
set papel = 'administrador',
    updated_at = now()
where papel in ('gerente', 'recepcao');

update public.barbershop_employee_links
set role = 'administrador',
    updated_at = now()
where role in ('gerente', 'recepcao');

update public.employee_invitations
set role = 'administrador'
where role in ('gerente', 'recepcao');

alter table public.usuarios
  drop constraint if exists usuarios_papel_check;

alter table public.usuarios
  add constraint usuarios_papel_check
  check (papel in ('administrador', 'barbeiro'));

alter table public.barbershop_employee_links
  drop constraint if exists barbershop_employee_links_role_check;

alter table public.barbershop_employee_links
  add constraint barbershop_employee_links_role_check
  check (role in ('administrador', 'barbeiro'));

alter table public.employee_invitations
  drop constraint if exists employee_invitations_role_check;

alter table public.employee_invitations
  add constraint employee_invitations_role_check
  check (role in ('administrador', 'barbeiro'));

create or replace function public.set_current_admin_barber_participation(
  p_empresa_id uuid,
  p_appears_in_schedule boolean
)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario_row public.usuarios;
  employee_row public.employees;
  current_barbeiro public.barbeiros;
begin
  if auth.uid() is null then
    raise exception 'Usuário autenticado não encontrado.';
  end if;

  if not public.has_empresa_role(p_empresa_id, array['administrador']) then
    raise exception 'Apenas administrador pode alterar participação na agenda.';
  end if;

  select *
  into usuario_row
  from public.usuarios
  where empresa_id = p_empresa_id
    and auth_user_id = auth.uid()
    and status = 'ativo'
  limit 1;

  if usuario_row.id is null then
    raise exception 'Usuário da empresa não encontrado.';
  end if;

  if coalesce(p_appears_in_schedule, false) = false then
    select *
    into current_barbeiro
    from public.barbeiros
    where empresa_id = p_empresa_id
      and usuario_id = usuario_row.id
    limit 1;

    if current_barbeiro.id is not null and exists (
      select 1
      from public.appointments a
      where a.empresa_id = p_empresa_id
        and a.barbeiro_id = current_barbeiro.id
        and a.starts_at >= now()
        and a.status in ('agendado', 'confirmado', 'em_atendimento', 'aguardando_finalizacao')
    ) then
      raise exception 'Existem atendimentos futuros vinculados a este barbeiro. Cancele ou remaneje antes de desativar.';
    end if;

    if current_barbeiro.id is not null and exists (
      select 1
      from public.atendimentos a
      where a.empresa_id = p_empresa_id
        and a.barbeiro_id = current_barbeiro.id
        and a.data_hora_inicio >= now()
        and a.status not in ('cancelado', 'remarcado', 'nao_compareceu', 'faltou', 'concluido', 'concluido_automatico')
    ) then
      raise exception 'Existem atendimentos futuros vinculados a este barbeiro. Cancele ou remaneje antes de desativar.';
    end if;
  end if;

  employee_row := public.ensure_usuario_as_owner_barber(
    p_empresa_id,
    usuario_row.id,
    coalesce(p_appears_in_schedule, false)
  );

  update public.employees
  set
    is_barber = coalesce(p_appears_in_schedule, false),
    appears_in_schedule = coalesce(p_appears_in_schedule, false),
    updated_at = now()
  where id = employee_row.id
  returning * into employee_row;

  update public.barbeiros
  set
    status = case when coalesce(p_appears_in_schedule, false) then 'ativo' else 'inativo' end,
    updated_at = now()
  where empresa_id = p_empresa_id
    and usuario_id = usuario_row.id;

  return employee_row;
end;
$$;

create or replace function public.create_employee_invitation(
  p_empresa_id uuid,
  p_nome text,
  p_email text,
  p_telefone text,
  p_role text,
  p_commission_percentage numeric,
  p_created_by uuid default null
)
returns public.employee_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_row public.employees;
  invitation public.employee_invitations;
  normalized_email text;
  barber_limit integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário autenticado não encontrado.';
  end if;

  if not public.has_empresa_role(p_empresa_id, array['administrador']) then
    raise exception 'Apenas administrador pode convidar funcionários.';
  end if;

  if p_role <> 'barbeiro' then
    raise exception 'Convites de funcionário permitem apenas a função barbeiro.';
  end if;

  barber_limit := public.get_empresa_barber_limit(p_empresa_id);

  if barber_limit is not null
    and public.active_schedule_barbers_count(p_empresa_id) >= barber_limit
  then
    raise exception 'Seu plano permite até % barbeiros ativos. Para adicionar mais profissionais, faça upgrade.', barber_limit;
  end if;

  normalized_email := lower(trim(p_email));

  if normalized_email = '' then
    raise exception 'E-mail do funcionário é obrigatório.';
  end if;

  insert into public.employees (
    nome,
    email,
    telefone,
    status,
    is_owner,
    is_barber,
    appears_in_schedule
  )
  values (
    trim(p_nome),
    normalized_email,
    nullif(trim(coalesce(p_telefone, '')), ''),
    'ativo',
    false,
    true,
    true
  )
  on conflict (email)
  do update set
    nome = excluded.nome,
    telefone = excluded.telefone,
    status = 'ativo',
    is_barber = true,
    appears_in_schedule = true,
    updated_at = now()
  returning * into employee_row;

  insert into public.employee_invitations (
    empresa_id,
    employee_id,
    nome,
    email,
    telefone,
    role,
    commission_percentage,
    token,
    status,
    expires_at,
    created_by
  )
  values (
    p_empresa_id,
    employee_row.id,
    trim(p_nome),
    normalized_email,
    nullif(trim(coalesce(p_telefone, '')), ''),
    'barbeiro',
    p_commission_percentage,
    concat(gen_random_uuid()::text, '-', gen_random_uuid()::text),
    'pendente',
    now() + interval '7 days',
    p_created_by
  )
  returning * into invitation;

  return invitation;
end;
$$;

create or replace function public.accept_employee_invitation(
  p_token text,
  p_nome text,
  p_telefone text
)
returns public.employee_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.employee_invitations;
  employee_row public.employees;
  user_row public.usuarios;
  barber_limit integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário autenticado não encontrado.';
  end if;

  select *
  into invitation
  from public.employee_invitations
  where token = p_token
  for update;

  if invitation.id is null then
    raise exception 'Convite não encontrado.';
  end if;

  if invitation.status <> 'pendente' or invitation.expires_at <= now() then
    raise exception 'Convite expirado ou indisponível.';
  end if;

  if invitation.role not in ('administrador', 'barbeiro') then
    raise exception 'Função do convite indisponível.';
  end if;

  if invitation.role = 'barbeiro' then
    barber_limit := public.get_empresa_barber_limit(invitation.empresa_id);

    if barber_limit is not null
      and public.active_schedule_barbers_count(invitation.empresa_id) >= barber_limit
    then
      raise exception 'Seu plano permite até % barbeiros ativos. Para adicionar mais profissionais, faça upgrade.', barber_limit;
    end if;
  end if;

  insert into public.employees (
    id,
    auth_user_id,
    nome,
    email,
    telefone,
    status,
    is_owner,
    is_barber,
    appears_in_schedule
  )
  values (
    coalesce(invitation.employee_id, gen_random_uuid()),
    auth.uid(),
    coalesce(nullif(trim(p_nome), ''), invitation.nome),
    invitation.email,
    nullif(trim(p_telefone), ''),
    'ativo',
    false,
    invitation.role = 'barbeiro',
    invitation.role = 'barbeiro'
  )
  on conflict (email)
  do update set
    auth_user_id = auth.uid(),
    nome = excluded.nome,
    telefone = excluded.telefone,
    status = 'ativo',
    is_barber = excluded.is_barber,
    appears_in_schedule = excluded.appears_in_schedule,
    updated_at = now()
  returning * into employee_row;

  insert into public.barbershop_employee_links (
    employee_id,
    empresa_id,
    barbershop_id,
    role,
    commission_percentage,
    status,
    joined_at
  )
  values (
    employee_row.id,
    invitation.empresa_id,
    invitation.barbershop_id,
    invitation.role,
    invitation.commission_percentage,
    'ativo',
    now()
  )
  on conflict (employee_id, empresa_id)
  do update set
    role = excluded.role,
    commission_percentage = excluded.commission_percentage,
    status = 'ativo',
    left_at = null,
    joined_at = coalesce(public.barbershop_employee_links.joined_at, now()),
    updated_at = now();

  insert into public.usuarios (
    empresa_id,
    auth_user_id,
    nome,
    email,
    telefone,
    papel,
    status
  )
  values (
    invitation.empresa_id,
    auth.uid(),
    employee_row.nome,
    employee_row.email,
    employee_row.telefone,
    invitation.role,
    'ativo'
  )
  on conflict (auth_user_id)
  do update set
    empresa_id = excluded.empresa_id,
    nome = excluded.nome,
    email = excluded.email,
    telefone = excluded.telefone,
    papel = excluded.papel,
    status = 'ativo'
  returning * into user_row;

  if invitation.role = 'barbeiro' then
    insert into public.barbeiros (
      empresa_id,
      usuario_id,
      nome,
      telefone,
      email,
      percentual_comissao,
      status
    )
    values (
      invitation.empresa_id,
      user_row.id,
      employee_row.nome,
      employee_row.telefone,
      employee_row.email,
      invitation.commission_percentage,
      'ativo'
    )
    on conflict (empresa_id, usuario_id)
    do update set
      nome = excluded.nome,
      telefone = excluded.telefone,
      email = excluded.email,
      percentual_comissao = excluded.percentual_comissao,
      status = 'ativo',
      updated_at = now();
  end if;

  update public.employee_invitations
  set
    employee_id = employee_row.id,
    status = 'aceito',
    accepted_at = now()
  where id = invitation.id
  returning * into invitation;

  return invitation;
end;
$$;

drop policy if exists "empresas_update_staff" on public.empresas;
create policy "empresas_update_staff"
on public.empresas for update
using (public.has_empresa_role(id, array['administrador']))
with check (public.has_empresa_role(id, array['administrador']));

drop policy if exists "usuarios_select_staff_or_self" on public.usuarios;
create policy "usuarios_select_staff_or_self"
on public.usuarios for select
using (
  auth_user_id = auth.uid()
  or public.has_empresa_role(empresa_id, array['administrador'])
);

drop policy if exists "usuarios_insert_staff" on public.usuarios;
create policy "usuarios_insert_staff"
on public.usuarios for insert
with check (public.has_empresa_role(empresa_id, array['administrador']));

drop policy if exists "usuarios_update_staff_or_self_safe" on public.usuarios;
create policy "usuarios_update_staff_or_self_safe"
on public.usuarios for update
using (
  public.has_empresa_role(empresa_id, array['administrador'])
  or public.usuario_self_update_safe(id, empresa_id, auth_user_id, papel, status)
)
with check (
  public.has_empresa_role(empresa_id, array['administrador'])
  or public.usuario_self_update_safe(id, empresa_id, auth_user_id, papel, status)
);

drop policy if exists "employee_links_admin_manage" on public.barbershop_employee_links;
create policy "employee_links_admin_manage"
on public.barbershop_employee_links for all
using (public.has_empresa_role(empresa_id, array['administrador']))
with check (public.has_empresa_role(empresa_id, array['administrador']));

drop policy if exists "employee_invitations_admin_manage" on public.employee_invitations;
create policy "employee_invitations_admin_manage"
on public.employee_invitations for all
using (public.has_empresa_role(empresa_id, array['administrador']))
with check (public.has_empresa_role(empresa_id, array['administrador']));

drop policy if exists "subscriptions_update_staff" on public.subscriptions;
create policy "subscriptions_update_staff"
on public.subscriptions for update
using (public.has_empresa_role(empresa_id, array['administrador']))
with check (public.has_empresa_role(empresa_id, array['administrador']));

drop policy if exists "subscription_usage_manage_staff" on public.subscription_usage;
create policy "subscription_usage_manage_staff"
on public.subscription_usage for all
using (public.has_empresa_role(empresa_id, array['administrador']))
with check (public.has_empresa_role(empresa_id, array['administrador']));

drop policy if exists "business_hours_manage_staff" on public.barbershop_business_hours;
create policy "business_hours_manage_staff"
on public.barbershop_business_hours for all
using (public.has_empresa_role(empresa_id, array['administrador']))
with check (public.has_empresa_role(empresa_id, array['administrador']));

drop policy if exists "special_hours_manage_staff" on public.barbershop_special_hours;
create policy "special_hours_manage_staff"
on public.barbershop_special_hours for all
using (public.has_empresa_role(empresa_id, array['administrador']))
with check (public.has_empresa_role(empresa_id, array['administrador']));

drop policy if exists "company_assets_manage_admin_gerente" on storage.objects;
create policy "company_assets_manage_admin"
on storage.objects for all
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = 'empresas'
  and public.has_empresa_role(((storage.foldername(name))[2])::uuid, array['administrador'])
)
with check (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = 'empresas'
  and public.has_empresa_role(((storage.foldername(name))[2])::uuid, array['administrador'])
);

revoke all on function public.set_current_admin_barber_participation(uuid, boolean) from public;
revoke all on function public.create_employee_invitation(uuid, text, text, text, text, numeric, uuid) from public;
revoke all on function public.accept_employee_invitation(text, text, text) from public;

grant execute on function public.set_current_admin_barber_participation(uuid, boolean) to authenticated;
grant execute on function public.create_employee_invitation(uuid, text, text, text, text, numeric, uuid) to authenticated;
grant execute on function public.accept_employee_invitation(text, text, text) to authenticated;

notify pgrst, 'reload schema';
