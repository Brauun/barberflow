import { useQuery } from '@tanstack/react-query'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { getRelatorioData } from '../services/relatoriosService'
import type { RelatorioTipo } from '../types/relatorios'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartInputValue() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
}

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`
}

export function RelatoriosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const reportRef = useRef<HTMLDivElement>(null)
  const [tipo, setTipo] = useState<RelatorioTipo>('mensal')
  const [dataInicio, setDataInicio] = useState(monthStartInputValue())
  const [dataFim, setDataFim] = useState(todayInputValue())

  const { data, error, isLoading } = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => getRelatorioData(empresaId as string, dataInicio, dataFim),
    queryKey: ['relatorios', empresaId, dataInicio, dataFim, tipo],
  })

  const reportTitle = useMemo(() => {
    const labels: Record<RelatorioTipo, string> = {
      anual: 'Relatório Anual',
      barbeiro: 'Relatório por Barbeiro',
      diario: 'Relatório Diário',
      financeiro: 'Relatório Financeiro',
      mensal: 'Relatório Mensal',
      produtos: 'Relatório de Produtos',
    }

    return labels[tipo]
  }, [tipo])

  function exportPdf() {
    window.print()
  }

  function exportExcel() {
    if (!data) {
      return
    }

    const rows = [
      ['Relatório', reportTitle],
      ['Período', `${dataInicio} até ${dataFim}`],
      [],
      ['Indicador', 'Valor'],
      ['Receita de serviços', data.summary.receitaServicos],
      ['Receita de produtos', data.summary.receitaProdutos],
      ['Despesas', data.summary.despesas],
      ['Lucro líquido', data.summary.lucroLiquido],
      ['Comissões', data.summary.comissoes],
      [],
      ['Produtos mais vendidos'],
      ['Produto', 'Quantidade', 'Valor total'],
      ...data.topProducts.map((product) => [
        product.nome,
        product.quantidade,
        product.valorTotal,
      ]),
      [],
      ['Barbeiros com maior faturamento'],
      ['Barbeiro', 'Atendimentos', 'Faturamento'],
      ...data.topBarbers.map((barber) => [
        barber.nome,
        barber.atendimentos,
        barber.faturamento,
      ]),
    ]

    const csv = rows
      .map((row) => row.map((cell) => escapeCsv(cell ?? '')).join(';'))
      .join('\n')
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `barberflow-${tipo}-${dataInicio}-${dataFim}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para visualizar
            relatórios.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-400">
            Relatórios
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
            Análises do BarberFlow
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Consulte relatórios diário, mensal, anual, por barbeiro, financeiro
            e produtos com filtro por período.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            leftIcon={<FileText size={18} />}
            onClick={exportPdf}
            variant="secondary"
          >
            Exportar PDF
          </Button>
          <Button
            leftIcon={<FileSpreadsheet size={18} />}
            onClick={exportExcel}
            variant="secondary"
          >
            Exportar Excel
          </Button>
        </div>
      </section>

      <Card className="print:hidden">
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <Select
              label="Tipo de relatório"
              onChange={(event) => setTipo(event.target.value as RelatorioTipo)}
              options={[
                { label: 'Diário', value: 'diario' },
                { label: 'Mensal', value: 'mensal' },
                { label: 'Anual', value: 'anual' },
                { label: 'Por barbeiro', value: 'barbeiro' },
                { label: 'Financeiro', value: 'financeiro' },
                { label: 'Produtos', value: 'produtos' },
              ]}
              value={tipo}
            />
            <Input
              label="Data inicial"
              onChange={(event) => setDataInicio(event.target.value)}
              type="date"
              value={dataInicio}
            />
            <Input
              label="Data final"
              onChange={(event) => setDataFim(event.target.value)}
              type="date"
              value={dataFim}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent>
            <p className="text-sm text-red-600">{error.message}</p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex min-h-80 items-center justify-center">
          <Loader2 className="animate-spin text-brand-500" size={28} />
        </div>
      ) : data ? (
        <div className="space-y-6" ref={reportRef}>
          <section className="hidden print:block">
            <h1 className="text-2xl font-semibold">{reportTitle}</h1>
            <p className="mt-1 text-sm">
              Período: {dataInicio} até {dataFim}
            </p>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                {reportTitle}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {dataInicio} até {dataFim}
              </p>
            </div>
            <Badge variant="warning">Período filtrado</Badge>
          </section>

          <section className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Receita de serviços
                </p>
                <p className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {currencyFormatter.format(data.summary.receitaServicos)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Receita de produtos
                </p>
                <p className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {currencyFormatter.format(data.summary.receitaProdutos)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Despesas
                </p>
                <p className="mt-2 text-xl font-semibold text-red-600 dark:text-red-400">
                  {currencyFormatter.format(data.summary.despesas)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Lucro líquido
                </p>
                <p className="mt-2 text-xl font-semibold text-brand-600 dark:text-brand-400">
                  {currencyFormatter.format(data.summary.lucroLiquido)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Comissões
                </p>
                <p className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {currencyFormatter.format(data.summary.comissoes)}
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  Produtos mais vendidos
                </h3>
              </CardHeader>
              <CardContent className="p-0">
                {data.topProducts.length === 0 ? (
                  <div className="p-5 text-sm text-zinc-500 dark:text-zinc-400">
                    Nenhuma venda de produto no período.
                  </div>
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Produto</TableHeaderCell>
                        <TableHeaderCell>Quantidade</TableHeaderCell>
                        <TableHeaderCell>Valor total</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.topProducts.map((product) => (
                        <TableRow key={product.nome}>
                          <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                            {product.nome}
                          </TableCell>
                          <TableCell>{product.quantidade}</TableCell>
                          <TableCell>
                            {currencyFormatter.format(product.valorTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  Barbeiros com maior faturamento
                </h3>
              </CardHeader>
              <CardContent className="p-0">
                {data.topBarbers.length === 0 ? (
                  <div className="p-5 text-sm text-zinc-500 dark:text-zinc-400">
                    Nenhum atendimento concluído no período.
                  </div>
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Barbeiro</TableHeaderCell>
                        <TableHeaderCell>Atendimentos</TableHeaderCell>
                        <TableHeaderCell>Faturamento</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.topBarbers.map((barber) => (
                        <TableRow key={barber.nome}>
                          <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                            {barber.nome}
                          </TableCell>
                          <TableCell>{barber.atendimentos}</TableCell>
                          <TableCell>
                            {currencyFormatter.format(barber.faturamento)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>

          <div className="hidden print:block">
            <p className="mt-8 text-xs">
              Exportado pelo BarberFlow. Para salvar em PDF, escolha "Salvar
              como PDF" na janela de impressão.
            </p>
          </div>
        </div>
      ) : null}

      <div className="hidden print:flex print:items-center print:gap-2">
        <Download size={16} />
        <span>BarberFlow</span>
      </div>
    </div>
  )
}
