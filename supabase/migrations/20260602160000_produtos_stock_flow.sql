alter table public.produtos
add column if not exists categoria text;

create index if not exists produtos_empresa_categoria_idx
on public.produtos(empresa_id, categoria);

create or replace function public.registrar_entrada_estoque(
  p_empresa_id uuid,
  p_produto_id uuid,
  p_quantidade integer
)
returns public.produtos
language plpgsql
security definer
set search_path = public
as $$
declare
  produto_atualizado public.produtos;
begin
  if not public.belongs_to_empresa(p_empresa_id) then
    raise exception 'Empresa invalida para o usuario autenticado.';
  end if;

  if p_quantidade <= 0 then
    raise exception 'Quantidade de entrada deve ser maior que zero.';
  end if;

  update public.produtos
  set estoque_atual = estoque_atual + p_quantidade
  where id = p_produto_id
    and empresa_id = p_empresa_id
  returning * into produto_atualizado;

  if produto_atualizado.id is null then
    raise exception 'Produto nao encontrado.';
  end if;

  return produto_atualizado;
end;
$$;

create or replace function public.registrar_venda_produto(
  p_empresa_id uuid,
  p_produto_id uuid,
  p_quantidade integer,
  p_forma_pagamento text
)
returns public.produtos
language plpgsql
security definer
set search_path = public
as $$
declare
  produto_atual public.produtos;
  produto_atualizado public.produtos;
  valor_total numeric(12, 2);
begin
  if not public.belongs_to_empresa(p_empresa_id) then
    raise exception 'Empresa invalida para o usuario autenticado.';
  end if;

  if p_quantidade <= 0 then
    raise exception 'Quantidade vendida deve ser maior que zero.';
  end if;

  select *
  into produto_atual
  from public.produtos
  where id = p_produto_id
    and empresa_id = p_empresa_id
    and ativo = true
  for update;

  if produto_atual.id is null then
    raise exception 'Produto nao encontrado ou inativo.';
  end if;

  if produto_atual.estoque_atual < p_quantidade then
    raise exception 'Estoque insuficiente para venda.';
  end if;

  valor_total := round(produto_atual.preco_venda * p_quantidade, 2);

  update public.produtos
  set estoque_atual = estoque_atual - p_quantidade
  where id = p_produto_id
    and empresa_id = p_empresa_id
  returning * into produto_atualizado;

  insert into public.movimentacoes_financeiras (
    empresa_id,
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
    'entrada',
    'produto',
    'Venda de produto - ' || produto_atual.nome,
    valor_total,
    p_forma_pagamento,
    current_date,
    'confirmada'
  );

  return produto_atualizado;
end;
$$;

revoke all on function public.registrar_entrada_estoque(uuid, uuid, integer)
from public;

grant execute on function public.registrar_entrada_estoque(uuid, uuid, integer)
to authenticated;

revoke all on function public.registrar_venda_produto(uuid, uuid, integer, text)
from public;

grant execute on function public.registrar_venda_produto(uuid, uuid, integer, text)
to authenticated;
