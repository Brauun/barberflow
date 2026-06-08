import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'

import { AuthFormMessage } from '../components/AuthFormMessage'
import { useAuth } from '../hooks/useAuth'
import { signUpWithCompany } from '../services/authService'
import {
  registerSchema,
  type RegisterFormData,
  type RegisterFormInput,
} from '../types/auth'
import { maskCpfChange, maskPhoneChange } from '../utils/masks'

export function RegisterPage() {
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()

  const {
    formState: { errors, isSubmitting },
    control,
    handleSubmit,
    register,
  } = useForm<RegisterFormInput, unknown, RegisterFormData>({
    defaultValues: {
      accountType: 'barbearia',
      papel: 'administrador',
      responsavel_cpf: '',
      telefone: '',
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
          data.accountType === 'cliente' && !data.email
            ? 'Cadastro recebido, mas o Supabase exigiu confirmação de e-mail. Para cliente sem e-mail, desative confirmação de e-mail no Supabase Auth ou informe um e-mail real.'
            : 'Cadastro recebido. O vinculo sera concluido automaticamente apos confirmar seu e-mail.',
        )
        return
      }

      const profile = await refreshProfile()

      if (data.accountType === 'cliente') {
        navigate('/cliente/selecionar-barbearia', { replace: true })
        return
      }

      if (!profile?.empresa_id) {
        throw new Error(
          'Conta criada no Auth, mas o vinculo com empresa nao foi encontrado. Verifique se a migration de cadastro foi aplicada no Supabase.',
        )
      }

      navigate('/app/dashboard', { replace: true })
    } catch (error) {
      console.error('Erro no cadastro do BW Barber:', error)
      setFormError(
        error instanceof Error ? error.message : 'Nao foi possivel cadastrar.',
      )
    }
  }

  const accountType = useWatch({ control, name: 'accountType' })

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[#12C6F3]">
        Cadastro
      </p>
      <h1 className="mt-2 text-[1.85rem] font-black leading-[1.08] tracking-normal text-white sm:mt-3 sm:text-3xl">
        Criar conta BW Barber
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#A5B4CB] sm:text-[0.95rem]">
        Escolha seu perfil e ative sua experiencia no sistema.
      </p>

      <form className="mt-5 space-y-3.5 transition-all duration-300 sm:mt-8 sm:space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <AuthFormMessage message={formError} />
        <AuthFormMessage message={successMessage} tone="success" />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex h-12 cursor-pointer items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-bold text-[#A5B4CB] transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[#17304A]/60 has-[:checked]:border-[#12C6F3] has-[:checked]:bg-[#12C6F3]/10 has-[:checked]:text-white sm:h-14 sm:rounded-[18px]">
            <input
              className="h-4 w-4 accent-[#12C6F3]"
              type="radio"
              value="barbearia"
              {...register('accountType')}
            />
            Sou Barbearia
          </label>
          <label className="flex h-12 cursor-pointer items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-bold text-[#A5B4CB] transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[#17304A]/60 has-[:checked]:border-[#12C6F3] has-[:checked]:bg-[#12C6F3]/10 has-[:checked]:text-white sm:h-14 sm:rounded-[18px]">
            <input
              className="h-4 w-4 accent-[#12C6F3]"
              type="radio"
              value="cliente"
              {...register('accountType')}
            />
            Sou Cliente
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-white">Nome</span>
          <input
            className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[#17304A]/60 focus:border-[#12C6F3] focus:bg-[#17304A]/80 focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
            autoComplete="name"
            placeholder="Joao Silva"
            {...register('nome')}
          />
          {errors.nome && (
            <span className="mt-2 block text-sm text-rose-200">
              {errors.nome.message}
            </span>
          )}
        </label>

        {accountType === 'barbearia' && (
          <label className="block animate-[fadeIn_240ms_ease-out]">
            <span className="text-sm font-semibold text-white">Empresa</span>
            <input
              className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[#17304A]/60 focus:border-[#12C6F3] focus:bg-[#17304A]/80 focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
              autoComplete="organization"
              placeholder="Nome da barbearia"
              {...register('empresa')}
            />
            {errors.empresa && (
              <span className="mt-2 block text-sm text-rose-200">
                {errors.empresa.message}
              </span>
            )}
          </label>
        )}

        {accountType === 'barbearia' && (
          <label className="block animate-[fadeIn_240ms_ease-out]">
            <span className="text-sm font-semibold text-white">Email</span>
            <input
              className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[#17304A]/60 focus:border-[#12C6F3] focus:bg-[#17304A]/80 focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
              autoComplete="email"
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
        )}

        {accountType === 'barbearia' && (
          <label className="block animate-[fadeIn_240ms_ease-out]">
            <span className="text-sm font-semibold text-white">
              CPF do responsavel
            </span>
            <input
              className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[#17304A]/60 focus:border-[#12C6F3] focus:bg-[#17304A]/80 focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
              autoComplete="off"
              inputMode="numeric"
              placeholder="000.000.000-00"
              {...register('responsavel_cpf', {
                onChange: maskCpfChange,
              })}
            />
            {errors.responsavel_cpf && (
              <span className="mt-2 block text-sm text-rose-200">
                {errors.responsavel_cpf.message}
              </span>
            )}
          </label>
        )}

        <label className="block">
          <span className="text-sm font-semibold text-white">Telefone</span>
          <input
            className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[#17304A]/60 focus:border-[#12C6F3] focus:bg-[#17304A]/80 focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
            autoComplete="tel"
            inputMode="numeric"
            placeholder="(99) 9 9999-9999"
            {...register('telefone', {
              onChange: maskPhoneChange,
            })}
          />
          {errors.telefone && (
            <span className="mt-2 block text-sm text-rose-200">
              {errors.telefone.message}
            </span>
          )}
        </label>

        {accountType === 'barbearia' && (
          <input type="hidden" value="administrador" {...register('papel')} />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-white">Senha</span>
            <input
              className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[#17304A]/60 focus:border-[#12C6F3] focus:bg-[#17304A]/80 focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
              autoComplete="new-password"
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

          <label className="block">
            <span className="text-sm font-semibold text-white">
              Confirmar senha
            </span>
            <input
              className="mt-2 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[#17304A]/60 focus:border-[#12C6F3] focus:bg-[#17304A]/80 focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
              autoComplete="new-password"
              placeholder="Digite sua senha"
              type="password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <span className="mt-2 block text-sm text-rose-200">
                {errors.confirmPassword.message}
              </span>
            )}
          </label>
        </div>

        <button
          className="min-h-11 h-12 w-full rounded-2xl bg-[#12C6F3] px-4 text-sm font-black text-[#071426] shadow-[0_16px_40px_rgb(18_198_243/0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#4EDCFF] hover:shadow-[0_20px_48px_rgb(18_198_243/0.30)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-70 sm:h-14 sm:rounded-[18px]"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[#A5B4CB] sm:mt-7">
        Ja tem conta?{' '}
        <Link className="font-bold text-[#12C6F3] transition hover:text-white" to="/login">
          Entrar
        </Link>
      </p>
    </div>
  )
}
