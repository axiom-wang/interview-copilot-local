import { MeetingContextCapacityError, normalizeMeetingMemory } from '../../../../../shared/meeting/context/meetingMemory'
import type { MeetingMemory } from '../../../../../shared/meeting/types/meetingMemory'
import type { AnalysisRoutingMetadata, DesktopAnalysisConfig } from '../../../../../shared/meeting/types/desktopAnalysis'
import type {
  ConsensusAnalysis,
  InterviewQaAnswer,
  MeetingMinutes,
  MeetingSummary,
  PhaseAnalysis,
  PhaseConsensusAnalysisBundle,
  SpeakingHints,
} from '../../../../../shared/meeting/types/analysis'
import type { MindMapSnapshot } from '../../../../../shared/meeting/types/mindmap'
import type { AnalysisPromptContext, SummaryAssemblyContext } from '../../../../../shared/meeting/types/promptContext'
import type { TranscriptSegment } from '../../../../../shared/meeting/types/transcript'
import type { LlmProvider } from '../../../../../shared/meeting/providers/llm/LlmProvider'

const raiseAnalysisError = (result: { error: string; code?: string; meetingMemory?: MeetingMemory }): never => {
  if (result.code === 'meeting-context-capacity') {
    throw new MeetingContextCapacityError(normalizeMeetingMemory(result.meetingMemory) ?? { version: 1, chunks: [] })
  }
  throw new Error(result.error)
}

const normalizeSummaryAssemblyContext = (
  value: SummaryAssemblyContext | undefined,
): SummaryAssemblyContext | undefined => {
  if (!value) {
    return undefined
  }

  return {
    phase: value.phase?.trim() || undefined,
    consensus: value.consensus?.map((item) => item.trim()).filter(Boolean) || undefined,
    tensions: value.tensions?.map((item) => item.trim()).filter(Boolean) || undefined,
    missing: value.missing?.map((item) => item.trim()).filter(Boolean) || undefined,
    mindMap: value.mindMap ?? undefined,
    transcript: value.transcript ?? undefined,
  }
}

const normalizePromptContext = (context: AnalysisPromptContext | undefined) => ({
  previousParticipantView: context?.previousParticipantView,
  meetingMemory: context?.meetingMemory,
  pinnedSegmentIds: context?.pinnedSegmentIds,
  scenarioId: context?.scenarioId,
  questionContext: context?.questionContext?.trim() || undefined,
  roleContext: context?.roleContext?.trim() || undefined,
  phaseContext: context?.phaseContext?.trim() || undefined,
  summaryAssemblyContext: normalizeSummaryAssemblyContext(
    context?.summaryAssemblyContext,
  ),
})

const buildRequestKey = (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) => {
  const normalizedContext = normalizePromptContext(context)
  const summaryContextKey = normalizedContext.summaryAssemblyContext
    ? JSON.stringify(normalizedContext.summaryAssemblyContext)
    : ''

  return [
    ...segments.map((segment) => `${segment.id}:${segment.timestamp}:${segment.isFinal}:${segment.speaker}:${segment.text}`),
    `view:${JSON.stringify(normalizedContext.previousParticipantView)}`,
    `memory:${JSON.stringify(normalizedContext.meetingMemory)}`,
    `pinned:${JSON.stringify(normalizedContext.pinnedSegmentIds)}`,
    `scenario:${normalizedContext.scenarioId ?? ''}`,
    `q:${normalizedContext.questionContext ?? ''}`,
    `r:${normalizedContext.roleContext ?? ''}`,
    `p:${normalizedContext.phaseContext ?? ''}`,
    `s:${summaryContextKey}`,
  ].join('|')
}

const PROVIDER_LABELS: Record<DesktopAnalysisConfig['provider'], string> = {
  api: 'OpenAI Responses', codex: '本地 Codex', claude: '本地 Claude',
}

