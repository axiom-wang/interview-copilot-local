import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ConsensusPanel } from '../components/ConsensusPanel'
import { HintsPanel } from '../components/HintsPanel'
import { MindMapPanel } from '../components/MindMapPanel'
import { PhasePanel } from '../components/PhasePanel'
import { ReplayTransportBar } from '../components/ReplayTransportBar'
import { SessionList } from '../components/SessionList'
import { formatSessionDuration } from '../components/sessionFormat'
import { SummaryPreviewPanel } from '../components/SummaryPreviewPanel'
import { TranscriptPanel } from '../components/TranscriptPanel'
import { ActionMenu } from '../components/ui/ActionMenu'
import { ResizeHandle } from '../components/ui/ResizeHandle'
import { Tabs } from '../components/ui/Tabs'
import { resolveScenarioProfile } from '../../meeting/scenarios'
import {
  exportSessionAsJson,
  exportSessionAsMarkdown,
} from '../../meeting/services/sessionExport'
import { useAppStore } from '../store/useAppStore'
import type { ReplaySnapshot, SessionRecord } from '../../meeting/types/session'
import type { SpeakerProfile } from '../../meeting/types/speaker'

const REPLAY_LAYOUT_STORAGE_KEY = 'interview-copilot-local/replay-layout'
const DEFAULT_TRANSCRIPT_RATIO = 58
const MIN_TRANSCRIPT_RATIO = 40
const MAX_TRANSCRIPT_RATIO = 72

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const readTranscriptRatio = () => {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(REPLAY_LAYOUT_STORAGE_KEY) ?? '{}',
    ) as { transcriptRatio?: unknown }

    return clamp(
      Number(stored.transcriptRatio) || DEFAULT_TRANSCRIPT_RATIO,
      MIN_TRANSCRIPT_RATIO,
      MAX_TRANSCRIPT_RATIO,
    )
  } catch {
    return DEFAULT_TRANSCRIPT_RATIO
  }
}

const formatDateRange = (session: SessionRecord) => {
  const day = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(session.startedAt)
  const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return `${day} ${time.format(session.startedAt)}–${time.format(session.endedAt)}`
}

const getSpeakerDisplayName = (
  speakerId: string,
  speakerProfiles: Record<string, SpeakerProfile>,
) => {
  const profile = speakerProfiles[speakerId]

  if (!profile) {
    return speakerId
  }

  if (profile.isMe) {
    return profile.displayName ? `我 · ${profile.displayName}` : '我'
  }

  return profile.displayName ?? speakerId
}

const latestSnapshotAt = (snapshots: ReplaySnapshot[], timestamp: number) =>
  snapshots
    .filter((snapshot) => snapshot.timestamp <= timestamp)
    .reduce<ReplaySnapshot | null>(
      (latest, snapshot) =>
        !latest || snapshot.timestamp >= latest.timestamp ? snapshot : latest,
      null,
    ) ?? snapshots[0] ?? null

