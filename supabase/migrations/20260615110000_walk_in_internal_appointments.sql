alter table public.appointments
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null,
  add column if not exists is_walk_in boolean not null default false,
  add column if not exists walk_in_customer_name text,
  add column if not exists walk_in_customer_phone text,
  add column if not exists walk_in_notes text,
  add column if not exists source text not null default 'CLIENT_APP',
  add column if not exists created_by_user_id uuid;

create index if not exists appointments_empresa_cliente_idx
  on public.appointments(empresa_id, cliente_id)
  where cliente_id is not null;

create index if not exists appointments_empresa_walk_in_idx
  on public.appointments(empresa_id, is_walk_in)
  where is_walk_in = true;

create or replace function public.create_internal_appointment(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_is_walk_in boolean,
  p_walk_in_customer_name text,
  p_walk_in_customer_phone text,
  p_walk_in_notes text,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_valor_original numeric,
  p_valor_desconto numeric default 0,
  p_valor_final numeric default null,
  p_motivo_desconto text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  barbershop_row public.barbershops;
  cliente_row public.clientes;
  barber_row public.barbeiros;
  service_row public.servicos;
  appointment_row public.appointments;
  service_duration integer;
  final_value numeric(12, 2);
  discount_value numeric(12, 2);
  local_date date;
  local_start time;
  local_end time;
  weekday integer;
  special_row public.barbershop_special_hours;
  business_row public.barbershop_business_hours;
begin
  if auth.uid() is null then
    raise exception 'Usuário autenticado não encontrado.';
  end if;

  if not (
    public.has_empresa_role(p_empresa_id, array['administrador', 'gerente', 'recepcao'])
    or public.is_current_barbeiro(p_empresa_id, p_barbeiro_id)
  ) then
    raise exception 'Usuário sem permissão para criar atendimento interno.';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'Horário de atendimento inválido.';
  end if;

  if coalesce(p_is_walk_in, false) then
    if nullif(trim(coalesce(p_walk_in_customer_name, '')), '') is null then
      raise exception 'Informe o nome do cliente avulso.';
    end if;
  else
    if p_cliente_id is null then
      raise exception 'Selecione um cliente cadastrado.';
    end if;

    select *
    into cliente_row
    from public.clientes c
    where c.id = p_cliente_id
      and c.empresa_id = p_empresa_id
      and c.status = 'ativo';

    if cliente_row.id is null then
      raise exception 'Cliente cadastrado não encontrado.';
    end if;
  end if;

  select *
  into barbershop_row
  from public.barbershops b
  where b.empresa_id = p_empresa_id
    and b.status = 'ativa'
  order by b.created_at asc
  limit 1;

  if barbershop_row.id is null then
    raise exception 'Barbearia ativa não encontrada.';
  end if;

  select *
  into barber_row
  from public.barbeiros b
  where b.id = p_barbeiro_id
    and b.empresa_id = p_empresa_id
    and b.status = 'ativo';

  if barber_row.id is null then
    raise exception 'Profissional indisponível para atendimento.';
  end if;

  select *
  into service_row
  from public.servicos s
  where s.id = p_servico_id
    and s.empresa_id = p_empresa_id
    and s.ativo = true
    and coalesce(s.status, 'ativo') <> 'inativo';

  if service_row.id is null then
    raise exception 'Serviço indisponível para atendimento.';
  end if;

  if not exists (
    select 1
    from public.barber_services bs
    where bs.empresa_id = p_empresa_id
      and bs.barbeiro_id = p_barbeiro_id
      and bs.service_id = p_servico_id
      and bs.active = true
  ) then
    raise exception 'Este profissional não executa o serviço selecionado.';
  end if;

  local_date := (p_starts_at at time zone 'America/Sao_Paulo')::date;
  local_start := (p_starts_at at time zone 'America/Sao_Paulo')::time;
  local_end := (p_ends_at at time zone 'America/Sao_Paulo')::time;
  weekday := extract(dow from local_date)::integer;

  select *
  into special_row
  from public.barbershop_special_hours sh
  where sh.empresa_id = p_empresa_id
    and sh.date = local_date
  limit 1;

  if special_row.id is not null then
    if special_row.is_closed
      or special_row.open_time is null
      or special_row.close_time is null
      or local_start < special_row.open_time
      or local_end > special_row.close_time
    then
      raise exception 'A barbearia não atende neste horário.';
    end if;
  else
    select *
    into business_row
    from public.barbershop_business_hours bh
    where bh.empresa_id = p_empresa_id
      and bh.day_of_week = weekday
    limit 1;

    if business_row.id is null then
      raise exception 'Agenda ainda não configurada pela barbearia.';
    end if;

    if business_row.is_open = false
      or business_row.open_time is null
      or business_row.close_time is null
      or local_start < business_row.open_time
      or local_end > business_row.close_time
    then
      raise exception 'A barbearia não atende neste horário.';
    end if;

    if business_row.break_start is not null
      and business_row.break_end is not null
      and local_start < business_row.break_end
      and local_end > business_row.break_start
    then
      raise exception 'Horário indisponível durante o intervalo da barbearia.';
    end if;
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.empresa_id = p_empresa_id
      and a.barbeiro_id = p_barbeiro_id
      and a.status not in ('cancelado', 'remarcado', 'nao_compareceu', 'faltou')
      and a.starts_at < p_ends_at
      and a.ends_at > p_starts_at
  ) then
    raise exception 'Este horário está ocupado. Escolha outro horário.';
  end if;

  if exists (
    select 1
    from public.atendimentos a
    left join public.servicos s on s.id = a.servico_id and s.empresa_id = a.empresa_id
    where a.empresa_id = p_empresa_id
      and a.barbeiro_id = p_barbeiro_id
      and a.status not in ('cancelado', 'remarcado', 'nao_compareceu', 'faltou')
      and a.data_hora_inicio < p_ends_at
      and coalesce(
        a.data_hora_fim,
        a.data_hora_inicio + make_interval(mins => coalesce(s.duration_minutes, s.duracao_minutos, 30))
      ) > p_starts_at
  ) then
    raise exception 'Este horário está ocupado. Escolha outro horário.';
  end if;

  if exists (
    select 1
    from public.barber_unavailability bu
    where bu.empresa_id = p_empresa_id
      and bu.barber_id = p_barbeiro_id
      and bu.date = local_date
      and (
        bu.all_day = true
        or (
          bu.start_time is not null
          and bu.end_time is not null
          and local_start < bu.end_time
          and local_end > bu.start_time
        )
      )
  ) then
    raise exception 'Este profissional não está disponível neste horário.';
  end if;

  service_duration := coalesce(
    service_row.duration_minutes,
    service_row.duracao_minutos,
    greatest(1, extract(epoch from (p_ends_at - p_starts_at))::integer / 60)
  );
  discount_value := greatest(0, coalesce(p_valor_desconto, 0));
  final_value := greatest(0, coalesce(p_valor_final, p_valor_original - discount_value));

  insert into public.appointments (
    empresa_id,
    barbershop_id,
    cliente_id,
    client_profile_id,
    barbeiro_id,
    starts_at,
    ends_at,
    status,
    valor_original,
    valor_desconto,
    valor_final,
    motivo_desconto,
    is_walk_in,
    walk_in_customer_name,
    walk_in_customer_phone,
    walk_in_notes,
    source,
    created_by_user_id
  )
  values (
    p_empresa_id,
    barbershop_row.id,
    case when coalesce(p_is_walk_in, false) then null else p_cliente_id end,
    case when coalesce(p_is_walk_in, false) then null else cliente_row.client_profile_id end,
    p_barbeiro_id,
    p_starts_at,
    p_ends_at,
    'agendado',
    p_valor_original,
    discount_value,
    final_value,
    p_motivo_desconto,
    coalesce(p_is_walk_in, false),
    nullif(trim(coalesce(p_walk_in_customer_name, '')), ''),
    nullif(trim(coalesce(p_walk_in_customer_phone, '')), ''),
    nullif(trim(coalesce(p_walk_in_notes, '')), ''),
    'INTERNAL',
    auth.uid()
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
    p_valor_original,
    discount_value,
    final_value
  );

  insert into public.appointment_status_logs (
    appointment_id,
    source,
    empresa_id,
    old_status,
    new_status,
    changed_by,
    changed_by_role,
    reason,
    metadata
  )
  values (
    appointment_row.id,
    'appointments',
    p_empresa_id,
    null,
    'agendado',
    auth.uid(),
    'internal',
    case when coalesce(p_is_walk_in, false) then 'Atendimento avulso criado.' else 'Atendimento interno criado.' end,
    jsonb_build_object(
      'is_walk_in', coalesce(p_is_walk_in, false),
      'cliente_id', p_cliente_id,
      'walk_in_customer_name', p_walk_in_customer_name,
      'servico_id', p_servico_id,
      'barbeiro_id', p_barbeiro_id,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at,
      'valor_final', final_value
    )
  );

  insert into public.audit_logs (
    empresa_id,
    user_id,
    user_role,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_empresa_id,
    auth.uid(),
    case
      when public.has_empresa_role(p_empresa_id, array['administrador']) then 'administrador'
      when public.has_empresa_role(p_empresa_id, array['gerente']) then 'gerente'
      when public.has_empresa_role(p_empresa_id, array['recepcao']) then 'recepcao'
      else 'barbeiro'
    end,
    case when coalesce(p_is_walk_in, false) then 'CREATE_WALK_IN_APPOINTMENT' else 'CREATE_INTERNAL_APPOINTMENT' end,
    'appointments',
    appointment_row.id,
    jsonb_build_object(
      'cliente', coalesce(cliente_row.nome, p_walk_in_customer_name),
      'telefone', p_walk_in_customer_phone,
      'servico', service_row.nome,
      'barbeiro', barber_row.nome,
      'starts_at', p_starts_at,
      'valor', final_value
    )
  );

  return appointment_row;
