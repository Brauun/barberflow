import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'

import { AuthFormMessage } from '../components/AuthFormMessage'
import { Button, Input } from '../components/ui'
import {
  acceptEmployeeInvitation,
  getEmployeeInvitationByToken,
} from '../services/employeesService'
import {
  acceptEmployeeInvitationSchema,
  type AcceptEmployeeInvitationFormData,
} from '../types/employees'
import { formatPhone, maskPhoneChange } from '../utils/masks'

export function EmployeeInvitePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const invitationQuery = useQuery({
    enabled: Boolean(token),
    queryFn: () => getEmployeeInvitationByToken(token),
    queryKey: ['employee-invite', token],
  })
  const invitation = invitationQuery.data
  const invitationUnavailableMessage =
    invitation?.status === 'expirado'
      ? 'Convite expirado. Solicite um novo convite à barbearia.'
      : invitation && invitation.status !== 'pendente'
        ? 'Este convite não está mais disponível. Solicite um novo convite à barbearia.'
        : null

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<AcceptEmployeeInvitationFormData>({
    resolver: zodResolver(acceptEmployeeInvitationSchema),
    values: {
      confirmPassword: '',
      nome: invitation?.nome ?? '',
      password: '',
      telefone: formatPhone(invitation?.telefone),
    },
  })

  const acceptMutation = useMutation({
    mutationFn: async (data: AcceptEmployeeInvitationFormData) => {
      if (!invitation) {
        throw new Error('Convite não encontrado.')
      }

      if (invitationUnavailableMessage) {
        throw new Error(invitationUnavailableMessage)
      }

      await acceptEmployeeInvitation({
        email: invitation.email,
        nome: data.nome,
        password: data.password,
        telefone: data.telefone,
        token,
      })
    },
    onSuccess: () => {
      navigate('/app/dashboard', { replace: true })
    },
  })

  async function onSubmit(data: AcceptEmployeeInvitationFormData) {
    await acceptMutation.mutateAsync(data)
  }

  return (
    <main className="dark bw-mobile-compact min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-[#071426] px-3 pb-[calc(0.85rem+env(safe-area-inset-bottom))] pt-[calc(0.85rem+env(safe-area-inset-top))] text-white sm:px-4 sm:py-5 md:px-6 md:py-8">
      <section className="mx-auto grid min-h-[calc(100dvh-1.7rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-[28rem] overflow-hidden rounded-[1.65rem] border border-white/[0.08] bg-[#0E1D32] shadow-[0_22px_70px_rgb(0_0_0/0.32)] sm:max-w-[34rem] sm:rounded-[2rem] md:max-w-5xl md:grid-cols-[0.92fr_1.08fr]">
        <div className="relative flex min-h-[9.5rem] items-center justify-center overflow-hidden bg-[#071426] px-6 py-5 sm:min-h-[12rem] sm:px-8 sm:py-7 md:min-h-full md:px-10 md:py-14">
          <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(135deg,rgba(255,255,255,0.10)_0_1px,transparent_1px_42px),linear-gradient(45deg,rgba(18,198,243,0.12)_0_1px,transparent_1px_56px)]" />
          <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(18,198,243,0.12)_0%,rgba(7,20,38,0)_42%),linear-gradient(180deg,rgba(14,29,50,0)_0%,rgba(14,29,50,0.72)_100%)]" />
          <div className="absolute inset-x-[-12%] bottom-[-3.4rem] h-24 rounded-[50%] bg-[#0E1D32] sm:bottom-[-4.5rem] sm:h-32 md:hidden" />
          <div className="absolute left-6 top-6 h-16 w-16 rounded-[1.25rem] border border-white/[0.06] bg-white/[0.03]" />
          <img
            alt="BW Barber"
            className="relative z-10 h-[4.7rem] w-auto max-w-[72%] object-contain sm:h-[6.5rem] md:h-[8.5rem] lg:h-[10rem]"
            src="/brand/bw-barber-login-logo.png"
          />
        </div>

        <div className="relative min-w-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 sm:px-8 sm:py-8 md:flex md:max-h-[calc(100dvh-4rem)] md:items-center md:overflow-y-auto md:px-10 md:py-10 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-7">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#12C6F3]">
                Convite BW Barber
              </p>
              <h1 className="mt-2 text-[1.85rem] font-black leading-[1.08] tracking-normal text-white sm:mt-3 sm:text-3xl">
                Crie sua senha
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#A5B4CB] sm:text-[0.95rem]">
                Você foi convidado para participar da{' '}
                <span className="font-semibold text-white">
                  {invitation?.empresa_nome ?? 'barbearia'}
                </span>
                . Defina sua senha para ativar o acesso.
              </p>
            </div>

            {invitationQuery.isLoading ? (
              <p className="text-sm text-[#A5B4CB]">Carregando convite...</p>
            ) : !invitation ? (
              <AuthFormMessage message="Convite não encontrado. Solicite um novo convite à barbearia." />
            ) : invitationUnavailableMessage ? (
              <AuthFormMessage message={invitationUnavailableMessage} />
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <AuthFormMessage
                  message={
                    acceptMutation.error instanceof Error
                      ? acceptMutation.error.message
                      : null
                  }
                />

                <div className="rounded-2xl border border-[#12C6F3]/20 bg-[#12C6F3]/10 px-4 py-3 text-sm font-semibold text-[#BDEEFF]">
                  <CheckCircle2 className="mr-2 inline" size={16} />
                  Convite para {invitation.email} · {invitation.empresa_nome ?? 'BW Barber'}
                </div>

                <Input
                  error={errors.nome?.message}
                  label="Nome"
                  placeholder="João Silva"
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
                <Input
                  error={errors.password?.message}
                  label="Senha"
                  placeholder="Digite sua senha"
                  type="password"
                  {...register('password')}
                />
                <Input
                  error={errors.confirmPassword?.message}
                  label="Confirmar senha"
                  placeholder="Digite sua senha"
                  type="password"
                  {...register('confirmPassword')}
                />

                <Button
                  className="h-12 w-full rounded-2xl bg-[#12C6F3] text-sm font-black text-[#071426] shadow-[0_16px_40px_rgb(18_198_243/0.22)] hover:bg-[#4EDCFF] dark:bg-[#12C6F3] dark:text-[#071426] dark:hover:bg-[#4EDCFF] sm:h-14 sm:rounded-[18px]"
                  disabled={isSubmitting || acceptMutation.isPending}
                  type="submit"
                >
                  {acceptMutation.isPending ? 'Ativando...' : 'Aceitar convite'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
