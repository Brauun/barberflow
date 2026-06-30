import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Edit,
  Loader2,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
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
  createProduto,
  deleteProduto,
  listProdutos,
  registrarEntradaEstoque,
  registrarVendaProduto,
  updateProduto,
  type Produto,
} from '../services/produtosService'
import {
  estoqueSchema,
  produtoSchema,
  vendaProdutoSchema,
  type EstoqueFormData,
  type EstoqueFormInput,
  type ProdutoFormData,
  type ProdutoFormInput,
  type VendaProdutoFormData,
  type VendaProdutoFormInput,
} from '../types/produtos'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

function emptyProdutoValues(): ProdutoFormInput {
  return {
    ativo: true,
    categoria: '',
    estoque_atual: 0,
    nome: '',
    preco_custo: 0,
    preco_venda: 0,
  }
}

function produtoToFormValues(produto: Produto): ProdutoFormInput {
  return {
    ativo: produto.ativo,
    categoria: produto.categoria ?? '',
    estoque_atual: produto.estoque_atual,
    nome: produto.nome,
    preco_custo: produto.preco_custo,
    preco_venda: produto.preco_venda,
  }
}

export function ProdutosPage() {
  const { profile } = useAuth()
  const empresaId = profile?.empresa_id
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null)
  const [stockProduto, setStockProduto] = useState<Produto | null>(null)
  const [saleProduto, setSaleProduto] = useState<Produto | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [stockError, setStockError] = useState<string | null>(null)
  const [saleError, setSaleError] = useState<string | null>(null)

  const produtosQueryKey = useMemo(
    () => ['produtos', empresaId, searchTerm],
    [empresaId, searchTerm],
  )

  const {
    data: produtos = [],
    error: produtosError,
    isLoading: isLoadingProdutos,
  } = useQuery({
    enabled: Boolean(empresaId),
    queryFn: () => listProdutos(empresaId as string, searchTerm),
    queryKey: produtosQueryKey,
  })

  const produtoForm = useForm<ProdutoFormInput, unknown, ProdutoFormData>({
    defaultValues: emptyProdutoValues(),
    resolver: zodResolver(produtoSchema),
  })

  const estoqueForm = useForm<EstoqueFormInput, unknown, EstoqueFormData>({
    defaultValues: { quantidade: 1 },
    resolver: zodResolver(estoqueSchema),
  })

  const vendaForm = useForm<
    VendaProdutoFormInput,
    unknown,
    VendaProdutoFormData
  >({
    defaultValues: {
      forma_pagamento: 'Dinheiro',
      quantidade: 1,
    },
    resolver: zodResolver(vendaProdutoSchema),
  })

  useEffect(() => {
    if (editingProduto) {
      produtoForm.reset(produtoToFormValues(editingProduto))
      return
    }

    produtoForm.reset(emptyProdutoValues())
  }, [editingProduto, produtoForm])

  const saveMutation = useMutation({
    mutationFn: async (data: ProdutoFormData) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      if (editingProduto) {
        await updateProduto(empresaId, editingProduto.id, data)
        return
      }

      await createProduto(empresaId, data)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['produtos'] })
      produtoForm.reset(emptyProdutoValues())
      setIsFormOpen(false)
      setEditingProduto(null)
      setFormError(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (produto: Produto) => {
      if (!empresaId) {
        throw new Error('Empresa não encontrada.')
      }

      await deleteProduto(empresaId, produto.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['produtos'] })
    },
  })

  const stockMutation = useMutation({
    mutationFn: async (data: EstoqueFormData) => {
      if (!empresaId || !stockProduto) {
        throw new Error('Produto não encontrado.')
      }

      await registrarEntradaEstoque(empresaId, stockProduto.id, data)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['produtos'] })
      setStockProduto(null)
      setStockError(null)
      estoqueForm.reset({ quantidade: 1 })
    },
  })

  const saleMutation = useMutation({
    mutationFn: async (data: VendaProdutoFormData) => {
      if (!empresaId || !saleProduto) {
        throw new Error('Produto não encontrado.')
      }

      await registrarVendaProduto(empresaId, saleProduto.id, data)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['produtos'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      setSaleProduto(null)
      setSaleError(null)
      vendaForm.reset({ forma_pagamento: 'Dinheiro', quantidade: 1 })
    },
  })

  function openCreateModal() {
    setEditingProduto(null)
    produtoForm.reset(emptyProdutoValues())
    setFormError(null)
    setIsFormOpen(true)
  }

  function openEditModal(produto: Produto) {
    setEditingProduto(produto)
    produtoForm.reset(produtoToFormValues(produto))
    setFormError(null)
    setIsFormOpen(true)
  }

  function closeFormModal() {
    setIsFormOpen(false)
    setEditingProduto(null)
    setFormError(null)
    produtoForm.reset(emptyProdutoValues())
  }

  async function onSubmitProduto(data: ProdutoFormData) {
    setFormError(null)

    try {
      await saveMutation.mutateAsync(data)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o produto.',
      )
    }
  }

  async function handleDelete(produto: Produto) {
    const shouldDelete = window.confirm(
      `Excluir o produto ${produto.nome}? Esta ação não pode ser desfeita.`,
    )

    if (!shouldDelete) {
      return
    }

    await deleteMutation.mutateAsync(produto)
  }

  async function onSubmitStock(data: EstoqueFormData) {
    setStockError(null)

    try {
      await stockMutation.mutateAsync(data)
    } catch (error) {
      setStockError(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar a entrada.',
      )
    }
  }

  async function onSubmitSale(data: VendaProdutoFormData) {
    setSaleError(null)

    try {
      await saleMutation.mutateAsync(data)
    } catch (error) {
      setSaleError(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar a venda.',
      )
    }
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para gerenciar
            produtos.
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
            Produtos
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50 md:mt-2 md:text-2xl">
            Estoque e vendas
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-zinc-600 dark:text-zinc-400 md:mt-2 md:leading-6">
            Cadastre produtos, controle entrada de estoque e registre vendas
            com baixa automática e entrada no caixa, sem gerar comissão.
          </p>
        </div>

        <Button data-subscription-write="true" leftIcon={<Plus size={18} />} onClick={openCreateModal}>
          Novo produto
        </Button>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Produtos cadastrados
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {produtos.length} produto{produtos.length === 1 ? '' : 's'} na
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
                placeholder="Pesquisar por nome ou categoria"
                value={searchTerm}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {produtosError && (
            <div className="p-3 text-sm text-red-600 md:p-5">
              {produtosError.message}
            </div>
          )}

          {isLoadingProdutos ? (
            <div className="flex min-h-40 items-center justify-center md:min-h-56">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500 md:h-7 md:w-7" />
            </div>
          ) : produtos.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center px-4 text-center md:min-h-56 md:px-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 md:h-12 md:w-12">
                <Package size={22} />
              </span>
              <p className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">
                Nenhum produto encontrado
              </p>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Cadastre o primeiro produto ou ajuste a pesquisa.
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nome</TableHeaderCell>
                  <TableHeaderCell>Categoria</TableHeaderCell>
                  <TableHeaderCell>Estoque</TableHeaderCell>
                  <TableHeaderCell>Compra</TableHeaderCell>
                  <TableHeaderCell>Venda</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ações</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {produtos.map((produto) => (
                  <TableRow key={produto.id}>
                    <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                      {produto.nome}
                    </TableCell>
                    <TableCell>{produto.categoria ?? '-'}</TableCell>
                    <TableCell>{produto.estoque_atual}</TableCell>
                    <TableCell>
                      {currencyFormatter.format(Number(produto.preco_custo))}
                    </TableCell>
                    <TableCell>
                      {currencyFormatter.format(Number(produto.preco_venda))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={produto.ativo ? 'success' : 'default'}>
                        {produto.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          aria-label="Entrada de estoque"
                          className="h-9 px-3"
                          onClick={() => {
                            estoqueForm.reset({ quantidade: 1 })
                            setStockError(null)
                            setStockProduto(produto)
                          }}
                          variant="secondary"
                        >
                          Entrada
                        </Button>
                        <Button
                          aria-label="Venda de produto"
                          size="icon-sm"
                          onClick={() => {
                            vendaForm.reset({
                              forma_pagamento: 'Dinheiro',
                              quantidade: 1,
                            })
                            setSaleError(null)
                            setSaleProduto(produto)
                          }}
                          variant="ghost"
                        >
                          <ShoppingCart size={16} />
                        </Button>
                        <Button
                          aria-label="Editar produto"
                          data-subscription-write="true"
                          size="icon-sm"
                          onClick={() => openEditModal(produto)}
                          variant="ghost"
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          aria-label="Excluir produto"
                          data-subscription-write="true"
                          size="icon-sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => void handleDelete(produto)}
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
        onClose={closeFormModal}
        title={editingProduto ? 'Editar produto' : 'Cadastrar produto'}
      >
        <form
          className="space-y-4"
          onSubmit={produtoForm.handleSubmit(onSubmitProduto)}
        >
          {formError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <Input
            error={produtoForm.formState.errors.nome?.message}
            label="Nome"
            {...produtoForm.register('nome')}
          />

          <Input
            error={produtoForm.formState.errors.categoria?.message}
            label="Categoria"
            {...produtoForm.register('categoria')}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              error={produtoForm.formState.errors.estoque_atual?.message}
              label="Estoque"
              min={0}
              step="1"
              type="number"
              {...produtoForm.register('estoque_atual')}
            />
            <Input
              error={produtoForm.formState.errors.preco_custo?.message}
              label="Valor de compra"
              min={0}
              step="0.01"
              type="number"
              {...produtoForm.register('preco_custo')}
            />
            <Input
              error={produtoForm.formState.errors.preco_venda?.message}
              label="Valor de venda"
              min={0}
              step="0.01"
              type="number"
              {...produtoForm.register('preco_venda')}
            />
          </div>

          <Select
            error={produtoForm.formState.errors.ativo?.message}
            label="Status"
            options={[
              { label: 'Ativo', value: 'true' },
              { label: 'Inativo', value: 'false' },
            ]}
            {...produtoForm.register('ativo')}
          />

          <div className="mt-4 flex flex-nowrap justify-end gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800 sm:gap-3 sm:pt-4">
            <Button
              className="h-10 px-4"
              onClick={closeFormModal}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              className="h-10 px-4"
              disabled={
                produtoForm.formState.isSubmitting || saveMutation.isPending
              }
              data-subscription-write="true"
              type="submit"
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar produto'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(stockProduto)}
        onClose={() => setStockProduto(null)}
        title={`Entrada de estoque - ${stockProduto?.nome ?? ''}`}
      >
        <form
          className="space-y-4"
          onSubmit={estoqueForm.handleSubmit(onSubmitStock)}
        >
          {stockError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {stockError}
            </p>
          )}
          <Input
            error={estoqueForm.formState.errors.quantidade?.message}
            label="Quantidade"
            min={1}
            step="1"
            type="number"
            {...estoqueForm.register('quantidade')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setStockProduto(null)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={stockMutation.isPending} type="submit">
              {stockMutation.isPending ? 'Salvando...' : 'Registrar entrada'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(saleProduto)}
        onClose={() => setSaleProduto(null)}
        title={`Venda de produto - ${saleProduto?.nome ?? ''}`}
      >
        <form
          className="space-y-4"
          onSubmit={vendaForm.handleSubmit(onSubmitSale)}
        >
          {saleError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saleError}
            </p>
          )}
          <Input
            error={vendaForm.formState.errors.quantidade?.message}
            label="Quantidade"
            min={1}
            step="1"
            type="number"
            {...vendaForm.register('quantidade')}
          />
          <Select
            error={vendaForm.formState.errors.forma_pagamento?.message}
            label="Forma de pagamento"
            options={[
              { label: 'Dinheiro', value: 'Dinheiro' },
              { label: 'Pix', value: 'Pix' },
              { label: 'Cartão de crédito', value: 'Cartão de crédito' },
              { label: 'Cartão de débito', value: 'Cartão de débito' },
            ]}
            {...vendaForm.register('forma_pagamento')}
          />
          <p className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
            A venda gera entrada no caixa e baixa o estoque automaticamente. Não
            há comissão para barbeiro.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setSaleProduto(null)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={saleMutation.isPending} type="submit">
              {saleMutation.isPending ? 'Vendendo...' : 'Registrar venda'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
