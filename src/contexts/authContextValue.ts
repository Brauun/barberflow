import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

import type { Database, Empresa, Usuario } from '../types/database'

export type UserProfile = Usuario & {
  empresa: Empresa | null
}

export type ClientProfile = Database['public']['Tables']['profiles']['Row']

export type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  clientProfile: ClientProfile | null
  userType: 'barbearia' | 'cliente' | null
  isAuthenticated: boolean
  authLoading: boolean
  profileLoading: boolean
  isLoading: boolean
  refreshProfile: (sessionOverride?: Session | null) => Promise<UserProfile | null>
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)
