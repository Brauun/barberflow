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
      setSuccessMessage('Enviamos as instrucoes de recuperação para seu e-mail.')
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a recuperação.',
      )
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[#12C6F3]">
        Recuperação
      </p>
      <h1 className="mt-2 text-[1.85rem] font-black leading-[1.08] tracking-normal text-white sm:mt-3 sm:text-3xl">
        Recuperar senha
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#A5B4CB] sm:text-[0.95rem]">
        Informe o e-mail da conta para receber o link de redefinicao.
      </p>

      <form className="mt-5 space-y-4 sm:mt-8 sm:space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <AuthFormMessage message={formError} />
        <AuthFormMessage message={successMessage} tone="success" />

        <label className="block">
          <span className="text-sm font-semibold text-white">Email</span>
          <input
            className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[#17304A]/60 focus:border-[#12C6F3] focus:bg-[#17304A]/80 focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
            placeholder="exemplo@exemplo.com"
            type="email"
            {...register('email')}
          />
          {errors.email && (
            <span className="mt-2 block text-sm text-rose-200">
              {errors.email.message}
            </span>
          )}
        </label>

        <button
          className="min-h-11 h-12 w-full rounded-2xl bg-[#12C6F3] px-4 text-sm font-black text-[#071426] shadow-[0_16px_40px_rgb(18_198_243/0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#4EDCFF] hover:shadow-[0_20px_48px_rgb(18_198_243/0.30)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-70 sm:h-14 sm:rounded-[18px]"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar recuperação'}
        </button>
      </form>

      <Link className="mt-5 inline-flex text-sm font-bold text-[#12C6F3] transition hover:text-white sm:mt-7" to="/login">
        Voltar para login
      </Link>
    </div>
  )
}