export class RendererOpenAiLlmProvider implements LlmProvider {
  readonly id: string = 'openai-responses'
  get label(): string {
    const provider = this.routing?.actualProvider ?? this.analysisConfig?.provider
    return provider ? PROVIDER_LABELS[provider] : PROVIDER_LABELS.api
  }

  get warning(): string | undefined { return this.routing?.fallbackReason }
  readonly automaticAnalysis = { intervalMs: 8000, finalOnly: true, singleFlight: true }

  private routing?: AnalysisRoutingMetadata
  private generation = 0

  private readonly analysisConfig?: DesktopAnalysisConfig
  private readonly fallbackAnalysisConfig?: DesktopAnalysisConfig
  private readonly getSessionId?: () => string

  constructor(
    analysisConfig?: DesktopAnalysisConfig,
    fallbackAnalysisConfig?: DesktopAnalysisConfig,
    getSessionId?: () => string,
  ) {
    this.analysisConfig = analysisConfig
    this.fallbackAnalysisConfig = fallbackAnalysisConfig
    this.getSessionId = getSessionId
  }

  async prewarm(context?: AnalysisPromptContext) {
    if (!this.analysisConfig) return
    await window.interviewCopilot?.prewarmAnalysis?.({
      analysisConfig: this.analysisConfig,
      scenarioId: context?.scenarioId,
    })
  }

  resetSession(preserveRouting = false) {
    this.generation += 1
    if (!preserveRouting) this.routing = undefined
    this.lastRealtimeRequestKey = this.lastHintsRequestKey = this.lastMindMapRequestKey = null
    this.lastSummaryRequestKey = this.lastMinutesRequestKey = this.lastQaRequestKey = null
    this.lastRealtimePromise = this.lastHintsPromise = this.lastMindMapPromise = null
    this.lastSummaryPromise = this.lastMinutesPromise = this.lastQaPromise = null
  }

  private acceptRouting(result: { routing?: AnalysisRoutingMetadata } & Partial<AnalysisRoutingMetadata>, generation: number) {
    if (generation !== this.generation) throw new Error('分析会话已重置，已忽略旧结果。')
    const routing = result.routing ?? (result.actualProvider ? result : undefined)
    if (routing) this.routing = routing
  }

  private lastRealtimeRequestKey: string | null = null
  private lastRealtimePromise: Promise<PhaseConsensusAnalysisBundle> | null = null

  private lastHintsRequestKey: string | null = null
  private lastHintsPromise: Promise<SpeakingHints> | null = null

  private lastMindMapRequestKey: string | null = null
  private lastMindMapPromise: Promise<MindMapSnapshot> | null = null

  private lastSummaryRequestKey: string | null = null
  private lastSummaryPromise: Promise<MeetingSummary> | null = null

  private lastMinutesRequestKey: string | null = null
  private lastMinutesPromise: Promise<MeetingMinutes> | null = null

  private lastQaRequestKey: string | null = null
  private lastQaPromise: Promise<InterviewQaAnswer> | null = null

  private async ensureRealtimeBundle(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ) {
    const normalizedContext = normalizePromptContext(context)
    const generation = this.generation
    const requestKey = `${generation}|${buildRequestKey(segments, normalizedContext)}`
    const cachedBundlePromise = this.lastRealtimePromise

    if (this.lastRealtimeRequestKey === requestKey && cachedBundlePromise) {
      return cachedBundlePromise
    }

    const bridge = window.interviewCopilot
    if (!bridge?.analyzeTranscriptRealtime) {
      throw new Error('Electron 分析桥接不可用')
    }

    this.lastRealtimeRequestKey = requestKey
    this.lastRealtimePromise = bridge
      .analyzeTranscriptRealtime({
        segments,
        ...normalizedContext,
        analysisConfig: this.analysisConfig,
        fallbackAnalysisConfig: this.fallbackAnalysisConfig,
        analysisSessionId: this.getSessionId?.(),
      })
      .then((result): PhaseConsensusAnalysisBundle => {
        this.acceptRouting(result, generation)
        if (!result.ok) return raiseAnalysisError(result)

        return result.bundle
      })
      .catch((error) => {
        if (this.lastRealtimeRequestKey === requestKey) {
          this.lastRealtimeRequestKey = null
          this.lastRealtimePromise = null
        }

        throw error
      })

    return this.lastRealtimePromise
  }

