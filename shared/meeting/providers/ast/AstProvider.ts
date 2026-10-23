import type { TranscriptSegment } from '../../types/transcript'

export type TranscriptSegmentCallback = (segment: TranscriptSegment) => void

export interface AstProviderStatusPayload {
  level: 'info' | 'warning' | 'error'
  message: string
  speakerStability?: 'stable' | 'unstable'
}

export const VOLC_ASR_AUDIO_SEND_STOPPED_PREFIX = 'Volc ASR 音频发送已停止'
export const VOLC_ASR_SESSION_FINISHED_MESSAGE = 'Volc ASR session finished.'
export const VOLC_ASR_SOCKET_CLOSED_PREFIX = 'Volc ASR socket closed unexpectedly'

export const isTerminalAstStatus = (payload: Pick<AstProviderStatusPayload, 'level' | 'message'>) =>
  payload.level === 'error' ||
  payload.message === VOLC_ASR_SESSION_FINISHED_MESSAGE ||
  payload.message.startsWith(VOLC_ASR_SOCKET_CLOSED_PREFIX) ||
  payload.message.startsWith(VOLC_ASR_AUDIO_SEND_STOPPED_PREFIX)

export type AstStatusCallback = (payload: AstProviderStatusPayload) => void

export interface AstStartOptions {
  initiallyPaused?: boolean
}

export interface AstProvider {
  readonly id: string
  readonly label: string
  start(
    onSegment: TranscriptSegmentCallback,
    onStatus?: AstStatusCallback,
    options?: AstStartOptions,
  ): Promise<void>
  pause?(): Promise<void>
  resume?(signal?: AbortSignal): Promise<void>
  stop(): Promise<void> | void
}
