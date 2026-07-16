begin;

alter table public.subscription_billing_periods
  drop constraint if exists subscription_billing_periods_status_check;

alter table public.subscription_billing_periods
  add constraint subscription_billing_periods_status_check
  check (status in (
    'OPEN', 'PENDING', 'PAID', 'PAST_DUE', 'CANCELED', 'CLOSED',
    'REFUNDED', 'CHARGEBACK'
  ));

create or replace function public.billing_process_payment_webhook(
  p_empresa_id uuid,
  p_subscription_id uuid,
  p_plan_id uuid,
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_provider_payment_id text,
  p_payment_status text,
  p_amount numeric,
  p_currency text,
  p_payment_method text default null,
  p_paid_at timestamptz default null,
  p_due_at timestamptz default null,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null,
  p_next_payment_at timestamptz default null,
  p_external_reference text default null,
  p_provider_invoice_id text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_subscription public.subscriptions%rowtype;
  payment_row public.payments%rowtype;
  event_row public.payment_events%rowtype;
  billing_period_row public.subscription_billing_periods%rowtype;
  current_period_matches boolean := false;
  previous_status text;
  previous_plan_id uuid;
  normalized_event_type text := upper(trim(coalesce(p_event_type, '')));
  normalized_payment_status text := upper(trim(coalesce(p_payment_status, '')));
  provider_name text := lower(trim(coalesce(p_provider, '')));
  subscription_changed boolean := false;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Operacao permitida somente para o Billing Service.'
      using errcode = '42501';
  end if;

  if p_empresa_id is null or p_subscription_id is null or p_plan_id is null then
    raise exception 'Empresa, assinatura e plano sao obrigatorios.'
      using errcode = '22023';
  end if;

  if provider_name = '' or nullif(trim(p_provider_event_id), '') is null
    or nullif(trim(p_provider_payment_id), '') is null then
    raise exception 'Provider, evento e pagamento sao obrigatorios.'
      using errcode = '22023';
  end if;

  if normalized_event_type = 'PAYMENT_CHARGED_BACK'
    or normalized_event_type = 'PAYMENT_CHARGEDBACK' then
    normalized_event_type := 'PAYMENT_CHARGEBACK';
  end if;

  if normalized_event_type not in (
    'PAYMENT_APPROVED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED',
    'PAYMENT_CANCELLED', 'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK'
  ) then
    raise exception 'Tipo de evento de pagamento invalido.' using errcode = '22023';
  end if;

  if normalized_payment_status not in (
    'PENDING', 'PROCESSING', 'APPROVED', 'PAID', 'REJECTED', 'EXPIRED',
    'CANCELED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK'
  ) then
    raise exception 'Status de pagamento invalido.' using errcode = '22023';
  end if;

  if normalized_event_type = 'PAYMENT_CHARGEBACK' then
    normalized_payment_status := 'CHARGEBACK';
  elsif normalized_event_type = 'PAYMENT_REFUNDED'
    and normalized_payment_status not in ('REFUNDED', 'PARTIALLY_REFUNDED') then
    normalized_payment_status := 'REFUNDED';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'Valor de pagamento invalido.' using errcode = '22023';
  end if;

  select * into current_subscription
  from public.subscriptions
  where id = p_subscription_id and empresa_id = p_empresa_id
  for update;

  if not found then
    raise exception 'Assinatura nao encontrada para esta empresa.' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.plans where id = p_plan_id) then
    raise exception 'Plano nao encontrado.' using errcode = 'P0002';
  end if;

  previous_status := current_subscription.status;
  previous_plan_id := current_subscription.plan_id;
  perform set_config('app.billing_service_manual_audit', 'true', true);

  insert into public.payment_events (
    provider, provider_event_id, event_type, received_at, payload,
    subscription_id, empresa_id, processed, processing_attempts
  ) values (
    provider_name, p_provider_event_id, normalized_event_type, now(),
    coalesce(p_payload, '{}'::jsonb), p_subscription_id, p_empresa_id, false, 1
  )
  on conflict (provider, provider_event_id) do nothing
  returning * into event_row;

  if event_row.id is null then
    return jsonb_build_object(
      'duplicate', true,
      'provider', provider_name,
      'provider_event_id', p_provider_event_id
    );
  end if;

  insert into public.payments (
    empresa_id, subscription_id, plan_id, provider, provider_payment_id,
    provider_invoice_id, external_reference, status, amount, currency,
    payment_method, paid_at, due_at, metadata
  ) values (
    p_empresa_id, p_subscription_id, p_plan_id, provider_name,
    p_provider_payment_id, p_provider_invoice_id, p_external_reference,
    normalized_payment_status, p_amount,
    upper(coalesce(nullif(trim(p_currency), ''), 'BRL')),
    nullif(trim(p_payment_method), ''), p_paid_at, p_due_at,
    jsonb_build_object('last_event_id', event_row.id)
  )
  on conflict (provider, provider_payment_id) do update
  set status = excluded.status,
      plan_id = excluded.plan_id,
      provider_invoice_id = coalesce(excluded.provider_invoice_id, payments.provider_invoice_id),
      external_reference = coalesce(excluded.external_reference, payments.external_reference),
      payment_method = coalesce(excluded.payment_method, payments.payment_method),
      paid_at = coalesce(excluded.paid_at, payments.paid_at),
      due_at = coalesce(excluded.due_at, payments.due_at),
      amount = excluded.amount,
      currency = excluded.currency,
      metadata = payments.metadata || excluded.metadata,
      updated_at = now()
  where payments.empresa_id = excluded.empresa_id
    and payments.subscription_id = excluded.subscription_id
  returning * into payment_row;

  if payment_row.id is null then
    raise exception 'Pagamento pertence a outra empresa ou assinatura.'
      using errcode = '42501';
  end if;

  update public.payment_events
  set payment_id = payment_row.id
  where id = event_row.id;

  if normalized_event_type = 'PAYMENT_APPROVED' then
    if p_current_period_start is null or p_current_period_end is null then
      raise exception 'Periodo da assinatura e obrigatorio para pagamento aprovado.'
        using errcode = '22023';
    end if;

    if p_current_period_end <= p_current_period_start then
      raise exception 'Periodo da assinatura invalido.' using errcode = '22023';
    end if;

    update public.subscriptions
    set plan_id = p_plan_id,
        status = 'ACTIVE',
        provider = provider_name,
        provider_plan_id = p_plan_id::text,
        current_period_start = p_current_period_start,
        current_period_end = p_current_period_end,
        expires_at = p_current_period_end,
        last_payment_at = coalesce(p_paid_at, p_current_period_start),
        next_payment_at = coalesce(p_next_payment_at, p_current_period_end),
        grace_ends_at = null,
        paused_at = null,
        cancel_at_period_end = false,
        metadata = metadata || jsonb_build_object(
          'last_provider_payment_id', p_provider_payment_id,
          'last_provider_event_id', p_provider_event_id
        ),
        updated_at = now()
    where id = p_subscription_id and empresa_id = p_empresa_id;

    subscription_changed := true;

    insert into public.subscription_billing_periods (
      empresa_id, subscription_id, plan_id, provider, provider_period_id,
      status, starts_at, ends_at, amount_due, amount_paid, currency, metadata
    ) values (
      p_empresa_id, p_subscription_id, p_plan_id, provider_name,
      p_provider_payment_id, 'PAID', p_current_period_start,
      p_current_period_end, p_amount, p_amount,
      upper(coalesce(nullif(trim(p_currency), ''), 'BRL')),
      jsonb_build_object('payment_id', payment_row.id, 'event_id', event_row.id)
    )
    on conflict (subscription_id, starts_at, ends_at) do update
    set status = 'PAID',
        plan_id = excluded.plan_id,
        provider = excluded.provider,
        provider_period_id = coalesce(
          subscription_billing_periods.provider_period_id,
          excluded.provider_period_id
        ),
        amount_due = excluded.amount_due,
        amount_paid = greatest(subscription_billing_periods.amount_paid, excluded.amount_paid),
        metadata = subscription_billing_periods.metadata || excluded.metadata,
        updated_at = now()
    returning * into billing_period_row;

    update public.payments
    set billing_period_id = billing_period_row.id,
        updated_at = now()
    where id = payment_row.id;
  elsif normalized_event_type in ('PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK') then
    if payment_row.billing_period_id is not null then
      select * into billing_period_row
      from public.subscription_billing_periods
      where id = payment_row.billing_period_id
        and subscription_id = p_subscription_id
        and empresa_id = p_empresa_id
      for update;
    end if;

    if billing_period_row.id is not null then
      update public.subscription_billing_periods
      set status = case
            when normalized_event_type = 'PAYMENT_CHARGEBACK' then 'CHARGEBACK'
            else 'REFUNDED'
          end,
          amount_paid = 0,
          metadata = metadata || jsonb_build_object(
            'reversal_event_id', event_row.id,
            'reversal_payment_id', payment_row.id,
            'reversal_type', normalized_event_type
          ),
          updated_at = now()
      where id = billing_period_row.id
      returning * into billing_period_row;

      current_period_matches :=
        current_subscription.current_period_start = billing_period_row.starts_at
        and current_subscription.current_period_end = billing_period_row.ends_at;
    else
      current_period_matches :=
        current_subscription.metadata ->> 'last_provider_payment_id' = p_provider_payment_id;
    end if;

    if current_period_matches then
      update public.subscriptions
      set status = 'PAST_DUE',
          current_period_end = now(),
          expires_at = now(),
          grace_ends_at = null,
          next_payment_at = null,
          cancel_at_period_end = false,
          metadata = metadata || jsonb_build_object(
            'last_reversal_event_id', p_provider_event_id,
            'last_reversal_payment_id', p_provider_payment_id,
            'last_reversal_type', normalized_event_type
          ),
          updated_at = now()
      where id = p_subscription_id and empresa_id = p_empresa_id;

      subscription_changed := true;
    end if;
  end if;

  update public.payment_events
  set processed = true, processed_at = now(), last_error = null
  where id = event_row.id;

  insert into public.subscription_audit (
    empresa_id, subscription_id, changed_by, old_status, new_status,
    old_plan_id, new_plan_id, provider, origin, metadata
  )
  select
    p_empresa_id, s.id, null, previous_status, s.status,
    previous_plan_id, s.plan_id, provider_name, 'WEBHOOK',
    jsonb_build_object(
      'action', 'PROCESS_PAYMENT_WEBHOOK',
      'reason', normalized_event_type,
      'payment_id', payment_row.id,
      'event_id', event_row.id,
      'provider_event_id', p_provider_event_id,
      'provider_payment_id', p_provider_payment_id,
      'changed', subscription_changed,
      'idempotency_key', provider_name || ':' || p_provider_event_id
    )
  from public.subscriptions s
  where s.id = p_subscription_id;

  return jsonb_build_object(
    'changed', subscription_changed,
    'duplicate', false,
    'event_id', event_row.id,
    'payment_id', payment_row.id,
    'plan_id', p_plan_id,
    'status', normalized_payment_status,
    'subscription_id', p_subscription_id
  );
end;
$$;

revoke all on function public.billing_process_payment_webhook(
  uuid, uuid, uuid, text, text, text, text, text, numeric, text,
  text, timestamptz, timestamptz, timestamptz, timestamptz,
  timestamptz, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.billing_process_payment_webhook(
  uuid, uuid, uuid, text, text, text, text, text, numeric, text,
  text, timestamptz, timestamptz, timestamptz, timestamptz,
  timestamptz, text, text, jsonb
) to service_role;

comment on function public.billing_process_payment_webhook(
  uuid, uuid, uuid, text, text, text, text, text, numeric, text,
  text, timestamptz, timestamptz, timestamptz, timestamptz,
  timestamptz, text, text, jsonb
) is 'Atomic Billing Service boundary for idempotent provider payment webhooks, including refund and chargeback reversals.';

commit;
