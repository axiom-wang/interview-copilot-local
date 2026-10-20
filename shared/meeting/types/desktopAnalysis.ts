import type { AnalysisPromptContext } from './promptContext'
import type { TranscriptSegment } from './transcript'

export interface CodexConfig {
  executablePath: string
  model: string
}

export interface ClaudeConfig {
  executablePath: string
  model: string
}

export type DesktopAnalysisConfig =
  | { provider: 'api'; apiKey: string; model: string; baseURL: string }
  | ({ provider: 'codex' } & CodexConfig)
  | ({ provider: 'claude' } & ClaudeConfig)

export interface DesktopTranscriptRequest extends AnalysisPromptContext {
  segments: TranscriptSegment[]
  analysisConfig?: DesktopAnalysisConfig
  fallbackAnalysisConfig?: DesktopAnalysisConfig
  analysisSessionId?: string
}

export interface AnalysisRoutingMetadata {
  actualProvider?: DesktopAnalysisConfig['provider']
  fallbackReason?: string
  channelFailures?: Partial<Record<DesktopAnalysisConfig['provider'], string>>
}

export interface AnalysisSessionReset {
  preserveRouting?: boolean
  analysisSessionId?: string
}

export type DesktopProbeResult =
  | { ok: true; model: string; authMethod: string }
  | { ok: false; error: string }
