create table if not exists public.barbershop_business_hours (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  is_open boolean not null default true,
  open_time time,
  close_time time,
  break_start time,
  break_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, day_of_week)
);

create table if not exists public.barbershop_special_hours (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  date date not null,
  is_closed boolean not null default false,
  open_time time,
  close_time time,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, date)
);

create index if not exists barbershop_business_hours_empresa_day_idx
  on public.barbershop_business_hours(empresa_id, day_of_week);

create index if not exists barbershop_special_hours_empresa_date_idx
  on public.barbershop_special_hours(empresa_id, date);

drop trigger if exists barbershop_business_hours_set_updated_at
on public.barbershop_business_hours;
create trigger barbershop_business_hours_set_updated_at
before update on public.barbershop_business_hours
for each row execute function public.set_updated_at();

drop trigger if exists barbershop_special_hours_set_updated_at
on public.barbershop_special_hours;
create trigger barbershop_special_hours_set_updated_at
before update on public.barbershop_special_hours
for each row execute function public.set_updated_at();

alter table public.barbershop_business_hours enable row level security;
alter table public.barbershop_special_hours enable row level security;

drop policy if exists "business_hours_select_company_or_clients"
on public.barbershop_business_hours;
create policy "business_hours_select_company_or_clients"
on public.barbershop_business_hours
for select
to authenticated
using (
  public.belongs_to_empresa(empresa_id)
  or exists (
    select 1
    from public.barbershops barbershop
    where barbershop.empresa_id = barbershop_business_hours.empresa_id
      and barbershop.status = 'ativa'
  )
);

drop policy if exists "business_hours_manage_company"
on public.barbershop_business_hours;
create policy "business_hours_manage_company"
on public.barbershop_business_hours
for all
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

drop policy if exists "special_hours_select_company_or_clients"
on public.barbershop_special_hours;
create policy "special_hours_select_company_or_clients"
on public.barbershop_special_hours
for select
to authenticated
using (
  public.belongs_to_empresa(empresa_id)
  or exists (
    select 1
    from public.barbershops barbershop
    where barbershop.empresa_id = barbershop_special_hours.empresa_id
      and barbershop.status = 'ativa'
  )
);

drop policy if exists "special_hours_manage_company"
on public.barbershop_special_hours;
create policy "special_hours_manage_company"
on public.barbershop_special_hours
for all
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));
