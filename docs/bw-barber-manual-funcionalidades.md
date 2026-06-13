# BW Barber — Manual de Funcionalidades

**Versão:** 1.0  
**Data:** 12 de junho de 2026

Este documento descreve os módulos funcionais do BW Barber com base no código-fonte React, serviços Supabase, tipos TypeScript e permissões por papel.

## Sumário

1. [Autenticação e controle de acesso](#autenticacao-e-controle-de-acesso)
2. [Dashboard](#dashboard)
3. [Clientes](#clientes)
4. [Barbeiros e funcionários](#barbeiros-e-funcionarios)
5. [Serviços](#servicos)
6. [Atendimentos e agenda](#atendimentos-e-agenda)
7. [Produtos](#produtos)
8. [Planos e Fidelidade](#planos-e-fidelidade)
9. [Fluxo de Caixa](#fluxo-de-caixa)
10. [Contas a Pagar](#contas-a-pagar)
11. [Relatórios operacionais e executivos](#relatorios-operacionais-e-executivos)
12. [Configurações](#configuracoes)
13. [Assinatura](#assinatura)
14. [Portal do Cliente](#portal-do-cliente)
15. [Notificações](#notificacoes)

## Autenticação e controle de acesso

### Nome e propósito
Controla login, cadastro, sessão persistente, perfis de barbearia/cliente e permissões por papel no sistema.

### Quem pode acessar
Administrador, gerente, barbeiro, recepção e cliente. Cada papel possui permissões centralizadas em src/auth/permissions.ts.

### Funcionalidades detalhadas
- Login com e-mail ou telefone e senha usando Supabase Auth.
- Cadastro de barbearia com criação de empresa, usuário administrador e assinatura em trial.
- Cadastro de cliente com perfil próprio na tabela profiles.
- Recuperação de senha por e-mail.
- Proteção de rotas para painel da barbearia e portal do cliente.
- Convite de funcionário com aceite seguro e definição da própria senha.
- Sessão persistente com refresh automático de token.

### Integrações
- Supabase Auth
- usuarios
- profiles
- empresas
- employees
- employee_invitations
- barbershop_employee_links

### Regras de negócio
- Administrador gerencia tudo da própria empresa.
- Gerente gerencia operação, equipe e financeiro permitido.
- Barbeiro atua em agenda/atendimentos permitidos, sem criar serviços.
- Recepção acessa clientes, agenda e agendamentos sem financeiro completo.
- Cliente acessa apenas seus dados e seus agendamentos.

## Dashboard

### Nome e propósito
Apresenta visão executiva da barbearia com métricas de faturamento, atendimentos, clientes e receita.

### Quem pode acessar
Administrador, gerente, barbeiro e recepção conforme rota protegida da barbearia.

### Funcionalidades detalhadas
- Cards de receita, atendimentos, ticket médio, lucro e indicadores mensais.
- Gráfico Fluxo de Receita dos últimos seis meses.
- Serviços populares e últimos atendimentos.
- Alertas de contas a pagar próximas do vencimento.
- Processamento de finalizações automáticas pendentes ao carregar.

### Integrações
- dashboardService
- movimentacoes_financeiras
- comissoes
- atendimentos
- contas_pagar

### Regras de negócio
- Receita considera movimentações confirmadas.
- Atendimentos concluídos automaticamente contam como concluídos.
- Contas pagas são refletidas como saídas quando ainda não existe movimentação equivalente.
- Dados são sempre filtrados por empresa_id.

## Clientes

### Nome e propósito
Gerencia a base de clientes da empresa e consolida clientes originados de agendamentos online.

### Quem pode acessar
Administrador, gerente e recepção podem gerenciar. Cliente vê apenas seu próprio perfil no portal.

### Funcionalidades detalhadas
- Listar, pesquisar, criar, editar e excluir clientes.
- Exibir telefone, e-mail, última visita, total gasto e número de visitas.
- Sincronizar clientes vindos de appointments/profiles quando há agendamento.
- Histórico de atendimentos por cliente.

### Integrações
- clientesService
- clientes
- appointments
- profiles
- atendimentos

### Regras de negócio
- Cliente online com appointment pode aparecer na base da empresa.
- Telefone é tratado com máscara na UI e normalizado para dígitos.
- Histórico financeiro considera atendimentos concluídos e concluídos automaticamente.

## Barbeiros e funcionários

### Nome e propósito
Controla funcionários vinculados à barbearia, papéis, comissões, convites e performance.

### Quem pode acessar
Administrador e gerente convidam/gerenciam. Barbeiro acessa apenas suas permissões operacionais.

### Funcionalidades detalhadas
- Listar funcionários ativos e convites.
- Convidar funcionário por e-mail sem criar senha manualmente.
- Aceitar convite e vincular conta à barbearia.
- Editar dados de comissão e vínculo.
- Inativar funcionário preservando histórico.
- Controlar indisponibilidades por data, horário e motivo.
- Indicadores de atendimentos, faturamento e comissão acumulada.

### Integrações
- employeesService
- barbeirosService
- barberUnavailabilityService
- employees
- barbeiros
- barbershop_employee_links
- employee_invitations
- barber_unavailability
- comissoes

### Regras de negócio
- Funcionário não é excluído fisicamente; saída usa status inativo.
- Histórico financeiro, comissões e atendimentos antigos permanecem vinculados.
- Novos serviços criados pelo administrador são vinculados automaticamente aos barbeiros ativos.
- Funcionário inativo não deve receber novos agendamentos.

## Serviços

### Nome e propósito
Mantém o catálogo de serviços da barbearia com preço, duração, comissão e disponibilidade por barbeiro.

### Quem pode acessar
Somente administrador cria, edita, inativa e vincula. Barbeiro e cliente apenas visualizam/selecionam.

### Funcionalidades detalhadas
- Criar, editar, pesquisar e inativar serviços.
- Definir nome, categoria, descrição, preço, duração e comissão padrão.
- Vincular serviços aos barbeiros que executam.
- Vinculação automática de novo serviço a todos os barbeiros ativos.

### Integrações
- servicosService
- servicos
- barber_services
- barbeiros
- clientService

### Regras de negócio
- Serviços pertencem à barbearia, não ao barbeiro.
- Barbeiro não cria, edita, exclui, altera preço ou duração.
- Serviço inativado preserva histórico.
- Cliente só agenda serviços vinculados ao barbeiro escolhido.

## Atendimentos e agenda

### Nome e propósito
Registra atendimentos, agenda diária, status, remarcação, cancelamento, lista de espera e finalização financeira.

### Quem pode acessar
Administrador, gerente, barbeiro e recepção. Cliente gerencia seus próprios agendamentos no portal.

### Funcionalidades detalhadas
- Registrar atendimento manual com cliente, barbeiro, serviço, data, hora, valor e forma de pagamento.
- Consultar atendimentos do dia por data, barbeiro e status.
- Alterar status: agendado, confirmado, em atendimento, finalização pendente, concluído, concluído automático, não compareceu, cancelado e remarcado.
- Remarcar e cancelar horários preservando histórico.
- Gerar entrada financeira e comissão ao concluir.
- Finalizar automaticamente atendimentos esquecidos após prazo configurável.
- Lista de espera com aviso de vaga liberada.

### Integrações
- atendimentosService
- clientService
- appointments
- appointment_items
- appointment_status_logs
- movimentacoes_financeiras
- comissoes
- appointment_waitlist
- notifications

### Regras de negócio
- Cancelados, remarcados e não compareceu não contam como receita ativa.
- Conclusão manual e automática usam fluxo transacional para evitar duplicidade financeira.
- Se não houver ação manual após o fim do atendimento, o status vira finalização pendente e depois concluído automático.
- Correção de conclusão automática pode marcar como concluído ou não compareceu dentro do prazo configurado.
- Ao cancelar, o horário é liberado e a lista de espera pode ser notificada.

## Produtos

### Nome e propósito
Controla produtos, estoque, entradas, vendas e baixa automática de estoque.

### Quem pode acessar
Administrador e gerente gerenciam. Outros papéis podem ter visualização conforme rota protegida.

### Funcionalidades detalhadas
- Cadastrar, editar, excluir e pesquisar produtos.
- Registrar entrada de estoque.
- Registrar venda de produto.
- Baixa automática de estoque na venda.
- Alertas visuais de estoque baixo.

### Integrações
- produtosService
- produtos
- vendas_produtos
- movimentacoes_financeiras

### Regras de negócio
- Venda de produto gera entrada no caixa da empresa.
- Produto não gera comissão para barbeiro.
- Estoque deve ser suficiente para venda.

## Planos e Fidelidade

### Nome e propósito
Permite que a barbearia crie programas próprios de benefício, pacotes, clube, cashback, cupons e fidelidade.

### Quem pode acessar
Disponível conforme feature HAS_LOYALTY. Administração configura; uso aparece nos atendimentos.

### Funcionalidades detalhadas
- Criar programas ativos/inativos com nome, descrição, valor e validade.
- Configurar regras por quantidade, valor gasto, serviço específico, período ou manual.
- Configurar recompensas como serviço grátis, desconto, crédito, brinde ou manual.
- Vincular a todos os clientes, clientes específicos, todos os serviços ou serviços/categorias específicos.
- Acompanhar participantes e histórico de uso.

### Integrações
- benefitsService
- benefit_programs
- benefit_rules
- benefit_rewards
- client_benefits
- benefit_usage_logs
- servicos
- clientes

### Regras de negócio
- Programa pode ser acumulável ou não.
- Uso de benefício não deve duplicar receita.
- Descontos e impacto financeiro devem aparecer nos relatórios.

## Fluxo de Caixa

### Nome e propósito
Centraliza entradas, saídas, saldo atual e lucro líquido por período.

### Quem pode acessar
Administrador e gerente visualizam/gerenciam conforme canViewFinance/canManageFinance.

### Funcionalidades detalhadas
- Listar movimentações financeiras por período.
- Cadastrar entrada ou saída manual.
- Exibir total de entradas, total de saídas, saldo e lucro líquido.
- Incluir contas pagas como saídas sintéticas quando necessário.

### Integrações
- fluxoCaixaService
- movimentacoes_financeiras
- contas_pagar
- atendimentos
- produtos

### Regras de negócio
- Movimentações canceladas não entram nos totais.
- Atendimento concluído gera entrada automaticamente.
- Conta paga é refletida como saída sem duplicar lançamento existente.

## Contas a Pagar

### Nome e propósito
Organiza despesas, vencimentos, pagamentos e status de contas da barbearia.

### Quem pode acessar
Administrador e gerente.

### Funcionalidades detalhadas
- Cadastrar, editar, excluir e filtrar contas por status.
- Marcar conta como paga por RPC segura.
- Exibir pendente, pago, vencido e cancelado.
- Alertar contas próximas do vencimento no dashboard.

### Integrações
- contasPagarService
- contas_pagar
- movimentacoes_financeiras
- dashboardService

### Regras de negócio
- Conta paga alimenta fluxo de caixa e relatórios como saída.
- Dados são filtrados por empresa_id.
- Exclusão/alteração respeita status e vínculo da empresa.

## Relatórios operacionais e executivos

### Nome e propósito
Gera análises financeiras, operacionais e executivas para tomada de decisão.

### Quem pode acessar
Administrador e gerente. Relatórios executivos dependem de feature HAS_EXECUTIVE_REPORTS/BW Pro ou superior.

### Funcionalidades detalhadas
- Filtros por tipo de relatório e período.
- Relatórios diário, mensal, anual, por barbeiro, financeiro e produtos.
- Exportação PDF e Excel.
- Relatórios executivos com score da operação, financeiro, equipe, clientes, agenda, produtos e previsões.
- KPIs de receita de serviços, produtos, despesas, lucro, comissões e ticket médio.

### Integrações
- relatoriosService
- movimentacoes_financeiras
- comissoes
- vendas_produtos
- atendimentos
- clientes
- produtos
- subscriptionsService

### Regras de negócio
- Receita considera concluído e concluído automático.
- Cancelados, remarcados, não compareceu e pendentes não contam como receita.
- PDF executivo é sempre gerado em layout claro/profissional.
- Relatórios avançados podem ser bloqueados por plano.

## Configurações

### Nome e propósito
Parametriza empresa, perfil, tema, localização, horários, automações, backup e auditoria.

### Quem pode acessar
Administrador gerencia configurações e exportações. Usuário pode editar seu perfil quando permitido.

### Funcionalidades detalhadas
- Editar dados da empresa, telefone, e-mail, endereço, logo e comissão padrão.
- Buscar cidade/estado por CEP.
- Alternar tema claro, escuro ou sistema.
- Editar avatar e perfil do usuário.
- Configurar horários de funcionamento por dia da semana.
- Configurar finalização automática de atendimentos.
- Exportar clientes, financeiro, atendimentos, produtos e dados completos.
- Visualizar auditoria de ações sensíveis.

### Integrações
- configuracoesService
- businessHoursService
- backupService
- observabilityService
- assetsService
- cepService
- empresas
- barbershops
- configuracoes
- audit_logs
- Supabase Storage

### Regras de negócio
- Apenas administrador exporta dados.
- Logo e avatar usam buckets dedicados.
- Horários inválidos não devem liberar agenda do cliente.
- Finalização automática padrão recomendada: 1 hora após fim.

## Assinatura

### Nome e propósito
Controla planos internos, trial, recursos disponíveis e limites por plano.

### Quem pode acessar
Administrador e gerente visualizam/gerenciam assinatura.

### Funcionalidades detalhadas
- Exibir plano atual, status da assinatura e dias restantes do trial.
- Listar recursos disponíveis e consumo.
- Escolher plano internamente para testes.
- Comparar BW Start, BW Pro e BW Elite.
- Bloquear funcionalidades por feature quando necessário.

### Integrações
- subscriptionsService
- plans
- subscriptions
- subscription_features
- subscription_usage
- useSubscription
- useFeatureAccess

### Regras de negócio
- Nova barbearia inicia em TRIAL por 14 dias.
- Durante trial libera funcionalidades equivalentes ao BW Pro.
- BW Elite pode ser exibido como indisponível/bloqueado se definido pela UI.
- Sem schema de assinatura, o frontend usa fallback para não quebrar operação.

## Portal do Cliente

### Nome e propósito
Entrega experiência self-service para descobrir barbearias, escolher principal, agendar e acompanhar histórico.

### Quem pode acessar
Cliente autenticado.

### Funcionalidades detalhadas
- Tela inicial com barbearia principal, próximo horário e histórico.
- Busca de barbearias por nome/endereço e favoritos.
- Favoritar/desfavoritar barbearias.
- Definir barbearia principal.
- Ver rota para endereço da barbearia.
- Agendar serviço escolhendo barbeiro, serviço, data e horário disponível.
- Cancelar/remarcar agendamentos próprios.
- Editar perfil e foto do cliente.

### Integrações
- clientService
- profiles
- barbershops
- client_barbershop
- client_favorite_barbershops
- appointments
- appointment_items
- barber_services
- barbershop_business_hours

### Regras de negócio
- Cliente vê apenas próprios agendamentos.
- Horários respeitam funcionamento da barbearia, duração do serviço, conflitos e indisponibilidades.
- Serviços exibidos dependem do barbeiro selecionado.
- Favoritos aparecem antes das demais barbearias.

## Notificações

### Nome e propósito
Informa administradores e barbeiros sobre eventos relevantes dentro do app/web/PWA.

### Quem pode acessar
Administrador e gerente veem notificações gerais da empresa; barbeiro vê as destinadas a ele.

### Funcionalidades detalhadas
- Sino no header com contador de não lidas.
- Painel de notificações com título, mensagem e horário.
- Marcar uma ou todas como lidas.
- Criar notificações para agendamento criado, cancelado, remarcado, lista de espera, vaga liberada e finalização pendente.

### Integrações
- notificationsService
- notifications
- appointments
- appointment_waitlist

### Regras de negócio
- Notificações são filtradas por empresa_id.
- Admin/gerente veem notificações amplas.
- Barbeiro sem usuário vinculado não recebe notificação individual; administradores ainda são notificados.
- Eventos externos de WhatsApp ficam preparados em notification_logs quando aplicável.

## Matriz resumida de permissões

| Ação | Administrador | Gerente | Barbeiro | Recepção | Cliente |
| --- | --- | --- | --- | --- | --- |
| Gerenciar serviços | Sim | Não | Não | Não | Visualiza disponíveis |
| Ver financeiro | Sim | Sim | Não | Não | Não |
| Gerenciar financeiro | Sim | Sim | Não | Não | Não |
| Convidar funcionários | Sim | Sim | Não | Não | Não |
| Exportar dados | Sim | Não | Não | Não | Não |
| Gerenciar configurações | Sim | Não | Não | Não | Perfil próprio |
| Gerenciar atendimentos | Sim | Sim | Sim | Sim | Próprios agendamentos |
| Ver relatórios | Sim | Sim | Não | Não | Não |
