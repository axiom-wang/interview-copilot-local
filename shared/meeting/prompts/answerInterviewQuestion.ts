import { resolveScenarioProfile } from '../scenarios'
import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'
import { composePromptWithGlobalSystemPrompt } from './promptUtils'

const normalizeText = (value: string | undefined) => {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

const buildContextData = (context?: AnalysisPromptContext) => ({
  meetingHistory: context?.meetingHistory,
  previousAiViewNotMeetingFact: context?.previousParticipantView,
  questionContext: normalizeText(context?.questionContext),
  roleContext: resolveScenarioProfile(context?.scenarioId).roleContextEnabled === false
    ? null
    : normalizeText(context?.roleContext),
  phase: normalizeText(context?.phaseContext),
  consensus: context?.summaryAssemblyContext?.consensus ?? [],
  tensions: context?.summaryAssemblyContext?.tensions ?? [],
  missing: context?.summaryAssemblyContext?.missing ?? [],
})

const buildTranscriptData = (segments: TranscriptSegment[]) =>
  segments.map((segment) => ({
    id: segment.id,
    speaker: segment.speaker,
    text: segment.text,
    timestamp: segment.timestamp,
    isFinal: segment.isFinal,
  }))

export const buildAnswerInterviewQuestionPrompt = (
  question: string,
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) => {
  const profile = resolveScenarioProfile(context?.scenarioId)

  return composePromptWithGlobalSystemPrompt(`
回答用户的实时问题，先给判断，再给支撑判断的依据；依据不足时说明缺少什么。可提出有理由的新解释或建议，明确其性质。
suggestedReply 给出可直接说出口的自然发言，长度按问题需要决定，可以是一句追问或一段论证。不要套用“承接—判断—推进”结构；没有值得说的内容时留空。本任务不提供思维导图，不假设导图证据。

输出 JSON：
{
  "conclusion": "直接回答问题",
  "reasoning": ["相关事实或推理依据"],
  "suggestedReply": "自然口语发言，或空字符串"
}

QUESTION_BLOCK:
${JSON.stringify({ question: question.trim() }, null, 2)}

CONTEXT_BLOCK:
${JSON.stringify(buildContextData(context), null, 2)}

TRANSCRIPT_BLOCK:
${JSON.stringify(buildTranscriptData(segments), null, 2)}
`.trim(), profile)
}
