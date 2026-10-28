import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const requireUi = createRequire(new URL('../shared/ui/package.json', import.meta.url))
const React = requireUi('react')
const { createElement } = React
const { renderToStaticMarkup } = requireUi('react-dom/server')
import { AnalysisRouter, toDesktopAnalysisFailure } from '../apps/desktop/electron/llm/analysisRouter'
import { createDesktopRuntime } from '../apps/desktop/renderer/runtime'
import { configureMeetingRuntime } from '../shared/ui/runtime'
import { DEFAULT_MODEL_SETTINGS } from '../shared/meeting/settings/types'
import type { AnalysisSessionReset, DesktopAnalysisConfig, DesktopTranscriptRequest } from '../shared/meeting/types/desktopAnalysis'
import type { PhaseConsensusAnalysisBundle, SpeakingHints } from '../shared/meeting/types/analysis'

const segments = [{ id: 'a', speaker: 'A', text: '先确认预算', timestamp: 1000, isFinal: true }]
const bundle: PhaseConsensusAnalysisBundle = {
  phaseAnalysis: { phase: 'decision-lock', confidence: 0.9, nextAction: '确认预算', reason: '已达成共识', updatedAt: 1000 },
  consensusAnalysis: { consensus: ['确认预算'], tensions: [], missing: [], updatedAt: 1000 },
}
const hints: SpeakingHints = { functionType: '收敛结论', whyNow: '已有共识', script: '请确认预算和负责人', updatedAt: 1000 }
const summary = { speech60s: '会议确认预算', keyPoints: ['确认预算'], nextSteps: [], updatedAt: 1000 }
const minutes = { title: '预算会议', overview: '确认预算', topics: [], decisions: ['确认预算'], openQuestions: [], actionItems: [], updatedAt: 1000 }
const mindMap = { id: 'map', topic: '预算', nodes: [], edges: [], capturedAt: 1000 }
const answer = { conclusion: '确认预算', reasoning: ['参会者提出预算问题'], suggestedReply: '请确认预算', updatedAt: 1000 }

