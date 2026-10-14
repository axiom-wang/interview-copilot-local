import { groundConsensusEvidence } from '../../meeting/context/groundConsensus'
import { acceptMemoryEvents, findHistoricalEvidence, formatEvidence, prepareMeetingHistory } from '../../meeting/context/meetingMemory'
import { buildMeetingMemoryPrompt } from '../../meeting/prompts/meetingMemory'
import { meetingMemorySchema } from '../../meeting/schemas/meetingMemory.schema'
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

export const prepareAnalysisContext = async (
  segments: TranscriptSegment[],
  context: AnalysisPromptContext | undefined,
  configOverride: OpenAiRuntimeConfigOverride | undefined,
  createResponse: StructuredResponse,
  question?: string,
) => {
  const prepared = await prepareMeetingHistory(segments, context?.meetingMemory, (source) =>
    createResponse(buildMeetingMemoryPrompt(source), 'meeting_memory', meetingMemorySchema,
      (value) => acceptMemoryEvents(value, source.map((segment) => segment.id)), configOverride))
  const evidence = question
    ? findHistoricalEvidence(prepared.segments, question, context?.pinnedSegmentIds)
    : []
  return {
    ...context,
    meetingMemory: prepared.memory,
    meetingHistory: prepared.history + (evidence.length
      ? `\n与用户问题有关的历史原话（含相邻发言及固定片段）：\n${formatEvidence(evidence)}` : ''),
    // Full history above supersedes the old unbounded duplicate transcript.
    summaryAssemblyContext: context?.summaryAssemblyContext
      ? { ...context.summaryAssemblyContext, transcript: undefined } : undefined,
  }
}

export const analyzeTranscriptRealtimeBundle = async (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
  configOverride?: OpenAiRuntimeConfigOverride,
  createResponse: StructuredResponse = createStructuredResponse,
): Promise<PhaseConsensusAnalysisBundle> => {
  context = await prepareAnalysisContext(segments, context, configOverride, createResponse)
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
    consensusAnalysis: { ...groundConsensusEvidence(consensusAnalysis, segments), meetingMemory: context.meetingMemory,
      contextCoverage: { segmentCount: segments.length, throughTimestamp: updatedAt } },
  }
}

export const generateSpeakingHintsOnly = async (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
  configOverride?: OpenAiRuntimeConfigOverride,
  createResponse: StructuredResponse = createStructuredResponse,
): Promise<SpeakingHints> => {
  context = await prepareAnalysisContext(segments, context, configOverride, createResponse)
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
  context = await prepareAnalysisContext(segments, context, configOverride, createResponse)
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
  context = await prepareAnalysisContext(segments, context, configOverride, createResponse)
  const summarySegments = segments.filter((segment) => segment.text.trim().length > 0)
  const updatedAt = segments.at(-1)?.timestamp ?? Date.now()

  return createResponse(
    buildGenerateMeetingSummaryPrompt(getRecentSegmentsByWindow(summarySegments, 90_000), context),
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
  context = await prepareAnalysisContext(segments, context, configOverride, createResponse)
  const minutesSegments = segments.filter(
    (segment) => segment.text.trim().length > 0,
  )
  const updatedAt = segments.at(-1)?.timestamp ?? Date.now()

  return createResponse(
    buildGenerateMeetingMinutesPrompt(getRecentSegmentsByWindow(minutesSegments, 90_000), context),
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
  context = await prepareAnalysisContext(segments, context, configOverride, createResponse, question)
  const questionSegments = segments.filter((segment) => segment.text.trim().length > 0)
  const updatedAt = questionSegments.at(-1)?.timestamp ?? Date.now()

  return createResponse(
    buildAnswerInterviewQuestionPrompt(question, getRecentSegmentsByWindow(questionSegments, 90_000), context),
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
