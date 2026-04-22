import type {
  ConsensusAnalysis,
  InterviewQaAnswer,
  MeetingSummary,
  PhaseAnalysis,
  PhaseConsensusAnalysisBundle,
  SpeakingHints,
} from '../../types/analysis'
import type { MindMapSnapshot } from '../../types/mindmap'
import type { AnalysisPromptContext, SummaryAssemblyContext } from '../../types/promptContext'
import type { TranscriptSegment } from '../../types/transcript'
import type { LlmProvider } from './LlmProvider'

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
    ...segments.map((segment) => `${segment.id}:${segment.timestamp}`),
    `q:${normalizedContext.questionContext ?? ''}`,
    `r:${normalizedContext.roleContext ?? ''}`,
    `p:${normalizedContext.phaseContext ?? ''}`,
    `s:${summaryContextKey}`,
  ].join('|')
}

export class RendererOpenAiLlmProvider implements LlmProvider {
  readonly id = 'openai-responses'
  readonly label = 'OpenAI Responses'

  private lastRealtimeRequestKey: string | null = null
  private lastRealtimePromise: Promise<PhaseConsensusAnalysisBundle> | null = null

  private lastHintsRequestKey: string | null = null
  private lastHintsPromise: Promise<SpeakingHints> | null = null

  private lastMindMapRequestKey: string | null = null
  private lastMindMapPromise: Promise<MindMapSnapshot> | null = null

  private lastSummaryRequestKey: string | null = null
  private lastSummaryPromise: Promise<MeetingSummary> | null = null

  private lastQaRequestKey: string | null = null
  private lastQaPromise: Promise<InterviewQaAnswer> | null = null

  private async ensureRealtimeBundle(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ) {
    const normalizedContext = normalizePromptContext(context)
    const requestKey = buildRequestKey(segments, normalizedContext)
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
      })
      .then((result): PhaseConsensusAnalysisBundle => {
        if (!result.ok) {
          throw new Error(result.error)
        }

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
    const requestKey = buildRequestKey(segments, normalizedContext)
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
      })
      .then((result): SpeakingHints => {
        if (!result.ok) {
          throw new Error(result.error)
        }

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
    const requestKey = buildRequestKey(segments, normalizedContext)
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
      })
      .then((result): MindMapSnapshot => {
        if (!result.ok) {
          throw new Error(result.error)
        }

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
    const requestKey = buildRequestKey(segments, normalizedContext)
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
      })
      .then((result): MeetingSummary => {
        if (!result.ok) {
          throw new Error(result.error)
        }

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
    const requestKey = `${question.trim()}|${buildRequestKey(segments, normalizedContext)}`
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
      })
      .then((result): InterviewQaAnswer => {
        if (!result.ok) {
          throw new Error(result.error)
        }

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

  async answerInterviewQuestion(
    question: string,
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<InterviewQaAnswer> {
    return this.ensureInterviewQuestionAnswer(question, segments, context)
  }
}
