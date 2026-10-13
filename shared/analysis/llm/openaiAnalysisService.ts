import { buildAnswerInterviewQuestionPrompt } from '../../meeting/prompts/answerInterviewQuestion'
import { buildDetectPhasePrompt } from '../../meeting/prompts/detectPhase'
import { buildExtractConsensusPrompt } from '../../meeting/prompts/extractConsensus'
import { buildGenerateMeetingMinutesPrompt } from '../../meeting/prompts/generateMeetingMinutes'
import { buildGenerateMeetingSummaryPrompt } from '../../meeting/prompts/generateMeetingSummary'
import { buildGenerateMindMapPrompt } from '../../meeting/prompts/generateMindMap'
import { buildSpeakingHintsPrompt } from '../../meeting/prompts/speakingHints'
import { answerInterviewQuestionSchema } from '../../meeting/schemas/answerInterviewQuestion.schema.ts'
import { detectPhaseSchema } from '../../meeting/schemas/detectPhase.schema.ts'
import { extractConsensusSchema } from '../../meeting/schemas/extractConsensus.schema.ts'
import { generateMeetingMinutesSchema } from '../../meeting/schemas/generateMeetingMinutes.schema.ts'
import { generateMeetingSummarySchema } from '../../meeting/schemas/generateMeetingSummary.schema.ts'
import { generateMindMapSchema } from '../../meeting/schemas/generateMindMap.schema.ts'
import { speakingHintsSchema } from '../../meeting/schemas/speakingHints.schema.ts'
import type {
  AnalysisBundle,
  InterviewQaAnswer,
  MeetingMinutes,
  MeetingSummary,
  PhaseConsensusAnalysisBundle,
  SpeakingHints,
} from '../../meeting/types/analysis'
import type { MindMapSnapshot } from '../../meeting/types/mindmap'
import type { AnalysisPromptContext } from '../../meeting/types/promptContext'
import type { TranscriptSegment } from '../../meeting/types/transcript'
import {
  getOpenAiRuntimeConfig,
  type OpenAiRuntimeConfigOverride,
} from './openaiConfig'
import {
  parseConsensusAnalysis,
  parseInterviewQaAnswer,
  parseMeetingMinutes,
  parseMeetingSummary,
  parseMindMapSnapshot,
  parsePhaseAnalysis,
  parseSpeakingHints,
} from './responseParsing'
import { getRecentSegmentsByWindow } from './segmentWindows'

type JsonSchema = Record<string, unknown>

const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504])
const MAX_RETRIES = 2
const RESPONSES_TIMEOUT_MS = 45_000

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const createTimeoutController = (timeoutMs: number) => {
  const controller = new AbortController()
  let didTimeout = false
  const timeoutId = setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, timeoutMs)

  return {
    signal: controller.signal,
    didTimeout: () => didTimeout,
    clear: () => clearTimeout(timeoutId),
  }
}

const stripHtml = (value: string) =>
  value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const normalizeErrorText = (
  status: number,
  statusText: string,
  body: string,
  contentType: string | null,
) => {
  const bodyText = body.trim()
  const maybeHtml =
    contentType?.includes('text/html') ||
    /^<!doctype html/i.test(bodyText) ||
    /^<html/i.test(bodyText)

  if (maybeHtml) {
    return `网关暂时不可用（${status} ${statusText || 'Bad Gateway'}）`
  }

  const normalizedBody = stripHtml(bodyText)

  if (!normalizedBody) {
    return `请求失败（${status} ${statusText || 'Unknown Error'}）`
  }

  return `请求失败（${status}）：${normalizedBody}`
}

