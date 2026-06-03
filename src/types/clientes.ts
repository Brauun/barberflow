import { z } from 'zod'

export const clienteSchema = z.object({
  nome: z.string().min(2, 'Informe o nome do cliente.'),
  telefone: z.string().optional(),
  data_nascimento: z.string().optional(),
  observacoes: z.string().optional(),
})

export type ClienteFormData = z.infer<typeof clienteSchema>
