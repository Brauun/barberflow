import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { AuthFormMessage } from '../components/AuthFormMessage'
import { signInWithPassword } from '../services/authService'
import { loginSchema, type LoginFormData } from '../types/auth'

type LocationState = {
  from?: {
    pathname?: string
  }
}

export function LoginPage() {
  const [formError, setFormError] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as LocationState | null
  const redirectTo = locationState?.from?.pathname ?? '/perfil'

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    setFormError(null)

    try {
      await signInWithPassword(data)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Nao foi possivel entrar.',
      )
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
        Acesso
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-normal">
        Entrar no BarberFlow
      </h1>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <AuthFormMessage message={formError} />

        <label className="block">
          <span className="text-sm font-medium text-ink-700">E-mail</span>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            type="email"
            {...register('email')}
          />
          {errors.email && (
            <span className="mt-1 block text-sm text-red-600">
              {errors.email.message}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink-700">Senha</span>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            type="password"
            {...register('password')}
          />
          {errors.password && (
            <span className="mt-1 block text-sm text-red-600">
              {errors.password.message}
            </span>
          )}
        </label>

        <button
          className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link className="font-medium text-brand-600" to="/recuperar-senha">
          Esqueci minha senha
        </Link>
        <Link className="font-medium text-brand-600" to="/cadastro">
          Criar conta
        </Link>
      </div>
    </div>
  )
}
