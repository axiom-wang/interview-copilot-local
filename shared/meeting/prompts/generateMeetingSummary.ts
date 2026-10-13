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
请根据“当前会话全部有效转写”生成一份${profile.summaryPurpose}。

你的任务不是写一篇泛泛的作文，而是把本场讨论压缩并结构化为一段**结论清晰、逻辑完整、可直接口头汇报**的总结。

你的输出需要包含：
1. 一个可直接口播的总结稿（${profile.spokenSummaryLengthHint}）
2. 4-6 条最关键要点
3. 3-5 条清晰的下一步

请在以下方面进行有效展开：
- 核心方案（如何做）
- 方案背后的取舍逻辑（为什么这样做）
- 风险或约束（有什么问题）
- 落地路径（如何推进）

严禁通过重复或堆砌描述来增加长度。

处理要求：
1. 优先使用 final 片段中的有效信息。
2. 只保留与会议目标相关、能代表团队结论的内容。
3. 忽略以下内容：
   - 闲聊
   - 重复表态
   - 没有实质推进的附和
   - 与会议目标无关的跑题内容
4. 如果仍存在未解决分歧，不要假装完全达成一致；可以使用：
   - “目前更倾向于……”
   - “当前主要共识是……”
   - “建议优先……”
5. 口播稿必须像真实${profile.participantPersona}的汇报，而不是书面报告或 AI 作文。
6. 必须使用“我们 / 大家 / 团队”表达，而不是只陈述个人观点。
7. 第一段必须直接给出结论，不要铺垫背景。

结构要求（强约束）：
总结稿必须遵循以下结构展开：
1. 结论（先亮结论）
2. 核心方案/主线（做什么）
3. 逻辑或取舍（为什么）
4. 风险或约束（注意什么）
5. 落地或下一步（怎么推进）

关键约束：
1. 输出必须服务于当前会议目标，而不是复述讨论过程。
2. 所有结论、方案、判断必须来源于转写或其合理归纳。
3. 严禁引入转写中未出现的新观点、方案、数据或假设。
4. 允许压缩整合，但不得凭空扩展。
5. 如果信息不足，应使用“倾向/建议”等不确定性表达，而不是编造结论。

要点与下一步要求：
keyPoints：
- 优先输出 4-6 条关键要点
- 每条必须支撑结论或方案，而不是简单复述
- 保持精简、有信息密度

nextSteps：
- 优先输出 3-5 条下一步
- 每条需体现“可执行性”（做什么 + 大致怎么做）
- 避免空泛或重复

输出严格为 JSON：
{
  "speech60s": "一段可直接口播的总结发言",
  "keyPoints": [
    "关键要点1",
    "关键要点2",
    "关键要点3"
  ],
  "nextSteps": [
    "下一步1",
    "下一步2"
  ]
}

长度要求：
- speech60s：${profile.spokenSummaryLengthHint}，口语化、结构清晰
- keyPoints：4-6条，每条不超过20字
- nextSteps：3-5条，每条不超过20字

${formatOptionalPromptContext(context)}

全部有效转写：
${formatSegmentsForPrompt(segments)}
`.trim(), profile)
}