create table if not exists public.barber_unavailability (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  barber_id uuid not null,
  date date not null,
  all_day boolean not null default false,
  start_time time,
  end_time time,
  reason text not null,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  constraint barber_unavailability_barber_empresa_fk
    foreign key (empresa_id, barber_id)
    references public.barbeiros(empresa_id, id)
    on delete cascade,
  constraint barber_unavailability_time_check
    check (
      all_day = true
      or (
        start_time is not null
        and end_time is not null
        and start_time < end_time
      )
    )
);

create index if not exists barber_unavailability_empresa_date_idx
  on public.barber_unavailability(empresa_id, date);

create index if not exists barber_unavailability_barber_date_idx
  on public.barber_unavailability(empresa_id, barber_id, date);

drop trigger if exists barber_unavailability_set_updated_at
on public.barber_unavailability;

create trigger barber_unavailability_set_updated_at
before update on public.barber_unavailability
for each row execute function public.set_updated_at();

alter table public.barber_unavailability enable row level security;

drop policy if exists "barber_unavailability_select"
on public.barber_unavailability;

create policy "barber_unavailability_select"
on public.barber_unavailability
for select
to authenticated
using (
  public.belongs_to_empresa(empresa_id)
  or exists (
    select 1
    from public.profiles
    where profiles.auth_user_id = auth.uid()
      and profiles.role = 'cliente'
  )
);

drop policy if exists "barber_unavailability_insert_admin"
on public.barber_unavailability;

create policy "barber_unavailability_insert_admin"
on public.barber_unavailability
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuarios
    where usuarios.auth_user_id = auth.uid()
      and usuarios.empresa_id = barber_unavailability.empresa_id
      and usuarios.papel in ('administrador', 'gerente')
      and usuarios.status = 'ativo'
  )
);

drop policy if exists "barber_unavailability_update_admin"
on public.barber_unavailability;

create policy "barber_unavailability_update_admin"
on public.barber_unavailability
for update
to authenticated
using (
  exists (
    select 1
    from public.usuarios
    where usuarios.auth_user_id = auth.uid()
      and usuarios.empresa_id = barber_unavailability.empresa_id
      and usuarios.papel in ('administrador', 'gerente')
      and usuarios.status = 'ativo'
  )
)
with check (
  exists (
    select 1
    from public.usuarios
    where usuarios.auth_user_id = auth.uid()
      and usuarios.empresa_id = barber_unavailability.empresa_id
      and usuarios.papel in ('administrador', 'gerente')
      and usuarios.status = 'ativo'
  )
);

drop policy if exists "barber_unavailability_delete_admin"
on public.barber_unavailability;

create policy "barber_unavailability_delete_admin"
on public.barber_unavailability
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuarios
    where usuarios.auth_user_id = auth.uid()
      and usuarios.empresa_id = barber_unavailability.empresa_id
      and usuarios.papel in ('administrador', 'gerente')
      and usuarios.status = 'ativo'
  )
);
