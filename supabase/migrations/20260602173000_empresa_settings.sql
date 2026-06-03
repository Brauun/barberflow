alter table public.empresas
add column if not exists endereco text,
add column if not exists logo_url text,
add column if not exists percentual_comissao_padrao numeric(5, 2) not null default 60
  check (percentual_comissao_padrao >= 0 and percentual_comissao_padrao <= 100);

create or replace function public.registrar_atendimento(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_data_hora_inicio timestamptz,
  p_valor numeric,
  p_forma_pagamento text
)
returns public.atendimentos
language plpgsql
security definer
set search_path = public
as $$
declare
  novo_atendimento public.atendimentos;
  servico_nome text;
  comissao_percentual numeric(5, 2);
  valor_comissao numeric(12, 2);
begin
  if not public.belongs_to_empresa(p_empresa_id) then
    raise exception 'Empresa invalida para o usuario autenticado.';
  end if;

  if p_valor < 0 then
    raise exception 'Valor do atendimento nao pode ser negativo.';
  end if;

  select percentual_comissao_padrao into comissao_percentual
  from public.empresas
  where id = p_empresa_id
    and status = 'ativa';

  if comissao_percentual is null then
    raise exception 'Empresa invalida ou inativa.';
  end if;

  select nome into servico_nome
  from public.servicos
  where id = p_servico_id
    and empresa_id = p_empresa_id
    and ativo = true;

  if servico_nome is null then
    raise exception 'Servico invalido ou inativo.';
  end if;

  if not exists (
    select 1
    from public.clientes
    where id = p_cliente_id
      and empresa_id = p_empresa_id
      and status = 'ativo'
  ) then
    raise exception 'Cliente invalido ou inativo.';
  end if;

  if not exists (
    select 1
    from public.barbeiros
    where id = p_barbeiro_id
      and empresa_id = p_empresa_id
      and status = 'ativo'
  ) then
    raise exception 'Barbeiro invalido ou inativo.';
  end if;

  valor_comissao := round((p_valor * comissao_percentual / 100), 2);

  insert into public.atendimentos (
    empresa_id,
    cliente_id,
    barbeiro_id,
    servico_id,
    data_hora_inicio,
    valor,
    forma_pagamento,
    status
  )
  values (
    p_empresa_id,
    p_cliente_id,
    p_barbeiro_id,
    p_servico_id,
    p_data_hora_inicio,
    p_valor,
    p_forma_pagamento,
    'concluido'
  )
  returning * into novo_atendimento;

  insert into public.movimentacoes_financeiras (
    empresa_id,
    atendimento_id,
    tipo,
    categoria,
    descricao,
    valor,
    forma_pagamento,
    data_movimentacao,
    status
  )
  values (
    p_empresa_id,
    novo_atendimento.id,
    'entrada',
    'atendimento',
    'Atendimento - ' || servico_nome,
    p_valor,
    p_forma_pagamento,
    p_data_hora_inicio::date,
    'confirmada'
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
    novo_atendimento.id,
    p_barbeiro_id,
    comissao_percentual,
    p_valor,
    valor_comissao,
    'pendente'
  );

  return novo_atendimento;
end;
$$;

revoke all on function public.registrar_atendimento(
  uuid,
  uuid,
  uuid,
  uuid,
  timestamptz,
  numeric,
  text
) from public;

grant execute on function public.registrar_atendimento(
  uuid,
  uuid,
  uuid,
  uuid,
  timestamptz,
  numeric,
  text
) to authenticated;
