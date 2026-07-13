begin;

create or replace function public.billing_manage_subscription_cancellation(
  p_empresa_id uuid,
  p_actor_user_id uuid default null,
  p_action text default 'CANCEL_AT_PERIOD_END',
  p_origin text default 'ADMIN',
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
  command_origin text := upper(trim(coalesce(p_origin, 'ADMIN')));
  current_subscription public.subscriptions%rowtype;
  previous_status text;
  previous_plan_id uuid;
  period_end timestamptz;
  changed boolean := false;
  idempotency_key text := nullif(p_payload ->> 'idempotency_key', '');
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Operacao permitida somente para o Billing Service.'
      using errcode = '42501';
  end if;

  if p_empresa_id is null then
    raise exception 'Empresa e obrigatoria.' using errcode = '22023';
  end if;

  if action_name not in ('CANCEL_AT_PERIOD_END', 'REACTIVATE_AT_PERIOD_END') then
    raise exception 'Comando de cancelamento invalido: %', action_name
      using errcode = '22023';
  end if;

  if command_origin not in (
    'WEBHOOK', 'ADMIN', 'SYSTEM', 'TRIAL', 'PAYMENT',
    'CANCELAMENTO', 'REATIVACAO'
  ) then
    raise exception 'Origem financeira invalida.' using errcode = '22023';
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
    raise exception 'Assinatura nao encontrada.' using errcode = 'P0002';
  end if;

  previous_status := current_subscription.status;
  previous_plan_id := current_subscription.plan_id;
  period_end := coalesce(current_subscription.current_period_end, current_subscription.expires_at);

  if action_name = 'CANCEL_AT_PERIOD_END' then
    if current_subscription.status is distinct from 'ACTIVE' then
      raise exception 'Apenas assinaturas ativas podem ser canceladas ao fim do ciclo.'
        using errcode = '22023';
    end if;

    if period_end is null or period_end <= now() then
      raise exception 'Assinatura ativa sem periodo vigente para cancelamento.'
        using errcode = '22023';
    end if;

    if current_subscription.cancel_at_period_end is distinct from true then
      update public.subscriptions
      set cancel_at_period_end = true,
          canceled_at = coalesce(canceled_at, now()),
          metadata = metadata || jsonb_strip_nulls(jsonb_build_object(
            'last_cancellation_requested_at', now(),
            'last_cancellation_requested_by', p_actor_user_id,
            'last_cancellation_reason', p_reason
          )),
          updated_at = now()
      where id = current_subscription.id;
      changed := true;
    end if;
  elsif action_name = 'REACTIVATE_AT_PERIOD_END' then
    if current_subscription.status is distinct from 'ACTIVE' then
      raise exception 'Apenas assinaturas ativas podem ser reativadas.'
        using errcode = '22023';
    end if;

    if period_end is null or period_end <= now() then
      raise exception 'Nao e possivel reativar uma assinatura sem periodo vigente.'
        using errcode = '22023';
    end if;

    if current_subscription.cancel_at_period_end is true then
      update public.subscriptions
      set cancel_at_period_end = false,
          canceled_at = null,
          metadata = metadata || jsonb_strip_nulls(jsonb_build_object(
            'last_reactivation_requested_at', now(),
            'last_reactivation_requested_by', p_actor_user_id,
            'last_reactivation_reason', p_reason
          )),
          updated_at = now()
      where id = current_subscription.id;
      changed := true;
    end if;
  end if;

  select * into current_subscription
  from public.subscriptions
  where id = current_subscription.id;

  insert into public.subscription_audit (
    empresa_id, subscription_id, changed_by, old_status, new_status,
    old_plan_id, new_plan_id, provider, origin, metadata
  ) values (
    p_empresa_id, current_subscription.id, p_actor_user_id,
    previous_status, current_subscription.status,
    previous_plan_id, current_subscription.plan_id,
    current_subscription.provider, command_origin,
    jsonb_strip_nulls(jsonb_build_object(
      'action', action_name,
      'reason', p_reason,
      'changed', changed,
      'cancel_at_period_end', current_subscription.cancel_at_period_end,
      'current_period_end', period_end,
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
    'cancel_at_period_end', current_subscription.cancel_at_period_end,
    'current_period_end', period_end
  ));
end;
$$;

revoke all on function public.billing_manage_subscription_cancellation(
  uuid, uuid, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.billing_manage_subscription_cancellation(
  uuid, uuid, text, text, text, jsonb
) to service_role;

comment on function public.billing_manage_subscription_cancellation(
  uuid, uuid, text, text, text, jsonb
) is 'Billing Service boundary for subscription cancellation at period end and reactivation.';

commit;
