create table if not exists public.benefit_programs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  descricao text,
  tipo text not null default 'beneficio_manual',
  valor numeric(12,2) not null default 0,
  validade_dias integer,
  renovacao_periodo text,
  acumulavel boolean not null default false,
  regra_acumulo text,
  regra_resgate text,
  publico_alvo text not null default 'todos_clientes',
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id)
);

create table if not exists public.benefit_rules (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  program_id uuid not null references public.benefit_programs(id) on delete cascade,
  tipo_regra text not null,
  parametros jsonb not null default '{}'::jsonb,
  servico_ids uuid[] not null default array[]::uuid[],
  categorias_servico text[] not null default array[]::text[],
  cliente_ids uuid[] not null default array[]::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint benefit_rules_program_empresa_fk
    foreign key (empresa_id, program_id)
    references public.benefit_programs(empresa_id, id)
    on delete cascade
);

create table if not exists public.benefit_rewards (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  program_id uuid not null references public.benefit_programs(id) on delete cascade,
  tipo_recompensa text not null,
  descricao text,
  valor numeric(12,2) not null default 0,
  servico_id uuid,
  parametros jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint benefit_rewards_program_empresa_fk
    foreign key (empresa_id, program_id)
    references public.benefit_programs(empresa_id, id)
    on delete cascade,
  constraint benefit_rewards_servico_empresa_fk
    foreign key (empresa_id, servico_id)
    references public.servicos(empresa_id, id)
);

create table if not exists public.client_benefits (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  program_id uuid not null references public.benefit_programs(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'expirado', 'cancelado', 'concluido')),
  saldo_usos numeric(12,2) not null default 0,
  saldo_credito numeric(12,2) not null default 0,
  pontos numeric(12,2) not null default 0,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  constraint client_benefits_program_empresa_fk
    foreign key (empresa_id, program_id)
    references public.benefit_programs(empresa_id, id)
    on delete cascade,
  constraint client_benefits_cliente_empresa_fk
    foreign key (empresa_id, cliente_id)
    references public.clientes(empresa_id, id)
);

create table if not exists public.benefit_usage_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  program_id uuid not null references public.benefit_programs(id) on delete cascade,
  client_benefit_id uuid references public.client_benefits(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  atendimento_id uuid,
  tipo text not null default 'uso',
  valor_desconto numeric(12,2) not null default 0,
  descricao text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint benefit_usage_program_empresa_fk
    foreign key (empresa_id, program_id)
    references public.benefit_programs(empresa_id, id)
    on delete cascade,
  constraint benefit_usage_client_benefit_empresa_fk
    foreign key (empresa_id, client_benefit_id)
    references public.client_benefits(empresa_id, id),
  constraint benefit_usage_cliente_empresa_fk
    foreign key (empresa_id, cliente_id)
    references public.clientes(empresa_id, id),
  constraint benefit_usage_atendimento_empresa_fk
    foreign key (empresa_id, atendimento_id)
    references public.atendimentos(empresa_id, id)
);

create index if not exists benefit_programs_empresa_status_idx
  on public.benefit_programs (empresa_id, status);
create index if not exists benefit_programs_empresa_tipo_idx
  on public.benefit_programs (empresa_id, tipo);
create index if not exists benefit_rules_program_idx
  on public.benefit_rules (empresa_id, program_id);
create index if not exists benefit_rewards_program_idx
  on public.benefit_rewards (empresa_id, program_id);
create index if not exists client_benefits_cliente_idx
  on public.client_benefits (empresa_id, cliente_id, status);
create index if not exists client_benefits_program_idx
  on public.client_benefits (empresa_id, program_id);
create index if not exists benefit_usage_logs_program_idx
  on public.benefit_usage_logs (empresa_id, program_id, created_at);
create index if not exists benefit_usage_logs_atendimento_idx
  on public.benefit_usage_logs (empresa_id, atendimento_id);

drop trigger if exists benefit_programs_set_updated_at on public.benefit_programs;
create trigger benefit_programs_set_updated_at
before update on public.benefit_programs
for each row execute function public.set_updated_at();

drop trigger if exists benefit_rules_set_updated_at on public.benefit_rules;
create trigger benefit_rules_set_updated_at
before update on public.benefit_rules
for each row execute function public.set_updated_at();

drop trigger if exists benefit_rewards_set_updated_at on public.benefit_rewards;
create trigger benefit_rewards_set_updated_at
before update on public.benefit_rewards
for each row execute function public.set_updated_at();

drop trigger if exists client_benefits_set_updated_at on public.client_benefits;
create trigger client_benefits_set_updated_at
before update on public.client_benefits
for each row execute function public.set_updated_at();

alter table public.benefit_programs enable row level security;
alter table public.benefit_rules enable row level security;
alter table public.benefit_rewards enable row level security;
alter table public.client_benefits enable row level security;
alter table public.benefit_usage_logs enable row level security;

drop policy if exists "benefit_programs_empresa_isolada" on public.benefit_programs;
create policy "benefit_programs_empresa_isolada"
on public.benefit_programs
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

drop policy if exists "benefit_rules_empresa_isolada" on public.benefit_rules;
create policy "benefit_rules_empresa_isolada"
on public.benefit_rules
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

drop policy if exists "benefit_rewards_empresa_isolada" on public.benefit_rewards;
create policy "benefit_rewards_empresa_isolada"
on public.benefit_rewards
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

drop policy if exists "client_benefits_empresa_isolada" on public.client_benefits;
create policy "client_benefits_empresa_isolada"
on public.client_benefits
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));

drop policy if exists "benefit_usage_logs_empresa_isolada" on public.benefit_usage_logs;
create policy "benefit_usage_logs_empresa_isolada"
on public.benefit_usage_logs
for all
to authenticated
using (public.belongs_to_empresa(empresa_id))
with check (public.belongs_to_empresa(empresa_id));
