import type { DesktopAnalysisConfig, DesktopProbeResult, DesktopTranscriptRequest } from '../../../shared/meeting/types/desktopAnalysis'
/// <reference types="vite/client" />

import type {
  InterviewQaAnswer,
  MeetingMinutes,
  MeetingSummary,
  PhaseConsensusAnalysisBundle,
  SpeakingHints,
} from '../../../shared/meeting/types/analysis'
import type { AstProviderStatusPayload } from '../../../shared/meeting/providers/ast/AstProvider'
import type { MindMapSnapshot } from '../../../shared/meeting/types/mindmap'
import type { AnalysisErrorResult } from '../../../shared/analysis/llm/analysisFailure'
import type { TranscriptSegment } from '../../../shared/meeting/types/transcript'

type TranscriptRequest = DesktopTranscriptRequest

interface InterviewQuestionRequest extends TranscriptRequest {
  question: string
}

type AnalyzeTranscriptRealtimeResult =
  | {
      ok: true
      bundle: PhaseConsensusAnalysisBundle
    }
  | AnalysisErrorResult

type GenerateSpeakingHintsResult =
  | {
      ok: true
      hints: SpeakingHints
    }
  | AnalysisErrorResult

type GenerateMindMapResult =
  | {
      ok: true
      snapshot: MindMapSnapshot
    }
  | AnalysisErrorResult

type GenerateMeetingSummaryResult =
  | {
      ok: true
      summary: MeetingSummary
    }
  | AnalysisErrorResult

type GenerateMeetingMinutesResult =
  | {
      ok: true
      minutes: MeetingMinutes
    }
  | AnalysisErrorResult

type AnswerInterviewQuestionResult =
  | {
      ok: true
      answer: InterviewQaAnswer
    }
  | AnalysisErrorResult

type SmokeTestVolcAsrResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: string
    }

interface StartVolcAsrSessionRequest {
  credentials?: {
    apiKey?: string
    resourceId?: string
    wsUrl?: string
  }
}

type StartVolcAsrSessionResult =
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
      resetAnalysisSession?: () => Promise<void>
      probeAnalysisConnection?: (config: DesktopAnalysisConfig) => Promise<DesktopProbeResult>
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
      smokeTestVolcAsrConnection?: (request?: {
        apiKey?: string
        resourceId?: string
        wsUrl?: string
      }) => Promise<SmokeTestVolcAsrResult>
      startVolcAsrSession?: (
        request: StartVolcAsrSessionRequest,
      ) => Promise<StartVolcAsrSessionResult>
      sendVolcAsrAudioChunk?: (chunk: Uint8Array) => void
      stopVolcAsrSession?: () => Promise<void>
      onVolcAsrSegment?: (
        listener: (segment: TranscriptSegment) => void,
      ) => () => void
      onVolcAsrStatus?: (
        listener: (payload: AstProviderStatusPayload) => void,
      ) => () => void
    }
  }
}

export {}
