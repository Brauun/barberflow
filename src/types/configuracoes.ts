import { z } from 'zod'

import { onlyDigits } from '../utils/masks'

export const empresaSettingsSchema = z.object({
  bairro: z.string().optional(),
  cep: z.string().optional(),
  cidade: z.string().optional(),
  complemento: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  email: z.string().email('Informe um e-mail válido.').optional().or(z.literal('')),
  email_financeiro: z.string().email('Informe um e-mail financeiro válido.').optional().or(z.literal('')),
  endereco: z.string().optional(),
  estado: z.string().max(2, 'Use a sigla do estado.').optional().or(z.literal('')),
  latitude: z.coerce.number().optional().nullable(),
  logradouro: z.string().optional(),
  logo_url: z.string().optional(),
  longitude: z.coerce.number().optional().nullable(),
  nome: z.string().min(2, 'Informe o nome da barbearia.'),
  nome_fantasia: z.string().optional(),
  numero: z.string().optional(),
  percentual_comissao_padrao: z.coerce
    .number()
    .min(0, 'A comissão não pode ser negativa.')
    .max(100, 'A comissão não pode passar de 100%.'),
  razao_social: z.string().optional(),
  responsavel_cpf: z
    .string()
    .optional()
    .refine((value) => !value || onlyDigits(value).length === 11, {
      message: 'Informe um CPF com 11 dígitos.',
    }),
  responsavel_nome: z.string().optional(),
  rua: z.string().optional(),
  telefone: z
    .string()
    .optional()
    .refine((value) => !value || onlyDigits(value).length === 11, {
      message: 'Informe um telefone com 11 dígitos.',
    }),
  tipo_pessoa: z.enum(['pf', 'pj']).optional(),
  uf: z.string().max(2, 'Use a sigla do estado.').optional().or(z.literal('')),
})

export const userProfileSchema = z.object({
  avatar_url: z.string().optional(),
  nome: z.string().min(2, 'Informe seu nome.'),
  telefone: z
    .string()
    .optional()
    .refine((value) => !value || onlyDigits(value).length === 11, {
      message: 'Informe um telefone com 11 dígitos.',
    }),
})

export type EmpresaSettingsFormInput = z.input<typeof empresaSettingsSchema>
export type EmpresaSettingsFormData = z.output<typeof empresaSettingsSchema>
export type UserProfileFormInput = z.input<typeof userProfileSchema>
export type UserProfileFormData = z.output<typeof userProfileSchema>
