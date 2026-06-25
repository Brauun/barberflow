import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Eye, EyeOff, Lock, User } from 'lucide-react'
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
  const [showPassword, setShowPassword] = useState(false)
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
          <div className="relative mt-2">
            <User
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5C7090]"
              size={18}
            />
            <input
              className="h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] pl-11 pr-4 text-base font-medium text-white outline-none transition duration-200 placeholder:text-[#A5B4CB]/60 hover:border-[#12C6F3]/30 focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
              placeholder="exemplo@exemplo.com ou (51) 9 9999-9999"
              type="text"
              {...register('email')}
            />
          </div>
          {errors.email && (
            <span className="mt-2 block text-sm text-rose-200">
              {errors.email.message}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-white">Senha</span>
          <div className="relative mt-2">
            <Lock
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5C7090]"
              size={18}
            />
            <input
              className="h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] pl-11 pr-12 text-base font-medium text-white outline-none transition duration-200 placeholder:text-[#A5B4CB]/60 hover:border-[#12C6F3]/30 focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
              placeholder="Digite sua senha"
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
            />
            <button
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5C7090] transition hover:text-[#12C6F3]"
              onClick={() => setShowPassword((current) => !current)}
              type="button"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <span className="mt-2 block text-sm text-rose-200">
              {errors.password.message}
            </span>
          )}
        </label>

        <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[0.78rem] sm:text-sm">
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 font-medium text-[#A5B4CB]">
            <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center sm:h-4 sm:w-4">
              <input
                className="peer h-5 w-5 shrink-0 appearance-none rounded border border-white/15 bg-white/5 transition checked:border-[#12C6F3] checked:bg-[#12C6F3] focus:outline-none focus:ring-2 focus:ring-[#12C6F3]/40 sm:h-4 sm:w-4"
                type="checkbox"
              />
              <Check
                className="pointer-events-none absolute text-[var(--bf-background)] opacity-0 transition peer-checked:opacity-100"
                size={13}
                strokeWidth={3}
              />
            </span>
            <span className="whitespace-nowrap">Lembrar acesso</span>
          </label>
          <Link
            className="shrink-0 whitespace-nowrap font-semibold text-[#12C6F3] transition hover:text-white"
            to="/recuperar-senha"
          >
            Esqueci minha senha
          </Link>
        </div>

        <button
          className="min-h-11 h-12 w-full rounded-2xl bg-gradient-to-r from-[#12C6F3] to-[#0EA5E9] px-4 text-sm font-black text-[var(--bf-background)] shadow-[0_16px_40px_rgb(18_198_243/0.22)] transition duration-200 hover:-translate-y-0.5 hover:from-[#4EDCFF] hover:to-[#22C3F9] hover:shadow-[0_20px_48px_rgb(18_198_243/0.30)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-70 sm:h-14 sm:rounded-[18px]"
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
