import assert from 'node:assert/strict'
import test from 'node:test'
import { AnalysisRouter, toDesktopAnalysisFailure } from '../apps/desktop/electron/llm/analysisRouter'
import { MeetingContextCapacityError } from '../shared/meeting/context/meetingMemory'
import { generateSpeakingHintsOnly } from '../shared/analysis/llm/openaiAnalysisService'
import type { DesktopAnalysisConfig, DesktopTranscriptRequest } from '../shared/meeting/types/desktopAnalysis'

const api: DesktopAnalysisConfig = { provider: 'api', apiKey: 'test-private-key', model: 'test-model', baseURL: 'https://example.com/v1' }
const codex: DesktopAnalysisConfig = { provider: 'codex', executablePath: '', model: '' }
const claude: DesktopAnalysisConfig = { provider: 'claude', executablePath: '', model: '' }
const request = (primary = codex, backup: DesktopAnalysisConfig | undefined = api): DesktopTranscriptRequest => ({
  analysisConfig: primary, fallbackAnalysisConfig: backup, analysisSessionId: 'meeting-one',
  segments: [{ id: 'a', speaker: 'A', text: '先确认预算', timestamp: 1000, isFinal: true }],
  scenarioId: 'design-review', roleContext: '评审者', questionContext: '预算',
})

for (const [primary, backup] of [[codex, api], [api, codex], [claude, api]]) {
  test(`${primary.provider} fails over to ${backup.provider} and all later tasks stay there`, async () => {
    const router = new AnalysisRouter()
    const input = request(primary, backup)
    const calls: string[] = []
    const invoke = async (config?: DesktopAnalysisConfig) => {
      calls.push(config!.provider)
      if (config!.provider === primary.provider) throw new Error('channel unavailable')
      return input.segments[0].text
    }
    const switched = await router.run(input, invoke)
    assert.equal(switched.value, '先确认预算')
    assert.equal(switched.routing.actualProvider, backup.provider)
    assert.match(switched.routing.fallbackReason!, /本场会议继续使用/)
    for (let i = 0; i < 5; i++) await router.run(input, invoke)
    assert.deepEqual(calls, [primary.provider, ...Array<string>(6).fill(backup.provider)])

    const failed = await router.run(input, async (config) => {
      assert.equal(config!.provider, backup.provider)
      throw new Error('backup now unavailable')
    }).catch((error: unknown) => toDesktopAnalysisFailure(error, input))
    assert.ok('ok' in failed && !failed.ok)
    assert.equal(failed.actualProvider, backup.provider)
  })
}

test('Claude failure switches to the OpenAI API with a readable reason and hidden secrets', async () => {
  const router = new AnalysisRouter()
  const input = request(claude, api)
  const result = await router.run(input, async (config) => {
    if (config!.provider === 'claude') throw new Error(`Claude 路径必须是已存在的可执行文件的绝对路径。sk-ant-api03-abcdefghijklmnop ${api.apiKey}`)
    return 'from api'
  })
  assert.equal(result.value, 'from api')
  assert.equal(result.routing.actualProvider, 'api')
  assert.match(result.routing.fallbackReason!, /已从 Claude 切换至 API，本场会议继续使用 API。原因：Claude 路径/)
  assert.deepEqual(Object.keys(result.routing.channelFailures!), ['claude'])
  const shown = JSON.stringify(result.routing)
  assert.ok(!shown.includes('sk-ant-api03') && !shown.includes(api.apiKey))

  const failing = new AnalysisRouter()
  const error = await failing.run(input, async (config) => {
    throw new Error(`${config!.provider} failed: sk-ant-api03-abcdefghijklmnop ${api.apiKey} Bearer abc`)
  }).catch((cause: unknown) => toDesktopAnalysisFailure(cause, input))
  assert.ok('ok' in error && !error.ok)
  assert.match(error.error, /两种分析渠道均失败：Claude：.*；API：/)
  assert.deepEqual(Object.keys(error.channelFailures!).sort(), ['api', 'claude'])
  assert.ok(!JSON.stringify(error).includes('abcdefghijklmnop') && !JSON.stringify(error).includes(api.apiKey))
})

test('Claude primary without fallback reports only Claude', async () => {
  const input = { ...request(claude), fallbackAnalysisConfig: undefined }
  await assert.rejects(new AnalysisRouter().run(input, async () => { throw new Error('未找到 Claude Code CLI') }), /Claude 分析失败：未找到 Claude Code CLI/)
})

test('healthy primary does not call backup; disabled fallback uses only selected config', async () => {
  for (const backup of [api, undefined]) {
    const router = new AnalysisRouter()
    const input = { ...request(), fallbackAnalysisConfig: backup }
    let calls = 0
    const result = await router.run(input, async (config) => {
      calls++
      assert.deepEqual(config, codex)
      return 'healthy'
    })
    assert.equal(result.value, 'healthy')
    assert.equal(calls, 1)
    assert.equal(result.routing.fallbackReason, undefined)
    if (!backup) {
      await assert.rejects(router.run(input, async (config) => {
        calls++
        assert.equal(config!.provider, 'codex')
        throw new Error('failure')
      }), /Codex 分析失败/)
      assert.equal(calls, 2)
    }
  }
})

