import { AudioCaptureService } from '../../services/AudioCapture'
import type {
  AstProvider,
  AstProviderStatusPayload,
  AstStatusCallback,
  TranscriptSegmentCallback,
} from './AstProvider'

type ServerMessage =
  | {
      type: 'segment' | 'turn'
      segment: Parameters<TranscriptSegmentCallback>[0]
    }
  | {
      type: 'status'
      payload: AstProviderStatusPayload
    }
  | {
      type: 'error'
      message: string
    }

const toSocketBuffer = (chunk: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(chunk.byteLength)
  copy.set(chunk)
  return copy.buffer as ArrayBuffer
}

export class RemoteByteDanceAstProvider implements AstProvider {
  readonly id = 'remote-bytedance-ast'
  readonly label = 'ByteDance AST (Remote)'

  private static readonly MAX_BUFFERED_AUDIO_CHUNKS = 24
  private static readonly MAX_AUTO_RECONNECT_ATTEMPTS = 3
  private static readonly AUTO_RECONNECT_DELAY_MS = 1_200

  private readonly audioCapture = new AudioCaptureService()
  private readonly wsUrl: string

  private socket: WebSocket | null = null
  private onSegment: TranscriptSegmentCallback | undefined
  private onStatus: AstStatusCallback | undefined
  private bufferedAudioChunks: Uint8Array[] = []
  private bufferAudioUntilSessionStart = false
  private sessionStarted = false
  private isPaused = false
  private lifecycleToken = 0
  private stopInFlight: Promise<void> = Promise.resolve()
  private reconnectAttemptCount = 0
  private reconnectTimer: number | null = null
  private reconnectInFlight: Promise<void> | null = null

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl
  }

  async start(
    onSegment: TranscriptSegmentCallback,
    onStatus?: AstStatusCallback,
  ): Promise<void> {
    const token = ++this.lifecycleToken
    await this.stopInFlight
    await this.stopForToken(token)

    if (token !== this.lifecycleToken) {
      return
    }

    if (!this.wsUrl) {
      throw new Error('VITE_REALTIME_WS_URL is not configured.')
    }

    this.onSegment = onSegment
    this.onStatus = onStatus
    this.isPaused = false
    this.sessionStarted = false
    this.clearReconnectState()
    this.bufferAudioUntilSessionStart = true
    this.clearBufferedAudioChunks()

    try {
      await this.connectAndStartSession(token)
      await this.audioCapture.start((chunk) => {
        this.handleAudioChunk(chunk)
      })

      if (token !== this.lifecycleToken) {
        await this.stopForToken(token)
        return
      }

      this.onStatus?.({
        level: 'info',
        message: 'Remote ByteDance AST connected. Microphone capture is active.',
      })
    } catch (error) {
      this.bufferAudioUntilSessionStart = false
      this.clearBufferedAudioChunks()
      await this.stopForToken(token)
      throw error instanceof Error
        ? error
        : new Error(
            'Remote microphone capture failed. Please check browser permissions.',
          )
    }
  }

  async pause() {
    if (this.isPaused) {
      return
    }

    const token = this.lifecycleToken
    this.clearReconnectState()
    this.bufferAudioUntilSessionStart = false
    this.clearBufferedAudioChunks()
    await this.audioCapture.pause()

    if (token !== this.lifecycleToken) {
      return
    }

    await this.stopRemoteSession()

    if (token !== this.lifecycleToken) {
      return
    }

    this.isPaused = true
    this.onStatus?.({
      level: 'info',
      message:
        'Audio capture paused. Resume will reconnect remote ByteDance AST and keep the current transcript.',
    })
  }

  async resume() {
    if (!this.isPaused) {
      return
    }

    const token = this.lifecycleToken
    this.clearReconnectState()
    this.bufferAudioUntilSessionStart = true
    this.clearBufferedAudioChunks()

    try {
      await this.connectAndStartSession(token)
      await this.audioCapture.resume()

      if (token !== this.lifecycleToken) {
        await this.stopForToken(token)
        return
      }

      this.isPaused = false
      this.onStatus?.({
        level: 'info',
        message:
          'Audio capture resumed. Remote ByteDance AST has reconnected and transcription can continue.',
      })
    } catch (error) {
      this.bufferAudioUntilSessionStart = false
      this.clearBufferedAudioChunks()

      try {
        await this.audioCapture.pause()
      } catch {
        // Keep the original reconnect error visible.
      }

      await this.stopRemoteSession()

      throw error instanceof Error
        ? error
        : new Error(
            'Remote microphone capture failed. Please check browser permissions.',
          )
    }
  }

  stop() {
    const token = ++this.lifecycleToken
    this.stopInFlight = this.stopForToken(token)
    void this.stopInFlight
  }

  private async connectAndStartSession(expectedToken: number) {
    if (expectedToken !== this.lifecycleToken) {
      return
    }

    await this.closeSocket()

    const socket = new WebSocket(this.wsUrl)
    socket.binaryType = 'arraybuffer'
    this.socket = socket

    socket.addEventListener('message', this.handleSocketMessage)
    socket.addEventListener('close', this.handleSocketClose)
    socket.addEventListener('error', this.handleSocketError)

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.removeEventListener('open', handleOpen)
        socket.removeEventListener('error', handleOpenError)
      }
      const handleOpen = () => {
        cleanup()
        resolve()
      }
      const handleOpenError = () => {
        cleanup()
        reject(new Error('Remote ByteDance AST websocket failed to connect.'))
      }

      socket.addEventListener('open', handleOpen)
      socket.addEventListener('error', handleOpenError)
    })

    if (expectedToken !== this.lifecycleToken) {
      await this.closeSocket(socket)
      return
    }

    this.sendJson({
      type: 'start',
      mode: 's2t',
      sourceLanguage: 'zh',
      targetLanguage: 'en',
    })
  }

  private async stopForToken(expectedToken: number) {
    if (expectedToken !== this.lifecycleToken) {
      return
    }

    this.clearReconnectState()
    await this.audioCapture.stop()

    if (expectedToken !== this.lifecycleToken) {
      return
    }

    this.onSegment = undefined
    this.onStatus = undefined
    this.clearBufferedAudioChunks()
    this.bufferAudioUntilSessionStart = false

    await this.stopRemoteSession()

    if (expectedToken !== this.lifecycleToken) {
      return
    }

    this.sessionStarted = false
    this.isPaused = false
  }

  private async stopRemoteSession() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendJson({ type: 'stop' })
    }

    await this.closeSocket()
    this.sessionStarted = false
    this.bufferAudioUntilSessionStart = false
  }

  private async closeSocket(socket = this.socket) {
    if (!socket) {
      return
    }

    socket.removeEventListener('message', this.handleSocketMessage)
    socket.removeEventListener('close', this.handleSocketClose)
    socket.removeEventListener('error', this.handleSocketError)

    if (this.socket === socket) {
      this.socket = null
    }

    if (
      socket.readyState === WebSocket.CLOSING ||
      socket.readyState === WebSocket.CLOSED
    ) {
      return
    }

    await new Promise<void>((resolve) => {
      const timeoutId = window.setTimeout(resolve, 300)
      socket.addEventListener(
        'close',
        () => {
          window.clearTimeout(timeoutId)
          resolve()
        },
        { once: true },
      )
      socket.close()
    })
  }

  private readonly handleSocketMessage = (event: MessageEvent) => {
    if (typeof event.data !== 'string') {
      return
    }

    let message: ServerMessage

    try {
      message = JSON.parse(event.data) as ServerMessage
    } catch {
      return
    }

    if (message.type === 'segment' || message.type === 'turn') {
      this.sessionStarted = true
      this.bufferAudioUntilSessionStart = false
      this.flushBufferedAudioChunks()
      this.onSegment?.(message.segment)
      return
    }

    if (message.type === 'status') {
      const resolvedPayload = this.handleAstStatus(message.payload)

      if (resolvedPayload?.message === 'ByteDance AST session started.') {
        this.sessionStarted = true
        this.bufferAudioUntilSessionStart = false
        this.flushBufferedAudioChunks()
      }

      if (resolvedPayload) {
        this.onStatus?.(resolvedPayload)
      }
      return
    }

    if (message.type !== 'error') {
      return
    }

    const resolvedPayload = this.handleAstStatus({
      level: 'error',
      message: message.message,
    })

    if (resolvedPayload) {
      this.onStatus?.(resolvedPayload)
    }
  }

  private readonly handleSocketClose = () => {
    if (this.isPaused || !this.socket) {
      return
    }

    const nextAttempt = this.scheduleReconnect()

    if (nextAttempt !== null) {
      this.onStatus?.({
        level: 'warning',
        message: `Remote AST socket closed. Reconnecting (${nextAttempt}/${RemoteByteDanceAstProvider.MAX_AUTO_RECONNECT_ATTEMPTS}).`,
      })
    }
  }

  private readonly handleSocketError = () => {
    if (this.isPaused) {
      return
    }

    const nextAttempt = this.scheduleReconnect()

    if (nextAttempt !== null) {
      this.onStatus?.({
        level: 'warning',
        message: `Remote AST socket error. Reconnecting (${nextAttempt}/${RemoteByteDanceAstProvider.MAX_AUTO_RECONNECT_ATTEMPTS}).`,
      })
      return
    }

    this.onStatus?.({
      level: 'error',
      message: 'Remote AST socket error and reconnect attempts are exhausted.',
    })
  }

  private handleAstStatus(
    payload: AstProviderStatusPayload,
  ): AstProviderStatusPayload | null {
    if (!this.isTerminalStatus(payload)) {
      return payload
    }

    this.sessionStarted = false
    this.bufferAudioUntilSessionStart = false
    this.clearBufferedAudioChunks()

    const nextAttempt = this.scheduleReconnect()

    if (nextAttempt !== null) {
      return {
        ...payload,
        level: 'warning',
        message: `Remote ByteDance AST interrupted. Reconnecting (${nextAttempt}/${RemoteByteDanceAstProvider.MAX_AUTO_RECONNECT_ATTEMPTS}). Original message: ${payload.message}`,
      }
    }

    return payload
  }

  private handleAudioChunk(chunk: Uint8Array) {
    if (this.sessionStarted && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(toSocketBuffer(chunk))
      return
    }

    if (!this.bufferAudioUntilSessionStart) {
      return
    }

    this.bufferedAudioChunks.push(chunk)

    if (
      this.bufferedAudioChunks.length >
      RemoteByteDanceAstProvider.MAX_BUFFERED_AUDIO_CHUNKS
    ) {
      this.bufferedAudioChunks.shift()
    }
  }

  private flushBufferedAudioChunks() {
    if (!this.sessionStarted || this.socket?.readyState !== WebSocket.OPEN) {
      return
    }

    for (const chunk of this.bufferedAudioChunks) {
      this.socket.send(toSocketBuffer(chunk))
    }

    this.clearBufferedAudioChunks()
  }

  private clearBufferedAudioChunks() {
    this.bufferedAudioChunks = []
  }

  private isTerminalStatus(payload: AstProviderStatusPayload) {
    return (
      payload.level === 'error' ||
      payload.message === 'ByteDance AST session finished.' ||
      payload.message.startsWith('ByteDance AST socket closed unexpectedly')
    )
  }

  private clearReconnectState() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.reconnectInFlight = null
    this.reconnectAttemptCount = 0
  }

  private scheduleReconnect() {
    if (this.isPaused) {
      return null
    }

    if (this.reconnectTimer !== null || this.reconnectInFlight) {
      return this.reconnectAttemptCount || 1
    }

    if (
      this.reconnectAttemptCount >=
      RemoteByteDanceAstProvider.MAX_AUTO_RECONNECT_ATTEMPTS
    ) {
      return null
    }

    this.reconnectAttemptCount += 1
    const attempt = this.reconnectAttemptCount
    const expectedToken = this.lifecycleToken
    this.bufferAudioUntilSessionStart = true

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      const reconnectTask = this.performReconnect(expectedToken, attempt)

      this.reconnectInFlight = reconnectTask
      void reconnectTask.finally(() => {
        if (this.reconnectInFlight === reconnectTask) {
          this.reconnectInFlight = null
        }
      })
    }, RemoteByteDanceAstProvider.AUTO_RECONNECT_DELAY_MS)

    return attempt
  }

  private async performReconnect(expectedToken: number, attempt: number) {
    try {
      await this.connectAndStartSession(expectedToken)

      if (expectedToken !== this.lifecycleToken || this.isPaused) {
        return
      }

      this.onStatus?.({
        level: 'info',
        message: `Remote ByteDance AST reconnected (attempt ${attempt}).`,
      })
    } catch (error) {
      if (expectedToken !== this.lifecycleToken || this.isPaused) {
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Remote ByteDance AST reconnect failed.'

      this.reconnectInFlight = null
      const nextAttempt = this.scheduleReconnect()

      if (nextAttempt !== null) {
        this.onStatus?.({
          level: 'warning',
          message: `Remote ByteDance AST reconnect failed. Retrying (${nextAttempt}/${RemoteByteDanceAstProvider.MAX_AUTO_RECONNECT_ATTEMPTS}): ${message}`,
        })
        return
      }

      this.onStatus?.({
        level: 'error',
        message: `Remote ByteDance AST reconnect failed: ${message}`,
      })
    }
  }

  private sendJson(payload: Record<string, unknown>) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error('Remote ByteDance AST socket is not connected.')
    }

    this.socket.send(JSON.stringify(payload))
  }
}
