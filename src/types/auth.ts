import { z } from 'zod'

import { onlyDigits } from '../utils/masks'

export const userRoleSchema = z.enum([
  'administrador',
  'gerente',
  'barbeiro',
  'recepcao',
])
export const accountTypeSchema = z.enum(['barbearia', 'cliente'])

export const loginSchema = z.object({
  email: z.string().min(3, 'Informe e-mail ou telefone.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
})

export const registerSchema = z
  .object({
    accountType: accountTypeSchema.default('barbearia'),
    nome: z.string().min(2, 'Informe seu nome.'),
    empresa: z.string().optional(),
    email: z.string().email('Informe um e-mail valido.').optional().or(z.literal('')),
    telefone: z.string().optional(),
    responsavel_cpf: z.string().optional(),
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
    message: 'Informe o e-mail da barbearia.',
    path: ['email'],
  })
  .refine((data) => onlyDigits(data.telefone).length === 11, {
    message: 'Informe um telefone com 11 digitos.',
    path: ['telefone'],
  })
  .refine((data) => data.accountType !== 'barbearia' || onlyDigits(data.responsavel_cpf).length === 11, {
    message: 'Informe o CPF do responsavel com 11 digitos.',
    path: ['responsavel_cpf'],
  })
  .refine((data) => data.accountType !== 'cliente' || Boolean(data.telefone?.trim()), {
    message: 'Informe seu telefone.',
    path: ['telefone'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email('Informe um e-mail valido.'),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormInput = z.input<typeof registerSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
