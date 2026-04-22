import { ipcMain } from 'electron'
import type {
  InterviewQaAnswer,
  MeetingSummary,
  PhaseConsensusAnalysisBundle,
  SpeakingHints,
} from '../../src/types/analysis'
import type { MindMapSnapshot } from '../../src/types/mindmap'
import type { AnalysisPromptContext } from '../../src/types/promptContext'
import type { TranscriptSegment } from '../../src/types/transcript'
import {
  analyzeTranscriptRealtimeBundle,
  answerInterviewQuestionOnly,
  generateMeetingSummaryOnly,
  generateSpeakingHintsOnly,
  generateTranscriptMindMap,
} from './openaiAnalysisService'
import {
  ANALYZE_TRANSCRIPT_REALTIME_CHANNEL,
  ANSWER_INTERVIEW_QUESTION_CHANNEL,
  GENERATE_MEETING_SUMMARY_CHANNEL,
  GENERATE_MIND_MAP_CHANNEL,
  GENERATE_SPEAKING_HINTS_CHANNEL,
} from './channels'

interface TranscriptRequest extends AnalysisPromptContext {
  segments: TranscriptSegment[]
}

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
  questionContext: request.questionContext?.trim() || undefined,
  roleContext: request.roleContext?.trim() || undefined,
  phaseContext: request.phaseContext?.trim() || undefined,
  summaryAssemblyContext: request.summaryAssemblyContext,
})

export const registerLlmIpcHandlers = () => {
  ipcMain.removeHandler(ANALYZE_TRANSCRIPT_REALTIME_CHANNEL)
  ipcMain.removeHandler(GENERATE_SPEAKING_HINTS_CHANNEL)
  ipcMain.removeHandler(GENERATE_MIND_MAP_CHANNEL)
  ipcMain.removeHandler(GENERATE_MEETING_SUMMARY_CHANNEL)
  ipcMain.removeHandler(ANSWER_INTERVIEW_QUESTION_CHANNEL)

  ipcMain.handle(
    ANALYZE_TRANSCRIPT_REALTIME_CHANNEL,
    async (_event, request: TranscriptRequest): Promise<RealtimeAnalysisResult> => {
      try {
        validateRequest(request)

        const bundle = await analyzeTranscriptRealtimeBundle(
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

        const hints = await generateSpeakingHintsOnly(
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

        const snapshot = await generateTranscriptMindMap(
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

        const summary = await generateMeetingSummaryOnly(
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
    ANSWER_INTERVIEW_QUESTION_CHANNEL,
    async (
      _event,
      request: InterviewQuestionRequest,
    ): Promise<InterviewQuestionResult> => {
      try {
        validateInterviewQuestionRequest(request)

        const answer = await answerInterviewQuestionOnly(
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
