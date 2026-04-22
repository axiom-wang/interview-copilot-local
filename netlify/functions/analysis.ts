import type { Config, Context } from '@netlify/functions'
import {
  analyzeTranscriptRealtimeBundle,
  answerInterviewQuestionOnly,
  generateMeetingSummaryOnly,
  generateSpeakingHintsOnly,
  generateTranscriptMindMap,
} from '../../electron/llm/openaiAnalysisService'
import type { AnalysisPromptContext } from '../../src/types/promptContext'
import type { TranscriptSegment } from '../../src/types/transcript'

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
  | 'meeting-summary'
  | 'interview-question'

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

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

const validateTranscriptRequest = (request: TranscriptRequest) => {
  if (
    !request ||
    !Array.isArray(request.segments) ||
    !request.segments.every(isTranscriptSegment)
  ) {
    throw new Error('Invalid transcript request.')
  }

  if (
    !isStringOrUndefined(request.questionContext) ||
    !isStringOrUndefined(request.roleContext) ||
    !isStringOrUndefined(request.phaseContext) ||
    !isSummaryAssemblyContext(request.summaryAssemblyContext)
  ) {
    throw new Error('Invalid analysis context.')
  }
}

const validateInterviewQuestionRequest = (
  request: InterviewQuestionRequest,
) => {
  validateTranscriptRequest(request)

  if (typeof request.question !== 'string' || !request.question.trim()) {
    throw new Error('Invalid interview question input.')
  }
}

const toPromptContext = (
  request: TranscriptRequest,
): AnalysisPromptContext => ({
  questionContext: request.questionContext?.trim() || undefined,
  roleContext: request.roleContext?.trim() || undefined,
  phaseContext: request.phaseContext?.trim() || undefined,
  summaryAssemblyContext: request.summaryAssemblyContext,
})

const isAnalysisAction = (value: string | undefined): value is AnalysisAction =>
  value === 'realtime' ||
  value === 'speaking-hints' ||
  value === 'mind-map' ||
  value === 'meeting-summary' ||
  value === 'interview-question'

const readJsonBody = async <T>(request: Request) => {
  try {
    return (await request.json()) as T
  } catch {
    throw new Error('Request body must be valid JSON.')
  }
}

const handleAnalysisAction = async (
  action: AnalysisAction,
  request: Request,
) => {
  if (action === 'interview-question') {
    const body = await readJsonBody<InterviewQuestionRequest>(request)
    validateInterviewQuestionRequest(body)

    const answer = await answerInterviewQuestionOnly(
      body.question,
      body.segments,
      toPromptContext(body),
    )

    return json({ ok: true, answer })
  }

  const body = await readJsonBody<TranscriptRequest>(request)
  validateTranscriptRequest(body)
  const context = toPromptContext(body)

  if (action === 'realtime') {
    const bundle = await analyzeTranscriptRealtimeBundle(body.segments, context)
    return json({ ok: true, bundle })
  }

  if (action === 'speaking-hints') {
    const hints = await generateSpeakingHintsOnly(body.segments, context)
    return json({ ok: true, hints })
  }

  if (action === 'mind-map') {
    const snapshot = await generateTranscriptMindMap(body.segments, context)
    return json({ ok: true, snapshot })
  }

  const summary = await generateMeetingSummaryOnly(body.segments, context)
  return json({ ok: true, summary })
}

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, { status: 405 })
  }

  const action = context.params.action

  if (!isAnalysisAction(action)) {
    return json({ ok: false, error: 'Unknown analysis action.' }, { status: 404 })
  }

  try {
    return await handleAnalysisAction(action, request)
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown analysis error.',
      },
      { status: 400 },
    )
  }
}

export const config: Config = {
  path: '/api/analysis/:action',
  method: ['POST'],
}
