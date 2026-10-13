import assert from 'node:assert/strict'
import { gunzipSync, gzipSync } from 'node:zlib'
import test from 'node:test'
import { isTerminalAstStatus } from '../shared/meeting/providers/ast/AstProvider'
import { VolcAsrSession } from '../shared/analysis/ast/volcAsrSession'
import { createAudioFrame, createStartFrame, parseAsrFrame, type AsrResponse } from '../shared/analysis/ast/volcAsrProtocol'
import type { TranscriptSegment } from '../shared/meeting/types/transcript'

const serverFrame = (response: AsrResponse) => {
  const payload = gzipSync(Buffer.from(JSON.stringify(response)))
  const frame = Buffer.alloc(12 + payload.length)
  frame[0] = 0x11
  frame[1] = 0x91
  frame[2] = 0x11
  frame.writeInt32BE(1, 4)
  frame.writeUInt32BE(payload.length, 8)
  payload.copy(frame, 12)
  return frame
}

test('ASR request sends original speech with streaming speaker separation', () => {
  const start = createStartFrame()
  assert.equal(start[1], 0x10)
  const request = JSON.parse(gunzipSync(start.subarray(8)).toString('utf8'))
  assert.equal(request.audio.format, 'pcm')
  assert.equal(request.request.enable_nonstream, true)
  assert.equal(request.request.enable_speaker_info, true)
  assert.equal(request.request.show_utterances, true)
  assert.equal(request.request.target_language, undefined)
  const lastAudio = createAudioFrame(new Uint8Array(3200), true)
  assert.equal(lastAudio[1], 0x22)
})

test('ASR response parses the utterance and reports service errors', () => {
  const response = { code: 0, result: { utterances: [{ text: '你好。', start_time: 100, definite: true }] } }
  assert.deepEqual(parseAsrFrame(serverFrame(response)).response, response)
  assert.throws(() => parseAsrFrame(serverFrame({ code: 45000000, message: 'invalid key' })), /invalid key/)
  const message = Buffer.from('invalid api key')
  const errorFrame = Buffer.alloc(12 + message.length)
  errorFrame[0] = 0x11
  errorFrame[1] = 0xf0
  errorFrame[2] = 0x00
  errorFrame.writeUInt32BE(45000001, 4)
  errorFrame.writeUInt32BE(message.length, 8)
  message.copy(errorFrame, 12)
  assert.throws(() => parseAsrFrame(errorFrame), /45000001/)
  assert.throws(() => parseAsrFrame(errorFrame), /invalid api key/)
})

test('one utterance updates in place, finalizes, then switches speaker', () => {
  const segments: TranscriptSegment[] = []
  const session = new VolcAsrSession({ emitSegment: (segment) => segments.push(segment), emitStatus: () => {} })
  const accept = (session as unknown as { acceptResponse: (response: AsrResponse) => void }).acceptResponse.bind(session)
  accept({ result: { utterances: [{ text: '我们先', start_time: 100, definite: false }] } })
  accept({ result: { utterances: [{ text: '我们先看方案。', start_time: 100, definite: false }] } })
  accept({ result: { utterances: [{ text: '我们先看方案。', start_time: 100, definite: true, additions: { speaker_id: '0' } }] } })
  accept({ result: { utterances: [{ text: '我补充一点。', start_time: 1100, definite: true, additions: { speaker_id: '1' } }] } })
  assert.equal(segments[0]?.id, segments[1]?.id)
  assert.equal(segments[1]?.id, segments[2]?.id)
  assert.equal(segments[2]?.speaker, '发言人 1')
  assert.equal(segments[2]?.isFinal, true)
  assert.equal(segments[3]?.speaker, '发言人 2')
  assert.notEqual(segments[2]?.id, segments[3]?.id)
  assert.equal(segments[3]?.timestamp - segments[2]?.timestamp, 1000)
})

test('audio send failure reports a terminal status and idle audio does not', () => {
  const statuses: string[] = []
  const session = new VolcAsrSession({
    emitSegment: () => {},
    emitStatus: (payload) => statuses.push(payload.message),
  })
  assert.equal(session.appendAudioChunk(new Uint8Array([1])), false)
  assert.deepEqual(statuses, [])
  const internal = session as unknown as {
    acceptingAudio: boolean
    socket: { readyState: number; send: (frame: Buffer) => void }
  }
  internal.acceptingAudio = true
  internal.socket = { readyState: 3, send: () => { throw new Error('should not send') } }
  assert.equal(session.appendAudioChunk(new Uint8Array([1])), false)
  internal.socket = {
    readyState: 1,
    send: () => { throw new Error('socket hang up') },
  }
  assert.equal(session.appendAudioChunk(new Uint8Array([2])), false)
  assert.equal(statuses.length, 2)
  assert.match(statuses[0] ?? '', /^Volc ASR 音频发送已停止/)
  assert.match(statuses[1] ?? '', /socket hang up/)
  for (const message of statuses) assert.equal(isTerminalAstStatus({ level: 'warning', message }), true)
})

test('ending a session keeps the latest unfinished utterance', async () => {
  const segments: TranscriptSegment[] = []
  const session = new VolcAsrSession({ emitSegment: (segment) => segments.push(segment), emitStatus: () => {} })
  const accept = (session as unknown as { acceptResponse: (response: AsrResponse) => void }).acceptResponse.bind(session)
  accept({ result: { utterances: [{ text: '最后一个待办是', start_time: 2000, definite: false }] } })
  await session.stop()
  assert.equal(segments.length, 2)
  assert.equal(segments[0]?.id, segments[1]?.id)
  assert.equal(segments[1]?.text, '最后一个待办是')
  assert.equal(segments[1]?.isFinal, true)
})
