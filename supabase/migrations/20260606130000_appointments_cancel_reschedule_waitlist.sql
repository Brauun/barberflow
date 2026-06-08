alter table public.atendimentos
  drop constraint if exists atendimentos_status_check;

alter table public.atendimentos
  add constraint atendimentos_status_check
  check (status in (
    'agendado',
    'confirmado',
    'em_atendimento',
    'concluido',
    'cancelado',
    'remarcado',
    'nao_compareceu',
    'faltou'
  ));

alter table public.appointments
  drop constraint if exists appointments_status_check;

alter table public.appointments
  add constraint appointments_status_check
  check (status in (
    'agendado',
    'confirmado',
    'em_atendimento',
    'concluido',
    'cancelado',
    'remarcado',
    'nao_compareceu',
    'faltou'
  ));

alter table public.appointments
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists rescheduled_from_starts_at timestamptz,
  add column if not exists rescheduled_from_ends_at timestamptz,
  add column if not exists rescheduled_at timestamptz,
  add column if not exists rescheduled_by uuid references auth.users(id) on delete set null;

alter table public.atendimentos
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists rescheduled_from_starts_at timestamptz,
  add column if not exists rescheduled_from_ends_at timestamptz,
  add column if not exists rescheduled_at timestamptz,
  add column if not exists rescheduled_by uuid references auth.users(id) on delete set null;

alter table public.movimentacoes_financeiras
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists cancelled_at timestamptz;

create index if not exists movimentacoes_appointment_id_idx
  on public.movimentacoes_financeiras(appointment_id);

create table if not exists public.appointment_status_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null,
  source text not null default 'appointments'
    check (source in ('appointments', 'atendimentos')),
  empresa_id uuid references public.empresas(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_role text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists appointment_status_logs_appointment_idx
  on public.appointment_status_logs(source, appointment_id, created_at desc);

create index if not exists appointment_status_logs_empresa_idx
  on public.appointment_status_logs(empresa_id, created_at desc);

create table if not exists public.appointment_waitlist (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.servicos(id) on delete cascade,
  barber_id uuid references public.barbeiros(id) on delete set null,
  desired_date date not null,
  preferred_period text
    check (preferred_period is null or preferred_period in ('manha', 'tarde', 'noite', 'qualquer')),
  status text not null default 'aguardando'
    check (status in ('aguardando', 'notificado', 'agendado', 'cancelado', 'expirado')),
  notified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointment_waitlist_empresa_date_status_idx
  on public.appointment_waitlist(empresa_id, desired_date, status, created_at);

create index if not exists appointment_waitlist_client_status_idx
  on public.appointment_waitlist(client_id, status);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete set null,
  channel text not null default 'whatsapp',
  type text not null,
  message text not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'erro', 'cancelado')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists notification_logs_empresa_status_idx
  on public.notification_logs(empresa_id, status, created_at desc);

drop trigger if exists appointment_waitlist_set_updated_at on public.appointment_waitlist;
create trigger appointment_waitlist_set_updated_at
before update on public.appointment_waitlist
for each row execute function public.set_updated_at();

alter table public.appointment_status_logs enable row level security;
alter table public.appointment_waitlist enable row level security;
alter table public.notification_logs enable row level security;

drop policy if exists "appointments company and client update" on public.appointments;
create policy "appointments company and client update" on public.appointments
for update using (
  exists (
    select 1 from public.profiles p
    where p.id = appointments.client_profile_id
      and p.auth_user_id = auth.uid()
  )
  or exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = appointments.empresa_id
      and u.status = 'ativo'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = appointments.client_profile_id
      and p.auth_user_id = auth.uid()
  )
  or exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = appointments.empresa_id
      and u.status = 'ativo'
  )
);

drop policy if exists "appointment_status_logs own select" on public.appointment_status_logs;
create policy "appointment_status_logs own select" on public.appointment_status_logs
for select using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = appointment_status_logs.empresa_id
  )
  or exists (
    select 1 from public.appointments a
    join public.profiles p on p.id = a.client_profile_id
    where appointment_status_logs.source = 'appointments'
      and a.id = appointment_status_logs.appointment_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "appointment_status_logs authenticated insert" on public.appointment_status_logs;
create policy "appointment_status_logs authenticated insert" on public.appointment_status_logs
for insert with check (auth.uid() is not null);

drop policy if exists "appointment_waitlist own select" on public.appointment_waitlist;
create policy "appointment_waitlist own select" on public.appointment_waitlist
for select using (
  exists (
    select 1 from public.profiles p
    where p.id = appointment_waitlist.client_id
      and p.auth_user_id = auth.uid()
  )
  or exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = appointment_waitlist.empresa_id
  )
);

drop policy if exists "appointment_waitlist client insert" on public.appointment_waitlist;
create policy "appointment_waitlist client insert" on public.appointment_waitlist
for insert with check (
  exists (
    select 1 from public.profiles p
    where p.id = appointment_waitlist.client_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
);

drop policy if exists "appointment_waitlist own update" on public.appointment_waitlist;
create policy "appointment_waitlist own update" on public.appointment_waitlist
for update using (
  exists (
    select 1 from public.profiles p
    where p.id = appointment_waitlist.client_id
      and p.auth_user_id = auth.uid()
  )
  or exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = appointment_waitlist.empresa_id
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = appointment_waitlist.client_id
      and p.auth_user_id = auth.uid()
  )
  or exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = appointment_waitlist.empresa_id
  )
);

drop policy if exists "notification_logs own select" on public.notification_logs;
create policy "notification_logs own select" on public.notification_logs
for select using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = notification_logs.empresa_id
  )
  or exists (
    select 1 from public.profiles p
    where p.id = notification_logs.client_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "notification_logs authenticated insert" on public.notification_logs;
create policy "notification_logs authenticated insert" on public.notification_logs
for insert with check (auth.uid() is not null);
