import { toAnalysisFailure } from './analysisFailure'
import { normalizeParticipantView } from '../../meeting/context/participantView'
import { normalizeMeetingMemory } from '../../meeting/context/meetingMemory'
import { isTimingContext } from '../../meeting/context/timeBudget'
import type { AnalysisPromptContext } from '../../meeting/types/promptContext'
import type { TranscriptSegment } from '../../meeting/types/transcript'
import {
  analyzeTranscriptRealtimeBundle,
  answerInterviewQuestionOnly,
  generateMeetingMinutesOnly,
  generateMeetingSummaryOnly,
  generateSpeakingHintsOnly,
  generateTranscriptMindMap,
  probeOpenAiConnection,
} from './openaiAnalysisService'
import { sealCallerModelConfig, type OpenAiRuntimeConfigOverride } from './openaiConfig'

interface TranscriptRequest extends AnalysisPromptContext {
  segments: TranscriptSegment[]
}

interface InterviewQuestionRequest extends TranscriptRequest {
  question: string
}

type AnalysisAction =
  | 'realtime'
  | 'speaking-hints'
  | 'mind-map'
  | 'meeting-minutes'
  | 'meeting-summary'
  | 'interview-question'
  | 'probe'

export interface AnalysisHttpResult {
  status: number
  body: unknown
}

const isTranscriptSegment = (value: unknown): value is TranscriptSegment =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as TranscriptSegment).id === 'string' &&
  typeof (value as TranscriptSegment).speaker === 'string' &&
  typeof (value as TranscriptSegment).text === 'string' &&
  typeof (value as TranscriptSegment).timestamp === 'number' &&
  typeof (value as TranscriptSegment).isFinal === 'boolean'

const isStringOrUndefined = (value: unknown) =>
  value === undefined || typeof value === 'string'

const isSummaryAssemblyContext = (value: unknown) =>
  value === undefined || (typeof value === 'object' && value !== null)

const isTranscriptRequest = (value: unknown): value is TranscriptRequest =>
  typeof value === 'object' && value !== null

const validateTranscriptRequest = (request: TranscriptRequest) => {
  if (!Array.isArray(request.segments) || !request.segments.every(isTranscriptSegment)) {
    throw new Error('Invalid transcript request.')
  }

  if (
    (request.previousParticipantView !== undefined && !normalizeParticipantView(request.previousParticipantView)) ||
    (request.meetingMemory !== undefined && !normalizeMeetingMemory(request.meetingMemory)) ||
    (request.pinnedSegmentIds !== undefined && (!Array.isArray(request.pinnedSegmentIds) || !request.pinnedSegmentIds.every((id) => typeof id === 'string'))) ||
    !isStringOrUndefined(request.questionContext) ||
    !isStringOrUndefined(request.roleContext) ||
    !isStringOrUndefined(request.referenceContext) ||
    (request.timing !== undefined && !isTimingContext(request.timing)) ||
    !isStringOrUndefined(request.phaseContext) ||
    !isStringOrUndefined(request.scenarioId) ||
    !isSummaryAssemblyContext(request.summaryAssemblyContext)
  ) {
    throw new Error('Invalid analysis context.')
  }
}

const validateInterviewQuestionRequest = (request: InterviewQuestionRequest) => {
  validateTranscriptRequest(request)

  if (typeof request.question !== 'string' || !request.question.trim()) {
    throw new Error('Invalid interview question input.')
  }
}

const toPromptContext = (request: TranscriptRequest): AnalysisPromptContext => ({
  previousParticipantView: normalizeParticipantView(request.previousParticipantView),
  meetingMemory: normalizeMeetingMemory(request.meetingMemory),
  pinnedSegmentIds: request.pinnedSegmentIds,
  scenarioId: request.scenarioId,
  questionContext: request.questionContext?.trim() || undefined,
  roleContext: request.roleContext?.trim() || undefined,
  referenceContext: request.referenceContext?.trim() || undefined,
  timing: request.timing,
  phaseContext: request.phaseContext?.trim() || undefined,
  summaryAssemblyContext: request.summaryAssemblyContext,
})

const isAnalysisAction = (value: string | undefined): value is AnalysisAction =>
  value === 'realtime' ||
  value === 'speaking-hints' ||
  value === 'mind-map' ||
  value === 'meeting-minutes' ||
  value === 'meeting-summary' ||
  value === 'interview-question' ||
  value === 'probe'

const result = (status: number, body: unknown): AnalysisHttpResult => ({
  status,
  body,
})

export const handleAnalysisRequest = async (input: {
  action: string | undefined
  body: unknown
  configOverride: OpenAiRuntimeConfigOverride
  trustRuntimeConfig?: boolean
}): Promise<AnalysisHttpResult> => {
  if (!isAnalysisAction(input.action)) {
    return result(404, { ok: false, error: 'Unknown analysis action.' })
  }

  try {
    const configOverride = input.trustRuntimeConfig
      ? input.configOverride
      : sealCallerModelConfig(input.configOverride)

    if (input.action === 'probe') {
      const probe = await probeOpenAiConnection(configOverride)
      return result(200, {
        ok: true,
        model: probe.model,
        baseURL: probe.baseURL,
      })
    }

    if (!isTranscriptRequest(input.body)) {
      throw new Error('Invalid transcript request.')
    }

    if (input.action === 'interview-question') {
      const request = input.body as InterviewQuestionRequest
      validateInterviewQuestionRequest(request)
      const answer = await answerInterviewQuestionOnly(
        request.question,
        request.segments,
        toPromptContext(request),
        configOverride,
      )
      return result(200, { ok: true, answer })
    }

    validateTranscriptRequest(input.body)
    const context = toPromptContext(input.body)

    if (input.action === 'realtime') {
      const bundle = await analyzeTranscriptRealtimeBundle(
        input.body.segments,
        context,
        configOverride,
      )
      return result(200, { ok: true, bundle })
    }

    if (input.action === 'speaking-hints') {
      const hints = await generateSpeakingHintsOnly(
        input.body.segments,
        context,
        configOverride,
      )
      return result(200, { ok: true, hints })
    }

    if (input.action === 'mind-map') {
      const snapshot = await generateTranscriptMindMap(
        input.body.segments,
        context,
        configOverride,
      )
      return result(200, { ok: true, snapshot })
    }

    if (input.action === 'meeting-minutes') {
      const minutes = await generateMeetingMinutesOnly(
        input.body.segments,
        context,
        configOverride,
      )
      return result(200, { ok: true, minutes })
    }

    const summary = await generateMeetingSummaryOnly(
      input.body.segments,
      context,
      configOverride,
    )
    return result(200, { ok: true, summary })
  } catch (error) {
    return result(400, toAnalysisFailure(error, 'Unknown analysis error.'))
  }
}
