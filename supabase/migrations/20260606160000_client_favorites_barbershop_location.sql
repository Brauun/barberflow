alter table public.empresas
  add column if not exists cep text,
  add column if not exists rua text,
  add column if not exists numero text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists complemento text,
  add column if not exists latitude numeric(10, 7),
  add column if not exists longitude numeric(10, 7);

alter table public.barbershops
  add column if not exists cep text,
  add column if not exists rua text,
  add column if not exists numero text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists complemento text;

create table if not exists public.client_favorite_barbershops (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, barbershop_id)
);

create index if not exists client_favorite_barbershops_client_idx
  on public.client_favorite_barbershops(client_id, created_at desc);

create index if not exists client_favorite_barbershops_barbershop_idx
  on public.client_favorite_barbershops(barbershop_id);

create index if not exists empresas_location_idx
  on public.empresas(latitude, longitude);

alter table public.client_favorite_barbershops enable row level security;

drop policy if exists "client_favorites_own_select" on public.client_favorite_barbershops;
create policy "client_favorites_own_select"
on public.client_favorite_barbershops
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = client_favorite_barbershops.client_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
);

drop policy if exists "client_favorites_own_insert" on public.client_favorite_barbershops;
create policy "client_favorites_own_insert"
on public.client_favorite_barbershops
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = client_favorite_barbershops.client_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
);

drop policy if exists "client_favorites_own_delete" on public.client_favorite_barbershops;
create policy "client_favorites_own_delete"
on public.client_favorite_barbershops
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = client_favorite_barbershops.client_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
);

drop policy if exists "empresas_location_update_own_company" on public.empresas;
create policy "empresas_location_update_own_company"
on public.empresas
for update
using (public.belongs_to_empresa(id))
with check (public.belongs_to_empresa(id));
