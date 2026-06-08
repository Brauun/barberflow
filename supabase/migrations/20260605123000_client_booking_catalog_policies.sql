drop policy if exists "servicos_client_booking_select"
on public.servicos;

create policy "servicos_client_booking_select"
on public.servicos
for select
to authenticated
using (
  ativo = true
  and exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
  and exists (
    select 1
    from public.barbershops b
    where b.empresa_id = servicos.empresa_id
      and b.status = 'ativa'
  )
);

drop policy if exists "barbeiros_client_booking_select"
on public.barbeiros;

create policy "barbeiros_client_booking_select"
on public.barbeiros
for select
to authenticated
using (
  status = 'ativo'
  and exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
  and exists (
    select 1
    from public.barbershops b
    where b.empresa_id = barbeiros.empresa_id
      and b.status = 'ativa'
  )
);

drop policy if exists "appointments_client_booking_availability_select"
on public.appointments;

create policy "appointments_client_booking_availability_select"
on public.appointments
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.role = 'cliente'
  )
  and exists (
    select 1
    from public.barbershops b
    where b.id = appointments.barbershop_id
      and b.status = 'ativa'
  )
);
