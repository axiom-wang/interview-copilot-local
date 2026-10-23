import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { RendererVolcAsrProvider } from '../apps/desktop/renderer/providers/ast/RendererVolcAsrProvider'
import { RemoteVolcAsrProvider } from '../apps/web/providers/ast/RemoteVolcAsrProvider'
import { AudioCaptureService } from '../shared/ui/services/AudioCapture'

const replaceGlobal = (t: TestContext, key: string, value: unknown) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key)
  Object.defineProperty(globalThis, key, { configurable: true, value })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, key, previous)
    else Reflect.deleteProperty(globalThis, key)
  })
}

const mockAudio = (t: TestContext) => {
  let acquisitions = 0
  let stopped = 0
  let contexts = 0
  let waitForPermission: Promise<void> | undefined
  let waitForContext: Promise<void> | undefined
  const processor = { disconnect: () => {}, connect: () => {}, onaudioprocess: null as null | ((event: { inputBuffer: { getChannelData: () => Float32Array } }) => void) }
  replaceGlobal(t, 'navigator', { mediaDevices: { getUserMedia: async () => {
    acquisitions++
    await waitForPermission
    return { getTracks: () => [{ stop: () => { stopped++ } }] }
  } } })
  replaceGlobal(t, 'AudioContext', class {
    sampleRate = 16_000
    destination = {}
    constructor() { contexts++ }
    async resume() { await waitForContext }
    async close() {}
    createMediaStreamSource() { return { connect: () => {}, disconnect: () => {} } }
    createScriptProcessor() { return processor }
  })
  const windowMock: Record<string, unknown> = { setInterval, clearInterval, setTimeout, clearTimeout }
  replaceGlobal(t, 'window', windowMock)
  return {
    windowMock,
    get acquisitions() { return acquisitions },
    get stopped() { return stopped },
    get contexts() { return contexts },
    delayPermission: (promise: Promise<void>) => { waitForPermission = promise },
    delayContext: (promise: Promise<void>) => { waitForContext = promise },
    speak: (samples = 1024) => processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(samples).fill(0.5) } }),
  }
}

test('paused audio initialization never acquires a microphone; release flushes the last partial audio frame', async (t) => {
  const audio = mockAudio(t)
  const capture = new AudioCaptureService()
  t.after(() => capture.stop())
  const chunks: Uint8Array[] = []
  await capture.start((chunk) => chunks.push(chunk), { initiallyPaused: true })
  assert.equal(audio.acquisitions, 0)
  const controller = new AbortController()
  await capture.resume(controller.signal)
  audio.speak()
  assert.equal(chunks.length, 0, 'short audio has not filled a complete frame yet')
  controller.abort()
  assert.equal(audio.stopped, 1, 'release stops the microphone immediately')
  assert.equal(chunks.reduce((size, chunk) => size + chunk.byteLength, 0), 2048, 'the end of the question reaches the recognizer')
  await capture.pause()
  assert.equal(chunks.length, 1, 'pausing twice does not send the tail twice')
})

test('release during a pending microphone permission request stops the stream as soon as it arrives', async (t) => {
  const audio = mockAudio(t)
  const capture = new AudioCaptureService()
  t.after(() => capture.stop())
  let grant: (() => void) | undefined
  audio.delayPermission(new Promise<void>((resolve) => { grant = resolve }))
  await capture.start(() => {}, { initiallyPaused: true })
  const controller = new AbortController()
  const starting = capture.resume(controller.signal)
  await Promise.resolve()
  assert.equal(audio.acquisitions, 1)
  controller.abort()
  grant?.()
  await starting
  assert.equal(audio.stopped, 1)
  assert.equal(audio.contexts, 0, 'a late permission result cannot restart recording')
})

