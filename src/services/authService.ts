import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import type { UserRole, Usuario } from '../types/database'
import { duplicateAwareError, friendlyDuplicateMessage } from '../utils/duplicateErrors'

type SignInInput = {
  email: string
  password: string
}

type SignUpInput = {
  accountType?: 'barbearia' | 'cliente'
  nome: string
  empresa?: string
  email?: string
  tipo_pessoa?: 'pf' | 'pj'
  cpf_cnpj?: string
  razao_social?: string
  nome_fantasia?: string
  email_financeiro?: string
  cep?: string
  rua?: string
  numero?: string
  bairro?: string
  cidade?: string
  uf?: string
  complemento?: string
  responsavel_nome?: string
  telefone?: string
  responsavel_cpf?: string
  aceite_termos?: boolean
  password: string
  papel?: UserRole
}

type CreateCompanyUserInput = {
  nomeEmpresa: string
  nomeUsuario: string
  responsavelCpf?: string | null
  telefoneUsuario?: string | null
  papelUsuario: UserRole
  fiscal?: {
    aceiteTermosAt?: string | null
    bairro?: string | null
    cep?: string | null
    cidade?: string | null
    complemento?: string | null
    cpfCnpj?: string | null
    emailFinanceiro?: string | null
    logradouro?: string | null
    nomeFantasia?: string | null
    numero?: string | null
    razaoSocial?: string | null
    responsavelNome?: string | null
    tipoPessoa?: 'pf' | 'pj'
    uf?: string | null
  }
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
    'As tabelas do modulo Cliente ainda não existem no Supabase.',
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
  const cpfCnpj = normalizeDigits(input.cpf_cnpj)
  const tipoPessoa = input.tipo_pessoa ?? 'pf'
  const emailFinanceiro = input.email_financeiro?.trim()
  const responsavelNome = input.responsavel_nome?.trim() || input.nome.trim()

  if (!nomeEmpresa || !input.email || !emailFinanceiro) {
    throw new Error('Informe empresa, e-mail de acesso e e-mail financeiro para cadastrar uma barbearia.')
  }

  if (responsavelCpf.length !== 11) {
    throw new Error('Informe o CPF do responsável com 11 dígitos.')
  }

  if (tipoPessoa === 'pf' && cpfCnpj.length !== 11) {
    throw new Error('Informe o CPF com 11 dígitos.')
  }

  if (tipoPessoa === 'pj' && cpfCnpj.length !== 14) {
    throw new Error('Informe o CNPJ com 14 dígitos.')
  }

  if (tipoPessoa === 'pj' && !input.razao_social?.trim()) {
    throw new Error('Informe a razao social.')
  }

  if (!input.aceite_termos) {
    throw new Error('Aceite os Termos de Uso e a Politica de Privacidade.')
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
        cpf_cnpj: cpfCnpj,
        email_financeiro: emailFinanceiro,
        responsavel_cpf: responsavelCpf,
        responsavel_nome: responsavelNome,
        tipo_pessoa: tipoPessoa,
        telefone: telefoneUsuario || null,
        papel,
      },
    },
  })

  if (error) {
    const duplicateMessage = friendlyDuplicateMessage(error, {
      users_email_key: 'Já existe uma conta cadastrada com este e-mail.',
    })
    const authDuplicateMessage = error.message
      .toLowerCase()
      .includes('already registered')
      ? 'Já existe uma conta cadastrada com este e-mail.'
      : null

    logger.error({
      action: 'signup_auth_user_failed',
      area: 'auth',
      error,
      message: 'Falha ao criar usuário no Supabase Auth.',
      metadata: {
        accountType: 'barbearia',
      },
    })
    throw new Error(
      duplicateMessage ??
        authDuplicateMessage ??
        `Falha ao criar usuário no Supabase Auth: ${error.message}`,
    )
  }

  if (!data.user?.id) {
    throw new Error('Supabase Auth não retornou o ID do usuário criado.')
  }

  if (!data.session) {
    return {
      needsEmailConfirmation: true,
    }
  }

  logger.info({
    action: 'signup_company_link_started',
    area: 'auth',
    message: 'Usuário criado no Auth. Criando empresa e vínculo.',
    userId: data.user.id,
  })

  const usuario = await createCompanyUser({
    nomeEmpresa,
    nomeUsuario: responsavelNome,
    responsavelCpf,
    telefoneUsuario: telefoneUsuario || null,
    papelUsuario: papel,
    fiscal: {
      aceiteTermosAt: new Date().toISOString(),
      bairro: input.bairro?.trim() || null,
      cep: normalizeDigits(input.cep) || null,
      cidade: input.cidade?.trim() || null,
      complemento: input.complemento?.trim() || null,
      cpfCnpj,
      emailFinanceiro,
      logradouro: input.rua?.trim() || null,
      nomeFantasia: input.nome_fantasia?.trim() || nomeEmpresa,
      numero: input.numero?.trim() || null,
      razaoSocial: input.razao_social?.trim() || null,
      responsavelNome,
      tipoPessoa,
      uf: input.uf?.trim().toUpperCase() || null,
    },
  })

  if (!usuario?.empresa_id || usuario.auth_user_id !== data.user.id) {
    throw new Error(
      'O cadastro criou o usuário no Auth, mas não retornou um vínculo válido em public.usuarios.',
    )
  }

  return {
    needsEmailConfirmation: false,
  }
}

