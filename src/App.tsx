import { useEffect, useState } from 'react'

import { BwBarberSplash } from './components/BwBarberSplash'
import { AppProviders } from './contexts/AppProviders'
import { AppRouter } from './routes/AppRouter'

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [isSplashLeaving, setIsSplashLeaving] = useState(false)

  useEffect(() => {
    const exitTimer = window.setTimeout(() => {
      setIsSplashLeaving(true)
    }, 2380)

    const finishTimer = window.setTimeout(() => {
      setShowSplash(false)
    }, 2800)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(finishTimer)
    }
  }, [])

  return (
    <AppProviders>
      <AppRouter />
      {showSplash && <BwBarberSplash isLeaving={isSplashLeaving} />}
    </AppProviders>
  )
}

export default App
