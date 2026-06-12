import { supabase } from '../lib/supabase'
import { createAuditLog } from './observabilityService'

type ExportKind = 'atendimentos' | 'clientes' | 'financeiro' | 'produtos' | 'completo'

const dateStamp = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function isoDateName() {
  return new Date().toISOString().slice(0, 10)
}

function sanitizeCell(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  const text =
    typeof value === 'object' ? JSON.stringify(value) : String(value).trim()
  const escaped = text.replace(/"/g, '""')

  return `"${escaped}"`
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return ''
  }

  const headers = Object.keys(rows[0] ?? {})
  const lines = [
    headers.map(sanitizeCell).join(';'),
    ...rows.map((row) => headers.map((header) => sanitizeCell(row[header])).join(';')),
  ]

  return `\uFEFF${lines.join('\n')}`
}

function downloadFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

async function selectRows(table: string, empresaId: string) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Array<Record<string, unknown>>
}

function stripSensitive(row: Record<string, unknown>) {
  const {
    auth_user_id: _authUserId,
    token: _token,
    ...safe
  } = row

  return safe
}

async function exportCsv(input: {
  empresaId: string
  kind: ExportKind
  rows: Array<Record<string, unknown>>
  title: string
}) {
  const fileName = `BW-Barber-${input.title}-${isoDateName()}.csv`
  downloadFile(fileName, toCsv(input.rows), 'text/csv;charset=utf-8')
  await createAuditLog({
    action: 'exportacao_dados',
    empresaId: input.empresaId,
    entityType: 'backup',
    metadata: {
      arquivo: fileName,
      quantidade: input.rows.length,
      tipo: input.kind,
    },
    userRole: 'administrador',
  })
}

export async function exportClientesCsv(empresaId: string) {
  const rows = await selectRows('clientes', empresaId)
  await exportCsv({
    empresaId,
    kind: 'clientes',
    rows: rows.map(stripSensitive),
    title: 'Clientes',
  })
}

export async function exportAtendimentosCsv(empresaId: string) {
  const rows = await selectRows('atendimentos', empresaId)
  await exportCsv({
    empresaId,
    kind: 'atendimentos',
    rows: rows.map(stripSensitive),
    title: 'Atendimentos',
  })
}

export async function exportProdutosCsv(empresaId: string) {
  const rows = await selectRows('produtos', empresaId)
  await exportCsv({
    empresaId,
    kind: 'produtos',
    rows: rows.map(stripSensitive),
    title: 'Produtos',
  })
}

export async function exportFinanceiroCsv(empresaId: string) {
  const [movimentacoes, contas, comissoes] = await Promise.all([
    selectRows('movimentacoes_financeiras', empresaId),
    selectRows('contas_pagar', empresaId),
    selectRows('comissoes', empresaId),
  ])
  const rows = [
    ...movimentacoes.map((row) => ({ modulo: 'movimentacao', ...stripSensitive(row) })),
    ...contas.map((row) => ({ modulo: 'conta_pagar', ...stripSensitive(row) })),
    ...comissoes.map((row) => ({ modulo: 'comissao', ...stripSensitive(row) })),
  ]

  await exportCsv({
    empresaId,
    kind: 'financeiro',
    rows,
    title: 'Financeiro',
  })
}

export async function exportEmpresaJson(empresaId: string) {
  const [
    clientes,
    atendimentos,
    produtos,
    movimentacoes,
    contas,
    comissoes,
    servicos,
    barbeiros,
  ] = await Promise.all([
    selectRows('clientes', empresaId),
    selectRows('atendimentos', empresaId),
    selectRows('produtos', empresaId),
    selectRows('movimentacoes_financeiras', empresaId),
    selectRows('contas_pagar', empresaId),
    selectRows('comissoes', empresaId),
    selectRows('servicos', empresaId),
    selectRows('barbeiros', empresaId),
  ])
  const fileName = `BW-Barber-Dados-Empresa-${isoDateName()}.json`
  const content = JSON.stringify(
    {
      empresa_id: empresaId,
      exportado_em: new Date().toISOString(),
      periodo_visual: dateStamp.format(new Date()),
      dados: {
        atendimentos: atendimentos.map(stripSensitive),
        barbeiros: barbeiros.map(stripSensitive),
        clientes: clientes.map(stripSensitive),
        comissoes: comissoes.map(stripSensitive),
        contas_pagar: contas.map(stripSensitive),
        movimentacoes_financeiras: movimentacoes.map(stripSensitive),
        produtos: produtos.map(stripSensitive),
        servicos: servicos.map(stripSensitive),
      },
    },
    null,
    2,
  )

  downloadFile(fileName, content, 'application/json;charset=utf-8')
  await createAuditLog({
    action: 'exportacao_dados_completa',
    empresaId,
    entityType: 'backup',
    metadata: { arquivo: fileName },
    userRole: 'administrador',
  })
}
