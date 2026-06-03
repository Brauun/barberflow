create or replace function public.criar_empresa_com_usuario(
  nome_empresa text,
  nome_usuario text,
  telefone_usuario text default null,
  papel_usuario text default 'administrador'
)
returns public.usuarios
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  nova_empresa public.empresas;
  novo_usuario public.usuarios;
  email_usuario text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if papel_usuario not in ('administrador', 'gerente', 'barbeiro') then
    raise exception 'Papel de usuario invalido.';
  end if;

  select *
  into novo_usuario
  from public.usuarios
  where auth_user_id = auth.uid()
  limit 1;

  if novo_usuario.id is not null then
    return novo_usuario;
  end if;

  select email into email_usuario
  from auth.users
  where id = auth.uid();

  if email_usuario is null then
    raise exception 'E-mail do usuario autenticado nao encontrado.';
  end if;

  insert into public.empresas (nome, email)
  values (nome_empresa, email_usuario)
  returning * into nova_empresa;

  insert into public.usuarios (
    empresa_id,
    auth_user_id,
    nome,
    email,
    telefone,
    papel
  )
  values (
    nova_empresa.id,
    auth.uid(),
    nome_usuario,
    email_usuario,
    telefone_usuario,
    papel_usuario
  )
  returning * into novo_usuario;

  return novo_usuario;
end;
$$;

revoke all on function public.criar_empresa_com_usuario(text, text, text, text)
from public;

grant execute on function public.criar_empresa_com_usuario(text, text, text, text)
to authenticated;

create or replace function public.criar_empresa_usuario_auth_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  nova_empresa public.empresas;
  nome_empresa text;
  nome_usuario text;
  telefone_usuario text;
begin
  if exists (
    select 1
    from public.usuarios
    where auth_user_id = new.id
  ) then
    return new;
  end if;

  nome_empresa := nullif(trim(coalesce(new.raw_user_meta_data ->> 'empresa', '')), '');
  nome_usuario := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nome', '')), '');
  telefone_usuario := nullif(trim(coalesce(new.raw_user_meta_data ->> 'telefone', '')), '');

  if nome_empresa is null or nome_usuario is null then
    return new;
  end if;

  insert into public.empresas (nome, email)
  values (nome_empresa, new.email)
  returning * into nova_empresa;

  insert into public.usuarios (
    empresa_id,
    auth_user_id,
    nome,
    email,
    telefone,
    papel
  )
  values (
    nova_empresa.id,
    new.id,
    nome_usuario,
    new.email,
    telefone_usuario,
    'administrador'
  );

  return new;
end;
$$;

drop trigger if exists criar_empresa_usuario_apos_auth_insert on auth.users;

create trigger criar_empresa_usuario_apos_auth_insert
after insert on auth.users
for each row execute function public.criar_empresa_usuario_auth_trigger();
