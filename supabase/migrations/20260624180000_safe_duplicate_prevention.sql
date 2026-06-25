create or replace function public.normalize_email(value text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(value, ''))), '');
$$;

create or replace function public.normalize_digits(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '');
$$;

create or replace function public.normalize_name(value text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(regexp_replace(coalesce(value, ''), '\s+', ' ', 'g'))), '');
$$;

do $$
declare
  has_duplicates boolean;
begin
  select exists (
    select 1
    from public.clientes
    where public.normalize_digits(telefone) is not null
    group by empresa_id, public.normalize_digits(telefone)
    having count(*) > 1
  ) into has_duplicates;

  if has_duplicates then
    raise notice 'Duplicate prevention skipped: clientes phone duplicates exist. Run docs/duplicidades-encontradas.md diagnostics.';
  else
    create unique index if not exists clientes_empresa_telefone_normalizado_unique_idx
      on public.clientes (empresa_id, public.normalize_digits(telefone))
      where public.normalize_digits(telefone) is not null;
  end if;
end $$;

do $$
declare
  has_duplicates boolean;
begin
  select exists (
    select 1
    from public.clientes
    where public.normalize_email(email) is not null
    group by empresa_id, public.normalize_email(email)
    having count(*) > 1
  ) into has_duplicates;

  if has_duplicates then
    raise notice 'Duplicate prevention skipped: clientes e-mail duplicates exist. Run docs/duplicidades-encontradas.md diagnostics.';
  else
    create unique index if not exists clientes_empresa_email_normalizado_unique_idx
      on public.clientes (empresa_id, public.normalize_email(email))
      where public.normalize_email(email) is not null;
  end if;
end $$;

do $$
declare
  has_column boolean;
  has_duplicates boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clientes'
      and column_name = 'cpf'
  ) into has_column;

  if has_column then
    execute $q$
      select exists (
        select 1
        from public.clientes
        where public.normalize_digits(cpf) is not null
        group by empresa_id, public.normalize_digits(cpf)
        having count(*) > 1
      )
    $q$ into has_duplicates;

    if has_duplicates then
      raise notice 'Duplicate prevention skipped: clientes CPF duplicates exist. Run docs/duplicidades-encontradas.md diagnostics.';
    else
      execute $q$
        create unique index if not exists clientes_empresa_cpf_normalizado_unique_idx
          on public.clientes (empresa_id, public.normalize_digits(cpf))
          where public.normalize_digits(cpf) is not null
      $q$;
    end if;
  end if;
end $$;

do $$
declare
  has_duplicates boolean;
begin
  select exists (
    select 1
    from public.profiles
    where role = 'cliente'
      and public.normalize_digits(telefone) is not null
    group by public.normalize_digits(telefone)
    having count(*) > 1
  ) into has_duplicates;

  if has_duplicates then
    raise notice 'Duplicate prevention skipped: client profile phone duplicates exist. Run docs/duplicidades-encontradas.md diagnostics.';
  else
    create unique index if not exists profiles_cliente_telefone_normalizado_unique_idx
      on public.profiles (public.normalize_digits(telefone))
      where role = 'cliente'
        and public.normalize_digits(telefone) is not null;
  end if;
end $$;

do $$
declare
  has_duplicates boolean;
begin
  select exists (
    select 1
    from public.profiles
    where role = 'cliente'
      and public.normalize_email(email) is not null
    group by public.normalize_email(email)
    having count(*) > 1
  ) into has_duplicates;

  if has_duplicates then
    raise notice 'Duplicate prevention skipped: client profile e-mail duplicates exist. Run docs/duplicidades-encontradas.md diagnostics.';
  else
    create unique index if not exists profiles_cliente_email_normalizado_unique_idx
      on public.profiles (public.normalize_email(email))
      where role = 'cliente'
        and public.normalize_email(email) is not null;
  end if;
end $$;

do $$
declare
  has_duplicates boolean;
