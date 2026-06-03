import { createClient } from '@supabase/supabase-js'

import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const isProduction = import.meta.env.PROD

if (!supabaseUrl || !supabaseAnonKey) {
  const message =
    'Supabase environment variables are not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'

  if (isProduction) {
    throw new Error(message)
  }

  console.warn(message)
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'local-anon-key',
)
