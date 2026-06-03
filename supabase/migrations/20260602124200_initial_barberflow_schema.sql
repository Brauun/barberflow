create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  telefone text,
  email text,
  endereco text,
  logo_url text,
  percentual_comissao_padrao numeric(5, 2) not null default 60
    check (percentual_comissao_padrao >= 0 and percentual_comissao_padrao <= 100),
  status text not null default 'ativa'
    check (status in ('ativa', 'inativa', 'suspensa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  telefone text,
  papel text not null default 'barbeiro'
    check (papel in ('administrador', 'gerente', 'barbeiro')),
  status text not null default 'ativo'
    check (status in ('ativo', 'inativo', 'bloqueado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id),
  unique (empresa_id, id)
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  data_nascimento date,
  observacoes text,
  status text not null default 'ativo'
    check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id)
);

create table public.barbeiros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid,
  nome text not null,
  telefone text,
  email text,
  percentual_comissao numeric(5, 2) not null default 0
    check (percentual_comissao >= 0 and percentual_comissao <= 100),
  status text not null default 'ativo'
    check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  unique (empresa_id, usuario_id),
  constraint barbeiros_usuario_empresa_fk
    foreign key (empresa_id, usuario_id)
    references public.usuarios(empresa_id, id)
    on delete restrict
);

create table public.servicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  descricao text,
  duracao_minutos integer not null check (duracao_minutos > 0),
  preco numeric(12, 2) not null check (preco >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id)
);

