import assert from 'node:assert/strict'
import test from 'node:test'
import { loadModelSettings, saveModelSettings } from '../shared/meeting/settings/settingsStore'
import { DEFAULT_LLM_SETTINGS, isLlmConfigured, toDesktopAnalysisConfig, toDesktopFallbackConfig } from '../shared/meeting/settings/types'
import { RendererCodexLlmProvider } from '../apps/desktop/renderer/providers/llm/RendererCodexLlmProvider'
import { RendererOpenAiLlmProvider } from '../apps/desktop/renderer/providers/llm/RendererOpenAiLlmProvider'
import { HttpOpenAiLlmProvider } from '../apps/web/providers/llm/HttpOpenAiLlmProvider'

test('legacy settings remain on API; switching providers preserves both configurations', (t) => {
  const memory = new Map<string, string>()
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  } })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  })
  memory.set('meeting-assistant/model-settings/test-user', JSON.stringify({
    llm: { apiKey: 'old-key', model: 'old-model', baseURL: 'https://example.com/v1/' },
  }))
  const settings = loadModelSettings('test-user')
  assert.equal(settings.llm.provider, 'api')
  assert.equal(settings.llm.autoFallbackEnabled, true)
  assert.equal(settings.llm.apiKey, 'old-key')
  assert.equal(settings.llm.baseURL, 'https://example.com/v1')
  settings.llm.provider = 'codex'
  settings.llm.codex = { executablePath: '/usr/local/bin/codex', model: 'my-codex-model' }
  settings.llm.autoFallbackEnabled = false
  saveModelSettings('test-user', settings)
  const reloaded = loadModelSettings('test-user')
  assert.equal(reloaded.llm.provider, 'codex')
  assert.equal(reloaded.llm.autoFallbackEnabled, false)
  assert.equal(reloaded.llm.apiKey, 'old-key')
  assert.equal(toDesktopAnalysisConfig(reloaded.llm).provider, 'codex')
  assert.ok(!('apiKey' in toDesktopAnalysisConfig(reloaded.llm)))
  reloaded.llm.provider = 'api'
  assert.deepEqual(toDesktopAnalysisConfig(reloaded.llm), {
    provider: 'api', apiKey: 'old-key', model: 'old-model', baseURL: 'https://example.com/v1',
  })
})

test('Codex requires the desktop bridge, API still requires its key and model', () => {
  assert.equal(isLlmConfigured(DEFAULT_LLM_SETTINGS, true), false)
  assert.equal(isLlmConfigured({ ...DEFAULT_LLM_SETTINGS, provider: 'codex' }, true), true)
  assert.equal(isLlmConfigured({ ...DEFAULT_LLM_SETTINGS, provider: 'codex' }, false), false)
  assert.equal(isLlmConfigured({ ...DEFAULT_LLM_SETTINGS, apiKey: 'my-key' }, false), true)
})

test('desktop requests carry the selected channel; repeated phase/consensus shares work and text corrections invalidate the cache', async (t) => {
  const requests: Array<Record<string, unknown>> = []
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { interviewCopilot: {
    analyzeTranscriptRealtime: async (request: Record<string, unknown>) => {
      requests.push(request)
      return { ok: true, bundle: { phaseAnalysis: { phase: 'problem-framing' }, consensusAnalysis: { consensus: [] } } }
    },
  } } })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else Reflect.deleteProperty(globalThis, 'window')
  })
  const codex = new RendererCodexLlmProvider({ executablePath: '', model: '' })
  const segments = [{ id: '1', speaker: 'A', timestamp: 100, text: '初始内容', isFinal: true }]
  await Promise.all([codex.detectPhase(segments), codex.extractConsensusAndTensions(segments)])
  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0].analysisConfig, { provider: 'codex', executablePath: '', model: '' })
  await codex.detectPhase([{ ...segments[0], text: '修正内容' }])
  assert.equal(requests.length, 2)
  const api = new RendererOpenAiLlmProvider({ provider: 'api', apiKey: 'user-key', model: 'user-model', baseURL: 'https://example.com/v1' })
  await api.detectPhase(segments)
  assert.deepEqual(requests[2].analysisConfig, { provider: 'api', apiKey: 'user-key', model: 'user-model', baseURL: 'https://example.com/v1' })
  await api.detectPhase([{ ...segments[0], speaker: 'B' }])
  assert.equal(requests.length, 4)
})

