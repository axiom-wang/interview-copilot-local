import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'
import {
  composePromptWithGlobalSystemPrompt,
  formatOptionalPromptContext,
  formatSegmentsForPrompt,
} from './promptUtils'

export const buildDetectPhasePrompt = (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) =>
  composePromptWithGlobalSystemPrompt(`
请根据以下最近 90 秒群面转写，判断当前讨论阶段。

阶段定义如下：
- problem-framing：
  正在澄清题目、目标、用户、约束、评价标准、边界条件，或在重新定义问题。
- option-divergence：
  正在发散多个方案/方向/思路，提出不同做法，但尚未明显比较取舍。
- alignment-building：
  正在对多个方案进行比较、取舍、整合，尝试形成共识、化解分歧、统一主线。
- decision-lock：
  已基本达成方向，正在敲定最终结论、汇报结构、分工、表述口径或最后收束。

判断要求：
1. 只选一个最主导阶段。
2. 不要被个别句子误导，要看最近这段讨论的整体主线。
3. 如果阶段正在切换，选择“当前更占主导”的那个阶段，并在 reason 中体现切换迹象。
4. 特别关注以下群面信号：
   - 是否在讨论“先统一标准/题目理解/用户/目标”
   - 是否在“提多个方案”
   - 是否在“比较、取舍、融合、说服”
   - 是否在“定结论、定汇报、定分工”

输出严格为 JSON：
{
  "phase": "problem-framing | option-divergence | alignment-building | decision-lock",
  "confidence": 0-1之间的小数,
  "nextAction": "一句话描述当前最合适的下一步动作",
  "reason": "用简洁中文说明为什么判断为该阶段，最好指出1-2个明显信号"
}

${formatOptionalPromptContext(context)}

转写内容：
${formatSegmentsForPrompt(segments)}
`.trim())

