alter table public.empresas
  add column if not exists tipo_pessoa text,
  add column if not exists cpf_cnpj text,
  add column if not exists razao_social text,
  add column if not exists nome_fantasia text,
  add column if not exists email_financeiro text,
  add column if not exists logradouro text,
  add column if not exists uf text,
  add column if not exists responsavel_nome text,
  add column if not exists aceite_termos_at timestamptz,
  add column if not exists cep text,
  add column if not exists rua text,
  add column if not exists numero text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists complemento text,
  add column if not exists responsavel_cpf text;

alter table public.barbershops
  add column if not exists tipo_pessoa text,
  add column if not exists cpf_cnpj text,
  add column if not exists razao_social text,
  add column if not exists nome_fantasia text,
  add column if not exists email_financeiro text,
  add column if not exists logradouro text,
  add column if not exists uf text,
  add column if not exists responsavel_nome text,
  add column if not exists responsavel_cpf text,
  add column if not exists aceite_termos_at timestamptz,
  add column if not exists cep text,
  add column if not exists rua text,
  add column if not exists numero text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists complemento text;

comment on column public.empresas.tipo_pessoa is
  'Tipo fiscal da empresa: pf ou pj.';
comment on column public.empresas.cpf_cnpj is
  'CPF ou CNPJ usado para cobranca e futura emissao fiscal.';
comment on column public.empresas.aceite_termos_at is
  'Data e hora do aceite de termos no cadastro da barbearia.';
