import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ConsensusPanel } from '../components/ConsensusPanel'
import { HintsPanel } from '../components/HintsPanel'
import { MindMapPanel } from '../components/MindMapPanel'
import { PhasePanel } from '../components/PhasePanel'
import { ReplayTransportBar } from '../components/ReplayTransportBar'
import { SummaryPreviewPanel } from '../components/SummaryPreviewPanel'
import { TranscriptPanel } from '../components/TranscriptPanel'
import { ResizeHandle } from '../components/ui/ResizeHandle'
import { Tabs } from '../components/ui/Tabs'
import {
  exportSessionAsJson,
  exportSessionAsMarkdown,
} from '../services/sessionExport'
import { useAppStore } from '../store/useAppStore'
import type { SpeakerProfile } from '../types/speaker'

const REPLAY_LAYOUT_STORAGE_KEY = 'interview-copilot-local/replay-layout'
const DEFAULT_TRANSCRIPT_RATIO = 64
const DEFAULT_PHASE_HEIGHT = 60
const DEFAULT_TRANSPORT_HEIGHT = 82

interface ReplayLayoutSettings {
  transcriptRatio: number
  phaseHeight: number
  transportHeight: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const readReplayLayout = (): ReplayLayoutSettings => {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(REPLAY_LAYOUT_STORAGE_KEY) ?? '',
    ) as Partial<ReplayLayoutSettings>

    return {
      transcriptRatio: clamp(
        Number(stored.transcriptRatio) || DEFAULT_TRANSCRIPT_RATIO,
        42,
        72,
      ),
      phaseHeight: clamp(
        Number(stored.phaseHeight) || DEFAULT_PHASE_HEIGHT,
        48,
        260,
      ),
      transportHeight: clamp(
        Number(stored.transportHeight) || DEFAULT_TRANSPORT_HEIGHT,
        82,
        180,
      ),
    }
  } catch {
    return {
      transcriptRatio: DEFAULT_TRANSCRIPT_RATIO,
      phaseHeight: DEFAULT_PHASE_HEIGHT,
      transportHeight: DEFAULT_TRANSPORT_HEIGHT,
    }
  }
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

