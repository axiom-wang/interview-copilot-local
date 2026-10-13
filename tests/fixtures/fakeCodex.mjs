import { createInterface } from 'node:readline'

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)
let nextThread = 0
let active = 0
let config = {}
let probeModel
let permissionThread = null
const threadModels = new Map()

for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line)
  if (permissionThread && request.id === 9001) {
    const { threadId, turnId } = permissionThread
    permissionThread = null
    active = Math.max(0, active - 1)
    const text = JSON.stringify({
      echo: 'REQUEST_PERMISSION',
      approved: Boolean(request.result) && request.error === undefined,
      commandRan: false,
      grantedPermissions: request.result?.permissions ?? null,
      error: request.error?.message ?? null,
    })
    send({ method: 'item/completed', params: { threadId, turnId, item: { id: 'answer', type: 'agentMessage', phase: 'final_answer', text } } })
    send({ method: 'turn/completed', params: { threadId, turn: { id: turnId, status: 'completed', error: null } } })
    continue
  }
  if (request.id === undefined || !request.method) continue
  const { id, method, params } = request
  if (method === 'initialize') send({ id, result: {} })
  else if (method === 'config/read') send({ id, result: { config: {
    mcp_servers: { 'tools.with.dots': { command: 'unused', enabled: true } },
    plugins: { 'sample@registry': { enabled: true } },
  } } })
  else if (method === 'account/read') send({ id, result: { account: { type: 'chatgpt' }, requiresOpenaiAuth: true } })
  else if (method === 'model/list') send({ id, result: { data: [{ model: 'fake-model', isDefault: true }] } })
  else if (method === 'thread/start') {
    config = params.config
    const threadId = `thread-${++nextThread}`
    threadModels.set(threadId, params.model)
    send({ id, result: { thread: { id: threadId } } })
  } else if (method === 'turn/start') {
    const { threadId, input, outputSchema } = params
    const prompt = input[0].text
    if (prompt === 'EXIT') process.exit(7)
    if (prompt === 'HANG_RPC') continue
    active += 1
    const turnId = `turn-${nextThread}`
    if (prompt === 'REQUEST_PERMISSION') {
      permissionThread = { threadId, turnId }
      send({ id, result: { turn: { id: turnId } } })
      send({ id: 9001, method: 'item/permissions/requestApproval', params: { permissions: { shell: true } } })
      continue
    }
    const concurrent = active
    const result = outputSchema.properties.ok ? { ok: true }
      : outputSchema.properties.phaseAnalysis ? {
        phaseAnalysis: { phase: 'alignment-building', confidence: 0.8, nextAction: '确认验收标准', reason: '已经收敛到一个方案' },
        consensusAnalysis: { consensus: ['先验证核心流程'], tensions: ['交付时间尚未确定'], missing: ['负责人'] },
      } : { echo: prompt, concurrent, config, model: threadModels.get(threadId), openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY) }
    if (outputSchema.properties.ok) probeModel = threadModels.get(threadId)
    const complete = () => {
      if (prompt === 'HANG_TURN') return
      active -= 1
      send({ method: 'item/completed', params: { threadId, turnId, item: { id: 'comment', type: 'agentMessage', phase: 'commentary', text: 'ignore this message' } } })
      send({ method: 'item/completed', params: { threadId, turnId, item: { id: 'answer', type: 'agentMessage', phase: 'final_answer', text: prompt === 'INVALID_JSON' ? 'invalid json' : JSON.stringify({ ...result, ...(probeModel && !outputSchema.properties.ok ? { probeModel } : {}) }) } } })
      send({ method: 'turn/completed', params: { threadId, turn: { id: turnId, status: prompt === 'FAIL' ? 'failed' : 'completed', error: prompt === 'FAIL' ? { message: 'model unavailable' } : null } } })
    }
    if (prompt === 'EARLY_EVENTS') { complete(); send({ id, result: { turn: { id: turnId } } }) }
    else { send({ id, result: { turn: { id: turnId } } }); setTimeout(complete, 15) }
  } else if (method === 'thread/unsubscribe') send({ id, result: {} })
  else send({ id, result: {} })
}
