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
  const questionContext = normalizeContextValue(context?.questionContext)
  const roleContext = normalizeContextValue(context?.roleContext)
  const phaseContext = normalizeContextValue(context?.phaseContext)
  const sessionSummary = formatSessionSummary(context)

  const sections: string[] = []

  if (questionContext) {
    sections.push(`面试题信息：\n${questionContext}`)
  }

  if (roleContext) {
    sections.push(`用户角色：\n${roleContext}`)
  }

  if (phaseContext) {
    sections.push(`当前阶段：\n${phaseContext}`)
  }

  if (sessionSummary) {
    sections.push(`完整讨论主线摘要：\n${sessionSummary}`)
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
) =>
  composePromptWithGlobalSystemPrompt(`
请综合以下信息，生成“当前最实战的群面发言建议”：

信息优先级如下（必须遵守）：
1. 优先理解面试题本身要回答什么，包括题目目标、用户对象、约束条件、角色诉求。
2. 其次参考完整会话中已经形成的讨论主线，包括：已有共识、当前分歧、整体阶段、已讨论过的重点。
3. 最后结合最近 90 秒转写，判断“此刻”最适合插入什么功能性动作。
4. 不要只盯着最近 90 秒的表面内容，而忽略整场讨论主线和题目本身。

你的目标不是写一段漂亮空话，而是判断：在当前这个时点，用户最适合承担哪一种“功能性动作”，才能最有效推动团队讨论。

functionType 必须严格从以下 6 类中选 1 类：
- 推进结构：当讨论散、重复、没有统一顺序时，用于定义框架、明确讨论路径
- 补齐信息：当讨论缺用户场景、约束条件、风险、数据假设、落地细节时，用于补关键缺口
- 化解分歧：当存在明显冲突、争论或口径不统一时，用于搭桥、整合、降冲突
- 收敛结论：当讨论已经充分发散，需要形成方向或统一结论时，用于收束
- 分工落地：当方向已较清楚，需要明确汇报结构、分工、执行次序时，用于推进落地
- 汇报总结：当接近结束、需要代表团队表达结论时，用于正式总结和汇报

判断原则：
1. 只能选当前“最优先”的一个动作，不要平均分配。
2. 先判断“题目此时最缺什么”，再判断“最近 90 秒最适合补什么”。
3. 优先选择能对团队推进最有帮助的动作，而不是最能展示个人的动作。
4. 如果最近 90 秒内容较窄、较碎或信息不足，不要被局部带偏，要回到题目要求和整场讨论主线。
5. 建议必须符合群面口语风格，像真实候选人会说的话，不要像AI作文。
6. 建议必须和题目、当前阶段、完整讨论脉络保持一致，不能脱离上下文。
7. 如果证据不足，也要给出最稳健的建议，不要输出空泛模板。

你在判断时应特别关注：
- 当前讨论是否已经回答了题目的核心问题
- 当前是否缺少用户视角、约束意识、风险意识、落地路径
- 当前是更需要继续发散，还是更需要比较、收敛、分工或总结
- 最近 90 秒是在推进主线，还是只是局部争论/局部补充

输出严格为 JSON：
{
  "functionType": "推进结构 | 补齐信息 | 化解分歧 | 收敛结论 | 分工落地 | 汇报总结",
  "whyNow": "一句话说明为什么当前最适合做这个动作，需同时体现题目要求与当前讨论状态",
  "hint15s": "15秒内能说完的口语版建议",
  "hint30s": "30秒左右的口语版建议",
  "hint60s": "60秒左右的口语版建议"
}

语言要求：
- 口语化
- 不抢功
- 不强势压人
- 强调“我们”“大家”
- 避免空泛框架词堆砌
- 尽量体现用户视角、约束意识、收敛意识、协作意识
- 如果有角色设定，建议应尽量兼顾该角色关注点，但不能损害团队整体推进

${formatSpeakingHintsContext(context)}

最近 90 秒转写：
${formatSegmentsForPrompt(segments)}
`.trim())
