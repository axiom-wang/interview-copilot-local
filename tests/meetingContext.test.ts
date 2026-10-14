import assert from 'node:assert/strict'
import test from 'node:test'
import { acceptMemoryEvents, findHistoricalEvidence, formatEvidence, MeetingContextCapacityError, normalizeMeetingMemory, parseMemoryEvents, prepareMeetingHistory, stableTranscript } from '../shared/meeting/context/meetingMemory'
import { normalizeFunctionType } from '../shared/meeting/services/analysisNormalization'
import { analyzeTranscriptRealtimeBundle, answerInterviewQuestionOnly, generateMeetingMinutesOnly, generateMeetingSummaryOnly, generateSpeakingHintsOnly, generateTranscriptMindMap, type StructuredResponse } from '../shared/analysis/llm/openaiAnalysisService'
import { handleAnalysisRequest } from '../shared/analysis/llm/analysisRequest'
import { loadSessions, saveSession } from '../shared/meeting/services/sessionStore'
import { resolveScenarioAssistance } from '../shared/meeting/scenarios/assistance'
import { SCENARIO_PROFILES } from '../shared/meeting/scenarios'
import type { TranscriptSegment } from '../shared/meeting/types/transcript'
import type { MeetingMemoryEvent } from '../shared/meeting/types/meetingMemory'
import type { SessionRecord } from '../shared/meeting/types/session'

const segment = (id: string, text: string, timestamp = 0): TranscriptSegment => ({
  id, text, timestamp, speaker: 'A', isFinal: true,
})
const longTranscript = () => Array.from({ length: 160 }, (_, i) =>
  segment(`s${i}`, `议题${i}：我们需要保留这段历史讨论中的约束和事实。${'讨论细节。'.repeat(20)}`, i * 20_000))
const mockSummary = async (source: TranscriptSegment[]): Promise<MeetingMemoryEvent[]> =>
  source.map((s) => ({ topic: s.id, status: 'discussed', detail: s.text.slice(0, 30), evidenceIds: [s.id] }))

test('short meetings retain early constraints, rejected options and resolutions without a memory model call', async () => {
  const input = [segment('budget', '预算不能超过八万元。'),
    segment('reject', '方案甲已否决，原因是成本过高。', 600_000),
    segment('resolve', '供应链问题已解决，采用方案乙。', 1_200_000)]
  const result = await prepareMeetingHistory(input, undefined, async () => { throw new Error('Unexpected summarization') })
  for (const item of input) assert.ok(result.history.includes(item.text))
  assert.equal(result.memory.chunks.length, 0)
})

test('long meetings cover every source once, reuse checkpoints and only compress new history', async () => {
  const input = longTranscript()
  let calls = 0
  const summarize = async (source: TranscriptSegment[]) => { calls++; return mockSummary(source) }
  const first = await prepareMeetingHistory(input, undefined, summarize)
  assert.ok(calls > 0)
  const ids = [...first.memory.chunks.flatMap((chunk) => chunk.sourceIds), ...first.remaining.map((s) => s.id)]
  assert.deepEqual(ids, input.map((s) => s.id))
  assert.equal(new Set(ids).size, input.length)
  const before = calls
  const second = await prepareMeetingHistory(input, first.memory, summarize)
  assert.equal(calls, before)
  assert.deepEqual(second.memory, first.memory)
  await prepareMeetingHistory([...input, segment('new', '刚刚达成的新决定', 4_000_000)], first.memory, summarize)
  assert.equal(calls, before)
})

test('corrections, deletions and a different meeting cannot reuse stale memory', async () => {
  const input = longTranscript()
  const first = await prepareMeetingHistory(input, undefined, mockSummary)
  for (const changed of [
    [{ ...input[0], text: '预算已经修改，旧数字作废。' }, ...input.slice(1)],
    input.slice(1),
    input.map((s) => ({ ...s, id: `other-${s.id}` })),
    [{ ...input[0], speaker: 'B' }, ...input.slice(1)],
  ]) {
    let calls = 0
    const result = await prepareMeetingHistory(changed, first.memory, async (source) => { calls++; return mockSummary(source) })
    assert.ok(calls > 0)
    assert.notEqual(result.memory.chunks[0].sourceDigest, first.memory.chunks[0].sourceDigest)
    assert.deepEqual([...result.memory.chunks.flatMap((c) => c.sourceIds), ...result.remaining.map((s) => s.id)], changed.map((s) => s.id))
  }
})

