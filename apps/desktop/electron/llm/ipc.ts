import { normalizeParticipantView } from '../../../../shared/meeting/context/participantView'
import type { AnalysisRoutingMetadata, AnalysisSessionReset, DesktopAnalysisConfig, DesktopTranscriptRequest } from '../../../../shared/meeting/types/desktopAnalysis'
import { claudeAnalysis, prewarmClaudeAnalysis, probeClaudeConnection, resetClaudeAnalysis } from './claudeAnalysisService'
import { codexAnalysis, disposeCodexAnalysis, probeCodexConnection } from './codexAnalysisService'
import { probeOpenAiConnection } from '../../../../shared/analysis/llm/openaiAnalysisService'
import { ipcMain } from 'electron'
import type {
  InterviewQaAnswer,
  MeetingMinutes,
  MeetingSummary,
  PhaseConsensusAnalysisBundle,
  SpeakingHints,
} from '../../../../shared/meeting/types/analysis'
import type { MindMapSnapshot } from '../../../../shared/meeting/types/mindmap'
import type { AnalysisErrorResult } from '../../../../shared/analysis/llm/analysisFailure'
import { normalizeMeetingMemory } from '../../../../shared/meeting/context/meetingMemory'
import { isTimingContext } from '../../../../shared/meeting/context/timeBudget'
import type { AnalysisPromptContext } from '../../../../shared/meeting/types/promptContext'
import type { TranscriptSegment } from '../../../../shared/meeting/types/transcript'
import {
  analyzeTranscriptRealtimeBundle,
  answerInterviewQuestionOnly,
  generateMeetingMinutesOnly,
  generateMeetingSummaryOnly,
  generateSpeakingHintsOnly,
  generateTranscriptMindMap,
} from '../../../../shared/analysis/llm/openaiAnalysisService'
import {
  PROBE_ANALYSIS_CHANNEL,
  PREWARM_ANALYSIS_CHANNEL,
  RESET_ANALYSIS_CHANNEL,
  ANALYZE_TRANSCRIPT_REALTIME_CHANNEL,
  ANSWER_INTERVIEW_QUESTION_CHANNEL,
  GENERATE_MEETING_MINUTES_CHANNEL,
  GENERATE_MEETING_SUMMARY_CHANNEL,
  GENERATE_MIND_MAP_CHANNEL,
  GENERATE_SPEAKING_HINTS_CHANNEL,
} from './channels'

import { AnalysisRouter, redactAnalysisError, toDesktopAnalysisFailure } from './analysisRouter'

const router = new AnalysisRouter()
type TranscriptRequest = DesktopTranscriptRequest

interface InterviewQuestionRequest extends TranscriptRequest {
  question: string
}

type RealtimeAnalysisResult =
  | {
      ok: true
      routing?: AnalysisRoutingMetadata
      bundle: PhaseConsensusAnalysisBundle
    }
  | AnalysisErrorResult

type SpeakingHintsResult =
  | {
      ok: true
      routing?: AnalysisRoutingMetadata
      hints: SpeakingHints
    }
  | AnalysisErrorResult

type MindMapResult =
  | {
      ok: true
      routing?: AnalysisRoutingMetadata
      snapshot: MindMapSnapshot
    }
  | AnalysisErrorResult

type MeetingSummaryResult =
  | {
      ok: true
      routing?: AnalysisRoutingMetadata
      summary: MeetingSummary
    }
  | AnalysisErrorResult

type MeetingMinutesResult =
  | {
      ok: true
      routing?: AnalysisRoutingMetadata
      minutes: MeetingMinutes
    }
  | AnalysisErrorResult

type InterviewQuestionResult =
  | {
      ok: true
      routing?: AnalysisRoutingMetadata
      answer: InterviewQaAnswer
    }
  | AnalysisErrorResult

const isTranscriptSegment = (
  value: unknown,
): value is TranscriptSegment & Record<string, unknown> =>
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

