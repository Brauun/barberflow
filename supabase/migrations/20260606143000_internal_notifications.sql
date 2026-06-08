create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  recipient_user_id uuid references public.usuarios(id) on delete cascade,
  recipient_employee_id uuid references public.employees(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_empresa_created_idx
  on public.notifications(empresa_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications(empresa_id, recipient_user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications company users select" on public.notifications;
create policy "notifications company users select" on public.notifications
for select using (
  exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = notifications.empresa_id
      and u.status = 'ativo'
      and (
        u.papel in ('administrador', 'gerente')
        or notifications.recipient_user_id = u.id
      )
  )
);

drop policy if exists "notifications company users update" on public.notifications;
create policy "notifications company users update" on public.notifications
for update using (
  exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = notifications.empresa_id
      and u.status = 'ativo'
      and (
        u.papel in ('administrador', 'gerente')
        or notifications.recipient_user_id = u.id
      )
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = notifications.empresa_id
      and u.status = 'ativo'
      and (
        u.papel in ('administrador', 'gerente')
        or notifications.recipient_user_id = u.id
      )
  )
);

drop policy if exists "notifications authenticated insert" on public.notifications;
create policy "notifications authenticated insert" on public.notifications
for insert with check (auth.uid() is not null);
