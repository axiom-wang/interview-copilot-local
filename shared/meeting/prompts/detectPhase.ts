import { resolveScenarioProfile, type MeetingScenarioProfile } from '../scenarios'
import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'
import {
  composePromptWithGlobalSystemPrompt,
  formatOptionalPromptContext,
  formatTranscriptSection,
} from './promptUtils'

export const buildDetectPhaseTask = (profile: MeetingScenarioProfile) => `
以全程记录末尾的最新发言判断当前议题阶段，更早的记录用于核对主线。阶段可以往返，不能把阶段分类当作必走流程。
${Object.entries(profile.phaseDefinitions).map(([phase, definition]) =>
  `- ${phase}（${profile.phaseLabels[phase as keyof typeof profile.phaseLabels]}）：${definition}`).join('\n')}
参考信号：${profile.phaseSignals.join('；')}。
只选当前最主导阶段，reason 简述依据或切换迹象，confidence 表示证据充分程度，nextAction 按题目与现场需要给出下一步，有时间预算时结合剩余时间。
输出 JSON：{"phase":"阶段枚举", "confidence":0.8, "nextAction":"下一步", "reason":"判断依据"}
`.trim()

export const buildDetectPhasePrompt = (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) => composePromptWithGlobalSystemPrompt(`
${buildDetectPhaseTask(resolveScenarioProfile(context?.scenarioId))}

${formatOptionalPromptContext(context)}

${formatTranscriptSection(segments, context)}
`, resolveScenarioProfile(context?.scenarioId))
