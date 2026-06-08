import type { Session, User } from '@supabase/supabase-js'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  AuthContext,
  type ClientProfile,
  type AuthContextValue,
  type UserProfile,
} from './authContextValue'
import { supabase } from '../lib/supabase'
import { createClientProfile, createCompanyUser } from '../services/authService'
import type { UserRole } from '../types/database'

const roles: UserRole[] = ['administrador', 'gerente', 'barbeiro', 'recepcao']

function devAuthLog(message: string, details?: unknown) {
  if (!import.meta.env.DEV) {
    return
  }

  if (details === undefined) {
    console.info(`[BW Barber Auth] ${message}`)
    return
  }

  console.info(`[BW Barber Auth] ${message}`, details)
}

function isMissingClientSchemaError(message: string) {
  return (
    message.includes("Could not find the table 'public.profiles'") ||
    message.includes('schema cache')
  )
}

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const createProfileFromMetadata = useCallback(async (user: User) => {
    const nome = String(user.user_metadata.nome ?? '').trim()
    const empresa = String(user.user_metadata.empresa ?? '').trim()
    const responsavelCpf = String(user.user_metadata.responsavel_cpf ?? '').trim()
    const telefone = String(user.user_metadata.telefone ?? '').trim()
    const papelMetadata = String(user.user_metadata.papel ?? 'administrador')
    const papel = roles.includes(papelMetadata as UserRole)
      ? (papelMetadata as UserRole)
      : 'administrador'

    if (!nome || !empresa) {
      return null
    }

    try {
      return await createCompanyUser({
        nomeEmpresa: empresa,
        nomeUsuario: nome,
        responsavelCpf: responsavelCpf || null,
        telefoneUsuario: telefone || null,
        papelUsuario: papel,
      })
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      return null
    }
  }, [])

  const loadProfile = useCallback(async (user: User) => {
    setProfileLoading(true)
    setClientProfile(null)
    devAuthLog('carregando profile', { userId: user.id })

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select(
          `
            *,
            empresa:empresas(*)
          `,
        )
        .eq('auth_user_id', user.id)
        .eq('status', 'ativo')
        .maybeSingle()

      if (error) {
        console.error('Erro ao carregar perfil do usuario:', error.message)
        setProfile(null)
        return null
      }

      if (data) {
        const loadedProfile = data as unknown as UserProfile
        setProfile(loadedProfile)
        devAuthLog('profile carregado', {
          empresaId: loadedProfile.empresa_id,
          papel: loadedProfile.papel,
          userId: user.id,
        })
        devAuthLog('empresa carregada', loadedProfile.empresa)
        return loadedProfile
      }

      const { data: clientData, error: clientError } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', user.id)
        .eq('role', 'cliente')
        .maybeSingle()

      if (clientError) {
        if (isMissingClientSchemaError(clientError.message)) {
          setProfile(null)
          setClientProfile(null)
          return null
        }

        console.error('Erro ao carregar perfil de cliente:', clientError.message)
      }

      if (clientData) {
        setProfile(null)
        setClientProfile(clientData as ClientProfile)
        devAuthLog('profile cliente carregado', {
          primaryBarbershopId: clientData.primary_barbershop_id,
          userId: user.id,
        })
        return null
      }

      if (user.user_metadata.role === 'cliente') {
        try {
          await createClientProfile({
            authUserId: user.id,
            email: user.email ?? null,
            nome: String(user.user_metadata.nome ?? 'Cliente'),
            telefone: String(user.user_metadata.telefone ?? '') || null,
          })
        } catch (error) {
          console.error(error instanceof Error ? error.message : error)
          setProfile(null)
          setClientProfile(null)
          return null
        }

        const { data: createdClientData } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_user_id', user.id)
          .eq('role', 'cliente')
          .maybeSingle()

        setProfile(null)
        setClientProfile((createdClientData as ClientProfile | null) ?? null)
        devAuthLog('profile cliente criado/carregado', { userId: user.id })
        return null
      }

      const createdProfile = await createProfileFromMetadata(user)

      if (!createdProfile) {
        setProfile(null)
        setClientProfile(null)
        return null
      }

      const { data: profileData, error: profileError } = await supabase
        .from('usuarios')
        .select(
          `
            *,
            empresa:empresas(*)
          `,
        )
        .eq('id', createdProfile.id)
        .maybeSingle()

      if (profileError) {
        console.error(
          'Erro ao carregar perfil criado no cadastro:',
          profileError.message,
        )
        setProfile(null)
        return null
      }

      const loadedProfile = (profileData as unknown as UserProfile | null) ?? null
      setProfile(loadedProfile)
      setClientProfile(null)
      devAuthLog('profile barbearia criado/carregado', {
        empresaId: loadedProfile?.empresa_id,
        userId: user.id,
      })
      return loadedProfile
    } finally {
      setProfileLoading(false)
    }
  }, [createProfileFromMetadata])

  const refreshProfile = useCallback(async (sessionOverride?: Session | null) => {
    const currentSession =
      sessionOverride === undefined
        ? (await supabase.auth.getSession()).data.session
        : sessionOverride

    setSession(currentSession)
    devAuthLog('sessao detectada', {
      hasSession: Boolean(currentSession),
      userId: currentSession?.user.id,
    })

    if (currentSession?.user) {
      return loadProfile(currentSession.user)
    }

    setProfile(null)
    setClientProfile(null)
    return null
  }, [loadProfile])

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      try {
        if (!isMounted) {
          return
        }

        setSession(data.session)
        devAuthLog('sessao inicial detectada', {
          hasSession: Boolean(data.session),
          userId: data.session?.user.id,
        })

        if (data.session?.user) {
          await loadProfile(data.session.user)
        }
      } catch (error) {
        console.error(
          'Erro ao inicializar autenticação:',
          error instanceof Error ? error.message : error,
        )
        setProfile(null)
        setClientProfile(null)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      devAuthLog('auth state alterado', {
        event: _event,
        hasSession: Boolean(nextSession),
        userId: nextSession?.user.id,
      })

      if (nextSession?.user) {
        void loadProfile(nextSession.user)
        return
      }

      setProfile(null)
      setClientProfile(null)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      clientProfile,
      isAuthenticated: Boolean(session),
      authLoading: isLoading,
      profileLoading,
      isLoading: isLoading || profileLoading,
      refreshProfile,
      userType: clientProfile ? 'cliente' : profile ? 'barbearia' : null,
    }),
    [clientProfile, isLoading, profile, profileLoading, refreshProfile, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
