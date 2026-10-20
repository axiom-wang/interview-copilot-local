import type { AnalysisRoutingMetadata, AnalysisSessionReset, DesktopAnalysisConfig, DesktopProbeResult, DesktopTranscriptRequest } from '../../../shared/meeting/types/desktopAnalysis'
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
import type { AnalysisErrorResult } from '../../../shared/analysis/llm/analysisFailure'
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
  PREWARM_ANALYSIS_CHANNEL,
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
      routing?: AnalysisRoutingMetadata
      bundle: PhaseConsensusAnalysisBundle
    }
  | AnalysisErrorResult

type GenerateSpeakingHintsResult =
  | {
      ok: true
      routing?: AnalysisRoutingMetadata
      hints: SpeakingHints
    }
  | AnalysisErrorResult

type GenerateMindMapResult =
  | {
      ok: true
      routing?: AnalysisRoutingMetadata
      snapshot: MindMapSnapshot
    }
  | AnalysisErrorResult

type GenerateMeetingSummaryResult =
  | {
      ok: true
      routing?: AnalysisRoutingMetadata
      summary: MeetingSummary
    }
  | AnalysisErrorResult

type GenerateMeetingMinutesResult =
  | {
      ok: true
      routing?: AnalysisRoutingMetadata
      minutes: MeetingMinutes
    }
  | AnalysisErrorResult

type AnswerInterviewQuestionResult =
  | {
      ok: true
      routing?: AnalysisRoutingMetadata
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
  resetAnalysisSession: (options?: AnalysisSessionReset) => ipcRenderer.invoke(RESET_ANALYSIS_CHANNEL, options) as Promise<void>,
  prewarmAnalysis: (request: { analysisConfig: DesktopAnalysisConfig; scenarioId?: string }) =>
    ipcRenderer.invoke(PREWARM_ANALYSIS_CHANNEL, request) as Promise<void>,
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
