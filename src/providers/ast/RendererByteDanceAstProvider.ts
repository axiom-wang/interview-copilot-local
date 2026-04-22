import { AudioCaptureService } from '../../services/AudioCapture'
import type {
  AstProvider,
  AstProviderStatusPayload,
  AstStatusCallback,
  TranscriptSegmentCallback,
} from './AstProvider'

export class RendererByteDanceAstProvider implements AstProvider {
  readonly id = 'bytedance-ast'
  readonly label = 'ByteDance AST'

  private static readonly MAX_BUFFERED_AUDIO_CHUNKS = 12

  private static readonly MAX_AUTO_RECONNECT_ATTEMPTS = 3

  private static readonly AUTO_RECONNECT_DELAY_MS = 1_200

  private readonly audioCapture = new AudioCaptureService()

  private removeSegmentListener: (() => void) | null = null

  private removeStatusListener: (() => void) | null = null

  private onStatus: AstStatusCallback | undefined

  private sendChunk: ((chunk: Uint8Array) => void) | null = null

  private bufferedAudioChunks: Uint8Array[] = []

  private bufferAudioUntilSessionStart = false

  private sessionStarted = false

  private isPaused = false

  private lifecycleToken = 0

  private stopInFlight: Promise<void> = Promise.resolve()

  private reconnectAttemptCount = 0

  private reconnectTimer: number | null = null

  private reconnectInFlight: Promise<void> | null = null

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

    const bridge = this.getBridge()
    const segmentListener = this.getSegmentListener()

    this.onStatus = onStatus
    this.isPaused = false
    this.clearReconnectState()
    this.bufferAudioUntilSessionStart = true
    this.clearBufferedAudioChunks()
    this.sendChunk = (chunk) => {
      bridge.sendByteDanceAstAudioChunk?.(chunk)
    }

    this.removeSegmentListener = segmentListener(onSegment)
    this.removeStatusListener = bridge.onByteDanceAstStatus!((payload) => {
      const resolvedPayload = this.handleAstStatus(payload)

      if (resolvedPayload) {
        this.onStatus?.(resolvedPayload)
      }
    })

    try {
      await this.audioCapture.start((chunk) => {
        this.handleAudioChunk(chunk)
      })

      if (token !== this.lifecycleToken) {
        await this.stopForToken(token)
        return
      }

      await this.startSession(token)

      if (token !== this.lifecycleToken) {
        await this.stopForToken(token)
        return
      }

      this.flushBufferedAudioChunks()
      this.isPaused = false
      this.onStatus?.({
        level: 'info',
        message: 'ByteDance AST connected. Microphone capture is active.',
      })
    } catch (error) {
      this.bufferAudioUntilSessionStart = false
      this.clearBufferedAudioChunks()
      await this.stopForToken(token)
      throw error instanceof Error
        ? error
        : new Error(
            'Microphone capture failed. Please check system input permissions.',
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

    await this.stopSession()

    if (token !== this.lifecycleToken) {
      return
    }

    this.isPaused = true
    this.onStatus?.({
      level: 'info',
      message:
        'Audio capture paused. Resume will reconnect ByteDance AST and keep the current transcript.',
    })
  }

  async resume() {
    if (!this.isPaused || !this.sendChunk) {
      return
    }

    const token = this.lifecycleToken
    this.clearReconnectState()
    this.bufferAudioUntilSessionStart = true
    this.clearBufferedAudioChunks()

    try {
      await this.audioCapture.resume()

      if (token !== this.lifecycleToken) {
        await this.stopForToken(token)
        return
      }

      await this.startSession(token)

      if (token !== this.lifecycleToken) {
        await this.stopForToken(token)
        return
      }

      this.flushBufferedAudioChunks()
      this.isPaused = false
      this.onStatus?.({
        level: 'info',
        message:
          'Audio capture resumed. ByteDance AST has reconnected and transcription can continue.',
      })
    } catch (error) {
      this.bufferAudioUntilSessionStart = false
      this.clearBufferedAudioChunks()

      try {
        await this.audioCapture.pause()
      } catch {
        // Ignore secondary pause errors while surfacing the original failure.
      }

      await this.stopSession()

      throw error instanceof Error
        ? error
        : new Error(
            'Microphone capture failed. Please check system input permissions.',
          )
    }
  }

  stop() {
    const token = ++this.lifecycleToken
    this.stopInFlight = this.stopForToken(token)
    void this.stopInFlight
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

    this.removeSegmentListener?.()
    this.removeStatusListener?.()
    this.removeSegmentListener = null
    this.removeStatusListener = null
    this.onStatus = undefined
    this.clearBufferedAudioChunks()
    this.bufferAudioUntilSessionStart = false
    this.sendChunk = null

    await this.stopSession()

    if (expectedToken !== this.lifecycleToken) {
      return
    }

    this.sessionStarted = false
    this.isPaused = false
  }

  private getBridge() {
    const bridge = window.interviewCopilot

    if (
      !bridge?.startByteDanceAstSession ||
      !bridge.sendByteDanceAstAudioChunk ||
      !bridge.stopByteDanceAstSession ||
      !bridge.onByteDanceAstStatus
    ) {
      throw new Error('ByteDance AST bridge is unavailable. Please restart app.')
    }

    return bridge
  }

  private getSegmentListener() {
    const bridge = this.getBridge()
    const segmentListener =
      bridge.onByteDanceAstTurn ?? bridge.onByteDanceAstSegment

    if (!segmentListener) {
      throw new Error(
        'ByteDance AST transcript event listener is unavailable. Please restart app.',
      )
    }

    return segmentListener
  }

  private async startSession(expectedToken: number) {
    const bridge = this.getBridge()
    const sessionResult = await bridge.startByteDanceAstSession!({
      mode: 's2t',
      sourceLanguage: 'zh',
      targetLanguage: 'en',
    })

    if (expectedToken !== this.lifecycleToken) {
      await this.stopSession()
      return
    }

    if (!sessionResult.ok) {
      this.bufferAudioUntilSessionStart = false
      throw new Error(sessionResult.error)
    }

    this.sessionStarted = true
    this.reconnectAttemptCount = 0
    this.bufferAudioUntilSessionStart = false
  }

  private async stopSession() {
    if (!this.sessionStarted) {
      return
    }

    try {
      await this.getBridge().stopByteDanceAstSession!()
    } catch {
      // Ignore shutdown errors to keep lifecycle stable.
    } finally {
      this.sessionStarted = false
      this.bufferAudioUntilSessionStart = false
    }
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
        message: `ByteDance AST 服务暂时中断，正在自动重连（${nextAttempt}/${RendererByteDanceAstProvider.MAX_AUTO_RECONNECT_ATTEMPTS}）。原始信息：${payload.message}`,
      }
    }

