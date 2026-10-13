import { useEffect } from 'react'
import { AuthPage } from './pages/AuthPage'
import { SettingsPage } from './pages/SettingsPage'
import { AppShell } from './components/layout/AppShell'
import { LiveAssistPage } from './modes/LiveAssistPage'
import { ReplayPage } from './modes/ReplayPage'
import { useAppStore } from './store/useAppStore'
import { useAuthStore } from './store/useAuthStore'

function App() {
  const activeView = useAppStore((state) => state.activeView)
  const initialize = useAppStore((state) => state.initialize)
  const authReady = useAuthStore((state) => state.ready)
  const user = useAuthStore((state) => state.user)
  const initializeAuth = useAuthStore((state) => state.initialize)

  useEffect(() => {
    void initializeAuth()
  }, [initializeAuth])

  useEffect(() => {
    if (user) {
      initialize()
    }
  }, [initialize, user])

  if (!authReady) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center">
        <p className="theme-muted text-sm">正在加载…</p>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <AppShell>
      {activeView === 'settings' ? (
        <SettingsPage />
      ) : activeView === 'replay' ? (
        <ReplayPage />
      ) : (
        <LiveAssistPage />
      )}
    </AppShell>
  )
}

export default App
