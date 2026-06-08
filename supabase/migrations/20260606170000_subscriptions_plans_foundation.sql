create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  monthly_price numeric(12, 2) not null default 0,
  yearly_price numeric(12, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slug in ('starter', 'professional', 'premium', 'STARTER', 'PROFESSIONAL', 'PREMIUM'))
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null default 'TRIAL'
    check (status in ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id)
);

create table if not exists public.subscription_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_key text not null,
  feature_value jsonb not null,
  created_at timestamptz not null default now(),
  unique (plan_id, feature_key)
);

create table if not exists public.subscription_usage (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  feature_key text not null,
  current_value numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (empresa_id, feature_key)
);

create index if not exists subscriptions_empresa_status_idx
  on public.subscriptions(empresa_id, status);
create index if not exists subscription_features_plan_key_idx
  on public.subscription_features(plan_id, feature_key);
create index if not exists subscription_usage_empresa_key_idx
  on public.subscription_usage(empresa_id, feature_key);

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create or replace function public.set_subscription_usage_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscription_usage_set_updated_at on public.subscription_usage;
create trigger subscription_usage_set_updated_at
before update on public.subscription_usage
for each row execute function public.set_subscription_usage_updated_at();

insert into public.plans (name, slug, description, monthly_price, yearly_price, is_active)
values
  ('BW Start', 'starter', 'Para barbeiro autonomo', 49.90, 499.00, true),
  ('BW Pro', 'professional', 'Para barbearias em crescimento', 99.90, 999.00, true),
  ('BW Elite', 'premium', 'Para operacoes maiores', 199.90, 1999.00, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  yearly_price = excluded.yearly_price,
  is_active = excluded.is_active,
  updated_at = now();

with feature_seed(slug, feature_key, feature_value) as (
  values
    ('starter', 'MAX_BARBERS', '1'::jsonb),
    ('starter', 'MAX_CLIENTS', '300'::jsonb),
    ('starter', 'HAS_WAITLIST', 'false'::jsonb),
    ('starter', 'HAS_LOYALTY', 'false'::jsonb),
    ('starter', 'HAS_ADVANCED_REPORTS', 'false'::jsonb),
    ('starter', 'HAS_EXECUTIVE_REPORTS', 'false'::jsonb),
    ('starter', 'HAS_WHATSAPP', 'false'::jsonb),
    ('starter', 'HAS_MULTI_UNITS', 'false'::jsonb),
    ('starter', 'HAS_EXECUTIVE_PDF', 'false'::jsonb),
    ('starter', 'HAS_PWA', 'true'::jsonb),
    ('starter', 'HAS_CLIENT_APP', 'true'::jsonb),
    ('professional', 'MAX_BARBERS', '5'::jsonb),
    ('professional', 'MAX_CLIENTS', '"unlimited"'::jsonb),
    ('professional', 'HAS_WAITLIST', 'true'::jsonb),
    ('professional', 'HAS_LOYALTY', 'true'::jsonb),
    ('professional', 'HAS_ADVANCED_REPORTS', 'true'::jsonb),
    ('professional', 'HAS_EXECUTIVE_REPORTS', 'true'::jsonb),
    ('professional', 'HAS_WHATSAPP', 'false'::jsonb),
    ('professional', 'HAS_MULTI_UNITS', 'false'::jsonb),
    ('professional', 'HAS_EXECUTIVE_PDF', 'true'::jsonb),
    ('professional', 'HAS_PWA', 'true'::jsonb),
    ('professional', 'HAS_CLIENT_APP', 'true'::jsonb),
    ('premium', 'MAX_BARBERS', '"unlimited"'::jsonb),
    ('premium', 'MAX_CLIENTS', '"unlimited"'::jsonb),
    ('premium', 'HAS_WAITLIST', 'true'::jsonb),
    ('premium', 'HAS_LOYALTY', 'true'::jsonb),
    ('premium', 'HAS_ADVANCED_REPORTS', 'true'::jsonb),
    ('premium', 'HAS_EXECUTIVE_REPORTS', 'true'::jsonb),
    ('premium', 'HAS_WHATSAPP', 'true'::jsonb),
    ('premium', 'HAS_MULTI_UNITS', 'true'::jsonb),
    ('premium', 'HAS_EXECUTIVE_PDF', 'true'::jsonb),
    ('premium', 'HAS_PWA', 'true'::jsonb),
    ('premium', 'HAS_CLIENT_APP', 'true'::jsonb)
)
insert into public.subscription_features (plan_id, feature_key, feature_value)
select p.id, fs.feature_key, fs.feature_value
from feature_seed fs
join public.plans p on p.slug = fs.slug
on conflict (plan_id, feature_key) do update set
  feature_value = excluded.feature_value;

create or replace function public.ensure_trial_subscription_for_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  professional_plan_id uuid;
begin
  select id into professional_plan_id
  from public.plans
  where lower(slug) = 'professional'
  limit 1;

  if professional_plan_id is null then
    return new;
  end if;

  insert into public.subscriptions (
    empresa_id,
    plan_id,
    status,
    started_at,
    trial_ends_at
  )
  values (
    new.id,
    professional_plan_id,
    'TRIAL',
    now(),
    now() + interval '14 days'
  )
  on conflict (empresa_id) do nothing;

  return new;
end;
$$;

drop trigger if exists empresas_create_trial_subscription on public.empresas;
create trigger empresas_create_trial_subscription
after insert on public.empresas
for each row execute function public.ensure_trial_subscription_for_empresa();

insert into public.subscriptions (empresa_id, plan_id, status, started_at, trial_ends_at)
select e.id, p.id, 'TRIAL', now(), now() + interval '14 days'
from public.empresas e
cross join public.plans p
where lower(p.slug) = 'professional'
  and not exists (
    select 1 from public.subscriptions s where s.empresa_id = e.id
  );

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_features enable row level security;
alter table public.subscription_usage enable row level security;

drop policy if exists "plans_select_active" on public.plans;
create policy "plans_select_active"
on public.plans
for select
using (is_active = true);

drop policy if exists "subscription_features_select_active_plans" on public.subscription_features;
create policy "subscription_features_select_active_plans"
on public.subscription_features
for select
using (
  exists (
    select 1 from public.plans p
    where p.id = subscription_features.plan_id
      and p.is_active = true
  )
);

drop policy if exists "subscriptions_empresa_select" on public.subscriptions;
create policy "subscriptions_empresa_select"
on public.subscriptions
for select
using (public.belongs_to_empresa(empresa_id));

drop policy if exists "subscriptions_admin_update" on public.subscriptions;
create policy "subscriptions_admin_update"
on public.subscriptions
for update
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

drop policy if exists "subscriptions_admin_insert" on public.subscriptions;
create policy "subscriptions_admin_insert"
on public.subscriptions
for insert
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));

drop policy if exists "subscription_usage_empresa_select" on public.subscription_usage;
create policy "subscription_usage_empresa_select"
on public.subscription_usage
for select
using (public.belongs_to_empresa(empresa_id));

drop policy if exists "subscription_usage_admin_upsert" on public.subscription_usage;
create policy "subscription_usage_admin_upsert"
on public.subscription_usage
for all
using (public.has_empresa_role(empresa_id, array['administrador', 'gerente']))
with check (public.has_empresa_role(empresa_id, array['administrador', 'gerente']));
