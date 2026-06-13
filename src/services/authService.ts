import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import type { UserRole, Usuario } from '../types/database'

type SignInInput = {
  email: string
  password: string
}

type SignUpInput = {
  accountType?: 'barbearia' | 'cliente'
  nome: string
  empresa?: string
  email?: string
  telefone?: string
  responsavel_cpf?: string
  password: string
  papel?: UserRole
}

type CreateCompanyUserInput = {
  nomeEmpresa: string
  nomeUsuario: string
  responsavelCpf?: string | null
  telefoneUsuario?: string | null
  papelUsuario: UserRole
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeDigits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '')
}

function clientPhoneAuthEmail(phone: string) {
  return `cliente.${phone}@bwbarber.local`
}

function legacyClientPhoneAuthEmail(phone: string) {
  return `cliente.${phone}@${'barber' + 'flow'}.local`
}

function isMissingSchemaTableError(message: string) {
  return (
    message.includes("Could not find the table 'public.profiles'") ||
    message.includes("Could not find the table 'public.barbershops'") ||
    message.includes('schema cache')
  )
}

function missingClientSchemaMessage() {
  return [
    'As tabelas do módulo Cliente ainda não existem no Supabase.',
    'Aplique a migration supabase/migrations/20260605090000_client_booking_evolution.sql no banco e recarregue o schema cache antes de cadastrar clientes.',
  ].join(' ')
}

async function assertClientSchemaReady() {
  const { error: profilesError } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)

  if (profilesError) {
    if (isMissingSchemaTableError(profilesError.message)) {
      throw new Error(missingClientSchemaMessage())
    }

    throw new Error(`Falha ao verificar tabela profiles: ${profilesError.message}`)
  }

  const { error: barbershopsError } = await supabase
    .from('barbershops')
    .select('id')
    .limit(1)

  if (barbershopsError) {
    if (isMissingSchemaTableError(barbershopsError.message)) {
      throw new Error(missingClientSchemaMessage())
    }

    throw new Error(
      `Falha ao verificar tabela barbershops: ${barbershopsError.message}`,
    )
  }
}

export async function signInWithPassword({ email, password }: SignInInput) {
  const identifier = email.trim()
  const phone = normalizePhone(identifier)
  const isEmail = identifier.includes('@')
  const credentials = isEmail
    ? { email: identifier, password }
    : { email: clientPhoneAuthEmail(phone), password }

  const { data, error } = await supabase.auth.signInWithPassword(credentials)

  if (error) {
    if (!isEmail) {
      const { data: legacyData, error: legacyError } =
        await supabase.auth.signInWithPassword({
        email: legacyClientPhoneAuthEmail(phone),
        password,
      })

      if (!legacyError) {
        return legacyData
      }
    }

    throw new Error(error.message)
  }

  return data
}

