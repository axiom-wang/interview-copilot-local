import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { type TestContext } from 'node:test'
import { ClaudeClient, resolveClaudeExecutable } from '../apps/desktop/electron/llm/claudeClient'
import { claudeAnalysis, disposeClaudeAnalysis, probeClaudeConnection, shutdownClaudeAnalysis } from '../apps/desktop/electron/llm/claudeAnalysisService'

const schema = { type: 'object', properties: { echo: { type: 'string' } } }
const install = (t: TestContext, directory = mkdtempSync(join(tmpdir(), 'meeting-fake-cli-'))) => {
  mkdirSync(directory, { recursive: true })
  const executablePath = join(directory, 'claude')
  writeFileSync(executablePath, `#!${process.execPath}\n${readFileSync(new URL('./fixtures/fakeClaude.mjs', import.meta.url), 'utf8')}`)
  chmodSync(executablePath, 0o700)
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return { executablePath, model: '' }
}

type Echo = { echo: string; argv: string[]; cwd: string; cwdExists: boolean; apiKeyPresent: boolean; tokenPresent: boolean; pid: number; served: number; history: string[] }
const alive = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }
const settle = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

test('every call locks down tools, settings and MCP, runs in a throwaway directory and ignores project API keys', async (t) => {
  const keep = { key: process.env.ANTHROPIC_API_KEY, token: process.env.ANTHROPIC_AUTH_TOKEN }
  process.env.ANTHROPIC_API_KEY = 'test-project-key'
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-project-token'
  t.after(() => {
    for (const [name, value] of [['ANTHROPIC_API_KEY', keep.key], ['ANTHROPIC_AUTH_TOKEN', keep.token]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value
    }
  })
  const client = new ClaudeClient(install(t))
  const result = await client.structured('meeting', schema, 'low') as Echo
  assert.equal(result.echo, 'meeting')
  for (const flag of ['--tools=', '--setting-sources=', '--strict-mcp-config', '--permission-mode=dontAsk', '--no-session-persistence', '--max-turns=2', '--effort=low']) {
    assert.ok(result.argv.includes(flag), flag)
  }
  assert.ok(result.argv.some((arg) => arg.startsWith('--json-schema=')))
  assert.ok(result.cwdExists)
  assert.ok(result.cwd.includes('meeting-claude-'))
  client.dispose()
  assert.ok(!existsSync(result.cwd), 'workspace removed with the session')
  assert.equal(result.apiKeyPresent, false)
  assert.equal(result.tokenPresent, false)
})

test('picks the Sonnet default, honours an explicit model and maps effort', async (t) => {
  const config = install(t)
  const client = new ClaudeClient(config)
  const custom = new ClaudeClient({ ...config, model: 'my-model' })
  t.after(() => { client.dispose(); custom.dispose() })
  assert.ok(((await client.structured('x', schema, 'medium')) as Echo).argv.includes('--model=sonnet'))
  assert.ok(((await client.structured('x', schema, 'medium')) as Echo).argv.includes('--effort=medium'))
  assert.ok(((await custom.structured('x', schema, 'low')) as Echo).argv.includes('--model=my-model'))
  assert.deepEqual(await custom.probe(), { model: 'my-model', authMethod: 'claude-login' })
})

test('surfaces CLI failures, empty output and login problems; later calls still work', async (t) => {
  const client = new ClaudeClient(install(t))
  t.after(() => client.dispose())
  await assert.rejects(client.structured('FAIL', schema), /model unavailable/)
  await assert.rejects(client.structured('LOGGED_OUT', schema), /Not logged in/)
  await assert.rejects(client.structured('NO_OUTPUT', schema), /有效的 JSON/)
  assert.equal(((await client.structured('recovered', schema)) as Echo).echo, 'recovered')
})

test('times out hung turns and cleans up; dispose cancels in-flight work and blocks new calls', async (t) => {
  const config = install(t)
  const slow = new ClaudeClient(config, { turnTimeout: 300 })
  await assert.rejects(slow.structured('HANG', schema), /超时/)
  slow.dispose()

  const client = new ClaudeClient(config)
  const pending = client.structured('HANG', schema)
  const settled = assert.rejects(pending, /已切换或应用已退出/)
  await new Promise((resolve) => setTimeout(resolve, 300))
  client.dispose()
  await settled
  await assert.rejects(client.structured('again', schema), /已关闭/)
})

test('keeps one process per schema and effort, and clears the conversation between tasks', async (t) => {
  const client = new ClaudeClient(install(t))
  t.after(() => client.dispose())
  const first = await client.structured('first', schema, 'low') as Echo
  const second = await client.structured('second', schema, 'low') as Echo
  assert.equal(second.pid, first.pid)
  assert.deepEqual([first.served, second.served], [1, 2])
  assert.deepEqual(second.history, [], 'the earlier task is not visible to the next one')
  const other = await client.structured('other', { type: 'object', properties: { other: { type: 'string' } } }, 'low') as Echo
  const slower = await client.structured('slower', schema, 'medium') as Echo
  assert.notEqual(other.pid, first.pid)
  assert.notEqual(slower.pid, first.pid)
  assert.ok([first.pid, other.pid, slower.pid].every(alive))
})

test('connection test and busy duplicates use throwaway processes that are closed afterwards', async (t) => {
  const config = install(t)
  const probing = new ClaudeClient(config, { persistent: false })
  const before = await probing.structured('once', schema, 'low') as Echo
  const after = await probing.structured('twice', schema, 'low') as Echo
  assert.notEqual(before.pid, after.pid)
  await settle()
  assert.ok(!alive(before.pid) && !alive(after.pid))

  const client = new ClaudeClient(config)
  t.after(() => client.dispose())
  const [busy, extra] = await Promise.all([client.structured('SLOW', schema, 'low'), client.structured('parallel', schema, 'low')]) as Echo[]
  assert.notEqual(busy.pid, extra.pid)
  await settle()
  assert.ok(alive(busy.pid) && !alive(extra.pid), 'the shared session stays, the extra one is closed')
  assert.equal(((await client.structured('next', schema, 'low')) as Echo).pid, busy.pid)
})

test('keeps at most three warm processes and recycles idle ones', async (t) => {
  const client = new ClaudeClient(install(t))
  t.after(() => client.dispose())
  const pids: number[] = []
  for (const name of ['a', 'b', 'c', 'd']) {
    pids.push(((await client.structured(name, { type: 'object', properties: { [name]: { type: 'string' } } }, 'low')) as Echo).pid)
  }
  await settle()
  assert.deepEqual(pids.map(alive), [false, true, true, true])

  const short = new ClaudeClient(install(t), { idleTimeout: 150 })
  t.after(() => short.dispose())
  const { pid } = await short.structured('x', schema, 'low') as Echo
  assert.ok(alive(pid))
  await settle(600)
  assert.ok(!alive(pid))
  assert.notEqual(((await short.structured('y', schema, 'low')) as Echo).pid, pid)
})

test('a warm process that died is replaced once; a fresh failure is reported', async (t) => {
  const flag = join(mkdtempSync(join(tmpdir(), 'meeting-crash-')), 'flag')
  t.after(() => { delete process.env.FAKE_CLAUDE_CRASH_FLAG; rmSync(flag, { force: true }) })
  process.env.FAKE_CLAUDE_CRASH_FLAG = flag
  const client = new ClaudeClient(install(t))
  t.after(() => client.dispose())
  const warm = await client.structured('warm', schema, 'low') as Echo
  const replaced = await client.structured('DIE_ONCE', schema, 'low') as Echo
  assert.equal(replaced.echo, 'DIE_ONCE')
  assert.notEqual(replaced.pid, warm.pid)
  await assert.rejects(client.structured('DIE_ALWAYS', schema, 'low'), /进程/)
  assert.equal(((await client.structured('after', schema, 'low')) as Echo).echo, 'after')
})

test('a session reset cancels in-flight work without dropping idle warm processes', async (t) => {
  const client = new ClaudeClient(install(t))
  t.after(() => client.dispose())
  const warm = await client.structured('warm', schema, 'low') as Echo
  const other = { type: 'object', properties: { other: { type: 'string' } } }
  await client.structured('idle', other, 'low')
  const pending = client.structured('HANG', schema, 'low')
  const rejected = assert.rejects(pending, /已取消/)
  await settle(300)
  client.cancelInFlight()
  await rejected
  assert.equal(((await client.structured('idle again', other, 'low')) as Echo).served, 2)
  const next = await client.structured('next', schema, 'low') as Echo
  assert.notEqual(next.pid, warm.pid, 'the cancelled session is not reused')
  assert.deepEqual(next.history, [])
})

test('realtime analysis asks for the lean schema and brief output', async (t) => {
  const log = join(mkdtempSync(join(tmpdir(), 'meeting-log-')), 'log')
  process.env.FAKE_CLAUDE_LOG = log
  t.after(() => { delete process.env.FAKE_CLAUDE_LOG; shutdownClaudeAnalysis() })
  const analysis = claudeAnalysis(install(t))
  const segments = [{ id: 'a', speaker: 'A', text: '先确认预算', timestamp: 1000, isFinal: true }]
  const result = await analysis.realtime(segments)
  assert.equal(result.phaseAnalysis.nextAction, '确认预算')
  assert.equal(result.phaseAnalysis.nextBestAction, undefined)
  const sent = readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { prompt: string; argv: string[] })
  const turn = sent.find((entry) => entry.prompt.includes('最近 90 秒转写'))!
  const sentSchema = JSON.parse(turn.argv.find((arg) => arg.startsWith('--json-schema='))!.slice(14))
  assert.deepEqual(Object.keys(sentSchema.properties.phaseAnalysis.properties).sort(), ['confidence', 'nextAction', 'phase', 'reason'])
  assert.ok(!sentSchema.properties.phaseAnalysis.required.includes('nextBestAction'))
  assert.ok(sentSchema.properties.consensusAnalysis.required.includes('participantView'))
  assert.match(turn.prompt, /输出尽量精简/)
  assert.ok(sent.some((entry) => entry.prompt === '/clear'), 'conversation is cleared after the task')
})

