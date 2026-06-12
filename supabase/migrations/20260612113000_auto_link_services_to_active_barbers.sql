create or replace function public.link_service_to_active_barbers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.ativo, false) = false or coalesce(new.status, 'ativo') = 'inativo' then
    return new;
  end if;

  insert into public.barber_services (
    empresa_id,
    barbeiro_id,
    service_id,
    active
  )
  select
    new.empresa_id,
    b.id,
    new.id,
    true
  from public.barbeiros b
  where b.empresa_id = new.empresa_id
    and b.status = 'ativo'
  on conflict (empresa_id, barbeiro_id, service_id)
  do update set
    active = true,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists servicos_auto_link_active_barbers on public.servicos;
create trigger servicos_auto_link_active_barbers
after insert on public.servicos
for each row
execute function public.link_service_to_active_barbers();

create or replace function public.link_active_services_to_barber()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.status, 'ativo') <> 'ativo' then
    return new;
  end if;

  insert into public.barber_services (
    empresa_id,
    barbeiro_id,
    service_id,
    active
  )
  select
    new.empresa_id,
    new.id,
    s.id,
    true
  from public.servicos s
  where s.empresa_id = new.empresa_id
    and s.ativo = true
    and coalesce(s.status, 'ativo') <> 'inativo'
  on conflict (empresa_id, barbeiro_id, service_id)
  do update set
    active = true,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists barbeiros_auto_link_active_services on public.barbeiros;
create trigger barbeiros_auto_link_active_services
after insert or update of status on public.barbeiros
for each row
execute function public.link_active_services_to_barber();

insert into public.barber_services (
  empresa_id,
  barbeiro_id,
  service_id,
  active
)
select
  b.empresa_id,
  b.id,
  s.id,
  true
from public.barbeiros b
join public.servicos s on s.empresa_id = b.empresa_id
where b.status = 'ativo'
  and s.ativo = true
  and coalesce(s.status, 'ativo') <> 'inativo'
on conflict (empresa_id, barbeiro_id, service_id)
do update set
  active = true,
  updated_at = now();

notify pgrst, 'reload schema';