create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null,
  barbeiro_id uuid not null,
  servico_id uuid not null,
  data_hora_inicio timestamptz not null,
  data_hora_fim timestamptz,
  valor numeric(12, 2) not null check (valor >= 0),
  desconto numeric(12, 2) not null default 0 check (desconto >= 0),
  forma_pagamento text,
  status text not null default 'agendado'
    check (status in ('agendado', 'confirmado', 'concluido', 'cancelado', 'faltou')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  constraint atendimentos_cliente_empresa_fk
    foreign key (empresa_id, cliente_id)
    references public.clientes(empresa_id, id)
    on delete restrict,
  constraint atendimentos_barbeiro_empresa_fk
    foreign key (empresa_id, barbeiro_id)
    references public.barbeiros(empresa_id, id)
    on delete restrict,
  constraint atendimentos_servico_empresa_fk
    foreign key (empresa_id, servico_id)
    references public.servicos(empresa_id, id)
    on delete restrict
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  categoria text,
  descricao text,
  sku text,
  preco_custo numeric(12, 2) not null default 0 check (preco_custo >= 0),
  preco_venda numeric(12, 2) not null default 0 check (preco_venda >= 0),
  estoque_atual integer not null default 0 check (estoque_atual >= 0),
  estoque_minimo integer not null default 0 check (estoque_minimo >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  unique (empresa_id, sku)
);

create table public.movimentacoes_financeiras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  atendimento_id uuid,
  tipo text not null check (tipo in ('entrada', 'saida')),
  categoria text not null,
  descricao text,
  valor numeric(12, 2) not null check (valor >= 0),
  forma_pagamento text,
  data_movimentacao date not null default current_date,
  status text not null default 'confirmada'
    check (status in ('pendente', 'confirmada', 'cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  constraint movimentacoes_atendimento_empresa_fk
    foreign key (empresa_id, atendimento_id)
    references public.atendimentos(empresa_id, id)
    on delete restrict
);

create table public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  descricao text not null,
  fornecedor text,
  categoria text,
  valor numeric(12, 2) not null check (valor >= 0),
  data_vencimento date not null,
  data_pagamento date,
  status text not null default 'pendente'
    check (status in ('pendente', 'paga', 'vencida', 'cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id)
);

create table public.comissoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  atendimento_id uuid not null,
  barbeiro_id uuid not null,
  percentual numeric(5, 2) not null check (percentual >= 0 and percentual <= 100),
  valor_base numeric(12, 2) not null check (valor_base >= 0),
  valor_comissao numeric(12, 2) not null check (valor_comissao >= 0),
  status text not null default 'pendente'
    check (status in ('pendente', 'paga', 'cancelada')),
  data_pagamento date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  unique (empresa_id, atendimento_id, barbeiro_id),
  constraint comissoes_atendimento_empresa_fk
    foreign key (empresa_id, atendimento_id)
    references public.atendimentos(empresa_id, id)
    on delete cascade,
  constraint comissoes_barbeiro_empresa_fk
    foreign key (empresa_id, barbeiro_id)
    references public.barbeiros(empresa_id, id)
    on delete restrict
);

create table public.configuracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  chave text not null,
  valor jsonb not null default '{}'::jsonb,
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  unique (empresa_id, chave)
);

create index empresas_status_idx on public.empresas(status);
create index usuarios_empresa_id_idx on public.usuarios(empresa_id);
create index usuarios_auth_user_id_idx on public.usuarios(auth_user_id);
create index usuarios_empresa_papel_idx on public.usuarios(empresa_id, papel);
create index clientes_empresa_id_idx on public.clientes(empresa_id);
create index clientes_empresa_nome_idx on public.clientes(empresa_id, nome);
create index clientes_empresa_telefone_idx on public.clientes(empresa_id, telefone);
create index barbeiros_empresa_id_idx on public.barbeiros(empresa_id);
create index barbeiros_empresa_status_idx on public.barbeiros(empresa_id, status);
create index servicos_empresa_id_idx on public.servicos(empresa_id);
create index servicos_empresa_ativo_idx on public.servicos(empresa_id, ativo);
create index atendimentos_empresa_id_idx on public.atendimentos(empresa_id);
create index atendimentos_empresa_inicio_idx on public.atendimentos(empresa_id, data_hora_inicio);
create index atendimentos_empresa_cliente_idx on public.atendimentos(empresa_id, cliente_id);
create index atendimentos_empresa_barbeiro_idx on public.atendimentos(empresa_id, barbeiro_id);
create index atendimentos_empresa_status_idx on public.atendimentos(empresa_id, status);
create index produtos_empresa_id_idx on public.produtos(empresa_id);
create index produtos_empresa_ativo_idx on public.produtos(empresa_id, ativo);
create index produtos_empresa_categoria_idx on public.produtos(empresa_id, categoria);
create index movimentacoes_empresa_data_idx
  on public.movimentacoes_financeiras(empresa_id, data_movimentacao);
create index movimentacoes_empresa_tipo_idx
  on public.movimentacoes_financeiras(empresa_id, tipo);
create index contas_pagar_empresa_vencimento_idx
  on public.contas_pagar(empresa_id, data_vencimento);
create index contas_pagar_empresa_status_idx
  on public.contas_pagar(empresa_id, status);
create index comissoes_empresa_barbeiro_idx
  on public.comissoes(empresa_id, barbeiro_id);
create index comissoes_empresa_status_idx
  on public.comissoes(empresa_id, status);
create index configuracoes_empresa_id_idx on public.configuracoes(empresa_id);

create trigger empresas_set_updated_at
before update on public.empresas
for each row execute function public.set_updated_at();

create trigger usuarios_set_updated_at
before update on public.usuarios
for each row execute function public.set_updated_at();

create trigger clientes_set_updated_at
before update on public.clientes
for each row execute function public.set_updated_at();

create trigger barbeiros_set_updated_at
before update on public.barbeiros
for each row execute function public.set_updated_at();

create trigger servicos_set_updated_at
before update on public.servicos
for each row execute function public.set_updated_at();

create trigger atendimentos_set_updated_at
before update on public.atendimentos
for each row execute function public.set_updated_at();

create trigger produtos_set_updated_at
before update on public.produtos
for each row execute function public.set_updated_at();

create trigger movimentacoes_financeiras_set_updated_at
before update on public.movimentacoes_financeiras
for each row execute function public.set_updated_at();

create trigger contas_pagar_set_updated_at
before update on public.contas_pagar
for each row execute function public.set_updated_at();

create trigger comissoes_set_updated_at
before update on public.comissoes
for each row execute function public.set_updated_at();

create trigger configuracoes_set_updated_at
before update on public.configuracoes
for each row execute function public.set_updated_at();

create or replace function public.current_empresa_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(u.empresa_id), array[]::uuid[])
  from public.usuarios u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo';
