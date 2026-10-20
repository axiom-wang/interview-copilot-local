import type { MeetingRuntime } from '../../shared/ui/runtime'
import { MockAuthProvider } from '../../shared/ui/auth/MockAuthProvider'
import { NetlifyIdentityAuthProvider } from './auth/NetlifyIdentityAuthProvider'
import { UnavailableLlmProvider } from '../../shared/meeting/providers/llm/UnavailableLlmProvider'
import { HttpOpenAiLlmProvider } from './providers/llm/HttpOpenAiLlmProvider'
import { RemoteVolcAsrProvider } from './providers/ast/RemoteVolcAsrProvider'

export const createWebRuntime = (): MeetingRuntime => {
  const wsUrl = import.meta.env.VITE_REALTIME_WS_URL?.trim() ?? ''
  return {
    environment: 'web', supportsCodex: false, supportsLiveAssist: Boolean(wsUrl),
    createAstProvider: () => new RemoteVolcAsrProvider(wsUrl),
    createLlmProvider: (settings) => {
      if (settings.provider !== 'api') return new UnavailableLlmProvider()
      const provider = new HttpOpenAiLlmProvider()
      provider.setModelConfig(settings)
      return provider
    },
    createAuthProvider: () => import.meta.env.DEV || import.meta.env.VITE_FORCE_MOCK_AUTH === 'true'
      ? new MockAuthProvider() : new NetlifyIdentityAuthProvider(),
    probeAstConnection: async (settings) => {
      const response = await fetch('/api/ast/probe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
      })
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!response.ok || !result?.ok) throw new Error(result?.error || `语音转写连接测试失败（${response.status}）。`)
    },
    probeLlmConnection: async (settings) => {
      if (settings.provider !== 'api') throw new Error('本地 Codex / Claude 通道仅在桌面版可用。')
      const provider = new HttpOpenAiLlmProvider()
      provider.setModelConfig(settings)
      return provider.probeConnection()
    },
    resetAnalysisSession: async () => {},
  }
}
