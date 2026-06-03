import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { signOut } from '../services/authService'

export function LogoutPage() {
  const navigate = useNavigate()

  useEffect(() => {
    async function logout() {
      await signOut()
      navigate('/login', { replace: true })
    }

    void logout()
  }, [navigate])

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <p className="text-sm font-medium text-ink-700">Saindo...</p>
    </main>
  )
}