test('ASR partials are not committed to historical memory and final revisions take precedence', async () => {
  const input = longTranscript()
  input[3].isFinal = false
  const archived: string[] = []
  const result = await prepareMeetingHistory(input, undefined, async (source) => {
    archived.push(...source.map((item) => item.id))
    return mockSummary(source)
  })
  assert.ok(archived.includes('s0'))
  assert.ok(archived.includes('s4'))
  assert.ok(!archived.includes('s3'))
  assert.ok(!result.memory.chunks.some((chunk) => chunk.sourceIds.includes('s3')))
  assert.ok(result.history.includes('"provisional":true'))
  assert.ok(result.history.includes(input[4].text.slice(0, 12)))
  const stable = stableTranscript([segment('a', '最终文本'), { ...segment('a', '旧的临时文本'), isFinal: false }])
  assert.equal(stable[0].text, '最终文本')
})

test('invalid and invented memory evidence is rejected, including on imported sessions', () => {
  assert.throws(() => parseMemoryEvents({ events: [{ topic: '预算', status: 'confirmed', detail: '已确认', evidenceIds: ['invented'] }] }, ['real']), /出处/)
  assert.throws(() => parseMemoryEvents({ events: [{ topic: '预算', status: 'confirmed', detail: '已确认', evidenceIds: [] }] }, ['real']), /出处/)
  const accepted = acceptMemoryEvents({ events: [
    { topic: '预算', status: 'confirmed', detail: '已确认', evidenceIds: ['real'] },
    { topic: '虚构', status: 'confirmed', detail: '无出处', evidenceIds: ['invented'] },
  ] }, ['real'])
  assert.deepEqual(accepted.map((event) => event.evidenceIds), [['real']])
  assert.equal(normalizeMeetingMemory({ version: 2, chunks: [] }), undefined)
  assert.equal(normalizeMeetingMemory({ version: 1, chunks: [{ sourceIds: ['real'], sourceDigest: 'x', startedAt: 0, endedAt: 1, events: [{ topic: 'x', status: 'confirmed', detail: 'x', evidenceIds: ['fake'] }] }] }), undefined)
})

test('question evidence searches all history and preserves old pinned statements and neighboring replies', () => {
  const input = Array.from({ length: 50 }, (_, i) => segment(`s${i}`, '其他话题', i * 60_000))
  input[1].text = '取消原来的海外上线计划，是因为预算已经不足。'
  input[2].text = '同意，我们先做国内市场。'
  const evidence = findHistoricalEvidence(input, '为什么取消海外上线计划？', ['s0'])
  for (const id of ['s0', 's1', 's2']) assert.ok(evidence.some((s) => s.id === id))
  const repeated = Array.from({ length: 12 }, (_, index) => segment(`b${index}`, '预算讨论', index))
  const latest = findHistoricalEvidence(repeated, '预算')
  assert.ok(latest.some((item) => item.id === 'b11'))
  assert.ok(!latest.some((item) => item.id === 'b0'))
})

const outputs: Record<string, unknown> = {
  detect_phase: { phase: 'alignment-building', confidence: 0.9, reason: '在比较', nextAction: '核对约束' },
  extract_consensus_and_tensions: { consensus: [], tensions: [], missing: [], scenarioFocus: [] },
  generate_speaking_hints: { functionType: '补齐信息', whyNow: '确认变化', hint60s: '核对预算', hint120s: '核对预算与变化依据' },
  generate_mind_map: { topic: '会议', nodes: [], edges: [] },
  generate_meeting_summary: { speech60s: '会议总结', keyPoints: [], nextSteps: [] },
  generate_meeting_minutes: { title: '纪要', overview: '会议', topics: [], decisions: [], openQuestions: [], actionItems: [] },
  answer_interview_question: { conclusion: '待确认', reasoning: ['检查原话'], suggestedReply: '请核对预算' },
}