const fetchStructuredResponse = async (
  body: Record<string, unknown>,
  configOverride?: OpenAiRuntimeConfigOverride,
) => {
  const config = getOpenAiRuntimeConfig(configOverride)
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const timeoutController = createTimeoutController(RESPONSES_TIMEOUT_MS)

    try {
      const response = await fetch(`${config.baseURL}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: timeoutController.signal,
      })
      timeoutController.clear()

      if (!response.ok) {
        const errorText = await response.text()
        const message = normalizeErrorText(
          response.status,
          response.statusText,
          errorText,
          response.headers.get('content-type'),
        )

        if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
          await sleep(400 * (attempt + 1))
          continue
        }

        throw new Error(`Responses API ${message}`)
      }

      return (await response.json()) as {
        output_text?: string
        output?: Array<{
          content?: Array<{
            type?: string
            text?: string
          }>
        }>
      }
    } catch (error) {
      timeoutController.clear()
      lastError =
        timeoutController.didTimeout()
          ? new Error(`Responses API 请求超时（${RESPONSES_TIMEOUT_MS}ms）`)
          : error instanceof Error
            ? error
            : new Error('Responses API 请求异常')

      if (attempt < MAX_RETRIES) {
        await sleep(400 * (attempt + 1))
        continue
      }
    }
  }

  throw lastError ?? new Error('Responses API 请求失败')
}

export type StructuredResponse = <T>(
  prompt: string,
  schemaName: string,
  schema: Record<string, unknown>,
  parser: (value: unknown) => T,
  configOverride?: OpenAiRuntimeConfigOverride,
) => Promise<T>

const createStructuredResponse = async <T>(
  prompt: string,
  schemaName: string,
  schema: JsonSchema,
  parser: (value: unknown) => T,
  configOverride?: OpenAiRuntimeConfigOverride,
) => {
  const config = getOpenAiRuntimeConfig(configOverride)
  const payload = await fetchStructuredResponse(
    {
      model: config.model,
      store: false,
      input: prompt,
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
    },
    configOverride,
  )

  const outputText =
    typeof payload.output_text === 'string' && payload.output_text.trim()
      ? payload.output_text.trim()
      : payload.output
          ?.flatMap((item) => item.content ?? [])
          .find((content) => content.type === 'output_text' && content.text)?.text
          ?.trim()

  if (!outputText) {
    throw new Error('Responses API 未返回可解析的 JSON 文本')
  }

  return parser(JSON.parse(outputText))
}

export const analyzeTranscriptRealtimeBundle = async (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
  configOverride?: OpenAiRuntimeConfigOverride,
  createResponse: StructuredResponse = createStructuredResponse,
): Promise<PhaseConsensusAnalysisBundle> => {
  const analysisSegments = getRecentSegmentsByWindow(segments, 90 * 1000)
  const updatedAt = segments.at(-1)?.timestamp ?? Date.now()

  const [phaseAnalysis, consensusAnalysis] = await Promise.all([
    createResponse(
      buildDetectPhasePrompt(analysisSegments, context),
      'detect_phase',
      detectPhaseSchema,
      (value) => parsePhaseAnalysis(value, updatedAt),
      configOverride,
    ),
    createResponse(
      buildExtractConsensusPrompt(analysisSegments, context),
      'extract_consensus_and_tensions',
      extractConsensusSchema,
      (value) => parseConsensusAnalysis(value, updatedAt),
      configOverride,
    ),
  ])

  return {
    phaseAnalysis,
    consensusAnalysis,
  }
}

export const generateSpeakingHintsOnly = async (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
  configOverride?: OpenAiRuntimeConfigOverride,
  createResponse: StructuredResponse = createStructuredResponse,
): Promise<SpeakingHints> => {
  const analysisSegments = getRecentSegmentsByWindow(segments, 90 * 1000)
  const updatedAt = segments.at(-1)?.timestamp ?? Date.now()

  return createResponse(
    buildSpeakingHintsPrompt(analysisSegments, context),
    'generate_speaking_hints',
    speakingHintsSchema,
    (value) => parseSpeakingHints(value, updatedAt),
    configOverride,
  )
}

export const generateTranscriptMindMap = async (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
  configOverride?: OpenAiRuntimeConfigOverride,
  createResponse: StructuredResponse = createStructuredResponse,
): Promise<MindMapSnapshot> => {
  const mindMapSegments = getRecentSegmentsByWindow(segments, 3 * 60 * 1000)
  const updatedAt = segments.at(-1)?.timestamp ?? Date.now()

  return createResponse(
    buildGenerateMindMapPrompt(mindMapSegments, context),
    'generate_mind_map',
    generateMindMapSchema,
    (value) => parseMindMapSnapshot(value, updatedAt),
    configOverride,
  )
}

export const generateMeetingSummaryOnly = async (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
  configOverride?: OpenAiRuntimeConfigOverride,
  createResponse: StructuredResponse = createStructuredResponse,
): Promise<MeetingSummary> => {
  const summarySegments = segments.filter((segment) => segment.text.trim().length > 0)
  const updatedAt = segments.at(-1)?.timestamp ?? Date.now()
  const summaryAssemblyContext = {
    ...(context?.summaryAssemblyContext ?? {}),
    transcript:
      context?.summaryAssemblyContext?.transcript &&
      context.summaryAssemblyContext.transcript.length > 0
        ? context.summaryAssemblyContext.transcript
        : summarySegments,
  }
  const promptContext: AnalysisPromptContext = {
    ...context,
    summaryAssemblyContext,
  }

  return createResponse(
    buildGenerateMeetingSummaryPrompt(summarySegments, promptContext),
    'generate_meeting_summary',
    generateMeetingSummarySchema,
    (value) => parseMeetingSummary(value, updatedAt),
    configOverride,
  )
}

export const generateMeetingMinutesOnly = async (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
  configOverride?: OpenAiRuntimeConfigOverride,
  createResponse: StructuredResponse = createStructuredResponse,
): Promise<MeetingMinutes> => {
  const minutesSegments = segments.filter(
    (segment) => segment.text.trim().length > 0,
  )
  const updatedAt = segments.at(-1)?.timestamp ?? Date.now()
  const summaryAssemblyContext = {
    ...(context?.summaryAssemblyContext ?? {}),
    transcript:
      context?.summaryAssemblyContext?.transcript &&
      context.summaryAssemblyContext.transcript.length > 0
        ? context.summaryAssemblyContext.transcript
        : minutesSegments,
  }
  const promptContext: AnalysisPromptContext = {
    ...context,
    summaryAssemblyContext,
  }

  return createResponse(
    buildGenerateMeetingMinutesPrompt(minutesSegments, promptContext),
    'generate_meeting_minutes',
    generateMeetingMinutesSchema,
    (value) => parseMeetingMinutes(value, updatedAt),
    configOverride,
  )
}

export const answerInterviewQuestionOnly = async (
  question: string,
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
  configOverride?: OpenAiRuntimeConfigOverride,
  createResponse: StructuredResponse = createStructuredResponse,
): Promise<InterviewQaAnswer> => {
  const questionSegments = segments.filter((segment) => segment.text.trim().length > 0)
  const updatedAt = questionSegments.at(-1)?.timestamp ?? Date.now()

  return createResponse(
    buildAnswerInterviewQuestionPrompt(question, questionSegments, context),
    'answer_interview_question',
    answerInterviewQuestionSchema,
    (value) => parseInterviewQaAnswer(value, updatedAt),
    configOverride,
  )
}

export const probeOpenAiConnection = async (
  configOverride?: OpenAiRuntimeConfigOverride,
) => {
  const config = getOpenAiRuntimeConfig(configOverride)
  const response = await fetch(`${config.baseURL}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      normalizeErrorText(
        response.status,
        response.statusText,
        errorText,
        response.headers.get('content-type'),
      ),
    )
  }

  return {
    ok: true as const,
    model: config.model,
    baseURL: config.baseURL,
  }
}

export const analyzeTranscriptBundle = async (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
  configOverride?: OpenAiRuntimeConfigOverride,
): Promise<AnalysisBundle> => {
  const [bundle, speakingHints, mindMapSnapshot] = await Promise.all([
    analyzeTranscriptRealtimeBundle(segments, context, configOverride),
    generateSpeakingHintsOnly(segments, context, configOverride),
    generateTranscriptMindMap(segments, context, configOverride),
  ])

  return {
    ...bundle,
    speakingHints,
    mindMapSnapshot,
  }
}
