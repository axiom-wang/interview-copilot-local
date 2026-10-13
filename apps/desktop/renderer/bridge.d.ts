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
