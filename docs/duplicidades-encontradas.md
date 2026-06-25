# BW Barber - Diagnostico de Duplicidades

Este arquivo reune as queries para auditar duplicidades antes de aplicar ou validar
as constraints de prevencao. Nao apague registros automaticamente: quando houver
resultado, avalie merge, inativacao ou correcao manual.

## Clientes

### Telefone normalizado por empresa

```sql
select
  empresa_id,
  public.normalize_digits(telefone) as telefone_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids,
  array_agg(nome order by created_at) as nomes
from public.clientes
where public.normalize_digits(telefone) is not null
group by empresa_id, public.normalize_digits(telefone)
having count(*) > 1;
```

### E-mail lowercase por empresa

```sql
select
  empresa_id,
  public.normalize_email(email) as email_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids,
  array_agg(nome order by created_at) as nomes
from public.clientes
where public.normalize_email(email) is not null
group by empresa_id, public.normalize_email(email)
having count(*) > 1;
```

### Nome + telefone por empresa

```sql
select
  empresa_id,
  public.normalize_name(nome) as nome_normalizado,
  public.normalize_digits(telefone) as telefone_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids
from public.clientes
where public.normalize_name(nome) is not null
  and public.normalize_digits(telefone) is not null
group by empresa_id, public.normalize_name(nome), public.normalize_digits(telefone)
having count(*) > 1;
```

### CPF por empresa, se existir coluna cpf

```sql
select
  empresa_id,
  public.normalize_digits(cpf) as cpf_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids
from public.clientes
where public.normalize_digits(cpf) is not null
group by empresa_id, public.normalize_digits(cpf)
having count(*) > 1;
```

## Perfis de cliente

### Telefone normalizado em profiles

```sql
select
  public.normalize_digits(telefone) as telefone_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids,
  array_agg(nome order by created_at) as nomes
from public.profiles
where role = 'cliente'
  and public.normalize_digits(telefone) is not null
group by public.normalize_digits(telefone)
having count(*) > 1;
```

### E-mail lowercase em profiles

```sql
select
  public.normalize_email(email) as email_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids,
  array_agg(nome order by created_at) as nomes
from public.profiles
where role = 'cliente'
  and public.normalize_email(email) is not null
group by public.normalize_email(email)
having count(*) > 1;
```

## Empresas e barbearias

### CPF/CNPJ normalizado em empresas

```sql
select
  public.normalize_digits(cpf_cnpj) as documento_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids,
  array_agg(nome order by created_at) as nomes
from public.empresas
where public.normalize_digits(cpf_cnpj) is not null
group by public.normalize_digits(cpf_cnpj)
having count(*) > 1;
```

### CPF/CNPJ normalizado em barbershops

```sql
select
  public.normalize_digits(cpf_cnpj) as documento_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids,
  array_agg(nome order by created_at) as nomes
from public.barbershops
where public.normalize_digits(cpf_cnpj) is not null
group by public.normalize_digits(cpf_cnpj)
having count(*) > 1;
```

### E-mail financeiro lowercase

```sql
select
  public.normalize_email(email_financeiro) as email_financeiro_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids,
  array_agg(nome order by created_at) as nomes
from public.empresas
where public.normalize_email(email_financeiro) is not null
group by public.normalize_email(email_financeiro)
having count(*) > 1;
```

### Telefone normalizado

```sql
select
  public.normalize_digits(telefone) as telefone_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids,
  array_agg(nome order by created_at) as nomes
from public.empresas
where public.normalize_digits(telefone) is not null
group by public.normalize_digits(telefone)
having count(*) > 1;
```

## Servicos

### Nome lowercase por empresa

```sql
select
  empresa_id,
  public.normalize_name(nome) as nome_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids,
  array_agg(nome order by created_at) as nomes
from public.servicos
where public.normalize_name(nome) is not null
  and ativo = true
  and coalesce(status, 'ativo') <> 'inativo'
group by empresa_id, public.normalize_name(nome)
having count(*) > 1;
```

## Produtos

### SKU por empresa

```sql
select
  empresa_id,
  public.normalize_name(sku) as sku_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids,
  array_agg(nome order by created_at) as nomes
from public.produtos
where public.normalize_name(sku) is not null
group by empresa_id, public.normalize_name(sku)
having count(*) > 1;
```

### Nome lowercase por empresa

```sql
select
  empresa_id,
  public.normalize_name(nome) as nome_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids,
  array_agg(nome order by created_at) as nomes
from public.produtos
where public.normalize_name(nome) is not null
  and ativo = true
group by empresa_id, public.normalize_name(nome)
having count(*) > 1;
```

## Convites de funcionarios

### Mesmo e-mail pendente na mesma empresa

```sql
select
  empresa_id,
  public.normalize_email(email) as email_normalizado,
  count(*) as quantidade,
  array_agg(id order by created_at) as ids,
  array_agg(nome order by created_at) as nomes
from public.employee_invitations
where status = 'pendente'
  and public.normalize_email(email) is not null
group by empresa_id, public.normalize_email(email)
having count(*) > 1;
```

## Agendamentos e atendimentos

### Conflitos entre appointments

```sql
select
  a.empresa_id,
  a.barbeiro_id,
  a.id as appointment_a,
  b.id as appointment_b,
  a.starts_at as a_inicio,
  a.ends_at as a_fim,
  b.starts_at as b_inicio,
  b.ends_at as b_fim
from public.appointments a
join public.appointments b
  on b.empresa_id = a.empresa_id
 and b.barbeiro_id = a.barbeiro_id
 and b.id > a.id
 and b.starts_at < a.ends_at
 and b.ends_at > a.starts_at
where a.status in ('agendado', 'confirmado', 'em_atendimento')
  and b.status in ('agendado', 'confirmado', 'em_atendimento');
```

### Conflitos entre appointments e atendimentos

```sql
select
  a.empresa_id,
  a.barbeiro_id,
  a.id as appointment_id,
  t.id as atendimento_id,
  a.starts_at,
  a.ends_at,
  t.data_hora_inicio,
  coalesce(t.data_hora_fim, t.data_hora_inicio + interval '30 minutes') as data_hora_fim
from public.appointments a
join public.atendimentos t
  on t.empresa_id = a.empresa_id
 and t.barbeiro_id = a.barbeiro_id
 and t.data_hora_inicio < a.ends_at
 and coalesce(t.data_hora_fim, t.data_hora_inicio + interval '30 minutes') > a.starts_at
where a.status in ('agendado', 'confirmado', 'em_atendimento')
  and t.status in ('agendado', 'confirmado', 'em_atendimento');
```

## Recomendacao de correcao manual

- Clientes duplicados: manter o registro com maior historico e migrar observacoes/agendamentos manualmente antes de inativar o duplicado.
- Empresas duplicadas: validar CPF/CNPJ com o responsavel antes de qualquer merge.
- Servicos/produtos duplicados: inativar o duplicado sem remover historico.
- Convites pendentes repetidos: cancelar os convites antigos e manter somente o mais recente.
- Conflitos de agenda: cancelar/remarcar manualmente um dos registros antes de reforcar constraints mais rigidas.
