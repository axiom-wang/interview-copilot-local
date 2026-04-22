import { useState } from 'react'
import { ConsensusPanel } from '../components/ConsensusPanel'
import { HintsPanel } from '../components/HintsPanel'
import { MindMapPanel } from '../components/MindMapPanel'
import { PhasePanel } from '../components/PhasePanel'
import { ReplayTimeline } from '../components/ReplayTimeline'
import { SummaryPreviewPanel } from '../components/SummaryPreviewPanel'
import { TranscriptPanel } from '../components/TranscriptPanel'
import {
  exportSessionAsJson,
  exportSessionAsMarkdown,
} from '../services/sessionExport'
import { useAppStore } from '../store/useAppStore'
import type { SpeakerProfile } from '../types/speaker'

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
      <div className="panel-card panel-empty theme-muted flex min-h-[680px] items-center justify-center rounded-[28px] text-sm">
        当前还没有可回放的会话。
      </div>
    )
  }

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[360px_1fr]">
      <div className="self-start">
        <ReplayTimeline
          onChangeTimestamp={setReplayTimestamp}
          onDeleteSession={(sessionId) => {
            if (window.confirm('确认删除这条已保存会话吗？删除后无法恢复。')) {
              deleteSession(sessionId)
            }
          }}
          onJumpToSnapshot={(snapshot) => setReplayTimestamp(snapshot.timestamp)}
          onSelectSession={selectSession}
          replayTimestamp={activeReplayTimestamp}
          selectedSessionId={selectedSession.id}
          sessions={sessions}
        />
      </div>

      <div className="flex min-h-[780px] min-w-0 flex-col gap-4">
        <div className="grid min-h-[720px] gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
          <TranscriptPanel
            description="回放模式下，转写视图与实时模式保持一致，方便从现场切换到复盘时维持同一套工作视角。"
            emptyMessage={
              searchTerm
                ? '当前搜索条件下没有匹配的转写片段。'
                : '当前回放时间点还没有转写内容。'
            }
            headerControls={
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <label className="theme-input rounded-[20px] px-4 py-3 xl:max-w-md xl:flex-1">
                    <span className="sr-only">搜索转写</span>
                    <input
                      className="theme-title w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--text-muted)]"
                      onChange={(event) => setSearchTerm(event.currentTarget.value)}
                      placeholder="搜索转写内容或发言人"
                      type="search"
                      value={searchTerm}
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="theme-button-primary rounded-full border px-4 py-2 text-sm transition"
                      onClick={() => exportSessionAsJson(selectedSession)}
                      type="button"
                    >
                      导出 JSON
                    </button>
                    <button
                      className="theme-button-neutral rounded-full border px-4 py-2 text-sm transition"
                      onClick={() => exportSessionAsMarkdown(selectedSession)}
                      type="button"
                    >
                      导出 Markdown
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="status-badge">会话：{selectedSession.title}</span>
                  <span className="status-badge">可见片段：{visibleSegments.length}</span>
                  <span className="status-badge">搜索结果：{filteredSegments.length}</span>
                </div>
              </div>
            }
            pinnedSegments={selectedSession.pinnedSegments}
            searchTerm={searchTerm}
            segments={filteredSegments}
            speakerProfiles={speakerProfiles}
            title="回放转写"
          />

          <div className="grid min-w-0 content-start gap-4">
            <PhasePanel phaseAnalysis={activeSnapshot?.phaseAnalysis ?? null} />
            <ConsensusPanel
              analysis={activeSnapshot?.consensusAnalysis ?? null}
              detailSegments={visibleSegments}
              speakerProfiles={speakerProfiles}
            />
            <HintsPanel hints={activeSnapshot?.speakingHints ?? null} />
            <div className="grid gap-4 2xl:grid-cols-2">
              <MindMapPanel snapshot={activeSnapshot?.mindMapSnapshot ?? null} />
              <SummaryPreviewPanel summary={selectedSession.meetingSummary ?? null} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
