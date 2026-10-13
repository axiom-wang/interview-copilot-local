import type { AnalysisPromptContext } from './promptContext'
import type { TranscriptSegment } from './transcript'

export interface CodexConfig {
  executablePath: string
  model: string
}

export type DesktopAnalysisConfig =
  | { provider: 'api'; apiKey: string; model: string; baseURL: string }
  | ({ provider: 'codex' } & CodexConfig)

export interface DesktopTranscriptRequest extends AnalysisPromptContext {
  segments: TranscriptSegment[]
  analysisConfig?: DesktopAnalysisConfig
}

export type DesktopProbeResult =
  | { ok: true; model: string; authMethod: string }
  | { ok: false; error: string }
