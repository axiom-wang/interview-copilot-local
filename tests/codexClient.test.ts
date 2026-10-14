import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { type TestContext } from 'node:test'
import { CodexClient, resolveCodexExecutable } from '../apps/desktop/electron/llm/codexClient'
import { codexAnalysis, disposeCodexAnalysis, probeCodexConnection, shutdownCodexAnalysis } from '../apps/desktop/electron/llm/codexAnalysisService'

const schema = { type: 'object', properties: { echo: { type: 'string' } } }
const setup = (t: TestContext) => {
  const directory = mkdtempSync(join(tmpdir(), 'meeting-fake-cli-'))
  const executablePath = join(directory, 'codex')
  writeFileSync(executablePath, `#!${process.execPath}\n${readFileSync(new URL('./fixtures/fakeCodex.mjs', import.meta.url), 'utf8')}`)
  chmodSync(executablePath, 0o700)
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return { executablePath, model: '' }
}

test('serializes turns and ignores commentary; uses no project API key or external tools', async (t) => {
  const config = setup(t)
  const previous = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'test-project-key'
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous
  })
  const client = new CodexClient(config)
  t.after(() => client.dispose())
  const results = await Promise.all(['first', 'second'].map((prompt) => client.structured(prompt, schema))) as Array<Record<string, unknown>>
  assert.deepEqual(results.map((result) => result.echo), ['first', 'second'])
  assert.deepEqual(results.map((result) => result.concurrent), [1, 1])
  assert.equal(results[0].openaiKeyPresent, false)
  const policy = results[0].config as Record<string, unknown>
  assert.equal(policy['features.shell_tool'], false)
  assert.deepEqual(policy.mcp_servers, { 'tools.with.dots': { enabled: false } })
  assert.deepEqual(policy.plugins, { 'sample@registry': { enabled: false } })
})

test('handles completion events before turn acknowledgement and rejects malformed or failed output', async (t) => {
  const client = new CodexClient(setup(t))
  t.after(() => client.dispose())
  assert.equal((await client.structured('EARLY_EVENTS', schema) as { echo: string }).echo, 'EARLY_EVENTS')
  await assert.rejects(client.structured('INVALID_JSON', schema), /有效的 JSON/)
  await assert.rejects(client.structured('FAIL', schema), /model unavailable/)
  assert.equal((await client.structured('recovered', schema) as { echo: string }).echo, 'recovered')
})

test('probe verifies an inference turn; explicit model is passed to analysis', async (t) => {
  const client = new CodexClient({ ...setup(t), model: 'chosen-model' })
  t.after(() => client.dispose())
  assert.deepEqual(await client.probe(), { model: 'chosen-model', authMethod: 'chatgpt' })
  const result = await client.structured('meeting', schema) as { model: string; probeModel: string }
  assert.equal(result.model, 'chosen-model')
  assert.equal(result.probeModel, 'chosen-model')
})

test('uses Fast with Medium by default and isolates Low overrides between analysis turns', async (t) => {
  const client = new CodexClient(setup(t))
  t.after(() => client.dispose())
  await client.probe()
  for (const effort of ['low', 'medium', 'low', undefined] as const) {
    const expectedEffort = effort ?? 'medium'
    const result = await client.structured('meeting analysis', schema, effort) as {
      startupConfig: Record<string, unknown>
      config: Record<string, unknown>
      turnSettings: { serviceTier: string; effort: string }
      probeSettings: { serviceTier: string; effort: string }
    }
    assert.equal(result.startupConfig.model_reasoning_effort, 'medium')
    for (const config of [result.startupConfig, result.config]) {
      assert.equal(config.service_tier, 'fast')
      assert.equal(config['features.fast_mode'], true)
    }
    assert.equal(result.config.model_reasoning_effort, expectedEffort)
    assert.deepEqual(result.turnSettings, { serviceTier: 'fast', effort: expectedEffort })
    assert.deepEqual(result.probeSettings, { serviceTier: 'fast', effort: 'medium' })
  }
})

