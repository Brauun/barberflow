import { z } from 'zod'

import { onlyDigits } from '../utils/masks'

export const userRoleSchema = z.enum(['administrador', 'barbeiro'])
export const accountTypeSchema = z.enum(['barbearia', 'cliente'])
export const tipoPessoaSchema = z.enum(['pf', 'pj'])

export const loginSchema = z.object({
  email: z.string().min(3, 'Informe e-mail ou telefone.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
})

export const registerSchema = z
  .object({
    accountType: accountTypeSchema.default('barbearia'),
    nome: z.string().min(2, 'Informe seu nome.'),
    empresa: z.string().optional(),
    email: z.string().email('Informe um e-mail válido.').optional().or(z.literal('')),
    tipo_pessoa: tipoPessoaSchema.default('pf'),
    cpf_cnpj: z.string().optional(),
    razao_social: z.string().optional(),
    nome_fantasia: z.string().optional(),
    email_financeiro: z.string().email('Informe um e-mail financeiro válido.').optional().or(z.literal('')),
    cep: z.string().optional(),
    rua: z.string().optional(),
    numero: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
    uf: z.string().max(2, 'Use a sigla do estado.').optional().or(z.literal('')),
    complemento: z.string().optional(),
    responsavel_nome: z.string().optional(),
    telefone: z.string().optional(),
    responsavel_cpf: z.string().optional(),
    aceite_termos: z.boolean().optional(),
    papel: userRoleSchema.default('administrador'),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    confirmPassword: z.string().min(6, 'Confirme sua senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas devem ser iguais.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.accountType !== 'barbearia' || Boolean(data.empresa?.trim()), {
    message: 'Informe o nome da empresa.',
    path: ['empresa'],
  })
  .refine((data) => data.accountType !== 'barbearia' || Boolean(data.email?.trim()), {
    message: 'Informe o e-mail de acesso da barbearia.',
    path: ['email'],
  })
  .refine((data) => data.accountType !== 'barbearia' || Boolean(data.email_financeiro?.trim()), {
    message: 'Informe o e-mail financeiro.',
    path: ['email_financeiro'],
  })
  .refine((data) => onlyDigits(data.telefone).length === 11, {
    message: 'Informe um telefone com 11 dígitos.',
    path: ['telefone'],
  })
  .refine(
    (data) =>
      data.accountType !== 'barbearia' ||
      data.tipo_pessoa !== 'pf' ||
      onlyDigits(data.cpf_cnpj).length === 11,
    {
      message: 'Informe um CPF com 11 dígitos.',
      path: ['cpf_cnpj'],
    },
  )
  .refine(
    (data) =>
      data.accountType !== 'barbearia' ||
      data.tipo_pessoa !== 'pj' ||
      onlyDigits(data.cpf_cnpj).length === 14,
    {
      message: 'Informe um CNPJ com 14 dígitos.',
      path: ['cpf_cnpj'],
    },
  )
  .refine(
    (data) =>
      data.accountType !== 'barbearia' ||
      data.tipo_pessoa !== 'pj' ||
      Boolean(data.razao_social?.trim()),
    {
      message: 'Informe a razao social.',
      path: ['razao_social'],
    },
  )
  .refine((data) => data.accountType !== 'barbearia' || Boolean(data.responsavel_nome?.trim() || data.nome?.trim()), {
      message: 'Informe o nome do responsável.',
    path: ['responsavel_nome'],
  })
  .refine((data) => data.accountType !== 'barbearia' || onlyDigits(data.responsavel_cpf).length === 11, {
    message: 'Informe o CPF do responsável com 11 dígitos.',
    path: ['responsavel_cpf'],
  })
  .refine((data) => data.accountType !== 'barbearia' || data.aceite_termos === true, {
    message: 'Aceite os Termos de Uso e a Politica de Privacidade.',
    path: ['aceite_termos'],
  })
  .refine((data) => data.accountType !== 'cliente' || Boolean(data.telefone?.trim()), {
    message: 'Informe seu telefone.',
    path: ['telefone'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormInput = z.input<typeof registerSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
