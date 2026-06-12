# Checklist de Segurança, Backup e Observabilidade

Use este checklist antes de liberar testes reais do BW Barber.

## Segurança

- [ ] Cliente A não visualiza dados de Cliente B.
- [ ] Empresa A não visualiza clientes, agenda, financeiro, funcionários ou relatórios da Empresa B.
- [ ] Barbeiro não consegue criar, editar, excluir ou alterar preço de serviços.
- [ ] Barbeiro não visualiza módulos financeiros completos.
- [ ] Recepção não visualiza módulos financeiros completos.
- [ ] Funcionário inativo não aparece para novos agendamentos.
- [ ] Cliente não acessa rotas `/app/*` da barbearia.
- [ ] Admin/Gerente acessam somente a própria empresa.
- [ ] Convites de funcionário expiram e não podem ser aceitos depois do prazo.
- [ ] Uploads de avatar/logo aceitam apenas imagens e não expõem dados sensíveis.
- [ ] Nenhuma service role key está no frontend.
- [ ] `.env` não está versionado em novos commits.

## Backup e Exportação

- [ ] Admin consegue exportar clientes em CSV.
- [ ] Admin consegue exportar financeiro em CSV.
- [ ] Admin consegue exportar atendimentos em CSV.
- [ ] Admin consegue exportar produtos em CSV.
- [ ] Admin consegue exportar relatório completo da empresa em JSON.
- [ ] Arquivos exportados contêm apenas dados da empresa logada.
- [ ] Exportações não incluem senhas, tokens de convite ou chaves sensíveis.
- [ ] Nome do arquivo exportado contém `BW-Barber` e a data atual.
- [ ] Usuários não admin não visualizam área de backup/exportação.

## Auditoria

- [ ] Login gera registro em `audit_logs`.
- [ ] Logout gera registro em `audit_logs`.
- [ ] Convite de funcionário gera registro em `audit_logs`.
- [ ] Inativação de funcionário gera registro em `audit_logs`.
- [ ] Criação/edição/inativação de serviço gera registro em `audit_logs`.
- [ ] Alteração de dados da empresa gera registro em `audit_logs`.
- [ ] Cancelamento de atendimento gera registro em `audit_logs`.
- [ ] Remarcação de atendimento gera registro em `audit_logs`.
- [ ] Conclusão de atendimento gera registro em `audit_logs`.
- [ ] Não comparecimento gera registro em `audit_logs`.
- [ ] Desconto aplicado gera registro em `audit_logs`.
- [ ] Movimentação financeira criada gera registro em `audit_logs`.
- [ ] Despesa criada gera registro em `audit_logs`.
- [ ] Exportação de dados gera registro em `audit_logs`.
- [ ] Somente Admin visualiza a área de Auditoria.

## Erros

- [ ] Erros de login mostram mensagem amigável.
- [ ] Erros de exportação mostram mensagem amigável.
- [ ] Erros de Supabase são registrados em `error_logs` quando houver sessão.
- [ ] Em produção, stack trace não aparece para o usuário final.
