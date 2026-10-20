import type { ClaudeConfig, DesktopAnalysisConfig } from '../../../../../shared/meeting/types/desktopAnalysis'
import { RendererOpenAiLlmProvider } from './RendererOpenAiLlmProvider'

export class RendererClaudeLlmProvider extends RendererOpenAiLlmProvider {
  readonly id = 'local-claude'
  readonly automaticAnalysis = { intervalMs: 8000, finalOnly: true, singleFlight: true }

  constructor(config: ClaudeConfig, fallbackConfig?: DesktopAnalysisConfig, getSessionId?: () => string) {
    super({ provider: 'claude', ...config }, fallbackConfig, getSessionId)
  }
}
