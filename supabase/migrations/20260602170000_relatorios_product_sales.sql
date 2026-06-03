create table if not exists public.vendas_produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  produto_id uuid not null,
  quantidade integer not null check (quantidade > 0),
  valor_unitario numeric(12, 2) not null check (valor_unitario >= 0),
  valor_total numeric(12, 2) not null check (valor_total >= 0),
  forma_pagamento text,
  data_venda date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  constraint vendas_produtos_produto_empresa_fk
    foreign key (empresa_id, produto_id)
    references public.produtos(empresa_id, id)
    on delete restrict
);

create index if not exists vendas_produtos_empresa_data_idx
on public.vendas_produtos(empresa_id, data_venda);

create index if not exists vendas_produtos_empresa_produto_idx
on public.vendas_produtos(empresa_id, produto_id);

create trigger vendas_produtos_set_updated_at
before update on public.vendas_produtos
for each row execute function public.set_updated_at();

alter table public.vendas_produtos enable row level security;

create policy "vendas_produtos_empresa_isolada"
on public.vendas_produtos
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

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

  insert into public.vendas_produtos (
    empresa_id,
    produto_id,
    quantidade,
    valor_unitario,
    valor_total,
    forma_pagamento,
    data_venda
  )
  values (
    p_empresa_id,
    p_produto_id,
    p_quantidade,
    produto_atual.preco_venda,
    valor_total,
    p_forma_pagamento,
    current_date
  );

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
