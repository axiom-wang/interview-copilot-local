import type { CodexConfig } from '../../../../../shared/meeting/types/desktopAnalysis'
import { RendererOpenAiLlmProvider } from './RendererOpenAiLlmProvider'

export class RendererCodexLlmProvider extends RendererOpenAiLlmProvider {
  readonly id = 'local-codex'
  readonly label = '本地 Codex'
  readonly automaticAnalysis = { intervalMs: 8000, finalOnly: true, singleFlight: true }

  constructor(config: CodexConfig) {
    super({ provider: 'codex', ...config })
  }
}
