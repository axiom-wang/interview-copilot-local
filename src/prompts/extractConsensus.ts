import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'
import {
  composePromptWithGlobalSystemPrompt,
  formatOptionalPromptContext,
  formatSegmentsForPrompt,
} from './promptUtils'

export const buildExtractConsensusPrompt = (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) =>
  composePromptWithGlobalSystemPrompt(`
请根据以下最近 90 秒群面转写，提取当前“已形成共识、存在分歧、仍缺失关键点”。

分析要求：
1. “已形成共识”必须满足以下至少一项：
   - 多人明确认可
   - 被反复复述且无人反对
   - 已成为后续讨论默认前提
2. “当前分歧”指：
   - 明确存在不同方案、不同优先级、不同取舍标准
   - 或表面一致但实际口径未统一
3. “仍缺失关键点”指：
   - 这道题要得出高质量方案本应讨论，但当前尚未覆盖或覆盖不足的关键维度

在群面中，关键点通常优先从以下维度检查：
- 题目目标是否明确
- 核心用户/对象是否明确
- 成功标准或评价标准是否明确
- 资源/预算/周期/可行性是否讨论
- 风险与兜底是否讨论
- 落地步骤是否讨论
- 团队汇报结构是否准备

请不要把以下内容当成高质量共识：
- 口头附和
- 重复原题
- 没有新增信息的复述
- 模糊口号式表达

输出严格为 JSON：
{
  "consensus": [
    "当前已形成的稳定共识1",
    "当前已形成的稳定共识2"
  ],
  "tensions": [
    "当前最核心分歧1",
    "当前最核心分歧2"
  ],
  "missing": [
    "仍未充分讨论的关键点1",
    "仍未充分讨论的关键点2"
  ]
}

要求：
- 每条不超过22个字
- 优先输出最有决策价值的2-4条
- 宁缺毋滥，不要凑数

${formatOptionalPromptContext(context)}

转写内容：
${formatSegmentsForPrompt(segments)}
`.trim())

