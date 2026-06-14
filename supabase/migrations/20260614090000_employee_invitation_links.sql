create or replace function public.get_employee_invitation_public(p_token text)
returns table (
  id uuid,
  empresa_id uuid,
  barbershop_id uuid,
  employee_id uuid,
  nome text,
  email text,
  telefone text,
  role text,
  commission_percentage numeric,
  token text,
  status text,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_by uuid,
  created_at timestamptz,
  empresa_nome text
)
language sql
security definer
set search_path = public
as $$
  select
    invitation.id,
    invitation.empresa_id,
    invitation.barbershop_id,
    invitation.employee_id,
    invitation.nome,
    invitation.email,
    invitation.telefone,
    invitation.role,
    invitation.commission_percentage,
    invitation.token,
    case
      when invitation.status = 'pendente' and invitation.expires_at <= now()
        then 'expirado'
      else invitation.status
    end as status,
    invitation.expires_at,
    invitation.accepted_at,
    invitation.created_by,
    invitation.created_at,
    empresa.nome as empresa_nome
  from public.employee_invitations invitation
  join public.empresas empresa on empresa.id = invitation.empresa_id
  where invitation.token = p_token
  limit 1;
$$;

revoke all on function public.get_employee_invitation_public(text) from public;
grant execute on function public.get_employee_invitation_public(text) to anon, authenticated;

create or replace function public.regenerate_employee_invitation_token(
  p_empresa_id uuid,
  p_invitation_id uuid
)
returns public.employee_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.employee_invitations;
begin
  if auth.uid() is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  if not public.has_empresa_role(p_empresa_id, array['administrador', 'gerente']) then
    raise exception 'Apenas administradores ou gerentes podem regerar convites.';
  end if;

  select *
  into invitation
  from public.employee_invitations
  where id = p_invitation_id
    and empresa_id = p_empresa_id
  for update;

  if invitation.id is null then
    raise exception 'Convite nao encontrado.';
  end if;

  if invitation.status not in ('pendente', 'expirado') then
    raise exception 'Somente convites pendentes ou expirados podem ter o link regerado.';
  end if;

  update public.employee_invitations
  set
    token = concat(gen_random_uuid()::text, '-', gen_random_uuid()::text),
    status = 'pendente',
    expires_at = now() + interval '7 days',
    accepted_at = null
  where id = invitation.id
  returning * into invitation;

  return invitation;
end;
$$;

revoke all on function public.regenerate_employee_invitation_token(uuid, uuid) from public;
grant execute on function public.regenerate_employee_invitation_token(uuid, uuid) to authenticated;