    return payload
  }

  private handleAudioChunk(chunk: Uint8Array) {
    if (this.sessionStarted && this.sendChunk) {
      this.sendChunk(chunk)
      return
    }

    if (!this.bufferAudioUntilSessionStart) {
      return
    }

    this.bufferedAudioChunks.push(chunk)

    if (
      this.bufferedAudioChunks.length >
      RendererByteDanceAstProvider.MAX_BUFFERED_AUDIO_CHUNKS
    ) {
      this.bufferedAudioChunks.shift()
    }
  }

  private flushBufferedAudioChunks() {
    if (!this.sessionStarted || !this.sendChunk) {
      return
    }

    for (const chunk of this.bufferedAudioChunks) {
      this.sendChunk(chunk)
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
    if (this.isPaused || !this.sendChunk) {
      return null
    }

    if (this.reconnectTimer !== null || this.reconnectInFlight) {
      return this.reconnectAttemptCount || 1
    }

    if (
      this.reconnectAttemptCount >=
      RendererByteDanceAstProvider.MAX_AUTO_RECONNECT_ATTEMPTS
    ) {
      return null
    }

    this.reconnectAttemptCount += 1
    const attempt = this.reconnectAttemptCount
    const expectedToken = this.lifecycleToken

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      const reconnectTask = this.performReconnect(expectedToken, attempt)

      this.reconnectInFlight = reconnectTask
      void reconnectTask.finally(() => {
        if (this.reconnectInFlight === reconnectTask) {
          this.reconnectInFlight = null
        }
      })
    }, RendererByteDanceAstProvider.AUTO_RECONNECT_DELAY_MS)

    return attempt
  }

  private async performReconnect(expectedToken: number, attempt: number) {
    try {
      await this.startSession(expectedToken)

      if (expectedToken !== this.lifecycleToken || this.isPaused) {
        return
      }

      this.flushBufferedAudioChunks()
      this.onStatus?.({
        level: 'info',
        message: `ByteDance AST 已自动重连（第 ${attempt} 次尝试成功），实时转写继续进行。`,
      })
    } catch (error) {
      if (expectedToken !== this.lifecycleToken || this.isPaused) {
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : 'ByteDance AST auto reconnect failed.'

      this.reconnectInFlight = null
      const nextAttempt = this.scheduleReconnect()

      if (nextAttempt !== null) {
        this.onStatus?.({
          level: 'warning',
          message: `ByteDance AST 自动重连失败，准备继续重试（${nextAttempt}/${RendererByteDanceAstProvider.MAX_AUTO_RECONNECT_ATTEMPTS}）：${message}`,
        })
        return
      }

      this.onStatus?.({
        level: 'error',
        message: `ByteDance AST 自动重连失败，实时转写已停止：${message}`,
      })
    }
  }
}
