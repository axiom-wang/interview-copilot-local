import type { Config, Context } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import {
  analyzeTranscriptRealtimeBundle,
  answerInterviewQuestionOnly,
  generateMeetingMinutesOnly,
  generateMeetingSummaryOnly,
  generateSpeakingHintsOnly,
  generateTranscriptMindMap,
  probeOpenAiConnection,
} from '../../electron/llm/openaiAnalysisService'
import type { OpenAiRuntimeConfigOverride } from '../../electron/llm/openaiConfig'
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
  | 'meeting-minutes'
  | 'meeting-summary'
  | 'interview-question'
  | 'probe'

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
    !isStringOrUndefined(request.scenarioId) ||
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
  scenarioId: request.scenarioId,
  questionContext: request.questionContext?.trim() || undefined,
  roleContext: request.roleContext?.trim() || undefined,
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

const readJsonBody = async <T>(request: Request) => {
  try {
    return (await request.json()) as T
  } catch {
    throw new Error('Request body must be valid JSON.')
  }
}

const readModelConfigFromHeaders = (
  request: Request,
): OpenAiRuntimeConfigOverride => {
  const apiKey = request.headers.get('x-model-api-key')?.trim()
  const model = request.headers.get('x-model-name')?.trim()
  const baseURL = request.headers.get('x-model-base-url')?.trim()

  return {
    apiKey: apiKey || undefined,
    model: model || undefined,
    baseURL: baseURL || undefined,
  }
}

const requireAuthenticatedUser = async () => {
  try {
    const user = await getUser()
    if (!user) {
      return null
    }

    return user
  } catch {
    // Identity may be unavailable in local preview builds.
    return null
  }
}

const handleAnalysisAction = async (
  action: AnalysisAction,
  request: Request,
  configOverride: OpenAiRuntimeConfigOverride,
) => {
  if (action === 'probe') {
    const result = await probeOpenAiConnection(configOverride)
    return json({
      ok: true,
      model: result.model,
      baseURL: result.baseURL,
    })
  }

  if (action === 'interview-question') {
    const body = await readJsonBody<InterviewQuestionRequest>(request)
    validateInterviewQuestionRequest(body)

    const answer = await answerInterviewQuestionOnly(
      body.question,
      body.segments,
      toPromptContext(body),
      configOverride,
    )

    return json({ ok: true, answer })
  }

  const body = await readJsonBody<TranscriptRequest>(request)
  validateTranscriptRequest(body)
  const context = toPromptContext(body)

  if (action === 'realtime') {
    const bundle = await analyzeTranscriptRealtimeBundle(
      body.segments,
      context,
      configOverride,
    )
    return json({ ok: true, bundle })
  }

  if (action === 'speaking-hints') {
    const hints = await generateSpeakingHintsOnly(
      body.segments,
      context,
      configOverride,
    )
    return json({ ok: true, hints })
  }

  if (action === 'mind-map') {
    const snapshot = await generateTranscriptMindMap(
      body.segments,
      context,
      configOverride,
    )
    return json({ ok: true, snapshot })
  }

  if (action === 'meeting-minutes') {
    const minutes = await generateMeetingMinutesOnly(
      body.segments,
      context,
      configOverride,
    )
    return json({ ok: true, minutes })
  }

  const summary = await generateMeetingSummaryOnly(
    body.segments,
    context,
    configOverride,
  )
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

  const identityEnabled =
    (
      globalThis as typeof globalThis & {
        Netlify?: { env?: { get?: (name: string) => string | undefined } }
      }
    ).Netlify?.env?.get?.('IDENTITY_REQUIRED') === 'true'

  if (identityEnabled) {
    const user = await requireAuthenticatedUser()
    if (!user) {
      return json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
    }
  } else {
    // Soft gate: if Identity is available and a user exists, great.
    // If not configured (local/mock), allow request through with user-supplied keys.
    await requireAuthenticatedUser()
  }

  try {
    const configOverride = readModelConfigFromHeaders(request)
    return await handleAnalysisAction(action, request, configOverride)
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
