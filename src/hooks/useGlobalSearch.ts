import { useEffect, useMemo, useRef, useState } from 'react'

import { supabase } from '../lib/supabase'
import type { NavigationItem } from '../components/layout/navigation'

export type GlobalSearchResultItem =
  | { kind: 'nav'; item: NavigationItem }
  | { kind: 'cliente'; id: string; nome: string; telefone: string | null }
  | { kind: 'atendimento'; id: string; cliente: string; servico: string; data: string }

async function searchClientes(empresaId: string, term: string) {
  const { data } = await supabase
    .from('clientes')
    .select('id,nome,telefone')
    .eq('empresa_id', empresaId)
    .ilike('nome', `%${term}%`)
    .limit(4)

  return (data ?? []) as Array<{ id: string; nome: string; telefone: string | null }>
}

async function searchAtendimentos(empresaId: string, term: string) {
  const { data } = await supabase
    .from('atendimentos')
    .select('id,data_hora_inicio,clientes(nome),servicos(nome)')
    .eq('empresa_id', empresaId)
    .order('data_hora_inicio', { ascending: false })
    .limit(100) // filtramos localmente pelo nome do cliente

  const rows = (data ?? []) as unknown as Array<{
    id: string
    data_hora_inicio: string
    clientes: { nome: string } | null
    servicos: { nome: string } | null
  }>

  const lowerTerm = term.toLowerCase()

  return rows
    .filter((row) => row.clientes?.nome.toLowerCase().includes(lowerTerm))
    .slice(0, 4)
    .map((row) => ({
      id: row.id,
      cliente: row.clientes?.nome?.trim() || 'Cliente não identificado',
      servico: row.servicos?.nome ?? 'Serviço',
      data: row.data_hora_inicio,
    }))
}

export function useGlobalSearch(
  navItems: NavigationItem[],
  empresaId: string | undefined,
  term: string,
) {
  const [searchResults, setSearchResults] = useState<{
    atendimentos: Array<{ id: string; cliente: string; servico: string; data: string }>
    clientes: Array<{ id: string; nome: string; telefone: string | null }>
  }>({ atendimentos: [], clientes: [] })
  const [pendingQuery, setPendingQuery] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const normalizedTerm = term.trim().toLowerCase()
  const hasQuery = Boolean(empresaId && normalizedTerm)

  const navResults = useMemo(() => {
    if (!normalizedTerm) return navItems.slice(0, 5)

    return navItems
      .filter((item) => item.label.toLowerCase().includes(normalizedTerm))
      .slice(0, 5)
  }, [navItems, normalizedTerm])

  // Resultados exibidos: vazios quando nao ha empresa/termo, sem precisar de
  // setState no efeito so para "limpar" o estado a cada mudanca de termo.
  const { atendimentos, clientes } = useMemo(() => {
    if (!hasQuery) {
      return { atendimentos: [], clientes: [] }
    }

    return searchResults
  }, [hasQuery, searchResults])

  // Busca ainda em andamento se ha uma query pendente cujo termo bate com o
  // termo atual normalizado (evita "preso em true" se o termo mudar antes do
  // debounce anterior resolver).
  const isSearching = hasQuery && pendingQuery === normalizedTerm

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!empresaId || !normalizedTerm) {
      return
    }

    debounceRef.current = setTimeout(() => {
      setPendingQuery(normalizedTerm)

      void Promise.all([
        searchClientes(empresaId, normalizedTerm),
        searchAtendimentos(empresaId, normalizedTerm),
      ]).then(([clienteResults, atendimentoResults]) => {
        setSearchResults({ atendimentos: atendimentoResults, clientes: clienteResults })
        setPendingQuery((current) => (current === normalizedTerm ? null : current))
      })
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [empresaId, normalizedTerm])

  const hasResults =
    navResults.length > 0 || clientes.length > 0 || atendimentos.length > 0

  return { atendimentos, clientes, hasResults, isSearching, navResults }
}