export async function signUpClient(input: SignUpInput) {
  const telefone = normalizePhone(input.telefone ?? '')

  if (!telefone) {
    throw new Error('Informe um telefone válido para criar conta de cliente.')
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
    const duplicateMessage = friendlyDuplicateMessage(error, {
      users_email_key:
        'Já existe uma conta cadastrada com este e-mail ou telefone.',
    })
    const authDuplicateMessage = error.message
      .toLowerCase()
      .includes('already registered')
      ? 'Já existe uma conta cadastrada com este e-mail ou telefone.'
      : null

    logger.error({
      action: 'signup_client_auth_failed',
      area: 'auth',
      error,
      message: 'Falha ao criar cliente no Supabase Auth.',
      metadata: {
        hasEmail: Boolean(input.email),
      },
    })
    throw new Error(
      duplicateMessage ??
        authDuplicateMessage ??
        `Falha ao criar cliente no Supabase Auth: ${error.message}`,
    )
  }

  if (!data.user?.id) {
    throw new Error('Supabase Auth não retornou o ID do cliente criado.')
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

    throw duplicateAwareError(
      error,
      {
        profiles_cliente_email_normalizado_unique_idx:
          'Já existe um cliente cadastrado com este e-mail.',
        profiles_cliente_telefone_normalizado_unique_idx:
          'Já existe um cliente cadastrado com este telefone.',
      },
      `Falha ao criar perfil de cliente: ${error.message}`,
    )
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
      message: 'Falha ao criar empresa/usuário no banco.',
      metadata: {
        papelUsuario: input.papelUsuario,
      },
    })
    throw new Error(
      `Falha ao criar empresa e usuário no banco: ${error.message}`,
    )
  }

  if (!data) {
    throw new Error('A função de cadastro não retornou o usuário criado.')
  }

  const endereco = [
    [input.fiscal?.logradouro, input.fiscal?.numero].filter(Boolean).join(', '),
    [input.fiscal?.bairro, input.fiscal?.cidade, input.fiscal?.uf]
      .filter(Boolean)
      .join(' - '),
  ]
    .filter(Boolean)
    .join(' — ')
  const fiscalPayload = {
    aceite_termos_at: input.fiscal?.aceiteTermosAt ?? null,
    bairro: input.fiscal?.bairro ?? null,
    cep: input.fiscal?.cep ?? null,
    cidade: input.fiscal?.cidade ?? null,
    complemento: input.fiscal?.complemento ?? null,
    cpf_cnpj: input.fiscal?.cpfCnpj ?? null,
    email_financeiro: input.fiscal?.emailFinanceiro ?? null,
    endereco: endereco || null,
    estado: input.fiscal?.uf ?? null,
    logradouro: input.fiscal?.logradouro ?? null,
    nome_fantasia: input.fiscal?.nomeFantasia ?? input.nomeEmpresa.trim(),
    numero: input.fiscal?.numero ?? null,
    razao_social: input.fiscal?.razaoSocial ?? null,
    responsavel_cpf: input.responsavelCpf || null,
    responsavel_nome: input.fiscal?.responsavelNome ?? input.nomeUsuario.trim(),
    rua: input.fiscal?.logradouro ?? null,
    tipo_pessoa: input.fiscal?.tipoPessoa ?? 'pf',
  }

  const { error: empresaUpdateError } = await supabase
    .from('empresas')
    .update(fiscalPayload)
    .eq('id', (data as Usuario).empresa_id)

  if (empresaUpdateError) {
    throw duplicateAwareError(
      empresaUpdateError,
      {
        empresas_cpf_cnpj_normalizado_unique_idx:
          'Já existe uma barbearia cadastrada com este CPF/CNPJ.',
      },
      `Falha ao salvar dados fiscais: ${empresaUpdateError.message}`,
    )
  }

  const { error: barbershopUpsertError } = await supabase.from('barbershops').upsert(
    {
      ...fiscalPayload,
      empresa_id: (data as Usuario).empresa_id,
      email: input.fiscal?.emailFinanceiro ?? null,
      nome: input.nomeEmpresa.trim(),
      telefone: input.telefoneUsuario || null,
    },
    { onConflict: 'empresa_id' },
  )

  if (barbershopUpsertError) {
    throw duplicateAwareError(
      barbershopUpsertError,
      {
        barbershops_cpf_cnpj_normalizado_unique_idx:
          'Já existe uma barbearia cadastrada com este CPF/CNPJ.',
      },
      `Falha ao salvar dados da barbearia: ${barbershopUpsertError.message}`,
    )
  }

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
