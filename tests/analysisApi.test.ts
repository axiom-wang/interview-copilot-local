import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { handleAnalysisRequest } from '../shared/analysis/llm/analysisRequest'
import { sealCallerModelConfig } from '../shared/analysis/llm/openaiConfig'

test('online API keeps Responses routing, BYO configuration and scenario context', async (t) => {
  const received: Array<{ key: string | undefined; body: Record<string, unknown> }> = []
  const server = createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    const parsed = JSON.parse(body) as Record<string, unknown>
    received.push({ key: request.headers.authorization, body: parsed })
    assert.equal(request.url, '/v1/responses')
    const schema = (parsed.text as { format: { name: string } }).format.name
    const result = schema === 'detect_phase'
      ? { phase: 'decision-lock', confidence: 0.9, nextAction: '确认负责人', reason: '方案已确认' }
      : { consensus: ['先上线登录'], tensions: [], missing: ['负责人'] }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ output_text: JSON.stringify(result) }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const result = await handleAnalysisRequest({
    action: 'realtime',
    body: {
      scenarioId: 'design-review', questionContext: '先上线登录',
      segments: [{ id: 'a', speaker: 'A', text: '方案已确认', timestamp: 1000, isFinal: true }],
    },
    configOverride: { apiKey: 'test-user-key', model: 'test-user-model', baseURL: `http://127.0.0.1:${address.port}/v1` },
    trustRuntimeConfig: true,
  })
  assert.equal(result.status, 200)
  assert.equal((result.body as { bundle: { phaseAnalysis: { phase: string } } }).bundle.phaseAnalysis.phase, 'decision-lock')
  assert.equal(received.length, 2)
  for (const request of received) {
    assert.equal(request.key, 'Bearer test-user-key')
    assert.equal(request.body.model, 'test-user-model')
    assert.equal(request.body.store, false)
    assert.ok(String(request.body.input).includes('先上线登录'))
  }
})

test('public analysis requires the caller key and an allowlisted https base URL', async () => {
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'server-key'
  try {
    const hosts = ['api.openai.com']
    assert.throws(() => sealCallerModelConfig({}, hosts), /API Key/)
    assert.throws(() => sealCallerModelConfig({ apiKey: 'user-key', baseURL: 'http://127.0.0.1:9/v1' }, hosts), /https/)
    assert.throws(() => sealCallerModelConfig({ apiKey: 'user-key', baseURL: 'https://user:secret@api.openai.com/v1' }, hosts), /账号信息/)
    assert.throws(() => sealCallerModelConfig({ apiKey: 'user-key', baseURL: 'https://attacker.example/v1' }, hosts), /允许列表/)
    assert.deepEqual(sealCallerModelConfig({ apiKey: 'user-key', model: 'caller-model', baseURL: 'https://api.openai.com/v1/' }, hosts), {
      apiKey: 'user-key', model: 'caller-model', baseURL: 'https://api.openai.com/v1',
    })
    assert.equal(
      sealCallerModelConfig({ apiKey: 'user-key', baseURL: 'https://gateway.example/v1' }, ['api.openai.com', 'gateway.example']).baseURL,
      'https://gateway.example/v1',
    )
    const blocked = await handleAnalysisRequest({
      action: 'probe',
      body: {},
      configOverride: { baseURL: 'https://attacker.example/v1' },
    })
    assert.equal(blocked.status, 400)
    assert.match(String((blocked.body as { error: string }).error), /API Key/)
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  }
})
