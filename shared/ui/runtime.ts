import type { AstProvider } from '../meeting/providers/ast/AstProvider'
import type { LlmProvider } from '../meeting/providers/llm/LlmProvider'
import type { AstModelSettings, LlmModelSettings } from '../meeting/settings/types'
import type { AuthProvider } from './auth/AuthProvider'

export interface ConfiguredAstProvider extends AstProvider {
  setCredentials: (config: AstModelSettings) => void
}

export interface MeetingRuntime {
  environment: 'electron' | 'web'
  supportsCodex: boolean
  supportsLiveAssist: boolean
  createAstProvider: () => ConfiguredAstProvider
  createLlmProvider: (settings: LlmModelSettings) => LlmProvider
  createAuthProvider: () => AuthProvider
  probeAstConnection: (settings: AstModelSettings) => Promise<void>
  probeLlmConnection: (settings: LlmModelSettings) => Promise<{ model: string; authMethod?: string }>
  resetAnalysisSession: () => Promise<void>
}

let runtime: MeetingRuntime | null = null

export const configureMeetingRuntime = (value: MeetingRuntime) => {
  runtime = value
}

export const getMeetingRuntime = (): MeetingRuntime => {
  if (!runtime) throw new Error('请通过桌面版或网页版入口启动会议助手。')
  return runtime
}
