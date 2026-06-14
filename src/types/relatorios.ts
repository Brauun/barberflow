export type RelatorioTipo =
  | 'diario'
  | 'mensal'
  | 'anual'
  | 'barbeiro'
  | 'financeiro'
  | 'produtos'
  | 'clientes'
  | 'agenda'

export type RelatorioFilters = {
  dataInicio: string
  dataFim: string
  tipo: RelatorioTipo
}
