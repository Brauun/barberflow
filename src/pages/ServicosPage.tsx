import { zodResolver } from '@hookform/resolvers/zod'
import { Edit, Loader2, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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
  useServiceBarbers,
  useServicoBarberIds,
  useServicos,
} from '../hooks/useServicos'
import type { Servico } from '../services/servicosService'
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
    categoria: '',
    descricao: '',
    duracao_minutos: 30,
    nome: '',
    percentual_comissao: 60,
    preco: 0,
  }
}

function servicoToFormValues(servico: Servico): ServicoFormInput {
  return {
    ativo: servico.ativo,
    categoria: servico.categoria ?? '',
    descricao: servico.descricao ?? '',
    duracao_minutos: servico.duracao_minutos,
    nome: servico.nome,
    percentual_comissao: servico.percentual_comissao ?? 60,
    preco: servico.preco,
  }
}

export function ServicosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingServico, setEditingServico] = useState<Servico | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedBarberIds, setSelectedBarberIds] = useState<string[]>([])

  const {
    canManageServices,
    deleteServicoMutation,
    isLoadingServicos,
    saveServicoMutation,
    servicos,
    servicosError,
  } = useServicos({
    empresaId,
    role: profile?.papel,
    searchTerm,
  })

  const barbersQuery = useServiceBarbers({
    canManageServices,
    empresaId,
    isFormOpen,
  })

  const serviceBarberIdsQuery = useServicoBarberIds({
    canManageServices,
    empresaId,
    isFormOpen,
    servicoId: editingServico?.id,
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
    reset(editingServico ? servicoToFormValues(editingServico) : emptyFormValues())
  }, [editingServico, reset])

  useEffect(() => {
    if (!isFormOpen || !canManageServices) {
      return
    }

    if (editingServico && serviceBarberIdsQuery.data) {
      queueMicrotask(() => setSelectedBarberIds([...serviceBarberIdsQuery.data]))
      return
    }

    if (!editingServico && barbersQuery.data) {
      queueMicrotask(() =>
        setSelectedBarberIds(
          barbersQuery.data
            .filter((barber) => barber.status === 'ativo')
            .map((barber) => barber.id),
        ),
      )
    }
  }, [
    barbersQuery.data,
    canManageServices,
    editingServico,
    isFormOpen,
    serviceBarberIdsQuery.data,
  ])

  function openCreateModal() {
    setEditingServico(null)
    setSelectedBarberIds([])
    reset(emptyFormValues())
    setFormError(null)
    setIsFormOpen(true)
  }

  function openEditModal(servico: Servico) {
    setEditingServico(servico)
    setSelectedBarberIds([])
    reset(servicoToFormValues(servico))
    setFormError(null)
    setIsFormOpen(true)
  }

  function closeFormModal() {
    setIsFormOpen(false)
    setEditingServico(null)
    setFormError(null)
    setSelectedBarberIds([])
    reset(emptyFormValues())
  }

  function toggleBarber(barberId: string) {
    if (!editingServico) {
      return
    }

    setSelectedBarberIds((current) =>
      current.includes(barberId)
        ? current.filter((id) => id !== barberId)
        : [...current, barberId],
    )
  }

  async function onSubmit(data: ServicoFormData) {
    setFormError(null)

    try {
      await saveServicoMutation.mutateAsync({
        barbeiroIds: selectedBarberIds,
        data,
        servicoId: editingServico?.id,
      })
      reset(emptyFormValues())
      setIsFormOpen(false)
      setEditingServico(null)
      setSelectedBarberIds([])
      setFormError(null)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o serviço.',
      )
    }
  }

  async function handleDelete(servico: Servico) {
    const shouldDelete = window.confirm(
      `Inativar o serviço ${servico.nome}? O histórico será preservado.`,
    )

    if (!shouldDelete) {
      return
    }

    await deleteServicoMutation.mutateAsync(servico)
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para visualizar
            serviços.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-brand-600 dark:text-brand-400 md:text-sm">
            Serviços
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50 md:mt-2 md:text-2xl">
            Catálogo de serviços
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-zinc-600 dark:text-zinc-400 md:mt-2 md:leading-6">
            {canManageServices
              ? 'Cadastre serviços, defina preços, duração, comissão padrão e quais barbeiros executam cada item.'
              : 'Serviços definidos pela administração. Barbeiros apenas utilizam o catálogo existente.'}
          </p>
        </div>

        {canManageServices && (
          <Button leftIcon={<Plus size={18} />} onClick={openCreateModal}>
            Novo serviço
          </Button>
        )}
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
            <div className="p-3 text-sm text-red-600 md:p-5">
              {servicosError.message}
            </div>
          )}

          {isLoadingServicos ? (
            <div className="flex min-h-40 items-center justify-center md:min-h-56">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500 md:h-7 md:w-7" />
            </div>
          ) : servicos.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center px-4 text-center md:min-h-56 md:px-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 md:h-12 md:w-12">
                <Sparkles size={22} />
              </span>
              <p className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">
                Nenhum serviço encontrado
              </p>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                {canManageServices
                  ? 'Cadastre o primeiro serviço ou ajuste a pesquisa.'
                  : 'A administração ainda não cadastrou serviços.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nome</TableHeaderCell>
                  <TableHeaderCell>Categoria</TableHeaderCell>
                  <TableHeaderCell>Preço</TableHeaderCell>
                  <TableHeaderCell>Duração</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  {canManageServices && (
                    <TableHeaderCell className="text-right">Ações</TableHeaderCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {servicos.map((servico) => (
                  <TableRow key={servico.id}>
                    <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                      {servico.nome}
                    </TableCell>
                    <TableCell>{servico.categoria || 'Geral'}</TableCell>
                    <TableCell>
                      {currencyFormatter.format(Number(servico.preco))}
                    </TableCell>
                    <TableCell>{servico.duracao_minutos} min</TableCell>
                    <TableCell>
                      <Badge variant={servico.ativo ? 'success' : 'default'}>
                        {servico.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    {canManageServices && (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            aria-label="Editar serviço"
                            size="icon-sm"
                            onClick={() => openEditModal(servico)}
                            variant="ghost"
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            aria-label="Inativar serviço"
                            size="icon-sm"
                            disabled={deleteServicoMutation.isPending}
                            onClick={() => void handleDelete(servico)}
                            variant="ghost"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManageServices && (
        <Modal
          isOpen={isFormOpen}
          onClose={closeFormModal}
          title={editingServico ? 'Editar serviço' : 'Cadastrar serviço'}
        >
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {formError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}

            <Input error={errors.nome?.message} label="Nome" {...register('nome')} />

            <Input
              error={errors.categoria?.message}
              label="Categoria"
              placeholder="Corte, barba, combo..."
              {...register('categoria')}
            />

            <Input
              error={errors.descricao?.message}
              label="Descrição"
              placeholder="Detalhes internos do serviço"
              {...register('descricao')}
            />

            <div className="grid gap-4 sm:grid-cols-3">
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
                label="Duração (min)"
                min={1}
                step="1"
                type="number"
                {...register('duracao_minutos')}
              />

              <Input
                error={errors.percentual_comissao?.message}
                label="Comissão padrão (%)"
                min={0}
                max={100}
                step="1"
                type="number"
                {...register('percentual_comissao')}
              />
            </div>

            <Select
              error={errors.ativo?.message}
              label="Status"
              options={[
                { label: 'Ativo', value: 'true' },
                { label: 'Inativo', value: 'false' },
              ]}
              {...register('ativo')}
            />

            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                    Barbeiros que executam
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    O cliente só verá este serviço para os profissionais
                    selecionados.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    setSelectedBarberIds(
                      (barbersQuery.data ?? [])
                        .filter((barber) => barber.status === 'ativo')
                        .map((barber) => barber.id),
                    )
                  }
                  type="button"
                  variant="secondary"
                >
                  Selecionar ativos
                </Button>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {barbersQuery.isLoading ? (
                  <p className="text-sm text-slate-500">Carregando barbeiros...</p>
                ) : barbersQuery.data?.length ? (
                  barbersQuery.data.map((barber) => (
                    <label
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 dark:border-slate-800 dark:text-slate-200"
                      key={barber.id}
                    >
                      <span>
                        {barber.nome}
                        {barber.status !== 'ativo' && (
                          <span className="ml-2 text-xs font-medium text-slate-400">
                            Inativo
                          </span>
                        )}
                      </span>
                      <input
                        checked={selectedBarberIds.includes(barber.id)}
                        className="h-4 w-4 accent-brand-500"
                        disabled={!editingServico}
                        onChange={() => toggleBarber(barber.id)}
                        type="checkbox"
                      />
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Nenhum barbeiro cadastrado para vincular.
                  </p>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 -mx-5 flex justify-end gap-3 border-t border-slate-100 bg-white px-5 pb-[env(safe-area-inset-bottom)] pt-4 dark:border-slate-800 dark:bg-slate-950">
              <Button onClick={closeFormModal} type="button" variant="secondary">
                Cancelar
              </Button>
              <Button disabled={isSubmitting || saveServicoMutation.isPending} type="submit">
                {saveServicoMutation.isPending ? 'Salvando...' : 'Salvar serviço'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
