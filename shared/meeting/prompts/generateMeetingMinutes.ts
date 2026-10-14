import { resolveScenarioProfile } from '../scenarios'
import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'
import {
  composePromptWithGlobalSystemPrompt,
  formatOptionalPromptContext,
  formatSegmentsForPrompt,
} from './promptUtils'

export const buildGenerateMeetingMinutesPrompt = (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) => {
  const profile = resolveScenarioProfile(context?.scenarioId)
  return composePromptWithGlobalSystemPrompt(`
根据全程有效记录生成客观会议纪要，关注：${profile.minutesFocus.join('、')}。
overview 简述目标、主线和结果；topics 按实际议题组织 points，conclusion 仅记已形成结论，无结论时为空。
decisions 仅列明确决定；openQuestions 记录未决问题；actionItems 仅列实际讨论的行动，owner 或 due 不明确时为空。数组无内容时返回空数组。

输出 JSON：
{
  "title": "会议标题",
  "overview": "会议概述",
  "topics": [{"topic":"议题", "points":[], "conclusion":"结论或空字符串"}],
  "decisions": [],
  "openQuestions": [],
  "actionItems": [{"owner":"负责人或空字符串", "task":"实际行动", "due":"期限或空字符串"}]
}

${formatOptionalPromptContext(context)}

最近原话（纪要覆盖整场会议）：
${formatSegmentsForPrompt(segments)}
`.trim(), profile)
}