test('release also stops the microphone while the audio context is still starting', async (t) => {
  const audio = mockAudio(t)
  const capture = new AudioCaptureService()
  t.after(() => capture.stop())
  let ready: (() => void) | undefined
  audio.delayContext(new Promise<void>((resolve) => { ready = resolve }))
  await capture.start(() => {}, { initiallyPaused: true })
  const controller = new AbortController()
  const starting = capture.resume(controller.signal)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(audio.contexts, 1)
  controller.abort()
  assert.equal(audio.stopped, 1)
  ready?.()
  await starting
  assert.equal(audio.stopped, 1)
})

test('desktop QA releases the microphone while the speech connection is still pending', async (t) => {
  const audio = mockAudio(t)
  let connected: (() => void) | undefined
  const connection = new Promise<void>((resolve) => { connected = resolve })
  let started = 0
  const chunks: Uint8Array[] = []
  audio.windowMock.interviewCopilot = {
    startVolcAsrSession: async () => { started++; await connection; return { ok: true } },
    stopVolcAsrSession: async () => {},
    sendVolcAsrAudioChunk: (chunk: Uint8Array) => chunks.push(chunk),
    onVolcAsrSegment: () => () => {},
    onVolcAsrStatus: () => () => {},
  }
  const provider = new RendererVolcAsrProvider()
  t.after(() => provider.stop())
  await provider.start(() => {}, undefined, { initiallyPaused: true })
  assert.equal(started, 0)
  assert.equal(audio.acquisitions, 0)
  const controller = new AbortController()
  const starting = provider.resume(controller.signal)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(started, 1)
  audio.speak()
  controller.abort()
  assert.equal(audio.stopped, 1)
  connected?.()
  await starting
  await provider.pause()
  assert.equal(chunks.reduce((size, chunk) => size + chunk.byteLength, 0), 2048)
})

test('web QA initializes without opening a microphone or a speech socket', async (t) => {
  const audio = mockAudio(t)
  let sockets = 0
  replaceGlobal(t, 'WebSocket', class { static OPEN = 1; constructor() { sockets++ } })
  const provider = new RemoteVolcAsrProvider('wss://example.test/realtime')
  await provider.start(() => {}, undefined, { initiallyPaused: true })
  assert.equal(sockets, 0)
  assert.equal(audio.acquisitions, 0)
  await provider.stop()
})

test('web release preserves buffered speech until the recognizer acknowledges startup', async (t) => {
  const audio = mockAudio(t)
  const sockets: FakeSocket[] = []
  const sent: (string | ArrayBuffer)[] = []
  class FakeSocket extends EventTarget {
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
    readyState = 0
    constructor() { super(); sockets.push(this) }
    open() { this.readyState = 1; this.dispatchEvent(new Event('open')) }
    message(message: string) {
      this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'status', payload: { level: 'info', message } }) }))
    }
    send(data: string | ArrayBuffer) {
      sent.push(data)
      if (typeof data === 'string' && JSON.parse(data).type === 'stop') this.message('Volc ASR session finished.')
    }
    close() { this.readyState = 3; this.dispatchEvent(new Event('close')) }
  }
  replaceGlobal(t, 'WebSocket', FakeSocket)
  const provider = new RemoteVolcAsrProvider('wss://example.test/realtime')
  t.after(() => provider.stop())
  await provider.start(() => {}, undefined, { initiallyPaused: true })
  const controller = new AbortController()
  let ready = false
  const starting = provider.resume(controller.signal).then(() => { ready = true })
  await new Promise((resolve) => setImmediate(resolve))
  audio.speak()
  controller.abort()
  assert.equal(audio.stopped, 1)
  sockets[0].open()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(ready, false, 'an open socket does not mean the speech recognizer is ready')
  sockets[0].message('Volc ASR session started.')
  await starting
  await provider.pause()
  assert.equal(sent.filter((item) => item instanceof ArrayBuffer).reduce((size, chunk) => size + chunk.byteLength, 0), 2048)
  const audioIndex = sent.findIndex((item) => item instanceof ArrayBuffer)
  const stopIndex = sent.findIndex((item) => typeof item === 'string' && JSON.parse(item).type === 'stop')
  assert.ok(audioIndex < stopIndex, 'the question audio arrives before the stop frame')
})
