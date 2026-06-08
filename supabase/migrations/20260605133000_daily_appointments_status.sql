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
    'faltou'
  ));