function TimelineView({ session }: { session: SessionRecord }) {
  const replayTimestamp = useAppStore((state) => state.replayTimestamp)
  const setReplayTimestamp = useAppStore((state) => state.setReplayTimestamp)
  const [searchTerm, setSearchTerm] = useState('')
  const [transcriptRatio, setTranscriptRatio] = useState(readTranscriptRatio)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        REPLAY_LAYOUT_STORAGE_KEY,
        JSON.stringify({ transcriptRatio }),
      )
    } catch {
      // Keep the resized layout for this session if browser storage is unavailable.
    }
  }, [transcriptRatio])

  const resizeColumns = useCallback((delta: number) => {
    const width = gridRef.current?.clientWidth ?? 0
    if (width === 0) return
    setTranscriptRatio((current) =>
      clamp(current + (delta / width) * 100, MIN_TRANSCRIPT_RATIO, MAX_TRANSCRIPT_RATIO),
    )
  }, [])

  const activeTimestamp = clamp(
    replayTimestamp ?? session.endedAt,
    session.startedAt,
    session.endedAt,
  )
  const visibleSegments = session.transcriptSegments.filter(
    (segment) => segment.timestamp <= activeTimestamp,
  )
  const speakerProfiles = session.speakerProfiles ?? {}
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const filteredSegments = normalizedSearchTerm
    ? visibleSegments.filter((segment) =>
        `${getSpeakerDisplayName(segment.speaker, speakerProfiles)} ${segment.speaker} ${segment.text}`
          .toLowerCase()
          .includes(normalizedSearchTerm),
      )
    : visibleSegments
  const activeSnapshot = latestSnapshotAt(session.analysisSnapshots, activeTimestamp)
  const pinnedSegments = session.pinnedSegments.map((pin) => {
    const segment = session.transcriptSegments.find((item) => item.id === pin.segmentId)
    return segment
      ? {
          ...pin,
          note: `${getSpeakerDisplayName(segment.speaker, speakerProfiles)} @ ${new Intl.DateTimeFormat(
            'zh-CN',
            { hour: '2-digit', minute: '2-digit' },
          ).format(segment.timestamp)}`,
        }
      : pin
  })

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full">
      <ReplayTransportBar
        className="shrink-0"
        onChangeTimestamp={setReplayTimestamp}
        replayTimestamp={activeTimestamp}
        session={session}
      />
      <div
        className="replay-timeline min-h-0 lg:flex-1"
        ref={gridRef}
        style={{ '--replay-transcript-ratio': `${transcriptRatio}%` } as CSSProperties}
      >
        <TranscriptPanel
          emptyMessage={
            searchTerm ? '没有匹配的转写片段。' : '这个时间点之前还没有转写内容。'
          }
          headerControls={
            <input
              aria-label="搜索转写"
              className="theme-input w-full px-2.5 py-1 text-sm"
              onChange={(event) => setSearchTerm(event.currentTarget.value)}
              placeholder="搜索内容或发言人"
              type="search"
              value={searchTerm}
            />
          }
          pinnedSegments={pinnedSegments}
          searchTerm={searchTerm}
          segments={filteredSegments}
          speakerProfiles={speakerProfiles}
          title="转写"
        />
        <ResizeHandle
          ariaLabel="调整转写与分析区域宽度"
          onDelta={resizeColumns}
          onReset={() => setTranscriptRatio(DEFAULT_TRANSCRIPT_RATIO)}
          orientation="vertical"
        />
        <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:h-full">
          <PhasePanel
            className="shrink-0"
            phaseAnalysis={activeSnapshot?.phaseAnalysis ?? null}
            scenarioId={session.scenarioId}
            variant="compact"
          />
          {resolveScenarioProfile(session.scenarioId).interactionModel === 'qa' ? null : (
            <HintsPanel
              className="min-h-[320px] lg:min-h-0 lg:flex-1"
              hints={activeSnapshot?.speakingHints ?? null}
              lastUpdatedAt={activeSnapshot?.timestamp ?? null}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SessionDetail({ session }: { session: SessionRecord }) {
  const deleteSession = useAppStore((state) => state.deleteSession)
  const isDemo = session.id === 'session-demo'
  const finalSnapshot = latestSnapshotAt(session.analysisSnapshots, session.endedAt)
  const mindMapSnapshot =
    finalSnapshot?.mindMapSnapshot ?? session.mindMapSnapshots?.at(-1) ?? null

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:h-full">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="theme-title truncate text-lg font-semibold">{session.title}</h1>
          <p className="theme-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            <span>{resolveScenarioProfile(session.scenarioId).label}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatDateRange(session)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatSessionDuration(session)}</span>
            <span aria-hidden="true">·</span>
            <span>{session.transcriptSegments.length} 段发言</span>
            {isDemo ? (
              <>
                <span aria-hidden="true">·</span>
                <span>示例数据</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ActionMenu
            items={[
              { label: 'Markdown', onSelect: () => exportSessionAsMarkdown(session) },
              { label: 'JSON', onSelect: () => exportSessionAsJson(session) },
            ]}
            label="导出会话"
            triggerText="导出"
          />
          {!isDemo ? (
            <button
              className="btn-ghost text-xs text-[color:var(--danger-text)] hover:bg-[color:var(--danger-soft)]"
              onClick={() => {
                if (window.confirm('确认删除这场会议吗？删除后无法恢复。')) {
                  deleteSession(session.id)
                }
              }}
              type="button"
            >
              删除
            </button>
          ) : null}
        </div>
      </header>

      <Tabs
        className="min-h-[520px] lg:min-h-0 lg:flex-1"
        defaultTabId={session.meetingSummary || session.meetingMinutes ? 'summary' : 'timeline'}
        items={[
          {
            id: 'summary',
            label: '总结与纪要',
            content: (
              <SummaryPreviewPanel
                className="h-full"
                embedded
                minutes={session.meetingMinutes ?? null}
                scenarioId={session.scenarioId}
                summary={session.meetingSummary ?? null}
              />
            ),
          },
          {
            id: 'timeline',
            label: '时间线回放',
            content: <TimelineView session={session} />,
          },
          ...(resolveScenarioProfile(session.scenarioId).interactionModel === 'qa' ? [] : [{
            id: 'consensus',
            label: '共识分歧',
            content: (
              <ConsensusPanel
                analysis={finalSnapshot?.consensusAnalysis ?? null}
                meetingMemory={session.meetingMemory}
                scenarioId={session.scenarioId}
                className="h-full"
                detailSegments={session.transcriptSegments}
                embedded
                speakerProfiles={session.speakerProfiles ?? {}}
              />
            ),
          }]),
          {
            id: 'mindmap',
            label: '思维导图',
            content: (
              <MindMapPanel className="h-full" embedded snapshot={mindMapSnapshot} />
            ),
          },
        ]}
      />
    </div>
  )
}

export function ReplayPage() {
  const sessions = useAppStore((state) => state.savedSessions)
  const selectedSessionId = useAppStore((state) => state.selectedSessionId)
  const selectSession = useAppStore((state) => state.selectSession)
  const setActiveView = useAppStore((state) => state.setActiveView)

  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null

  if (!selectedSession) {
    return (
      <div className="panel-card panel-empty mx-auto flex min-h-[420px] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h2 className="theme-title text-lg font-semibold">还没有历史会话</h2>
        <p className="theme-muted mt-2 max-w-md text-sm leading-6">
          每场会议结束时会自动保存到这里，之后可以查看总结与纪要，或按时间线回看当时的建议。
        </p>
        <button className="btn-primary mt-5" onClick={() => setActiveView('live')} type="button">
          准备一场会议
        </button>
      </div>
    )
  }

  return (
    <div className="replay-layout min-h-0 lg:h-full">
      <SessionList
        className="max-h-72 lg:max-h-none"
        onSelect={selectSession}
        selectedSessionId={selectedSession.id}
        sessions={sessions}
      />
      <SessionDetail key={selectedSession.id} session={selectedSession} />
    </div>
  )
}