export async function signUpWithCompany(input: SignUpInput) {
  if (input.accountType === 'cliente') {
    return signUpClient(input)
  }

  const papel: UserRole = 'administrador'
  const nomeEmpresa = input.empresa?.trim()
  const telefoneUsuario = normalizeDigits(input.telefone)
  const responsavelCpf = normalizeDigits(input.responsavel_cpf)

  if (!nomeEmpresa || !input.email) {
    throw new Error('Informe empresa e e-mail para cadastrar uma barbearia.')
  }

  if (responsavelCpf.length !== 11) {
    throw new Error('Informe o CPF do responsavel com 11 digitos.')
  }

  logger.info({
    action: 'signup_barbershop_started',
    area: 'auth',
    message: 'Iniciando cadastro BW Barber.',
    metadata: {
      hasEmail: Boolean(input.email),
      hasPhone: Boolean(telefoneUsuario),
    },
  })

  const { data, error } = await supabase.auth.signUp({
    email: input.email as string,
    password: input.password,
    options: {
      data: {
        nome: input.nome,
        empresa: nomeEmpresa,
        responsavel_cpf: responsavelCpf,
        telefone: telefoneUsuario || null,
        papel,
      },
    },
  })

  if (error) {
    logger.error({
      action: 'signup_auth_user_failed',
      area: 'auth',
      error,
      message: 'Falha ao criar usuario no Supabase Auth.',
      metadata: {
        accountType: 'barbearia',
      },
    })
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

  logger.info({
    action: 'signup_company_link_started',
    area: 'auth',
    message: 'Usuario criado no Auth. Criando empresa e vinculo.',
    userId: data.user.id,
  })

  const usuario = await createCompanyUser({
    nomeEmpresa,
    nomeUsuario: input.nome,
    responsavelCpf,
    telefoneUsuario: telefoneUsuario || null,
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

export async function signUpClient(input: SignUpInput) {
  const telefone = normalizePhone(input.telefone ?? '')

  if (!telefone) {
    throw new Error('Informe um telefone valido para criar conta de cliente.')
  }

  const authEmail = input.email?.trim() || clientPhoneAuthEmail(telefone)

  logger.info({
    action: 'signup_client_started',
    area: 'auth',
    message: 'Iniciando cadastro de cliente BW Barber.',
    metadata: {
      hasEmail: Boolean(input.email),
      hasPhone: Boolean(telefone),
    },
  })

  await assertClientSchemaReady()

  const { data, error } = await supabase.auth.signUp({
    email: authEmail,
    password: input.password,
    options: {
      data: {
        auth_email_is_internal: !input.email,
        nome: input.nome,
        role: 'cliente',
        telefone,
      },
    },
  })

  if (error) {
    logger.error({
      action: 'signup_client_auth_failed',
      area: 'auth',
      error,
      message: 'Falha ao criar cliente no Supabase Auth.',
      metadata: {
        hasEmail: Boolean(input.email),
      },
    })
    throw new Error(`Falha ao criar cliente no Supabase Auth: ${error.message}`)
  }

  if (!data.user?.id) {
    throw new Error('Supabase Auth nao retornou o id do cliente criado.')
  }

  if (!data.session) {
    return {
      needsEmailConfirmation: true,
    }
  }

  await createClientProfile({
    authUserId: data.user.id,
    email: input.email || null,
    nome: input.nome,
    telefone,
  })

  return {
    needsEmailConfirmation: false,
  }
}

export async function createClientProfile(input: {
  authUserId: string
  nome: string
  telefone?: string | null
  email?: string | null
}) {
  const { error } = await supabase.from('profiles').upsert(
    {
      auth_user_id: input.authUserId,
      email: input.email ?? null,
      nome: input.nome.trim(),
      role: 'cliente',
      telefone: input.telefone || null,
    },
    { onConflict: 'auth_user_id' },
  )

  if (error) {
    if (isMissingSchemaTableError(error.message)) {
      throw new Error(missingClientSchemaMessage())
    }

    throw new Error(`Falha ao criar perfil de cliente: ${error.message}`)
  }
}

export async function createCompanyUser(input: CreateCompanyUserInput) {
  const { data, error } = await supabase.rpc('criar_empresa_com_usuario', {
      nome_empresa: input.nomeEmpresa,
      nome_usuario: input.nomeUsuario,
      responsavel_cpf: input.responsavelCpf || null,
      telefone_usuario: input.telefoneUsuario || null,
      papel_usuario: input.papelUsuario,
    })

  if (error) {
    logger.error({
      action: 'signup_company_user_rpc_failed',
      area: 'auth',
      error,
      message: 'Falha ao criar empresa/usuario no banco.',
      metadata: {
        papelUsuario: input.papelUsuario,
      },
    })
    throw new Error(
      `Falha ao criar empresa e usuario no banco: ${error.message}`,
    )
  }

  if (!data) {
    throw new Error('A funcao de cadastro nao retornou o usuario criado.')
  }

  await supabase.from('barbershops').upsert(
    {
      empresa_id: (data as Usuario).empresa_id,
      nome: input.nomeEmpresa.trim(),
      telefone: input.telefoneUsuario || null,
    },
    { onConflict: 'empresa_id' },
  )

  return data as Usuario
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
