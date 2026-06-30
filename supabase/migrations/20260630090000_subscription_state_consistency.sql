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

drop trigger if exists subscriptions_protect_billing_state on public.subscriptions;
create trigger subscriptions_protect_billing_state
before update on public.subscriptions
for each row execute function public.protect_subscription_billing_state();

comment on function public.protect_subscription_billing_state() is
  'Impede que clientes autenticados ativem, renovem ou estendam assinaturas sem um backend de cobrança confiável.';
