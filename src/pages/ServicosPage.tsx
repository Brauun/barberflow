import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, Loader2, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
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
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  createServico,
  deleteServico,
  listServicos,
  updateServico,
  type Servico,
} from '../services/servicosService'
import {
  servicoSchema,
  type ServicoFormData,
  type ServicoFormInput,
} from '../types/servicos'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

function emptyFormValues(): ServicoFormInput {
  return {
    ativo: true,
    duracao_minutos: 30,
    nome: '',
    preco: 0,
  }
}

function servicoToFormValues(servico: Servico): ServicoFormInput {
  return {
    ativo: servico.ativo,
    duracao_minutos: servico.duracao_minutos,
    nome: servico.nome,
    preco: servico.preco,
  }
}

export function ServicosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingServico, setEditingServico] = useState<Servico | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const servicosQueryKey = useMemo(
    () => ['servicos', empresaId, searchTerm],
    [empresaId, searchTerm],
  )

  const {
    data: servicos = [],
    error: servicosError,
    isLoading: isLoadingServicos,
  } = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listServicos(empresaId as string, searchTerm),
    queryKey: servicosQueryKey,
  })

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ServicoFormInput, unknown, ServicoFormData>({
    defaultValues: emptyFormValues(),
    resolver: zodResolver(servicoSchema),
  })

  useEffect(() => {
    if (editingServico) {
      reset(servicoToFormValues(editingServico))
      return
    }

    reset(emptyFormValues())
  }, [editingServico, reset])

  const saveMutation = useMutation({
    mutationFn: async (data: ServicoFormData) => {
      if (!empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      if (editingServico) {
        await updateServico(empresaId, editingServico.id, data)
        return
      }

      await createServico(empresaId, data)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['servicos'] })
      setIsFormOpen(false)
      setEditingServico(null)
      setFormError(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (servico: Servico) => {
      if (!empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      await deleteServico(empresaId, servico.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['servicos'] })
    },
  })

  function openCreateModal() {
    setEditingServico(null)
    setFormError(null)
    setIsFormOpen(true)
  }

  function openEditModal(servico: Servico) {
    setEditingServico(servico)
    setFormError(null)
    setIsFormOpen(true)
  }

  async function onSubmit(data: ServicoFormData) {
    setFormError(null)

    try {
      await saveMutation.mutateAsync(data)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel salvar o serviço.',
      )
    }
  }

  async function handleDelete(servico: Servico) {
    const shouldDelete = window.confirm(
      `Excluir o serviço ${servico.nome}? Esta acao nao pode ser desfeita.`,
    )

    if (!shouldDelete) {
      return
    }

    await deleteMutation.mutateAsync(servico)
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para gerenciar
            serviços.
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
            Serviços
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
            Catálogo de serviços
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Cadastre serviços, defina preços, duração estimada e controle o
            status de venda por empresa.
          </p>
        </div>

        <Button leftIcon={<Plus size={18} />} onClick={openCreateModal}>
          Novo serviço
        </Button>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Serviços cadastrados
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {servicos.length} serviço{servicos.length === 1 ? '' : 's'} na
                listagem atual.
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
                placeholder="Pesquisar por nome"
                value={searchTerm}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {servicosError && (
            <div className="p-5 text-sm text-red-600">
              {servicosError.message}
            </div>
          )}

          {isLoadingServicos ? (
            <div className="flex min-h-56 items-center justify-center">
              <Loader2 className="animate-spin text-brand-500" size={28} />
            </div>
          ) : servicos.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <Sparkles size={22} />
              </span>
              <p className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">
                Nenhum serviço encontrado
              </p>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Cadastre o primeiro serviço ou ajuste a pesquisa.
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nome</TableHeaderCell>
                  <TableHeaderCell>Preço</TableHeaderCell>
                  <TableHeaderCell>Duração estimada</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ações</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {servicos.map((servico) => (
                  <TableRow key={servico.id}>
                    <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                      {servico.nome}
                    </TableCell>
                    <TableCell>
                      {currencyFormatter.format(Number(servico.preco))}
                    </TableCell>
                    <TableCell>{servico.duracao_minutos} min</TableCell>
                    <TableCell>
                      <Badge variant={servico.ativo ? 'success' : 'default'}>
                        {servico.ativo ? 'ativo' : 'inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          aria-label="Editar serviço"
                          className="h-9 w-9 px-0"
                          onClick={() => openEditModal(servico)}
                          variant="ghost"
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          aria-label="Excluir serviço"
                          className="h-9 w-9 px-0"
                          disabled={deleteMutation.isPending}
                          onClick={() => void handleDelete(servico)}
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
        title={editingServico ? 'Editar serviço' : 'Cadastrar serviço'}
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
            error={errors.preco?.message}
            label="Preço"
            min={0}
            step="0.01"
            type="number"
            {...register('preco')}
          />

          <Input
            error={errors.duracao_minutos?.message}
            label="Duração estimada (minutos)"
            min={1}
            step="1"
            type="number"
            {...register('duracao_minutos')}
          />

          <Select
            error={errors.ativo?.message}
            label="Status"
            options={[
              { label: 'Ativo', value: 'true' },
              { label: 'Inativo', value: 'false' },
            ]}
            {...register('ativo')}
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
              {saveMutation.isPending ? 'Salvando...' : 'Salvar serviço'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
