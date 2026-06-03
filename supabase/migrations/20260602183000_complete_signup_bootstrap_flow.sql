create or replace function public.usuario_pode_criar_primeiro_vinculo(
  target_auth_user_id uuid,
  target_papel text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and target_auth_user_id = auth.uid()
    and target_papel = 'administrador'
    and not exists (
      select 1
      from public.usuarios u
      where u.auth_user_id = auth.uid()
    );
$$;

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
    raise exception 'Usuario nao autenticado para criar empresa.';
  end if;

  if nullif(trim(nome_empresa), '') is null then
    raise exception 'Nome da empresa e obrigatorio.';
  end if;

  if nullif(trim(nome_usuario), '') is null then
    raise exception 'Nome do usuario e obrigatorio.';
  end if;

  if papel_usuario is distinct from 'administrador' then
    raise exception 'O primeiro usuario da empresa deve ser administrador.';
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
  values (trim(nome_empresa), email_usuario)
  returning * into nova_empresa;

  insert into public.usuarios (
    empresa_id,
    auth_user_id,
    nome,
    email,
    telefone,
    papel,
    status
  )
  values (
    nova_empresa.id,
    auth.uid(),
    trim(nome_usuario),
    email_usuario,
    nullif(trim(coalesce(telefone_usuario, '')), ''),
    'administrador',
    'ativo'
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
    papel,
    status
  )
  values (
    nova_empresa.id,
    new.id,
    nome_usuario,
    new.email,
    telefone_usuario,
    'administrador',
    'ativo'
  );

  return new;
end;
$$;

drop trigger if exists criar_empresa_usuario_apos_auth_insert on auth.users;

create trigger criar_empresa_usuario_apos_auth_insert
after insert on auth.users
for each row execute function public.criar_empresa_usuario_auth_trigger();

drop policy if exists "usuarios_insert_bootstrap_primeiro_usuario" on public.usuarios;

create policy "usuarios_insert_bootstrap_primeiro_usuario"
on public.usuarios
for insert
to authenticated
with check (
  public.usuario_pode_criar_primeiro_vinculo(auth_user_id, papel)
);
