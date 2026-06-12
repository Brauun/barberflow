alter table public.clientes
  add column if not exists client_profile_id uuid references public.profiles(id) on delete set null;

create unique index if not exists clientes_empresa_client_profile_unique_idx
  on public.clientes(empresa_id, client_profile_id)
  where client_profile_id is not null;

insert into public.clientes (
  empresa_id,
  client_profile_id,
  nome,
  telefone,
  email,
  status
)
select distinct on (a.empresa_id, p.id)
  a.empresa_id,
  p.id,
  p.nome,
  p.telefone,
  p.email,
  'ativo'
from public.appointments a
join public.profiles p on p.id = a.client_profile_id
where a.empresa_id is not null
  and p.role = 'cliente'
on conflict (empresa_id, client_profile_id)
where client_profile_id is not null
do update set
  nome = excluded.nome,
  telefone = coalesce(excluded.telefone, public.clientes.telefone),
  email = coalesce(excluded.email, public.clientes.email),
  status = 'ativo',
  updated_at = now();

create or replace function public.create_client_appointment(
  p_barbershop_id uuid,
  p_client_profile_id uuid,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  barbershop_row public.barbershops;
  barber_row public.barbeiros;
  service_row public.servicos;
  appointment_row public.appointments;
  service_duration integer;
begin
  if auth.uid() is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'Horario de agendamento invalido.';
  end if;

  select *
  into profile_row
  from public.profiles p
  where p.id = p_client_profile_id
    and p.auth_user_id = auth.uid()
    and p.role = 'cliente';

  if profile_row.id is null then
    raise exception 'Perfil de cliente invalido para o usuario autenticado.';
  end if;

  select *
  into barbershop_row
  from public.barbershops b
  where b.id = p_barbershop_id
    and b.status = 'ativa';

  if barbershop_row.id is null or barbershop_row.empresa_id is null then
    raise exception 'Barbearia indisponivel para agendamento.';
  end if;

  select *
  into barber_row
  from public.barbeiros b
  where b.id = p_barbeiro_id
    and b.empresa_id = barbershop_row.empresa_id
    and b.status = 'ativo';

  if barber_row.id is null then
    raise exception 'Profissional indisponivel para agendamento.';
  end if;

  select *
  into service_row
  from public.servicos s
  where s.id = p_servico_id
    and s.empresa_id = barbershop_row.empresa_id
    and s.ativo = true
    and coalesce(s.status, 'ativo') <> 'inativo';

  if service_row.id is null then
    raise exception 'Servico indisponivel para agendamento.';
  end if;

  if not exists (
    select 1
    from public.barber_services bs
    where bs.empresa_id = barbershop_row.empresa_id
      and bs.barbeiro_id = p_barbeiro_id
      and bs.service_id = p_servico_id
      and bs.active = true
  ) then
    raise exception 'Este profissional nao executa o servico selecionado.';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.barbershop_id = p_barbershop_id
      and a.barbeiro_id = p_barbeiro_id
      and a.status not in ('cancelado', 'remarcado', 'nao_compareceu', 'faltou')
      and a.starts_at < p_ends_at
      and a.ends_at > p_starts_at
  ) then
    raise exception 'Este horario acabou de ficar indisponivel. Escolha outro horario.';
  end if;

  if exists (
    select 1
    from public.atendimentos a
    left join public.servicos s on s.id = a.servico_id and s.empresa_id = a.empresa_id
    where a.empresa_id = barbershop_row.empresa_id
      and a.barbeiro_id = p_barbeiro_id
      and a.status not in ('cancelado', 'remarcado', 'nao_compareceu', 'faltou')
      and a.data_hora_inicio < p_ends_at
      and coalesce(
        a.data_hora_fim,
        a.data_hora_inicio + make_interval(mins => coalesce(s.duration_minutes, s.duracao_minutos, 30))
      ) > p_starts_at
  ) then
    raise exception 'Este horario acabou de ficar indisponivel. Escolha outro horario.';
  end if;

  if exists (
    select 1
    from public.barber_unavailability bu
    where bu.empresa_id = barbershop_row.empresa_id
      and bu.barber_id = p_barbeiro_id
      and bu.date = (p_starts_at at time zone 'America/Sao_Paulo')::date
      and (
        bu.all_day = true
        or (
          bu.start_time is not null
          and bu.end_time is not null
          and (p_starts_at at time zone 'America/Sao_Paulo')::time < bu.end_time
          and (p_ends_at at time zone 'America/Sao_Paulo')::time > bu.start_time
        )
      )
  ) then
    raise exception 'Este profissional nao esta disponivel neste horario.';
  end if;

  insert into public.clientes (
    empresa_id,
    client_profile_id,
    nome,
    telefone,
    email,
    status
  )
  values (
    barbershop_row.empresa_id,
    profile_row.id,
    profile_row.nome,
    profile_row.telefone,
    profile_row.email,
    'ativo'
  )
  on conflict (empresa_id, client_profile_id)
  where client_profile_id is not null
  do update set
    nome = excluded.nome,
    telefone = coalesce(excluded.telefone, public.clientes.telefone),
    email = coalesce(excluded.email, public.clientes.email),
    status = 'ativo',
    updated_at = now();

  service_duration := coalesce(
    service_row.duration_minutes,
    service_row.duracao_minutos,
    greatest(1, extract(epoch from (p_ends_at - p_starts_at))::integer / 60)
  );

  insert into public.appointments (
    empresa_id,
    barbershop_id,
    client_profile_id,
    barbeiro_id,
    starts_at,
    ends_at,
    status,
    valor_original,
    valor_desconto,
    valor_final
  )
  values (
    barbershop_row.empresa_id,
    p_barbershop_id,
    p_client_profile_id,
    p_barbeiro_id,
    p_starts_at,
    p_ends_at,
    'agendado',
    service_row.preco,
    0,
    service_row.preco
  )
  returning * into appointment_row;

  insert into public.appointment_items (
    appointment_id,
    servico_id,
    nome,
    duration_minutes,
    valor_original,
    valor_desconto,
    valor_final
  )
  values (
    appointment_row.id,
    p_servico_id,
    service_row.nome,
    service_duration,
    service_row.preco,
    0,
    service_row.preco
  );

  return appointment_row;
end;
$$;

revoke all on function public.create_client_appointment(
  uuid,
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz
) from public;

grant execute on function public.create_client_appointment(
  uuid,
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz
) to authenticated;

notify pgrst, 'reload schema';
