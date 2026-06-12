alter table public.servicos
  add column if not exists categoria text,
  add column if not exists percentual_comissao numeric(5, 2),
  add column if not exists status text not null default 'ativo'
    check (status in ('ativo', 'inativo')),
  add column if not exists allow_barber_create boolean not null default false,
  add column if not exists created_by uuid default auth.uid();

update public.servicos
set status = case when ativo then 'ativo' else 'inativo' end
where status is distinct from case when ativo then 'ativo' else 'inativo' end;

create or replace function public.sync_servicos_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if new.status is null then
    new.status := case when coalesce(new.ativo, true) then 'ativo' else 'inativo' end;
  end if;

  new.ativo := new.status = 'ativo';
  return new;
end;
$$;

drop trigger if exists servicos_sync_status on public.servicos;
create trigger servicos_sync_status
before insert or update on public.servicos
for each row
execute function public.sync_servicos_status();

create table if not exists public.barber_services (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  barbeiro_id uuid not null,
  service_id uuid not null,
  custom_duration integer check (custom_duration is null or custom_duration > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, barbeiro_id, service_id),
  constraint barber_services_barbeiro_empresa_fk
    foreign key (empresa_id, barbeiro_id)
    references public.barbeiros(empresa_id, id)
    on delete cascade,
  constraint barber_services_service_empresa_fk
    foreign key (empresa_id, service_id)
    references public.servicos(empresa_id, id)
    on delete cascade
);

create index if not exists barber_services_empresa_idx
  on public.barber_services(empresa_id);
create index if not exists barber_services_barbeiro_active_idx
  on public.barber_services(empresa_id, barbeiro_id, active);
create index if not exists barber_services_service_active_idx
  on public.barber_services(empresa_id, service_id, active);

drop trigger if exists barber_services_set_updated_at on public.barber_services;
create trigger barber_services_set_updated_at
before update on public.barber_services
for each row
execute function public.set_updated_at();

insert into public.barber_services (empresa_id, barbeiro_id, service_id, active)
select b.empresa_id, b.id, s.id, true
from public.barbeiros b
join public.servicos s on s.empresa_id = b.empresa_id
where b.status = 'ativo'
  and s.ativo = true
on conflict (empresa_id, barbeiro_id, service_id)
do update set active = true;

alter table public.barber_services enable row level security;

drop policy if exists "servicos_empresa_isolada" on public.servicos;
drop policy if exists "servicos_empresa_select" on public.servicos;
drop policy if exists "servicos_admin_insert" on public.servicos;
drop policy if exists "servicos_admin_update" on public.servicos;
drop policy if exists "servicos_admin_delete" on public.servicos;

create policy "servicos_empresa_select"
on public.servicos
for select
to authenticated
using (public.belongs_to_empresa(empresa_id));

create policy "servicos_admin_insert"
on public.servicos
for insert
to authenticated
with check (
  public.has_empresa_role(empresa_id, array['administrador'])
  and allow_barber_create = false
);

create policy "servicos_admin_update"
on public.servicos
for update
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']))
with check (
  public.has_empresa_role(empresa_id, array['administrador'])
  and allow_barber_create = false
);

create policy "servicos_admin_delete"
on public.servicos
for delete
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']));

drop policy if exists "barber_services_select_empresa_or_client" on public.barber_services;
drop policy if exists "barber_services_admin_manage" on public.barber_services;

create policy "barber_services_select_empresa_or_client"
on public.barber_services
for select
to authenticated
using (
  public.belongs_to_empresa(empresa_id)
  or exists (
    select 1
    from public.profiles p
    join public.barbershops b on b.empresa_id = barber_services.empresa_id
    where p.auth_user_id = auth.uid()
      and p.role = 'cliente'
      and (
        p.primary_barbershop_id = b.id
        or exists (
          select 1
          from public.client_barbershop cb
          where cb.client_profile_id = p.id
            and cb.barbershop_id = b.id
        )
      )
  )
);

create policy "barber_services_admin_manage"
on public.barber_services
for all
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']))
with check (public.has_empresa_role(empresa_id, array['administrador']));
