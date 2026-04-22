import { useEffect } from 'react'
import { TopBar } from './components/TopBar'
import { LiveAssistPage } from './modes/LiveAssistPage'
import { ReplayPage } from './modes/ReplayPage'
import { useAppStore } from './store/useAppStore'

function App() {
  const mode = useAppStore((state) => state.mode)
  const initialize = useAppStore((state) => state.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <div className="page-shell min-h-screen">
      <div className="app-frame flex min-h-screen flex-col px-4 py-4 md:px-6">
        <TopBar />
        <main className="mt-4 flex min-h-0 flex-1">
          {mode === 'live' ? <LiveAssistPage /> : <ReplayPage />}
        </main>
      </div>
    </div>
  )
}

export default App
