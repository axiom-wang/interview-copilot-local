import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AiQaPanel } from '../components/AiQaPanel'
import { ConsensusPanel } from '../components/ConsensusPanel'
import { HintsPanel } from '../components/HintsPanel'
import { MindMapPanel } from '../components/MindMapPanel'
import { PhasePanel } from '../components/PhasePanel'
import { RuntimeMessageStrip } from '../components/RuntimeMessageStrip'
import { SummaryPreviewPanel } from '../components/SummaryPreviewPanel'
import { TranscriptPanel } from '../components/TranscriptPanel'
import { ResizeHandle } from '../components/ui/ResizeHandle'
import { Tabs } from '../components/ui/Tabs'
import { useElementSize } from '../hooks/useElementSize'
import { exportLiveTranscriptAsTxt } from '../services/transcriptExport'
import { useAppStore } from '../store/useAppStore'
import { useSettingsStore } from '../store/useSettingsStore'
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

/** Below this the third column would squeeze the transcript, so stay 2-up. */
const THREE_COLUMN_MIN_WIDTH = 1340
const LIVE_LAYOUT_STORAGE_KEY = 'interview-copilot-local/live-layout'

const RAIL_SIZE = 10
const MIN_HINTS_HEIGHT = 200
const MIN_ANALYSIS_HEIGHT = 240

interface LiveLayoutPreferences {
  twoColumnLeft: number
  threeColumnLeft: number
  threeColumnMiddle: number
  /** Hints height in px, so dragging tracks the pointer one-to-one. */
  hintsHeight: number
}

