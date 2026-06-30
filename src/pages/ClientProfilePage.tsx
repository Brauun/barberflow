import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ImagePlus, Save, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { Button, Card, CardContent, Input } from '../components/ui'
import { PushNotificationControl } from '../components/pwa/PushNotificationControl'
import { useAuth } from '../hooks/useAuth'
import {
  resolveAssetUrl,
  uploadUserAvatar,
} from '../services/assetsService'
import { updateClientProfile } from '../services/clientService'
import { formatPhone, maskPhoneChange, onlyDigits } from '../utils/masks'

const clientProfileSchema = z.object({
  avatar_url: z.string().optional(),
  nome: z.string().min(2, 'Informe seu nome.'),
  telefone: z
    .string()
    .optional()
    .refine((value) => !value || onlyDigits(value).length === 11, {
      message: 'Informe um telefone com 11 dígitos.',
    }),
})

type ClientProfileFormData = z.infer<typeof clientProfileSchema>

export function ClientProfilePage() {
  const { clientProfile, refreshProfile, user } = useAuth()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<ClientProfileFormData>({
    resolver: zodResolver(clientProfileSchema),
    values: {
      avatar_url: clientProfile?.avatar_url ?? '',
      nome: clientProfile?.nome ?? '',
      telefone: formatPhone(clientProfile?.telefone),
    },
  })

  const watchedAvatarUrl = useWatch({
    control,
    name: 'avatar_url',
  })

  useEffect(() => {
    let active = true

    if (avatarFile) {
      return undefined
    }

    void resolveAssetUrl('user-avatars', clientProfile?.avatar_url).then((url) => {
      if (active) {
        setAvatarPreview(url)
      }
    })

    return () => {
      active = false
    }
  }, [avatarFile, clientProfile?.avatar_url])

  const profileMutation = useMutation({
    mutationFn: async (data: ClientProfileFormData) => {
      if (!clientProfile) {
        throw new Error('Perfil de cliente não encontrado.')
      }

      let avatarUrl = data.avatar_url

      if (avatarFile) {
        avatarUrl = await uploadUserAvatar(clientProfile.id, avatarFile)
      }

      await updateClientProfile(clientProfile, {
        avatar_url: avatarUrl,
        nome: data.nome,
        telefone: data.telefone,
      })
    },
    onSuccess: async () => {
      await refreshProfile()
      setAvatarFile(null)
      setFormError(null)
    },
  })

  async function onSubmit(data: ClientProfileFormData) {
    setFormError(null)

    try {
      await profileMutation.mutateAsync(data)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Não foi possível salvar.',
      )
    }
  }

  function removeAvatar() {
    setAvatarFile(null)
    setAvatarPreview(null)
    setValue('avatar_url', '')
  }

  function resetForm() {
    reset({
      avatar_url: clientProfile?.avatar_url ?? '',
      nome: clientProfile?.nome ?? '',
      telefone: formatPhone(clientProfile?.telefone),
    })
    setAvatarFile(null)
  }

  return (
    <div className="min-w-0 max-w-full space-y-5 sm:space-y-8">
      <section>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600">
          Perfil
        </p>
        <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-slate-50">
          {clientProfile?.nome ?? 'Cliente'}
        </h2>
      </section>

      <Card>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {formError && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </p>
            )}

            <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-[var(--bf-border)] dark:bg-[var(--bf-surface)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-100 bg-brand-50 text-brand-600 dark:border-[var(--bf-border)] dark:bg-[var(--bf-surface-muted)] dark:text-slate-100">
                  {avatarPreview ? (
                    <img
                      alt="Foto de perfil"
                      className="h-full w-full object-cover"
                      src={avatarPreview}
                    />
                  ) : (
                    <UserRound size={28} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                    Foto de perfil
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    PNG, JPG, JPEG ou WEBP até 2MB.
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
              <input type="hidden" {...register('avatar_url')} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                error={errors.nome?.message}
                label="Nome"
                placeholder="Joao Silva"
                {...register('nome')}
              />
              <Input
                error={errors.telefone?.message}
                inputMode="numeric"
                label="Telefone"
                placeholder="(99) 9 9999-9999"
                autoComplete="tel"
                {...register('telefone', {
                  onChange: maskPhoneChange,
                })}
              />
            </div>

            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Email</p>
              <p className="mt-2 break-words font-black text-slate-950 dark:text-slate-50">
                {clientProfile?.email ?? user?.email ?? '-'}
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Button onClick={resetForm} type="button" variant="secondary">
                Cancelar
              </Button>
              <Button
                disabled={isSubmitting || profileMutation.isPending}
                leftIcon={<Save size={18} />}
                type="submit"
              >
                {profileMutation.isPending ? 'Salvando...' : 'Salvar perfil'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div
        id="notificacoes-push"
        className="min-w-0 scroll-mb-[calc(env(safe-area-inset-bottom)+6rem)]"
      >
        <PushNotificationControl />
      </div>
    </div>
  )
}