test('web analysis repeats when text, finality, or speaker changes', async (t) => {
  const bodies: Array<{ segments: Array<{ text: string; isFinal: boolean; speaker: string }> }> = []
  const previous = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)) as { segments: Array<{ text: string; isFinal: boolean; speaker: string }> })
    return new Response(JSON.stringify({
      ok: true,
      bundle: { phaseAnalysis: { phase: 'problem-framing' }, consensusAnalysis: { consensus: [] } },
    }))
  }
  t.after(() => { globalThis.fetch = previous })
  const provider = new HttpOpenAiLlmProvider()
  provider.setModelConfig({ apiKey: 'user-key', model: 'user-model', baseURL: 'https://api.openai.com/v1' })
  const segments = [{ id: '1', speaker: 'A', timestamp: 100, text: '初始内容', isFinal: false }]
  await Promise.all([provider.detectPhase(segments), provider.extractConsensusAndTensions(segments)])
  assert.equal(bodies.length, 1)
  await provider.detectPhase([{ ...segments[0], text: '修正内容' }])
  await provider.detectPhase([{ ...segments[0], text: '修正内容', isFinal: true }])
  await provider.detectPhase([{ ...segments[0], text: '修正内容', isFinal: true, speaker: 'B' }])
  assert.equal(bodies.length, 4)
  assert.equal(bodies[3]?.segments[0]?.speaker, 'B')
})


test('fallback configuration uses the other channel without changing the preferred setting', () => {
  const settings = { ...DEFAULT_LLM_SETTINGS, apiKey: 'user-key' }
  assert.equal(toDesktopFallbackConfig(settings)?.provider, 'codex')
  assert.deepEqual(toDesktopFallbackConfig({ ...settings, provider: 'codex' }), {
    provider: 'api', apiKey: 'user-key', model: settings.model, baseURL: settings.baseURL,
  })
  assert.equal(toDesktopFallbackConfig({ ...settings, autoFallbackEnabled: false }), undefined)
  assert.equal(settings.provider, 'api')
})

test('renderer shares fallback work and ignores metadata from a prior analysis session', async (t) => {
  type Result = { ok: true; bundle: { phaseAnalysis: { phase: string }; consensusAnalysis: { consensus: string[] } }; routing: { actualProvider: 'api' | 'codex'; fallbackReason?: string } }
  const requests: Array<Record<string, unknown>> = []
  const pending: Array<(result: Result) => void> = []
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { interviewCopilot: {
    analyzeTranscriptRealtime: (input: Record<string, unknown>) => {
      requests.push(input)
      return new Promise<Result>((resolve) => pending.push(resolve))
    },
  } } })
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window') })
  let sessionId = 'first'
  const backup = { provider: 'api' as const, apiKey: 'key', model: 'model', baseURL: 'https://example.com/v1' }
  const provider = new RendererCodexLlmProvider({ executablePath: '', model: '' }, backup, () => sessionId)
  const segments = [{ id: 'a', speaker: 'A', text: '预算', timestamp: 1000, isFinal: true }]
  const oldPhase = provider.detectPhase(segments)
  const oldConsensus = provider.extractConsensusAndTensions(segments)
  const old = Promise.allSettled([oldPhase, oldConsensus])
  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0].fallbackAnalysisConfig, backup)
  assert.equal(requests[0].analysisSessionId, 'first')
  provider.resetSession()
  sessionId = 'second'
  const current = provider.detectPhase(segments)
  const bundle = { phaseAnalysis: { phase: 'decision-lock' }, consensusAnalysis: { consensus: [] } }
  pending[1]({ ok: true, bundle, routing: { actualProvider: 'codex' } })
  await current
  pending[0]({ ok: true, bundle, routing: { actualProvider: 'api', fallbackReason: 'old fallback' } })
  assert.deepEqual((await old).map((result) => result.status), ['rejected', 'rejected'])
  assert.equal(provider.label, '本地 Codex')
  assert.equal(provider.warning, undefined)
  await provider.detectPhase(segments)
  assert.equal(requests.length, 2)
  provider.resetSession()
  const switched = provider.detectPhase(segments)
  pending[2]({ ok: true, bundle, routing: { actualProvider: 'api', fallbackReason: 'switched' } })
  await switched
  assert.equal(provider.label, 'OpenAI Responses')
  assert.equal(provider.warning, 'switched')
  provider.resetSession(true)
  assert.equal(provider.label, 'OpenAI Responses')
  provider.resetSession()
  assert.equal(provider.label, '本地 Codex')
})
