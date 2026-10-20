import { appendFileSync, existsSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)
const argv = process.argv.slice(2)
const model = argv.find((arg) => arg.startsWith('--model='))?.slice(8) ?? 'default'
const phaseTurn = argv.some((arg) => arg.startsWith('--json-schema=') && arg.includes('phaseAnalysis'))
let history = []
let served = 0

createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line)
  if (message.type === 'control_request') {
    send({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: {} } })
    return
  }
  if (message.type !== 'user') return
  const prompt = message.message.content[0].text
  if (process.env.FAKE_CLAUDE_LOG) appendFileSync(process.env.FAKE_CLAUDE_LOG, `${JSON.stringify({ pid: process.pid, prompt, argv })}\n`)
  if (prompt === 'HANG') return
  send({ type: 'system', subtype: 'init', model, apiKeySource: 'none', session_id: 'fake' })
  const result = { type: 'result', is_error: false, session_id: 'fake', duration_ms: 1, num_turns: 1 }
  if (prompt === '/clear') {
    history = []
    send({ ...result, subtype: 'success', result: '', num_turns: 0 })
    return
  }
  const crashFlag = process.env.FAKE_CLAUDE_CRASH_FLAG
  if (prompt === 'DIE_ALWAYS' || (prompt === 'DIE_ONCE' && crashFlag && !existsSync(crashFlag))) {
    if (crashFlag) writeFileSync(crashFlag, '1')
    process.exit(1)
  }
  const respond = () => {
    if (prompt === 'FAIL') send({ ...result, subtype: 'error_during_execution', is_error: true, errors: ['model unavailable sk-ant-api03-abcdefghijklmnop'] })
    else if (prompt === 'LOGGED_OUT') send({ ...result, subtype: 'success', is_error: true, result: 'Not logged in · Please run /login' })
    else if (prompt === 'NO_OUTPUT') send({ ...result, subtype: 'success', result: '' })
    else if (phaseTurn) send({ ...result, subtype: 'success', result: '', structured_output: {
      phaseAnalysis: { phase: 'problem-framing', confidence: 0.7, nextAction: '确认预算', reason: '预算仍有分歧' },
      consensusAnalysis: { consensus: [], tensions: [], missing: [] },
    } })
    else send({ ...result, subtype: 'success', result: '', structured_output: {
      ok: true, echo: prompt, argv, cwd: process.cwd(), cwdExists: existsSync(process.cwd()), pid: process.pid,
      served: ++served, history: [...history],
      apiKeyPresent: 'ANTHROPIC_API_KEY' in process.env, tokenPresent: 'ANTHROPIC_AUTH_TOKEN' in process.env,
    } })
    history.push(prompt)
  }
  if (prompt === 'SLOW') setTimeout(respond, 300)
  else respond()
})