  private async ensureSpeakingHints(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ) {
    const normalizedContext = normalizePromptContext(context)
    const generation = this.generation
    const requestKey = `${generation}|${buildRequestKey(segments, normalizedContext)}`
    const cachedHintsPromise = this.lastHintsPromise

    if (this.lastHintsRequestKey === requestKey && cachedHintsPromise) {
      return cachedHintsPromise
    }

    const bridge = window.interviewCopilot
    if (!bridge?.generateSpeakingHints) {
      throw new Error('Electron 发言建议桥接不可用')
    }

    this.lastHintsRequestKey = requestKey
    this.lastHintsPromise = bridge
      .generateSpeakingHints({
        segments,
        ...normalizedContext,
        analysisConfig: this.analysisConfig,
        fallbackAnalysisConfig: this.fallbackAnalysisConfig,
        analysisSessionId: this.getSessionId?.(),
      })
      .then((result): SpeakingHints => {
        this.acceptRouting(result, generation)
        if (!result.ok) return raiseAnalysisError(result)

        return result.hints
      })
      .catch((error) => {
        if (this.lastHintsRequestKey === requestKey) {
          this.lastHintsRequestKey = null
          this.lastHintsPromise = null
        }

        throw error
      })

    return this.lastHintsPromise
  }

  private async ensureMindMap(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ) {
    const normalizedContext = normalizePromptContext(context)
    const generation = this.generation
    const requestKey = `${generation}|${buildRequestKey(segments, normalizedContext)}`
    const cachedMindMapPromise = this.lastMindMapPromise

    if (this.lastMindMapRequestKey === requestKey && cachedMindMapPromise) {
      return cachedMindMapPromise
    }

    const bridge = window.interviewCopilot
    if (!bridge?.generateMindMap) {
      throw new Error('Electron 导图桥接不可用')
    }

    this.lastMindMapRequestKey = requestKey
    this.lastMindMapPromise = bridge
      .generateMindMap({
        segments,
        ...normalizedContext,
        analysisConfig: this.analysisConfig,
        fallbackAnalysisConfig: this.fallbackAnalysisConfig,
        analysisSessionId: this.getSessionId?.(),
      })
      .then((result): MindMapSnapshot => {
        this.acceptRouting(result, generation)
        if (!result.ok) return raiseAnalysisError(result)

        return result.snapshot
      })
      .catch((error) => {
        if (this.lastMindMapRequestKey === requestKey) {
          this.lastMindMapRequestKey = null
          this.lastMindMapPromise = null
        }

        throw error
      })

    return this.lastMindMapPromise
  }

  private async ensureMeetingSummary(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ) {
    const normalizedContext = normalizePromptContext(context)
    const generation = this.generation
    const requestKey = `${generation}|${buildRequestKey(segments, normalizedContext)}`
    const cachedSummaryPromise = this.lastSummaryPromise

    if (this.lastSummaryRequestKey === requestKey && cachedSummaryPromise) {
      return cachedSummaryPromise
    }

    const bridge = window.interviewCopilot
    if (!bridge?.generateMeetingSummary) {
      throw new Error('Electron 总结桥接不可用')
    }

    this.lastSummaryRequestKey = requestKey
    this.lastSummaryPromise = bridge
      .generateMeetingSummary({
        segments,
        ...normalizedContext,
        analysisConfig: this.analysisConfig,
        fallbackAnalysisConfig: this.fallbackAnalysisConfig,
        analysisSessionId: this.getSessionId?.(),
      })
      .then((result): MeetingSummary => {
        this.acceptRouting(result, generation)
        if (!result.ok) return raiseAnalysisError(result)

        return result.summary
      })
      .catch((error) => {
        if (this.lastSummaryRequestKey === requestKey) {
          this.lastSummaryRequestKey = null
          this.lastSummaryPromise = null
        }

        throw error
      })

    return this.lastSummaryPromise
  }