export function ReplayPage() {
  const sessions = useAppStore((state) => state.savedSessions)
  const selectedSessionId = useAppStore((state) => state.selectedSessionId)
  const replayTimestamp = useAppStore((state) => state.replayTimestamp)
  const selectSession = useAppStore((state) => state.selectSession)
  const deleteSession = useAppStore((state) => state.deleteSession)
  const setReplayTimestamp = useAppStore((state) => state.setReplayTimestamp)
  const [searchTerm, setSearchTerm] = useState('')
  const [layout, setLayout] = useState(readReplayLayout)
  const pageLayoutRef = useRef<HTMLDivElement>(null)
  const workbenchRef = useRef<HTMLDivElement>(null)
  const analysisStackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(REPLAY_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
    } catch {
      // Keep the resized layout for this session if browser storage is unavailable.
    }
  }, [layout])

  const resizeColumns = useCallback((delta: number) => {
    const width = workbenchRef.current?.clientWidth ?? 0
    if (width === 0) return

    setLayout((current) => ({
      ...current,
      transcriptRatio: clamp(
        current.transcriptRatio + (delta / width) * 100,
        42,
        72,
      ),
    }))
  }, [])

  const resizePhase = useCallback((delta: number) => {
    const height = analysisStackRef.current?.clientHeight ?? 0
    const maximum = Math.max(48, height - 280)

    setLayout((current) => ({
      ...current,
      phaseHeight: clamp(current.phaseHeight + delta, 48, maximum),
    }))
  }, [])

  const resizeTransport = useCallback((delta: number) => {
    const height = pageLayoutRef.current?.clientHeight ?? 0
    const maximum = Math.max(82, height - 340)

    setLayout((current) => ({
      ...current,
      transportHeight: clamp(current.transportHeight + delta, 82, maximum),
    }))
  }, [])

  const resetLayout = useCallback(() => {
    setLayout({
      transcriptRatio: DEFAULT_TRANSCRIPT_RATIO,
      phaseHeight: DEFAULT_PHASE_HEIGHT,
      transportHeight: DEFAULT_TRANSPORT_HEIGHT,
    })
  }, [])

  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null

  const activeReplayTimestamp = replayTimestamp ?? selectedSession?.endedAt ?? null

  const visibleSegments = selectedSession
    ? selectedSession.transcriptSegments.filter(
        (segment) => segment.timestamp <= (activeReplayTimestamp ?? selectedSession.endedAt),
      )
    : []

  const speakerProfiles = selectedSession?.speakerProfiles ?? {}

  const filteredSegments = (() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase()

    if (!normalizedSearchTerm) {
      return visibleSegments
    }

    return visibleSegments.filter((segment) => {
      const displayName = getSpeakerDisplayName(segment.speaker, speakerProfiles)
      return `${displayName} ${segment.speaker} ${segment.text}`
        .toLowerCase()
        .includes(normalizedSearchTerm)
    })
  })()

  const activeSnapshot = selectedSession
    ? selectedSession.analysisSnapshots
        .filter(
          (snapshot) => snapshot.timestamp <= (activeReplayTimestamp ?? selectedSession.endedAt),
        )
        .at(-1) ?? selectedSession.analysisSnapshots[0] ?? null
    : null

  if (!selectedSession || activeReplayTimestamp === null) {
    return (
      <div className="panel-card panel-empty flex min-h-[480px] flex-col items-center justify-center px-6 text-center">
        <p className="kicker theme-muted text-[11px]">Replay</p>
        <h2 className="theme-title mt-2 text-lg font-semibold">还没有可回放的会话</h2>
        <p className="theme-muted mt-2 max-w-md text-sm leading-6">
          保存一场实时辅助后，可在这里按时间线复盘。
        </p>
      </div>
    )
  }

  return (
    <div
      className="replay-page-layout min-h-0 xl:h-full"
      ref={pageLayoutRef}
      style={
        {
          '--replay-transport-height': `${layout.transportHeight}px`,
        } as CSSProperties
      }
    >
      <div className="min-h-0">
        <ReplayTransportBar
          onChangeTimestamp={setReplayTimestamp}
          onDeleteSession={(sessionId) => {
            if (window.confirm('确认删除这条已保存会话吗？删除后无法恢复。')) {
              deleteSession(sessionId)
            }
          }}
          onExportJson={() => exportSessionAsJson(selectedSession)}
          onExportMarkdown={() => exportSessionAsMarkdown(selectedSession)}
          onResetLayout={resetLayout}
          onSelectSession={selectSession}
          replayTimestamp={activeReplayTimestamp}
          selectedSessionId={selectedSession.id}
          sessions={sessions}
        />
      </div>

      <ResizeHandle
        ariaLabel="调整回放工具栏与内容区域高度"
        onDelta={resizeTransport}
        onReset={resetLayout}
        orientation="horizontal"
      />

      <div
        className="replay-workbench min-h-0 xl:flex-1 xl:overflow-hidden"
        ref={workbenchRef}
        style={
          {
            '--replay-transcript-ratio': `${layout.transcriptRatio}%`,
          } as CSSProperties
        }
      >
        <div className="min-h-0 min-w-0 xl:h-full">
          <TranscriptPanel
            emptyMessage={
              searchTerm
                ? '当前搜索条件下没有匹配的转写片段。'
                : '当前回放时间点还没有转写内容。'
            }
            headerControls={
              <label className="theme-input block w-full px-3 py-2">
                <span className="sr-only">搜索转写</span>
                <input
                  className="theme-title w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--text-muted)]"
                  onChange={(event) => setSearchTerm(event.currentTarget.value)}
                  placeholder="搜索转写内容或发言人"
                  type="search"
                  value={searchTerm}
                />
              </label>
            }
            pinnedSegments={selectedSession.pinnedSegments}
            searchTerm={searchTerm}
            segments={filteredSegments}
            speakerProfiles={speakerProfiles}
            title="回放转写"
          />
        </div>

        <ResizeHandle
          ariaLabel="调整转写与分析区域宽度"
          onDelta={resizeColumns}
          onReset={resetLayout}
          orientation="vertical"
        />

        <div
          className="replay-analysis-stack min-h-0 min-w-0 xl:h-full xl:overflow-hidden"
          ref={analysisStackRef}
          style={
            {
              '--replay-phase-height': `${layout.phaseHeight}px`,
            } as CSSProperties
          }
        >
          <PhasePanel
            className="min-h-0"
            phaseAnalysis={activeSnapshot?.phaseAnalysis ?? null}
            scenarioId={selectedSession.scenarioId}
            variant="compact"
          />
          <ResizeHandle
            ariaLabel="调整阶段与分析区域高度"
            onDelta={resizePhase}
            onReset={resetLayout}
            orientation="horizontal"
          />
          <Tabs
            className="min-h-[320px] xl:min-h-0"
            defaultTabId="consensus"
            items={[
              {
                id: 'consensus',
                label: '共识分歧',
                content: (
                  <ConsensusPanel
                    analysis={activeSnapshot?.consensusAnalysis ?? null}
                    className="h-full"
                    detailSegments={visibleSegments}
                    embedded
                    speakerProfiles={speakerProfiles}
                  />
                ),
              },
              {
                id: 'summary',
                label: '会议总结',
                content: (
                  <SummaryPreviewPanel
                    className="h-full"
                    embedded
                    minutes={selectedSession.meetingMinutes ?? null}
                    scenarioId={selectedSession.scenarioId}
                    summary={selectedSession.meetingSummary ?? null}
                  />
                ),
              },
              {
                id: 'mindmap',
                label: '思维导图',
                content: (
                  <MindMapPanel
                    className="h-full"
                    embedded
                    snapshot={activeSnapshot?.mindMapSnapshot ?? null}
                  />
                ),
              },
              {
                id: 'hints',
                label: '发言建议',
                content: (
                  <HintsPanel
                    className="h-full"
                    embedded
                    hints={activeSnapshot?.speakingHints ?? null}
                  />
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