test('executable lookup validates explicit paths and searches PATH, ~/.local/bin and nvm', (t) => {
  const { executablePath } = install(t)
  assert.equal(resolveClaudeExecutable(` ${executablePath} `), executablePath)
  assert.throws(() => resolveClaudeExecutable('claude'), /绝对路径/)
  assert.throws(() => resolveClaudeExecutable(join(tmpdir(), 'missing-claude-binary')), /绝对路径/)

  const home = mkdtempSync(join(tmpdir(), 'meeting-home-'))
  t.after(() => rmSync(home, { recursive: true, force: true }))
  const previous = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, PATH: process.env.PATH }
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } })
  process.env.HOME = home
  process.env.USERPROFILE = home
  process.env.PATH = ''
  if (!existsSync('/opt/homebrew/bin/claude') && !existsSync('/usr/local/bin/claude')) {
    assert.throws(() => resolveClaudeExecutable(''), /未找到 Claude Code CLI/)
    const nvm = install(t, join(home, '.nvm', 'versions', 'node', 'v22.1.0', 'bin'))
    assert.equal(resolveClaudeExecutable(''), nvm.executablePath)
    const local = install(t, join(home, '.local', 'bin'))
    assert.equal(resolveClaudeExecutable(''), local.executablePath)
    const onPath = install(t)
    process.env.PATH = onPath.executablePath.replace(/\/claude$/, '')
    assert.equal(resolveClaudeExecutable(''), onPath.executablePath)
  }
})

