# Auditoria RLS e Segurança Real - BW Barber

Data: 2026-06-11

## Falhas encontradas

- Policies antigas `FOR ALL` por `empresa_id` ainda estavam ativas em tabelas sensiveis. Como o PostgreSQL combina policies por OR, elas permitiam que qualquer usuario ativo da empresa manipulasse clientes, barbeiros, atendimentos, produtos, financeiro, contas, comissoes e configuracoes.
- `usuarios_update_gestao_ou_proprio` permitia autoedicao sem preservar campos sensiveis. Um usuario poderia tentar alterar `papel`, `status` ou vinculo caso manipulasse a request.
- `empresas_insert_autenticado` permitia insert direto de empresa por qualquer usuario autenticado, fora do fluxo oficial de cadastro.
- Atualizacoes de `appointments` por cliente/barbeiro tinham isolamento por linha, mas nao impediam tentativa manual de alterar campos financeiros ou vinculos do agendamento.
- `empresas_location_update_own_company` permitia que qualquer usuario vinculado atualizasse dados da empresa/localizacao.
- `appointments`, `appointment_items`, `appointment_status_logs`, `appointment_waitlist`, `notifications` e `notification_logs` tinham trechos com permissao ampla para qualquer usuario autenticado ou qualquer usuario da empresa.
- `appointments_client_booking_availability_select` permitia leitura de agendamentos por qualquer cliente em barbearias ativas, o que expunha dados alem dos proprios horarios do cliente.
- `employees` permitia insert direto com `with check (true)`, contrariando o fluxo oficial por convite.
- `vendas_produtos` e o RPC `registrar_venda_produto` aceitavam qualquer usuario da empresa, afetando estoque e caixa.
- Regras de beneficios/fidelidade estavam amplas por empresa e permitiam manipulacao comercial por papeis sem permissao de gestao.

## Correcoes aplicadas

Migration: `supabase/migrations/20260611113000_harden_rls_access_boundaries.sql`

- Adicionados helpers seguros:
  - `is_uuid`
  - `current_usuario_id`
  - `usuario_self_update_safe`
  - `employee_self_update_safe`
  - `is_current_barbeiro`
  - `can_access_appointment`
  - `can_access_atendimento`
- Removidas policies amplas `*_empresa_isolada` das tabelas criticas.
- Financeiro, produtos, contas a pagar, comissoes, configuracoes, vendas de produto e descontos agora exigem `administrador` ou `gerente`, com excecao de barbeiro visualizando as proprias comissoes.
- Cliente fica limitado ao proprio perfil, proprios agendamentos, propria lista de espera, favoritos e vinculo com barbearia ativa.
- A leitura aberta de `appointments` para disponibilidade foi removida. A disponibilidade deve ser consumida por slots calculados/RPC, sem expor linhas de outros clientes.
- Criada a RPC `get_booking_busy_slots`, que retorna somente `starts_at` e `ends_at` ocupados para o calculo de agenda.
- Criada trigger `appointments_enforce_limited_update` para impedir que cliente/barbeiro altere empresa, cliente, barbeiro, valores, descontos e demais campos sensiveis do agendamento.
- Insert direto em `empresas` foi bloqueado; criacao deve ocorrer pelo fluxo oficial/RPC de cadastro.
- Barbeiro fica limitado aos atendimentos/agendamentos vinculados ao proprio registro.
- Funcionarios passam a ser criados apenas via RPC/convite; insert direto em `employees` foi bloqueado.
- Convites de funcionario ficam visiveis para admin/gerente ou por token pendente valido.
- Notificacoes internas e logs de WhatsApp deixam de aceitar insert arbitrario de qualquer autenticado.
- Logs de auditoria/erro com `empresa_id` agora exigem vinculo real com a empresa.
- `registrar_atendimento` passa a exigir `administrador`, `gerente` ou `recepcao`.

## Policies principais apos hardening

- `usuarios_select_por_permissao`
- `usuarios_update_gestao_ou_proprio_seguro`
- `clientes_select_operacao_ou_barbeiro`
- `barbeiros_select_empresa`
- `atendimentos_select_operacao_ou_barbeiro`
- `produtos_*_gestao`
- `movimentacoes_financeiras_*_gestao`
- `contas_pagar_*_gestao`
- `comissoes_select_gestao_ou_barbeiro`
- `appointments_*_por_vinculo`
- `appointment_waitlist_*_por_vinculo`
- `employees_select_gestao_ou_proprio`
- `employees_no_direct_insert`
- `notifications_insert_empresa_ou_cliente_evento`

## Checklist de validacao manual

Use contas reais ou seeds controladas:

- Empresa A: admin, gerente, recepcao, barbeiro.
- Empresa B: admin e pelo menos um cliente/atendimento.
- Cliente A vinculado a Empresa A.
- Cliente B vinculado a Empresa B.

