alter table public.empresas
add column if not exists responsavel_cpf text;

create index if not exists empresas_responsavel_cpf_idx
on public.empresas (responsavel_cpf);

create or replace function public.criar_empresa_com_usuario(
  nome_empresa text,
  nome_usuario text,
  telefone_usuario text default null,
  papel_usuario text default 'administrador',
  responsavel_cpf text default null
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
  cpf_limpo text;
  telefone_limpo text;
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

  cpf_limpo := regexp_replace(coalesce(responsavel_cpf, ''), '\D', '', 'g');
  telefone_limpo := regexp_replace(coalesce(telefone_usuario, ''), '\D', '', 'g');

  if length(cpf_limpo) <> 11 then
    raise exception 'CPF do responsavel deve ter 11 digitos.';
  end if;

  if telefone_limpo <> '' and length(telefone_limpo) <> 11 then
    raise exception 'Telefone deve ter 11 digitos.';
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

  insert into public.empresas (nome, email, telefone, responsavel_cpf)
  values (
    trim(nome_empresa),
    email_usuario,
    nullif(telefone_limpo, ''),
    cpf_limpo
  )
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
    nullif(telefone_limpo, ''),
    'administrador',
    'ativo'
  )
  returning * into novo_usuario;

  return novo_usuario;
end;
$$;

revoke all on function public.criar_empresa_com_usuario(text, text, text, text, text)
from public;

grant execute on function public.criar_empresa_com_usuario(text, text, text, text, text)
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
  responsavel_cpf text;
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
  telefone_usuario := nullif(
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefone', ''), '\D', '', 'g'),
    ''
  );
  responsavel_cpf := nullif(
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'responsavel_cpf', ''), '\D', '', 'g'),
    ''
  );

  if nome_empresa is null or nome_usuario is null then
    return new;
  end if;

  insert into public.empresas (nome, email, telefone, responsavel_cpf)
  values (nome_empresa, new.email, telefone_usuario, responsavel_cpf)
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
