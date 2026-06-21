with duplicated_notifications as (
  select
    ctid,
    row_number() over (
      partition by
        empresa_id,
        type,
        coalesce(recipient_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(metadata ->> 'appointment_id', metadata ->> 'appointmentId')
      order by created_at asc, id asc
    ) as duplicate_position
  from public.notifications
  where type in (
      'appointment_created',
      'appointment_cancelled',
      'appointment_rescheduled',
      'appointment_pending_completion',
      'appointment_pending_confirmation',
      'appointment_upcoming'
    )
    and coalesce(metadata ->> 'appointment_id', metadata ->> 'appointmentId') is not null
)
delete from public.notifications n
using duplicated_notifications d
where n.ctid = d.ctid
  and d.duplicate_position > 1;

create unique index if not exists notifications_unique_appointment_event_recipient_idx
  on public.notifications (
    empresa_id,
    type,
    coalesce(recipient_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(metadata ->> 'appointment_id', metadata ->> 'appointmentId')
  )
  where type in (
      'appointment_created',
      'appointment_cancelled',
      'appointment_rescheduled',
      'appointment_pending_completion',
      'appointment_pending_confirmation',
      'appointment_upcoming'
    )
    and coalesce(metadata ->> 'appointment_id', metadata ->> 'appointmentId') is not null;
