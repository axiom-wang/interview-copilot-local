import { randomUUID } from 'node:crypto'
import protobuf from 'protobufjs'
import WebSocket from 'ws'
import type { TranscriptSegment } from '../../src/types/transcript'
import { getByteDanceAstRuntimeConfig } from './bytedanceConfig'
import astSchema from './protos/ast-schema.json'

const START_TIMEOUT_MS = 8000
const STATUS_CODE_OK = 20_000_000
const TURN_BREAK_MS = 10_000
const OVERLAP_MIN_CHARS = 6

type ByteDanceStartOptions = {
  mode?: 's2t' | 's2s'
  sourceLanguage?: string
  targetLanguage?: string
  credentials?: {
    appId?: string
    accessToken?: string
    resourceId?: string
    wsUrl?: string
  }
}

type SpeakerStability = 'stable' | 'unstable'

export interface ByteDanceAstSessionStatusPayload {
  level: 'info' | 'warning' | 'error'
  message: string
  speakerStability?: SpeakerStability
}

interface ByteDanceAstSessionOptions {
  emitSegment: (segment: TranscriptSegment) => void
  emitTurn: (segment: TranscriptSegment) => void
  emitStatus: (payload: ByteDanceAstSessionStatusPayload) => void
}

interface ProtoRuntime {
  translateRequestType: protobuf.Type
  translateResponseType: protobuf.Type
  understandingResultType: protobuf.Type
  eventType: protobuf.Enum
}

let protoRuntimePromise: Promise<ProtoRuntime> | null = null

const loadProtoRuntime = async (): Promise<ProtoRuntime> => {
  if (!protoRuntimePromise) {
    protoRuntimePromise = Promise.resolve().then(() => {
      const root = protobuf.Root.fromJSON(astSchema as protobuf.INamespace)

      return {
        translateRequestType: root.lookupType(
          'data.speech.ast.TranslateRequest',
        ),
        translateResponseType: root.lookupType(
          'data.speech.ast.TranslateResponse',
        ),
        understandingResultType: root.lookupType(
          'data.speech.understanding.Result',
        ),
        eventType: root.lookupEnum('data.speech.event.Type'),
      }
    })
  }

  return protoRuntimePromise
}

const asNumber = (value: unknown) =>
  typeof value === 'number' ? value : undefined

const asString = (value: unknown) =>
  typeof value === 'string' ? value : undefined

const asBoolean = (value: unknown) =>
  typeof value === 'boolean' ? value : undefined

