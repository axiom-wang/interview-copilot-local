import type { MeetingRuntime } from '../../../shared/ui/runtime'
import { MockAuthProvider } from '../../../shared/ui/auth/MockAuthProvider'
import { toDesktopAnalysisConfig } from '../../../shared/meeting/settings/types'
import { RendererVolcAsrProvider } from './providers/ast/RendererVolcAsrProvider'
import { RendererOpenAiLlmProvider } from './providers/llm/RendererOpenAiLlmProvider'
import { RendererCodexLlmProvider } from './providers/llm/RendererCodexLlmProvider'

export const createDesktopRuntime = (): MeetingRuntime => ({
  environment: 'electron',
  supportsCodex: Boolean(window.interviewCopilot?.probeAnalysisConnection),
  supportsLiveAssist: Boolean(window.interviewCopilot),
  createAstProvider: () => new RendererVolcAsrProvider(),
  createLlmProvider: (settings) => settings.provider === 'codex'
    ? new RendererCodexLlmProvider(settings.codex)
    : new RendererOpenAiLlmProvider(toDesktopAnalysisConfig(settings)),
  createAuthProvider: () => new MockAuthProvider(),
  probeAstConnection: async (settings) => {
    const probe = window.interviewCopilot?.smokeTestVolcAsrConnection
    if (!probe) throw new Error('桌面转写桥接不可用，请重新打开桌面版。')
    const result = await probe(settings)
    if (!result.ok) throw new Error(result.error)
  },
  probeLlmConnection: async (settings) => {
    const probe = window.interviewCopilot?.probeAnalysisConnection
    if (!probe) throw new Error('桌面分析桥接不可用，请重新打开桌面版。')
    const result = await probe(toDesktopAnalysisConfig(settings))
    if (!result.ok) throw new Error(result.error)
    return result
  },
  resetAnalysisSession: async () => { await window.interviewCopilot?.resetAnalysisSession?.() },
})