test('desktop routes all tasks, preserves results on failure, and resets only at meeting boundaries', async (t) => {
  const router = new AnalysisRouter()
  const failures = new Set(['codex'])
  const calls: Array<{ task: string; provider: string; request: DesktopTranscriptRequest }> = []
  const probes: string[] = []
  const resets: AnalysisSessionReset[] = []
  const route = async <T, K extends string>(input: DesktopTranscriptRequest, task: K, value: T) => {
    try {
      const result = await router.run(input, async (config) => {
        calls.push({ task, provider: config!.provider, request: input })
        if (failures.has(config!.provider)) throw new Error(`${config!.provider} unavailable`)
        return value
      })
      return { ok: true as const, routing: result.routing, [task]: result.value } as { ok: true; routing: typeof result.routing } & Record<K, T>
    } catch (error) {
      return toDesktopAnalysisFailure(error, input)
    }
  }
  const bridge = {
    probeAnalysisConnection: async (config: DesktopAnalysisConfig) => { probes.push(config.provider); return { ok: true as const, model: 'test', authMethod: 'chatgpt' } },
    resetAnalysisSession: async (options?: AnalysisSessionReset) => { resets.push(options ?? {}); router.reset(options) },
    analyzeTranscriptRealtime: (input: DesktopTranscriptRequest) => route(input, 'bundle', bundle),
    generateSpeakingHints: (input: DesktopTranscriptRequest) => route(input, 'hints', hints),
    generateMindMap: (input: DesktopTranscriptRequest) => route(input, 'snapshot', mindMap),
    generateMeetingSummary: (input: DesktopTranscriptRequest) => route(input, 'summary', summary),
    generateMeetingMinutes: (input: DesktopTranscriptRequest) => route(input, 'minutes', minutes),
    answerInterviewQuestion: (input: DesktopTranscriptRequest & { question: string }) => route(input, 'answer', answer),
  }
  const memory = new Map<string, string>()
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) }
  let cleanup = () => {}
  for (const [name, value] of Object.entries({ React, window: { interviewCopilot: bridge, localStorage: storage, setTimeout, clearTimeout }, localStorage: storage })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    t.after(() => { if (name === 'window') cleanup(); if (previous) Object.defineProperty(globalThis, name, previous); else Reflect.deleteProperty(globalThis, name) })
  }
  let pauses = 0
  let resumes = 0
  const runtime = createDesktopRuntime()
  configureMeetingRuntime({ ...runtime, createAstProvider: () => ({
    id: 'volc-asr', label: 'test ASR', setCredentials: () => {}, start: async () => {}, stop: async () => {},
    pause: async () => { pauses++ }, resume: async () => { resumes++ },
  }) })
  const { useAppStore } = await import('../shared/ui/store/useAppStore')
  const { useSettingsStore } = await import('../shared/ui/store/useSettingsStore')
  const { SettingsPage } = await import('../shared/ui/pages/SettingsPage')
  const settings = structuredClone(DEFAULT_MODEL_SETTINGS)
  settings.llm.provider = 'codex'
  settings.llm.apiKey = 'test-key'
  settings.ast.apiKey = 'ast-key'
  useSettingsStore.setState({ settings, draft: settings, userId: 'test-user' })
  useAppStore.getState().applyModelSettings(settings)
  useAppStore.setState({ liveSegments: segments, currentSessionId: 'session-test', currentSessionStartedAt: 1000,
    scenarioId: 'design-review', questionContext: '预算', roleContext: '评审者', autoRefreshHints: false,
  })
  cleanup = () => { useAppStore.setState({ isStreaming: false }); useAppStore.getState().startNewMeeting() }

  const html = renderToStaticMarkup(createElement(SettingsPage))
  for (const text of ['首选渠道', '故障时自动切换', 'Codex 配置', 'API 配置', '测试 Codex 连接', '测试 API 连接']) assert.ok(html.includes(text), text)

  await useAppStore.getState().refreshAnalysis()
  assert.deepEqual(calls.map((call) => call.provider), ['codex', 'api'])
  assert.equal(useAppStore.getState().analysisProviderLabel, 'OpenAI Responses')
  assert.match(useAppStore.getState().errorMessage!, /本场会议继续使用 API/)
  assert.equal(useSettingsStore.getState().settings.llm.provider, 'codex')
  await useAppStore.getState().refreshSpeakingHints()
  await useAppStore.getState().generateMindMap()
  await useAppStore.getState().generateMeetingSummary()
  await useAppStore.getState().generateMeetingMinutes()
  useAppStore.setState({ aiQuestionDraft: '预算是什么？' })
  await useAppStore.getState().askAiQuestion()
  assert.deepEqual(calls.slice(2).map((call) => [call.task, call.provider]), [
    ['hints', 'api'], ['snapshot', 'api'], ['summary', 'api'], ['minutes', 'api'], ['answer', 'api'],
  ])
  for (const call of calls) {
    assert.deepEqual(call.request.segments, segments)
    assert.equal(call.request.scenarioId, 'design-review')
    assert.equal(call.request.questionContext, '预算')
    assert.equal(call.request.roleContext, '评审者')
  }

  await runtime.probeLlmConnection(settings.llm)
  await runtime.probeLlmConnection({ ...settings.llm, provider: 'api' })
  assert.deepEqual(probes, ['codex', 'api'])
  useAppStore.setState({ isStreaming: true })
  await useAppStore.getState().togglePause()
  await useAppStore.getState().togglePause()
  assert.equal(pauses, 1)
  assert.equal(resumes, 1)
  await useAppStore.getState().stopStream()
  assert.equal(resets.at(-1)?.preserveRouting, true)
  await useAppStore.getState().generateMeetingSummary()
  assert.equal(calls.at(-1)?.provider, 'api')

  const before = useAppStore.getState()
  const preserved = [before.phaseAnalysis, before.consensusAnalysis, before.speakingHints, before.mindMap, before.meetingSummary, before.meetingMinutes, before.analysisSnapshots, before.aiQaHistory]
  failures.add('api')
  useAppStore.setState({ liveSegments: [{ ...segments[0], timestamp: 2000, text: '新增预算讨论' }] })
  const attemptsBefore = calls.length
  for (const action of ['refreshAnalysis', 'refreshSpeakingHints', 'generateMindMap', 'generateMeetingSummary', 'generateMeetingMinutes', 'askAiQuestion'] as const) await useAppStore.getState()[action]()
  const after = useAppStore.getState()
  assert.deepEqual([after.phaseAnalysis, after.consensusAnalysis, after.speakingHints, after.mindMap, after.meetingSummary, after.meetingMinutes, after.analysisSnapshots, after.aiQaHistory], preserved)
  assert.equal(calls.length - attemptsBefore, 6)
  assert.ok(calls.slice(attemptsBefore).every((call) => call.provider === 'api'))
  assert.equal(after.analysisProviderLabel, 'OpenAI Responses')
  assert.match(after.errorMessage!, /API 分析失败/)

  useAppStore.getState().startNewMeeting()
  assert.equal(useAppStore.getState().analysisProviderLabel, '本地 Codex')
  useAppStore.setState({ liveSegments: segments, currentSessionId: 'session-empty', currentSessionStartedAt: 1000, aiQuestionDraft: '预算？' })
  for (const action of ['refreshAnalysis', 'refreshSpeakingHints', 'generateMindMap', 'generateMeetingSummary', 'generateMeetingMinutes', 'askAiQuestion'] as const) await useAppStore.getState()[action]()
  const empty = useAppStore.getState()
  assert.equal(empty.phaseAnalysis, null)
  assert.equal(empty.consensusAnalysis, null)
  assert.equal(empty.speakingHints, null)
  assert.equal(empty.mindMap, null)
  assert.equal(empty.meetingSummary, null)
  assert.equal(empty.meetingMinutes, null)
  assert.deepEqual(empty.analysisSnapshots, [])
  assert.deepEqual(empty.aiQaHistory, [])
  assert.match(empty.errorMessage!, /两种分析渠道均失败/)

  // Saving settings cancels prior routing; turning off fallback calls only the preferred channel.
  useAppStore.setState({ liveSegments: [] })
  useAppStore.getState().applyModelSettings({ ...settings, llm: { ...settings.llm, autoFallbackEnabled: false } })
  useAppStore.setState({ liveSegments: segments })
  const disabledStart = calls.length
  await useAppStore.getState().refreshAnalysis()
  assert.deepEqual(calls.slice(disabledStart).map((call) => call.provider), ['codex'])
  assert.equal(calls.at(-1)?.request.fallbackAnalysisConfig, undefined)

  // New recordings start on the preferred channel, regardless of the previous meeting's downgrade.
  failures.clear()
  await useAppStore.getState().startStream()
  assert.equal(resets.at(-1)?.preserveRouting, undefined)
  useAppStore.setState({ liveSegments: segments })
  await useAppStore.getState().refreshAnalysis()
  assert.equal(calls.at(-1)?.provider, 'codex')
})
