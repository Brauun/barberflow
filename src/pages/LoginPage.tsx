import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { AuthFormMessage } from '../components/AuthFormMessage'
import { useAuth } from '../hooks/useAuth'
import { logger } from '../lib/logger'
import { signInWithPassword } from '../services/authService'
import { createAuditLog, handleAppError } from '../services/observabilityService'
import { loginSchema, type LoginFormData } from '../types/auth'

type LocationState = {
  from?: {
    pathname?: string
  }
}

function devAuthLog(message: string, details?: unknown) {
  if (!import.meta.env.DEV) {
    return
  }

  logger.info({
    action: 'auth_login_debug',
    area: 'auth',
    message,
    metadata: details ? { details } : {},
  })
}

export function LoginPage() {
  const [formError, setFormError] = useState<string | null>(null)
  const [isEntering, setIsEntering] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { profileLoading, refreshProfile } = useAuth()
  const locationState = location.state as LocationState | null
  const explicitRedirectTo = locationState?.from?.pathname

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    setFormError(null)
    setIsEntering(true)
    devAuthLog('login iniciado')

    try {
      const authData = await signInWithPassword(data)
      if (!authData.session || !authData.user) {
        throw new Error('Login realizado, mas a sessão não foi retornada.')
      }

      devAuthLog('login sucesso', { userId: authData.user.id })
      const profile = await refreshProfile(authData.session)
      const isClient = authData.user?.user_metadata.role === 'cliente'
      await createAuditLog({
        action: 'login',
        empresaId: profile?.empresa_id ?? null,
        entityId: authData.user.id,
        entityType: 'auth',
        userRole: profile?.papel ?? (isClient ? 'cliente' : null),
      })
      const redirectTo =
        explicitRedirectTo ??
        (isClient && !profile?.empresa_id ? '/cliente' : '/app/dashboard')

      devAuthLog('redirect realizado', { redirectTo })

      navigate(redirectTo, { replace: true })
    } catch (error) {
      setFormError(
        await handleAppError({
          action: 'login_failed',
          area: 'auth_login',
          error,
          level: 'warn',
        }),
      )
      setIsEntering(false)
    }
  }

  const showEnteringState = isSubmitting || isEntering || profileLoading

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[#12C6F3]">
        Acesso
      </p>
      <h1 className="mt-2 text-[1.85rem] font-black leading-[1.08] tracking-normal text-white sm:mt-3 sm:text-3xl">
        Bem vindo(a) ao BW Barber
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#A5B4CB] sm:text-[0.95rem]">
        Acesse sua conta para gerenciar horários, clientes e operação.
      </p>

      <form className="mt-5 space-y-4 sm:mt-8 sm:space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <AuthFormMessage message={formError} />
        {showEnteringState && (
          <p className="rounded-2xl border border-[#12C6F3]/20 bg-[#12C6F3]/10 px-4 py-3 text-sm font-semibold text-[#B9F3FF]">
            Entrando no BW Barber...
          </p>
        )}

        <label className="block">
          <span className="text-sm font-semibold text-white">
            Telefone ou Email
          </span>
          <input
            className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-base font-medium sm:text-sm text-white outline-none transition duration-200 placeholder:text-[#A5B4CB]/60 hover:border-[#12C6F3]/30 hover:bg-[#17304A]/60 focus:border-[#12C6F3] focus:bg-[#17304A]/80 focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px]"
            placeholder="exemplo@exemplo.com ou (51) 9 9999-9999"
            type="text"
            {...register('email')}
          />
          {errors.email && (
            <span className="mt-2 block text-sm text-rose-200">
              {errors.email.message}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-white">Senha</span>
          <input
            className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-base font-medium sm:text-sm text-white outline-none transition duration-200 placeholder:text-[#A5B4CB]/60 hover:border-[#12C6F3]/30 hover:bg-[#17304A]/60 focus:border-[#12C6F3] focus:bg-[#17304A]/80 focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px]"
            placeholder="Digite sua senha"
            type="password"
            {...register('password')}
          />
          {errors.password && (
            <span className="mt-2 block text-sm text-rose-200">
              {errors.password.message}
            </span>
          )}
        </label>

        <div className="flex w-full items-center justify-between gap-2 text-[0.78rem] min-[390px]:text-sm">
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 font-medium text-[#A5B4CB]">
            <input
              className="h-5 w-5 shrink-0 rounded border-white/10 bg-white/5 accent-[#12C6F3] sm:h-4 sm:w-4"
              type="checkbox"
            />
            <span className="whitespace-nowrap">Lembrar acesso</span>
          </label>
          <Link className="ml-auto shrink-0 whitespace-nowrap text-right font-semibold text-[#12C6F3] transition hover:text-white" to="/recuperar-senha">
            Esqueci minha senha
          </Link>
        </div>

        <button
          className="min-h-11 h-12 w-full rounded-2xl bg-[#12C6F3] px-4 text-sm font-black text-[#071426] shadow-[0_16px_40px_rgb(18_198_243/0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#4EDCFF] hover:shadow-[0_20px_48px_rgb(18_198_243/0.30)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-70 sm:h-14 sm:rounded-[18px]"
          disabled={showEnteringState}
          type="submit"
        >
          {showEnteringState ? 'Entrando no BW Barber...' : 'Entrar'}
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-[#A5B4CB] sm:mt-7">
        Ainda nao tem acesso?{' '}
        <Link className="font-bold text-[#12C6F3] transition hover:text-white" to="/cadastro">
          Criar conta
        </Link>
      </div>
    </div>
  )
}
