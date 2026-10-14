import assert from 'node:assert/strict'
import test from 'node:test'
import { configureMeetingRuntime } from '../shared/ui/runtime'
import { MockLlmProvider } from '../shared/meeting/providers/llm/MockLlmProvider'
import { MockAuthProvider } from '../shared/ui/auth/MockAuthProvider'
import type { TranscriptSegment } from '../shared/meeting/types/transcript'

const QUESTION_KEY = 'interview-copilot-local/question-context'
const DRAFT_KEY = 'interview-copilot-local/question-context-draft'

const segment: TranscriptSegment = {
  id: 's0', speaker: 'A', text: '先比较商品甲和商品乙。', timestamp: 1_000, isFinal: true,
}

test('a prepared question survives refresh, and a finished meeting does not seed the next one', async (t) => {
  const storage = new Map<string, string>()
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    setTimeout, clearTimeout,
  } })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else Reflect.deleteProperty(globalThis, 'window')
  })
  configureMeetingRuntime({
    environment: 'web', supportsCodex: false, supportsLiveAssist: true,
    createAstProvider: () => ({ id: 'mock', label: 'mock', setCredentials: () => {}, start: async () => {}, stop: () => {} }),
    createLlmProvider: () => new MockLlmProvider(),
    createAuthProvider: () => new MockAuthProvider(),
    probeAstConnection: async () => {},
    probeLlmConnection: async () => ({ model: 'mock' }),
    resetAnalysisSession: async () => {},
  })
  const { useAppStore } = await import('../shared/ui/store/useAppStore')

  useAppStore.setState({
    questionContextDraft: '预算限定为八万元。',
    questionContext: '',
    currentSessionEndedAt: null,
  })
  useAppStore.getState().applyQuestionContext()
  assert.equal(storage.get(QUESTION_KEY), '预算限定为八万元。')
  assert.equal(storage.get(DRAFT_KEY), '1')

  useAppStore.setState({ questionContext: '', questionContextDraft: '' })
  useAppStore.getState().initialize()
  assert.equal(useAppStore.getState().questionContext, '预算限定为八万元。')
  assert.equal(useAppStore.getState().questionContextDraft, '预算限定为八万元。')

  useAppStore.setState({
    isStreaming: true,
    currentSessionId: 'tet-round-1',
    currentSessionStartedAt: 1_000,
    currentSessionEndedAt: null,
    liveSegments: [segment],
    questionContext: '预算限定为八万元。',
    questionContextDraft: '预算限定为八万元。',
  })
  await useAppStore.getState().stopStream()
  const finished = useAppStore.getState().savedSessions.find((session) => session.id === 'tet-round-1')
  assert.equal(finished?.questionContext, '预算限定为八万元。')
  assert.equal(useAppStore.getState().questionContext, '预算限定为八万元。')
  assert.equal(storage.get(QUESTION_KEY), undefined)
  assert.equal(storage.get(DRAFT_KEY), undefined)

  useAppStore.getState().startNewMeeting()
  assert.equal(useAppStore.getState().questionContext, '')
  assert.equal(useAppStore.getState().questionContextDraft, '')
  assert.equal(useAppStore.getState().savedSessions.find((session) => session.id === 'tet-round-1')?.questionContext, '预算限定为八万元。')

  storage.set(QUESTION_KEY, '预算限定为八万元。')
  useAppStore.getState().initialize()
  assert.equal(useAppStore.getState().questionContext, '')
  assert.equal(storage.has(QUESTION_KEY), false)
})
