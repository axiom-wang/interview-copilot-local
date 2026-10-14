import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAnswerInterviewQuestionPrompt } from '../shared/meeting/prompts/answerInterviewQuestion'
import { buildDetectPhasePrompt } from '../shared/meeting/prompts/detectPhase'
import { buildExtractConsensusPrompt } from '../shared/meeting/prompts/extractConsensus'
import { buildGenerateMeetingMinutesPrompt } from '../shared/meeting/prompts/generateMeetingMinutes'
import { buildGenerateMeetingSummaryPrompt } from '../shared/meeting/prompts/generateMeetingSummary'
import { buildGenerateMindMapPrompt } from '../shared/meeting/prompts/generateMindMap'
import { buildSpeakingHintsPrompt } from '../shared/meeting/prompts/speakingHints'
import type { AnalysisPromptContext } from '../shared/meeting/types/promptContext'

const builders = [
  buildDetectPhasePrompt, buildExtractConsensusPrompt, buildGenerateMindMapPrompt,
  buildGenerateMeetingMinutesPrompt, buildGenerateMeetingSummaryPrompt,
  buildSpeakingHintsPrompt,
  (segments: Parameters<typeof buildDetectPhasePrompt>[0], context?: AnalysisPromptContext) =>
    buildAnswerInterviewQuestionPrompt('当前有哪些缺口？', segments, context),
]

test('every TET analysis task includes the supplied case and excludes stale role assignments', () => {
  for (const build of builders) {
    const prompt = build([], {
      scenarioId: 'jd-tet',
      questionContext: '题目原文：预算限定为八万元，请比较商品甲和商品乙。',
      roleContext: 'OLD_ROLE_ONLY: 我必须担任组长并分配发言顺序。',
    })
    assert.ok(prompt.includes('预算限定为八万元'))
    assert.ok(prompt.includes('商业维度仅在题目相关时使用'))
    assert.ok(prompt.includes('题目明确指定角色或规则时遵循题目'))
    assert.ok(!prompt.includes('OLD_ROLE_ONLY'))
  }
})

test('other scenarios continue to receive their applied role context', () => {
  for (const build of builders) {
    const prompt = build([], { scenarioId: 'general', roleContext: '负责验收支付模块' })
    assert.ok(prompt.includes('负责验收支付模块'))
    assert.ok(!prompt.includes('京东 TET'))
  }
})

test('TET without a supplied case instructs analysis to acknowledge the missing material', () => {
  const prompt = buildSpeakingHintsPrompt([], { scenarioId: 'jd-tet' })
  assert.ok(prompt.includes('未提供题目时，明确提示缺少题目'))
  assert.ok(prompt.includes('不自行生成案例或假定任务'))
})
