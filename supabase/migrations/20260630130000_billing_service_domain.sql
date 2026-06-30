begin;

drop function if exists public.apply_subscription_plan_change(uuid, uuid, uuid);

create unique index if not exists subscription_audit_idempotency_uidx
  on public.subscription_audit((metadata ->> 'idempotency_key'))
  where metadata ->> 'idempotency_key' is not null;

create or replace function public.audit_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  change_origin text;
  changed_by_id uuid;
  change_reason text;
begin
  if current_setting('app.billing_service_manual_audit', true) = 'true' then
    return new;
  end if;

  if new.status is not distinct from old.status
    and new.plan_id is not distinct from old.plan_id
  then
    return new;
  end if;

  change_origin := upper(coalesce(nullif(
    current_setting('app.subscription_change_origin', true), ''
  ), 'SYSTEM'));

  if change_origin not in (
    'WEBHOOK', 'ADMIN', 'SYSTEM', 'TRIAL', 'PAYMENT',
    'CANCELAMENTO', 'REATIVACAO'
  ) then
    change_origin := 'SYSTEM';
  end if;

  begin
    changed_by_id := nullif(
      current_setting('app.subscription_changed_by', true), ''
    )::uuid;
  exception when invalid_text_representation then
    changed_by_id := null;
  end;

  changed_by_id := coalesce(changed_by_id, auth.uid());
  change_reason := nullif(
    current_setting('app.subscription_change_reason', true), ''
  );

  insert into public.subscription_audit (
    empresa_id, subscription_id, changed_by, old_status, new_status,
    old_plan_id, new_plan_id, provider, origin, metadata
  ) values (
    new.empresa_id, new.id, changed_by_id, old.status, new.status,
    old.plan_id, new.plan_id, new.provider, change_origin,
    jsonb_strip_nulls(jsonb_build_object('reason', change_reason))
  );

  return new;
end;
$$;