end;
$$;

revoke all on function public.create_internal_appointment(
  uuid,
  uuid,
  boolean,
  text,
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  numeric,
  numeric,
  numeric,
  text
) from public;

grant execute on function public.create_internal_appointment(
  uuid,
  uuid,
  boolean,
  text,
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  numeric,
  numeric,
  numeric,
  text
) to authenticated;

create or replace function public.complete_appointment_financial_flow(
  p_empresa_id uuid,
  p_appointment_id uuid,
  p_forma_pagamento text default 'Agendamento'
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_row public.appointments;
  profile_row public.profiles;
  company_row public.empresas;
  cliente_id_result uuid;
  atendimento_id_result uuid;
  first_item record;
  valor_original_result numeric(12, 2);
  valor_desconto_result numeric(12, 2);
  valor_final_result numeric(12, 2);
  percentual_comissao numeric(5, 2);
  valor_base_comissao numeric(12, 2);
begin
  if auth.uid() is not null
    and not (
      public.has_empresa_role(p_empresa_id, array['administrador', 'gerente', 'recepcao'])
      or exists (
        select 1
        from public.appointments a
        where a.id = p_appointment_id
          and public.is_current_barbeiro(p_empresa_id, a.barbeiro_id)
      )
    )
  then
    raise exception 'Apenas usuários autorizados podem concluir agendamentos.';
  end if;

  select *
  into appointment_row
  from public.appointments
  where id = p_appointment_id
    and empresa_id = p_empresa_id
  for update;

  if appointment_row.id is null then
    raise exception 'Agendamento não encontrado.';
  end if;

  if appointment_row.status in ('cancelado', 'remarcado', 'nao_compareceu', 'faltou') then
    raise exception 'Agendamento % não pode ser concluído.', appointment_row.status;
  end if;

  select *
  into first_item
  from public.appointment_items
  where appointment_id = appointment_row.id
  order by created_at asc
  limit 1;

  if not found or first_item.servico_id is null then
    raise exception 'Agendamento sem serviço vinculado.';
  end if;

  select *
  into company_row
  from public.empresas
  where id = p_empresa_id;

  percentual_comissao := coalesce(company_row.percentual_comissao_padrao, 60);
  valor_original_result := coalesce(nullif(appointment_row.valor_original, 0), first_item.valor_original, first_item.valor_final, 0);
  valor_desconto_result := coalesce(appointment_row.valor_desconto, first_item.valor_desconto, 0);
  valor_final_result := coalesce(nullif(appointment_row.valor_final, 0), first_item.valor_final, valor_original_result - valor_desconto_result, 0);
  valor_base_comissao := valor_final_result;

  cliente_id_result := appointment_row.cliente_id;

  if cliente_id_result is null and appointment_row.client_profile_id is not null then
    select *
    into profile_row
    from public.profiles
    where id = appointment_row.client_profile_id;

    insert into public.clientes (
      empresa_id,
      client_profile_id,
      nome,
      telefone,
      email,
      status
    )
    values (
      p_empresa_id,
      profile_row.id,
      coalesce(profile_row.nome, 'Cliente'),
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
      updated_at = now()
    returning id into cliente_id_result;
  end if;

  if cliente_id_result is null and appointment_row.is_walk_in then
    insert into public.clientes (
      empresa_id,
      nome,
      telefone,
      observacoes,
      status
    )
    values (
      p_empresa_id,
      coalesce(nullif(trim(appointment_row.walk_in_customer_name), ''), 'Cliente avulso'),
      appointment_row.walk_in_customer_phone,
      coalesce(appointment_row.walk_in_notes, 'Cliente avulso registrado no atendimento.'),
      'ativo'
    )
    returning id into cliente_id_result;

    update public.appointments
    set cliente_id = cliente_id_result,
        updated_at = now()
    where id = appointment_row.id;
  end if;

  if cliente_id_result is null then
    raise exception 'Agendamento sem cliente vinculado.';
  end if;

  atendimento_id_result := appointment_row.atendimento_id;

  if atendimento_id_result is null then
    insert into public.atendimentos (
      empresa_id,
      cliente_id,
      barbeiro_id,
      servico_id,
      data_hora_inicio,
      data_hora_fim,
      valor,
      valor_original,
      valor_desconto,
      valor_final,
      motivo_desconto,
      comissao_base,
      desconto,
      forma_pagamento,
      status
    )
    values (
      p_empresa_id,
      cliente_id_result,
      appointment_row.barbeiro_id,
      first_item.servico_id,
      appointment_row.starts_at,
      appointment_row.ends_at,
      valor_final_result,
      valor_original_result,
      valor_desconto_result,
      valor_final_result,
      appointment_row.motivo_desconto,
      'liquido',
      valor_desconto_result,
      p_forma_pagamento,
      'concluido'
    )
    returning id into atendimento_id_result;
  else
    update public.atendimentos
    set
      status = 'concluido',
      data_hora_inicio = appointment_row.starts_at,
      data_hora_fim = appointment_row.ends_at,
      valor = valor_final_result,
      valor_original = valor_original_result,
      valor_desconto = valor_desconto_result,
      valor_final = valor_final_result,
      desconto = valor_desconto_result,
      forma_pagamento = coalesce(forma_pagamento, p_forma_pagamento),
      updated_at = now()
    where empresa_id = p_empresa_id
      and id = atendimento_id_result;
  end if;

  update public.appointments
  set
    atendimento_id = atendimento_id_result,
    status = 'concluido',
    updated_at = now()
  where id = appointment_row.id
  returning * into appointment_row;

  insert into public.movimentacoes_financeiras (
    empresa_id,
    atendimento_id,
    appointment_id,
    tipo,
    categoria,
    descricao,
    valor,
    forma_pagamento,
    data_movimentacao,
    status
  )
  select
    p_empresa_id,
    atendimento_id_result,
    appointment_row.id,
    'entrada',
    'Atendimento',
    'Atendimento - ' || coalesce(first_item.nome, 'Serviço'),
    valor_final_result,
    p_forma_pagamento,
    (appointment_row.starts_at at time zone 'America/Sao_Paulo')::date,
    'confirmada'
  where not exists (
    select 1
    from public.movimentacoes_financeiras mf
    where mf.empresa_id = p_empresa_id
      and mf.status <> 'cancelada'
      and (
        mf.appointment_id = appointment_row.id
        or mf.atendimento_id = atendimento_id_result
      )
      and mf.tipo = 'entrada'
  );

  insert into public.comissoes (
    empresa_id,
    atendimento_id,
    barbeiro_id,
    percentual,
    valor_base,
    valor_comissao,
    status
  )
  values (
    p_empresa_id,
    atendimento_id_result,
    appointment_row.barbeiro_id,
    percentual_comissao,
    valor_base_comissao,
    valor_base_comissao * (percentual_comissao / 100),
    'pendente'
  )
  on conflict (empresa_id, atendimento_id, barbeiro_id)
  do update set
    percentual = excluded.percentual,
    valor_base = excluded.valor_base,
    valor_comissao = excluded.valor_comissao,
    status = case
      when public.comissoes.status = 'cancelada' then 'pendente'
      else public.comissoes.status
    end,
    updated_at = now();

  return appointment_row;
end;
$$;

revoke all on function public.complete_appointment_financial_flow(uuid, uuid, text) from public;
grant execute on function public.complete_appointment_financial_flow(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