test('routes live analysis and hints to Low while keeping other tasks on Medium', async (t) => {
  const captured: Array<{ effort: string; memory: boolean }> = []
  t.mock.method(CodexClient.prototype, 'structured', async (_prompt: string, outputSchema: Record<string, unknown>, effort = 'medium') => {
    captured.push({ effort, memory: 'events' in (outputSchema.properties as Record<string, unknown>) })
    throw new Error('captured analysis request')
  })
  const service = codexAnalysis(setup(t))
  t.after(disposeCodexAnalysis)
  const segments = [{ id: '1', speaker: 'A', timestamp: 1234, text: '先验证核心流程。', isFinal: true }]
  for (const [expectedEffort, task] of [
    ['low', () => service.realtime(segments)],
    ['low', () => service.hints(segments)],
    ['medium', () => service.summary(segments)],
    ['medium', () => service.minutes(segments)],
    ['medium', () => service.mindMap(segments)],
    ['medium', () => service.answer('目前决定是什么？', segments)],
  ] as const) {
    await assert.rejects(task(), /captured analysis request/)
    assert.deepEqual(captured.at(-1), { effort: expectedEffort, memory: false })
  }
  const longSegments = Array.from({ length: 30 }, (_, i) => ({
    ...segments[0], id: String(i), timestamp: i * 1000, text: '讨论会议方案。'.repeat(200),
  }))
  for (const task of [() => service.realtime(longSegments), () => service.hints(longSegments)]) {
    const offset = captured.length
    await assert.rejects(task(), /captured analysis request/)
    assert.deepEqual(captured.slice(offset), [
      { effort: 'medium', memory: true },
      { effort: 'low', memory: false },
    ])
  }
})

test('timeouts and unexpected exits reject work and allow a fresh process on retry', async (t) => {
  const client = new CodexClient(setup(t), { rpc: 1000, turn: 100 })
  t.after(() => client.dispose())
  await assert.rejects(client.structured('HANG_TURN', schema), /超时/)
  await assert.rejects(client.structured('EXIT', schema), /退出/)
  assert.equal((await client.structured('retry', schema) as { echo: string }).echo, 'retry')
})

test('disposing cancels active and queued work', async (t) => {
  const client = new CodexClient(setup(t))
  t.after(() => client.dispose())
  const active = client.structured('HANG_TURN', schema)
  const queued = client.structured('queued', schema)
  const results = Promise.allSettled([active, queued])
  setTimeout(() => client.dispose(), 80)
  assert.deepEqual((await results).map((result) => result.status), ['rejected', 'rejected'])
})

test('combined realtime task returns existing typed phase and consensus results', async (t) => {
  const service = codexAnalysis(setup(t))
  t.after(disposeCodexAnalysis)
  const result = await service.realtime([{ id: '1', speaker: 'A', timestamp: 1234, text: '先验证核心流程。', isFinal: true }], { scenarioId: 'general' })
  assert.equal(result.phaseAnalysis.phase, 'alignment-building')
  assert.equal(result.phaseAnalysis.updatedAt, 1234)
  assert.deepEqual(result.consensusAnalysis.consensus, ['先验证核心流程'])
})

test('permission requests are rejected and do not run commands', async (t) => {
  const client = new CodexClient(setup(t))
  t.after(() => client.dispose())
  const result = await client.structured('REQUEST_PERMISSION', schema) as {
    approved: boolean
    commandRan: boolean
    grantedPermissions: unknown
    error: string | null
  }
  assert.equal(result.approved, false)
  assert.equal(result.commandRan, false)
  assert.equal(result.grantedPermissions, null)
  assert.match(result.error ?? '', /does not execute tools/)
})

test('executable accepts only a file path, not command text', () => {
  assert.throws(() => resolveCodexExecutable('codex --model anything'), /绝对路径/)
  assert.throws(() => resolveCodexExecutable('/not/installed/codex'), /已存在/)
})

test('app shutdown also cancels independent connection probes', async (t) => {
  const probe = probeCodexConnection(setup(t))
  const rejected = assert.rejects(probe, /通道已切换|通道已关闭/)
  shutdownCodexAnalysis()
  await rejected
})
