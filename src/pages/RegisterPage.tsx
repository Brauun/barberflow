import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'

import { AuthFormMessage } from '../components/AuthFormMessage'
import { useAuth } from '../hooks/useAuth'
import { signUpWithCompany } from '../services/authService'
import {
  registerSchema,
  type RegisterFormData,
  type RegisterFormInput,
} from '../types/auth'

export function RegisterPage() {
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<RegisterFormInput, unknown, RegisterFormData>({
    defaultValues: {
      papel: 'administrador',
    },
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterFormData) {
    setFormError(null)
    setSuccessMessage(null)

    try {
      const result = await signUpWithCompany(data)

      if (result.needsEmailConfirmation) {
        setSuccessMessage(
          'Cadastro recebido. A empresa e o usuario administrador serao vinculados automaticamente apos confirmar seu e-mail.',
        )
        return
      }

      const profile = await refreshProfile()

      if (!profile?.empresa_id) {
        throw new Error(
          'Conta criada no Auth, mas o vinculo com empresa nao foi encontrado. Verifique se a migration de cadastro foi aplicada no Supabase.',
        )
      }

      navigate('/app/dashboard', { replace: true })
    } catch (error) {
      console.error('Erro no cadastro do BarberFlow:', error)
      setFormError(
        error instanceof Error ? error.message : 'Nao foi possivel cadastrar.',
      )
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
        Cadastro
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-normal">
        Criar empresa e usuario
      </h1>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <AuthFormMessage message={formError} />
        <AuthFormMessage message={successMessage} tone="success" />

        <label className="block">
          <span className="text-sm font-medium text-ink-700">Nome</span>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            {...register('nome')}
          />
          {errors.nome && (
            <span className="mt-1 block text-sm text-red-600">
              {errors.nome.message}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink-700">Empresa</span>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            {...register('empresa')}
          />
          {errors.empresa && (
            <span className="mt-1 block text-sm text-red-600">
              {errors.empresa.message}
            </span>
          )}
        </label>

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
          <span className="text-sm font-medium text-ink-700">Telefone</span>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            {...register('telefone')}
          />
        </label>

        <input type="hidden" value="administrador" {...register('papel')} />

        <div className="grid gap-4 sm:grid-cols-2">
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

          <label className="block">
            <span className="text-sm font-medium text-ink-700">
              Confirmar senha
            </span>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              type="password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <span className="mt-1 block text-sm text-red-600">
                {errors.confirmPassword.message}
              </span>
            )}
          </label>
        </div>

        <button
          className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-700">
        Ja tem conta?{' '}
        <Link className="font-medium text-brand-600" to="/login">
          Entrar
        </Link>
      </p>
    </div>
  )
}
