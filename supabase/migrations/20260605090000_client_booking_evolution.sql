create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check (role in ('barbearia', 'cliente')),
  nome text not null,
  email text,
  telefone text,
  primary_barbershop_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.barbershops (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid unique references public.empresas(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  endereco text,
  logo_url text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  rating numeric(3, 2) not null default 5,
  total_appointments integer not null default 0,
  average_wait_minutes integer not null default 20,
  status text not null default 'ativa' check (status in ('ativa', 'inativa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_primary_barbershop_id_fkey
  foreign key (primary_barbershop_id)
  references public.barbershops(id)
  on delete set null;

create table if not exists public.client_barbershop (
  id uuid primary key default gen_random_uuid(),
  client_profile_id uuid not null references public.profiles(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_profile_id, barbershop_id)
);

create unique index if not exists client_barbershop_one_primary_idx
  on public.client_barbershop(client_profile_id)
  where is_primary;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  client_profile_id uuid references public.profiles(id) on delete set null,
  atendimento_id uuid references public.atendimentos(id) on delete set null,
  barbeiro_id uuid references public.barbeiros(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'agendado'
    check (status in ('agendado', 'confirmado', 'concluido', 'cancelado', 'faltou')),
  valor_original numeric(12, 2) not null default 0,
  valor_desconto numeric(12, 2) not null default 0,
  valor_final numeric(12, 2) not null default 0,
  motivo_desconto text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (valor_original >= 0),
  check (valor_desconto >= 0),
  check (valor_final >= 0)
);

create table if not exists public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  servico_id uuid references public.servicos(id) on delete set null,
  nome text not null,
  duration_minutes integer not null default 30,
  valor_original numeric(12, 2) not null default 0,
  valor_desconto numeric(12, 2) not null default 0,
  valor_final numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discount_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  atendimento_id uuid references public.atendimentos(id) on delete cascade,
  tipo text not null check (tipo in ('valor', 'percentual')),
  motivo text not null check (motivo in ('Promoção', 'Cliente fiel', 'Cupom', 'Cortesia', 'Outro')),
  valor_original numeric(12, 2) not null,
  valor_desconto numeric(12, 2) not null,
  valor_final numeric(12, 2) not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.servicos
  add column if not exists duration_minutes integer;

update public.servicos
set duration_minutes = duracao_minutos
where duration_minutes is null;

alter table public.servicos
  alter column duration_minutes set default 30;

alter table public.atendimentos
  add column if not exists valor_original numeric(12, 2),
  add column if not exists valor_desconto numeric(12, 2) not null default 0,
  add column if not exists valor_final numeric(12, 2),
  add column if not exists motivo_desconto text,
  add column if not exists comissao_base text not null default 'liquido'
    check (comissao_base in ('cheio', 'liquido'));

update public.atendimentos
set
  valor_original = coalesce(valor_original, valor),
  valor_final = coalesce(valor_final, valor)
where valor_original is null or valor_final is null;

insert into public.barbershops (empresa_id, nome, telefone, email, endereco, logo_url)
select e.id, e.nome, e.telefone, e.email, e.endereco, e.logo_url
from public.empresas e
where not exists (
  select 1 from public.barbershops b where b.empresa_id = e.id
);

create index if not exists profiles_auth_user_id_idx on public.profiles(auth_user_id);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists barbershops_status_idx on public.barbershops(status);
create index if not exists barbershops_location_idx on public.barbershops(latitude, longitude);
create index if not exists appointments_barbershop_starts_idx on public.appointments(barbershop_id, starts_at);
create index if not exists appointments_barbeiro_starts_idx on public.appointments(barbeiro_id, starts_at);
create index if not exists discount_logs_empresa_idx on public.discount_logs(empresa_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists barbershops_set_updated_at on public.barbershops;
create trigger barbershops_set_updated_at
before update on public.barbershops
for each row execute function public.set_updated_at();

drop trigger if exists client_barbershop_set_updated_at on public.client_barbershop;
create trigger client_barbershop_set_updated_at
before update on public.client_barbershop
for each row execute function public.set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists appointment_items_set_updated_at on public.appointment_items;
create trigger appointment_items_set_updated_at
before update on public.appointment_items
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.barbershops enable row level security;
alter table public.client_barbershop enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;
alter table public.discount_logs enable row level security;

create policy "profiles select own" on public.profiles
for select using (auth_user_id = auth.uid());

create policy "profiles insert own" on public.profiles
for insert with check (auth_user_id = auth.uid());

create policy "profiles update own" on public.profiles
for update using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy "barbershops public active select" on public.barbershops
for select using (status = 'ativa');

create policy "barbershops own company update" on public.barbershops
for update using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = barbershops.empresa_id
  )
);

create policy "barbershops own company insert" on public.barbershops
for insert with check (
  empresa_id is null
  or exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = barbershops.empresa_id
  )
);

create policy "client_barbershop own select" on public.client_barbershop
for select using (
  exists (
    select 1 from public.profiles p
    where p.id = client_profile_id
      and p.auth_user_id = auth.uid()
  )
);

create policy "client_barbershop own insert" on public.client_barbershop
for insert with check (
  exists (
    select 1 from public.profiles p
    where p.id = client_profile_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
);

create policy "client_barbershop own update" on public.client_barbershop
for update using (
  exists (
    select 1 from public.profiles p
    where p.id = client_profile_id
      and p.auth_user_id = auth.uid()
  )
);

create policy "appointments client own select" on public.appointments
for select using (
  exists (
    select 1 from public.profiles p
    where p.id = client_profile_id
      and p.auth_user_id = auth.uid()
  )
  or exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = appointments.empresa_id
  )
);

create policy "appointments client own insert" on public.appointments
for insert with check (
  exists (
    select 1 from public.profiles p
    where p.id = client_profile_id
      and p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
);

create policy "appointment_items visible by appointment" on public.appointment_items
for select using (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_id
      and (
        exists (
          select 1 from public.profiles p
          where p.id = a.client_profile_id
            and p.auth_user_id = auth.uid()
        )
        or exists (
          select 1 from public.usuarios u
          where u.auth_user_id = auth.uid()
            and u.empresa_id = a.empresa_id
        )
      )
  )
);

create policy "appointment_items insert by appointment owner" on public.appointment_items
for insert with check (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_id
      and (
        exists (
          select 1 from public.profiles p
          where p.id = a.client_profile_id
            and p.auth_user_id = auth.uid()
        )
        or exists (
          select 1 from public.usuarios u
          where u.auth_user_id = auth.uid()
            and u.empresa_id = a.empresa_id
        )
      )
  )
);

create policy "discount_logs company select" on public.discount_logs
for select using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = discount_logs.empresa_id
  )
);

create policy "discount_logs company insert" on public.discount_logs
for insert with check (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = discount_logs.empresa_id
  )
);
