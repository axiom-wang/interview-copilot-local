import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AiQaPanel } from '../../components/AiQaPanel'
import { ConsensusPanel } from '../../components/ConsensusPanel'
import { HintsPanel } from '../../components/HintsPanel'
import { PhasePanel } from '../../components/PhasePanel'
import { RuntimeMessageStrip } from '../../components/RuntimeMessageStrip'
import { SummaryPreviewPanel } from '../../components/SummaryPreviewPanel'
import { TranscriptPanel } from '../../components/TranscriptPanel'
import { ResizeHandle } from '../../components/ui/ResizeHandle'
import { Tabs } from '../../components/ui/Tabs'
import { useElementSize } from '../../hooks/useElementSize'
import { exportLiveTranscriptAsTxt } from '../../../meeting/services/transcriptExport'
import { useAppStore } from '../../store/useAppStore'
import type { SpeakerProfile } from '../../../meeting/types/speaker'
import { LiveReviewBar } from './LiveReviewBar'

const LIVE_LAYOUT_STORAGE_KEY = 'interview-copilot-local/live-layout'
const DEFAULT_COPILOT_RATIO = 0.6
const MIN_COPILOT_RATIO = 0.45
const MAX_COPILOT_RATIO = 0.72
const DEFAULT_HINTS_RATIO = 0.58
const MIN_HINTS_PX = 180
const MIN_ANALYSIS_PX = 160
const STACK_RAIL = 10

interface LiveLayout {
  copilotRatio: number
  hintsRatio: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const readRatio = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback

const readLayout = (): LiveLayout => {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(LIVE_LAYOUT_STORAGE_KEY) ?? '{}',
    ) as { copilotRatio?: unknown; hintsRatio?: unknown }

    return {
      copilotRatio: readRatio(
        stored.copilotRatio,
        MIN_COPILOT_RATIO,
        MAX_COPILOT_RATIO,
        DEFAULT_COPILOT_RATIO,
      ),
      hintsRatio: readRatio(stored.hintsRatio, 0.05, 0.95, DEFAULT_HINTS_RATIO),
    }
  } catch {
    return { copilotRatio: DEFAULT_COPILOT_RATIO, hintsRatio: DEFAULT_HINTS_RATIO }
  }
}