### Isolamento por empresa

- Admin da Empresa A nao deve listar `clientes`, `atendimentos`, `produtos`, `movimentacoes_financeiras`, `contas_pagar` ou `comissoes` da Empresa B.
- Admin da Empresa A nao deve conseguir atualizar `empresas.id = Empresa B`.
- Queries sem `.eq('empresa_id', empresaA)` nao devem retornar dados da Empresa B por causa de RLS.

### Cliente

- Cliente A deve ver apenas `profiles` proprio.
- Cliente A deve ver apenas seus `appointments`.
- Cliente A deve conseguir criar favorito apenas para barbearia ativa.
- Cliente A nao deve conseguir `select` em `movimentacoes_financeiras`, `contas_pagar`, `comissoes`, `produtos`, `clientes` ou `usuarios`.
- Cliente A nao deve conseguir inserir `notification_logs` para outro `client_id`.

### Barbeiro

- Barbeiro deve ver apenas `appointments`/`atendimentos` onde `barbeiro_id` pertence ao proprio usuario.
- Barbeiro nao deve conseguir inserir, atualizar ou deletar `servicos`.
- Barbeiro nao deve conseguir inserir em `movimentacoes_financeiras`, `contas_pagar`, `produtos` ou `vendas_produtos`.
- Barbeiro nao deve conseguir atualizar `usuarios.papel` para `administrador`.

### Admin/Gerente/Recepcao

- Admin e gerente devem gerenciar dados da propria empresa.
- Recepcao deve operar clientes/agenda, mas nao financeiro completo.
- Admin/gerente devem conseguir criar convite de funcionario apenas para a propria empresa.
- Insert direto em `employees` deve falhar; convite via `create_employee_invitation` deve funcionar.

### Servicos

- Admin/gerente devem criar/editar/inativar servicos.
- Barbeiro deve apenas visualizar/usar servicos permitidos.
- Manipulacao manual via Supabase REST como barbeiro deve retornar bloqueio de RLS.

### Storage

- `company-assets`: upload/troca de logo apenas por admin/gerente da propria empresa.
- `user-avatars`: usuario pode trocar o proprio avatar; admin da empresa pode trocar avatar de funcionario vinculado.
- Confirmar se buckets privados geram URLs assinadas quando necessario. Se forem publicos, validar se isso foi uma decisao consciente do produto.

## Queries de ataque para testar no SQL/API

Substitua os IDs pelos valores reais e execute usando tokens de usuarios diferentes via Supabase client, PostgREST ou painel local:

```sql
-- Como cliente: deve retornar 0 linhas
select * from public.movimentacoes_financeiras;

-- Como barbeiro: deve falhar por RLS
insert into public.servicos (empresa_id, nome, preco, duracao_minutos, ativo)
values ('EMPRESA_A', 'Servico indevido', 10, 30, true);

-- Como admin da Empresa A tentando acessar Empresa B: deve retornar 0 linhas
select * from public.clientes where empresa_id = 'EMPRESA_B';

-- Como barbeiro tentando se promover: deve falhar ou manter papel original
update public.usuarios
set papel = 'administrador'
where auth_user_id = auth.uid();

-- Como cliente/barbeiro tentando alterar valor do agendamento: deve falhar
update public.appointments
set valor_final = 0
where id = 'APPOINTMENT_PROPRIO';

-- Como qualquer autenticado tentando criar employee direto: deve falhar
insert into public.employees (nome, email, status)
values ('Teste Direto', 'teste-direto@example.com', 'ativo');

-- Como qualquer autenticado tentando criar empresa fora do cadastro oficial: deve falhar
insert into public.empresas (nome, email)
values ('Empresa indevida', 'indevida@example.com');

-- Como cliente tentando log de notificacao de outro cliente: deve falhar
insert into public.notification_logs (empresa_id, client_id, channel, type, message)
values ('EMPRESA_A', 'CLIENT_PROFILE_DE_OUTRA_PESSOA', 'whatsapp', 'teste', 'tentativa indevida');
```

## Riscos restantes

- A auditoria foi estatica no reposititorio; a migration precisa ser aplicada no Supabase e validada com tokens reais.
- Algumas tabelas de assinatura/planos e storage dependem de configuracao operacional do projeto Supabase. Conferir no painel se os buckets estao privados/publicos conforme esperado.
- Notificacoes criadas pelo cliente dependem de `metadata.appointmentId` ou `metadata.waitlistId` valido. Se algum fluxo futuro usar outro formato, sera necessario criar uma RPC server-side para notificacao.
- Se alguma nova tela de agendamento voltar a depender de `select * from appointments` para disponibilidade, migrar para uma RPC/view sanitizada como `get_booking_busy_slots`.
- Policies antigas nao listadas nesta auditoria devem ser reavaliadas sempre que novos modulos forem criados.
