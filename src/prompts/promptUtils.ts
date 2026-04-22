import type { AnalysisPromptContext, SummaryAssemblyContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'

export const GLOBAL_GROUP_INTERVIEW_SYSTEM_PROMPT = `
你是一个“中文群面实时辅助分析器”，服务于互联网/产品/HR/运营等结构化群体面试场景。

你的任务不是泛泛总结，而是识别“当前讨论在推进什么、缺什么、下一步最该做什么”。

请始终遵守以下原则：

1. 优先分析“讨论过程”，而不是只总结表面内容。
2. 只基于输入文本判断，不要编造未出现的事实、数据、角色立场或结论。
3. 群面有效信息通常围绕以下维度出现：
   - 题目目标
   - 用户/对象
   - 核心痛点
   - 约束条件（预算、周期、资源、合规、技术可行性）
   - 方案选项
   - 比较与取舍
   - 风险与兜底
   - 分工与落地
   - 汇报与总结
4. 请自动忽略以下低价值内容：
   - 寒暄、附和、口头禅、重复表态
   - 与题目无关的闲聊
   - 没有新增信息的重复复述
5. 当证据不足时，要明确降低置信度，并指出“仍缺哪些关键点”。
6. 输出必须简洁、结构化、可直接驱动前端 UI。
7. 除非特别要求，不要输出长篇解释，不要输出 Markdown，不要输出代码块。
8. 如果输入里存在明显分歧，要区分：
   - 稳定共识
   - 正在争论的分歧
   - 尚未讨论到的缺口
9. 你要特别关注“当前阶段最合适的动作”，即：
   - 推进结构
   - 补齐信息
   - 化解分歧
   - 收敛结论
   - 分工落地
   - 汇报总结
10. 你的语言风格应像一个高水平群面陪练：冷静、判断清楚、可执行，不空泛。
`.trim()

const normalizeContextValue = (value: string | undefined) => {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

const stringifyTranscriptLine = (segment: TranscriptSegment) => {
  const clock = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(segment.timestamp)

  return `[${clock}] ${segment.speaker}: ${segment.text}`
}

export const formatSegmentsForPrompt = (segments: TranscriptSegment[]) =>
  segments.map(stringifyTranscriptLine).join('\n')

export const formatSummaryAssemblyContext = (
  summaryAssemblyContext: SummaryAssemblyContext | undefined,
) => {
  if (!summaryAssemblyContext) {
    return ''
  }

  const sections: string[] = []

  if (summaryAssemblyContext.phase?.trim()) {
    sections.push(`phase: ${summaryAssemblyContext.phase.trim()}`)
  }

  if (summaryAssemblyContext.consensus?.length) {
    sections.push(
      `consensus:\n${summaryAssemblyContext.consensus
        .map((item) => `- ${item}`)
        .join('\n')}`,
    )
  }

  if (summaryAssemblyContext.tensions?.length) {
    sections.push(
      `tensions:\n${summaryAssemblyContext.tensions
        .map((item) => `- ${item}`)
        .join('\n')}`,
    )
  }

  if (summaryAssemblyContext.missing?.length) {
    sections.push(
      `missing:\n${summaryAssemblyContext.missing
        .map((item) => `- ${item}`)
        .join('\n')}`,
    )
  }

  if (summaryAssemblyContext.mindMap) {
    const nodes = summaryAssemblyContext.mindMap.nodes
      .map((node) => `- ${node.type}: ${node.data.label}`)
      .join('\n')
    sections.push(`mindMapTopic: ${summaryAssemblyContext.mindMap.topic}\nmindMapNodes:\n${nodes}`)
  }

  if (summaryAssemblyContext.transcript?.length) {
    sections.push(
      `assemblyTranscript:\n${summaryAssemblyContext.transcript
        .map(stringifyTranscriptLine)
        .join('\n')}`,
    )
  }

  if (sections.length === 0) {
    return ''
  }

  return `
summaryAssemblyContext（结构化补充）：
${sections.join('\n\n')}
`.trim()
}

export const formatOptionalPromptContext = (
  context?: AnalysisPromptContext,
) => {
  const questionContext = normalizeContextValue(context?.questionContext)
  const roleContext = normalizeContextValue(context?.roleContext)
  const phaseContext = normalizeContextValue(context?.phaseContext)
  const summaryAssemblyContext = formatSummaryAssemblyContext(
    context?.summaryAssemblyContext,
  )

  const sections: string[] = []

  if (questionContext) {
    sections.push(`面试题背景：${questionContext}`)
  }

  if (roleContext) {
    sections.push(`用户角色：${roleContext}`)
  }

  if (phaseContext) {
    sections.push(`当前讨论阶段：${phaseContext}`)
  }

  if (summaryAssemblyContext) {
    sections.push(summaryAssemblyContext)
  }

  if (sections.length === 0) {
    return ''
  }

  return `
可选上下文：
${sections.join('\n\n')}
`.trim()
}

export const composePromptWithGlobalSystemPrompt = (taskPrompt: string) =>
  `${GLOBAL_GROUP_INTERVIEW_SYSTEM_PROMPT}

---
任务指令：
${taskPrompt.trim()}`

