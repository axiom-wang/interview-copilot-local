import { AiQaPanel } from '../components/AiQaPanel'
import { ConsensusPanel } from '../components/ConsensusPanel'
import { HintsPanel } from '../components/HintsPanel'
import { MindMapPanel } from '../components/MindMapPanel'
import { PhasePanel } from '../components/PhasePanel'
import { RuntimeMessageStrip } from '../components/RuntimeMessageStrip'
import { SummaryPreviewPanel } from '../components/SummaryPreviewPanel'
import { TranscriptPanel } from '../components/TranscriptPanel'
import { Tabs } from '../components/ui/Tabs'
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

export function LiveAssistPage() {
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

    if (statusMessage) {
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

  const needsSetup = !hasFullConfig() || !supportsLiveAssist

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,420px)]">
      <div className="flex min-h-[520px] min-w-0 flex-col gap-4 xl:min-h-[640px]">
        {needsSetup ? (
          <div className="panel-card border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] p-4">
            <h3 className="theme-title text-sm font-semibold">开始前请完成配置</h3>
            <p className="theme-body mt-2 text-sm leading-6">
              {!hasFullConfig()
                ? '请先填写语音转写与文本分析模型配置，才能开始实时辅助。'
                : '实时转写服务地址尚未配置，当前仅可使用回放与设置。'}
            </p>
            <button
              className="btn-primary mt-3"
              onClick={() => setActiveView('settings')}
              type="button"
            >
              前往模型设置
            </button>
          </div>
        ) : null}

        {runtimeMessage ? (
          <RuntimeMessageStrip
            message={runtimeMessage.message}
            tone={runtimeMessage.tone}
          />
        ) : null}

        <TranscriptPanel
          description="实时转写始终放在左侧，方便边听边跟进。可标记关键片段并修正说话人。"
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

      <div className="flex min-h-[520px] min-w-0 flex-col gap-4 xl:min-h-[640px]">
        <PhasePanel
          className="shrink-0"
          isLoading={isAnalyzing}
          phaseAnalysis={phaseAnalysis}
        />
        <HintsPanel
          className="shrink-0"
          hints={speakingHints}
          isRefreshing={isRefreshingHints}
          isStale={speakingHintsStale}
          lastUpdatedAt={lastHintsUpdatedAt}
          onRefresh={() => {
            void refreshSpeakingHints()
          }}
          showRefreshControl
        />

        <Tabs
          className="min-h-0 flex-1"
          defaultTabId="consensus"
          items={[
            {
              id: 'consensus',
              label: '共识分歧',
              content: (
                <ConsensusPanel
                  analysis={consensusAnalysis}
                  detailSegments={liveSegments}
                  isLoading={isAnalyzing}
                  speakerProfiles={speakerProfiles}
                />
              ),
            },
            {
              id: 'qa',
              label: 'AI 问答',
              content: (
                <AiQaPanel
                  disableAsk={disableAiQuestionAsk}
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
              ),
            },
            {
              id: 'mindmap',
              label: '思维导图',
              content: (
                <MindMapPanel
                  disableGenerate={finalSegmentCount === 0}
                  isGenerating={isGeneratingMindMap}
                  isStale={mindMapStale}
                  onGenerate={async () => {
                    await generateMindMap()
                    return Boolean(useAppStore.getState().mindMap)
                  }}
                  snapshot={mindMap}
                />
              ),
            },
            {
              id: 'summary',
              label: '会议总结',
              content: (
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
                  summary={meetingSummary}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}