const validateRequest = (request: TranscriptRequest) => {
  if (
    !request ||
    !Array.isArray(request.segments) ||
    !request.segments.every(isTranscriptSegment)
  ) {
    throw new Error('无效的转写请求')
  }

  validateConfig(request.analysisConfig)
  validateConfig(request.fallbackAnalysisConfig)
  if (request.fallbackAnalysisConfig && (!request.analysisConfig || request.fallbackAnalysisConfig.provider === request.analysisConfig.provider)) {
    throw new Error('备用渠道必须与首选渠道不同。')
  }
  if (request.analysisSessionId !== undefined && typeof request.analysisSessionId !== 'string') throw new Error('无效的分析会话。')

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
    throw new Error('无效的上下文输入')
  }
}

const validateInterviewQuestionRequest = (
  request: InterviewQuestionRequest,
) => {
  validateRequest(request)

  if (typeof request.question !== 'string' || !request.question.trim()) {
    throw new Error('Invalid interview question input')
  }
}

const toPromptContext = (
  request: TranscriptRequest,
): AnalysisPromptContext => ({
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

const validateConfig = (config?: DesktopAnalysisConfig) => {
  if (!config) return
  if (config.provider === 'codex') {
    if (typeof config.executablePath !== 'string' || typeof config.model !== 'string') {
      throw new Error('无效的 Codex 配置。')
    }
  } else if (config.provider === 'claude') {
    if (typeof config.executablePath !== 'string' || typeof config.model !== 'string') {
      throw new Error('无效的 Claude 配置。')
    }
  } else if (config.provider !== 'api' || typeof config.apiKey !== 'string' ||
    typeof config.model !== 'string' || typeof config.baseURL !== 'string') {
    throw new Error('无效的文本分析配置。')
  }
}

const selectAnalysis = (config?: DesktopAnalysisConfig) => {
  validateConfig(config)
  if (config?.provider === 'codex') return codexAnalysis(config)
  if (config?.provider === 'claude') return claudeAnalysis(config)
  return {
    realtime: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      analyzeTranscriptRealtimeBundle(segments, context, config),
    hints: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      generateSpeakingHintsOnly(segments, context, config),
    mindMap: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      generateTranscriptMindMap(segments, context, config),
    summary: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      generateMeetingSummaryOnly(segments, context, config),
    minutes: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      generateMeetingMinutesOnly(segments, context, config),
    answer: (question: string, segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      answerInterviewQuestionOnly(question, segments, context, config),
  }
}

const probeConnection = async (config: DesktopAnalysisConfig) => {
  switch (config.provider) {
    case 'codex': return probeCodexConnection(config)
    case 'claude': return probeClaudeConnection(config)
    default: return { ...await probeOpenAiConnection(config), authMethod: 'apiKey' }
  }
}

export const registerLlmIpcHandlers = () => {
  ipcMain.removeHandler(PROBE_ANALYSIS_CHANNEL)
  ipcMain.removeHandler(RESET_ANALYSIS_CHANNEL)
  ipcMain.removeHandler(PREWARM_ANALYSIS_CHANNEL)
  // 预热只是优化：失败不影响后续请求，真正的错误会在首次分析时报告。
  ipcMain.handle(PREWARM_ANALYSIS_CHANNEL, (_event, request: { analysisConfig?: DesktopAnalysisConfig; scenarioId?: string }) => {
    try {
      validateConfig(request?.analysisConfig)
      if (request?.analysisConfig?.provider === 'claude') prewarmClaudeAnalysis(request.analysisConfig, request.scenarioId)
    } catch {
      // Ignore: the first real request reports configuration problems.
    }
  })
  ipcMain.handle(RESET_ANALYSIS_CHANNEL, (_event, options?: AnalysisSessionReset) => {
    router.reset(options)
    disposeCodexAnalysis()
    resetClaudeAnalysis()
  })
  ipcMain.handle(PROBE_ANALYSIS_CHANNEL, async (_event, config: DesktopAnalysisConfig) => {
    try {
      validateConfig(config)
      if (!config) throw new Error('缺少分析通道配置。')
      return { ok: true, ...await probeConnection(config) }
    } catch (error) {
      return { ok: false, error: redactAnalysisError(error, [config]) }
    }
  })
  ipcMain.removeHandler(ANALYZE_TRANSCRIPT_REALTIME_CHANNEL)
  ipcMain.removeHandler(GENERATE_SPEAKING_HINTS_CHANNEL)
  ipcMain.removeHandler(GENERATE_MIND_MAP_CHANNEL)
  ipcMain.removeHandler(GENERATE_MEETING_SUMMARY_CHANNEL)
  ipcMain.removeHandler(GENERATE_MEETING_MINUTES_CHANNEL)
  ipcMain.removeHandler(ANSWER_INTERVIEW_QUESTION_CHANNEL)

  ipcMain.handle(
    ANALYZE_TRANSCRIPT_REALTIME_CHANNEL,
    async (_event, request: TranscriptRequest): Promise<RealtimeAnalysisResult> => {
      try {
        validateRequest(request)

        const { value: bundle, routing } = await router.run(request, (config) => selectAnalysis(config).realtime(
          request.segments,
          toPromptContext(request),
        ))

        return {
          ok: true,
          bundle,
          routing,
        }
      } catch (error) {
        return toDesktopAnalysisFailure(error, request)
      }
    },
  )

  ipcMain.handle(
    GENERATE_SPEAKING_HINTS_CHANNEL,
    async (_event, request: TranscriptRequest): Promise<SpeakingHintsResult> => {
      try {
        validateRequest(request)

        const { value: hints, routing } = await router.run(request, (config) => selectAnalysis(config).hints(
          request.segments,
          toPromptContext(request),
        ))

        return {
          ok: true,
          hints,
          routing,
        }
      } catch (error) {
        return toDesktopAnalysisFailure(error, request)
      }
    },
  )

  ipcMain.handle(
    GENERATE_MIND_MAP_CHANNEL,
    async (_event, request: TranscriptRequest): Promise<MindMapResult> => {
      try {
        validateRequest(request)

        const { value: snapshot, routing } = await router.run(request, (config) => selectAnalysis(config).mindMap(
          request.segments,
          toPromptContext(request),
        ))

        return {
          ok: true,
          snapshot,
          routing,
        }
      } catch (error) {
        return toDesktopAnalysisFailure(error, request)
      }
    },
  )

  ipcMain.handle(
    GENERATE_MEETING_SUMMARY_CHANNEL,
    async (_event, request: TranscriptRequest): Promise<MeetingSummaryResult> => {
      try {
        validateRequest(request)

        const { value: summary, routing } = await router.run(request, (config) => selectAnalysis(config).summary(
          request.segments,
          toPromptContext(request),
        ))

        return {
          ok: true,
          summary,
          routing,
        }
      } catch (error) {
        return toDesktopAnalysisFailure(error, request)
      }
    },
  )

  ipcMain.handle(
    GENERATE_MEETING_MINUTES_CHANNEL,
    async (_event, request: TranscriptRequest): Promise<MeetingMinutesResult> => {
      try {
        validateRequest(request)

        const { value: minutes, routing } = await router.run(request, (config) => selectAnalysis(config).minutes(
          request.segments,
          toPromptContext(request),
        ))

        return {
          ok: true,
          minutes,
          routing,
        }
      } catch (error) {
        return toDesktopAnalysisFailure(error, request)
      }
    },
  )

  ipcMain.handle(
    ANSWER_INTERVIEW_QUESTION_CHANNEL,
    async (
      _event,
      request: InterviewQuestionRequest,
    ): Promise<InterviewQuestionResult> => {
      try {
        validateInterviewQuestionRequest(request)

        const { value: answer, routing } = await router.run(request, (config) => selectAnalysis(config).answer(
          request.question,
          request.segments,
          toPromptContext(request),
        ))

        return {
          ok: true,
          answer,
          routing,
        }
      } catch (error) {
        return toDesktopAnalysisFailure(error, request)
      }
    },
  )
}
