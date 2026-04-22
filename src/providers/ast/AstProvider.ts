import type { TranscriptSegment } from '../../types/transcript'

export type TranscriptSegmentCallback = (segment: TranscriptSegment) => void

export interface AstProviderStatusPayload {
  level: 'info' | 'warning' | 'error'
  message: string
  speakerStability?: 'stable' | 'unstable'
}

export type AstStatusCallback = (payload: AstProviderStatusPayload) => void

export interface AstProvider {
  readonly id: string
  readonly label: string
  start(
    onSegment: TranscriptSegmentCallback,
    onStatus?: AstStatusCallback,
  ): Promise<void>
  pause?(): Promise<void>
  resume?(): Promise<void>
  stop(): void
}
