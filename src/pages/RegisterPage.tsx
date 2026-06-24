import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'

import { AuthFormMessage } from '../components/AuthFormMessage'
import { useAuth } from '../hooks/useAuth'
import { signUpWithCompany } from '../services/authService'
import { handleAppError } from '../services/observabilityService'
import {
  registerSchema,
  type RegisterFormData,
  type RegisterFormInput,
} from '../types/auth'
import {
  maskCepChange,
  maskCnpjChange,
  maskCpfChange,
  maskPhoneChange,
} from '../utils/masks'

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
      aceite_termos: false,
      papel: 'administrador',
      responsavel_nome: '',
      responsavel_cpf: '',
      telefone: '',
      tipo_pessoa: 'pf',
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
            : 'Cadastro recebido. O vínculo será concluído automaticamente após confirmar seu e-mail.',
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
          'Conta criada no Auth, mas o vínculo com empresa não foi encontrado. Verifique se a migration de cadastro foi aplicada no Supabase.',
        )
      }

      navigate('/app/dashboard', { replace: true })
    } catch (error) {
      setFormError(
        await handleAppError({
          action: 'signup_failed',
          area: 'auth_signup',
          error,
          level: 'error',
          metadata: {
            accountType: data.accountType,
          },
        }),
      )
    }
  }

  const accountType = useWatch({ control, name: 'accountType' })
  const tipoPessoa = useWatch({ control, name: 'tipo_pessoa' })

  return (
    <div className="mx-auto w-full max-w-full sm:max-w-3xl">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[#12C6F3]">
        Cadastro
      </p>
      <h1 className="mt-2 text-[1.55rem] font-black leading-[1.08] tracking-normal text-white min-[390px]:text-[1.7rem] sm:mt-3 sm:text-3xl">
        Criar conta BW Barber
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#A5B4CB] sm:text-[0.95rem]">
        Escolha seu perfil e ative sua experiência no sistema.
      </p>

      <form className="mt-5 space-y-4 transition-all duration-300 sm:mt-8 sm:space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <AuthFormMessage message={formError} />
        <AuthFormMessage message={successMessage} tone="success" />

        <div className="grid w-full min-w-0 gap-2 sm:grid-cols-2 sm:gap-3">
          <label className="flex h-12 w-full min-w-0 max-w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-2 text-sm font-bold text-[#A5B4CB] transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] has-[:checked]:border-[#12C6F3] has-[:checked]:bg-[#12C6F3]/10 has-[:checked]:text-white sm:h-14 sm:rounded-[18px] sm:px-4">
            <input
              className="sr-only"
              type="radio"
              value="barbearia"
              {...register('accountType')}
            />
            <span className="block w-full min-w-0 text-center leading-tight">
              Sou Barbearia
            </span>
          </label>
          <label className="flex h-12 w-full min-w-0 max-w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-2 text-sm font-bold text-[#A5B4CB] transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] has-[:checked]:border-[#12C6F3] has-[:checked]:bg-[#12C6F3]/10 has-[:checked]:text-white sm:h-14 sm:rounded-[18px] sm:px-4">
            <input
              className="sr-only"
              type="radio"
              value="cliente"
              {...register('accountType')}
            />
            <span className="block w-full min-w-0 text-center leading-tight">
              Sou Cliente
            </span>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-white">
            {accountType === 'barbearia' ? 'Nome do responsável' : 'Nome'}
          </span>
          <input
            className="mt-2 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
            autoComplete="name"
            placeholder="João Silva"
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
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
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
            <span className="text-sm font-semibold text-white">E-mail de acesso</span>
            <input
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
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
          <div className="animate-[fadeIn_240ms_ease-out] max-w-full space-y-4 overflow-hidden rounded-3xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] p-4 sm:space-y-5 sm:p-5">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#12C6F3]">
                Dados fiscais
              </p>
              <p className="mt-1 text-sm text-[#A5B4CB]">
                Informações para futura cobrança e emissão fiscal.
              </p>
            </div>

            <div className="grid w-full min-w-0 gap-2 sm:grid-cols-2 sm:gap-3">
              <label className="flex h-12 w-full min-w-0 max-w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface)] px-2 text-sm font-bold text-[#A5B4CB] transition duration-200 has-[:checked]:border-[#12C6F3] has-[:checked]:bg-[#12C6F3]/10 has-[:checked]:text-white sm:px-4">
                <input
                  className="sr-only"
                  type="radio"
                  value="pf"
                  {...register('tipo_pessoa')}
                />
                <span className="block w-full min-w-0 text-center leading-tight">
                  Pessoa Física
                </span>
              </label>
              <label className="flex h-12 w-full min-w-0 max-w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface)] px-2 text-sm font-bold text-[#A5B4CB] transition duration-200 has-[:checked]:border-[#12C6F3] has-[:checked]:bg-[#12C6F3]/10 has-[:checked]:text-white sm:px-4">
                <input
                  className="sr-only"
                  type="radio"
                  value="pj"
                  {...register('tipo_pessoa')}
                />
                <span className="block w-full min-w-0 text-center leading-tight">
                  Pessoa Jurídica
                </span>
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-white">
                {tipoPessoa === 'pj' ? 'CNPJ' : 'CPF'}
              </span>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
                autoComplete="off"
                inputMode="numeric"
                placeholder={tipoPessoa === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'}
                {...register('cpf_cnpj', {
                  onChange: tipoPessoa === 'pj' ? maskCnpjChange : maskCpfChange,
                })}
              />
              {errors.cpf_cnpj && (
                <span className="mt-2 block text-sm text-rose-200">
                  {errors.cpf_cnpj.message}
                </span>
              )}
            </label>

            {tipoPessoa === 'pj' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-white">Razão social</span>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
                    placeholder="Razão social da empresa"
                    {...register('razao_social')}
                  />
                  {errors.razao_social && (
                    <span className="mt-2 block text-sm text-rose-200">
                      {errors.razao_social.message}
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-white">Nome fantasia</span>
                  <input
                    className="mt-2 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
                    placeholder="Nome fantasia"
                    {...register('nome_fantasia')}
                  />
                </label>
              </div>
            )}

            <label className="block">
              <span className="text-sm font-semibold text-white">E-mail financeiro</span>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
                autoComplete="email"
                placeholder="financeiro@barbearia.com"
                type="email"
                {...register('email_financeiro')}
              />
              {errors.email_financeiro && (
                <span className="mt-2 block text-sm text-rose-200">
                  {errors.email_financeiro.message}
                </span>
              )}
            </label>

            <div className="space-y-3 rounded-[1.35rem] border border-[var(--bf-border)] bg-[var(--bf-background)] p-3 sm:p-4">
              <div>
                <p className="text-sm font-semibold text-white">Endereço</p>
                <p className="mt-1 text-xs leading-5 text-[#A5B4CB]">
                  Pode ser completado depois em Configurações.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-6">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-[#A5B4CB]">CEP</span>
                  <input className="mt-1.5 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition focus:border-[#12C6F3] focus:ring-4 focus:ring-[#12C6F3]/10 sm:text-sm" inputMode="numeric" placeholder="00000-000" {...register('cep', { onChange: maskCepChange })} />
                </label>
                <label className="block sm:col-span-4">
                  <span className="text-xs font-semibold text-[#A5B4CB]">Rua</span>
                  <input className="mt-1.5 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition focus:border-[#12C6F3] focus:ring-4 focus:ring-[#12C6F3]/10 sm:text-sm" placeholder="Rua" {...register('rua')} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-[#A5B4CB]">Número</span>
                  <input className="mt-1.5 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition focus:border-[#12C6F3] focus:ring-4 focus:ring-[#12C6F3]/10 sm:text-sm" placeholder="123" {...register('numero')} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-[#A5B4CB]">Bairro</span>
                  <input className="mt-1.5 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition focus:border-[#12C6F3] focus:ring-4 focus:ring-[#12C6F3]/10 sm:text-sm" placeholder="Centro" {...register('bairro')} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-[#A5B4CB]">Cidade</span>
                  <input className="mt-1.5 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition focus:border-[#12C6F3] focus:ring-4 focus:ring-[#12C6F3]/10 sm:text-sm" placeholder="Cidade" {...register('cidade')} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-[#A5B4CB]">UF</span>
                  <input className="mt-1.5 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium uppercase text-white outline-none transition focus:border-[#12C6F3] focus:ring-4 focus:ring-[#12C6F3]/10 sm:text-sm" maxLength={2} placeholder="RS" {...register('uf')} />
                </label>
                <label className="block sm:col-span-4">
                  <span className="text-xs font-semibold text-[#A5B4CB]">Complemento</span>
                  <input className="mt-1.5 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition focus:border-[#12C6F3] focus:ring-4 focus:ring-[#12C6F3]/10 sm:text-sm" placeholder="Sala, andar ou referência" {...register('complemento')} />
                </label>
              </div>
            </div>
          </div>
        )}

        {accountType === 'barbearia' && (
          <label className="block animate-[fadeIn_240ms_ease-out]">
            <span className="text-sm font-semibold text-white">
              CPF do responsável
            </span>
            <input
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
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
            className="mt-2 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
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
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
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
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] px-4 text-base font-medium text-white outline-none transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] focus:border-[#12C6F3] focus:bg-[var(--bf-surface-muted)] focus:ring-4 focus:ring-[#12C6F3]/10 sm:h-14 sm:rounded-[18px] sm:text-sm"
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

        {accountType === 'barbearia' && (
          <label className="grid max-w-full cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface-muted)] p-3 text-sm leading-5 text-[#A5B4CB] transition duration-200 hover:border-[#12C6F3]/30 hover:bg-[var(--bf-surface-muted)] sm:p-4 sm:leading-6">
            <input
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#12C6F3]"
              type="checkbox"
              {...register('aceite_termos')}
            />
            <span className="block min-w-0 max-w-full whitespace-normal break-words">
              Declaro que as informações fornecidas são verdadeiras e aceito os
              Termos de Uso e a Política de Privacidade.
              {errors.aceite_termos && (
                <span className="mt-2 block text-sm text-rose-200">
                  {errors.aceite_termos.message}
                </span>
              )}
            </span>
          </label>
        )}

        <button
          className="min-h-11 h-12 w-full rounded-2xl bg-[#12C6F3] px-4 text-sm font-black text-[var(--bf-background)] shadow-[0_16px_40px_rgb(18_198_243/0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#4EDCFF] hover:shadow-[0_20px_48px_rgb(18_198_243/0.30)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-70 sm:h-14 sm:rounded-[18px]"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[#A5B4CB] sm:mt-7">
        Já tem conta?{' '}
        <Link className="font-bold text-[#12C6F3] transition hover:text-white" to="/login">
          Entrar
        </Link>
      </p>
    </div>
  )
}
