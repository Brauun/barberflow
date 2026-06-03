export type RelatorioTipo =
  | 'diario'
  | 'mensal'
  | 'anual'
  | 'barbeiro'
  | 'financeiro'
  | 'produtos'

export type RelatorioFilters = {
  dataInicio: string
  dataFim: string
  tipo: RelatorioTipo
}
