import { AiQaPanel } from '../components/AiQaPanel'
import { ConsensusPanel } from '../components/ConsensusPanel'
import { HintsPanel } from '../components/HintsPanel'
import { MindMapPanel } from '../components/MindMapPanel'
import { PhasePanel } from '../components/PhasePanel'
import { RuntimeMessageStrip } from '../components/RuntimeMessageStrip'
import { SummaryPreviewPanel } from '../components/SummaryPreviewPanel'
import { TranscriptPanel } from '../components/TranscriptPanel'
import { exportLiveTranscriptAsTxt } from '../services/transcriptExport'
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
  const aiQuestionDraft = useAppStore((state) => state.aiQuestionDraft)
  const aiQaHistory = useAppStore((state) => state.aiQaHistory)
  const aiQaError = useAppStore((state) => state.aiQaError)
  const isAnsweringQuestion = useAppStore((state) => state.isAnsweringQuestion)
  const errorMessage = useAppStore((state) => state.errorMessage)
  const statusMessage = useAppStore((state) => state.statusMessage)
  const speakerStability = useAppStore((state) => state.speakerStability)
  const isAnalyzing = useAppStore((state) => state.isAnalyzing)
  const markSpeakerAsMe = useAppStore((state) => state.markSpeakerAsMe)
  const renameSpeaker = useAppStore((state) => state.renameSpeaker)
  const clearSpeakerBinding = useAppStore((state) => state.clearSpeakerBinding)
  const deleteLiveSegment = useAppStore((state) => state.deleteLiveSegment)
  const refreshSpeakingHints = useAppStore((state) => state.refreshSpeakingHints)
  const generateMindMap = useAppStore((state) => state.generateMindMap)
  const generateMeetingSummary = useAppStore(
    (state) => state.generateMeetingSummary,
  )
  const setAiQuestionDraft = useAppStore((state) => state.setAiQuestionDraft)
  const askAiQuestion = useAppStore((state) => state.askAiQuestion)
  const clearAiQaHistory = useAppStore((state) => state.clearAiQaHistory)

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

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex min-h-[720px] min-w-0 flex-col gap-4">
        {runtimeMessage ? (
          <RuntimeMessageStrip
            message={runtimeMessage.message}
            tone={runtimeMessage.tone}
          />
        ) : null}

        <TranscriptPanel
          description="转写区保持第一优先级。你可以在这里查看实时滚动内容、标记关键片段，并在需要时快速修正说话人映射。"
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

      <div className="grid min-h-[720px] min-w-0 content-start gap-4 xl:grid-cols-2">
        <div className="min-w-0">
          <PhasePanel
            className="h-full"
            isLoading={isAnalyzing}
            phaseAnalysis={phaseAnalysis}
          />
        </div>
        <div className="min-w-0">
          <HintsPanel
            className="h-full"
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
        <div className="min-w-0 xl:col-span-2">
          <ConsensusPanel
            analysis={consensusAnalysis}
            detailSegments={liveSegments}
            isLoading={isAnalyzing}
            speakerProfiles={speakerProfiles}
          />
        </div>
        <div className="min-w-0 xl:col-span-2">
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
        </div>
        <div className="grid min-w-0 gap-4 xl:col-span-2 2xl:grid-cols-2">
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
          <SummaryPreviewPanel
            disableGenerate={finalSegmentCount === 0}
            isGenerating={isGeneratingSummary}
            isStale={summaryStale}
            onGenerate={async () => {
              await generateMeetingSummary()
              return Boolean(useAppStore.getState().meetingSummary)
            }}
            summary={meetingSummary}
          />
        </div>
      </div>
    </div>
  )
}
