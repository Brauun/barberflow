alter table public.clientes
  add column if not exists client_profile_id uuid references public.profiles(id) on delete set null;

create unique index if not exists clientes_empresa_client_profile_unique_idx
  on public.clientes(empresa_id, client_profile_id)
  where client_profile_id is not null;

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
    and not public.has_empresa_role(p_empresa_id, array['administrador', 'gerente', 'recepcao'])
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

  if not found then
    raise exception 'Agendamento sem serviço vinculado.';
  end if;

  if first_item.servico_id is null then
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

  if cliente_id_result is null then
    select id
    into cliente_id_result
    from public.clientes
    where empresa_id = p_empresa_id
      and client_profile_id = profile_row.id
    limit 1;
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

do $$
declare
  appointment_to_sync record;
begin
  for appointment_to_sync in
    select id, empresa_id
    from public.appointments
    where status = 'concluido'
      and empresa_id is not null
  loop
    begin
      perform public.complete_appointment_financial_flow(
        appointment_to_sync.empresa_id,
        appointment_to_sync.id,
        'Agendamento'
      );
    exception when others then
      raise notice 'Não foi possível sincronizar appointment %: %',
        appointment_to_sync.id,
        sqlerrm;
    end;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
