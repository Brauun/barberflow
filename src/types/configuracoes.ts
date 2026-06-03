import { z } from 'zod'

export const empresaSettingsSchema = z.object({
  email: z.string().email('Informe um e-mail válido.').optional().or(z.literal('')),
  endereco: z.string().optional(),
  logo_url: z.string().url('Informe uma URL válida.').optional().or(z.literal('')),
  nome: z.string().min(2, 'Informe o nome da barbearia.'),
  percentual_comissao_padrao: z.coerce
    .number()
    .min(0, 'A comissão não pode ser negativa.')
    .max(100, 'A comissão não pode passar de 100%.'),
  telefone: z.string().optional(),
})

export const userProfileSchema = z.object({
  nome: z.string().min(2, 'Informe seu nome.'),
  telefone: z.string().optional(),
})

export type EmpresaSettingsFormInput = z.input<typeof empresaSettingsSchema>
export type EmpresaSettingsFormData = z.output<typeof empresaSettingsSchema>
export type UserProfileFormInput = z.input<typeof userProfileSchema>
export type UserProfileFormData = z.output<typeof userProfileSchema>
