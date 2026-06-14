import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'

import { AuthFormMessage } from '../components/AuthFormMessage'
import { Button, Card, CardContent, Input } from '../components/ui'
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
    <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-10">
      <Card className="w-full max-w-xl">
        <CardContent>
          <div className="mb-8">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-brand-600">
              Convite BW Barber
            </p>
            <h1 className="mt-3 text-3xl font-black text-slate-950">
              Crie sua senha
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Você foi convidado para participar da{' '}
              <span className="font-semibold text-slate-700">
                {invitation?.empresa_nome ?? 'barbearia'}
              </span>
              . Defina sua senha para ativar o acesso.
            </p>
          </div>

          {invitationQuery.isLoading ? (
            <p className="text-sm text-slate-500">Carregando convite...</p>
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

              <div className="rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm font-semibold text-brand-700">
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
                className="w-full"
                disabled={isSubmitting || acceptMutation.isPending}
                type="submit"
              >
                {acceptMutation.isPending ? 'Ativando...' : 'Aceitar convite'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
