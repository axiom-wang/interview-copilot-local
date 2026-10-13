import { MindMapPanel } from '../../components/MindMapPanel'
import { useAppStore } from '../../store/useAppStore'

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`
}

export function LiveReviewBar({ onGenerateSummary }: { onGenerateSummary: () => void }) {
  const liveSegments = useAppStore((state) => state.liveSegments)
  const currentSessionId = useAppStore((state) => state.currentSessionId)
  const currentSessionStartedAt = useAppStore((state) => state.currentSessionStartedAt)
  const currentSessionEndedAt = useAppStore((state) => state.currentSessionEndedAt)
  const savedSessions = useAppStore((state) => state.savedSessions)
  const meetingSummary = useAppStore((state) => state.meetingSummary)
  const meetingMinutes = useAppStore((state) => state.meetingMinutes)
  const isGeneratingSummary = useAppStore((state) => state.isGeneratingSummary)
  const isGeneratingMinutes = useAppStore((state) => state.isGeneratingMinutes)
  const mindMap = useAppStore((state) => state.mindMap)
  const mindMapStale = useAppStore((state) => state.mindMapStale)
  const isGeneratingMindMap = useAppStore((state) => state.isGeneratingMindMap)
  const generateMindMap = useAppStore((state) => state.generateMindMap)
  const selectSession = useAppStore((state) => state.selectSession)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const startNewMeeting = useAppStore((state) => state.startNewMeeting)

  const startedAt = currentSessionStartedAt ?? liveSegments[0]?.timestamp ?? 0
  const endedAt = currentSessionEndedAt ?? liveSegments.at(-1)?.timestamp ?? startedAt
  const isSaved = savedSessions.some((session) => session.id === currentSessionId)
  const hasFinal = liveSegments.some((segment) => segment.isFinal)
  const isGenerating = isGeneratingSummary || isGeneratingMinutes
  const hasSummary = Boolean(meetingSummary || meetingMinutes)

  return (
    <section className="panel-card flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="theme-title text-sm font-semibold">会议已结束</p>
        <p className="theme-muted mt-0.5 text-xs">
          时长 {formatDuration(endedAt - startedAt)} · {liveSegments.length} 段发言 ·{' '}
          {isSaved ? '已自动保存到历史会话' : '未保存'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={hasSummary ? 'btn-secondary' : 'btn-primary'}
          disabled={!hasFinal || isGenerating}
          onClick={onGenerateSummary}
          type="button"
        >
          {isGenerating ? '正在生成…' : hasSummary ? '重新生成总结与纪要' : '生成总结与纪要'}
        </button>
        <MindMapPanel
          disableGenerate={!hasFinal}
          isGenerating={isGeneratingMindMap}
          isStale={mindMapStale}
          onGenerate={async () => {
            await generateMindMap()
            return Boolean(useAppStore.getState().mindMap)
          }}
          presentation="launcher"
          snapshot={mindMap}
        />
        {isSaved && currentSessionId ? (
          <button
            className="btn-ghost"
            onClick={() => {
              selectSession(currentSessionId)
              setActiveView('replay')
            }}
            type="button"
          >
            在历史会话中查看
          </button>
        ) : null}
        <button className="btn-ghost" onClick={startNewMeeting} type="button">
          开始新会议
        </button>
      </div>
    </section>
  )
}
