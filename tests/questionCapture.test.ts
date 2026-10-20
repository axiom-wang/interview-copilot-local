import assert from 'node:assert/strict'
import test from 'node:test'
import { configureMeetingRuntime } from '../shared/ui/runtime'
import { MockLlmProvider } from '../shared/meeting/providers/llm/MockLlmProvider'
import { MockAuthProvider } from '../shared/ui/auth/MockAuthProvider'
import type { TranscriptSegmentCallback } from '../shared/meeting/providers/ast/AstProvider'
import type { AnalysisPromptContext } from '../shared/meeting/types/promptContext'
import type { TranscriptSegment } from '../shared/meeting/types/transcript'

const segment = (id: string, text: string, isFinal: boolean): TranscriptSegment => ({
  id, speaker: 'S1', text, timestamp: Date.now(), isFinal, source: 'ast',
})

test('qa scenarios only listen while the capture key is held and answer the captured question', async (t) => {
  const storage = new Map<string, string>()
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    setTimeout, clearTimeout,
  } })
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window') })

  const calls: string[] = []
  let emit: TranscriptSegmentCallback = () => {}
  const asked: { question: string; segments: TranscriptSegment[]; context?: AnalysisPromptContext }[] = []
  const provider = new MockLlmProvider()
  provider.answerInterviewQuestion = async (question, segments, context) => {
    asked.push({ question, segments, context })
    return { conclusion: '考察个人贡献', reasoning: [], suggestedReply: '我负责……', updatedAt: 1 }
  }
  provider.detectPhase = async () => { throw new Error('qa scenarios must not run discussion analysis') }
  const prewarmed: (string | undefined)[] = []
  provider.prewarm = async (context) => { prewarmed.push(context?.scenarioId) }
  configureMeetingRuntime({
    environment: 'web', supportsCodex: false, supportsLiveAssist: true,
    createAstProvider: () => ({
      id: 'mock', label: 'mock', setCredentials: () => {},
      start: async (onSegment) => { emit = onSegment; calls.push('start') },
      pause: async () => { calls.push('pause') },
      resume: async () => { calls.push('resume') },
      stop: () => { calls.push('stop') },
    }),
    createLlmProvider: () => provider, createAuthProvider: () => new MockAuthProvider(),
    probeAstConnection: async () => {}, probeLlmConnection: async () => ({ model: 'mock' }), resetAnalysisSession: async () => {},
  })
  const { useSettingsStore } = await import('../shared/ui/store/useSettingsStore')
  const { useAppStore } = await import('../shared/ui/store/useAppStore')
  useSettingsStore.setState({ hasAstConfig: () => true, hasLlmConfig: () => true })
  useAppStore.setState({ supportsLiveAssist: true, scenarioId: 'one-on-one-interview', questionContext: '' })

  await useAppStore.getState().startStream()
  assert.match(useAppStore.getState().errorMessage ?? '', /岗位与 JD/)
  assert.deepEqual(calls, [])

  useAppStore.setState({ questionContext: '岗位：增长产品经理', errorMessage: null })
  useAppStore.getState().applyModelSettings(useSettingsStore.getState().settings)
  await useAppStore.getState().startStream()
  assert.deepEqual(calls, ['stop', 'start', 'pause'])
  assert.equal(useAppStore.getState().listeningStatusLabel, '待提问')
  assert.deepEqual(prewarmed, ['one-on-one-interview'])

  emit(segment('ambient', '旁边的人在聊天', true))
  assert.equal(useAppStore.getState().liveSegments.length, 0)

  await useAppStore.getState().startQuestionCapture()
  assert.equal(useAppStore.getState().questionCapture, 'recording')
  emit(segment('q1', '说说你最有挑战', false))
  emit(segment('q1', '说说你最有挑战的项目，', true))
  emit(segment('q2', '你具体负责什么？', true))
  await useAppStore.getState().finishQuestionCapture()

  assert.deepEqual(calls, ['stop', 'start', 'pause', 'resume', 'pause'])
  assert.equal(useAppStore.getState().questionCapture, 'idle')
  assert.equal(asked.length, 1)
  assert.equal(asked[0].question, '说说你最有挑战的项目，你具体负责什么？')
  assert.equal(asked[0].context?.questionContext, '岗位：增长产品经理')
  assert.ok(asked[0].segments.every((item) => item.speaker === '面试官'))
  const turn = useAppStore.getState().aiQaHistory[0]
  assert.equal(turn.question, '说说你最有挑战的项目，你具体负责什么？')
  assert.ok((turn.timing?.recognitionMs ?? 0) < 300, 'all-final captures do not wait out the settle window')
  assert.equal(typeof turn.timing?.answerMs, 'number')

  await useAppStore.getState().startQuestionCapture()
  emit(segment('q3', '还有什么想问我们的', false))
  await useAppStore.getState().finishQuestionCapture()
  assert.equal(asked.length, 2)
  assert.equal(asked[1].question, '还有什么想问我们的')
  assert.ok((useAppStore.getState().aiQaHistory[0].timing?.recognitionMs ?? 0) >= 300, 'a pending partial result waits for the settle window')

  await useAppStore.getState().startQuestionCapture()
  await useAppStore.getState().finishQuestionCapture()
  assert.equal(asked.length, 2)
  assert.match(useAppStore.getState().aiQaError ?? '', /没有识别到问题/)
})
