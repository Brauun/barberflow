alter table public.employees
  add column if not exists is_owner boolean not null default false,
  add column if not exists is_barber boolean not null default true,
  add column if not exists appears_in_schedule boolean not null default true;

create index if not exists employees_owner_barber_idx
  on public.employees(is_owner, is_barber, appears_in_schedule);

create or replace function public.active_schedule_barbers_count(
  p_empresa_id uuid
)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.barbeiros b
  where b.empresa_id = p_empresa_id
    and b.status = 'ativo';
$$;

create or replace function public.get_empresa_barber_limit(
  p_empresa_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  feature_value jsonb;
  limit_text text;
begin
  select sf.feature_value
  into feature_value
  from public.subscriptions s
  join public.subscription_features sf on sf.plan_id = s.plan_id
  where s.empresa_id = p_empresa_id
    and sf.feature_key = 'MAX_BARBERS'
  order by s.created_at desc
  limit 1;

  if feature_value is null then
    return null;
  end if;

  limit_text := trim(both '"' from feature_value::text);

  if lower(limit_text) = 'unlimited' then
    return null;
  end if;

  return limit_text::integer;
exception
  when others then
    return null;
end;
$$;

create or replace function public.ensure_usuario_as_owner_barber(
  p_empresa_id uuid,
  p_usuario_id uuid,
  p_is_barber boolean default true
)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario_row public.usuarios;
  employee_row public.employees;
  barbershop_id uuid;
  commission numeric(5, 2);
begin
  select *
  into usuario_row
  from public.usuarios
  where id = p_usuario_id
    and empresa_id = p_empresa_id;

  if usuario_row.id is null then
    raise exception 'Usuário da empresa não encontrado.';
  end if;

  select id
  into barbershop_id
  from public.barbershops
  where empresa_id = p_empresa_id
  order by created_at asc
  limit 1;

  select coalesce(percentual_comissao_padrao, 60)
  into commission
  from public.empresas
  where id = p_empresa_id;

  insert into public.employees (
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
    usuario_row.auth_user_id,
    usuario_row.nome,
    usuario_row.email,
    usuario_row.telefone,
    'ativo',
    true,
    coalesce(p_is_barber, true),
    coalesce(p_is_barber, true)
  )
  on conflict (email)
  do update set
    auth_user_id = excluded.auth_user_id,
    nome = excluded.nome,
    telefone = excluded.telefone,
    status = 'ativo',
    is_owner = true,
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
    p_empresa_id,
    barbershop_id,
    usuario_row.papel,
    coalesce(commission, 60),
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

  if coalesce(p_is_barber, true) then
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
      p_empresa_id,
      usuario_row.id,
      usuario_row.nome,
      usuario_row.telefone,
      usuario_row.email,
      coalesce(commission, 60),
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

  return employee_row;
end;
$$;

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

  if not public.has_empresa_role(p_empresa_id, array['administrador', 'gerente']) then
    raise exception 'Apenas administrador ou gerente pode alterar participação na agenda.';
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

create or replace function public.criar_empresa_com_usuario(
  nome_empresa text,
  nome_usuario text,
  telefone_usuario text default null,
  papel_usuario text default 'administrador',
  responsavel_cpf text default null
)
returns public.usuarios
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  nova_empresa public.empresas;
  novo_usuario public.usuarios;
  email_usuario text;
  cpf_limpo text;
  telefone_limpo text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado para criar empresa.';
  end if;

  if nullif(trim(nome_empresa), '') is null then
    raise exception 'Nome da empresa é obrigatório.';
  end if;

  if nullif(trim(nome_usuario), '') is null then
    raise exception 'Nome do usuário é obrigatório.';
  end if;

  if papel_usuario is distinct from 'administrador' then
    raise exception 'O primeiro usuário da empresa deve ser administrador.';
  end if;

  cpf_limpo := regexp_replace(coalesce(responsavel_cpf, ''), '\D', '', 'g');
  telefone_limpo := regexp_replace(coalesce(telefone_usuario, ''), '\D', '', 'g');

  if length(cpf_limpo) <> 11 then
    raise exception 'CPF do responsável deve ter 11 dígitos.';
  end if;

  if telefone_limpo <> '' and length(telefone_limpo) <> 11 then
    raise exception 'Telefone deve ter 11 dígitos.';
  end if;

  select *
  into novo_usuario
  from public.usuarios
  where auth_user_id = auth.uid()
  limit 1;

  if novo_usuario.id is not null then
    perform public.ensure_usuario_as_owner_barber(
      novo_usuario.empresa_id,
      novo_usuario.id,
      true
    );
    return novo_usuario;
  end if;

  select email into email_usuario
  from auth.users
  where id = auth.uid();

  if email_usuario is null then
    raise exception 'E-mail do usuário autenticado não encontrado.';
  end if;

  insert into public.empresas (nome, email, telefone, responsavel_cpf)
  values (
    trim(nome_empresa),
    email_usuario,
    nullif(telefone_limpo, ''),
    cpf_limpo
  )
  returning * into nova_empresa;

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
    nova_empresa.id,
    auth.uid(),
    trim(nome_usuario),
    email_usuario,
    nullif(telefone_limpo, ''),
    'administrador',
    'ativo'
  )
  returning * into novo_usuario;

  perform public.ensure_usuario_as_owner_barber(nova_empresa.id, novo_usuario.id, true);

  return novo_usuario;
