import { z } from 'zod'

import { onlyDigits } from '../utils/masks'

export const employeeRoleOptions = [
  { label: 'Barbeiro', value: 'barbeiro' },
] as const

export const employeeInvitationSchema = z.object({
  commission_percentage: z.coerce
    .number()
    .min(0, 'A comissão não pode ser negativa.')
    .max(100, 'A comissão não pode passar de 100%.'),
  email: z.string().email('Informe um e-mail válido.'),
  nome: z.string().min(2, 'Informe o nome.'),
  role: z.enum(['barbeiro']),
  telefone: z
    .string()
    .optional()
    .refine((value) => !value || onlyDigits(value).length === 11, {
      message: 'Informe um telefone com 11 dígitos.',
    }),
})

export const acceptEmployeeInvitationSchema = z
  .object({
    confirmPassword: z.string().min(6, 'Confirme sua senha.'),
    nome: z.string().min(2, 'Informe seu nome.'),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    telefone: z
      .string()
      .optional()
      .refine((value) => !value || onlyDigits(value).length === 11, {
        message: 'Informe um telefone com 11 dígitos.',
      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas devem ser iguais.',
    path: ['confirmPassword'],
  })

export type EmployeeInvitationFormInput = z.input<
  typeof employeeInvitationSchema
>

export type EmployeeInvitationFormData = z.output<
  typeof employeeInvitationSchema
>

export type AcceptEmployeeInvitationFormData = z.infer<
  typeof acceptEmployeeInvitationSchema
>
