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
  type AuthContextValue,
  type UserProfile,
} from './authContextValue'
import { supabase } from '../lib/supabase'
import { createCompanyUser } from '../services/authService'
import type { UserRole } from '../types/database'

const roles: UserRole[] = ['administrador', 'gerente', 'barbeiro']

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const createProfileFromMetadata = useCallback(async (user: User) => {
    const nome = String(user.user_metadata.nome ?? '').trim()
    const empresa = String(user.user_metadata.empresa ?? '').trim()
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
        telefoneUsuario: telefone || null,
        papelUsuario: papel,
      })
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      return null
    }
  }, [])

  const loadProfile = useCallback(async (user: User) => {
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
      return loadedProfile
    }

    const createdProfile = await createProfileFromMetadata(user)

    if (!createdProfile) {
      setProfile(null)
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
    return loadedProfile
  }, [createProfileFromMetadata])

  const refreshProfile = useCallback(async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()

    setSession(currentSession)

    if (currentSession?.user) {
      return loadProfile(currentSession.user)
    }

    setProfile(null)
    return null
  }, [loadProfile])

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) {
        return
      }

      setSession(data.session)

      if (data.session?.user) {
        await loadProfile(data.session.user)
      }

      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)

      if (nextSession?.user) {
        void loadProfile(nextSession.user)
        return
      }

      setProfile(null)
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
      isAuthenticated: Boolean(session),
      isLoading,
      refreshProfile,
    }),
    [isLoading, profile, refreshProfile, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
