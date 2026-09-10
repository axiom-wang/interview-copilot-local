import type {
  ConsensusAnalysis,
  InterviewQaAnswer,
  MeetingMinutes,
  MeetingSummary,
  PhaseAnalysis,
  PhaseConsensusAnalysisBundle,
  SpeakingHints,
} from '../../types/analysis'
import type { MindMapSnapshot } from '../../types/mindmap'
import type { AnalysisPromptContext, SummaryAssemblyContext } from '../../types/promptContext'
import type { TranscriptSegment } from '../../types/transcript'
import type { LlmProvider } from './LlmProvider'

interface TranscriptRequest extends AnalysisPromptContext {
  segments: TranscriptSegment[]
}

interface InterviewQuestionRequest extends TranscriptRequest {
  question: string
}

type ApiResult<T extends Record<string, unknown>> =
  | ({ ok: true } & T)
  | {
      ok: false
      error: string
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
    ...segments.map((segment) => `${segment.id}:${segment.timestamp}`),
    `scenario:${normalizedContext.scenarioId ?? ''}`,
    `q:${normalizedContext.questionContext ?? ''}`,
    `r:${normalizedContext.roleContext ?? ''}`,
    `p:${normalizedContext.phaseContext ?? ''}`,
    `s:${summaryContextKey}`,
  ].join('|')
}

const postJson = async <T extends Record<string, unknown>>(
  endpoint: string,
  body: TranscriptRequest | InterviewQuestionRequest | Record<string, never>,
  headers?: Record<string, string>,
) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as ApiResult<T> | null

  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload && !payload.ok
        ? payload.error
        : `Analysis API request failed (${response.status}).`,
    )
  }

  return payload
}

export class HttpOpenAiLlmProvider implements LlmProvider {
  readonly id = 'openai-responses-http'
  readonly label = 'OpenAI Responses API'

  private modelHeaders: Record<string, string> = {}

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

  setModelConfig(config: {
    apiKey?: string
    model?: string
    baseURL?: string
  }) {
    const headers: Record<string, string> = {}

    if (config.apiKey?.trim()) {
      headers['x-model-api-key'] = config.apiKey.trim()
    }

    if (config.model?.trim()) {
      headers['x-model-name'] = config.model.trim()
    }

    if (config.baseURL?.trim()) {
      headers['x-model-base-url'] = config.baseURL.trim().replace(/\/$/, '')
    }

    this.modelHeaders = headers
    this.lastRealtimeRequestKey = null
    this.lastRealtimePromise = null
    this.lastHintsRequestKey = null
    this.lastHintsPromise = null
    this.lastMindMapRequestKey = null
    this.lastMindMapPromise = null
    this.lastSummaryRequestKey = null
    this.lastSummaryPromise = null
    this.lastMinutesRequestKey = null
    this.lastMinutesPromise = null
    this.lastQaRequestKey = null
    this.lastQaPromise = null
  }

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

    this.lastRealtimeRequestKey = requestKey
    this.lastRealtimePromise = postJson<{ bundle: PhaseConsensusAnalysisBundle }>(
      '/api/analysis/realtime',
      {
        segments,
        ...normalizedContext,
      },
      this.modelHeaders,
    )
      .then((result) => result.bundle)
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

    this.lastHintsRequestKey = requestKey
    this.lastHintsPromise = postJson<{ hints: SpeakingHints }>(
      '/api/analysis/speaking-hints',
      {
        segments,
        ...normalizedContext,
      },
      this.modelHeaders,
    )
      .then((result) => result.hints)
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

    this.lastMindMapRequestKey = requestKey
    this.lastMindMapPromise = postJson<{ snapshot: MindMapSnapshot }>(
      '/api/analysis/mind-map',
      {
        segments,
        ...normalizedContext,
      },
      this.modelHeaders,
    )
      .then((result) => result.snapshot)
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

    this.lastSummaryRequestKey = requestKey
    this.lastSummaryPromise = postJson<{ summary: MeetingSummary }>(
      '/api/analysis/meeting-summary',
      {
        segments,
        ...normalizedContext,
      },
      this.modelHeaders,
    )
      .then((result) => result.summary)
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

    this.lastQaRequestKey = requestKey
    this.lastQaPromise = postJson<{ answer: InterviewQaAnswer }>(
      '/api/analysis/interview-question',
      {
        question,
        segments,
        ...normalizedContext,
      },
      this.modelHeaders,
    )
      .then((result) => result.answer)
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
    const requestKey = buildRequestKey(segments, normalizedContext)
    const cachedMinutesPromise = this.lastMinutesPromise

    if (this.lastMinutesRequestKey === requestKey && cachedMinutesPromise) {
      return cachedMinutesPromise
    }

    this.lastMinutesRequestKey = requestKey
    this.lastMinutesPromise = postJson<{ minutes: MeetingMinutes }>(
      '/api/analysis/meeting-minutes',
      {
        segments,
        ...normalizedContext,
      },
      this.modelHeaders,
    )
      .then((result) => result.minutes)
      .catch((error) => {
        if (this.lastMinutesRequestKey === requestKey) {
          this.lastMinutesRequestKey = null
          this.lastMinutesPromise = null
        }

        throw error
      })

    return this.lastMinutesPromise
  }

  async probeConnection() {
    return postJson<{ model: string; baseURL: string }>(
      '/api/analysis/probe',
      {},
      this.modelHeaders,
    )
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
