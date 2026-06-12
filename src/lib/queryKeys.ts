export const queryKeys = {
  appointments: {
    all: ['appointments'] as const,
  },
  atendimentos: {
    all: ['atendimentos'] as const,
  },
  assinatura: {
    detail: (empresaId: string | undefined) => ['subscription', empresaId] as const,
  },
  auth: {
    all: ['auth'] as const,
  },
  barbeiros: {
    all: ['barbeiros'] as const,
    list: (empresaId: string | undefined, search: string) =>
      ['barbeiros', empresaId, search] as const,
  },
  clientes: {
    all: ['clientes'] as const,
    historico: (empresaId: string | undefined, clienteId: string | undefined) =>
      ['clientes-historico', empresaId, clienteId] as const,
    list: (empresaId: string | undefined, search: string) =>
      ['clientes', empresaId, search] as const,
  },
  configuracoes: {
    all: ['configuracoes'] as const,
    auditLogsAll: ['audit-logs'] as const,
    auditLogs: (empresaId: string | undefined) => ['audit-logs', empresaId] as const,
  },
  contasPagar: {
    all: ['contas-pagar'] as const,
    list: (empresaId: string | undefined, status: string) =>
      ['contas-pagar', empresaId, status] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
  },
  employees: {
    all: ['employees'] as const,
  },
  empresa: {
    all: ['empresa'] as const,
  },
  financeiro: {
    all: ['financeiro'] as const,
    fluxoCaixa: ['fluxo-caixa'] as const,
  },
  notificacoes: {
    all: ['notifications'] as const,
  },
  relatorios: {
    all: ['relatorios'] as const,
  },
  servicos: {
    all: ['servicos'] as const,
    barbeiros: (empresaId: string | undefined) =>
      ['service-barbers', empresaId] as const,
    barbeiroLinks: (empresaId: string | undefined, servicoId: string | undefined) =>
      ['service-barber-links', empresaId, servicoId] as const,
    booking: ['booking-services'] as const,
    list: (empresaId: string | undefined, search: string) =>
      ['servicos', empresaId, search] as const,
  },
}
