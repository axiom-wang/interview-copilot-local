import type { PinnedSegment } from '../types/session'
import type { TranscriptSegment } from '../types/transcript'

export const getCurrentSegment = (
  segments: TranscriptSegment[],
): TranscriptSegment | null => segments.at(-1) ?? null

export const getRecentSegments = (
  segments: TranscriptSegment[],
  windowMs: number,
): TranscriptSegment[] => {
  const newestTimestamp = segments.at(-1)?.timestamp

  if (!newestTimestamp) {
    return []
  }

  return segments.filter(
    (segment) => newestTimestamp - segment.timestamp <= windowMs,
  )
}

export const mergeTranscriptText = (segments: TranscriptSegment[]) =>
  segments.map((segment) => `${segment.speaker}: ${segment.text}`).join('\n')

export const createPinnedSegment = (
  segment: TranscriptSegment,
  note = 'Pinned from Live Assist',
): PinnedSegment => ({
  id: `pin-${segment.id}`,
  segmentId: segment.id,
  note,
  pinnedAt: Date.now(),
})
