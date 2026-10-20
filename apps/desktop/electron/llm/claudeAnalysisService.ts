import type { ClaudeConfig } from '../../../../shared/meeting/types/desktopAnalysis'
import { detectPhaseSchema } from '../../../../shared/meeting/schemas/detectPhase.schema.ts'
import { resolveScenarioProfile } from '../../../../shared/meeting/scenarios'
import { answerOneOnOneInterviewSchema } from '../../../../shared/meeting/schemas/answerOneOnOneInterview.schema.ts'
import { ClaudeClient } from './claudeClient'
import { createLocalAnalysis } from './localAnalysis'

let current: { key: string; client: ClaudeClient } | null = null
const probes = new Set<ClaudeClient>()

export const disposeClaudeAnalysis = () => {
  current?.client.dispose()
  current = null
}

// 会话重置只取消进行中的请求，常驻进程保持就绪；上一场的保活随之解除。
export const resetClaudeAnalysis = () => {
  current?.client.cancelInFlight()
  current?.client.releaseKeepAlive()
}

// qa 场景按住提问、松开即答：开始时预热回答进程，回答与预热使用相同的 Schema 和 effort。
export const prewarmClaudeAnalysis = (config: ClaudeConfig, scenarioId?: string) => {
  if (resolveScenarioProfile(scenarioId).interactionModel !== 'qa') return
  getClient(config).prewarm(answerOneOnOneInterviewSchema, 'low')
}

export const shutdownClaudeAnalysis = () => {
  disposeClaudeAnalysis()
  for (const client of probes) client.dispose()
  probes.clear()
}

const getClient = (config: ClaudeConfig) => {
  const key = JSON.stringify(config)
  if (current?.key !== key) {
    disposeClaudeAnalysis()
    current = { key, client: new ClaudeClient(config) }
  }
  return current!.client
}

export const probeClaudeConnection = async (config: ClaudeConfig) => {
  const client = new ClaudeClient(config, { persistent: false })
  probes.add(client)
  try { return await client.probe() } finally {
    client.dispose()
    probes.delete(client)
  }
}

// 实时分析每 8 秒一次，输出长度直接决定延迟。UI 只显示 nextAction（nextBestAction 仅作回退），
// 去掉它并限制各字段篇幅后，输出约减半且内容不变。
const leanPhaseSchema = {
  ...detectPhaseSchema,
  required: detectPhaseSchema.required.filter((key) => key !== 'nextBestAction'),
  properties: Object.fromEntries(Object.entries(detectPhaseSchema.properties).filter(([key]) => key !== 'nextBestAction')),
}
const briefOutputRule = `

输出尽量精简（越短越好）：reason、understanding、contribution、detail 各不超过 40 字；nextAction 不超过 30 字；consensus、tensions、missing 每类最多 3 条且每条不超过 25 字；scenarioFocus 最多 2 条；不要在不同字段重复同一句话。`

export const claudeAnalysis = (config: ClaudeConfig) => createLocalAnalysis(getClient(config), {
  phaseSchema: leanPhaseSchema,
  realtimePromptSuffix: briefOutputRule,
  fastQaAnswers: true,
})
