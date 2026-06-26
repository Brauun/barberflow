-- Base segura para notificacoes push por dispositivo.
-- As chaves de inscricao pertencem somente ao proprio usuario autenticado.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete set null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_type text not null default 'browser',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_device_type_check
    check (device_type in ('ios_pwa', 'ios_safari', 'android', 'desktop', 'browser'))
);

create unique index if not exists push_subscriptions_endpoint_unique
  on public.push_subscriptions(endpoint);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions(user_id, is_active, updated_at desc);

create index if not exists push_subscriptions_empresa_active_idx
  on public.push_subscriptions(empresa_id, is_active, updated_at desc)
  where empresa_id is not null;

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "push subscriptions select own" on public.push_subscriptions;
create policy "push subscriptions select own"
on public.push_subscriptions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "push subscriptions insert own" on public.push_subscriptions;
create policy "push subscriptions insert own"
on public.push_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (empresa_id is null or public.belongs_to_empresa(empresa_id))
);

drop policy if exists "push subscriptions update own" on public.push_subscriptions;
create policy "push subscriptions update own"
on public.push_subscriptions
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (empresa_id is null or public.belongs_to_empresa(empresa_id))
);

drop policy if exists "push subscriptions delete own" on public.push_subscriptions;
create policy "push subscriptions delete own"
on public.push_subscriptions
for delete
to authenticated
using (user_id = auth.uid());
