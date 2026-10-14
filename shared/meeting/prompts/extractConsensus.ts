import { resolveScenarioAssistance } from '../scenarios/assistance'
import { resolveScenarioProfile } from '../scenarios'
import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'
import {
  composePromptWithGlobalSystemPrompt,
  formatOptionalPromptContext,
  formatSegmentsForPrompt,
} from './promptUtils'

export const buildExtractConsensusPrompt = (
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
) => {
  const profile = resolveScenarioProfile(context?.scenarioId)
  const dimensions = profile.valueDimensions
    .map((dimension) => `- ${dimension}`)
    .join('\n')

  return composePromptWithGlobalSystemPrompt(`
请根据全程会议记录及最近 90 秒的新变化，提取当前仍有效的“已形成共识、存在分歧、仍缺失关键点”。早期共识不能因离开窗口而消失；已解决的分歧不再列出，已撤销的决定不得作为当前共识。

分析要求：
1. “已形成共识”必须满足以下至少一项：
   - 多人明确认可
   - 有明确决策确认，且相关异议已得到处理
   不得把反复复述、无人反对或默认前提单独作为共识证据。
2. “当前分歧”指：
   - 明确存在不同方案、不同优先级、不同取舍标准
   - 或表面一致但实际口径未统一
3. “仍缺失关键点”指：
   - 要形成高质量结论本应讨论，但当前尚未覆盖或覆盖不足的关键维度

在当前场景中，关键点通常优先从以下维度检查：
${dimensions}

请不要把以下内容当成高质量共识：
- 口头附和
- 重复原题
- 没有新增信息的复述
- 模糊口号式表达

输出严格为 JSON：
{
  "participantView": {
    "understanding": "我对当前议题与全程讨论关系的理解",
    "intent": "contribute",
    "contribution": "我此刻有依据、值得提出的一点补充或追问",
    "reason": "为什么此刻值得说，或为什么继续倾听",
    "evidenceIds": ["相关原话 id"]
  },
  "scenarioFocus": [
    { "label": "场景重点维度", "detail": "当前最值得用户关注的信息或建议", "evidenceIds": ["转写原话 id"] }
  ],
  "consensus": [
    "当前已形成的稳定共识1",
    "当前已形成的稳定共识2"
  ],
  "tensions": [
    "当前最核心分歧1",
    "当前最核心分歧2"
  ],
  "missing": [
    "仍未充分讨论的关键点1",
    "仍未充分讨论的关键点2"
  ]
}

participantView 是你的参会观点，不是团队结论：
- understanding 简短说明“我们正在讨论什么、前面哪些约束仍有效、当前哪里没弄清”，用第一人称表达可修正的理解。
- intent 选择 contribute（补充）、clarify（追问）、challenge（有依据地提出异议）、listen（继续倾听）。
- contribution 是你想贡献的一段自然发言，至多 100 字，承接具体观点，不以旁观教练语气指挥大家。区分已有事实与新建议，不复读已有发言。
- 没有新增价值、问题已被问过或证据不足以给出观点时，可以 listen，contribution 必须为空，reason 说明正在等待什么信息。不机械要求每次发言。
- evidenceIds 只引用已提供的真实转写 id。reason 说明依据与时机；新建议或假设必须明确标识，不能成为 consensus。

scenarioFocus 要求：
- label 仅从 ${resolveScenarioAssistance(profile.id).dimensions.join('、')} 中选取，每个维度最多一条，总计最多三条。
- detail 不超过 80 字，结合角色和会议目标。明确区分“会议事实”和“建议”；不能把 AI 新建议写成已达成决定。
- evidenceIds 只引用全程记录中真实存在的原话 id；无直接依据的建议用空数组并明确“建议/待确认”。
- ${resolveScenarioAssistance(profile.id).guidance}

共识、分歧、缺口要求：
- 每条不超过22个字
- 优先输出最有决策价值的2-4条
- 宁缺毋滥，不要凑数

${formatOptionalPromptContext(context)}

转写内容：
${formatSegmentsForPrompt(segments)}
`.trim(), profile)
}

