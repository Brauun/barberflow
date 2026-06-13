alter table public.error_logs
  add column if not exists action text,
  add column if not exists level text not null default 'error',
  add column if not exists request_id text,
  add column if not exists user_agent text;

alter table public.error_logs
  drop constraint if exists error_logs_level_check;

alter table public.error_logs
  add constraint error_logs_level_check
  check (level in ('info', 'warn', 'error', 'fatal'));

create index if not exists error_logs_level_created_at_idx
  on public.error_logs (level, created_at desc);

create index if not exists error_logs_request_id_idx
  on public.error_logs (request_id)
  where request_id is not null;

create or replace function public.purge_old_observability_logs(
  p_retention_days integer default 15
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
  current_deleted integer := 0;
begin
  delete from public.error_logs
  where created_at < now() - make_interval(days => greatest(p_retention_days, 1));

  get diagnostics current_deleted = row_count;
  deleted_count := deleted_count + current_deleted;

  delete from public.audit_logs
  where created_at < now() - make_interval(days => greatest(p_retention_days, 1));

  get diagnostics current_deleted = row_count;
  deleted_count := deleted_count + current_deleted;

  return deleted_count;
end;
$$;

revoke all on function public.purge_old_observability_logs(integer) from public;
revoke all on function public.purge_old_observability_logs(integer) from anon;
revoke all on function public.purge_old_observability_logs(integer) from authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
    and exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      perform cron.unschedule('bw-barber-observability-retention-15d');
    exception
      when others then
        null;
    end;

    perform cron.schedule(
      'bw-barber-observability-retention-15d',
      '15 3 * * *',
      'select public.purge_old_observability_logs(15);'
    );
  else
    raise notice 'pg_cron nao esta habilitado. Agende select public.purge_old_observability_logs(15); diariamente no Supabase.';
  end if;
exception
  when others then
    raise notice 'Nao foi possivel configurar retencao automatica de logs: %', sqlerrm;
end;
$$;

notify pgrst, 'reload schema';