const DEFAULT_LAYOUT: LiveLayoutPreferences = {
  twoColumnLeft: 0.66,
  threeColumnLeft: 0.43,
  threeColumnMiddle: 0.27,
  hintsHeight: 360,
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const readStoredLayout = (): LiveLayoutPreferences => {
  try {
    const stored = window.localStorage.getItem(LIVE_LAYOUT_STORAGE_KEY)

    if (!stored) {
      return DEFAULT_LAYOUT
    }

    const parsed = JSON.parse(stored) as Partial<LiveLayoutPreferences>
    const merged = { ...DEFAULT_LAYOUT }

    for (const key of Object.keys(DEFAULT_LAYOUT) as (keyof LiveLayoutPreferences)[]) {
      const value = parsed[key]

      if (typeof value === 'number' && Number.isFinite(value)) {
        merged[key] = value
      }
    }

    return merged
  } catch {
    return DEFAULT_LAYOUT
  }
}

export function LiveAssistPage() {
  const { ref: layoutRef, width: layoutWidth } = useElementSize<HTMLDivElement>()
  const { ref: zoneRef, height: zoneHeight } = useElementSize<HTMLDivElement>()
  const threeColumn = layoutWidth >= THREE_COLUMN_MIN_WIDTH
  const [layout, setLayout] = useState(readStoredLayout)
  const hintsHeightRef = useRef(layout.hintsHeight)

  useEffect(() => {
    try {
      window.localStorage.setItem(LIVE_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
    } catch {
      // Resizing remains available when browser storage is unavailable.
    }
  }, [layout])
  const liveSegments = useAppStore((state) => state.liveSegments)
  const speakerProfiles = useAppStore((state) => state.speakerProfiles)
  const pinnedSegmentIds = useAppStore((state) => state.pinnedSegmentIds)
  const phaseAnalysis = useAppStore((state) => state.phaseAnalysis)
  const consensusAnalysis = useAppStore((state) => state.consensusAnalysis)
  const speakingHints = useAppStore((state) => state.speakingHints)
  const isRefreshingHints = useAppStore((state) => state.isRefreshingHints)
  const speakingHintsStale = useAppStore((state) => state.speakingHintsStale)
  const lastHintsUpdatedAt = useAppStore((state) => state.lastHintsUpdatedAt)
  const mindMap = useAppStore((state) => state.mindMap)
  const mindMapStale = useAppStore((state) => state.mindMapStale)
  const isGeneratingMindMap = useAppStore((state) => state.isGeneratingMindMap)
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
  const statusMessage = useAppStore((state) => state.statusMessage)
  const speakerStability = useAppStore((state) => state.speakerStability)
  const isAnalyzing = useAppStore((state) => state.isAnalyzing)
  const supportsLiveAssist = useAppStore((state) => state.supportsLiveAssist)
  const markSpeakerAsMe = useAppStore((state) => state.markSpeakerAsMe)
  const renameSpeaker = useAppStore((state) => state.renameSpeaker)
  const clearSpeakerBinding = useAppStore((state) => state.clearSpeakerBinding)
  const deleteLiveSegment = useAppStore((state) => state.deleteLiveSegment)
  const refreshSpeakingHints = useAppStore((state) => state.refreshSpeakingHints)
  const generateMindMap = useAppStore((state) => state.generateMindMap)
  const generateMeetingSummary = useAppStore(
    (state) => state.generateMeetingSummary,
  )
  const generateMeetingMinutes = useAppStore(
    (state) => state.generateMeetingMinutes,
  )
  const setAiQuestionDraft = useAppStore((state) => state.setAiQuestionDraft)
  const askAiQuestion = useAppStore((state) => state.askAiQuestion)
  const clearAiQaHistory = useAppStore((state) => state.clearAiQaHistory)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const hasFullConfig = useSettingsStore((state) => state.hasFullConfig)

  const pinnedSegments = liveSegments
    .filter((segment) => pinnedSegmentIds.includes(segment.id))
    .map((segment) => ({
      id: `pin-view-${segment.id}`,
      segmentId: segment.id,
      note: `${getSpeakerDisplayName(segment.speaker, speakerProfiles)} @ ${new Intl.DateTimeFormat(
        'zh-CN',
        {
          hour: '2-digit',
          minute: '2-digit',
        },
      ).format(segment.timestamp)}`,
      pinnedAt: segment.timestamp,
    }))

  const finalSegmentCount = liveSegments.filter((segment) => segment.isFinal).length
  const hasPinnedSegments = pinnedSegmentIds.length > 0
  const disableAiQuestionAsk =
    isAnsweringQuestion ||
    aiQuestionDraft.trim().length === 0 ||
    (finalSegmentCount === 0 && !hasPinnedSegments)

  const needsSetup = !hasFullConfig() || !supportsLiveAssist

  const runtimeMessage = (() => {
    if (errorMessage) {
      return {
        tone: 'error' as const,
        message: errorMessage,
      }
    }

    if (speakerStability === 'unstable') {
      return {
        tone: 'warning' as const,
        message:
          '说话人识别当前不稳定，可使用“改名 / 解绑 / 设为我”来手动修正发言映射。',
      }
    }

    // The setup callout already states what is missing; don't repeat it here.
    if (statusMessage && !needsSetup) {
      return {
        tone: 'info' as const,
        message: statusMessage,
      }
    }

    return null
  })()

  const handleExportAllTranscript = () => {
    exportLiveTranscriptAsTxt(liveSegments, speakerProfiles)
  }

  const resizeColumns = (handle: 'first' | 'second', delta: number) => {
    const availableWidth = Math.max(layoutWidth - (threeColumn ? 20 : 10), 1)
    const ratioDelta = delta / availableWidth

    setLayout((current) => {
      if (!threeColumn) {
        return {
          ...current,
          twoColumnLeft: clamp(current.twoColumnLeft + ratioDelta, 0.48, 0.74),
        }
      }

      if (handle === 'first') {
        return {
          ...current,
          threeColumnLeft: clamp(
            current.threeColumnLeft + ratioDelta,
            0.34,
            0.56,
          ),
        }
      }

      return {
        ...current,
        threeColumnMiddle: clamp(
          current.threeColumnMiddle + ratioDelta,
          0.2,
          Math.min(0.34, 0.76 - current.threeColumnLeft),
        ),
      }
    })
  }

  const maxHintsHeight = Math.max(
    MIN_HINTS_HEIGHT,
    zoneHeight - RAIL_SIZE - MIN_ANALYSIS_HEIGHT,
  )
  const hintsHeight =
    zoneHeight > 0
      ? clamp(layout.hintsHeight, MIN_HINTS_HEIGHT, maxHintsHeight)
      : layout.hintsHeight

  useEffect(() => {
    hintsHeightRef.current = hintsHeight
  }, [hintsHeight])

  const resizeRows = (delta: number) => {
    const next = clamp(
      hintsHeightRef.current + delta,
      MIN_HINTS_HEIGHT,
      maxHintsHeight,
    )
    hintsHeightRef.current = next

    setLayout((current) =>
      current.hintsHeight === next ? current : { ...current, hintsHeight: next },
    )
  }

  const thirdColumnRight = Math.max(
    0.2,
    1 - layout.threeColumnLeft - layout.threeColumnMiddle,
  )
  const gridColumns = threeColumn
    ? `${layout.threeColumnLeft}fr 10px ${layout.threeColumnMiddle}fr 10px ${thirdColumnRight}fr`
    : `${layout.twoColumnLeft}fr 10px ${1 - layout.twoColumnLeft}fr`
  const zoneRows = `${hintsHeight}px ${RAIL_SIZE}px minmax(0, 1fr)`

  const aiQaPanel = (
    <AiQaPanel
      className="h-full"
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

  const consensusPanel = (
    <ConsensusPanel
      analysis={consensusAnalysis}
      className="h-full"
      detailSegments={liveSegments}
      embedded
      isLoading={isAnalyzing}
      speakerProfiles={speakerProfiles}
    />
  )

  const analysisTabs = (
    <Tabs
      className="h-full min-h-[420px] xl:min-h-0"
      defaultTabId="consensus"
      items={[
        {
          id: 'consensus',
          label: '共识分歧',
          content: consensusPanel,
        },
        {
          id: 'qa',
          label: 'AI 问答',
          content: aiQaPanel,
        },
      ]}
    />
  )

  const outputBar = (
    <div className="panel-card flex shrink-0 flex-wrap items-center gap-2 px-4 py-2.5">
      <span className="theme-quiet text-[11px] font-semibold tracking-[0.08em] uppercase">
        产出
      </span>
      <MindMapPanel
        disableGenerate={finalSegmentCount === 0}
        isGenerating={isGeneratingMindMap}
        isStale={mindMapStale}
        onGenerate={async () => {
          await generateMindMap()
          return Boolean(useAppStore.getState().mindMap)
        }}
        presentation="launcher"
        snapshot={mindMap}
      />
      <SummaryPreviewPanel
        disableGenerate={finalSegmentCount === 0}
        isGenerating={isGeneratingSummary}
        isGeneratingMinutes={isGeneratingMinutes}
        isStale={summaryStale}
        minutes={meetingMinutes}
        minutesStale={minutesStale}
        onGenerate={async () => {
          await generateMeetingSummary()
          return Boolean(useAppStore.getState().meetingSummary)
        }}
        onGenerateMinutes={async () => {
          await generateMeetingMinutes()
          return Boolean(useAppStore.getState().meetingMinutes)
        }}
        presentation="launcher"
        summary={meetingSummary}
      />
      <button
        className="btn-ghost ml-auto px-2.5 py-1.5 text-xs"
        onClick={() => setLayout(DEFAULT_LAYOUT)}
        title="恢复默认列宽和面板高度"
        type="button"
      >
        重置布局
      </button>
    </div>
  )

  return (
    <div
      className="live-assist-grid grid h-full min-h-0 xl:overflow-hidden"
      ref={layoutRef}
      style={{ '--live-grid-columns': gridColumns } as CSSProperties}
    >
      <div className="flex max-h-[70vh] min-h-0 min-w-0 flex-col gap-3 overflow-hidden xl:h-full xl:max-h-none">
        {needsSetup ? (
          <div className="panel-card flex shrink-0 flex-wrap items-center justify-between gap-3 border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-4 py-3">
            <p className="theme-body min-w-0 text-sm leading-6">
              {!hasFullConfig()
                ? '开始前请先填写语音转写与文本分析模型配置。'
                : '实时转写服务地址尚未配置，当前仅可使用回放与设置。'}
            </p>
            <button
              className="btn-primary shrink-0"
              onClick={() => setActiveView('settings')}
              type="button"
            >
              前往模型设置
            </button>
          </div>
        ) : null}

        {runtimeMessage ? (
          <RuntimeMessageStrip
            className="shrink-0"
            message={runtimeMessage.message}
            tone={runtimeMessage.tone}
          />
        ) : null}

        <TranscriptPanel
          className="min-h-0 xl:flex-1"
          density="compact"
          followLatest
          onClearSpeakerBinding={(speakerId) => clearSpeakerBinding(speakerId)}
          onDeleteSegment={deleteLiveSegment}
          onExportAll={handleExportAllTranscript}
          onMarkAsMe={(speakerId) => markSpeakerAsMe(speakerId)}
          onRenameSpeaker={(speakerId, name) => renameSpeaker(speakerId, name)}
          pinnedSegments={pinnedSegments}
          segments={liveSegments}
          speakerProfiles={speakerProfiles}
          title="实时转写"
        />
      </div>

      <ResizeHandle
        ariaLabel="调整实时转写与辅助面板宽度"
        onDelta={(delta) => resizeColumns('first', delta)}
        onReset={() =>
          setLayout((current) => ({
            ...current,
            twoColumnLeft: DEFAULT_LAYOUT.twoColumnLeft,
            threeColumnLeft: DEFAULT_LAYOUT.threeColumnLeft,
          }))
        }
        orientation="vertical"
      />

      {threeColumn ? (
        <>
          <div className="flex min-h-0 min-w-0 flex-col gap-3 xl:h-full xl:overflow-hidden">
            <PhasePanel
              className="shrink-0"
              isLoading={isAnalyzing}
              phaseAnalysis={phaseAnalysis}
              variant="compact"
            />
            <HintsPanel
              className="min-h-[340px] flex-1 xl:min-h-0"
              density="compact"
              hints={speakingHints}
              isRefreshing={isRefreshingHints}
              isStale={speakingHintsStale}
              lastUpdatedAt={lastHintsUpdatedAt}
              onRefresh={() => {
                void refreshSpeakingHints()
              }}
              showRefreshControl
            />
          </div>

          <ResizeHandle
            ariaLabel="调整辅助面板与共识分歧宽度"
            onDelta={(delta) => resizeColumns('second', delta)}
            onReset={() =>
              setLayout((current) => ({
                ...current,
                threeColumnMiddle: DEFAULT_LAYOUT.threeColumnMiddle,
              }))
            }
            orientation="vertical"
          />

          <div className="flex min-h-0 min-w-0 flex-col gap-3 xl:h-full xl:overflow-hidden">
            <div className="min-h-0 flex-1">{analysisTabs}</div>
            {outputBar}
          </div>
        </>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-col gap-3 xl:h-full xl:overflow-hidden">
          <PhasePanel
            className="shrink-0"
            isLoading={isAnalyzing}
            phaseAnalysis={phaseAnalysis}
            variant="compact"
          />
          <div
            className="live-resizable-zone min-h-0 xl:flex-1"
            ref={zoneRef}
            style={{ '--live-zone-rows': zoneRows } as CSSProperties}
          >
            <HintsPanel
              className="h-full min-h-[340px] xl:min-h-0"
              density="compact"
              hints={speakingHints}
              isRefreshing={isRefreshingHints}
              isStale={speakingHintsStale}
              lastUpdatedAt={lastHintsUpdatedAt}
              onRefresh={() => {
                void refreshSpeakingHints()
              }}
              showRefreshControl
            />
            <ResizeHandle
              ariaLabel="调整发言建议与分析面板高度"
              onDelta={resizeRows}
              onReset={() =>
                setLayout((current) => ({
                  ...current,
                  hintsHeight: DEFAULT_LAYOUT.hintsHeight,
                }))
              }
              orientation="horizontal"
            />
            {analysisTabs}
          </div>
          {outputBar}
        </div>
      )}
    </div>
  )
}
