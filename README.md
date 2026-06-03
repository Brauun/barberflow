# BarberFlow SaaS

Arquitetura inicial do BarberFlow, preparada para evoluir como SaaS com React,
TypeScript, Vite, Tailwind CSS, React Router, React Hook Form, Zod, TanStack
Query e Supabase.

## Requisitos

- Node.js
- npm

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Variaveis de ambiente

Crie um arquivo `.env` com base em `.env.example`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Estrutura

```text
src/
  components/
  contexts/
  hooks/
  layouts/
  lib/
  pages/
  routes/
  services/
  types/
  utils/
```

## Fundacao configurada

- `src/contexts/AppProviders.tsx`: providers globais da aplicacao.
- `src/contexts/AuthContext.tsx`: estado de sessao e perfil autenticado.
- `src/routes/AppRouter.tsx`: roteamento principal.
- `src/layouts/RootLayout.tsx`: layout raiz.
- `src/lib/queryClient.ts`: cliente do TanStack Query.
- `src/lib/supabase.ts`: cliente Supabase.
- `src/types/database.ts`: placeholder para tipos gerados do Supabase.

## Autenticacao

Rotas disponiveis:

```text
/login
/cadastro
/recuperar-senha
/perfil
/logout
```

O cadastro usa Supabase Auth e a funcao SQL
`public.criar_empresa_com_usuario` para criar a empresa e vincular o primeiro
usuario. A migration esta em `supabase/migrations`.

## Layout principal

A area autenticada usa o layout `src/layouts/AppLayout.tsx`, com sidebar,
header superior, menu responsivo, dark mode e navegacao principal:

```text
/app/dashboard
/app/clientes
/app/barbeiros
/app/servicos
/app/atendimentos
/app/produtos
/app/fluxo-de-caixa
/app/contas-a-pagar
/app/relatorios
/app/configuracoes
```

Componentes reutilizaveis ficam em `src/components/ui`:

```text
Button
Input
Select
Modal
Card
Table
Badge
```

## Dashboard

O Dashboard em `src/pages/DashboardPage.tsx` busca dados do Supabase usando o
`empresa_id` do perfil autenticado e respeita as policies de RLS. Os calculos
ficam em `src/services/dashboardService.ts`.

Cards exibidos:

```text
Faturamento Hoje
Faturamento da Semana
Faturamento do Mes
Lucro Liquido
Clientes Ativos
Servicos Realizados
Produtos Vendidos
Comissoes do Mes
```

Tambem exibe grafico financeiro mensal, ultimos atendimentos e alertas de
contas a pagar proximas do vencimento. Como o schema atual ainda nao possui
itens de venda, Produtos Vendidos usa movimentacoes financeiras confirmadas com
categoria contendo `produto`.

## Clientes

O modulo de Clientes fica em `src/pages/ClientesPage.tsx` e usa
`src/services/clientesService.ts` para acessar o Supabase sempre filtrando por
`empresa_id`.

Funcionalidades:

```text
Listar clientes
Cadastrar cliente
Editar cliente
Excluir cliente
Pesquisar por nome ou telefone
Ver historico de atendimentos
```

## Barbeiros

O modulo de Barbeiros fica em `src/pages/BarbeirosPage.tsx` e usa
`src/services/barbeirosService.ts` para acessar barbeiros, atendimentos e
comissoes sempre filtrando por `empresa_id`.

Funcionalidades:

```text
Listar barbeiros
Cadastrar barbeiro
Editar barbeiro
Excluir barbeiro
Pesquisar por nome ou telefone
Comissao padrao de 60%
Indicadores de atendimentos, faturamento e comissao acumulada
```

## Servicos

O modulo de Servicos fica em `src/pages/ServicosPage.tsx` e usa
`src/services/servicosService.ts` para acessar o Supabase sempre filtrando por
`empresa_id`.

Funcionalidades:

```text
Listar servicos
Cadastrar servico
Editar servico
Excluir servico
Pesquisar por nome
Status ativo/inativo
Validacoes com Zod
```

## Atendimentos

O modulo de Atendimentos fica em `src/pages/AtendimentosPage.tsx` e usa
`src/services/atendimentosService.ts`. O salvamento chama a RPC
`public.registrar_atendimento`, criada em
`supabase/migrations/20260602153000_atendimentos_transactional_flow.sql`.

Ao salvar um atendimento, a funcao SQL executa em transacao:

```text
Registra atendimento
Gera movimentacao financeira de entrada
Calcula comissao de 60% para o barbeiro
Salva comissao pendente
```

Regra financeira:

```text
60% barbeiro
40% empresa
```

## Produtos

O modulo de Produtos fica em `src/pages/ProdutosPage.tsx` e usa
`src/services/produtosService.ts`. As regras de estoque ficam na migration
`supabase/migrations/20260602160000_produtos_stock_flow.sql`.

Funcionalidades:

```text
Listar produtos
Cadastrar produto
Editar produto
Excluir produto
Entrada de estoque
Venda de produto
Baixa automatica de estoque
Venda gera entrada no caixa
Produto nao gera comissao para barbeiro
```

## Fluxo de Caixa

O modulo de Fluxo de Caixa fica em `src/pages/FluxoCaixaPage.tsx` e usa
`src/services/fluxoCaixaService.ts` para acessar movimentacoes financeiras
sempre filtrando por `empresa_id` e periodo.

Funcionalidades:

```text
Registrar entradas e saidas
Categorias separadas por tipo
Filtro por periodo
Total de entradas
Total de saidas
Saldo atual
Lucro liquido
```

## Contas a Pagar

O modulo de Contas a Pagar fica em `src/pages/ContasPagarPage.tsx` e usa
`src/services/contasPagarService.ts`. A acao de marcar como paga usa a RPC
`public.marcar_conta_paga`, criada em
`supabase/migrations/20260602163000_contas_pagar_payment_flow.sql`.

Funcionalidades:

```text
Cadastrar conta
Editar conta
Excluir conta
Marcar como paga
Filtrar por status
Alertar contas proximas ao vencimento
Pagamento gera saida no fluxo de caixa
```

## Relatorios

O modulo de Relatorios fica em `src/pages/RelatoriosPage.tsx` e usa
`src/services/relatoriosService.ts`. Para ranking de produtos vendidos, a
migration `supabase/migrations/20260602170000_relatorios_product_sales.sql`
cria `vendas_produtos` e atualiza a venda de produto para registrar quantidade.

Relatorios:

```text
Diario
Mensal
Anual
Por barbeiro
Financeiro
Produtos
```

Indicadores:

```text
Receita de servicos
Receita de produtos
Despesas
Lucro liquido
Comissoes
Produtos mais vendidos
Barbeiros com maior faturamento
Exportacao PDF
Exportacao Excel
```

## Configuracoes

O modulo de Configuracoes fica em `src/pages/ConfiguracoesPage.tsx` e usa
`src/services/configuracoesService.ts`. A migration
`supabase/migrations/20260602173000_empresa_settings.sql` adiciona endereco,
logo e comissao padrao na tabela `empresas`.

Funcionalidades:

```text
Editar dados da empresa
Alterar comissao padrao
Alterar tema
Gerenciar perfil do usuario
```