$$;

create or replace function public.belongs_to_empresa(target_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_empresa_id = any(public.current_empresa_ids());
$$;

create or replace function public.has_empresa_role(
  target_empresa_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = target_empresa_id
      and u.status = 'ativo'
      and u.papel = any(allowed_roles)
  );
$$;

create or replace function public.criar_empresa_com_usuario(
  nome_empresa text,
  nome_usuario text,
  telefone_usuario text default null,
  papel_usuario text default 'administrador'
)
returns public.usuarios
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  nova_empresa public.empresas;
  novo_usuario public.usuarios;
  email_usuario text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if papel_usuario not in ('administrador', 'gerente', 'barbeiro') then
    raise exception 'Papel de usuario invalido.';
  end if;

  select email into email_usuario
  from auth.users
  where id = auth.uid();

  insert into public.empresas (nome, email)
  values (nome_empresa, email_usuario)
  returning * into nova_empresa;

  insert into public.usuarios (
    empresa_id,
    auth_user_id,
    nome,
    email,
    telefone,
    papel
  )
  values (
    nova_empresa.id,
    auth.uid(),
    nome_usuario,
    email_usuario,
    telefone_usuario,
    papel_usuario
  )
  returning * into novo_usuario;

  return novo_usuario;
end;
$$;

revoke all on function public.criar_empresa_com_usuario(text, text, text, text)
from public;

grant execute on function public.criar_empresa_com_usuario(text, text, text, text)
to authenticated;

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

alter table public.empresas enable row level security;
alter table public.usuarios enable row level security;
alter table public.clientes enable row level security;
alter table public.barbeiros enable row level security;
alter table public.servicos enable row level security;
alter table public.atendimentos enable row level security;
alter table public.produtos enable row level security;
alter table public.movimentacoes_financeiras enable row level security;
alter table public.contas_pagar enable row level security;
alter table public.comissoes enable row level security;
alter table public.configuracoes enable row level security;

create policy "empresas_select_mesma_empresa"
on public.empresas
for select
to authenticated
using (id = any(public.current_empresa_ids()));

create policy "empresas_insert_autenticado"
on public.empresas
for insert
to authenticated
with check (auth.uid() is not null);

create policy "empresas_update_administrador_gerente"
on public.empresas
for update
to authenticated
using (public.has_empresa_role(id, array['administrador', 'gerente']))
with check (public.has_empresa_role(id, array['administrador', 'gerente']));

create policy "empresas_delete_administrador"
on public.empresas
for delete
to authenticated
using (public.has_empresa_role(id, array['administrador']));

create policy "usuarios_select_mesma_empresa"
on public.usuarios
for select
to authenticated
using (public.belongs_to_empresa(empresa_id));

create policy "usuarios_insert_mesma_empresa"
on public.usuarios
for insert
to authenticated
with check (
  public.has_empresa_role(empresa_id, array['administrador', 'gerente'])
);

create policy "usuarios_update_gestao_ou_proprio"
on public.usuarios
for update
to authenticated
using (
  public.has_empresa_role(empresa_id, array['administrador', 'gerente'])
  or auth_user_id = auth.uid()
)
with check (
  public.has_empresa_role(empresa_id, array['administrador', 'gerente'])
  or auth_user_id = auth.uid()
);

create policy "usuarios_delete_gestao"
on public.usuarios
for delete
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

create policy "clientes_empresa_isolada"
on public.clientes
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

create policy "barbeiros_empresa_isolada"
on public.barbeiros
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

create policy "servicos_empresa_isolada"
on public.servicos
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

create policy "atendimentos_empresa_isolada"
on public.atendimentos
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

create policy "produtos_empresa_isolada"
on public.produtos
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

create policy "movimentacoes_financeiras_empresa_isolada"
on public.movimentacoes_financeiras
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

create policy "contas_pagar_empresa_isolada"
on public.contas_pagar
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

create policy "comissoes_empresa_isolada"
on public.comissoes
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

create policy "configuracoes_empresa_isolada"
on public.configuracoes
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));
