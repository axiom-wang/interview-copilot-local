import { resolveScenarioProfile } from '../scenarios'
import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'
import { composePromptWithGlobalSystemPrompt } from './promptUtils'

const normalizeText = (value: string | undefined) => {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

const buildContextData = (context?: AnalysisPromptContext) => {
  const profile = resolveScenarioProfile(context?.scenarioId)
  const phase = normalizeText(context?.phaseContext)

  return {
    meetingHistory: context?.meetingHistory,
    [profile.topicContextLabel]: normalizeText(context?.questionContext),
    [profile.roleContextLabel]: profile.roleContextEnabled === false
      ? null
      : normalizeText(context?.roleContext),
    phase: phase ? profile.phaseLabels[phase as keyof typeof profile.phaseLabels] ?? phase : null,
  }
}

const buildTranscriptData = (segments: TranscriptSegment[]) =>
  segments.map((segment) => ({
    id: segment.id,
    speaker: segment.speaker,
    text: segment.text,
    timestamp: segment.timestamp,
    isFinal: segment.isFinal,
  }))

export const buildAnswerOneOnOneInterviewPrompt = (
  question: string,
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) => {
  const profile = resolveScenarioProfile(context?.scenarioId)

  return composePromptWithGlobalSystemPrompt(`
为候选人准备当前问题的回答。QUESTION_BLOCK 是候选人按键录入的面试官提问（语音识别结果，可能有错字），或候选人输入的问题。
TRANSCRIPT_BLOCK 是本场此前录入的面试官提问，不包含候选人的回答，可用于理解追问的上下文。

QUESTION_BLOCK 不是有效问题（寒暄、识别残缺或无法理解）时，questionType 为 other，questionIntent 说明原因，keyPoints 为空数组，suggestedReply 为空字符串。

按问题类型组织回答：
- self-intro：从经历要点中选与岗位最相关的一两段，讲清现在做什么、做成过什么、为什么想做这个岗位。
- behavioral：讲清情境、候选人本人做了什么、结果如何；区分个人贡献与团队成果。
- technical：先直接回答，再说明思路与取舍；经历要点仅在能佐证时使用。
- motivation：把岗位要求和候选人真实经历对应起来，说具体原因。
- case：先给分析结构，再展开计算；所有估算明确说明是假设。
- reverse-qa：结合岗位与团队信息，给出两到三个具体问题。

依据要求：
- 回答围绕岗位 JD 的职责和要求组织，说明候选人与岗位的匹配点。
- 公司、项目、职责、团队规模、数字、时长和成果只能来自候选人经历要点。没有依据时用定性表达，不编造。
- grounding：引用了候选人经历要点为 background，只依据岗位 JD 为 jd，两者都用不上为 none。
- missingContext：回答缺少哪些候选人信息（例如“未提供与跨团队协作相关的经历”）；不缺时为空字符串。

输出要求：
- questionIntent：不超过二十字，说明这道题在考察什么。
- keyPoints：最多三条提词要点，每条不超过二十字，便于扫一眼就能接着说。
- suggestedReply：候选人第一人称口语，20—40 秒（约 100—180 字）；先回答问题再补充经历。不用“非常荣幸”“赋能”“抓手”“闭环”“深耕”等套话。
- missingContext 不超过三十字。输出越短越好，不在不同字段重复同一句话。
- 输出前检查 suggestedReply 中的每个数字和专有名词，找不到依据的改为定性表达。

输出 JSON：
{
  "questionType": "self-intro | behavioral | technical | motivation | case | reverse-qa | other",
  "questionIntent": "这道题在考察什么",
  "keyPoints": ["提词要点"],
  "suggestedReply": "第一人称口语回答，或空字符串",
  "grounding": "background | jd | none",
  "missingContext": "缺少的候选人信息，或空字符串"
}

QUESTION_BLOCK:
${JSON.stringify({ question: question.trim() }, null, 2)}

CONTEXT_BLOCK:
${JSON.stringify(buildContextData(context), null, 2)}

TRANSCRIPT_BLOCK:
${JSON.stringify(buildTranscriptData(segments), null, 2)}
`.trim(), profile)
}