test('all analysis tasks receive the entire meeting, role and chronology rules', async () => {
  const prompts: string[] = []
  const responder: StructuredResponse = async (prompt, name, _schema, parser) => {
    prompts.push(prompt)
    assert.ok(outputs[name], name)
    return parser(outputs[name])
  }
  const input = [segment('early', 'EARLY_CONSTRAINT：不能增加预算。'), segment('new', 'LATEST_CHANGE：方案甲被撤销，改用乙。', 1_200_000)]
  const context = { scenarioId: 'design-review' as const, roleContext: 'ROLE：负责技术实现' }
  const bundle = await analyzeTranscriptRealtimeBundle(input, context, undefined, responder)
  assert.deepEqual(bundle.consensusAnalysis.contextCoverage, { segmentCount: 2, throughTimestamp: 1_200_000 })
  await generateSpeakingHintsOnly(input, context, undefined, responder)
  await generateTranscriptMindMap(input, context, undefined, responder)
  await generateMeetingSummaryOnly(input, context, undefined, responder)
  await generateMeetingMinutesOnly(input, context, undefined, responder)
  await answerInterviewQuestionOnly('早期预算是什么？', input, context, undefined, responder)
  assert.equal(prompts.length, 7)
  for (const prompt of prompts) {
    for (const text of ['EARLY_CONSTRAINT', 'LATEST_CHANGE', 'ROLE', '最新明确变更优先', '风险依赖']) assert.ok(prompt.includes(text), text)
  }
})

test('every scenario defines distinct focus and brainstorming does not force premature consensus', () => {
  const signatures = new Set<string>()
  for (const profile of Object.values(SCENARIO_PROFILES)) {
    const assistance = resolveScenarioAssistance(profile.id)
    assert.equal(assistance.dimensions.length, 3)
    signatures.add(assistance.dimensions.join(','))
  }
  assert.equal(signatures.size, Object.keys(SCENARIO_PROFILES).length)
  assert.match(resolveScenarioAssistance('brainstorm').guidance, /允许没有共识/)
  assert.match(resolveScenarioAssistance('team-sync').guidance, /负责人和时间/)
})

test('old sessions still load; new memory, focus and source references survive a local round trip', async (t) => {
  const storage = new Map<string, string>()
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } } })
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window') })
  const legacy = { ...loadSessions().at(-1)!, id: 'legacy', title: '旧会话' }
  saveSession(legacy)
  assert.equal(loadSessions().find((s) => s.id === 'legacy')?.meetingMemory, undefined)
  const input = longTranscript()
  const { memory } = await prepareMeetingHistory(input, undefined, mockSummary)
  const session: SessionRecord = { ...legacy, id: 'new', transcriptSegments: input, meetingMemory: memory,
    questionContext: '评审新方案', roleContext: '工程师', scenarioId: 'design-review',
    analysisSnapshots: [{ ...legacy.analysisSnapshots[0], consensusAnalysis: {
      consensus: [], tensions: [], missing: [], updatedAt: 0,
      scenarioFocus: [{ label: '风险与取舍', detail: '等待验证', evidenceIds: ['s0'] }],
      contextCoverage: { segmentCount: 160, throughTimestamp: input.at(-1)!.timestamp },
    } }],
  }
  saveSession(session)
  const restored = loadSessions().find((s) => s.id === 'new')!
  assert.deepEqual(restored.meetingMemory, memory)
  assert.equal(restored.questionContext, '评审新方案')
  assert.deepEqual(restored.analysisSnapshots[0].consensusAnalysis.scenarioFocus, session.analysisSnapshots[0].consensusAnalysis.scenarioFocus)
  assert.equal(restored.analysisSnapshots[0].consensusAnalysis.contextCoverage?.segmentCount, 160)
})

