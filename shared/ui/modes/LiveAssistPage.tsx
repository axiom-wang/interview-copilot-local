import { useAppStore } from '../store/useAppStore'
import { LivePrepView } from './live/LivePrepView'
import { LiveSessionView } from './live/LiveSessionView'

export function LiveAssistPage() {
  const isStreaming = useAppStore((state) => state.isStreaming)
  const hasSegments = useAppStore((state) => state.liveSegments.length > 0)

  if (isStreaming) {
    return <LiveSessionView mode="live" />
  }

  if (hasSegments) {
    return <LiveSessionView mode="review" />
  }

  return <LivePrepView />
}
