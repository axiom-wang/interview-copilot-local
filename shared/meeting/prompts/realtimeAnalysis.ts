import { resolveScenarioProfile } from '../scenarios'
import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'
import { buildDetectPhaseTask } from './detectPhase'
import { buildExtractConsensusTask } from './extractConsensus'
import { composePromptWithGlobalSystemPrompt, formatOptionalPromptContext, formatTranscriptSection } from './promptUtils'

export const buildRealtimeAnalysisPrompt = (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) => {
  const profile = resolveScenarioProfile(context?.scenarioId)
  return composePromptWithGlobalSystemPrompt(`
完成两项分析，只输出一个 JSON 对象，分别将结果放入 phaseAnalysis 和 consensusAnalysis。

阶段分析任务：
${buildDetectPhaseTask(profile)}

共识分析任务：
${buildExtractConsensusTask(profile)}

${formatOptionalPromptContext(context)}

${formatTranscriptSection(segments, context)}
`, profile)
}