const normalizeAstTranscriptText = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/(?<=\d)\s+(?=\d)/g, '')
    .replace(/(?<=[\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, '')
    .replace(/(?<=[\p{Script=Han}])\s+(?=\d)/gu, '')
    .replace(/(?<=\d)\s+(?=[\p{Script=Han}])/gu, '')
    .replace(/(?<=[\p{Script=Han}])\s+(?=[A-Za-z0-9])/gu, '')
    .replace(/(?<=[A-Za-z0-9])\s+(?=[\p{Script=Han}])/gu, '')
    .replace(/(?<=[\p{L}\p{N}])\s+(?=[^\p{L}\p{N}\s])/gu, '')
    .replace(/(?<=[^\p{L}\p{N}\s])\s+(?=[\p{L}\p{N}])/gu, '')
    .trim()

const normalizeComparableText = (text: string) => text.replace(/\s+/g, '').trim()

const pickPreferredText = (left: string, right: string) => {
  const trimmedLeft = left.trim()
  const trimmedRight = right.trim()

  if (!trimmedLeft) {
    return trimmedRight
  }

  if (!trimmedRight) {
    return trimmedLeft
  }

  const leftComparable = normalizeComparableText(trimmedLeft)
  const rightComparable = normalizeComparableText(trimmedRight)

  if (!leftComparable) {
    return trimmedRight
  }

  if (!rightComparable) {
    return trimmedLeft
  }

  if (leftComparable === rightComparable) {
    return trimmedRight.length >= trimmedLeft.length ? trimmedRight : trimmedLeft
  }

  if (rightComparable.includes(leftComparable)) {
    return trimmedRight
  }

  if (leftComparable.includes(rightComparable)) {
    return trimmedLeft
  }

  return trimmedRight
}

const findTextOverlapLength = (left: string, right: string) => {
  const maxOverlap = Math.min(left.length, right.length)

  for (let size = maxOverlap; size >= OVERLAP_MIN_CHARS; size -= 1) {
    if (left.slice(-size) === right.slice(0, size)) {
      return size
    }
  }

  return 0
}

const mergeTurnText = (previousText: string, nextText: string) => {
  const trimmedPrevious = previousText.trim()
  const trimmedNext = nextText.trim()

  if (!trimmedPrevious) {
    return trimmedNext
  }

  if (!trimmedNext) {
    return trimmedPrevious
  }

  if (trimmedPrevious === trimmedNext || trimmedPrevious.includes(trimmedNext)) {
    return trimmedPrevious
  }

  if (trimmedNext.includes(trimmedPrevious)) {
    return trimmedNext
  }

  const overlapLength = findTextOverlapLength(trimmedPrevious, trimmedNext)

  if (overlapLength >= OVERLAP_MIN_CHARS && overlapLength < trimmedNext.length) {
    return `${trimmedPrevious}${trimmedNext.slice(overlapLength)}`
  }

  return `${trimmedPrevious}${trimmedNext}`
}

const buildSpeakerLabel = (speakerIndex: number) => `Speaker ${speakerIndex}`

export class ByteDanceAstSession {
  private readonly emitSegment: ByteDanceAstSessionOptions['emitSegment']

  private readonly emitTurn: ByteDanceAstSessionOptions['emitTurn']

  private readonly emitStatus: ByteDanceAstSessionOptions['emitStatus']

  private socket: WebSocket | null = null

  private protoRuntime: ProtoRuntime | null = null

  private sessionId = ''

  private connectionId = ''

  private isSessionStarted = false

  private currentSourceSegmentId: string | null = null

  private currentSourceStartTime = 0

  private currentSpeakerKey = 'fallback:1'

  private fallbackSpeakerSerial = 1

  private localSpeakerSerial = 0

  private speakerKeyToLocalSpeaker = new Map<string, string>()

  private speakerStability: SpeakerStability | null = null

  private sessionEpochMs = 0

  private utteranceSerial = 0

  private turnSerial = 0

  private currentTurnId: string | null = null

  private currentTurnSpeaker = ''

  private currentTurnUpdatedAt = 0

  private currentTurnUtteranceOrder: string[] = []

  private currentTurnUtteranceTexts = new Map<string, string>()

  constructor(options: ByteDanceAstSessionOptions) {
    this.emitSegment = options.emitSegment
    this.emitTurn = options.emitTurn
    this.emitStatus = options.emitStatus
  }

  async start(options: ByteDanceStartOptions = {}) {
    await this.stop()

    this.protoRuntime = await loadProtoRuntime()
    const config = getByteDanceAstRuntimeConfig(options.credentials)
    this.connectionId = randomUUID()
    this.sessionId = randomUUID()
    this.sessionEpochMs = Date.now()
    this.currentSourceSegmentId = null
    this.currentSourceStartTime = 0
    this.currentSpeakerKey = 'fallback:1'
    this.fallbackSpeakerSerial = 1
    this.localSpeakerSerial = 0
    this.speakerKeyToLocalSpeaker.clear()
    this.speakerStability = null
    this.utteranceSerial = 0
    this.turnSerial = 0
    this.resetCurrentTurn()

    const runtime = this.protoRuntime
    const eventValues = runtime.eventType.values

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(config.wsUrl, {
        headers: {
          'X-Api-App-Key': config.appId,
          'X-Api-Access-Key': config.accessToken,
          'X-Api-Resource-Id': config.resourceId,
          'X-Api-Connect-Id': this.connectionId,
        },
        handshakeTimeout: START_TIMEOUT_MS,
      })

      this.socket = socket

      const timeout = setTimeout(() => {
        socket.terminate()
        reject(new Error('ByteDance AST session start timeout.'))
      }, START_TIMEOUT_MS)

      const cleanup = () => {
        clearTimeout(timeout)
        socket.removeListener('open', handleOpen)
        socket.removeListener('message', handleStartMessage)
        socket.removeListener('error', handleStartError)
        socket.removeListener('close', handleStartClose)
      }

      const handleOpen = () => {
        try {
          this.emitStatus({
            level: 'info',
            message: 'ByteDance AST websocket connected. Starting session...',
          })
          this.sendMessage({
            requestMeta: {
              ConnectionID: this.connectionId,
              SessionID: this.sessionId,
            },
            event: eventValues.StartSession,
            user: {
              uid: 'interview-copilot-local',
              did: 'interview-copilot-local',
              platform: process.platform,
              sdkVersion: 'electron-local',
            },
            sourceAudio: {
              format: 'wav',
              codec: 'raw',
              rate: 16000,
              bits: 16,
              channel: 1,
            },
            request: {
              mode: options.mode ?? 's2t',
              sourceLanguage: options.sourceLanguage ?? 'zh',
              targetLanguage: options.targetLanguage ?? 'en',
              enableSpeakerInfo: true,
              showUtterances: true,
              reco2maxNumSpk: 8,
            },
          })
        } catch (error) {
          cleanup()
          socket.terminate()
          reject(error)
        }
      }

      const handleStartMessage = (payload: WebSocket.RawData) => {
        try {
          const response = this.decodeResponse(payload)
          const eventCode = asNumber(response.event)
          const statusCode = asNumber(response.responseMeta?.StatusCode)

          if (
            typeof statusCode === 'number' &&
            statusCode !== STATUS_CODE_OK &&
            eventCode !== eventValues.UsageResponse
          ) {
            throw new Error(
              response.responseMeta?.Message ??
                `ByteDance AST status code: ${statusCode}`,
            )
          }

          if (eventCode === eventValues.SessionStarted) {
            this.isSessionStarted = true
            cleanup()
            socket.on('message', this.handleStreamingMessage)
            socket.on('error', this.handleStreamingError)
            socket.on('close', this.handleStreamingClose)
            this.emitStatus({
              level: 'info',
              message: 'ByteDance AST session started.',
            })
            resolve()
            return
          }

          if (eventCode === eventValues.SessionFailed) {
            throw new Error(
              response.responseMeta?.Message ?? 'ByteDance AST session failed.',
            )
          }
        } catch (error) {
          cleanup()
          socket.terminate()
          reject(error)
        }
      }

      const handleStartError = (error: Error) => {
        cleanup()
        reject(error)
      }

      const handleStartClose = () => {
        cleanup()
        if (!this.isSessionStarted) {
          reject(new Error('ByteDance AST socket closed before session started.'))
        }
      }

      socket.on('open', handleOpen)
      socket.on('message', handleStartMessage)
      socket.on('error', handleStartError)
      socket.on('close', handleStartClose)
    })
  }

  appendAudioChunk(chunk: Uint8Array) {
    if (!this.socket || !this.isSessionStarted) {
      return false
    }

    try {
      const eventValues = this.getEventValues()

      this.sendMessage({
        requestMeta: {
          ConnectionID: this.connectionId,
          SessionID: this.sessionId,
        },
        event: eventValues.TaskRequest,
        sourceAudio: {
          binaryData: chunk,
        },
      })

      return true
    } catch (error) {
      this.markStreamingSessionClosed()
      this.emitStatus({
        level: 'warning',
        message:
          error instanceof Error
            ? `ByteDance AST 音频发送已停止：${error.message}`
            : 'ByteDance AST 音频发送已停止。',
      })

      return false
    }
  }

  async stop() {
    this.finalizeCurrentTurn()

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        const eventValues = this.getEventValues()
        this.sendMessage({
          requestMeta: {
            ConnectionID: this.connectionId,
            SessionID: this.sessionId,
          },
          event: eventValues.FinishSession,
        })
      } catch {
        // Ignore shutdown send errors.
      }

      this.socket.close()
    }

    this.socket?.removeAllListeners()
    this.socket = null
    this.isSessionStarted = false
    this.currentSourceSegmentId = null
    this.currentSourceStartTime = 0
    this.currentSpeakerKey = 'fallback:1'
    this.fallbackSpeakerSerial = 1
    this.localSpeakerSerial = 0
    this.speakerKeyToLocalSpeaker.clear()
    this.speakerStability = null
    this.utteranceSerial = 0
    this.turnSerial = 0
    this.resetCurrentTurn()
  }

  private readonly handleStreamingMessage = (payload: WebSocket.RawData) => {
    try {
      const response = this.decodeResponse(payload)
      const eventValues = this.getEventValues()
      const eventCode = asNumber(response.event)

      if (eventCode === eventValues.SourceSubtitleStart) {
        const speakerResolution = this.resolveSpeakerKey(response, eventCode)
        const didSpeakerChange = this.currentSpeakerKey !== speakerResolution.key

        if (didSpeakerChange) {
          this.finalizeCurrentTurn()
        }

        this.currentSpeakerKey = speakerResolution.key
        this.updateSpeakerStability(speakerResolution.stability)

        const startTime = asNumber(response.startTime) ?? 0
        this.currentSourceStartTime = startTime
        this.currentSourceSegmentId = null
        this.ensureCurrentSegmentId(startTime)
        const localSpeaker = this.getLocalSpeakerLabel(this.currentSpeakerKey)

        this.ensureCurrentTurn(
          this.toWallClockTimestamp(this.currentSourceStartTime),
          localSpeaker,
        )
        return
      }

      if (eventCode === eventValues.SourceSubtitleResponse) {
        const text = normalizeAstTranscriptText(asString(response.text) ?? '')

        if (!text) {
          return
        }

        const startTime = asNumber(response.startTime)
        const segmentId = this.ensureCurrentSegmentId(startTime)
        const speakerResolution = this.resolveSpeakerKey(response, eventCode)
        this.currentSpeakerKey = speakerResolution.key
        this.updateSpeakerStability(speakerResolution.stability)
        const segment: TranscriptSegment = {
          id: segmentId,
          speaker: this.getLocalSpeakerLabel(this.currentSpeakerKey),
          text,
          timestamp: this.toWallClockTimestamp(this.currentSourceStartTime),
          isFinal: false,
          source: 'ast',
        }

        this.emitSegment(segment)
        this.upsertCurrentTurnSegment(segment)
        return
      }

      if (eventCode === eventValues.SourceSubtitleEnd) {
        const text = normalizeAstTranscriptText(asString(response.text) ?? '')

        if (!text) {
          return
        }

        const startTime = asNumber(response.startTime)
        const resolvedStartTime = startTime ?? this.currentSourceStartTime
        const endTime = asNumber(response.endTime) ?? resolvedStartTime
        const segmentId = this.ensureCurrentSegmentId(startTime)
        const speakerResolution = this.resolveSpeakerKey(response, eventCode)
        this.currentSpeakerKey = speakerResolution.key
        this.updateSpeakerStability(speakerResolution.stability)
        const segment: TranscriptSegment = {
          id: segmentId,
          speaker: this.getLocalSpeakerLabel(this.currentSpeakerKey),
          text,
          timestamp: this.toWallClockTimestamp(endTime),
          isFinal: true,
          source: 'ast',
        }

        this.emitSegment(segment)
        this.upsertCurrentTurnSegment(segment)

        this.currentSourceSegmentId = null
        this.currentSourceStartTime = 0
        return
      }

      if (eventCode === eventValues.AudioMuted) {
        const mutedDurationMs = asNumber(response.mutedDurationMs) ?? 0
        this.emitStatus({
          level: 'info',
          message: `Audio muted for about ${Math.round(mutedDurationMs / 1000)}s.`,
        })
        return
      }

      if (eventCode === eventValues.SessionFailed) {
        this.markStreamingSessionClosed()
        this.emitStatus({
          level: 'error',
          message: response.responseMeta?.Message ?? 'ByteDance AST session failed.',
        })
        return
      }

      if (eventCode === eventValues.SessionFinished) {
        this.finalizeCurrentTurn()
        this.markStreamingSessionClosed()
        this.emitStatus({
          level: 'info',
          message: 'ByteDance AST session finished.',
        })
      }
    } catch (error) {
      this.emitStatus({
        level: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to parse ByteDance AST message.',
      })
    }
  }

  private readonly handleStreamingError = (error: Error) => {
    this.markStreamingSessionClosed()
    this.emitStatus({
      level: 'error',
      message: `ByteDance AST socket error: ${error.message}`,
    })
  }

  private readonly handleStreamingClose = (code: number) => {
    this.finalizeCurrentTurn()
    this.markStreamingSessionClosed()
    this.socket = null

    if (code !== 1000) {
      this.emitStatus({
        level: 'warning',
        message: `ByteDance AST socket closed unexpectedly (code=${code}).`,
      })
    }
  }

  private resolveSpeakerKey(
    response: ReturnType<ByteDanceAstSession['decodeResponse']>,
    eventCode: number | undefined,
  ): {
    key: string
    stability: SpeakerStability
  } {
    const explicitKey = this.extractExplicitSpeakerKey(response)

    if (explicitKey) {
      return {
        key: explicitKey,
        stability: 'stable',
      }
    }

    const utteranceSpeakerKey = this.extractSpeakerKeyFromResult(
      response.data ?? null,
    )

    if (utteranceSpeakerKey) {
      return {
        key: utteranceSpeakerKey,
        stability: 'stable',
      }
    }

    if (
      eventCode === this.getEventValues().SourceSubtitleStart &&
      asBoolean(response.spkChg)
    ) {
      this.fallbackSpeakerSerial += 1
      this.currentSpeakerKey = `fallback:${this.fallbackSpeakerSerial}`
    }

    return {
      key: this.currentSpeakerKey || 'fallback:1',
      stability: 'unstable',
    }
  }

  private extractExplicitSpeakerKey(
    response: ReturnType<ByteDanceAstSession['decodeResponse']>,
  ) {
    const speakerId = asString(response.speakerId)?.trim()

    if (speakerId) {
      return `engine:${speakerId}`
    }

    const speaker = response.speaker

    if (typeof speaker === 'number' && Number.isFinite(speaker)) {
      return `engine:${speaker}`
    }

    if (typeof speaker === 'string' && speaker.trim()) {
      return `engine:${speaker.trim()}`
    }

    return null
  }

  private extractSpeakerKeyFromResult(data: Buffer | Uint8Array | null) {
    if (!data || !this.protoRuntime) {
      return null
    }

    try {
      const decoded = this.protoRuntime.understandingResultType.decode(data)
      const result = this.protoRuntime.understandingResultType.toObject(decoded, {
        longs: Number,
        bytes: Buffer,
      }) as {
        utterances?: Array<{
          speaker?: number | string
        }>
      }
      const utterances = Array.isArray(result.utterances)
        ? result.utterances
        : []

      for (const utterance of utterances) {
        const speaker = utterance?.speaker

        if (typeof speaker === 'number' && Number.isFinite(speaker)) {
          return `engine:${speaker}`
        }

        if (typeof speaker === 'string' && speaker.trim()) {
          return `engine:${speaker.trim()}`
        }
      }
    } catch {
      return null
    }

    return null
  }

  private getLocalSpeakerLabel(key: string) {
    const existing = this.speakerKeyToLocalSpeaker.get(key)

    if (existing) {
      return existing
    }

    this.localSpeakerSerial += 1
    const label = buildSpeakerLabel(this.localSpeakerSerial)
    this.speakerKeyToLocalSpeaker.set(key, label)
    return label
  }

  private updateSpeakerStability(next: SpeakerStability) {
    if (this.speakerStability === next) {
      return
    }

    this.speakerStability = next

    this.emitStatus({
      level: 'info',
      message:
        next === 'stable'
          ? 'Speaker diarization signal is stable.'
          : 'Speaker diarization is currently fallback-based and may drift. You can rename speakers manually.',
      speakerStability: next,
    })
  }

  private getEventValues() {
    if (!this.protoRuntime) {
      throw new Error('ByteDance AST proto runtime is not initialized.')
    }

    return this.protoRuntime.eventType.values
  }

  private sendMessage(payload: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('ByteDance AST socket is not available.')
    }

    if (!this.protoRuntime) {
      throw new Error('ByteDance AST proto runtime is not initialized.')
    }

    const message = this.protoRuntime.translateRequestType.create(payload)
    const encoded = this.protoRuntime.translateRequestType.encode(message).finish()
    this.socket.send(encoded)
  }

  private markStreamingSessionClosed() {
    this.isSessionStarted = false
  }

  private decodeResponse(payload: WebSocket.RawData) {
    if (!this.protoRuntime) {
      throw new Error('ByteDance AST proto runtime is not initialized.')
    }

    const buffer =
      payload instanceof Buffer ? payload : Buffer.from(payload as ArrayBuffer)
    const decoded = this.protoRuntime.translateResponseType.decode(buffer)

    return this.protoRuntime.translateResponseType.toObject(decoded, {
      longs: Number,
      bytes: Buffer,
    }) as {
      event?: number
      speakerId?: string
      speaker?: string | number
      text?: string
      data?: Buffer
      startTime?: number
      endTime?: number
      spkChg?: boolean
      mutedDurationMs?: number
      responseMeta?: {
        SessionID?: string
        Sequence?: number
        StatusCode?: number
        Message?: string
      }
    }
  }

  private ensureCurrentSegmentId(startTime: number | undefined) {
    if (typeof startTime === 'number' && startTime > 0) {
      this.currentSourceStartTime = startTime
    }

    if (!this.currentSourceSegmentId) {
      this.utteranceSerial += 1
      this.currentSourceSegmentId = this.buildSegmentId()
    }

    return this.currentSourceSegmentId
  }

  private ensureCurrentTurn(timestamp: number, speaker: string) {
    if (!this.currentTurnId) {
      this.createCurrentTurn(timestamp, speaker)
      return
    }

    if (this.currentTurnSpeaker !== speaker) {
      this.finalizeCurrentTurn()
      this.createCurrentTurn(timestamp, speaker)
      return
    }

    if (timestamp - this.currentTurnUpdatedAt > TURN_BREAK_MS) {
      this.finalizeCurrentTurn()
      this.createCurrentTurn(timestamp, speaker)
    }
  }

  private createCurrentTurn(timestamp: number, speaker: string) {
    this.turnSerial += 1
    this.currentTurnId = this.buildTurnId()
    this.currentTurnSpeaker = speaker
    this.currentTurnUpdatedAt = timestamp
    this.currentTurnUtteranceOrder = []
    this.currentTurnUtteranceTexts.clear()
  }

  private resetCurrentTurn() {
    this.currentTurnId = null
    this.currentTurnSpeaker = ''
    this.currentTurnUpdatedAt = 0
    this.currentTurnUtteranceOrder = []
    this.currentTurnUtteranceTexts.clear()
  }

  private finalizeCurrentTurn() {
    if (!this.currentTurnId || !this.currentTurnSpeaker) {
      this.resetCurrentTurn()
      return
    }

    const text = this.buildCurrentTurnText()

    if (text) {
      this.emitTurn({
        id: this.currentTurnId,
        speaker: this.currentTurnSpeaker,
        text,
        timestamp: this.currentTurnUpdatedAt,
        isFinal: true,
        source: 'ast',
      })
    }

    this.resetCurrentTurn()
  }

  private upsertCurrentTurnSegment(segment: TranscriptSegment) {
    if (segment.source !== 'ast') {
      return
    }

    this.ensureCurrentTurn(segment.timestamp, segment.speaker)

    if (!this.currentTurnId) {
      return
    }

    if (!this.currentTurnUtteranceTexts.has(segment.id)) {
      this.currentTurnUtteranceOrder.push(segment.id)
    }

    const previousText = this.currentTurnUtteranceTexts.get(segment.id) ?? ''
    this.currentTurnUtteranceTexts.set(
      segment.id,
      segment.isFinal
        ? segment.text
        : pickPreferredText(previousText, segment.text),
    )
    this.currentTurnUpdatedAt = Math.max(this.currentTurnUpdatedAt, segment.timestamp)

    const text = this.buildCurrentTurnText()

    if (!text) {
      return
    }

    this.emitTurn({
      id: this.currentTurnId,
      speaker: this.currentTurnSpeaker,
      text,
      timestamp: this.currentTurnUpdatedAt,
      isFinal: false,
      source: 'ast',
    })
  }

  private buildCurrentTurnText() {
    let merged = ''

    for (const utteranceId of this.currentTurnUtteranceOrder) {
      const utteranceText = this.currentTurnUtteranceTexts.get(utteranceId) ?? ''

      if (!utteranceText) {
        continue
      }

      merged = mergeTurnText(merged, utteranceText)
    }

    return merged.trim()
  }

  private buildSegmentId() {
    const speakerToken = this.currentSpeakerKey.replace(/[^a-zA-Z0-9:_-]/g, '_')
    return `ast-${this.sessionId}-${speakerToken}-utt${this.utteranceSerial}-t${this.currentSourceStartTime}`
  }

  private buildTurnId() {
    const speakerToken = this.currentSpeakerKey.replace(/[^a-zA-Z0-9:_-]/g, '_')
    return `ast-turn-${this.sessionId}-${speakerToken}-turn${this.turnSerial}`
  }

  private toWallClockTimestamp(offsetMs: number) {
    return this.sessionEpochMs + Math.max(0, offsetMs)
  }
}
