import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import {
  VOLC_ASR_AUDIO_SEND_STOPPED_PREFIX,
  VOLC_ASR_SOCKET_CLOSED_PREFIX,
} from '../../meeting/providers/ast/AstProvider'
import type { TranscriptSegment } from '../../meeting/types/transcript'
import { getVolcAsrConfig, getVolcAsrHeaders, type VolcAsrConfigOverride } from './volcAsrConfig'
import { createAudioFrame, createStartFrame, parseAsrFrame, type AsrResponse } from './volcAsrProtocol'

export interface VolcAsrStatusPayload {
  level: 'info' | 'warning' | 'error'
  message: string
  speakerStability?: 'stable' | 'unstable'
}

interface SessionOptions {
  emitSegment: (segment: TranscriptSegment) => void
  emitStatus: (payload: VolcAsrStatusPayload) => void
}

interface StartOptions {
  credentials?: VolcAsrConfigOverride
}

export class VolcAsrSession {
  private readonly emitSegment: SessionOptions['emitSegment']
  private readonly emitStatus: SessionOptions['emitStatus']
  private socket: WebSocket | null = null
  private epoch = 0
  private sessionId = ''
  private knownSegments = new Map<string, TranscriptSegment>()
  private fallbackId: string | null = null
  private acceptingAudio = false
  private stopPromise: Promise<void> | null = null
  private finishWaiter: (() => void) | null = null

  constructor(options: SessionOptions) {
    this.emitSegment = options.emitSegment
    this.emitStatus = options.emitStatus
  }

  async start(options: StartOptions = {}) {
    await this.stop()
    const config = getVolcAsrConfig(options.credentials)
    this.epoch = Date.now()
    this.sessionId = randomUUID()
    this.knownSegments.clear()
    this.fallbackId = null

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(config.wsUrl, {
        headers: getVolcAsrHeaders(config),
        handshakeTimeout: 8_000,
      })
      this.socket = socket
      let settled = false
      const timeout = setTimeout(() => fail(new Error('流式语音识别连接超时。')), 8_000)
      const fail = (error: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        socket.terminate()
        reject(error)
      }
      socket.once('open', () => {
        try {
          socket.send(createStartFrame())
          this.acceptingAudio = true
          settled = true
          clearTimeout(timeout)
          resolve()
        } catch (error) {
          fail(error instanceof Error ? error : new Error('无法发送识别请求。'))
        }
      })
      socket.on('message', (data) => {
        try {
          const raw = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
          const { response, isLast } = parseAsrFrame(raw)
          this.acceptResponse(response)
          if (isLast) this.finishWaiter?.()
        } catch (error) {
          const message = error instanceof Error ? error.message : '识别结果解析失败。'
          if (!settled) fail(new Error(message))
          else this.emitStatus({ level: 'error', message })
        }
      })
      socket.once('unexpected-response', (_request, response) => {
        fail(new Error(`流式语音识别握手失败（HTTP ${response.statusCode ?? '未知'}）：请检查 API Key、Resource ID 和服务权限。`))
      })
      socket.on('error', (error) => {
        if (!settled) fail(error)
        else this.emitStatus({ level: 'error', message: `流式语音识别连接错误：${error.message}` })
      })
      socket.on('close', (code) => {
        this.acceptingAudio = false
        this.finishWaiter?.()
        if (!settled) fail(new Error(`流式语音识别连接提前关闭（${code}）。`))
        else if (code !== 1000 && this.socket === socket) {
          this.emitStatus({ level: 'warning', message: `${VOLC_ASR_SOCKET_CLOSED_PREFIX} (${code}).` })
        }
      })
    })
  }

  appendAudioChunk(chunk: Uint8Array) {
    if (!this.acceptingAudio) return false
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.emitAudioSendStopped()
      return false
    }
    try {
      this.socket.send(createAudioFrame(chunk))
      return true
    } catch (error) {
      this.emitAudioSendStopped(error)
      return false
    }
  }

  private emitAudioSendStopped(error?: unknown) {
    const detail = error instanceof Error ? error.message : ''
    this.emitStatus({
      level: 'warning',
      message: detail
        ? `${VOLC_ASR_AUDIO_SEND_STOPPED_PREFIX}：${detail}`
        : `${VOLC_ASR_AUDIO_SEND_STOPPED_PREFIX}。`,
    })
  }

  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise
    this.stopPromise = this.finish().finally(() => { this.stopPromise = null })
    return this.stopPromise
  }

  private async finish() {
    const socket = this.socket
    this.acceptingAudio = false
    if (!socket) {
      this.finalizeUnfinished()
      return
    }
    if (socket.readyState === WebSocket.OPEN) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 2_500)
        this.finishWaiter = () => { clearTimeout(timer); resolve() }
        try { socket.send(createAudioFrame(new Uint8Array(), true)) }
        catch { this.finishWaiter() }
      })
    }
    this.finishWaiter = null
    if (this.socket === socket) this.socket = null
    socket.removeAllListeners()
    socket.on('error', () => {})
    if (socket.readyState === WebSocket.OPEN) socket.close()
    else socket.terminate()
    this.finalizeUnfinished()
  }

  private finalizeUnfinished() {
    for (const [id, segment] of this.knownSegments) {
      if (!segment.isFinal) {
        const final = { ...segment, isFinal: true }
        this.knownSegments.set(id, final)
        this.emitSegment(final)
      }
    }
  }

  private acceptResponse(response: AsrResponse) {
    const utterances = response.result?.utterances ?? []
    if (utterances.length === 0 && response.result?.text?.trim()) {
      const text = response.result.text.trim()
      const id = this.fallbackId ?? `${this.sessionId}:pending`
      this.fallbackId = id
      this.upsert({ id, speaker: '待识别发言人', text, timestamp: this.epoch, isFinal: false, source: 'ast' })
      return
    }
    for (const utterance of utterances) {
      const text = utterance.text?.trim()
      if (!text) continue
      const start = Math.max(0, utterance.start_time ?? 0)
      const speakerId = utterance.additions?.speaker_id ?? utterance.speaker_id
      const speaker = speakerId === undefined || speakerId === null || speakerId === ''
        ? '待识别发言人'
        : `发言人 ${Number.isFinite(Number(speakerId)) ? Number(speakerId) + 1 : String(speakerId)}`
      const id = this.findSegmentId(start) ?? this.fallbackId ?? `${this.sessionId}:${start}`
      if (id === this.fallbackId) this.fallbackId = null
      this.upsert({
        id,
        speaker,
        text,
        timestamp: this.epoch + start,
        isFinal: utterance.definite === true,
        source: 'ast',
      })
      if (speaker === '待识别发言人') {
        this.emitStatus({ level: 'warning', message: '当前片段尚无说话人编号，定稿后会更新。', speakerStability: 'unstable' })
      } else {
        this.emitStatus({ level: 'info', message: '正在识别会议原话。', speakerStability: 'stable' })
      }
    }
  }

  private findSegmentId(start: number) {
    for (const [id, segment] of this.knownSegments) {
      if (Math.abs(segment.timestamp - (this.epoch + start)) <= 180 && !segment.isFinal) return id
      if (segment.timestamp === this.epoch + start) return id
    }
    return null
  }

  private upsert(segment: TranscriptSegment) {
    const previous = this.knownSegments.get(segment.id)
    if (previous?.isFinal && !segment.isFinal) return
    if (previous && previous.text === segment.text && previous.speaker === segment.speaker && previous.isFinal === segment.isFinal) return
    this.knownSegments.set(segment.id, segment)
    this.emitSegment(segment)
  }
}
