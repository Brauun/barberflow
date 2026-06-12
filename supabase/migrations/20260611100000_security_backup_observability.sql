create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  area text not null,
  message text not null,
  stack text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_empresa_created_idx
  on public.audit_logs(empresa_id, created_at desc);
create index if not exists audit_logs_action_idx
  on public.audit_logs(action, created_at desc);
create index if not exists error_logs_empresa_created_idx
  on public.error_logs(empresa_id, created_at desc);

alter table public.audit_logs enable row level security;
alter table public.error_logs enable row level security;

drop policy if exists "audit_logs_admin_select" on public.audit_logs;
drop policy if exists "audit_logs_authenticated_insert" on public.audit_logs;
drop policy if exists "error_logs_admin_select" on public.error_logs;
drop policy if exists "error_logs_authenticated_insert" on public.error_logs;

create policy "audit_logs_admin_select"
on public.audit_logs
for select
to authenticated
using (
  empresa_id is not null
  and public.has_empresa_role(empresa_id, array['administrador'])
);

create policy "audit_logs_authenticated_insert"
on public.audit_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    empresa_id is null
    or public.belongs_to_empresa(empresa_id)
    or exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.role = 'cliente'
    )
  )
);

create policy "error_logs_admin_select"
on public.error_logs
for select
to authenticated
using (
  empresa_id is not null
  and public.has_empresa_role(empresa_id, array['administrador'])
);

create policy "error_logs_authenticated_insert"
on public.error_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    empresa_id is null
    or public.belongs_to_empresa(empresa_id)
    or exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.role = 'cliente'
    )
  )
);

drop policy if exists "notification_logs own select" on public.notification_logs;
create policy "notification_logs own select"
on public.notification_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = notification_logs.empresa_id
      and u.papel in ('administrador', 'gerente')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = notification_logs.client_id
      and p.auth_user_id = auth.uid()
  )
);