test('both failures are reported with redacted secrets; failed fallback does not stick', async () => {
  const router = new AnalysisRouter()
  const input = request()
  const calls: string[] = []
  const fail = async (config?: DesktopAnalysisConfig) => {
    calls.push(config!.provider)
    throw new Error(`${config!.provider} failed: ${api.apiKey} Bearer another-secret`)
  }
  for (let i = 0; i < 2; i++) {
    const error = await router.run(input, fail).catch((error: unknown) => toDesktopAnalysisFailure(error, input))
    assert.ok('ok' in error && !error.ok)
    assert.equal(error.code, 'analysis-channel-failure')
    assert.deepEqual(Object.keys(error.channelFailures!).sort(), ['api', 'codex'])
    assert.ok(!JSON.stringify(error).includes(api.apiKey))
    assert.ok(!JSON.stringify(error).includes('another-secret'))
    assert.match(error.error, /两种分析渠道均失败/)
  }
  assert.deepEqual(calls, ['codex', 'api', 'codex', 'api'])
})

test('unconfigured backup API is never invoked', async () => {
  for (const patch of [{ apiKey: '' }, { model: '' }]) {
    const input = request(codex, { ...api, ...patch })
    const router = new AnalysisRouter()
    let calls = 0
    await assert.rejects(router.run(input, async (config) => {
      calls++
      assert.equal(config!.provider, 'codex')
      throw new Error('CLI missing')
    }), /备用 API 未配置/)
    assert.equal(calls, 1)
  }
})

test('capacity and cancellation errors do not trigger backup', async () => {
  for (const error of [new MeetingContextCapacityError({ version: 1, chunks: [] }), new DOMException('cancelled', 'AbortError')]) {
    const router = new AnalysisRouter()
    let calls = 0
    await assert.rejects(router.run(request(), async () => { calls++; throw error }), (received: unknown) => received === error)
    assert.equal(calls, 1)
  }
})

test('concurrent tasks share the committed switch rather than retrying the broken primary', async () => {
  const router = new AnalysisRouter()
  const calls: string[] = []
  const results = await Promise.all(Array.from({ length: 6 }, (_, task) => router.run(request(), async (config) => {
    calls.push(`${task}:${config!.provider}`)
    if (config!.provider === 'codex') throw new Error('broken')
    return task
  })))
  assert.deepEqual(results.map((result) => result.value), [0, 1, 2, 3, 4, 5])
  assert.deepEqual(calls, ['0:codex', '0:api', '1:api', '2:api', '3:api', '4:api', '5:api'])
})

test('stop releases pending work but preserves routing; a new meeting resets it', async () => {
  const router = new AnalysisRouter()
  await router.run(request(), async (config) => {
    if (config!.provider === 'codex') throw new Error('broken')
    return 'switched'
  })
  router.reset({ preserveRouting: true, analysisSessionId: 'after-stop' })
  const summary = await router.run({ ...request(), analysisSessionId: 'after-stop' }, async (config) => config!.provider)
  assert.equal(summary.value, 'api')
  assert.match(summary.routing.fallbackReason!, /切换/)
  router.reset({ analysisSessionId: 'next-meeting' })
  const next = await router.run({ ...request(), analysisSessionId: 'next-meeting' }, async (config) => config!.provider)
  assert.equal(next.value, 'codex')
  assert.equal(next.routing.fallbackReason, undefined)
})

for (const primary of [codex, claude]) test(`reset rejects active, queued and delayed old ${primary.provider} requests without switching the new session`, async () => {
  const router = new AnalysisRouter()
  let finish!: () => void
  let started!: () => void
  const begun = new Promise<void>((resolve) => { started = resolve })
  let oldCalls = 0
  const active = router.run(request(primary), async () => {
    oldCalls++; started()
    await new Promise<void>((resolve) => { finish = resolve })
    throw new Error('old primary failed')
  })
  const queued = router.run(request(primary), async () => { oldCalls++; return 'old' })
  const settled = Promise.allSettled([active, queued])
  await begun
  router.reset({ analysisSessionId: 'new-session' })
  const next = await router.run({ ...request(primary), analysisSessionId: 'new-session' }, async (config) => config!.provider)
  assert.equal(next.value, primary.provider)
  finish()
  const results = await settled
  assert.deepEqual(results.map((result) => result.status), ['rejected', 'rejected'])
  assert.equal(oldCalls, 1)
  await assert.rejects(router.run(request(primary), async () => { oldCalls++; return 'stale' }), /旧请求/)
  assert.equal(oldCalls, 1)
})

test('configuration changes require a session reset', async () => {
  const router = new AnalysisRouter()
  await router.run(request(), async () => 'ready')
  const changed = { ...request(), analysisConfig: { ...api, model: 'new-model' }, fallbackAnalysisConfig: codex }
  let calls = 0
  await assert.rejects(router.run(changed, async () => { calls++; return 'wrong' }), /配置已改变/)
  assert.equal(calls, 0)
  router.reset()
  assert.equal((await router.run(changed, async () => 'new')).value, 'new')
})

test('API exhausts its existing three attempts before routing to Codex', async (t) => {
  let attempts = 0
  const original = globalThis.fetch
  globalThis.fetch = async () => { attempts++; return new Response('temporarily unavailable', { status: 503 }) }
  t.after(() => { globalThis.fetch = original })
  const input = request(api, codex)
  const router = new AnalysisRouter()
  const result = await router.run(input, async (config) => {
    if (config!.provider === 'api') return generateSpeakingHintsOnly(input.segments, input, config)
    assert.equal(attempts, 3)
    return { functionType: '倾听观察' as const, whyNow: '先倾听', hint60s: '', hint120s: '', updatedAt: 1000 }
  })
  assert.equal(result.routing.actualProvider, 'codex')
  assert.equal(attempts, 3)
})
