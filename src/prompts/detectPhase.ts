import { resolveScenarioProfile } from '../scenarios'
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
) => {
  const profile = resolveScenarioProfile(context?.scenarioId)
  const phaseDefinitions = Object.entries(profile.phaseDefinitions)
    .map(([phase, definition]) => `- ${phase}（${profile.phaseLabels[phase as keyof typeof profile.phaseLabels]}）：\n  ${definition}`)
    .join('\n')
  const phaseSignals = profile.phaseSignals
    .map((signal) => `   - ${signal}`)
    .join('\n')

  return composePromptWithGlobalSystemPrompt(`
请根据以下最近 90 秒转写，判断当前讨论阶段。

阶段定义如下：
${phaseDefinitions}

判断要求：
1. 只选一个最主导阶段。
2. 不要被个别句子误导，要看最近这段讨论的整体主线。
3. 如果阶段正在切换，选择“当前更占主导”的那个阶段，并在 reason 中体现切换迹象。
4. 特别关注以下场景信号：
${phaseSignals}

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
`.trim(), profile)
}

