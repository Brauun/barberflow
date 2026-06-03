import { z } from 'zod'

export const userRoleSchema = z.enum(['administrador', 'gerente', 'barbeiro'])

export const loginSchema = z.object({
  email: z.string().email('Informe um e-mail valido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
})

export const registerSchema = z
  .object({
    nome: z.string().min(2, 'Informe seu nome.'),
    empresa: z.string().min(2, 'Informe o nome da empresa.'),
    email: z.string().email('Informe um e-mail valido.'),
    telefone: z.string().optional(),
    papel: userRoleSchema.default('administrador'),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    confirmPassword: z.string().min(6, 'Confirme sua senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas devem ser iguais.',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email('Informe um e-mail valido.'),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormInput = z.input<typeof registerSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
