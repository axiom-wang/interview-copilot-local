import { resolveScenarioAssistance } from '../scenarios/assistance'
import { resolveScenarioProfile, type MeetingScenarioProfile } from '../scenarios'
import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'
import {
  composePromptWithGlobalSystemPrompt,
  formatOptionalPromptContext,
  formatTranscriptSection,
} from './promptUtils'

export const buildExtractConsensusTask = (profile: MeetingScenarioProfile) => `
提取全程讨论中当前仍有效的共识、分歧和关键缺口，结合最新发言带来的变化更新。
共识需多人明确认可，或明确决策确认且相关异议已处理；分歧记录不同判断、标准或方案，已解决的不再列出。缺口仅针对题目需要，不把参考维度当成必答清单。
相关时参考：${profile.valueDimensions.join('、')}。每类最多 4 条，简短但保留判断所需信息，无内容时返回空数组。

participantView 是 AI 此刻的参会观点：understanding 简述对讨论的理解；intent 选择 contribute、clarify、challenge 或 listen；contribution 给出一点自然发言，不复读；listen 时 contribution 为空，reason 说明等待什么。
scenarioFocus 的 label 从 ${resolveScenarioAssistance(profile.id).dimensions.join('、')} 中选，每类最多一条；detail 说明具体信息或建议，建议明确标识。
两者的 evidenceIds 只引用真实转写 id；无直接原话依据的建议用空数组。AI 观点不能自动成为共识。

输出 JSON：
{
  "participantView": {"understanding":"当前理解", "intent":"contribute", "contribution":"候选发言", "reason":"依据与时机", "evidenceIds":[]},
  "scenarioFocus": [{"label":"场景重点", "detail":"具体内容", "evidenceIds":[]}],
  "consensus": [],
  "tensions": [],
  "missing": []
}
`.trim()

export const buildExtractConsensusPrompt = (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) => composePromptWithGlobalSystemPrompt(`
${buildExtractConsensusTask(resolveScenarioProfile(context?.scenarioId))}

${formatOptionalPromptContext(context)}

${formatTranscriptSection(segments, context)}
`, resolveScenarioProfile(context?.scenarioId))
