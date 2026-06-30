begin;

-- Billing provider data stays nullable so existing trials and subscriptions are preserved.
alter table public.subscriptions
  add column if not exists provider text,
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists provider_plan_id text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists grace_ends_at timestamptz,
  add column if not exists last_payment_at timestamptz,
  add column if not exists next_payment_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists paused_at timestamptz,
  add column if not exists resumed_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.subscriptions
  drop constraint if exists subscriptions_empresa_id_fkey;
alter table public.subscriptions
  add constraint subscriptions_empresa_id_fkey
  foreign key (empresa_id) references public.empresas(id) on delete restrict;

create unique index if not exists subscriptions_provider_subscription_uidx
  on public.subscriptions(provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;

create index if not exists subscriptions_provider_customer_idx
  on public.subscriptions(provider, provider_customer_id)
  where provider is not null and provider_customer_id is not null;

create index if not exists subscriptions_current_period_end_idx
  on public.subscriptions(current_period_end)
  where current_period_end is not null;

create or replace function public.protect_subscription_billing_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated'
    and (
      new.plan_id is distinct from old.plan_id
      or new.status is distinct from old.status
      or new.started_at is distinct from old.started_at
      or new.expires_at is distinct from old.expires_at
      or new.trial_ends_at is distinct from old.trial_ends_at
      or new.canceled_at is distinct from old.canceled_at
      or new.provider is distinct from old.provider
      or new.provider_customer_id is distinct from old.provider_customer_id
      or new.provider_subscription_id is distinct from old.provider_subscription_id
      or new.provider_plan_id is distinct from old.provider_plan_id
      or new.current_period_start is distinct from old.current_period_start
      or new.current_period_end is distinct from old.current_period_end
      or new.grace_ends_at is distinct from old.grace_ends_at
      or new.last_payment_at is distinct from old.last_payment_at
      or new.next_payment_at is distinct from old.next_payment_at
      or new.cancel_at_period_end is distinct from old.cancel_at_period_end
      or new.paused_at is distinct from old.paused_at
      or new.resumed_at is distinct from old.resumed_at
      or new.metadata is distinct from old.metadata
    )
  then
    raise exception 'O estado financeiro da assinatura só pode ser alterado por um backend autorizado.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create table if not exists public.subscription_billing_periods (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  provider text,
  provider_period_id text,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'PENDING', 'PAID', 'PAST_DUE', 'CANCELED', 'CLOSED')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  amount_due numeric(12, 2) not null default 0 check (amount_due >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  currency char(3) not null default 'BRL',
  coupon_code text,
  promotion_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (discount_amount <= amount_due)
);

create unique index if not exists subscription_billing_periods_cycle_uidx
  on public.subscription_billing_periods(subscription_id, starts_at, ends_at);

create unique index if not exists subscription_billing_periods_provider_uidx
  on public.subscription_billing_periods(provider, provider_period_id)
  where provider is not null and provider_period_id is not null;

create index if not exists subscription_billing_periods_empresa_idx
  on public.subscription_billing_periods(empresa_id, starts_at desc);

create index if not exists subscription_billing_periods_subscription_idx
  on public.subscription_billing_periods(subscription_id, starts_at desc);

create index if not exists subscription_billing_periods_status_idx
  on public.subscription_billing_periods(status, ends_at);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  billing_period_id uuid references public.subscription_billing_periods(id) on delete restrict,
  plan_id uuid references public.plans(id) on delete restrict,
  provider text not null,
  provider_payment_id text not null,
  provider_invoice_id text,
  external_reference text,
  status text not null default 'PENDING'
    check (status in (
      'PENDING', 'PROCESSING', 'APPROVED', 'PAID', 'REJECTED', 'EXPIRED',
      'CANCELED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK'
    )),
  amount numeric(12, 2) not null check (amount >= 0),
  refunded_amount numeric(12, 2) not null default 0 check (refunded_amount >= 0),
  currency char(3) not null default 'BRL',
  payment_method text,
  paid_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (refunded_amount <= amount)
);

create unique index if not exists payments_provider_payment_uidx
  on public.payments(provider, provider_payment_id);

create index if not exists payments_empresa_idx
  on public.payments(empresa_id, created_at desc);

create index if not exists payments_subscription_idx
  on public.payments(subscription_id, created_at desc);

create index if not exists payments_billing_period_idx
  on public.payments(billing_period_id)
  where billing_period_id is not null;

create index if not exists payments_status_idx
  on public.payments(status, due_at);