const hintsHeightFor = (ratio: number, stackHeight: number) => {
  const available = Math.max(stackHeight - STACK_RAIL, 1)
  const minHints = Math.min(MIN_HINTS_PX, available)
  const maxHints = Math.max(minHints, available - Math.min(MIN_ANALYSIS_PX, available - minHints))

  return clamp(ratio * available, minHints, maxHints)
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

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

export function LiveSessionView({ mode }: { mode: 'live' | 'review' }) {
  const { ref: layoutRef, width: layoutWidth } = useElementSize<HTMLDivElement>()
  const { ref: stackRef, height: stackHeight } = useElementSize<HTMLDivElement>()
  const [layout, setLayout] = useState(readLayout)
  const [reviewTab, setReviewTab] = useState('summary')
  const stackHeightRef = useRef(stackHeight)

  const liveSegments = useAppStore((state) => state.liveSegments)
  const speakerProfiles = useAppStore((state) => state.speakerProfiles)
  const pinnedSegmentIds = useAppStore((state) => state.pinnedSegmentIds)
  const phaseAnalysis = useAppStore((state) => state.phaseAnalysis)
  const meetingMemory = useAppStore((state) => state.meetingMemory)
  const scenarioId = useAppStore((state) => state.scenarioId)
  const consensusAnalysis = useAppStore((state) => state.consensusAnalysis)
  const speakingHints = useAppStore((state) => state.speakingHints)
  const isRefreshingHints = useAppStore((state) => state.isRefreshingHints)
  const speakingHintsStale = useAppStore((state) => state.speakingHintsStale)
  const lastHintsUpdatedAt = useAppStore((state) => state.lastHintsUpdatedAt)
  const autoRefreshHints = useAppStore((state) => state.autoRefreshHints)
  const meetingSummary = useAppStore((state) => state.meetingSummary)
  const summaryStale = useAppStore((state) => state.summaryStale)
  const isGeneratingSummary = useAppStore((state) => state.isGeneratingSummary)
  const meetingMinutes = useAppStore((state) => state.meetingMinutes)
  const minutesStale = useAppStore((state) => state.minutesStale)
  const isGeneratingMinutes = useAppStore((state) => state.isGeneratingMinutes)
  const aiQuestionDraft = useAppStore((state) => state.aiQuestionDraft)
  const aiQaHistory = useAppStore((state) => state.aiQaHistory)
  const aiQaError = useAppStore((state) => state.aiQaError)
  const isAnsweringQuestion = useAppStore((state) => state.isAnsweringQuestion)
  const errorMessage = useAppStore((state) => state.errorMessage)
  const speakerStability = useAppStore((state) => state.speakerStability)
  const isAnalyzing = useAppStore((state) => state.isAnalyzing)
  const isStreaming = useAppStore((state) => state.isStreaming)
  const markSpeakerAsMe = useAppStore((state) => state.markSpeakerAsMe)
  const renameSpeaker = useAppStore((state) => state.renameSpeaker)
  const clearSpeakerBinding = useAppStore((state) => state.clearSpeakerBinding)
  const deleteLiveSegment = useAppStore((state) => state.deleteLiveSegment)
  const togglePinnedSegment = useAppStore((state) => state.togglePinnedSegment)
  const pinCurrentSegment = useAppStore((state) => state.pinCurrentSegment)
  const refreshSpeakingHints = useAppStore((state) => state.refreshSpeakingHints)
  const setAutoRefreshHints = useAppStore((state) => state.setAutoRefreshHints)
  const generateMeetingSummary = useAppStore((state) => state.generateMeetingSummary)
  const generateMeetingMinutes = useAppStore((state) => state.generateMeetingMinutes)
  const setAiQuestionDraft = useAppStore((state) => state.setAiQuestionDraft)
  const askAiQuestion = useAppStore((state) => state.askAiQuestion)
  const clearAiQaHistory = useAppStore((state) => state.clearAiQaHistory)

  useEffect(() => {
    stackHeightRef.current = stackHeight
  }, [stackHeight])

  useEffect(() => {
    try {
      window.localStorage.setItem(LIVE_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
    } catch {
      // Resizing still works for this session when storage is unavailable.
    }
  }, [layout])

  useEffect(() => {
    if (!isStreaming) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(event.target)
      ) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === 'm') {
        event.preventDefault()
        pinCurrentSegment()
      } else if (key === 'r') {
        event.preventDefault()
        void refreshSpeakingHints()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isStreaming, pinCurrentSegment, refreshSpeakingHints])

  const pinnedSegments = liveSegments
    .filter((segment) => pinnedSegmentIds.includes(segment.id))
    .map((segment) => ({
      id: `pin-view-${segment.id}`,
      segmentId: segment.id,
      note: `${getSpeakerDisplayName(segment.speaker, speakerProfiles)} @ ${new Intl.DateTimeFormat(
        'zh-CN',
        { hour: '2-digit', minute: '2-digit' },
      ).format(segment.timestamp)}`,
      pinnedAt: segment.timestamp,
    }))

  const finalSegmentCount = liveSegments.filter((segment) => segment.isFinal).length
  const disableAiQuestionAsk =
    isAnsweringQuestion ||
    aiQuestionDraft.trim().length === 0 ||
    (finalSegmentCount === 0 && pinnedSegmentIds.length === 0)

  const runtimeMessage = errorMessage
    ? { tone: 'error' as const, message: errorMessage }
    : null

  const transcriptStatus = mode === 'live'
    ? speakerStability === 'unstable'
      ? {
          tone: 'warning' as const,
          message: '发言人待识别，可点说话人旁的「⋯」改名，或标记哪位是你。',
        }
      : { tone: 'info' as const, message: '转写内容会实时更新。' }
    : undefined

  const resizeColumns = (delta: number) => {
    const width = Math.max(layoutWidth - 10, 1)
    setLayout((current) => ({
      ...current,
      copilotRatio: clamp(
        current.copilotRatio + delta / width,
        MIN_COPILOT_RATIO,
        MAX_COPILOT_RATIO,
      ),
    }))
  }

  const resizeHints = (delta: number) => {
    const available = Math.max(stackHeightRef.current - STACK_RAIL, 1)
    setLayout((current) => {
      const nextHeight = clamp(
        hintsHeightFor(current.hintsRatio, stackHeightRef.current) + delta,
        Math.min(MIN_HINTS_PX, available),
        Math.max(
          Math.min(MIN_HINTS_PX, available),
          available - Math.min(MIN_ANALYSIS_PX, available),
        ),
      )

      return { ...current, hintsRatio: nextHeight / available }
    })
  }

  const hintsHeight = hintsHeightFor(layout.hintsRatio, stackHeight)

  const generateSummaryAndMinutes = () => {
    setReviewTab('summary')
    void Promise.all([generateMeetingSummary(), generateMeetingMinutes()])
  }

  const consensusPanel = (
    <ConsensusPanel
      analysis={consensusAnalysis}
      meetingMemory={meetingMemory}
      scenarioId={scenarioId}
      className="h-full"
      detailSegments={liveSegments}
      embedded
      isLoading={isAnalyzing}
      speakerProfiles={speakerProfiles}
    />
  )

  const aiQaPanel = (
    <AiQaPanel
      className="w-full min-w-0"
      disableAsk={disableAiQuestionAsk}
      embedded
      error={aiQaError}
      history={aiQaHistory}
      isAnswering={isAnsweringQuestion}
      onAsk={() => {
        void askAiQuestion()
      }}
      onClearHistory={clearAiQaHistory}
      onQuestionDraftChange={setAiQuestionDraft}
      questionDraft={aiQuestionDraft}
    />
  )

  const copilotColumn =
    mode === 'live' ? (
      <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:h-full lg:overflow-hidden">
        <PhasePanel
          className="shrink-0"
          isLoading={isAnalyzing}
          phaseAnalysis={phaseAnalysis}
          variant="compact"
        />
        <div
          className="copilot-stack min-h-0 lg:flex-1"
          ref={stackRef}
          style={
            stackHeight > 0
              ? ({
                  '--copilot-stack-rows': `${Math.round(hintsHeight)}px ${STACK_RAIL}px minmax(0, 1fr)`,
                } as CSSProperties)
              : undefined
          }
        >
          <HintsPanel
            autoRefresh={autoRefreshHints}
            className="min-h-[280px] lg:h-full lg:min-h-0"
            density="live"
            hints={speakingHints}
            isRefreshing={isRefreshingHints}
            isStale={speakingHintsStale}
            lastUpdatedAt={lastHintsUpdatedAt}
            onRefresh={() => {
              void refreshSpeakingHints()
            }}
            onToggleAutoRefresh={setAutoRefreshHints}
          />
          <ResizeHandle
            ariaLabel="调整发言建议与分析区高度"
            onDelta={resizeHints}
            onReset={() =>
              setLayout((current) => ({ ...current, hintsRatio: DEFAULT_HINTS_RATIO }))
            }
            orientation="horizontal"
          />
          <Tabs
            className="min-h-[240px] lg:h-full lg:min-h-0"
            defaultTabId="consensus"
            items={[
              { id: 'consensus', label: '共识分歧', content: consensusPanel },
              { id: 'qa', label: 'AI 问答', content: aiQaPanel },
            ]}
          />
        </div>
      </div>
    ) : (
      <div className="flex min-h-0 min-w-0 flex-col lg:h-full">
        <Tabs
          activeId={reviewTab}
          className="min-h-[480px] lg:min-h-0 lg:flex-1"
          items={[
            {
              id: 'summary',
              label: '总结与纪要',
              content: (
                <SummaryPreviewPanel
                  className="h-full"
                  embedded
                  emptyHint="点击上方「生成总结与纪要」，口播稿和结构化纪要会一起生成并自动保存。"
                  isGenerating={isGeneratingSummary}
                  isGeneratingMinutes={isGeneratingMinutes}
                  isStale={summaryStale}
                  minutes={meetingMinutes}
                  minutesStale={minutesStale}
                  summary={meetingSummary}
                />
              ),
            },
            { id: 'consensus', label: '共识分歧', content: consensusPanel },
            { id: 'qa', label: 'AI 问答', content: aiQaPanel },
          ]}
          onActiveIdChange={setReviewTab}
        />
      </div>
    )

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full">
      {mode === 'review' ? (
        <LiveReviewBar onGenerateSummary={generateSummaryAndMinutes} />
      ) : null}
      {runtimeMessage ? (
        <RuntimeMessageStrip
          className="shrink-0"
          message={runtimeMessage.message}
          tone={runtimeMessage.tone}
        />
      ) : null}

      <div
        className="live-workspace min-h-0 lg:flex-1"
        ref={layoutRef}
        style={
          {
            '--live-workspace-columns': `${layout.copilotRatio}fr 10px ${1 - layout.copilotRatio}fr`,
          } as CSSProperties
        }
      >
        {copilotColumn}

        <ResizeHandle
          ariaLabel="调整建议区与转写区宽度"
          onDelta={resizeColumns}
          onReset={() =>
            setLayout((current) => ({ ...current, copilotRatio: DEFAULT_COPILOT_RATIO }))
          }
          orientation="vertical"
        />

        <div className="flex min-h-0 min-w-0 flex-col lg:h-full">
          <TranscriptPanel
            className="lg:flex-1"
            density="compact"
            emptyMessage={
              mode === 'live'
                ? '正在收音，听到发言后会实时出现在这里。'
                : '这场会议没有转写内容。'
            }
            followLatest={mode === 'live'}
            onClearSpeakerBinding={clearSpeakerBinding}
            onDeleteSegment={deleteLiveSegment}
            onExportAll={() => exportLiveTranscriptAsTxt(liveSegments, speakerProfiles)}
            onMarkAsMe={markSpeakerAsMe}
            onRenameSpeaker={renameSpeaker}
            onTogglePin={togglePinnedSegment}
            pinnedSegments={pinnedSegments}
            segments={liveSegments}
            speakerProfiles={speakerProfiles}
            status={transcriptStatus}
            title="转写"
          />
        </div>
      </div>
    </div>
  )
}