test('invalid executable fails before any process starts', async (t) => {
  const client = new ClaudeClient({ executablePath: join(tmpdir(), 'missing-claude-binary'), model: '' })
  t.after(() => client.dispose())
  await assert.rejects(client.structured('x', schema), /Claude 路径/)
  await assert.rejects(probeClaudeConnection({ executablePath: '/nope/claude', model: '' }), /Claude 路径/)
})

test('service probes through the fake CLI and swaps clients when the configuration changes', async (t) => {
  const config = install(t)
  t.after(() => shutdownClaudeAnalysis())
  assert.deepEqual(await probeClaudeConnection(config), { model: 'sonnet', authMethod: 'claude-login' })
  const analysis = claudeAnalysis(config)
  assert.equal(typeof analysis.realtime, 'function')
  disposeClaudeAnalysis()
  assert.equal(typeof claudeAnalysis({ ...config, model: 'other' }).hints, 'function')
})

test('prewarm starts the answer process ahead of time and keeps it alive until released', async (t) => {
  const client = new ClaudeClient(install(t), { idleTimeout: 150 })
  t.after(() => client.dispose())
  client.prewarm(schema, 'low')
  const first = await client.structured('first', schema, 'low') as Echo
  assert.equal(first.served, 1, 'the prewarmed process answers the first question')
  await settle()
  assert.ok(alive(first.pid), 'kept alive past the idle timeout')
  const second = await client.structured('second', schema, 'low') as Echo
  assert.equal(second.pid, first.pid)
  client.releaseKeepAlive()
  await settle()
  assert.ok(!alive(first.pid), 'idle eviction resumes once released')
})

test('one-on-one answers use the prewarmed low-effort session', async (t) => {
  const config = install(t)
  t.after(() => disposeClaudeAnalysis())
  const { prewarmClaudeAnalysis } = await import('../apps/desktop/electron/llm/claudeAnalysisService')
  const logPath = join(mkdtempSync(join(tmpdir(), 'meeting-claude-log-')), 'log.jsonl')
  const keep = process.env.FAKE_CLAUDE_LOG
  process.env.FAKE_CLAUDE_LOG = logPath
  t.after(() => { if (keep === undefined) delete process.env.FAKE_CLAUDE_LOG; else process.env.FAKE_CLAUDE_LOG = keep })
  prewarmClaudeAnalysis(config, 'one-on-one-interview')
  await claudeAnalysis(config).answer('为什么想加入我们？', [], { scenarioId: 'one-on-one-interview', questionContext: '岗位：增长产品经理' })
  const turns = readFileSync(logPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { pid: number; prompt: string; argv: string[] })
  const answerTurns = turns.filter((turn) => turn.prompt !== '/clear')
  assert.equal(answerTurns.length, 1)
  assert.ok(answerTurns[0].argv.includes('--effort=low'))
})
