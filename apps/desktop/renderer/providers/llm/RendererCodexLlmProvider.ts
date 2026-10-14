import type { CodexConfig, DesktopAnalysisConfig } from '../../../../../shared/meeting/types/desktopAnalysis'
import { RendererOpenAiLlmProvider } from './RendererOpenAiLlmProvider'

export class RendererCodexLlmProvider extends RendererOpenAiLlmProvider {
  readonly id = 'local-codex'
  readonly automaticAnalysis = { intervalMs: 8000, finalOnly: true, singleFlight: true }

  constructor(config: CodexConfig, fallbackConfig?: DesktopAnalysisConfig, getSessionId?: () => string) {
    super({ provider: 'codex', ...config }, fallbackConfig, getSessionId)
  }
}
