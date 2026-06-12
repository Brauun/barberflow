create or replace function public.employee_is_current_auth_user(p_employee_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees employee
    where employee.id = p_employee_id
      and employee.auth_user_id = auth.uid()
  );
$$;

create or replace function public.can_access_employee(p_employee_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.employee_is_current_auth_user(p_employee_id)
    or exists (
      select 1
      from public.barbershop_employee_links link
      where link.employee_id = p_employee_id
        and public.belongs_to_empresa(link.empresa_id)
    );
$$;

create or replace function public.can_manage_employee(p_employee_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.barbershop_employee_links link
    where link.employee_id = p_employee_id
      and public.has_empresa_role(link.empresa_id, array['administrador', 'gerente'])
  );
$$;

revoke all on function public.employee_is_current_auth_user(uuid) from public;
revoke all on function public.can_access_employee(uuid) from public;
revoke all on function public.can_manage_employee(uuid) from public;

grant execute on function public.employee_is_current_auth_user(uuid) to authenticated;
grant execute on function public.can_access_employee(uuid) to authenticated;
grant execute on function public.can_manage_employee(uuid) to authenticated;

drop policy if exists "employees_company_or_self_select" on public.employees;
create policy "employees_company_or_self_select"
on public.employees
for select
to authenticated
using (public.can_access_employee(id));

drop policy if exists "employees_admin_update" on public.employees;
create policy "employees_admin_update"
on public.employees
for update
to authenticated
using (
  auth_user_id = auth.uid()
  or public.can_manage_employee(id)
)
with check (
  auth_user_id = auth.uid()
  or public.can_manage_employee(id)
);

drop policy if exists "employee_links_company_select"
on public.barbershop_employee_links;
create policy "employee_links_company_select"
on public.barbershop_employee_links
for select
to authenticated
using (
  public.belongs_to_empresa(empresa_id)
  or public.employee_is_current_auth_user(employee_id)
);

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
begin
  if auth.uid() is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  if not public.has_empresa_role(p_empresa_id, array['administrador', 'gerente']) then
    raise exception 'Apenas administrador ou gerente pode convidar funcionarios.';
  end if;

  if p_role not in ('administrador', 'gerente', 'barbeiro', 'recepcao') then
    raise exception 'Funcao invalida para convite.';
  end if;

  normalized_email := lower(trim(p_email));

  if normalized_email = '' then
    raise exception 'E-mail do funcionario e obrigatorio.';
  end if;

  insert into public.employees (
    nome,
    email,
    telefone,
    status
  )
  values (
    trim(p_nome),
    normalized_email,
    nullif(trim(coalesce(p_telefone, '')), ''),
    'ativo'
  )
  on conflict (email)
  do update set
    nome = excluded.nome,
    telefone = excluded.telefone,
    status = 'ativo'
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

revoke all on function public.create_employee_invitation(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  uuid
) from public;

grant execute on function public.create_employee_invitation(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  uuid
) to authenticated;
