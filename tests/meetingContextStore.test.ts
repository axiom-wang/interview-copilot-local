import assert from 'node:assert/strict'
import test from 'node:test'
import { configureMeetingRuntime } from '../shared/ui/runtime'
import { MockLlmProvider } from '../shared/meeting/providers/llm/MockLlmProvider'
import { MockAuthProvider } from '../shared/ui/auth/MockAuthProvider'
import type { ConsensusAnalysis } from '../shared/meeting/types/analysis'
import type { AnalysisPromptContext } from '../shared/meeting/types/promptContext'
import type { TranscriptSegment } from '../shared/meeting/types/transcript'

const input: TranscriptSegment[] = Array.from({ length: 60 }, (_, i) => ({
  id: `s${i}`, speaker: 'A', text: i === 0 ? '最初的预算约束' : '后续发言', timestamp: i * 60_000, isFinal: true,
}))

test('store forwards full meeting and AI-only prior view, saves memory once, and ignores late results after a new meeting', async (t) => {
  const storage = new Map<string, string>()
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    setTimeout, clearTimeout,
  } })
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window') })
  let received: TranscriptSegment[] = []
  let receivedContext: AnalysisPromptContext | undefined
  let finish: ((value: ConsensusAnalysis) => void) | undefined
  const provider = new MockLlmProvider()
  provider.answerInterviewQuestion = async (_question, segments, context) => {
    received = segments
    receivedContext = context
    return { conclusion: '检查原话', reasoning: [], suggestedReply: '请核对', updatedAt: 1 }
  }
  provider.extractConsensusAndTensions = async () => new Promise((resolve) => { finish = resolve })
  configureMeetingRuntime({
    environment: 'web', supportsCodex: false, supportsLiveAssist: true,
    createAstProvider: () => ({ id: 'mock', label: 'mock', setCredentials: () => {}, start: async () => {}, stop: () => {} }),
    createLlmProvider: () => provider, createAuthProvider: () => new MockAuthProvider(),
    probeAstConnection: async () => {}, probeLlmConnection: async () => ({ model: 'mock' }), resetAnalysisSession: async () => {},
  })
  const { useAppStore } = await import('../shared/ui/store/useAppStore')
  const priorView = { understanding: '待确认', intent: 'clarify' as const, contribution: '预算口径是什么？', reason: '有疑问', evidenceIds: ['s0'] }
  useAppStore.setState({ liveSegments: input, aiQuestionDraft: '最初的预算约束是什么？',
    currentSessionId: 'context-store-test', currentSessionStartedAt: 0, isStreaming: false,
    consensusAnalysis: { consensus: [], tensions: [], missing: [], updatedAt: 0, participantView: priorView },
  })
  await useAppStore.getState().askAiQuestion()
  assert.equal(received.length, 60)
  assert.equal(received[0].text, '最初的预算约束')
  assert.deepEqual(receivedContext?.previousParticipantView, priorView)
  assert.ok(!receivedContext?.summaryAssemblyContext?.consensus?.includes(priorView.contribution))

  const first = useAppStore.getState().refreshAnalysis()
  assert.ok(finish)
  finish({ consensus: [], tensions: [], missing: [], updatedAt: 1, meetingMemory: { version: 1, chunks: [] }, participantView: priorView })
  await first
  useAppStore.getState().saveCurrentSession()
  const saved = useAppStore.getState().savedSessions.find((s) => s.id === 'context-store-test')!
  assert.deepEqual(saved.meetingMemory, { version: 1, chunks: [] })
  assert.equal(saved.analysisSnapshots[0].consensusAnalysis.meetingMemory, undefined)
  assert.deepEqual(saved.analysisSnapshots[0].consensusAnalysis.participantView, priorView)

  const pending = useAppStore.getState().refreshAnalysis()
  useAppStore.getState().startNewMeeting()
  finish!({ consensus: ['旧会议迟到的决定'], tensions: [], missing: [], updatedAt: 2, meetingMemory: { version: 1, chunks: [] } })
  await pending
  assert.equal(useAppStore.getState().consensusAnalysis, null)
  assert.equal(useAppStore.getState().meetingMemory, undefined)
  assert.equal(useAppStore.getState().analysisSnapshots.length, 0)
  assert.equal(useAppStore.getState().isAnalyzing, false)

  useAppStore.setState({ liveSegments: input, isPaused: true,
    meetingMemory: { version: 1, chunks: [] }, consensusAnalysis: { consensus: [], tensions: [], missing: [], updatedAt: 0, participantView: priorView },
  })
  useAppStore.getState().deleteLiveSegment('s0')
  assert.equal(useAppStore.getState().meetingMemory, undefined)
  assert.equal(useAppStore.getState().consensusAnalysis, null)
  assert.match(useAppStore.getState().statusMessage ?? '', /继续会议后/)

  provider.extractConsensusAndTensions = async () => ({
    consensus: ['恢复后的共识'], tensions: [], missing: [], updatedAt: 4,
    meetingMemory: { version: 1, chunks: [] },
  })
  useAppStore.setState({ isStreaming: true, isPaused: true })
  await useAppStore.getState().togglePause()
  for (let attempt = 0; attempt < 20 && useAppStore.getState().consensusAnalysis?.consensus[0] !== '恢复后的共识'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.equal(useAppStore.getState().consensusAnalysis?.consensus[0], '恢复后的共识')

  useAppStore.setState({
    liveSegments: input, isPaused: false, isStreaming: false,
    phaseAnalysis: null, consensusAnalysis: null, meetingMemory: undefined,
  })
  provider.extractConsensusAndTensions = async () => ({
    consensus: [], tensions: [], missing: [], updatedAt: 5,
    meetingMemory: { version: 1, chunks: [] },
  })
  await useAppStore.getState().generateMindMap()
  assert.deepEqual(useAppStore.getState().meetingMemory, { version: 1, chunks: [] })
})
