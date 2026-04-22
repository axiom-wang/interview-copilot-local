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
) =>
  composePromptWithGlobalSystemPrompt(`
请根据以下最近 3 分钟群面转写，生成一个适合 React Flow 渲染的“讨论思维导图”。

导图目标：
- 不是逐字记录，而是把当前讨论压缩成一个清晰结构
- 帮助用户快速看懂：题目核心、已讨论主线、关键分支、待收敛点

节点设计要求：
1. 总节点数量控制在 4-8 个之间
2. 必须包含 1 个 root 节点
3. 其余节点为 branch 或 leaf
4. 节点标签必须简短，优先 4-10 个字
5. 不要生成重复节点、空节点、装饰性节点
6. 优先体现这些高价值维度：
   - 问题定义
   - 用户/对象
   - 核心方案
   - 风险/约束
   - 结论/待决问题
7. 如果内容仍很发散，可保留“待决”分支；如果已趋于收敛，应更突出结论主线

布局要求：
1. root 节点居中偏左，例如 x≈80~180, y≈180~260
2. branch 节点分布在右侧，保持大致纵向均匀
3. leaf 节点在对应 branch 右侧
4. 坐标尽量平稳，避免重叠
5. 输出 edges，保证能直接连线

输出严格为 JSON：
{
  "topic": "讨论主题",
  "nodes": [
    {
      "id": "root-1",
      "type": "root",
      "position": { "x": 120, "y": 220 },
      "data": { "label": "讨论主题" }
    },
    {
      "id": "branch-1",
      "type": "branch",
      "position": { "x": 380, "y": 120 },
      "data": { "label": "核心方案" }
    },
    {
      "id": "leaf-1",
      "type": "leaf",
      "position": { "x": 640, "y": 120 },
      "data": { "label": "先试点" }
    }
  ],
  "edges": [
    {
      "id": "e-root-1-branch-1",
      "source": "root-1",
      "target": "branch-1"
    },
    {
      "id": "e-branch-1-leaf-1",
      "source": "branch-1",
      "target": "leaf-1"
    }
  ]
}

请注意：
- 只输出 JSON
- 节点标签尽量抽象到“可汇报结构”，不要抄整句发言
- 忽略闲聊和重复表态
- 如果最近 3 分钟讨论信息不足，就输出最简结构，不要硬凑复杂导图

${formatOptionalPromptContext(context)}

转写内容：
${formatSegmentsForPrompt(segments)}
`.trim())

