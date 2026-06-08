alter table public.usuarios
  drop constraint if exists usuarios_papel_check;

alter table public.usuarios
  add constraint usuarios_papel_check
  check (papel in ('administrador', 'gerente', 'barbeiro', 'recepcao'));

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nome text not null,
  email text not null unique,
  telefone text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.barbershop_employee_links (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  role text not null check (role in ('administrador', 'gerente', 'barbeiro', 'recepcao')),
  commission_percentage numeric(5, 2) not null default 60
    check (commission_percentage >= 0 and commission_percentage <= 100),
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, empresa_id)
);

create table if not exists public.employee_invitations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  nome text not null,
  email text not null,
  telefone text,
  role text not null check (role in ('administrador', 'gerente', 'barbeiro', 'recepcao')),
  commission_percentage numeric(5, 2) not null default 60
    check (commission_percentage >= 0 and commission_percentage <= 100),
  token text not null unique,
  status text not null default 'pendente'
    check (status in ('pendente', 'aceito', 'expirado', 'cancelado')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists employees_auth_user_id_idx
  on public.employees(auth_user_id);

create index if not exists employee_links_empresa_status_idx
  on public.barbershop_employee_links(empresa_id, status);

create index if not exists employee_invitations_empresa_status_idx
  on public.employee_invitations(empresa_id, status);

create index if not exists employee_invitations_token_idx
  on public.employee_invitations(token);

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

drop trigger if exists barbershop_employee_links_set_updated_at
on public.barbershop_employee_links;
create trigger barbershop_employee_links_set_updated_at
before update on public.barbershop_employee_links
for each row execute function public.set_updated_at();

alter table public.employees enable row level security;
alter table public.barbershop_employee_links enable row level security;
alter table public.employee_invitations enable row level security;

drop policy if exists "employees_company_or_self_select" on public.employees;
create policy "employees_company_or_self_select"
on public.employees
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or exists (
    select 1
    from public.barbershop_employee_links link
    where link.employee_id = employees.id
      and public.belongs_to_empresa(link.empresa_id)
  )
);

drop policy if exists "employees_admin_insert" on public.employees;
create policy "employees_admin_insert"
on public.employees
for insert
to authenticated
with check (true);

drop policy if exists "employees_admin_update" on public.employees;
create policy "employees_admin_update"
on public.employees
for update
to authenticated
using (
  auth_user_id = auth.uid()
  or exists (
    select 1
    from public.barbershop_employee_links link
    where link.employee_id = employees.id
      and public.has_empresa_role(link.empresa_id, array['administrador', 'gerente'])
  )
)
with check (true);

drop policy if exists "employee_links_company_select"
on public.barbershop_employee_links;
create policy "employee_links_company_select"
on public.barbershop_employee_links
for select
to authenticated
using (
  public.belongs_to_empresa(empresa_id)
  or exists (
    select 1
    from public.employees e
    where e.id = employee_id
      and e.auth_user_id = auth.uid()
  )
);

drop policy if exists "employee_links_admin_write"
on public.barbershop_employee_links;
create policy "employee_links_admin_write"
on public.barbershop_employee_links
for all
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

drop policy if exists "employee_invitations_company_select"
on public.employee_invitations;
create policy "employee_invitations_company_select"
on public.employee_invitations
for select
to authenticated
using (public.belongs_to_empresa(empresa_id));

drop policy if exists "employee_invitations_token_select"
on public.employee_invitations;
create policy "employee_invitations_token_select"
on public.employee_invitations
for select
to anon, authenticated
using (
  status = 'pendente'
  and expires_at > now()
);

drop policy if exists "employee_invitations_admin_write"
on public.employee_invitations;
create policy "employee_invitations_admin_write"
on public.employee_invitations
for all
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

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
begin
  if auth.uid() is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  select *
  into invitation
  from public.employee_invitations
  where token = p_token
  for update;

  if invitation.id is null then
    raise exception 'Convite nao encontrado.';
  end if;

  if invitation.status <> 'pendente' or invitation.expires_at <= now() then
    raise exception 'Convite expirado ou indisponivel.';
  end if;

  insert into public.employees (id, auth_user_id, nome, email, telefone, status)
  values (
    coalesce(invitation.employee_id, gen_random_uuid()),
    auth.uid(),
    coalesce(nullif(trim(p_nome), ''), invitation.nome),
    invitation.email,
    nullif(trim(p_telefone), ''),
    'ativo'
  )
  on conflict (email)
  do update set
    auth_user_id = auth.uid(),
    nome = excluded.nome,
    telefone = excluded.telefone,
    status = 'ativo'
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
    joined_at = coalesce(barbershop_employee_links.joined_at, now());

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
      status = 'ativo';
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

revoke all on function public.accept_employee_invitation(text, text, text)
from public;

grant execute on function public.accept_employee_invitation(text, text, text)
to authenticated;
