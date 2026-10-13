import type { DesktopAnalysisConfig, DesktopTranscriptRequest } from '../../../../shared/meeting/types/desktopAnalysis'
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
  RESET_ANALYSIS_CHANNEL,
  ANALYZE_TRANSCRIPT_REALTIME_CHANNEL,
  ANSWER_INTERVIEW_QUESTION_CHANNEL,
  GENERATE_MEETING_MINUTES_CHANNEL,
  GENERATE_MEETING_SUMMARY_CHANNEL,
  GENERATE_MIND_MAP_CHANNEL,
  GENERATE_SPEAKING_HINTS_CHANNEL,
} from './channels'

type TranscriptRequest = DesktopTranscriptRequest

interface InterviewQuestionRequest extends TranscriptRequest {
  question: string
}

type RealtimeAnalysisResult =
  | {
      ok: true
      bundle: PhaseConsensusAnalysisBundle
    }
  | {
      ok: false
      error: string
    }

type SpeakingHintsResult =
  | {
      ok: true
      hints: SpeakingHints
    }
  | {
      ok: false
      error: string
    }

type MindMapResult =
  | {
      ok: true
      snapshot: MindMapSnapshot
    }
  | {
      ok: false
      error: string
    }

type MeetingSummaryResult =
  | {
      ok: true
      summary: MeetingSummary
    }
  | {
      ok: false
      error: string
    }

type MeetingMinutesResult =
  | {
      ok: true
      minutes: MeetingMinutes
    }
  | {
      ok: false
      error: string
    }

type InterviewQuestionResult =
  | {
      ok: true
      answer: InterviewQaAnswer
    }
  | {
      ok: false
      error: string
    }

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

  if (
    !isStringOrUndefined(request.questionContext) ||
    !isStringOrUndefined(request.roleContext) ||
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
  scenarioId: request.scenarioId,
  questionContext: request.questionContext?.trim() || undefined,
  roleContext: request.roleContext?.trim() || undefined,
  phaseContext: request.phaseContext?.trim() || undefined,
  summaryAssemblyContext: request.summaryAssemblyContext,
})

const validateConfig = (config?: DesktopAnalysisConfig) => {
  if (!config) return
  if (config.provider === 'codex') {
    if (typeof config.executablePath !== 'string' || typeof config.model !== 'string') {
      throw new Error('无效的 Codex 配置。')
    }
  } else if (config.provider !== 'api' || typeof config.apiKey !== 'string' ||
    typeof config.model !== 'string' || typeof config.baseURL !== 'string') {
    throw new Error('无效的文本分析配置。')
  }
}

const selectAnalysis = (config?: DesktopAnalysisConfig) => {
  validateConfig(config)
  if (config?.provider === 'codex') return codexAnalysis(config)
  disposeCodexAnalysis()
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

export const registerLlmIpcHandlers = () => {
  ipcMain.removeHandler(PROBE_ANALYSIS_CHANNEL)
  ipcMain.removeHandler(RESET_ANALYSIS_CHANNEL)
  ipcMain.handle(RESET_ANALYSIS_CHANNEL, () => disposeCodexAnalysis())
  ipcMain.handle(PROBE_ANALYSIS_CHANNEL, async (_event, config: DesktopAnalysisConfig) => {
    try {
      validateConfig(config)
      if (!config) throw new Error('缺少分析通道配置。')
      const result = config.provider === 'codex'
        ? await probeCodexConnection(config)
        : { ...await probeOpenAiConnection(config), authMethod: 'apiKey' }
      return { ok: true, ...result }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '分析连接测试失败。' }
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

        const bundle = await selectAnalysis(request.analysisConfig).realtime(
          request.segments,
          toPromptContext(request),
        )

        return {
          ok: true,
          bundle,
        }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : '未知分析错误',
        }
      }
    },
  )

  ipcMain.handle(
    GENERATE_SPEAKING_HINTS_CHANNEL,
    async (_event, request: TranscriptRequest): Promise<SpeakingHintsResult> => {
      try {
        validateRequest(request)

        const hints = await selectAnalysis(request.analysisConfig).hints(
          request.segments,
          toPromptContext(request),
        )

        return {
          ok: true,
          hints,
        }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : '未知发言建议生成错误',
        }
      }
    },
  )

  ipcMain.handle(
    GENERATE_MIND_MAP_CHANNEL,
    async (_event, request: TranscriptRequest): Promise<MindMapResult> => {
      try {
        validateRequest(request)

        const snapshot = await selectAnalysis(request.analysisConfig).mindMap(
          request.segments,
          toPromptContext(request),
        )

        return {
          ok: true,
          snapshot,
        }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : '未知导图生成错误',
        }
      }
    },
  )

  ipcMain.handle(
    GENERATE_MEETING_SUMMARY_CHANNEL,
    async (_event, request: TranscriptRequest): Promise<MeetingSummaryResult> => {
      try {
        validateRequest(request)

        const summary = await selectAnalysis(request.analysisConfig).summary(
          request.segments,
          toPromptContext(request),
        )

        return {
          ok: true,
          summary,
        }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : '未知总结发言生成错误',
        }
      }
    },
  )

  ipcMain.handle(
    GENERATE_MEETING_MINUTES_CHANNEL,
    async (_event, request: TranscriptRequest): Promise<MeetingMinutesResult> => {
      try {
        validateRequest(request)

        const minutes = await selectAnalysis(request.analysisConfig).minutes(
          request.segments,
          toPromptContext(request),
        )

        return {
          ok: true,
          minutes,
        }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : '未知会议纪要生成错误',
        }
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

        const answer = await selectAnalysis(request.analysisConfig).answer(
          request.question,
          request.segments,
          toPromptContext(request),
        )

        return {
          ok: true,
          answer,
        }
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown interview question error',
        }
      }
    },
  )
}
