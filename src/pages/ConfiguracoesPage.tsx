import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  ChevronRight,
  ImagePlus,
  Monitor,
  Moon,
  Paintbrush,
  Save,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { Button, Card, CardContent, CardHeader, Input } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import {
  updateEmpresaSettings,
  updateUserProfile,
} from '../services/configuracoesService'
import {
  resolveAssetUrl,
  uploadCompanyLogo,
  uploadUserAvatar,
} from '../services/assetsService'
import {
  empresaSettingsSchema,
  userProfileSchema,
  type EmpresaSettingsFormData,
  type EmpresaSettingsFormInput,
  type UserProfileFormData,
  type UserProfileFormInput,
} from '../types/configuracoes'
import { formatPhone, maskPhoneChange } from '../utils/masks'

type SettingsRowProps = {
  description: string
  icon: ReactNode
  title: string
  value?: string
}

function SettingsRow({ description, icon, title, value }: SettingsRowProps) {
  return (
    <div className="flex items-center gap-4 rounded-[1.35rem] border border-slate-200/70 bg-white p-4 shadow-[0_12px_44px_rgb(15_23_42/0.025)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-600">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-slate-950">{title}</p>
          {value && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
              {value}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <ChevronRight className="shrink-0 text-slate-300" size={18} />
    </div>
  )
}

export function ConfiguracoesPage() {
  const { profile, refreshProfile } = useAuth()
  const { resolvedTheme, setTheme, theme } = useTheme()
  const queryClient = useQueryClient()
  const [empresaError, setEmpresaError] = useState<string | null>(null)
  const [perfilError, setPerfilError] = useState<string | null>(null)
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null)
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

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

  const watchedLogoUrl = useWatch({
    control: empresaForm.control,
    name: 'logo_url',
  })
  const watchedAvatarUrl = useWatch({
    control: perfilForm.control,
    name: 'avatar_url',
  })

  useEffect(() => {
    empresaForm.reset({
      bairro: empresa?.bairro ?? '',
      cep: empresa?.cep ?? '',
      cidade: empresa?.cidade ?? '',
      complemento: empresa?.complemento ?? '',
      email: empresa?.email ?? '',
      endereco: empresa?.endereco ?? '',
      estado: empresa?.estado ?? '',
      latitude: empresa?.latitude ?? null,
      logo_url: empresa?.logo_url ?? '',
      longitude: empresa?.longitude ?? null,
      nome: empresa?.nome ?? '',
      numero: empresa?.numero ?? '',
      percentual_comissao_padrao: empresa?.percentual_comissao_padrao ?? 60,
      rua: empresa?.rua ?? '',
      telefone: formatPhone(empresa?.telefone),
    })
  }, [empresa, empresaForm])

  useEffect(() => {
    let active = true

    if (companyLogoFile) {
      return undefined
    }

    void resolveAssetUrl('company-assets', empresa?.logo_url).then((url) => {
      if (active) {
        setCompanyLogoPreview(url)
      }
    })

    return () => {
      active = false
    }
  }, [companyLogoFile, empresa?.logo_url])

  useEffect(() => {
    perfilForm.reset({
      avatar_url: profile?.avatar_url ?? '',
      nome: profile?.nome ?? '',
      telefone: formatPhone(profile?.telefone),
    })
  }, [perfilForm, profile])

  useEffect(() => {
    let active = true

    if (avatarFile) {
      return undefined
    }

    void resolveAssetUrl('user-avatars', profile?.avatar_url).then((url) => {
      if (active) {
        setAvatarPreview(url)
      }
    })

    return () => {
      active = false
    }
  }, [avatarFile, profile?.avatar_url])

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

  async function onSubmitEmpresa(data: EmpresaSettingsFormData) {
    setEmpresaError(null)

    try {
      let logoUrl = data.logo_url

      if (empresaId && companyLogoFile) {
        logoUrl = await uploadCompanyLogo(empresaId, companyLogoFile)
      }

      await empresaMutation.mutateAsync({ ...data, logo_url: logoUrl })
      setCompanyLogoFile(null)
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
      let avatarUrl = data.avatar_url

      if (profile?.id && avatarFile) {
        avatarUrl = await uploadUserAvatar(profile.id, avatarFile)
      }

      await perfilMutation.mutateAsync({ ...data, avatar_url: avatarUrl })
      setAvatarFile(null)
    } catch (error) {
      setPerfilError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel salvar o perfil.',
      )
    }
  }

  function removeCompanyLogo() {
    setCompanyLogoFile(null)
    setCompanyLogoPreview(null)
    empresaForm.setValue('logo_url', '')
  }

  function removeAvatar() {
    setAvatarFile(null)
    setAvatarPreview(null)
    perfilForm.setValue('avatar_url', '')
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

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
            Central de ajustes
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Atalhos visuais para empresa, perfil e aparencia.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              Empresa
            </p>
            <div className="space-y-3">
              <SettingsRow
                description={
                  empresa?.telefone
                    ? formatPhone(empresa.telefone)
                    : 'Telefone nao informado'
                }
                icon={<Building2 size={19} />}
                title={empresa?.nome ?? 'Barbearia'}
                value={empresa?.email ?? 'Email nao informado'}
              />
              <SettingsRow
                description={empresa?.endereco ?? 'Endereco nao informado'}
                icon={<Save size={19} />}
                title="Comissao padrao"
                value={`${empresa?.percentual_comissao_padrao ?? 60}%`}
              />
            </div>
          </div>

          <div>
            <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              Sistema
            </p>
            <div className="space-y-3">
              <SettingsRow
                description="Preferencia visual aplicada ao app"
                icon={<Paintbrush size={19} />}
                title="Tema"
                value={
                  theme === 'system'
                    ? `Sistema (${resolvedTheme === 'light' ? 'claro' : 'escuro'})`
                    : theme === 'light'
                      ? 'Claro'
                      : 'Escuro'
                }
              />
              <SettingsRow
                description={
                  profile?.telefone
                    ? formatPhone(profile.telefone)
                    : 'Telefone nao informado'
                }
                icon={<UserRound size={19} />}
                title={profile?.nome ?? 'Usuario'}
                value={profile?.papel ?? 'perfil'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
                placeholder="Nome da barbearia"
                {...empresaForm.register('nome')}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  error={empresaForm.formState.errors.telefone?.message}
                  inputMode="numeric"
                  label="Telefone"
                  placeholder="(99) 9 9999-9999"
                  autoComplete="tel"
                  {...empresaForm.register('telefone', {
                    onChange: maskPhoneChange,
                  })}
                />
                <Input
                  error={empresaForm.formState.errors.email?.message}
                  label="Email"
                  placeholder="exemplo@exemplo.com"
                  type="email"
                  {...empresaForm.register('email')}
                />
              </div>

              <Input
                error={empresaForm.formState.errors.endereco?.message}
                label="Endereço"
                {...empresaForm.register('endereco')}
              />

              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                    Localizacao da barbearia
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Esses dados aparecem para o cliente e alimentam o botao Ver rota.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    error={empresaForm.formState.errors.cep?.message}
                    inputMode="numeric"
                    label="CEP"
                    placeholder="00000-000"
                    {...empresaForm.register('cep')}
                  />
                  <Input
                    error={empresaForm.formState.errors.rua?.message}
                    label="Rua"
                    placeholder="Rua Exemplo"
                    {...empresaForm.register('rua')}
                  />
                  <Input
                    error={empresaForm.formState.errors.numero?.message}
                    label="Numero"
                    placeholder="123"
                    {...empresaForm.register('numero')}
                  />
                  <Input
                    error={empresaForm.formState.errors.bairro?.message}
                    label="Bairro"
                    placeholder="Centro"
                    {...empresaForm.register('bairro')}
                  />
                  <Input
                    error={empresaForm.formState.errors.cidade?.message}
                    label="Cidade"
                    placeholder="Porto Alegre"
                    {...empresaForm.register('cidade')}
                  />
                  <Input
                    error={empresaForm.formState.errors.estado?.message}
                    label="Estado"
                    maxLength={2}
                    placeholder="RS"
                    {...empresaForm.register('estado')}
                  />
                  <Input
                    error={empresaForm.formState.errors.complemento?.message}
                    label="Complemento"
                    placeholder="Sala, andar ou referencia"
                    {...empresaForm.register('complemento')}
                  />
                  <Input
                    error={empresaForm.formState.errors.latitude?.message}
                    label="Latitude"
                    placeholder="-30.034647"
                    step="0.0000001"
                    type="number"
                    {...empresaForm.register('latitude')}
                  />
                  <Input
                    error={empresaForm.formState.errors.longitude?.message}
                    label="Longitude"
                    placeholder="-51.217658"
                    step="0.0000001"
                    type="number"
                    {...empresaForm.register('longitude')}
                  />
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-brand-100 bg-brand-50 text-brand-600 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-200">
                    {companyLogoPreview ? (
                      <img
                        alt="Logo da barbearia"
                        className="h-full w-full object-cover"
                        src={companyLogoPreview}
                      />
                    ) : (
                      <Building2 size={26} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                      Logo da barbearia
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      PNG, JPG, JPEG ou WEBP ate 2MB.
                    </p>
                    {empresaForm.formState.errors.logo_url?.message && (
                      <p className="mt-2 text-sm text-red-600">
                        {empresaForm.formState.errors.logo_url.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                      <ImagePlus size={16} />
                      Trocar
                      <input
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="sr-only"
                        type="file"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          setCompanyLogoFile(file)
                          setCompanyLogoPreview(
                            file ? URL.createObjectURL(file) : null,
                          )
                        }}
                      />
                    </label>
                    {(companyLogoPreview || watchedLogoUrl) && (
                      <Button
                        leftIcon={<Trash2 size={16} />}
                        onClick={removeCompanyLogo}
                        type="button"
                        variant="secondary"
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
                <input type="hidden" {...empresaForm.register('logo_url')} />
              </div>

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
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <Button
                  leftIcon={<Sun size={18} />}
                  onClick={() => setTheme('light')}
                  variant={theme === 'light' ? 'primary' : 'secondary'}
                >
                  Claro
                </Button>
                <Button
                  leftIcon={<Moon size={18} />}
                  onClick={() => setTheme('dark')}
                  variant={theme === 'dark' ? 'primary' : 'secondary'}
                >
                  Escuro
                </Button>
                <Button
                  leftIcon={<Monitor size={18} />}
                  onClick={() => setTheme('system')}
                  variant={theme === 'system' ? 'primary' : 'secondary'}
                >
                  Sistema
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
                  placeholder="Joao Silva"
                  {...perfilForm.register('nome')}
                />

                <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-100 bg-brand-50 text-brand-600 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-200">
                      {avatarPreview ? (
                        <img
                          alt="Foto de perfil"
                          className="h-full w-full object-cover"
                          src={avatarPreview}
                        />
                      ) : (
                        <UserRound size={26} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                        Foto de perfil
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Usada na sidebar e no perfil do usuario.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                        <ImagePlus size={16} />
                        Trocar
                        <input
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="sr-only"
                          type="file"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null
                            setAvatarFile(file)
                            setAvatarPreview(file ? URL.createObjectURL(file) : null)
                          }}
                        />
                      </label>
                      {(avatarPreview || watchedAvatarUrl) && (
                        <Button
                          leftIcon={<Trash2 size={16} />}
                          onClick={removeAvatar}
                          type="button"
                          variant="secondary"
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                  <input type="hidden" {...perfilForm.register('avatar_url')} />
                </div>

                <Input
                  error={perfilForm.formState.errors.telefone?.message}
                  inputMode="numeric"
                  label="Telefone"
                  placeholder="(99) 9 9999-9999"
                  autoComplete="tel"
                  {...perfilForm.register('telefone', {
                    onChange: maskPhoneChange,
                  })}
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
