import { resolveScenarioProfile } from '../scenarios'
import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'
import {
  composePromptWithGlobalSystemPrompt,
  formatOptionalPromptContext,
  formatSegmentsForPrompt,
} from './promptUtils'

export const buildGenerateMindMapPrompt = (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) => {
  const profile = resolveScenarioProfile(context?.scenarioId)
  return composePromptWithGlobalSystemPrompt(`
根据全程讨论和最近 3 分钟的变化生成当前思维导图，保留仍有效的早期约束与决定，移除已撤销结论。
按实际内容组织分支，相关时参考：${profile.valueDimensions.join('、')}。节点简短、无重复；不为填满结构制造内容，未决事项明确标识。

返回适合 React Flow 的 JSON：topic 为主题；nodes 包含唯一 id、type（root/branch/leaf）、position（x/y）和 data.label；edges 包含唯一 id、source 和 target，引用真实节点。
包含一个 root，其余按需要生成，通常总计 4—8 个节点。root 在左侧，branch 和 leaf 依次向右，纵向留出间距避免重叠。材料少时使用更简结构，不因最近窗口短而丢失历史主线。

${formatOptionalPromptContext(context)}

最近 3 分钟转写：
${formatSegmentsForPrompt(segments)}
`.trim(), profile)
}