end;
$$;

create or replace function public.criar_empresa_usuario_auth_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  nova_empresa public.empresas;
  novo_usuario public.usuarios;
  nome_empresa text;
  nome_usuario text;
  telefone_usuario text;
  responsavel_cpf text;
begin
  if exists (
    select 1
    from public.usuarios
    where auth_user_id = new.id
  ) then
    return new;
  end if;

  nome_empresa := nullif(trim(coalesce(new.raw_user_meta_data ->> 'empresa', '')), '');
  nome_usuario := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nome', '')), '');
  telefone_usuario := nullif(
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefone', ''), '\D', '', 'g'),
    ''
  );
  responsavel_cpf := nullif(
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'responsavel_cpf', ''), '\D', '', 'g'),
    ''
  );

  if nome_empresa is null or nome_usuario is null then
    return new;
  end if;

  insert into public.empresas (nome, email, telefone, responsavel_cpf)
  values (nome_empresa, new.email, telefone_usuario, responsavel_cpf)
  returning * into nova_empresa;

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
    nova_empresa.id,
    new.id,
    nome_usuario,
    new.email,
    telefone_usuario,
    'administrador',
    'ativo'
  )
  returning * into novo_usuario;

  perform public.ensure_usuario_as_owner_barber(nova_empresa.id, novo_usuario.id, true);

  return new;
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

  if not public.has_empresa_role(p_empresa_id, array['administrador', 'gerente']) then
    raise exception 'Apenas administrador ou gerente pode convidar funcionários.';
  end if;

  if p_role not in ('administrador', 'gerente', 'barbeiro', 'recepcao') then
    raise exception 'Função inválida para convite.';
  end if;

  if p_role = 'barbeiro' then
    barber_limit := public.get_empresa_barber_limit(p_empresa_id);

    if barber_limit is not null
      and public.active_schedule_barbers_count(p_empresa_id) >= barber_limit
    then
      raise exception 'Seu plano permite até % barbeiros ativos. Para adicionar mais profissionais, faça upgrade.', barber_limit;
    end if;
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
    p_role = 'barbeiro',
    p_role = 'barbeiro'
  )
  on conflict (email)
  do update set
    nome = excluded.nome,
    telefone = excluded.telefone,
    status = 'ativo',
    is_barber = excluded.is_barber,
    appears_in_schedule = excluded.appears_in_schedule,
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
    p_role,
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

