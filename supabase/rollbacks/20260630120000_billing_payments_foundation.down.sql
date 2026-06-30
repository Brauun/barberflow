begin;

drop trigger if exists subscriptions_prevent_delete on public.subscriptions;
drop trigger if exists billing_periods_prevent_delete on public.subscription_billing_periods;
drop trigger if exists payments_prevent_delete on public.payments;
drop trigger if exists payment_events_prevent_delete on public.payment_events;
drop trigger if exists subscription_audit_prevent_delete on public.subscription_audit;
drop function if exists public.prevent_financial_ledger_delete();

drop trigger if exists subscriptions_audit_financial_changes on public.subscriptions;
drop function if exists public.audit_subscription_change();

drop table if exists public.payment_events;
drop table if exists public.payments;
drop table if exists public.subscription_audit;
drop table if exists public.subscription_billing_periods;

drop index if exists public.subscriptions_current_period_end_idx;
drop index if exists public.subscriptions_provider_customer_idx;
drop index if exists public.subscriptions_provider_subscription_uidx;

alter table public.subscriptions
  drop column if exists metadata,
  drop column if exists resumed_at,
  drop column if exists paused_at,
  drop column if exists cancel_at_period_end,
  drop column if exists next_payment_at,
  drop column if exists last_payment_at,
  drop column if exists grace_ends_at,
  drop column if exists current_period_end,
  drop column if exists current_period_start,
  drop column if exists provider_plan_id,
  drop column if exists provider_subscription_id,
  drop column if exists provider_customer_id,
  drop column if exists provider;

alter table public.subscriptions
  drop constraint if exists subscriptions_empresa_id_fkey;
alter table public.subscriptions
  add constraint subscriptions_empresa_id_fkey
  foreign key (empresa_id) references public.empresas(id) on delete cascade;

create or replace function public.protect_subscription_billing_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated'
    and (
      new.status is distinct from old.status
      or new.started_at is distinct from old.started_at
      or new.expires_at is distinct from old.expires_at
      or new.trial_ends_at is distinct from old.trial_ends_at
      or new.canceled_at is distinct from old.canceled_at
    )
  then
    raise exception 'O estado da assinatura só pode ser alterado pelo serviço de cobrança.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Restore only the pre-migration admin policies. The existing billing-state
-- protection trigger continues to reject direct changes to protected fields.
create policy "subscriptions_admin_update"
on public.subscriptions
for update
to authenticated
using (public.has_empresa_role(empresa_id, array['administrador']))
with check (public.has_empresa_role(empresa_id, array['administrador']));

create policy "subscriptions_admin_insert"
on public.subscriptions
for insert
to authenticated
with check (public.has_empresa_role(empresa_id, array['administrador']));

grant insert, update on public.subscriptions to authenticated;

commit;
