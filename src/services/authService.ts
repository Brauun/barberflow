import type { PostgrestError } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import type { UserRole, Usuario } from '../types/database'

type SignInInput = {
  email: string
  password: string
}

type SignUpInput = {
  nome: string
  empresa: string
  email: string
  telefone?: string
  password: string
  papel?: UserRole
}

type CreateCompanyUserInput = {
  nomeEmpresa: string
  nomeUsuario: string
  telefoneUsuario?: string | null
  papelUsuario: UserRole
}

type CreateCompanyUserArgs = {
  nome_empresa: string
  nome_usuario: string
  telefone_usuario: string | null
  papel_usuario: UserRole
}

const createCompanyUserRpc = supabase.rpc as unknown as (
  functionName: 'criar_empresa_com_usuario',
  args: CreateCompanyUserArgs,
) => Promise<{
  data: Usuario | null
  error: PostgrestError | null
}>

export async function signInWithPassword({ email, password }: SignInInput) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function signUpWithCompany(input: SignUpInput) {
  const papel: UserRole = 'administrador'

  console.info('Iniciando cadastro BarberFlow: criando usuario no Supabase Auth.')

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        nome: input.nome,
        empresa: input.empresa,
        telefone: input.telefone ?? null,
        papel,
      },
    },
  })

  if (error) {
    console.error('Falha ao criar usuario no Supabase Auth:', error.message)
    throw new Error(`Falha ao criar usuario no Supabase Auth: ${error.message}`)
  }

  if (!data.user?.id) {
    throw new Error('Supabase Auth nao retornou o id do usuario criado.')
  }

  if (!data.session) {
    return {
      needsEmailConfirmation: true,
    }
  }

  console.info(
    'Usuario criado no Auth. Criando empresa e vinculo em public.usuarios.',
  )

  const usuario = await createCompanyUser({
    nomeEmpresa: input.empresa,
    nomeUsuario: input.nome,
    telefoneUsuario: input.telefone || null,
    papelUsuario: papel,
  })

  if (!usuario?.empresa_id || usuario.auth_user_id !== data.user.id) {
    throw new Error(
      'O cadastro criou o usuario no Auth, mas nao retornou um vinculo valido em public.usuarios.',
    )
  }

  return {
    needsEmailConfirmation: false,
  }
}

export async function createCompanyUser(input: CreateCompanyUserInput) {
  const { data, error } = await createCompanyUserRpc(
    'criar_empresa_com_usuario',
    {
      nome_empresa: input.nomeEmpresa,
      nome_usuario: input.nomeUsuario,
      telefone_usuario: input.telefoneUsuario || null,
      papel_usuario: input.papelUsuario,
    },
  )

  if (error) {
    console.error('Falha ao criar empresa/usuario no banco:', error)
    throw new Error(
      `Falha ao criar empresa e usuario no banco: ${error.message}`,
    )
  }

  if (!data) {
    throw new Error('A funcao de cadastro nao retornou o usuario criado.')
  }

  return data
}

export async function sendPasswordResetEmail(email: string) {
  const redirectTo = `${window.location.origin}/login`

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}
