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
  const focus = profile.minutesFocus.map((item) => `- ${item}`).join('\n')

  return composePromptWithGlobalSystemPrompt(
    `
请根据当前会话全部有效转写，生成一份标准、客观、可归档的会议纪要。

当前场景应重点关注：
${focus}

要求：
1. 只记录转写中明确出现或可直接归纳的信息，不得编造。
2. overview 用 2-4 句话概括目标、讨论主线和结果。
3. topics 按实际议题分组，每组保留高信息密度要点。
4. conclusion 仅记录该议题已形成的结论；没有明确结论时使用空字符串。
5. decisions 只列已明确达成的决定，不要把建议或倾向写成决定。
6. openQuestions 列出仍待确认的问题、风险或依赖。
7. actionItems 的 task 必须可执行；无法从转写确定负责人或时间时，owner 或 due 使用空字符串。
8. 合并重复内容，忽略寒暄、口头禅和无新增信息的附和。

输出严格为 JSON：
{
  "title": "会议纪要标题",
  "overview": "会议概览",
  "topics": [
    {
      "topic": "议题名称",
      "points": ["讨论要点1", "讨论要点2"],
      "conclusion": "该议题结论，未确定则为空字符串"
    }
  ],
  "decisions": ["已定决策"],
  "openQuestions": ["待定问题"],
  "actionItems": [
    {
      "owner": "负责人，无法确定则为空字符串",
      "task": "行动任务",
      "due": "截止时间，无法确定则为空字符串"
    }
  ]
}

${formatOptionalPromptContext(context)}

全部有效转写：
${formatSegmentsForPrompt(segments)}
`.trim(),
    profile,
  )
}