revoke all on function public.active_schedule_barbers_count(uuid) from public;
revoke all on function public.get_empresa_barber_limit(uuid) from public;
revoke all on function public.ensure_usuario_as_owner_barber(uuid, uuid, boolean) from public;
revoke all on function public.set_current_admin_barber_participation(uuid, boolean) from public;
revoke all on function public.criar_empresa_com_usuario(text, text, text, text, text) from public;
revoke all on function public.create_employee_invitation(uuid, text, text, text, text, numeric, uuid) from public;
revoke all on function public.accept_employee_invitation(text, text, text) from public;

grant execute on function public.active_schedule_barbers_count(uuid) to authenticated;
grant execute on function public.get_empresa_barber_limit(uuid) to authenticated;
grant execute on function public.set_current_admin_barber_participation(uuid, boolean) to authenticated;
grant execute on function public.criar_empresa_com_usuario(text, text, text, text, text) to authenticated;
grant execute on function public.create_employee_invitation(uuid, text, text, text, text, numeric, uuid) to authenticated;
grant execute on function public.accept_employee_invitation(text, text, text) to authenticated;

insert into public.employees (
  auth_user_id,
  nome,
  email,
  telefone,
  status,
  is_owner,
  is_barber,
  appears_in_schedule
)
select
  u.auth_user_id,
  u.nome,
  u.email,
  u.telefone,
  'ativo',
  true,
  exists (
    select 1
    from public.barbeiros b
    where b.empresa_id = u.empresa_id
      and b.usuario_id = u.id
      and b.status = 'ativo'
  ),
  exists (
    select 1
    from public.barbeiros b
    where b.empresa_id = u.empresa_id
      and b.usuario_id = u.id
      and b.status = 'ativo'
  )
from public.usuarios u
where u.papel = 'administrador'
  and u.status = 'ativo'
on conflict (email)
do update set
  auth_user_id = excluded.auth_user_id,
  nome = excluded.nome,
  telefone = excluded.telefone,
  is_owner = true,
  updated_at = now();

insert into public.barbershop_employee_links (
  employee_id,
  empresa_id,
  barbershop_id,
  role,
  commission_percentage,
  status,
  joined_at
)
select
  e.id,
  u.empresa_id,
  b.id,
  u.papel,
  coalesce(emp.percentual_comissao_padrao, 60),
  'ativo',
  now()
from public.usuarios u
join public.employees e on e.auth_user_id = u.auth_user_id
join public.empresas emp on emp.id = u.empresa_id
left join public.barbershops b on b.empresa_id = u.empresa_id
where u.papel = 'administrador'
  and u.status = 'ativo'
on conflict (employee_id, empresa_id)
do nothing;

update public.employees e
set
  is_owner = exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = e.auth_user_id
      and u.papel = 'administrador'
      and u.status = 'ativo'
  ),
  is_barber = exists (
    select 1
    from public.barbershop_employee_links link
    where link.employee_id = e.id
      and link.role = 'barbeiro'
      and link.status = 'ativo'
  )
  or exists (
    select 1
    from public.usuarios u
    join public.barbeiros b
      on b.empresa_id = u.empresa_id
     and b.usuario_id = u.id
     and b.status = 'ativo'
    where u.auth_user_id = e.auth_user_id
      and u.status = 'ativo'
  ),
  appears_in_schedule = exists (
    select 1
    from public.barbershop_employee_links link
    where link.employee_id = e.id
      and link.role = 'barbeiro'
      and link.status = 'ativo'
  )
  or exists (
    select 1
    from public.usuarios u
    join public.barbeiros b
      on b.empresa_id = u.empresa_id
     and b.usuario_id = u.id
     and b.status = 'ativo'
    where u.auth_user_id = e.auth_user_id
      and u.status = 'ativo'
  ),
  updated_at = now()
where exists (
  select 1
  from public.barbershop_employee_links link
  where link.employee_id = e.id
);

notify pgrst, 'reload schema';
