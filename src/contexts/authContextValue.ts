import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

import type { Empresa, Usuario } from '../types/database'

export type UserProfile = Usuario & {
  empresa: Empresa | null
}

export type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)
