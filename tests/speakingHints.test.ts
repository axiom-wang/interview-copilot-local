import assert from 'node:assert/strict'
import test from 'node:test'
import { generateSpeakingHintsOnly, type StructuredResponse } from '../shared/analysis/llm/openaiAnalysisService'
import { parseSpeakingHints } from '../shared/analysis/llm/responseParsing'
import { loadSessions, saveSession } from '../shared/meeting/services/sessionStore'
import { exportSessionAsMarkdown } from '../shared/meeting/services/sessionExport'
import { buildRealtimeAnalysisPrompt } from '../shared/meeting/prompts/realtimeAnalysis'

test('hint generation requests and returns only 60/120-second scripts', async () => {
  const responder: StructuredResponse = async (prompt, name, schema, parser) => {
    assert.equal(name, 'generate_speaking_hints')
    assert.deepEqual(schema.required, ['functionType', 'whyNow', 'hint60s', 'hint120s'])
    assert.ok(prompt.includes('hint120s'))
    assert.ok(!prompt.includes('hint15s') && !prompt.includes('hint30s'))
    return parser({ functionType: '检验推理', whyNow: '需要核对计算', hint60s: '短论证', hint120s: '展开论证' })
  }
  const hints = await generateSpeakingHintsOnly([], { scenarioId: 'jd-tet', questionContext: '比较两种排序及其依据。' }, undefined, responder)
  assert.equal(hints.functionType, '检验推理')
  assert.equal(hints.hint60s, '短论证')
  assert.equal(hints.hint120s, '展开论证')
  assert.ok(!('hint15s' in hints) && !('hint30s' in hints))
})

test('legacy hints retain their longest script without inventing a 120-second version', () => {
  const legacy = parseSpeakingHints({ functionType: '补齐信息', hint15s: '旧15秒', hint30s: '旧30秒', hint60s: '旧60秒' }, 10)
  assert.equal(legacy.hint60s, '旧60秒')
  assert.equal(legacy.hint120s, '')
  assert.equal(parseSpeakingHints({ hint15s: '仅有15秒' }, 10).hint60s, '仅有15秒')
  assert.equal(parseSpeakingHints({ hint15s: '旧15秒', hint30s: '旧30秒' }, 10).hint60s, '旧30秒')
  assert.equal(parseSpeakingHints({}, 10).hint60s, '')
  const listening = parseSpeakingHints({ functionType: '倾听观察', hint60s: '多余内容', hint120s: '多余长稿' }, 10)
  assert.equal(listening.hint60s, '')
  assert.equal(listening.hint120s, '')
})

test('legacy sessions load, new scripts round-trip and Markdown exports both durations', async (t) => {
  const storage = new Map<string, string>()
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const previousCreateUrl = URL.createObjectURL
  const previousRevokeUrl = URL.revokeObjectURL
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
    else Reflect.deleteProperty(globalThis, 'document')
    URL.createObjectURL = previousCreateUrl
    URL.revokeObjectURL = previousRevokeUrl
  })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } } })
  const demo = loadSessions()[0]
  storage.set('interview-copilot-local/saved-sessions', JSON.stringify([{ ...demo, id: 'legacy-hints',
    analysisSnapshots: [{ ...demo.analysisSnapshots[0], speakingHints: {
      functionType: '补齐信息', whyNow: '旧记录', hint15s: '旧15秒', hint30s: '旧30秒', hint60s: '旧60秒',
    } }],
  }]))
  const legacy = loadSessions().find((session) => session.id === 'legacy-hints')!
  assert.equal(legacy.analysisSnapshots[0].speakingHints.hint60s, '旧60秒')
  assert.equal(legacy.analysisSnapshots[0].speakingHints.hint120s, '')
  const updated = { ...legacy, id: 'new-hints', scenarioId: 'jd-tet' as const,
    analysisSnapshots: [{ ...legacy.analysisSnapshots[0], speakingHints: parseSpeakingHints({
      functionType: '提出观点', hint60s: '新60秒发言', hint120s: '新120秒展开',
    }, legacy.analysisSnapshots[0].timestamp) }],
  }
  saveSession(updated)
  const restored = loadSessions().find((session) => session.id === 'new-hints')!
  assert.deepEqual(restored.analysisSnapshots[0].speakingHints, updated.analysisSnapshots[0].speakingHints)
  let downloaded: Blob | undefined
  URL.createObjectURL = (blob) => { downloaded = blob as Blob; return 'blob:test' }
  URL.revokeObjectURL = () => {}
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ click: () => {} }),
  } })
  exportSessionAsMarkdown(restored)
  const markdown = await downloaded!.text()
  assert.match(markdown, /60 秒建议：新60秒发言/)
  assert.match(markdown, /120 秒建议：新120秒展开/)
  assert.match(markdown, /京东 TET 群面/)
  assert.ok(!markdown.includes('15 秒建议') && !markdown.includes('30 秒建议'))
})

test('combined desktop analysis includes shared instructions and meeting context only once', () => {
  const prompt = buildRealtimeAnalysisPrompt([{ id: 'source', speaker: 'A', text: '排序讨论中的原话', timestamp: 100, isFinal: true }], {
    scenarioId: 'jd-tet', questionContext: '排序题的唯一标记',
  })
  for (const unique of ['共同规则：', '排序题的唯一标记', '排序讨论中的原话']) {
    assert.equal(prompt.split(unique).length - 1, 1)
  }
  assert.match(prompt, /phaseAnalysis/)
  assert.match(prompt, /consensusAnalysis/)
})