create or replace function public.billing_execute_command(
  p_action text,
  p_empresa_id uuid,
  p_actor_user_id uuid default null,
  p_origin text default 'SYSTEM',
  p_reason text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action_name text := upper(trim(coalesce(p_action, '')));
  command_origin text := upper(trim(coalesce(p_origin, 'SYSTEM')));
  current_subscription public.subscriptions%rowtype;
  previous_status text;
  previous_plan_id uuid;
  selected_plan_id uuid;
  selected_plan_active boolean;
  payment_row public.payments%rowtype;
  payment_event_row public.payment_events%rowtype;
  payment_status text;
  event_type text;
  provider_name text;
  provider_payment_id_value text;
  provider_event_id_value text;
  event_was_inserted boolean := false;
  changed boolean := false;
  idempotency_key text := nullif(p_payload ->> 'idempotency_key', '');
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Operação permitida somente para o Billing Service.'
      using errcode = '42501';
  end if;

  if p_empresa_id is null then
    raise exception 'Empresa é obrigatória.' using errcode = '22023';
  end if;

  if action_name not in (
    'ACTIVATE_SUBSCRIPTION', 'RENEW_SUBSCRIPTION', 'CANCEL_SUBSCRIPTION',
    'PAUSE_SUBSCRIPTION', 'RESUME_SUBSCRIPTION', 'EXPIRE_SUBSCRIPTION',
    'REGISTER_PAYMENT', 'REGISTER_PAYMENT_EVENT', 'PROCESS_WEBHOOK',
    'CHANGE_PLAN', 'START_GRACE_PERIOD', 'FINISH_GRACE_PERIOD',
    'BLOCK_SUBSCRIPTION', 'UNBLOCK_SUBSCRIPTION'
  ) then
    raise exception 'Comando financeiro inválido: %', action_name
      using errcode = '22023';
  end if;

  if command_origin not in (
    'WEBHOOK', 'ADMIN', 'SYSTEM', 'TRIAL', 'PAYMENT',
    'CANCELAMENTO', 'REATIVACAO'
  ) then
    raise exception 'Origem financeira inválida.' using errcode = '22023';
  end if;

  if idempotency_key is not null and exists (
    select 1 from public.subscription_audit
    where metadata ->> 'idempotency_key' = idempotency_key
  ) then
    return jsonb_build_object(
      'duplicate', true,
      'idempotency_key', idempotency_key
    );
  end if;

  select * into current_subscription
  from public.subscriptions
  where empresa_id = p_empresa_id
  for update;

  if not found then
    raise exception 'Assinatura não encontrada.' using errcode = 'P0002';
  end if;

  previous_status := current_subscription.status;
  previous_plan_id := current_subscription.plan_id;

  perform set_config('app.billing_service_manual_audit', 'true', true);

  if action_name = 'PROCESS_WEBHOOK' then
    provider_name := nullif(p_payload ->> 'provider', '');
    provider_event_id_value := nullif(p_payload ->> 'provider_event_id', '');
    event_type := upper(coalesce(nullif(p_payload ->> 'event_type', ''), ''));

    if provider_name is null or provider_event_id_value is null or event_type = '' then
      raise exception 'Provider, evento e tipo são obrigatórios.' using errcode = '22023';
    end if;

    insert into public.payment_events (
      provider, provider_event_id, event_type, payload,
      subscription_id, empresa_id, processed, processing_attempts
    ) values (
      provider_name, provider_event_id_value, event_type, p_payload,
      current_subscription.id, p_empresa_id, false, 1
    )
    on conflict (provider, provider_event_id) do nothing
    returning * into payment_event_row;

    event_was_inserted := payment_event_row.id is not null;
    if not event_was_inserted then
      return jsonb_build_object(
        'duplicate', true,
        'provider', provider_name,
        'provider_event_id', provider_event_id_value
      );
    end if;
  end if;

  if action_name = 'CHANGE_PLAN' then
    selected_plan_id := nullif(p_payload ->> 'plan_id', '')::uuid;
    select is_active into selected_plan_active
    from public.plans where id = selected_plan_id;

    if selected_plan_active is distinct from true then
      raise exception 'Plano não encontrado ou inativo.' using errcode = 'P0002';
    end if;

    if current_subscription.plan_id is distinct from selected_plan_id then
      update public.subscriptions
      set plan_id = selected_plan_id,
          metadata = metadata || jsonb_build_object(
            'last_manual_plan_change_at', now(),
            'last_manual_plan_change_by', p_actor_user_id
          ),
          updated_at = now()
      where id = current_subscription.id;
      changed := true;
    end if;

  elsif action_name = 'ACTIVATE_SUBSCRIPTION' then
    update public.subscriptions
    set status = 'ACTIVE',
        current_period_start = coalesce(
          nullif(p_payload ->> 'current_period_start', '')::timestamptz, now()
        ),
        current_period_end = nullif(p_payload ->> 'current_period_end', '')::timestamptz,
        expires_at = coalesce(
          nullif(p_payload ->> 'current_period_end', '')::timestamptz,
          expires_at
        ),
        provider = coalesce(nullif(p_payload ->> 'provider', ''), provider),
        provider_customer_id = coalesce(
          nullif(p_payload ->> 'provider_customer_id', ''), provider_customer_id
        ),
        provider_subscription_id = coalesce(
          nullif(p_payload ->> 'provider_subscription_id', ''), provider_subscription_id
        ),
        grace_ends_at = null,
        paused_at = null,
        resumed_at = case when paused_at is not null then now() else resumed_at end,
        updated_at = now()
    where id = current_subscription.id;
    changed := true;

  elsif action_name = 'RENEW_SUBSCRIPTION' then
    if nullif(p_payload ->> 'current_period_end', '') is null then
      raise exception 'Fim do período é obrigatório para renovação.' using errcode = '22023';
    end if;
    update public.subscriptions
    set status = 'ACTIVE',
        current_period_start = coalesce(
          nullif(p_payload ->> 'current_period_start', '')::timestamptz, now()
        ),
        current_period_end = (p_payload ->> 'current_period_end')::timestamptz,
        expires_at = (p_payload ->> 'current_period_end')::timestamptz,
        last_payment_at = coalesce(
          nullif(p_payload ->> 'paid_at', '')::timestamptz, last_payment_at
        ),
        next_payment_at = nullif(p_payload ->> 'next_payment_at', '')::timestamptz,
        grace_ends_at = null,
        updated_at = now()
    where id = current_subscription.id;
    changed := true;

  elsif action_name = 'CANCEL_SUBSCRIPTION' then
    update public.subscriptions
    set status = case
          when coalesce((p_payload ->> 'at_period_end')::boolean, false)
            then status
          else 'CANCELED'
        end,
        cancel_at_period_end = coalesce(
          (p_payload ->> 'at_period_end')::boolean, false
        ),
        canceled_at = case
          when coalesce((p_payload ->> 'at_period_end')::boolean, false)
            then canceled_at
          else now()
        end,
        updated_at = now()
    where id = current_subscription.id;
    changed := true;

  elsif action_name = 'PAUSE_SUBSCRIPTION' then
    update public.subscriptions
    set paused_at = coalesce(paused_at, now()), updated_at = now()
    where id = current_subscription.id;
    changed := true;

  elsif action_name = 'RESUME_SUBSCRIPTION' then
    update public.subscriptions
    set paused_at = null, resumed_at = now(), updated_at = now()
    where id = current_subscription.id;
    changed := true;

  elsif action_name in ('EXPIRE_SUBSCRIPTION', 'BLOCK_SUBSCRIPTION', 'FINISH_GRACE_PERIOD') then
    update public.subscriptions
    set status = 'EXPIRED', grace_ends_at = null, updated_at = now()
    where id = current_subscription.id;
    changed := true;

  elsif action_name = 'START_GRACE_PERIOD' then
    if nullif(p_payload ->> 'grace_ends_at', '') is null then
      raise exception 'Fim da tolerância é obrigatório.' using errcode = '22023';
    end if;
    update public.subscriptions
    set grace_ends_at = (p_payload ->> 'grace_ends_at')::timestamptz,
        updated_at = now()
    where id = current_subscription.id;
    changed := true;

  elsif action_name in ('UNBLOCK_SUBSCRIPTION', 'RESUME_SUBSCRIPTION') then
    update public.subscriptions
    set status = 'ACTIVE',
        current_period_end = coalesce(
          nullif(p_payload ->> 'current_period_end', '')::timestamptz,
          current_period_end
        ),
        expires_at = coalesce(
          nullif(p_payload ->> 'current_period_end', '')::timestamptz,
          expires_at
        ),
        grace_ends_at = null,
        paused_at = null,
        resumed_at = now(),
        updated_at = now()
    where id = current_subscription.id;
    changed := true;
  end if;

  if action_name in ('REGISTER_PAYMENT', 'PROCESS_WEBHOOK') then
    provider_name := nullif(p_payload ->> 'provider', '');
    provider_payment_id_value := nullif(p_payload ->> 'provider_payment_id', '');
    payment_status := upper(coalesce(
      nullif(p_payload ->> 'payment_status', ''),
      case event_type
        when 'PAYMENT_APPROVED' then 'APPROVED'
        when 'PAYMENT_REJECTED' then 'REJECTED'
        when 'PAYMENT_CANCELLED' then 'CANCELED'
        when 'PAYMENT_REFUNDED' then 'REFUNDED'
        else 'PENDING'
      end
    ));

    if action_name = 'REGISTER_PAYMENT'
      or provider_payment_id_value is not null
    then
      if provider_name is null or provider_payment_id_value is null then
        raise exception 'Provider e ID do pagamento são obrigatórios.' using errcode = '22023';
      end if;
      if payment_status not in (
        'PENDING', 'PROCESSING', 'APPROVED', 'PAID', 'REJECTED', 'EXPIRED',
        'CANCELED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK'
      ) then
        raise exception 'Status de pagamento inválido.' using errcode = '22023';
      end if;

      insert into public.payments (
        empresa_id, subscription_id, plan_id, provider, provider_payment_id,
        provider_invoice_id, external_reference, status, amount,
        refunded_amount, currency, payment_method, paid_at, due_at, metadata
      ) values (
        p_empresa_id, current_subscription.id, current_subscription.plan_id,
        provider_name, provider_payment_id_value,
        nullif(p_payload ->> 'provider_invoice_id', ''),
        nullif(p_payload ->> 'external_reference', ''), payment_status,
        coalesce((p_payload ->> 'amount')::numeric, 0),
        coalesce((p_payload ->> 'refunded_amount')::numeric, 0),
        upper(coalesce(nullif(p_payload ->> 'currency', ''), 'BRL')),
        nullif(p_payload ->> 'payment_method', ''),
        nullif(p_payload ->> 'paid_at', '')::timestamptz,
        nullif(p_payload ->> 'due_at', '')::timestamptz,
        coalesce(p_payload -> 'payment_metadata', '{}'::jsonb)
      )
      on conflict (provider, provider_payment_id) do update
      set status = excluded.status,
          provider_invoice_id = coalesce(excluded.provider_invoice_id, payments.provider_invoice_id),
          payment_method = coalesce(excluded.payment_method, payments.payment_method),
          paid_at = coalesce(excluded.paid_at, payments.paid_at),
          due_at = coalesce(excluded.due_at, payments.due_at),
          refunded_amount = excluded.refunded_amount,
          metadata = payments.metadata || excluded.metadata,
          updated_at = now()
      where payments.empresa_id = excluded.empresa_id
      returning * into payment_row;

      if payment_row.id is null then
        raise exception 'Pagamento pertence a outra empresa.' using errcode = '42501';
      end if;

      if action_name = 'PROCESS_WEBHOOK' then
        update public.payment_events
        set payment_id = payment_row.id
        where id = payment_event_row.id;
      end if;
    end if;
  end if;

  if action_name = 'REGISTER_PAYMENT_EVENT' then
    provider_name := coalesce(provider_name, nullif(p_payload ->> 'provider', ''));
    provider_event_id_value := nullif(p_payload ->> 'provider_event_id', '');
    event_type := upper(coalesce(nullif(p_payload ->> 'event_type', ''), ''));

    if provider_name is null or provider_event_id_value is null or event_type = '' then
      raise exception 'Provider, evento e tipo são obrigatórios.' using errcode = '22023';
    end if;

    insert into public.payment_events (
      provider, provider_event_id, event_type, payload, payment_id,
      subscription_id, empresa_id, processed, processing_attempts
    ) values (
      provider_name, provider_event_id_value, event_type, p_payload,
      payment_row.id, current_subscription.id, p_empresa_id, false, 1
    )
    on conflict (provider, provider_event_id) do nothing
    returning * into payment_event_row;

    event_was_inserted := payment_event_row.id is not null;
    if not event_was_inserted then
      return jsonb_build_object(
        'duplicate', true,
        'provider', provider_name,
        'provider_event_id', provider_event_id_value
      );
    end if;
  end if;

  if action_name = 'PROCESS_WEBHOOK' then
    if event_type in ('PAYMENT_APPROVED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_REACTIVATED') then
      update public.subscriptions
      set status = 'ACTIVE',
          current_period_start = coalesce(
            nullif(p_payload ->> 'current_period_start', '')::timestamptz,
            current_period_start,
            now()
          ),
          current_period_end = coalesce(
            nullif(p_payload ->> 'current_period_end', '')::timestamptz,
            current_period_end
          ),
          expires_at = coalesce(
            nullif(p_payload ->> 'current_period_end', '')::timestamptz,
            expires_at
          ),
          last_payment_at = case when event_type = 'PAYMENT_APPROVED'
            then coalesce(nullif(p_payload ->> 'paid_at', '')::timestamptz, now())
            else last_payment_at end,
          grace_ends_at = null,
          updated_at = now()
      where id = current_subscription.id;
      changed := true;
    elsif event_type = 'SUBSCRIPTION_RENEWED' then
      if nullif(p_payload ->> 'current_period_end', '') is null then
        raise exception 'Fim do período ausente na renovação.' using errcode = '22023';
      end if;
      update public.subscriptions
      set status = 'ACTIVE',
          current_period_start = coalesce(
            nullif(p_payload ->> 'current_period_start', '')::timestamptz, now()
          ),
          current_period_end = (p_payload ->> 'current_period_end')::timestamptz,
          expires_at = (p_payload ->> 'current_period_end')::timestamptz,
          grace_ends_at = null,
          updated_at = now()
      where id = current_subscription.id;
      changed := true;
    elsif event_type = 'PAYMENT_REJECTED' then
      update public.subscriptions set status = 'PAST_DUE', updated_at = now()
      where id = current_subscription.id;
      changed := true;
    elsif event_type in ('SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_EXPIRED') then
      update public.subscriptions
      set status = case when event_type = 'SUBSCRIPTION_CANCELLED'
          then 'CANCELED' else 'EXPIRED' end,
          canceled_at = case when event_type = 'SUBSCRIPTION_CANCELLED'
            then now() else canceled_at end,
          updated_at = now()
      where id = current_subscription.id;
      changed := true;
    end if;

    update public.payment_events
    set processed = true, processed_at = now(), last_error = null
    where id = payment_event_row.id;
  end if;

  select * into current_subscription
  from public.subscriptions where id = current_subscription.id;

  insert into public.subscription_audit (
    empresa_id, subscription_id, changed_by, old_status, new_status,
    old_plan_id, new_plan_id, provider, origin, metadata
  ) values (
    p_empresa_id, current_subscription.id, p_actor_user_id,
    previous_status, current_subscription.status,
    previous_plan_id, current_subscription.plan_id,
    coalesce(provider_name, current_subscription.provider), command_origin,
    jsonb_strip_nulls(jsonb_build_object(
      'action', action_name,
      'reason', p_reason,
      'payment_id', payment_row.id,
      'event_id', payment_event_row.id,
      'changed', changed,
      'idempotency_key', idempotency_key
    ))
  );

  return jsonb_strip_nulls(jsonb_build_object(
    'action', action_name,
    'changed', changed,
    'duplicate', false,
    'subscription_id', current_subscription.id,
    'status', current_subscription.status,
    'plan_id', current_subscription.plan_id,
    'payment_id', payment_row.id,
    'event_id', payment_event_row.id
  ));
end;
$$;

revoke all on function public.billing_execute_command(
  text, uuid, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.billing_execute_command(
  text, uuid, uuid, text, text, jsonb
) to service_role;

revoke insert, update, delete on public.subscriptions from service_role;
revoke insert, update, delete on public.subscription_billing_periods from service_role;
revoke insert, update, delete on public.payments from service_role;
revoke insert, update, delete on public.payment_events from service_role;
revoke insert, update, delete on public.subscription_audit from service_role;

comment on function public.billing_execute_command(text, uuid, uuid, text, text, jsonb) is
  'Single transactional write boundary for subscriptions, payments, payment events and audit.';

commit;
