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
  let finishStartup: (() => void) | undefined
  let startup = new Promise<void>((resolve) => { finishStartup = resolve })
  let finishResume: (() => void) | undefined
  let resumeWait: Promise<void> | undefined
  let captureSignal: AbortSignal | undefined
  let failPause = false
  let emit: TranscriptSegmentCallback = () => {}
  const asked: { question: string; segments: TranscriptSegment[]; context?: AnalysisPromptContext }[] = []
  const provider = new MockLlmProvider()
  provider.answerInterviewQuestion = async (question, segments, context) => {
    asked.push({ question, segments, context })
    return {
      conclusion: '考察个人贡献', reasoning: [], suggestedReply: '我负责……', updatedAt: 1,
      interview: { questionType: 'behavioral', keyPoints: ['个人行动'], grounding: 'jd', missingContext: '缺少真实经历' },
    }
  }
  provider.detectPhase = async () => { throw new Error('qa scenarios must not run discussion analysis') }
  const prewarmed: (string | undefined)[] = []
  provider.prewarm = async (context) => { prewarmed.push(context?.scenarioId) }
  configureMeetingRuntime({
    environment: 'web', supportsCodex: false, supportsLiveAssist: true,
    createAstProvider: () => ({
      id: 'mock', label: 'mock', setCredentials: () => {},
      start: async (onSegment, _onStatus, options) => {
        assert.equal(options?.initiallyPaused, true)
        emit = onSegment; calls.push('start')
        await startup
      },
      pause: async () => { calls.push('pause'); if (failPause) throw new Error('pause failed') },
      resume: async (signal) => { captureSignal = signal; calls.push('resume'); await resumeWait },
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
  const starting = useAppStore.getState().startStream()
  await useAppStore.getState().startQuestionCapture()
  assert.ok(!calls.includes('resume'), 'capture cannot race provider initialization')
  finishStartup?.()
  await starting
  startup = Promise.resolve()
  assert.deepEqual(calls, ['stop', 'start'])
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

  assert.deepEqual(calls, ['stop', 'start', 'resume', 'pause'])
  assert.equal(captureSignal?.aborted, true)
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

  resumeWait = new Promise<void>((resolve) => { finishResume = resolve })
  const connecting = useAppStore.getState().startQuestionCapture()
  emit(segment('q4', '连接很慢时的问题', true))
  const released = useAppStore.getState().finishQuestionCapture()
  assert.equal(captureSignal?.aborted, true, 'release stops audio before the recognizer has connected')
  finishResume?.()
  await connecting
  await released
  resumeWait = undefined
  assert.equal(asked.at(-1)?.question, '连接很慢时的问题')

  for (let index = 0; index < 7; index++) {
    await useAppStore.getState().askAiQuestion(`手动问题 ${index}`)
  }
  assert.equal(useAppStore.getState().aiQaHistory.length, 10, 'qa history retains the whole session')
  await useAppStore.getState().stopStream()
  const { loadSessions } = await import('../shared/meeting/services/sessionStore')
  const saved = loadSessions().find((session) => session.id === useAppStore.getState().currentSessionId)
  assert.deepEqual(saved?.aiQaHistory, JSON.parse(JSON.stringify(useAppStore.getState().aiQaHistory)))

  useAppStore.getState().startNewMeeting()
  useAppStore.setState({ scenarioId: 'one-on-one-interview', questionContext: '岗位 JD' })
  await useAppStore.getState().startStream()
  await useAppStore.getState().askAiQuestion('纯文字提问')
  assert.equal(useAppStore.getState().liveSegments.length, 0)
  await useAppStore.getState().stopStream()
  const typed = loadSessions().find((session) => session.id === useAppStore.getState().currentSessionId)
  assert.equal(typed?.aiQaHistory?.[0].question, '纯文字提问')
  useAppStore.getState().clearAiQaHistory()
  assert.deepEqual(loadSessions().find((session) => session.id === typed?.id)?.aiQaHistory, [])

  useAppStore.getState().startNewMeeting()
  useAppStore.setState({ scenarioId: 'one-on-one-interview', questionContext: '岗位 JD' })
  await useAppStore.getState().startStream()
  await useAppStore.getState().startQuestionCapture()
  emit(segment('failed-pause', '暂停出错时的问题', true))
  failPause = true
  await useAppStore.getState().finishQuestionCapture()
  assert.equal(useAppStore.getState().isStreaming, false)
  assert.ok(useAppStore.getState().currentSessionEndedAt)
  assert.match(useAppStore.getState().aiQaError ?? '', /pause failed/)
  assert.ok(loadSessions().some((session) => session.id === useAppStore.getState().currentSessionId))
})