create index if not exists payments_provider_payment_idx
  on public.payments(provider_payment_id);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processed boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  payment_id uuid references public.payments(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete restrict,
  empresa_id uuid references public.empresas(id) on delete restrict,
  processing_attempts integer not null default 0 check (processing_attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists payment_events_processed_idx
  on public.payment_events(processed, received_at)
  where processed = false;

create index if not exists payment_events_payment_idx
  on public.payment_events(payment_id)
  where payment_id is not null;

create index if not exists payment_events_subscription_idx
  on public.payment_events(subscription_id)
  where subscription_id is not null;

create index if not exists payment_events_empresa_idx
  on public.payment_events(empresa_id, received_at desc)
  where empresa_id is not null;

create table if not exists public.subscription_audit (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  old_status text,
  new_status text,
  old_plan_id uuid references public.plans(id) on delete restrict,
  new_plan_id uuid references public.plans(id) on delete restrict,
  provider text,
  origin text not null default 'SYSTEM'
    check (origin in (
      'WEBHOOK', 'ADMIN', 'SYSTEM', 'TRIAL', 'PAYMENT',
      'CANCELAMENTO', 'REATIVACAO'
    )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_audit_empresa_idx
  on public.subscription_audit(empresa_id, changed_at desc);

create index if not exists subscription_audit_subscription_idx
  on public.subscription_audit(subscription_id, changed_at desc);

create index if not exists subscription_audit_origin_idx
  on public.subscription_audit(origin, changed_at desc);

drop trigger if exists subscription_billing_periods_set_updated_at
  on public.subscription_billing_periods;
create trigger subscription_billing_periods_set_updated_at
before update on public.subscription_billing_periods
for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- The backend may set `app.subscription_change_origin` inside its transaction.
create or replace function public.audit_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  change_origin text;
begin
  if new.status is not distinct from old.status
    and new.plan_id is not distinct from old.plan_id
  then
    return new;
  end if;

  change_origin := upper(coalesce(nullif(
    current_setting('app.subscription_change_origin', true),
    ''
  ), 'SYSTEM'));

  if change_origin not in (
    'WEBHOOK', 'ADMIN', 'SYSTEM', 'TRIAL', 'PAYMENT',
    'CANCELAMENTO', 'REATIVACAO'
  ) then
    change_origin := 'SYSTEM';
  end if;

  insert into public.subscription_audit (
    empresa_id,
    subscription_id,
    changed_by,
    old_status,
    new_status,
    old_plan_id,
    new_plan_id,
    provider,
    origin
  ) values (
    new.empresa_id,
    new.id,
    auth.uid(),
    old.status,
    new.status,
    old.plan_id,
    new.plan_id,
    new.provider,
    change_origin
  );

  return new;
end;
$$;

drop trigger if exists subscriptions_audit_financial_changes on public.subscriptions;
create trigger subscriptions_audit_financial_changes
after update of status, plan_id on public.subscriptions
for each row execute function public.audit_subscription_change();

create or replace function public.prevent_financial_ledger_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Registros financeiros e de assinatura não podem ser excluídos.'
    using errcode = '23503';
end;
$$;

drop trigger if exists subscriptions_prevent_delete on public.subscriptions;
create trigger subscriptions_prevent_delete
before delete on public.subscriptions
for each row execute function public.prevent_financial_ledger_delete();

drop trigger if exists billing_periods_prevent_delete on public.subscription_billing_periods;
create trigger billing_periods_prevent_delete
before delete on public.subscription_billing_periods
for each row execute function public.prevent_financial_ledger_delete();

drop trigger if exists payments_prevent_delete on public.payments;
create trigger payments_prevent_delete
before delete on public.payments
for each row execute function public.prevent_financial_ledger_delete();

drop trigger if exists payment_events_prevent_delete on public.payment_events;
create trigger payment_events_prevent_delete
before delete on public.payment_events
for each row execute function public.prevent_financial_ledger_delete();

drop trigger if exists subscription_audit_prevent_delete on public.subscription_audit;
create trigger subscription_audit_prevent_delete
before delete on public.subscription_audit
for each row execute function public.prevent_financial_ledger_delete();

-- Authenticated clients may read billing summaries from their own company, but
-- all writes are reserved for trusted backend roles (service_role/RPC owner).
alter table public.subscription_billing_periods enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.subscription_audit enable row level security;

drop policy if exists "subscriptions_admin_update" on public.subscriptions;
drop policy if exists "subscriptions_admin_insert" on public.subscriptions;
drop policy if exists "subscriptions_update_staff" on public.subscriptions;

revoke insert, update, delete on public.subscriptions from anon, authenticated;

drop policy if exists "billing_periods_admin_select" on public.subscription_billing_periods;
create policy "billing_periods_admin_select"
on public.subscription_billing_periods
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']));

drop policy if exists "payments_admin_select" on public.payments;
create policy "payments_admin_select"
on public.payments
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']));

drop policy if exists "subscription_audit_admin_select" on public.subscription_audit;
create policy "subscription_audit_admin_select"
on public.subscription_audit
for select
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']));

revoke all on public.subscription_billing_periods from anon, authenticated;
revoke all on public.payments from anon, authenticated;
revoke all on public.payment_events from anon, authenticated;
revoke all on public.subscription_audit from anon, authenticated;

grant select on public.subscription_billing_periods to authenticated;
grant select on public.payments to authenticated;
grant select on public.subscription_audit to authenticated;

comment on table public.subscription_billing_periods is
  'Immutable billing-cycle identity and commercial snapshot for each subscription period.';
comment on table public.payments is
  'Gateway-neutral SaaS payment ledger. Financial writes are backend-only.';
comment on table public.payment_events is
  'Idempotent webhook inbox. Raw payload is never exposed to frontend roles.';
comment on table public.subscription_audit is
  'Append-only history of subscription status and plan transitions.';
comment on function public.prevent_financial_ledger_delete() is
  'Preserves subscriptions, billing periods, payments, events and audit history.';

commit;