begin
  select exists (
    select 1
    from public.empresas
    where public.normalize_digits(cpf_cnpj) is not null
    group by public.normalize_digits(cpf_cnpj)
    having count(*) > 1
  ) into has_duplicates;

  if has_duplicates then
    raise notice 'Duplicate prevention skipped: empresas CPF/CNPJ duplicates exist. Run docs/duplicidades-encontradas.md diagnostics.';
  else
    create unique index if not exists empresas_cpf_cnpj_normalizado_unique_idx
      on public.empresas (public.normalize_digits(cpf_cnpj))
      where public.normalize_digits(cpf_cnpj) is not null;
  end if;
end $$;

do $$
declare
  has_duplicates boolean;
begin
  select exists (
    select 1
    from public.barbershops
    where public.normalize_digits(cpf_cnpj) is not null
    group by public.normalize_digits(cpf_cnpj)
    having count(*) > 1
  ) into has_duplicates;

  if has_duplicates then
    raise notice 'Duplicate prevention skipped: barbershops CPF/CNPJ duplicates exist. Run docs/duplicidades-encontradas.md diagnostics.';
  else
    create unique index if not exists barbershops_cpf_cnpj_normalizado_unique_idx
      on public.barbershops (public.normalize_digits(cpf_cnpj))
      where public.normalize_digits(cpf_cnpj) is not null;
  end if;
end $$;

do $$
declare
  has_duplicates boolean;
begin
  select exists (
    select 1
    from public.servicos
    where public.normalize_name(nome) is not null
      and ativo = true
      and coalesce(status, 'ativo') <> 'inativo'
    group by empresa_id, public.normalize_name(nome)
    having count(*) > 1
  ) into has_duplicates;

  if has_duplicates then
    raise notice 'Duplicate prevention skipped: active servicos name duplicates exist. Run docs/duplicidades-encontradas.md diagnostics.';
  else
    create unique index if not exists servicos_empresa_nome_ativo_normalizado_unique_idx
      on public.servicos (empresa_id, public.normalize_name(nome))
      where public.normalize_name(nome) is not null
        and ativo = true
        and coalesce(status, 'ativo') <> 'inativo';
  end if;
end $$;

do $$
declare
  has_duplicates boolean;
begin
  select exists (
    select 1
    from public.produtos
    where public.normalize_name(nome) is not null
      and ativo = true
    group by empresa_id, public.normalize_name(nome)
    having count(*) > 1
  ) into has_duplicates;

  if has_duplicates then
    raise notice 'Duplicate prevention skipped: active produtos name duplicates exist. Run docs/duplicidades-encontradas.md diagnostics.';
  else
    create unique index if not exists produtos_empresa_nome_ativo_normalizado_unique_idx
      on public.produtos (empresa_id, public.normalize_name(nome))
      where public.normalize_name(nome) is not null
        and ativo = true;
  end if;
end $$;

do $$
declare
  has_duplicates boolean;
begin
  select exists (
    select 1
    from public.employee_invitations
    where public.normalize_email(email) is not null
      and status = 'pendente'
    group by empresa_id, public.normalize_email(email)
    having count(*) > 1
  ) into has_duplicates;

  if has_duplicates then
    raise notice 'Duplicate prevention skipped: pending employee invitation e-mail duplicates exist. Run docs/duplicidades-encontradas.md diagnostics.';
  else
    create unique index if not exists employee_invitations_empresa_email_pendente_unique_idx
      on public.employee_invitations (empresa_id, public.normalize_email(email))
      where public.normalize_email(email) is not null
        and status = 'pendente';
  end if;
end $$;

create index if not exists appointments_empresa_barbeiro_active_range_idx
  on public.appointments (empresa_id, barbeiro_id, starts_at, ends_at)
  where status in ('agendado', 'confirmado', 'em_atendimento');

create index if not exists atendimentos_empresa_barbeiro_active_range_idx
  on public.atendimentos (empresa_id, barbeiro_id, data_hora_inicio, data_hora_fim)
  where status in ('agendado', 'confirmado', 'em_atendimento');

notify pgrst, 'reload schema';
