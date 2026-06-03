import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Moon, Save, Sun, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button, Card, CardContent, CardHeader, Input } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  updateEmpresaSettings,
  updateUserProfile,
} from '../services/configuracoesService'
import {
  empresaSettingsSchema,
  userProfileSchema,
  type EmpresaSettingsFormData,
  type EmpresaSettingsFormInput,
  type UserProfileFormData,
  type UserProfileFormInput,
} from '../types/configuracoes'

export function ConfiguracoesPage() {
  const { profile, refreshProfile } = useAuth()
  const queryClient = useQueryClient()
  const [empresaError, setEmpresaError] = useState<string | null>(null)
  const [perfilError, setPerfilError] = useState<string | null>(null)
  const [theme, setTheme] = useState(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  const empresaId = profile?.empresa_id
  const empresa = profile?.empresa

  const empresaForm = useForm<
    EmpresaSettingsFormInput,
    unknown,
    EmpresaSettingsFormData
  >({
    resolver: zodResolver(empresaSettingsSchema),
  })

  const perfilForm = useForm<
    UserProfileFormInput,
    unknown,
    UserProfileFormData
  >({
    resolver: zodResolver(userProfileSchema),
  })

  useEffect(() => {
    empresaForm.reset({
      email: empresa?.email ?? '',
      endereco: empresa?.endereco ?? '',
      logo_url: empresa?.logo_url ?? '',
      nome: empresa?.nome ?? '',
      percentual_comissao_padrao: empresa?.percentual_comissao_padrao ?? 60,
      telefone: empresa?.telefone ?? '',
    })
  }, [empresa, empresaForm])

  useEffect(() => {
    perfilForm.reset({
      nome: profile?.nome ?? '',
      telefone: profile?.telefone ?? '',
    })
  }, [perfilForm, profile])

  const empresaMutation = useMutation({
    mutationFn: async (data: EmpresaSettingsFormData) => {
      if (!empresaId) {
        throw new Error('Empresa nao encontrada.')
      }

      await updateEmpresaSettings(empresaId, data)
    },
    onSuccess: async () => {
      await refreshProfile()
      await queryClient.invalidateQueries()
      setEmpresaError(null)
    },
  })

  const perfilMutation = useMutation({
    mutationFn: async (data: UserProfileFormData) => {
      if (!empresaId || !profile?.id) {
        throw new Error('Perfil nao encontrado.')
      }

      await updateUserProfile(empresaId, profile.id, data)
    },
    onSuccess: async () => {
      await refreshProfile()
      setPerfilError(null)
    },
  })

  function updateTheme(nextTheme: 'dark' | 'light') {
    setTheme(nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
    localStorage.setItem('barberflow-theme', nextTheme)
  }

  async function onSubmitEmpresa(data: EmpresaSettingsFormData) {
    setEmpresaError(null)

    try {
      await empresaMutation.mutateAsync(data)
    } catch (error) {
      setEmpresaError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel salvar a empresa.',
      )
    }
  }

  async function onSubmitPerfil(data: UserProfileFormData) {
    setPerfilError(null)

    try {
      await perfilMutation.mutateAsync(data)
    } catch (error) {
      setPerfilError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel salvar o perfil.',
      )
    }
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Complete o vínculo do usuário com uma empresa para acessar as
            configurações.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-400">
          Configurações
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
          Empresa, perfil e tema
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Atualize os dados da barbearia, comissão padrão, aparência do sistema
          e informações do usuário.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="text-brand-600 dark:text-brand-400" size={22} />
              <div>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  Dados da empresa
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Informações principais da barbearia.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={empresaForm.handleSubmit(onSubmitEmpresa)}
            >
              {empresaError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {empresaError}
                </p>
              )}

              <Input
                error={empresaForm.formState.errors.nome?.message}
                label="Nome da barbearia"
                {...empresaForm.register('nome')}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  error={empresaForm.formState.errors.telefone?.message}
                  label="Telefone"
                  {...empresaForm.register('telefone')}
                />
                <Input
                  error={empresaForm.formState.errors.email?.message}
                  label="Email"
                  type="email"
                  {...empresaForm.register('email')}
                />
              </div>

              <Input
                error={empresaForm.formState.errors.endereco?.message}
                label="Endereço"
                {...empresaForm.register('endereco')}
              />

              <Input
                error={empresaForm.formState.errors.logo_url?.message}
                label="Logo"
                placeholder="https://..."
                {...empresaForm.register('logo_url')}
              />

              <Input
                error={
                  empresaForm.formState.errors.percentual_comissao_padrao
                    ?.message
                }
                label="Comissão padrão (%)"
                max={100}
                min={0}
                step="0.01"
                type="number"
                {...empresaForm.register('percentual_comissao_padrao')}
              />

              <div className="flex justify-end">
                <Button
                  disabled={empresaMutation.isPending}
                  leftIcon={<Save size={18} />}
                  type="submit"
                >
                  {empresaMutation.isPending ? 'Salvando...' : 'Salvar empresa'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Tema
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Ajuste a aparência do sistema.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Button
                  leftIcon={<Sun size={18} />}
                  onClick={() => updateTheme('light')}
                  variant={theme === 'light' ? 'primary' : 'secondary'}
                >
                  Claro
                </Button>
                <Button
                  leftIcon={<Moon size={18} />}
                  onClick={() => updateTheme('dark')}
                  variant={theme === 'dark' ? 'primary' : 'secondary'}
                >
                  Escuro
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <UserRound
                  className="text-brand-600 dark:text-brand-400"
                  size={22}
                />
                <div>
                  <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                    Perfil do usuário
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Gerencie seus dados de exibição.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={perfilForm.handleSubmit(onSubmitPerfil)}
              >
                {perfilError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {perfilError}
                  </p>
                )}

                <Input
                  error={perfilForm.formState.errors.nome?.message}
                  label="Nome"
                  {...perfilForm.register('nome')}
                />

                <Input
                  error={perfilForm.formState.errors.telefone?.message}
                  label="Telefone"
                  {...perfilForm.register('telefone')}
                />

                <div className="flex justify-end">
                  <Button
                    disabled={perfilMutation.isPending}
                    leftIcon={<Save size={18} />}
                    type="submit"
                  >
                    {perfilMutation.isPending ? 'Salvando...' : 'Salvar perfil'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
