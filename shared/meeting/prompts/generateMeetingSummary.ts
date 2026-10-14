import { resolveScenarioProfile } from '../scenarios'
import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'
import {
  composePromptWithGlobalSystemPrompt,
  formatOptionalPromptContext,
  formatSegmentsForPrompt,
} from './promptUtils'

export const buildGenerateMeetingSummaryPrompt = (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) => {
  const profile = resolveScenarioProfile(context?.scenarioId)

  return composePromptWithGlobalSystemPrompt(`
根据全程有效记录生成${profile.summaryPurpose}。

speech60s 是可直接口播的总结稿（沿用字段名），${profile.spokenSummaryLengthHint}。
先回答题目或会议目标，结构按实际交付要求组织，可以是排序、观点论证、方案选择或其他结果。用自然口语讲清结论及理由；风险、落地或下一步仅在相关且实际讨论过时纳入。
未形成一致结论时说明当前倾向与未决分歧，不替团队选择答案。keyPoints 提取关键内容，nextSteps 仅列实际讨论的后续事项；没有时返回空数组。

输出 JSON：
{
  "speech60s": "自然口语总结稿",
  "keyPoints": ["关键要点"],
  "nextSteps": ["已讨论的下一步"]
}

${formatOptionalPromptContext(context)}

最近原话（结果覆盖整场会议）：
${formatSegmentsForPrompt(segments)}
`.trim(), profile)
}
