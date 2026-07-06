begin;

create or replace function public.can_barbershop_accept_appointments(
  p_empresa_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_or(
    case
      when s.status = 'ACTIVE' then
        coalesce(s.current_period_end, s.expires_at) > now()
      when s.status = 'TRIAL' then
        s.trial_ends_at > now()
        or coalesce(
          s.grace_ends_at,
          s.trial_ends_at + interval '3 days'
        ) > now()
      when s.status in ('PAST_DUE', 'EXPIRED') then
        s.grace_ends_at > now()
      else false
    end
  ), false)
  from public.subscriptions s
  where s.empresa_id = p_empresa_id;
$$;

revoke all on function public.can_barbershop_accept_appointments(uuid) from public;
grant execute on function public.can_barbershop_accept_appointments(uuid) to authenticated;

comment on function public.can_barbershop_accept_appointments(uuid) is
  'Returns only whether a selected barbershop may receive new appointments, without exposing billing data.';

commit;
