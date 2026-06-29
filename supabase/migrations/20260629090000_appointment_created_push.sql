create table if not exists public.push_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  recipient_auth_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  status text not null default 'processando'
    check (status in ('processando', 'enviado', 'falhou')),
  sent_devices integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id, recipient_auth_user_id, event_type)
);

create index if not exists push_delivery_logs_empresa_created_idx
  on public.push_delivery_logs(empresa_id, created_at desc);

drop trigger if exists push_delivery_logs_set_updated_at on public.push_delivery_logs;
create trigger push_delivery_logs_set_updated_at
before update on public.push_delivery_logs
for each row execute function public.set_updated_at();

alter table public.push_delivery_logs enable row level security;

-- Estes registros são telemetria exclusiva do backend. O service role ignora
-- RLS; usuários autenticados não recebem acesso direto à tabela.
revoke all on table public.push_delivery_logs from anon, authenticated;

create or replace function public.create_internal_notification(
  p_empresa_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb default '{}'::jsonb,
  p_barber_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_barber_name text;
  appointment_key text;
  barber_key text;
  waitlist_key text;
begin
  if auth.uid() is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  appointment_key := coalesce(p_metadata ->> 'appointmentId', p_metadata ->> 'appointment_id');
  barber_key := coalesce(p_metadata ->> 'barberId', p_metadata ->> 'barber_id');
  waitlist_key := coalesce(p_metadata ->> 'waitlistId', p_metadata ->> 'waitlist_id');

  if not (
    public.has_empresa_role(p_empresa_id, array['administrador'])
    or (
      public.is_uuid(appointment_key)
      and exists (
        select 1
        from public.appointments a
        join public.profiles p on p.id = a.client_profile_id
        where a.id = appointment_key::uuid
          and a.empresa_id = p_empresa_id
          and p.auth_user_id = auth.uid()
          and p.role = 'cliente'
      )
    )
    or (
      public.is_uuid(waitlist_key)
      and exists (
        select 1
        from public.appointment_waitlist w
        join public.profiles p on p.id = w.client_id
        where w.id = waitlist_key::uuid
          and w.empresa_id = p_empresa_id
          and p.auth_user_id = auth.uid()
          and p.role = 'cliente'
      )
    )
  ) then
    raise exception 'Usuario sem permissao para criar notificacao nesta empresa.';
  end if;

  normalized_barber_name := nullif(lower(trim(coalesce(p_barber_name, ''))), '');

  insert into public.notifications (
    empresa_id,
    recipient_user_id,
    type,
    title,
    message,
    metadata
  )
  select
    p_empresa_id,
    u.id,
    p_type,
    p_title,
    p_message,
    coalesce(p_metadata, '{}'::jsonb)
  from public.usuarios u
  where u.empresa_id = p_empresa_id
    and u.status = 'ativo'
    and (
      u.papel = 'administrador'
      or (
        u.papel = 'barbeiro'
        and (
          (
            public.is_uuid(barber_key)
            and exists (
              select 1
              from public.barbeiros b
              where b.id = barber_key::uuid
                and b.empresa_id = p_empresa_id
                and b.usuario_id = u.id
                and b.status = 'ativo'
            )
          )
          or (
            not public.is_uuid(barber_key)
            and normalized_barber_name is not null
            and lower(trim(u.nome)) = normalized_barber_name
          )
        )
      )
    )
  on conflict do nothing;
end;
$$;

revoke all on function public.create_internal_notification(uuid, text, text, text, jsonb, text) from public;
grant execute on function public.create_internal_notification(uuid, text, text, text, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
