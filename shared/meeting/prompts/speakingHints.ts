import { resolveScenarioProfile } from '../scenarios'
import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'
import {
  composePromptWithGlobalSystemPrompt,
  formatSegmentsForPrompt,
} from './promptUtils'

const normalizeContextValue = (value: string | undefined) => {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

const formatSessionSummary = (context?: AnalysisPromptContext) => {
  const summaryAssemblyContext = context?.summaryAssemblyContext

  if (!summaryAssemblyContext) {
    return null
  }

  const sections: string[] = []

  if (summaryAssemblyContext.consensus?.length) {
    sections.push(
      `已有共识：\n${summaryAssemblyContext.consensus
        .map((item) => `- ${item}`)
        .join('\n')}`,
    )
  }

  if (summaryAssemblyContext.tensions?.length) {
    sections.push(
      `当前分歧：\n${summaryAssemblyContext.tensions
        .map((item) => `- ${item}`)
        .join('\n')}`,
    )
  }

  if (summaryAssemblyContext.missing?.length) {
    sections.push(
      `仍缺关键点：\n${summaryAssemblyContext.missing
        .map((item) => `- ${item}`)
        .join('\n')}`,
    )
  }

  if (summaryAssemblyContext.mindMap) {
    const nodeLabels = summaryAssemblyContext.mindMap.nodes
      .map((node) => node.data.label.trim())
      .filter((label) => label.length > 0)

    const dedupedLabels = [...new Set(nodeLabels)]

    if (summaryAssemblyContext.mindMap.topic.trim() || dedupedLabels.length > 0) {
      const focusLines: string[] = []

      if (summaryAssemblyContext.mindMap.topic.trim()) {
        focusLines.push(`- 主题：${summaryAssemblyContext.mindMap.topic.trim()}`)
      }

      if (dedupedLabels.length > 0) {
        focusLines.push(...dedupedLabels.map((label) => `- ${label}`))
      }

      sections.push(`已讨论过的重点：\n${focusLines.join('\n')}`)
    }
  }

  if (sections.length === 0) {
    return null
  }

  return sections.join('\n\n')
}

const formatSpeakingHintsContext = (context?: AnalysisPromptContext) => {
  const profile = resolveScenarioProfile(context?.scenarioId)
  const questionContext = normalizeContextValue(context?.questionContext)
  const roleContext = profile.roleContextEnabled === false
    ? null
    : normalizeContextValue(context?.roleContext)
  const phaseContext = normalizeContextValue(context?.phaseContext)
  const sessionSummary = formatSessionSummary(context)

  const sections: string[] = []

  if (context?.meetingHistory) sections.push(context.meetingHistory)
  if (context?.previousParticipantView) sections.push(`AI 上一轮的参会观点（尚未实际发言或被团队接受，不是会议事实）：${JSON.stringify(context.previousParticipantView)}`)

  if (questionContext) {
    sections.push(`${profile.topicContextLabel}：\n${questionContext}`)
  }

  if (roleContext) {
    sections.push(`${profile.roleContextLabel}：\n${roleContext}`)
  }

  if (phaseContext) {
    const phaseLabel =
      profile.phaseLabels[phaseContext as keyof typeof profile.phaseLabels] ??
      phaseContext
    sections.push(`当前阶段：\n${phaseLabel}`)
  }

  if (sessionSummary) {
    sections.push(`此前分析结果（辅助信息，以全程原话和最新明确变更为准）：\n${sessionSummary}`)
  }

  if (sections.length === 0) {
    return ''
  }

  return `
可用上下文：
${sections.join('\n\n')}
`.trim()
}

export const buildSpeakingHintsPrompt = (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) => {
  const profile = resolveScenarioProfile(context?.scenarioId)
  const styleRules = profile.hintStyleRules
    .map((rule) => `- ${rule}`)
    .join('\n')

  return composePromptWithGlobalSystemPrompt(`
结合题目、全程讨论与最近 90 秒发言，给出此刻值得说的一点内容。优先贡献具体观点、理由、计算、追问或反例；只有现场需要时才建议组织讨论。

functionType 根据内容选择：倾听观察、提出观点、检验推理、补齐信息、化解分歧、推进结构、收敛结论、分工落地、汇报总结。分类仅用于展示，不限定思考路径。
没有新增价值时选择倾听观察，whyNow 说明正在等待什么；hint60s、hint120s 均为空字符串。

发言要求：
- 两个版本围绕同一个核心贡献。hint60s 是约 60 秒的完整发言；hint120s 是约 120 秒的展开版，增加有用的论证、例子或比较，不重复填充。
- 时长是参考，内容不足时可以更短；不编造数字、事实或他人的发言来凑长度。
- 直接说内容，不必先认同再总结，结尾也不必邀请大家对齐。依据够明确时表达判断，需要澄清时问具体问题。
${styleRules}

输出 JSON：
{
  "functionType": "动作类型",
  "whyNow": "简短说明当前值得说的内容及切入时机",
  "hint60s": "约60秒的自然口语发言",
  "hint120s": "约120秒的自然口语展开版"
}

${formatSpeakingHintsContext(context)}

最近 90 秒转写：
${formatSegmentsForPrompt(segments)}
`.trim(), profile)
}