test('API rejects malformed new context fields before sending anything to a model', async () => {
  for (const invalid of [{ meetingMemory: { version: 99 } }, { pinnedSegmentIds: [123] }]) {
    const result = await handleAnalysisRequest({ action: 'realtime', body: { segments: [], ...invalid }, configOverride: {}, trustRuntimeConfig: true })
    assert.equal(result.status, 400)
    assert.match(JSON.stringify(result.body), /Invalid analysis context/)
  }
})

test('long-history failure does not silently discard early transcript', async () => {
  let calls = 0
  const input = longTranscript()
  const partial = await prepareMeetingHistory(input, undefined, async (source) => {
    calls += 1
    if (calls > 1) throw new Error('memory provider unavailable')
    return mockSummary(source)
  })
  assert.equal(partial.memory.chunks.length, 1)
  assert.ok(partial.history.includes(input[0].text) || partial.memory.chunks[0].events.some((event) => event.detail.includes(input[0].text.slice(0, 8))))
  assert.ok(partial.history.includes(input.at(-1)!.text))
  const kept = new Set(partial.memory.chunks[0].sourceIds)
  await prepareMeetingHistory(input, partial.memory, async (source) => {
    assert.ok(source.every((item) => !kept.has(item.id)))
    return mockSummary(source)
  })
  const huge = Array.from({ length: 80 }, (_, index) => segment(`h${index}`, '约束'.repeat(800), index * 1000))
  await assert.rejects(prepareMeetingHistory(huge, undefined, async () => { throw new Error('memory provider unavailable') }), (error: unknown) => {
    assert.ok(error instanceof MeetingContextCapacityError)
    assert.equal(error.meetingMemory.chunks.length, 0)
    return true
  })
  assert.ok(formatEvidence([segment('a', '预算')]).includes('"id":"a"'))
})

test('AI participation separates tentative contributions from facts and permits listening without scripts', async () => {
  const { parseSpeakingHints, parseConsensusAnalysis } = await import('../shared/analysis/llm/responseParsing')
  const { groundConsensusEvidence } = await import('../shared/meeting/context/groundConsensus')
  const { buildExtractConsensusPrompt } = await import('../shared/meeting/prompts/extractConsensus')
  const { buildSpeakingHintsPrompt } = await import('../shared/meeting/prompts/speakingHints')
  const previousParticipantView = {
    understanding: '我们正在核对预算', intent: 'clarify' as const,
    contribution: '预算是否含运费？', reason: '口径不明确', evidenceIds: ['real'],
  }
  const context = { scenarioId: 'general' as const, previousParticipantView }
  const prompt = buildExtractConsensusPrompt([segment('real', '预算尚未明确')], context)
  assert.match(prompt, /参与当前会议讨论的 AI 参会者/)
  assert.match(prompt, /尚未实际发言或被团队接受，不是会议事实/)
  assert.match(prompt, /预算是否含运费/)
  assert.match(prompt, /真人未回应且无新证据时不要重复/)
  assert.match(buildSpeakingHintsPrompt([], context), /hint60s、hint120s 均为空字符串/)
  const hints = parseSpeakingHints({ functionType: '倾听观察', whyNow: '等待成本负责人说完', hint60s: '不应该发出的重复建议', hint120s: '也不应该发出的长建议' }, 100)
  assert.equal(hints.hint120s, '')
  assert.equal(hints.hint60s, '')
  const analysis = parseConsensusAnalysis({ consensus: ['保持原结论'], tensions: [], missing: [], participantView: previousParticipantView, scenarioFocus: [{ label: '当前议题', detail: '建议核对预算', evidenceIds: ['missing'] }] }, 100)
  assert.deepEqual(groundConsensusEvidence(analysis, [segment('real', '预算尚未明确')]).consensus, ['保持原结论'])
  const grounded = groundConsensusEvidence(analysis, [segment('different', '其他发言')])
  assert.deepEqual(grounded.consensus, ['保持原结论'])
  assert.deepEqual(grounded.participantView?.evidenceIds, [])
  assert.deepEqual(grounded.scenarioFocus?.[0].evidenceIds, [])
  assert.equal(normalizeFunctionType('继续观察'), '推进结构')
  assert.equal(normalizeFunctionType('先倾听'), '倾听观察')
})
