import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, Loader2, Plus, Scissors, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  createBarbeiro,
  deleteBarbeiro,
  listBarbeiros,
  updateBarbeiro,
  type BarbeiroWithIndicators,
} from '../services/barbeirosService'
import {
  barbeiroSchema,
  type BarbeiroFormData,
  type BarbeiroFormInput,
} from '../types/barbeiros'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

function emptyFormValues(): BarbeiroFormInput {
  return {
    nome: '',
    percentual_comissao: 60,
    telefone: '',
  }
}

function barbeiroToFormValues(
  barbeiro: BarbeiroWithIndicators,
): BarbeiroFormInput {
  return {
    nome: barbeiro.nome,
    percentual_comissao: Number(barbeiro.percentual_comissao),
    telefone: barbeiro.telefone ?? '',
  }
}

export function BarbeirosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBarbeiro, setEditingBarbeiro] =
    useState<BarbeiroWithIndicators | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const barbeirosQueryKey = useMemo(
    () => ['barbeiros', empresaId, searchTerm],
    [empresaId, searchTerm],
  )

  const {
    data: barbeiros = [],
    error: barbeirosError,
    isLoading: isLoadingBarbeiros,
  } = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listBarbeiros(empresaId as string, searchTerm),
    queryKey: barbeirosQueryKey,
  })

  const totals = useMemo(
    () =>
      barbeiros.reduce(
        (acc, barbeiro) => ({
          atendimentos: acc.atendimentos + barbeiro.atendimentos_count,
          comissao: acc.comissao + barbeiro.comissao_acumulada,
          faturamento: acc.faturamento + barbeiro.valor_faturado,
        }),
        {
          atendimentos: 0,
          comissao: 0,
          faturamento: 0,
        },
      ),
    [barbeiros],
  )

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<BarbeiroFormInput, unknown, BarbeiroFormData>({
    defaultValues: emptyFormValues(),
    resolver: zodResolver(barbeiroSchema),
  })

  useEffect(() => {
    if (editingBarbeiro) {
      reset(barbeiroToFormValues(editingBarbeiro))
      return
    }

    reset(emptyFormValues())
  }, [editingBarbeiro, reset])

  const saveMutation = useMutation({
    mutationFn: async (data: BarbeiroFormData) => {
      if (!empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      if (editingBarbeiro) {
        await updateBarbeiro(empresaId, editingBarbeiro.id, data)
        return
      }

      await createBarbeiro(empresaId, data)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['barbeiros'] })
      setIsFormOpen(false)
      setEditingBarbeiro(null)
      setFormError(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (barbeiro: BarbeiroWithIndicators) => {
      if (!empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      await deleteBarbeiro(empresaId, barbeiro.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['barbeiros'] })
    },
  })

  function openCreateModal() {
    setEditingBarbeiro(null)
    setFormError(null)
    setIsFormOpen(true)
  }

  function openEditModal(barbeiro: BarbeiroWithIndicators) {
    setEditingBarbeiro(barbeiro)
    setFormError(null)
    setIsFormOpen(true)
  }

  async function onSubmit(data: BarbeiroFormData) {
    setFormError(null)

    try {
      await saveMutation.mutateAsync(data)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel salvar o barbeiro.',
      )
    }
  }

  async function handleDelete(barbeiro: BarbeiroWithIndicators) {
    const shouldDelete = window.confirm(
      `Excluir o barbeiro ${barbeiro.nome}? Esta acao nao pode ser desfeita.`,
    )

    if (!shouldDelete) {
      return
    }

    await deleteMutation.mutateAsync(barbeiro)
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para gerenciar
            barbeiros.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-400">
            Barbeiros
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
            Equipe e comissões
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Cadastre barbeiros, defina comissão padrão e acompanhe desempenho
            respeitando o isolamento por empresa.
          </p>
        </div>

        <Button leftIcon={<Plus size={18} />} onClick={openCreateModal}>
          Novo barbeiro
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Quantidade de atendimentos
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {totals.atendimentos}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Valor faturado
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {currencyFormatter.format(totals.faturamento)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Comissão acumulada
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {currencyFormatter.format(totals.comissao)}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Barbeiros cadastrados
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {barbeiros.length} barbeiro{barbeiros.length === 1 ? '' : 's'}{' '}
                na listagem atual.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                size={16}
              />
              <input
                className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-brand-400 dark:focus:ring-brand-500/20"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar por nome ou telefone"
                value={searchTerm}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {barbeirosError && (
            <div className="p-5 text-sm text-red-600">
              {barbeirosError.message}
            </div>
          )}

          {isLoadingBarbeiros ? (
            <div className="flex min-h-56 items-center justify-center">
              <Loader2 className="animate-spin text-brand-500" size={28} />
            </div>
          ) : barbeiros.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <Scissors size={22} />
              </span>
              <p className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">
                Nenhum barbeiro encontrado
              </p>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Cadastre o primeiro barbeiro ou ajuste a pesquisa.
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nome</TableHeaderCell>
                  <TableHeaderCell>Telefone</TableHeaderCell>
                  <TableHeaderCell>Comissão padrão</TableHeaderCell>
                  <TableHeaderCell>Atendimentos</TableHeaderCell>
                  <TableHeaderCell>Faturado</TableHeaderCell>
                  <TableHeaderCell>Comissão acumulada</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ações</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {barbeiros.map((barbeiro) => (
                  <TableRow key={barbeiro.id}>
                    <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                      {barbeiro.nome}
                    </TableCell>
                    <TableCell>{barbeiro.telefone ?? '-'}</TableCell>
                    <TableCell>{Number(barbeiro.percentual_comissao)}%</TableCell>
                    <TableCell>{barbeiro.atendimentos_count}</TableCell>
                    <TableCell>
                      {currencyFormatter.format(barbeiro.valor_faturado)}
                    </TableCell>
                    <TableCell>
                      {currencyFormatter.format(barbeiro.comissao_acumulada)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={barbeiro.status === 'ativo' ? 'success' : 'default'}
                      >
                        {barbeiro.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          aria-label="Editar barbeiro"
                          className="h-9 w-9 px-0"
                          onClick={() => openEditModal(barbeiro)}
                          variant="ghost"
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          aria-label="Excluir barbeiro"
                          className="h-9 w-9 px-0"
                          disabled={deleteMutation.isPending}
                          onClick={() => void handleDelete(barbeiro)}
                          variant="ghost"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingBarbeiro ? 'Editar barbeiro' : 'Cadastrar barbeiro'}
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {formError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <Input
            error={errors.nome?.message}
            label="Nome"
            {...register('nome')}
          />

          <Input
            error={errors.telefone?.message}
            label="Telefone"
            {...register('telefone')}
          />

          <Input
            error={errors.percentual_comissao?.message}
            label="Comissão padrão (%)"
            max={100}
            min={0}
            step="0.01"
            type="number"
            {...register('percentual_comissao')}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setIsFormOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={isSubmitting || saveMutation.isPending} type="submit">
              {saveMutation.isPending ? 'Salvando...' : 'Salvar barbeiro'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
