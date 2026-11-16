import assert from 'node:assert/strict'
import test from 'node:test'
import { handleAnalysisRequest } from '../shared/analysis/llm/analysisRequest'
import { buildAnswerInterviewQuestionPrompt } from '../shared/meeting/prompts/answerInterviewQuestion'
import { buildGenerateMeetingMinutesPrompt } from '../shared/meeting/prompts/generateMeetingMinutes'
import { buildGenerateMeetingSummaryPrompt } from '../shared/meeting/prompts/generateMeetingSummary'
import { buildGenerateMindMapPrompt } from '../shared/meeting/prompts/generateMindMap'
import { buildRealtimeAnalysisPrompt } from '../shared/meeting/prompts/realtimeAnalysis'
import { buildSpeakingHintsPrompt } from '../shared/meeting/prompts/speakingHints'
import { normalizeFunctionType } from '../shared/meeting/services/analysisNormalization'
import type { AnalysisPromptContext } from '../shared/meeting/types/promptContext'

const REFERENCE = 'REFERENCE_MARKER：增量 = 流量 × 转化率 × 客单价'

const prompts = (context: AnalysisPromptContext) => [
  buildRealtimeAnalysisPrompt([], context),
  buildSpeakingHintsPrompt([], context),
  buildAnswerInterviewQuestionPrompt('现在该说什么？', [], context),
]

test('reference material reaches every discussion prompt once, labelled as non-fact, only where enabled', () => {
  for (const prompt of prompts({ scenarioId: 'group-interview', referenceContext: REFERENCE })) {
    assert.equal(prompt.split('REFERENCE_MARKER').length - 1, 1)
    assert.match(prompt, /不是本场题目材料或讨论事实/)
  }
  for (const prompt of prompts({ scenarioId: 'general', referenceContext: REFERENCE })) {
    assert.ok(!prompt.includes('REFERENCE_MARKER'))
  }
})

test('analysis requests reject malformed reference material', async () => {
  for (const invalid of [{ referenceContext: 42 }]) {
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

test('opening round drafts a standalone statement and tells every task the round is in progress', () => {
  const opening = { scenarioId: 'group-interview' as const, questionContext: '为新品设计 618 上市方案', openingRound: true }
  const hints = buildSpeakingHintsPrompt([], opening)
  assert.match(hints, /准备轮到自己时的首轮发言陈述/)
  assert.match(hints, /不重复已被说过的观点和理由/)
  assert.match(hints, /备选说法/)
  assert.ok(!hints.includes('认为此刻不该发言时'))
  assert.match(buildRealtimeAnalysisPrompt([], opening), /当前处于首轮发言/)
  // Whole-meeting outputs are produced late and ignore a flag the user forgot to clear.
  for (const build of [buildGenerateMeetingSummaryPrompt, buildGenerateMeetingMinutesPrompt, buildGenerateMindMapPrompt]) {
    const prompt = build([], opening)
    assert.ok(!prompt.includes('当前处于首轮发言'))
    assert.match(prompt, /为新品设计 618 上市方案/)
  }

  const freeDiscussion = buildSpeakingHintsPrompt([], { ...opening, openingRound: false })
  assert.ok(freeDiscussion.includes('认为此刻不该发言时'))
  assert.ok(!freeDiscussion.includes('首轮发言'))
  // Scenarios without opening-round copy ignore the flag.
  assert.ok(!buildSpeakingHintsPrompt([], { ...opening, scenarioId: 'general' }).includes('首轮发言'))
})

test('analysis requests reject a non-boolean opening round flag', async () => {
  const result = await handleAnalysisRequest({ action: 'speaking-hints', body: { segments: [], openingRound: 'yes' }, configOverride: {}, trustRuntimeConfig: true })
  assert.equal(result.status, 400)
  assert.match(JSON.stringify(result.body), /Invalid analysis context/)
})

test('speakers marked as the user are named in every discussion prompt', async () => {
  const self = { scenarioId: 'group-interview' as const, selfSpeakers: ['发言人 2', '发言人 4', '发言人 2'] }
  for (const prompt of prompts(self)) {
    assert.match(prompt, /转写中标为「发言人 2」「发言人 4」的发言是用户自己说的/)
  }
  for (const prompt of prompts({ scenarioId: 'group-interview', selfSpeakers: [] })) {
    assert.ok(!prompt.includes('用户自己说的'))
  }

  const result = await handleAnalysisRequest({ action: 'speaking-hints', body: { segments: [], selfSpeakers: ['发言人 2', 3] }, configOverride: {}, trustRuntimeConfig: true })
  assert.equal(result.status, 400)
  assert.match(JSON.stringify(result.body), /Invalid analysis context/)
})

test('stable context precedes the changing meeting history so the prompt prefix stays cacheable', () => {
  const context = { scenarioId: 'group-interview' as const, questionContext: 'TOPIC_MARKER', referenceContext: REFERENCE, roleContext: 'ROLE_MARKER', meetingHistory: 'HISTORY_MARKER' }
  for (const prompt of prompts(context)) {
    const history = prompt.indexOf('HISTORY_MARKER')
    for (const marker of ['TOPIC_MARKER', 'REFERENCE_MARKER', 'ROLE_MARKER']) {
      assert.ok(prompt.indexOf(marker) >= 0 && prompt.indexOf(marker) < history, marker)
    }
  }
})