  private async ensureInterviewQuestionAnswer(
    question: string,
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ) {
    const normalizedContext = normalizePromptContext(context)
    const generation = this.generation
    const requestKey = `${generation}|${question.trim()}|${buildRequestKey(segments, normalizedContext)}`
    const cachedQaPromise = this.lastQaPromise

    if (this.lastQaRequestKey === requestKey && cachedQaPromise) {
      return cachedQaPromise
    }

    const bridge = window.interviewCopilot
    if (!bridge?.answerInterviewQuestion) {
      throw new Error('Electron interview QA bridge is unavailable.')
    }

    this.lastQaRequestKey = requestKey
    this.lastQaPromise = bridge
      .answerInterviewQuestion({
        question,
        segments,
        ...normalizedContext,
        analysisConfig: this.analysisConfig,
        fallbackAnalysisConfig: this.fallbackAnalysisConfig,
        analysisSessionId: this.getSessionId?.(),
      })
      .then((result): InterviewQaAnswer => {
        this.acceptRouting(result, generation)
        if (!result.ok) return raiseAnalysisError(result)

        return result.answer
      })
      .catch((error) => {
        if (this.lastQaRequestKey === requestKey) {
          this.lastQaRequestKey = null
          this.lastQaPromise = null
        }

        throw error
      })

    return this.lastQaPromise
  }

  private async ensureMeetingMinutes(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ) {
    const normalizedContext = normalizePromptContext(context)
    const generation = this.generation
    const requestKey = `${generation}|${buildRequestKey(segments, normalizedContext)}`
    const cachedMinutesPromise = this.lastMinutesPromise

    if (this.lastMinutesRequestKey === requestKey && cachedMinutesPromise) {
      return cachedMinutesPromise
    }

    const bridge = window.interviewCopilot
    if (!bridge?.generateMeetingMinutes) {
      throw new Error('Electron 会议纪要桥接不可用')
    }

    this.lastMinutesRequestKey = requestKey
    this.lastMinutesPromise = bridge
      .generateMeetingMinutes({
        segments,
        ...normalizedContext,
        analysisConfig: this.analysisConfig,
        fallbackAnalysisConfig: this.fallbackAnalysisConfig,
        analysisSessionId: this.getSessionId?.(),
      })
      .then((result): MeetingMinutes => {
        this.acceptRouting(result, generation)
        if (!result.ok) return raiseAnalysisError(result)

        return result.minutes
      })
      .catch((error) => {
        if (this.lastMinutesRequestKey === requestKey) {
          this.lastMinutesRequestKey = null
          this.lastMinutesPromise = null
        }

        throw error
      })

    return this.lastMinutesPromise
  }

  async detectPhase(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<PhaseAnalysis> {
    const bundle = await this.ensureRealtimeBundle(segments, context)
    return bundle.phaseAnalysis
  }

  async extractConsensusAndTensions(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<ConsensusAnalysis> {
    const bundle = await this.ensureRealtimeBundle(segments, context)
    return bundle.consensusAnalysis
  }

  async generateSpeakingHints(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<SpeakingHints> {
    return this.ensureSpeakingHints(segments, context)
  }

  async generateMindMap(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<MindMapSnapshot> {
    return this.ensureMindMap(segments, context)
  }

  async generateMeetingSummary(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<MeetingSummary> {
    return this.ensureMeetingSummary(segments, context)
  }

  async generateMeetingMinutes(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<MeetingMinutes> {
    return this.ensureMeetingMinutes(segments, context)
  }

  async answerInterviewQuestion(
    question: string,
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<InterviewQaAnswer> {
    return this.ensureInterviewQuestionAnswer(question, segments, context)
  }
}
