import assert from 'node:assert/strict'
import test from 'node:test'
import { handleAnalysisRequest } from '../shared/analysis/llm/analysisRequest'
import { buildTimingContext, formatTimingContext, normalizeTimeBudget } from '../shared/meeting/context/timeBudget'
import { buildAnswerInterviewQuestionPrompt } from '../shared/meeting/prompts/answerInterviewQuestion'
import { buildRealtimeAnalysisPrompt } from '../shared/meeting/prompts/realtimeAnalysis'
import { buildSpeakingHintsPrompt } from '../shared/meeting/prompts/speakingHints'
import { normalizeFunctionType } from '../shared/meeting/services/analysisNormalization'
import type { AnalysisPromptContext } from '../shared/meeting/types/promptContext'

const REFERENCE = 'REFERENCE_MARKER：增量 = 流量 × 转化率 × 客单价'
const timing = { elapsedMinutes: 41, discussionMinutes: 45, reportMinutes: 10 }

const prompts = (context: AnalysisPromptContext) => [
  buildRealtimeAnalysisPrompt([], context),
  buildSpeakingHintsPrompt([], context),
  buildAnswerInterviewQuestionPrompt('现在该说什么？', [], context),
]

test('reference material reaches every discussion prompt once, labelled as non-fact, only where enabled', () => {
  for (const prompt of prompts({ scenarioId: 'group-interview', referenceContext: REFERENCE, timing })) {
    assert.equal(prompt.split('REFERENCE_MARKER').length - 1, 1)
    assert.match(prompt, /不是本场题目材料或讨论事实/)
    assert.match(prompt, /剩余约 4 分钟，已进入收口时间/)
  }
  for (const prompt of prompts({ scenarioId: 'general', referenceContext: REFERENCE })) {
    assert.ok(!prompt.includes('REFERENCE_MARKER'))
  }
})

test('timing context reports remaining, wrap-up and overtime states', () => {
  assert.equal(
    formatTimingContext({ elapsedMinutes: 12, discussionMinutes: 45 }),
    '时间预算：讨论已进行约 12 分钟 / 计划 45 分钟（剩余约 33 分钟）',
  )
  assert.match(formatTimingContext({ elapsedMinutes: 40, discussionMinutes: 45, reportMinutes: 10 }), /剩余约 5 分钟，已进入收口时间）；之后汇报 10 分钟/)
  assert.match(formatTimingContext({ elapsedMinutes: 48, discussionMinutes: 45 }), /已超时 3 分钟/)
  assert.equal(formatTimingContext(undefined), '')
  assert.deepEqual(buildTimingContext({ discussionMinutes: 45 }, 1_000, 1_000 + 125_000), { discussionMinutes: 45, elapsedMinutes: 2 })
  assert.equal(buildTimingContext(null, 1_000), undefined)
  assert.equal(normalizeTimeBudget({ discussionMinutes: 0 }), null)
  assert.deepEqual(normalizeTimeBudget({ discussionMinutes: 45, reportMinutes: -1 }), { discussionMinutes: 45 })
})

test('analysis requests reject malformed reference material and timing', async () => {
  for (const invalid of [
    { referenceContext: 42 },
    { timing: { elapsedMinutes: -1, discussionMinutes: 45 } },
    { timing: { elapsedMinutes: 3, discussionMinutes: '45' } },
    { timing: { elapsedMinutes: 3, discussionMinutes: 45, reportMinutes: 'ten' } },
  ]) {
    const result = await handleAnalysisRequest({ action: 'realtime', body: { segments: [], ...invalid }, configOverride: {}, trustRuntimeConfig: true })
    assert.equal(result.status, 400)
    assert.match(JSON.stringify(result.body), /Invalid analysis context/)
  }
})

test('speaking function types include follow-up and refocus moves', () => {
  assert.equal(normalizeFunctionType('追问落地'), '追问落地')
  assert.equal(normalizeFunctionType('拉回主线'), '拉回主线')
  assert.equal(normalizeFunctionType('讨论跑题，需要拉回'), '拉回主线')
  assert.equal(normalizeFunctionType('分工落地'), '分工落地')
})
