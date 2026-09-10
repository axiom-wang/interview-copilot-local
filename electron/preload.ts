import { contextBridge, ipcRenderer } from 'electron'
import type {
  InterviewQaAnswer,
  MeetingMinutes,
  MeetingSummary,
  PhaseConsensusAnalysisBundle,
  SpeakingHints,
} from '../src/types/analysis'
import type { AstProviderStatusPayload } from '../src/providers/ast/AstProvider'
import type { MindMapSnapshot } from '../src/types/mindmap'
import type { AnalysisPromptContext } from '../src/types/promptContext'
import type { TranscriptSegment } from '../src/types/transcript'
import {
  BYTEDANCE_AST_SEGMENT_CHANNEL,
  BYTEDANCE_AST_STATUS_CHANNEL,
  BYTEDANCE_AST_TURN_CHANNEL,
  SEND_BYTEDANCE_AST_AUDIO_CHANNEL,
  SMOKE_TEST_BYTEDANCE_AST_CHANNEL,
  START_BYTEDANCE_AST_SESSION_CHANNEL,
  STOP_BYTEDANCE_AST_SESSION_CHANNEL,
} from './ast/channels'
import {
  ANALYZE_TRANSCRIPT_REALTIME_CHANNEL,
  ANSWER_INTERVIEW_QUESTION_CHANNEL,
  GENERATE_MEETING_MINUTES_CHANNEL,
  GENERATE_MEETING_SUMMARY_CHANNEL,
  GENERATE_SPEAKING_HINTS_CHANNEL,
  GENERATE_MIND_MAP_CHANNEL,
} from './llm/channels'

interface TranscriptRequest extends AnalysisPromptContext {
  segments: TranscriptSegment[]
}

interface InterviewQuestionRequest extends TranscriptRequest {
  question: string
}

type AnalyzeTranscriptRealtimeResult =
  | {
      ok: true
      bundle: PhaseConsensusAnalysisBundle
    }
  | {
      ok: false
      error: string
    }

type GenerateSpeakingHintsResult =
  | {
      ok: true
      hints: SpeakingHints
    }
  | {
      ok: false
      error: string
    }

type GenerateMindMapResult =
  | {
      ok: true
      snapshot: MindMapSnapshot
    }
  | {
      ok: false
      error: string
    }

type GenerateMeetingSummaryResult =
  | {
      ok: true
      summary: MeetingSummary
    }
  | {
      ok: false
      error: string
    }

type GenerateMeetingMinutesResult =
  | {
      ok: true
      minutes: MeetingMinutes
    }
  | {
      ok: false
      error: string
    }

type AnswerInterviewQuestionResult =
  | {
      ok: true
      answer: InterviewQaAnswer
    }
  | {
      ok: false
      error: string
    }

type SmokeTestByteDanceAstResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: string
    }

interface StartByteDanceAstSessionRequest {
  mode?: 's2t' | 's2s'
  sourceLanguage?: string
  targetLanguage?: string
}

type StartByteDanceAstSessionResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: string
    }

contextBridge.exposeInMainWorld('interviewCopilot', {
  platform: process.platform,
  analyzeTranscriptRealtime: (request: TranscriptRequest) =>
    ipcRenderer.invoke(
      ANALYZE_TRANSCRIPT_REALTIME_CHANNEL,
      request,
    ) as Promise<AnalyzeTranscriptRealtimeResult>,
  generateSpeakingHints: (request: TranscriptRequest) =>
    ipcRenderer.invoke(
      GENERATE_SPEAKING_HINTS_CHANNEL,
      request,
    ) as Promise<GenerateSpeakingHintsResult>,
  generateMindMap: (request: TranscriptRequest) =>
    ipcRenderer.invoke(
      GENERATE_MIND_MAP_CHANNEL,
      request,
    ) as Promise<GenerateMindMapResult>,
  generateMeetingSummary: (request: TranscriptRequest) =>
    ipcRenderer.invoke(
      GENERATE_MEETING_SUMMARY_CHANNEL,
      request,
    ) as Promise<GenerateMeetingSummaryResult>,
  generateMeetingMinutes: (request: TranscriptRequest) =>
    ipcRenderer.invoke(
      GENERATE_MEETING_MINUTES_CHANNEL,
      request,
    ) as Promise<GenerateMeetingMinutesResult>,
  answerInterviewQuestion: (request: InterviewQuestionRequest) =>
    ipcRenderer.invoke(
      ANSWER_INTERVIEW_QUESTION_CHANNEL,
      request,
    ) as Promise<AnswerInterviewQuestionResult>,
  smokeTestByteDanceAstConnection: (request?: {
    appId?: string
    accessToken?: string
    resourceId?: string
    wsUrl?: string
  }) =>
    ipcRenderer.invoke(
      SMOKE_TEST_BYTEDANCE_AST_CHANNEL,
      request,
    ) as Promise<SmokeTestByteDanceAstResult>,
  startByteDanceAstSession: (request: StartByteDanceAstSessionRequest) =>
    ipcRenderer.invoke(
      START_BYTEDANCE_AST_SESSION_CHANNEL,
      request,
    ) as Promise<StartByteDanceAstSessionResult>,
  sendByteDanceAstAudioChunk: (chunk: Uint8Array) => {
    ipcRenderer.send(SEND_BYTEDANCE_AST_AUDIO_CHANNEL, chunk)
  },
  stopByteDanceAstSession: () =>
    ipcRenderer.invoke(STOP_BYTEDANCE_AST_SESSION_CHANNEL) as Promise<void>,
  onByteDanceAstSegment: (listener: (segment: TranscriptSegment) => void) => {
    const handler = (_event: unknown, segment: TranscriptSegment) => {
      listener(segment)
    }

    ipcRenderer.on(BYTEDANCE_AST_SEGMENT_CHANNEL, handler)

    return () => {
      ipcRenderer.removeListener(BYTEDANCE_AST_SEGMENT_CHANNEL, handler)
    }
  },
  onByteDanceAstTurn: (listener: (segment: TranscriptSegment) => void) => {
    const handler = (_event: unknown, segment: TranscriptSegment) => {
      listener(segment)
    }

    ipcRenderer.on(BYTEDANCE_AST_TURN_CHANNEL, handler)

    return () => {
      ipcRenderer.removeListener(BYTEDANCE_AST_TURN_CHANNEL, handler)
    }
  },
  onByteDanceAstStatus: (
    listener: (payload: AstProviderStatusPayload) => void,
  ) => {
    const handler = (
      _event: unknown,
      payload: AstProviderStatusPayload,
    ) => {
      listener(payload)
    }

    ipcRenderer.on(BYTEDANCE_AST_STATUS_CHANNEL, handler)

    return () => {
      ipcRenderer.removeListener(BYTEDANCE_AST_STATUS_CHANNEL, handler)
    }
  },
})
