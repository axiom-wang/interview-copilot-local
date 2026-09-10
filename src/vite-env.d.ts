/// <reference types="vite/client" />

import type {
  InterviewQaAnswer,
  MeetingMinutes,
  MeetingSummary,
  PhaseConsensusAnalysisBundle,
  SpeakingHints,
} from './types/analysis'
import type { AstProviderStatusPayload } from './providers/ast/AstProvider'
import type { MindMapSnapshot } from './types/mindmap'
import type { AnalysisPromptContext } from './types/promptContext'
import type { TranscriptSegment } from './types/transcript'

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
  credentials?: {
    appId?: string
    accessToken?: string
    resourceId?: string
    wsUrl?: string
  }
}

type StartByteDanceAstSessionResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: string
    }

declare global {
  interface ImportMetaEnv {
    readonly VITE_REALTIME_WS_URL?: string
    readonly VITE_FORCE_MOCK_AUTH?: string
  }

  interface Window {
    interviewCopilot?: {
      platform: string
      analyzeTranscriptRealtime?: (
        request: TranscriptRequest,
      ) => Promise<AnalyzeTranscriptRealtimeResult>
      generateSpeakingHints?: (
        request: TranscriptRequest,
      ) => Promise<GenerateSpeakingHintsResult>
      generateMindMap?: (
        request: TranscriptRequest,
      ) => Promise<GenerateMindMapResult>
      generateMeetingSummary?: (
        request: TranscriptRequest,
      ) => Promise<GenerateMeetingSummaryResult>
      generateMeetingMinutes?: (
        request: TranscriptRequest,
      ) => Promise<GenerateMeetingMinutesResult>
      answerInterviewQuestion?: (
        request: InterviewQuestionRequest,
      ) => Promise<AnswerInterviewQuestionResult>
      smokeTestByteDanceAstConnection?: (request?: {
        appId?: string
        accessToken?: string
        resourceId?: string
        wsUrl?: string
      }) => Promise<SmokeTestByteDanceAstResult>
      startByteDanceAstSession?: (
        request: StartByteDanceAstSessionRequest,
      ) => Promise<StartByteDanceAstSessionResult>
      sendByteDanceAstAudioChunk?: (chunk: Uint8Array) => void
      stopByteDanceAstSession?: () => Promise<void>
      onByteDanceAstSegment?: (
        listener: (segment: TranscriptSegment) => void,
      ) => () => void
      onByteDanceAstTurn?: (
        listener: (segment: TranscriptSegment) => void,
      ) => () => void
      onByteDanceAstStatus?: (
        listener: (payload: AstProviderStatusPayload) => void,
      ) => () => void
    }
  }
}

export {}
