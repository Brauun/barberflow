create or replace function public.marcar_conta_paga(
  p_empresa_id uuid,
  p_conta_id uuid
)
returns public.contas_pagar
language plpgsql
security definer
set search_path = public
as $$
declare
  conta_atual public.contas_pagar;
  conta_atualizada public.contas_pagar;
begin
  if not public.belongs_to_empresa(p_empresa_id) then
    raise exception 'Empresa invalida para o usuario autenticado.';
  end if;

  select *
  into conta_atual
  from public.contas_pagar
  where id = p_conta_id
    and empresa_id = p_empresa_id
  for update;

  if conta_atual.id is null then
    raise exception 'Conta nao encontrada.';
  end if;

  if conta_atual.status = 'paga' then
    return conta_atual;
  end if;

  update public.contas_pagar
  set status = 'paga',
      data_pagamento = current_date
  where id = p_conta_id
    and empresa_id = p_empresa_id
  returning * into conta_atualizada;

  insert into public.movimentacoes_financeiras (
    empresa_id,
    tipo,
    categoria,
    descricao,
    valor,
    data_movimentacao,
    status
  )
  values (
    p_empresa_id,
    'saida',
    coalesce(conta_atual.categoria, 'Contas a Pagar'),
    'Pagamento - ' || conta_atual.descricao,
    conta_atual.valor,
    current_date,
    'confirmada'
  );

  return conta_atualizada;
end;
$$;

revoke all on function public.marcar_conta_paga(uuid, uuid)
from public;

grant execute on function public.marcar_conta_paga(uuid, uuid)
to authenticated;
