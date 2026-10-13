import type { DesktopAnalysisConfig, DesktopProbeResult, DesktopTranscriptRequest } from '../../../shared/meeting/types/desktopAnalysis'
import { contextBridge, ipcRenderer } from 'electron'
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
import {
  VOLC_ASR_SEGMENT_CHANNEL,
  VOLC_ASR_STATUS_CHANNEL,
  SEND_VOLC_ASR_AUDIO_CHANNEL,
  SMOKE_TEST_VOLC_ASR_CHANNEL,
  START_VOLC_ASR_SESSION_CHANNEL,
  STOP_VOLC_ASR_SESSION_CHANNEL,
} from './ast/channels'
import {
  RESET_ANALYSIS_CHANNEL,
  PROBE_ANALYSIS_CHANNEL,
  ANALYZE_TRANSCRIPT_REALTIME_CHANNEL,
  ANSWER_INTERVIEW_QUESTION_CHANNEL,
  GENERATE_MEETING_MINUTES_CHANNEL,
  GENERATE_MEETING_SUMMARY_CHANNEL,
  GENERATE_SPEAKING_HINTS_CHANNEL,
  GENERATE_MIND_MAP_CHANNEL,
} from './llm/channels'

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

type StartVolcAsrSessionRequest = {
  credentials?: { apiKey?: string; resourceId?: string; wsUrl?: string }
}

type StartVolcAsrSessionResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: string
    }

contextBridge.exposeInMainWorld('interviewCopilot', {
  platform: process.platform,
  resetAnalysisSession: () => ipcRenderer.invoke(RESET_ANALYSIS_CHANNEL) as Promise<void>,
  probeAnalysisConnection: (config: DesktopAnalysisConfig) =>
    ipcRenderer.invoke(PROBE_ANALYSIS_CHANNEL, config) as Promise<DesktopProbeResult>,
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
  smokeTestVolcAsrConnection: (request?: {
    apiKey?: string
    resourceId?: string
    wsUrl?: string
  }) =>
    ipcRenderer.invoke(
      SMOKE_TEST_VOLC_ASR_CHANNEL,
      request,
    ) as Promise<SmokeTestVolcAsrResult>,
  startVolcAsrSession: (request: StartVolcAsrSessionRequest) =>
    ipcRenderer.invoke(
      START_VOLC_ASR_SESSION_CHANNEL,
      request,
    ) as Promise<StartVolcAsrSessionResult>,
  sendVolcAsrAudioChunk: (chunk: Uint8Array) => {
    ipcRenderer.send(SEND_VOLC_ASR_AUDIO_CHANNEL, chunk)
  },
  stopVolcAsrSession: () =>
    ipcRenderer.invoke(STOP_VOLC_ASR_SESSION_CHANNEL) as Promise<void>,
  onVolcAsrSegment: (listener: (segment: TranscriptSegment) => void) => {
    const handler = (_event: unknown, segment: TranscriptSegment) => {
      listener(segment)
    }

    ipcRenderer.on(VOLC_ASR_SEGMENT_CHANNEL, handler)

    return () => {
      ipcRenderer.removeListener(VOLC_ASR_SEGMENT_CHANNEL, handler)
    }
  },
  onVolcAsrStatus: (
    listener: (payload: AstProviderStatusPayload) => void,
  ) => {
    const handler = (
      _event: unknown,
      payload: AstProviderStatusPayload,
    ) => {
      listener(payload)
    }

    ipcRenderer.on(VOLC_ASR_STATUS_CHANNEL, handler)

    return () => {
      ipcRenderer.removeListener(VOLC_ASR_STATUS_CHANNEL, handler)
    }
  },
})
