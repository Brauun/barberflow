begin;

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

  begin
    changed_by_id := nullif(
      current_setting('app.subscription_changed_by', true),
      ''
    )::uuid;
  exception when invalid_text_representation then
    changed_by_id := null;
  end;

  changed_by_id := coalesce(changed_by_id, auth.uid());
  change_reason := nullif(
    current_setting('app.subscription_change_reason', true),
    ''
  );

  insert into public.subscription_audit (
    empresa_id,
    subscription_id,
    changed_by,
    old_status,
    new_status,
    old_plan_id,
    new_plan_id,
    provider,
    origin,
    metadata
  ) values (
    new.empresa_id,
    new.id,
    changed_by_id,
    old.status,
    new.status,
    old.plan_id,
    new.plan_id,
    new.provider,
    change_origin,
    jsonb_strip_nulls(jsonb_build_object('reason', change_reason))
  );

  return new;
end;
$$;

create or replace function public.apply_subscription_plan_change(
  p_empresa_id uuid,
  p_plan_id uuid,
  p_changed_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_subscription public.subscriptions%rowtype;
  selected_plan public.plans%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Operação permitida somente para o backend financeiro.'
      using errcode = '42501';
  end if;

  if p_empresa_id is null or p_plan_id is null or p_changed_by is null then
    raise exception 'Empresa, plano e usuário responsável são obrigatórios.'
      using errcode = '22023';
  end if;

  select *
    into selected_plan
  from public.plans
  where id = p_plan_id
    and is_active = true;

  if not found then
    raise exception 'Plano não encontrado ou inativo.'
      using errcode = 'P0002';
  end if;

  select *
    into current_subscription
  from public.subscriptions
  where empresa_id = p_empresa_id
  for update;

  if not found then
    raise exception 'Assinatura não encontrada.'
      using errcode = 'P0002';
  end if;

  if current_subscription.plan_id = p_plan_id then
    return jsonb_build_object(
      'changed', false,
      'subscription_id', current_subscription.id,
      'plan_id', current_subscription.plan_id,
      'status', current_subscription.status
    );
  end if;

  perform set_config('app.subscription_change_origin', 'ADMIN', true);
  perform set_config('app.subscription_changed_by', p_changed_by::text, true);
  perform set_config(
    'app.subscription_change_reason',
    'Troca manual de plano',
    true
  );

  update public.subscriptions
  set
    plan_id = p_plan_id,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_manual_plan_change_at', now(),
      'last_manual_plan_change_by', p_changed_by
    ),
    updated_at = now()
  where id = current_subscription.id;

  return jsonb_build_object(
    'changed', true,
    'subscription_id', current_subscription.id,
    'previous_plan_id', current_subscription.plan_id,
    'plan_id', p_plan_id,
    'status', current_subscription.status
  );
end;
$$;

revoke all on function public.apply_subscription_plan_change(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_subscription_plan_change(uuid, uuid, uuid)
  to service_role;

comment on function public.apply_subscription_plan_change(uuid, uuid, uuid) is
  'Backend-only transactional plan selection. Preserves trial/status and emits subscription audit.';

commit;
