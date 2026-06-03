import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { AuthFormMessage } from '../components/AuthFormMessage'
import { sendPasswordResetEmail } from '../services/authService'
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from '../types/auth'

export function ForgotPasswordPage() {
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  async function onSubmit(data: ForgotPasswordFormData) {
    setFormError(null)
    setSuccessMessage(null)

    try {
      await sendPasswordResetEmail(data.email)
      setSuccessMessage('Enviamos as instrucoes de recuperacao para seu e-mail.')
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel enviar a recuperacao.',
      )
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
        Recuperacao
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-normal">
        Recuperar senha
      </h1>
      <p className="mt-3 text-sm leading-6 text-ink-700">
        Informe o e-mail da conta para receber o link de redefinicao.
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <AuthFormMessage message={formError} />
        <AuthFormMessage message={successMessage} tone="success" />

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

        <button
          className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar recuperacao'}
        </button>
      </form>

      <Link className="mt-6 inline-flex text-sm font-medium text-brand-600" to="/login">
        Voltar para login
      </Link>
    </div>
  )
}
